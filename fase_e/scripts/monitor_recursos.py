#!/usr/bin/env python3
"""
Amostra, a cada 1 s, o uso de CPU (% de 1 núcleo) e memória (RSS) dos processos
da API (Node.js) e do MySQL durante um teste de carga. Lê /proc diretamente.
2ª medição: registra também a CPU total da VPS (todos os processos, inclusive o k6),
o iowait, o steal (CPU retirada pelo hipervisor da OCI) e o instante absoluto (epoch)
para alinhar as amostras com a linha do tempo do k6.
Uso: python3 monitor_recursos.py <pid_api> <pid_mysqld> <saida.csv>
Termina sozinho quando um dos processos deixa de existir (ou com SIGTERM).
"""
import os
import signal
import sys
import time

TICK = os.sysconf("SC_CLK_TCK")
PAGE = os.sysconf("SC_PAGE_SIZE")


def ler(pid):
    with open(f"/proc/{pid}/stat") as f:
        campos = f.read().rsplit(")", 1)[1].split()
    cpu = (int(campos[11]) + int(campos[12])) / TICK   # utime + stime
    rss = int(campos[21]) * PAGE / 2**20                # MiB
    return cpu, rss


def ler_sistema():
    """Retorna (ocupado, iowait, steal, total) em ticks acumulados de todos os núcleos."""
    with open("/proc/stat") as f:
        v = [int(x) for x in f.readline().split()[1:9]]
    user, nice, system, idle, iowait, irq, softirq, steal = v
    return user + nice + system + irq + softirq, iowait, steal, sum(v)


def main():
    pids = {"api": int(sys.argv[1]), "mysqld": int(sys.argv[2])}
    ncpu = os.cpu_count() or 1
    rodando = [True]
    signal.signal(signal.SIGTERM, lambda *_: rodando.__setitem__(0, False))
    with open(sys.argv[3], "w") as out:
        out.write("segundo,api_cpu_pct,api_rss_mb,mysqld_cpu_pct,mysqld_rss_mb,"
                  "vps_cpu_pct,vps_iowait_pct,vps_steal_pct,epoch\n")
        ant = {k: ler(p)[0] for k, p in pids.items()}
        sis_ant = ler_sistema()
        t0 = t_ant = time.time()
        while rodando[0]:
            time.sleep(1)
            try:
                atual = {k: ler(p) for k, p in pids.items()}
            except FileNotFoundError:
                break
            sis = ler_sistema()
            agora = time.time()
            dt = agora - t_ant
            lin = [str(int(agora - t0))]
            for k in pids:
                lin += [f"{100 * (atual[k][0] - ant[k]) / dt:.1f}", f"{atual[k][1]:.1f}"]
                ant[k] = atual[k][0]
            dtot = max(sis[3] - sis_ant[3], 1)
            # % de 1 núcleo (0 a 100 x nº de vCPUs), mesma escala dos processos
            lin += [f"{100 * ncpu * (sis[i] - sis_ant[i]) / dtot:.1f}" for i in range(3)]
            sis_ant = sis
            t_ant = agora
            lin.append(f"{agora:.3f}")   # instante absoluto (alinhamento com o k6)
            out.write(",".join(lin) + "\n")
            out.flush()


if __name__ == "__main__":
    main()
