#!/usr/bin/env python3
"""
Vida Animal - Fase E: processamento dos resultados brutos do k6 (1ª e 2ª medições)
e geração das tabelas e gráficos evolutivos/comparativos.

Inspirado na estrutura de análise e visualização de:
  - Monitoria PI2 (plot_k6.py)
  - Referência recomendada: https://github.com/thiagoramos19/testes-de-carga-1 (graficos.py)

Entrada (por medição):  resultados/<medicao>/raw/<serviço>.json.gz   (k6 --out json)
                        resultados/<medicao>/recursos/<serviço>.csv  (monitor_recursos.py)
Saída:  resultados/<medicao>/por_nivel_<serviço>.csv, resultados/resumo.json
        fase_e/graficos/*.png

Critério de agregação por nível de concorrência: para cada patamar de VUs, selecionam-se
as amostras entre o primeiro e o último instante em que o gauge `vus` permaneceu naquele
patamar; a vazão do nível é o nº de requisições dividido pela duração da janela.
O mesmo script e critério são aplicados às duas medições para comparação justa.

Uso:  python3 fase_e/scripts/analisar_resultados.py [raiz_resultados] [pasta_graficos]
"""
import csv
import gzip
import json
import os
import sys
from datetime import datetime, timezone

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402

RAIZ = sys.argv[1] if len(sys.argv) > 1 else "resultados"
GRAF = sys.argv[2] if len(sys.argv) > 2 else os.path.join("fase_e", "graficos")
NIVEIS = [1, 5, 10, 25, 50, 100, 200, 400]
JANELAS = [1, 5, 10, 30, 60]
SLA_MS = 3000

SERVICOS = {
    "s1_agenda": ("Serviço 1 - Visualizar agenda de consultas (leitura)",
                  {"medicao1": "s1_agenda", "medicao2": "s1_agenda"}),
    "s2_estoque": ("Serviço 2 - Registrar movimentação de estoque (leitura/inserção/atualização)",
                   {"medicao1": "s3_estoque_espalhado", "medicao2": "s2_estoque"}),
}
MEDICOES = {"medicao1": "1ª medição (08/11)", "medicao2": "2ª medição (15/11)"}
COR = {"medicao1": "#d62728", "medicao2": "#2ca02c"}


def ts(s):
    """Converte timestamp RFC3339/UTC do k6 em epoch (segundos UTC)."""
    s = s.rstrip("Z")
    base, frac = (s.split(".") + ["0"])[:2]
    return datetime.fromisoformat(base).replace(tzinfo=timezone.utc).timestamp() + float("0." + frac[:6])


def estatisticas(vals):
    if not len(vals):
        return {}
    return {
        "media": float(vals.mean()),
        "mediana": float(np.median(vals)),
        "min": float(vals.min()),
        "max": float(vals.max()),
        "p90": float(np.percentile(vals, 90)),
        "p95": float(np.percentile(vals, 95)),
        "p99": float(np.percentile(vals, 99)),
    }


def ler_k6(caminho):
    dur, blk, vus, falha = [], [], [], []
    for linha in gzip.open(caminho, "rt"):
        o = json.loads(linha)
        if o.get("type") != "Point":
            continue
        m = o["metric"]
        if m == "http_req_duration":
            dur.append((ts(o["data"]["time"]), o["data"]["value"]))
        elif m == "http_req_blocked":
            blk.append((ts(o["data"]["time"]), o["data"]["value"]))
        elif m == "vus":
            vus.append((ts(o["data"]["time"]), o["data"]["value"]))
        elif m == "http_req_failed":
            falha.append((ts(o["data"]["time"]), o["data"]["value"]))
    dur = np.array(dur)
    blk = np.array(blk)
    vus = np.array(vus)
    falha = np.array(falha)
    t0 = vus[0, 0]
    dur[:, 0] -= t0
    blk[:, 0] -= t0
    vus[:, 0] -= t0
    falha[:, 0] -= t0
    return t0, dur, blk, vus, falha


def ler_recursos(caminho, t0_k6, dur):
    """Retorna dicionário com série temporal [t, api_cpu, mysql_cpu, vps_cpu, iowait, steal, api_rss, mysql_rss]."""
    if not os.path.exists(caminho):
        return None
    with open(caminho) as f:
        linhas = list(csv.DictReader(f))
    seg = np.array([float(r["segundo"]) for r in linhas])
    api = np.array([float(r["api_cpu_pct"]) for r in linhas])
    sql = np.array([float(r["mysqld_cpu_pct"]) for r in linhas])
    api_rss = np.array([float(r["api_rss_mb"]) for r in linhas])
    sql_rss = np.array([float(r["mysqld_rss_mb"]) for r in linhas])
    if "epoch" in linhas[0]:
        t = np.array([float(r["epoch"]) for r in linhas]) - t0_k6
    else:
        inicio_cpu = seg[np.argmax(api > 10)]
        inicio_carga = dur[0, 0] - dur[0, 1] / 1000
        t = seg - inicio_cpu + inicio_carga
    tem_vps = "vps_cpu_pct" in linhas[0]
    vps_cpu = np.array([float(r["vps_cpu_pct"]) for r in linhas]) if tem_vps else None
    iowait = np.array([float(r["vps_iowait_pct"]) for r in linhas]) if tem_vps else None
    steal = np.array([float(r["vps_steal_pct"]) for r in linhas]) if tem_vps else None
    return {
        "t": t, "api_cpu": api, "mysql_cpu": sql,
        "api_rss": api_rss, "mysql_rss": sql_rss,
        "vps_cpu": vps_cpu, "iowait": iowait, "steal": steal,
    }


def processar(med, arq):
    base = os.path.join(RAIZ, med)
    t0, dur, blk, vus, falha = ler_k6(os.path.join(base, "raw", f"{arq}.json.gz"))
    rec = ler_recursos(os.path.join(base, "recursos", f"{arq}.csv"), t0, dur)
    por_nivel = []
    for n in NIVEIS:
        w = vus[vus[:, 1] == n, 0]
        a, b = w.min(), w.max()
        dt = max(float(b - a), 1.0)
        d = dur[(dur[:, 0] >= a) & (dur[:, 0] < b), 1]
        f = falha[(falha[:, 0] >= a) & (falha[:, 0] < b), 1]
        lin = {
            "vus": n, "reqs": int(len(d)), "vazao": len(d) / dt,
            "media": float(d.mean()), "p50": float(np.percentile(d, 50)),
            "p90": float(np.percentile(d, 90)), "p95": float(np.percentile(d, 95)),
            "p99": float(np.percentile(d, 99)), "max": float(d.max()),
            "erros_pct": float(100 * f.mean()) if len(f) else 0.0,
        }
        if rec is not None:
            sel = (rec["t"] >= a) & (rec["t"] <= b)
            lin["cpu_api"] = float(rec["api_cpu"][sel].mean()) if sel.any() else float("nan")
            lin["cpu_mysql"] = float(rec["mysql_cpu"][sel].mean()) if sel.any() else float("nan")
            if rec["steal"] is not None:
                lin["vps_steal"] = float(rec["steal"][sel].mean()) if sel.any() else float("nan")
                lin["vps_iowait"] = float(rec["iowait"][sel].mean()) if sel.any() else float("nan")
        por_nivel.append(lin)

    fim = int(np.ceil(dur[:, 0].max()))
    bd = np.floor(dur[:, 0]).astype(int)
    bb = np.floor(blk[:, 0]).astype(int)
    t_grid = np.arange(fim + 1)
    serie = {
        "t": t_grid,
        "vazao": np.bincount(bd, minlength=fim + 1)[: fim + 1],
        "media": np.array([dur[bd == s, 1].mean() if (bd == s).any() else np.nan for s in t_grid]),
        "p95": np.array([np.percentile(dur[bd == s, 1], 95) if (bd == s).any() else np.nan for s in t_grid]),
        "blk_media": np.array([blk[bb == s, 1].mean() if (bb == s).any() else np.nan for s in t_grid]),
    }

    janelas = {}
    for w in JANELAS:
        nj = max(1, int(np.ceil((fim + 1) / w)))
        cont = np.bincount(bd // w, minlength=nj)[:nj] / w
        completas = cont[: (fim + 1) // w] if (fim + 1) // w else cont
        janelas[w] = {"serie": cont, "media": float(completas.mean()), "pico": float(completas.max())}

    dur_span = float(dur[:, 0].max() - dur[0, 0] + dur[0, 1] / 1000)
    resumo = {
        "total_reqs": int(len(dur)),
        "duracao_s": float(fim),
        "vazao_media": float(len(dur) / dur_span),
        "erros_pct": float(100 * falha[:, 1].mean()),
        "duracao": estatisticas(dur[:, 1]),
        "bloqueio": estatisticas(blk[:, 1]),
    }
    if rec is not None:
        resumo["recursos"] = {
            "api_rss_max_mb": float(rec["api_rss"].max()),
            "mysql_rss_max_mb": float(rec["mysql_rss"].max()),
            "steal_medio_pct": float(rec["steal"].mean()) if rec["steal"] is not None else None,
            "iowait_medio_pct": float(rec["iowait"].mean()) if rec["iowait"] is not None else None,
        }
    return {"por_nivel": por_nivel, "serie": serie, "janelas": janelas, "vus": vus,
            "rec": rec, "resumo": resumo}


def salvar_csv(med, svc, por_nivel):
    caminho = os.path.join(RAIZ, med, f"por_nivel_{svc}.csv")
    with open(caminho, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(por_nivel[0].keys()))
        w.writeheader()
        for lin in por_nivel:
            w.writerow({k: (round(v, 2) if isinstance(v, float) else v) for k, v in lin.items()})


def limite_sla(por_nivel):
    limite = 0
    for l in por_nivel:
        if l["p95"] <= SLA_MS and l["erros_pct"] < 1:
            limite = l["vus"]
        else:
            break
    return limite


# ----------------------------------------------------------------------------- gráficos
def graf_evolucao(svc, titulo, r, sufixo):
    fig, ax = plt.subplots(4, 1, figsize=(12, 12), sharex=True)
    ax[0].plot(r["vus"][:, 0], r["vus"][:, 1], color="gray", lw=2)
    ax[0].set_ylabel("VUs (concorrência)")
    s = r["serie"]
    ax[1].plot(s["t"], s["vazao"], color="tab:green")
    ax[1].set_ylabel("Vazão (req/s)")
    ax[2].plot(s["t"], s["media"], lw=1.2, label="média")
    ax[2].plot(s["t"], s["p95"], lw=1.2, label="p95")
    ax[2].axhline(SLA_MS, ls="--", color="darkred", lw=1, label="SLA 3 s (RNF-02)")
    ax[2].set_yscale("log")
    ax[2].set_ylabel("Latência (ms, log)")
    ax[2].legend(loc="lower right")
    if r["rec"] is not None:
        rec = r["rec"]
        ax[3].plot(rec["t"], rec["api_cpu"], lw=1.2, label="API Node.js")
        ax[3].plot(rec["t"], rec["mysql_cpu"], lw=1.2, label="MySQL")
        if rec["steal"] is not None:
            ax[3].plot(rec["t"], rec["steal"], lw=1.0, ls="--", color="tab:purple", alpha=0.8, label="CPU steal (OCI)")
        ax[3].axhline(100, ls=":", color="gray", lw=1, label="1 núcleo")
        ax[3].legend(loc="upper right", fontsize=8)
    ax[3].set_ylabel("CPU (% de 1 núcleo)")
    ax[3].set_xlabel("Tempo de teste (s)")
    for a in ax:
        a.grid(alpha=0.3)
    fig.suptitle(f"{titulo} - evolução durante o teste ({sufixo})")
    fig.tight_layout()
    fig.savefig(os.path.join(GRAF, f"{svc}_m2_evolucao.png"), dpi=100)
    plt.close(fig)


def graf_por_nivel(svc, titulo, r):
    pn = r["por_nivel"]
    x = np.arange(len(NIVEIS))
    fig, ax = plt.subplots(figsize=(12, 4.5))
    ax2 = ax.twinx()
    ax2.bar(x, [l["vazao"] for l in pn], width=0.35, color="tab:green", alpha=0.25, label="vazão")
    ax.plot(x, [l["media"] for l in pn], "o-", label="latência média")
    ax.plot(x, [l["p95"] for l in pn], "s--", label="latência p95")
    ax.axhline(SLA_MS, ls=":", color="darkred", lw=1, label="SLA 3 s")
    ax.set_yscale("log")
    ax.set_xticks(x, NIVEIS)
    ax.set_xlabel("Requisições simultâneas (VUs)")
    ax.set_ylabel("Latência (ms, log)")
    ax2.set_ylabel("Vazão (req/s)")
    ax.set_zorder(ax2.get_zorder() + 1)
    ax.patch.set_visible(False)
    h1, l1 = ax.get_legend_handles_labels()
    h2, l2 = ax2.get_legend_handles_labels()
    ax.legend(h1 + h2, l1 + l2, loc="upper left")
    ax.grid(alpha=0.3)
    ax.set_title(f"{titulo} - latência e vazão por concorrência (2ª medição)")
    fig.tight_layout()
    fig.savefig(os.path.join(GRAF, f"{svc}_m2_por_nivel.png"), dpi=100)
    plt.close(fig)


def graf_bloqueio(svc, titulo, r1, r2):
    """Tempo bloqueado (http_req_blocked) ao longo do tempo: 1ª x 2ª medição (inspirado em graficos.py)."""
    fig, ax = plt.subplots(figsize=(12, 4.5))
    for med, r in (("medicao1", r1), ("medicao2", r2)):
        s = r["serie"]
        ax.plot(s["t"], s["blk_media"], lw=1.4, color=COR[med], label=f"média/s - {MEDICOES[med]}")
        p95 = r["resumo"]["bloqueio"]["p95"]
        p99 = r["resumo"]["bloqueio"]["p99"]
        ax.axhline(p95, ls="--", lw=1, color=COR[med], alpha=0.6, label=f"P95 {MEDICOES[med]} ({p95:.2f} ms)")
        ax.axhline(p99, ls=":", lw=1, color=COR[med], alpha=0.5, label=f"P99 {MEDICOES[med]} ({p99:.2f} ms)")
    ax2 = ax.twinx()
    ax2.fill_between(r2["vus"][:, 0], r2["vus"][:, 1], color="gray", alpha=0.14, label="Concorrência (VUs)")
    ax2.set_ylabel("Concorrência (VUs)", color="gray")
    ax.set_xlabel("Tempo de teste (s)")
    ax.set_ylabel("Tempo bloqueado (ms)")
    ax.grid(alpha=0.3)
    h1, l1 = ax.get_legend_handles_labels()
    h2, l2 = ax2.get_legend_handles_labels()
    ax.legend(h1 + h2, l1 + l2, loc="upper left", fontsize=8)
    ax.set_title(f"{titulo}\nTempo bloqueado (http_req_blocked): 1ª x 2ª medição")
    fig.tight_layout()
    fig.savefig(os.path.join(GRAF, f"{svc}_comparativo_bloqueio.png"), dpi=100)
    plt.close(fig)


def graf_comparativo_niveis(svc, titulo, r1, r2):
    x = np.arange(len(NIVEIS))
    fig, ax = plt.subplots(2, 2, figsize=(13, 8.5))
    for med, r, mk in (("medicao1", r1, "o"), ("medicao2", r2, "s")):
        pn = r["por_nivel"]
        ax[0, 0].plot(x, [l["media"] for l in pn], mk + "-", color=COR[med], label=MEDICOES[med])
        ax[0, 1].plot(x, [l["p95"] for l in pn], mk + "-", color=COR[med], label=MEDICOES[med])
        off = -0.2 if med == "medicao1" else 0.2
        ax[1, 0].bar(x + off, [l["vazao"] for l in pn], width=0.4, color=COR[med], alpha=0.8, label=MEDICOES[med])
        if "cpu_api" in pn[0]:
            ax[1, 1].plot(x, [l["cpu_api"] for l in pn], mk + "-", color=COR[med], label=f"API Node.js - {MEDICOES[med]}")
            ax[1, 1].plot(x, [l["cpu_mysql"] for l in pn], mk + ":", color=COR[med], label=f"MySQL - {MEDICOES[med]}")
    for a, tit, yl in ((ax[0, 0], "Latência média", "ms (log)"), (ax[0, 1], "Latência p95", "ms (log)")):
        a.axhline(SLA_MS, ls="--", color="darkred", lw=1, label="SLA 3 s (RNF-02)")
        a.set_yscale("log")
        a.set_title(tit)
        a.set_ylabel(yl)
    ax[1, 0].set_title("Vazão por nível de concorrência")
    ax[1, 0].set_ylabel("req/s")
    ax[1, 1].set_title("CPU média por processo")
    ax[1, 1].set_ylabel("% de 1 núcleo")
    for a in ax.flat:
        a.set_xticks(x, NIVEIS)
        a.set_xlabel("Requisições simultâneas (VUs)")
        a.grid(alpha=0.3)
        a.legend(fontsize=8)
    fig.suptitle(f"{titulo}\nComparativo 1ª x 2ª medição por nível de concorrência")
    fig.tight_layout()
    fig.savefig(os.path.join(GRAF, f"{svc}_comparativo_niveis.png"), dpi=100)
    plt.close(fig)


def graf_comparativo_barras(svc, titulo, r1, r2):
    """Barras lado a lado por patamar de VUs (inspirado em graficos.py do repositório de referência)."""
    x = np.arange(len(NIVEIS))
    w = 0.4
    fig, eixos = plt.subplots(1, 3, figsize=(17, 5))
    metricas = [
        ("media", "Latência média (ms)"),
        ("p95", "Latência p95 (ms)"),
        ("vazao", "Vazão (req/s)"),
    ]
    for ax, (chave, nome) in zip(eixos, metricas):
        v1 = [l[chave] for l in r1["por_nivel"]]
        v2 = [l[chave] for l in r2["por_nivel"]]
        b1 = ax.bar(x - w / 2, v1, w, color="#9aa5b1", label=MEDICOES["medicao1"])
        b2 = ax.bar(x + w / 2, v2, w, color=COR["medicao2"], label=MEDICOES["medicao2"])
        ax.bar_label(b1, fmt="%.0f", fontsize=7, padding=2)
        ax.bar_label(b2, fmt="%.0f", fontsize=7, padding=2)
        if chave == "p95":
            ax.axhline(SLA_MS, ls="--", color="darkred", lw=1, label="SLA 3 s")
        ax.set_xticks(x, NIVEIS)
        ax.set_xlabel("Concorrência (VUs)")
        ax.set_title(nome, fontweight="bold")
        ax.margins(y=0.18)
        ax.grid(True, axis="y", ls="--", alpha=0.4)
    eixos[0].legend(fontsize=8)
    eixos[1].legend(fontsize=8)
    fig.suptitle(f"{titulo} — Comparativo direto por patamar (1ª x 2ª medição)", fontweight="bold")
    fig.tight_layout()
    fig.savefig(os.path.join(GRAF, f"{svc}_comparativo_barras.png"), dpi=100)
    plt.close(fig)


def graf_comparativo_tempo(svc, titulo, r1, r2):
    fig, ax = plt.subplots(3, 1, figsize=(12, 10), sharex=True)
    for med, r in (("medicao1", r1), ("medicao2", r2)):
        s = r["serie"]
        ax[0].plot(r["vus"][:, 0], r["vus"][:, 1], color=COR[med], lw=2, alpha=0.7, label=MEDICOES[med])
        ax[1].plot(s["t"], s["vazao"], color=COR[med], lw=1.2, label=MEDICOES[med])
        ax[2].plot(s["t"], s["p95"], color=COR[med], lw=1.2, label=f"p95 - {MEDICOES[med]}")
    ax[2].axhline(SLA_MS, ls="--", color="darkred", lw=1, label="SLA 3 s (RNF-02)")
    ax[2].set_yscale("log")
    ax[0].set_ylabel("VUs (concorrência)")
    ax[1].set_ylabel("Vazão (req/s)")
    ax[2].set_ylabel("Latência p95 (ms, log)")
    ax[2].set_xlabel("Tempo de teste (s)")
    for a in ax:
        a.grid(alpha=0.3)
        a.legend(loc="upper left", fontsize=9)
    fig.suptitle(f"{titulo}\nEvolução temporal: 1ª x 2ª medição (mesmo perfil de carga)")
    fig.tight_layout()
    fig.savefig(os.path.join(GRAF, f"{svc}_comparativo_tempo.png"), dpi=100)
    plt.close(fig)


def graf_comparativo_janelas(svc, titulo, r1, r2):
    x = np.arange(len(JANELAS))
    fig, ax = plt.subplots(figsize=(12, 4.5))
    for med, r, off in (("medicao1", r1, -0.2), ("medicao2", r2, 0.2)):
        med_v = [r["janelas"][w]["media"] for w in JANELAS]
        pico = [r["janelas"][w]["pico"] for w in JANELAS]
        bars = ax.bar(x + off, med_v, width=0.4, color=COR[med], alpha=0.8, label=f"média - {MEDICOES[med]}")
        ax.scatter(x + off, pico, marker="^", color="black", zorder=3,
                   label="pico" if med == "medicao2" else None)
        for bar, v in zip(bars, med_v):
            ax.annotate(f"{v:.0f}", (bar.get_x() + bar.get_width() / 2, v), ha="center", va="bottom", fontsize=8)
    ax.set_xticks(x, [f"{w}s" if w < 60 else "1min" for w in JANELAS])
    ax.set_xlabel("Intervalo de tempo")
    ax.set_ylabel("Vazão média (req/s)")
    ax.grid(alpha=0.3, axis="y")
    ax.legend(fontsize=9)
    ax.set_title(f"{titulo}\nVazão média por intervalo de tempo: 1ª x 2ª medição")
    fig.tight_layout()
    fig.savefig(os.path.join(GRAF, f"{svc}_comparativo_janelas.png"), dpi=100)
    plt.close(fig)


def graf_servicos_m2(res):
    """Serviço 1 x Serviço 2 na 2ª medição (inspirado em comparacao-servicos.png)."""
    x = np.arange(len(NIVEIS))
    fig, eixos = plt.subplots(1, 3, figsize=(16, 4.8))
    cores = {"s1_agenda": "#1f77b4", "s2_estoque": "#2ca02c"}
    nomes = {"s1_agenda": "Serviço 1 · Agenda (leitura)", "s2_estoque": "Serviço 2 · Estoque (escrita)"}
    for ax, (chave, tit) in zip(eixos, [("media", "Latência média (ms)"), ("p95", "Latência p95 (ms)"), ("vazao", "Vazão (req/s)")]):
        for s in SERVICOS:
            pn = res[s]["medicao2"]["por_nivel"]
            ax.plot(x, [l[chave] for l in pn], "o-", lw=2, color=cores[s], label=nomes[s])
        if chave == "p95":
            ax.axhline(SLA_MS, ls="--", color="darkred", lw=1, label="SLA 3 s")
        ax.set_title(tit, fontweight="bold")
        ax.set_xticks(x, NIVEIS)
        ax.set_xlabel("Concorrência (VUs)")
        ax.grid(True, ls="--", alpha=0.4)
    eixos[0].legend(fontsize=8)
    eixos[1].legend(fontsize=8)
    fig.suptitle("2ª Medição: comparação entre os serviços (0,00% de erros em ambos)", fontweight="bold")
    fig.tight_layout()
    fig.savefig(os.path.join(GRAF, "comparacao_servicos_m2.png"), dpi=100)
    plt.close(fig)


def graf_geral(res):
    rot = ["Serviço 1\nAgenda (leitura)", "Serviço 2\nEstoque (escrita)"]
    x = np.arange(2)
    fig, ax = plt.subplots(1, 4, figsize=(18, 4.8))
    for med, off in (("medicao1", -0.2), ("medicao2", 0.2)):
        vmax = [max(l["vazao"] for l in res[s][med]["por_nivel"]) for s in SERVICOS]
        p95_glob = [res[s][med]["resumo"]["duracao"]["p95"] for s in SERVICOS]
        p95_100 = [next(l["p95"] for l in res[s][med]["por_nivel"] if l["vus"] == 100) for s in SERVICOS]
        lim = [limite_sla(res[s][med]["por_nivel"]) for s in SERVICOS]
        for a, v, fmt in ((ax[0], vmax, "{:.0f}"), (ax[1], p95_glob, "{:.0f}"),
                          (ax[2], p95_100, "{:.0f}"), (ax[3], lim, "{:.0f}")):
            bars = a.bar(x + off, v, width=0.4, color=COR[med], alpha=0.85, label=MEDICOES[med])
            for bar, val in zip(bars, v):
                a.annotate(fmt.format(val), (bar.get_x() + bar.get_width() / 2, val), ha="center", va="bottom", fontsize=9)
    ax[0].set_title("Vazão máxima por nível (req/s)")
    ax[1].set_title("Latência p95 global (ms)")
    ax[2].set_title("Latência p95 com 100 VUs (ms)")
    ax[1].axhline(SLA_MS, ls="--", color="darkred", lw=1, label="SLA 3 s")
    ax[2].axhline(SLA_MS, ls="--", color="darkred", lw=1, label="SLA 3 s")
    ax[3].set_title("Limite de concorrência no SLA (VUs)")
    for a in ax:
        a.set_xticks(x, rot)
        a.margins(y=0.25)
        a.grid(alpha=0.3, axis="y")
        a.legend(loc="upper right", fontsize=8)
    fig.suptitle("Comparação consolidada 1ª x 2ª medição (VPS Oracle Cloud)", fontweight="bold")
    fig.tight_layout()
    fig.savefig(os.path.join(GRAF, "comparativo_geral.png"), dpi=100)
    plt.close(fig)


def main():
    os.makedirs(GRAF, exist_ok=True)
    res, resumo = {}, {}
    for svc, (titulo, arqs) in SERVICOS.items():
        res[svc] = {}
        for med, arq in arqs.items():
            r = processar(med, arq)
            res[svc][med] = r
            salvar_csv(med, svc, r["por_nivel"])
        r1, r2 = res[svc]["medicao1"], res[svc]["medicao2"]
        graf_evolucao(svc, titulo, r2, "2ª medição")
        graf_por_nivel(svc, titulo, r2)
        graf_bloqueio(svc, titulo, r1, r2)
        graf_comparativo_niveis(svc, titulo, r1, r2)
        graf_comparativo_barras(svc, titulo, r1, r2)
        graf_comparativo_tempo(svc, titulo, r1, r2)
        graf_comparativo_janelas(svc, titulo, r1, r2)
        resumo[svc] = {
            med: {
                "por_nivel": res[svc][med]["por_nivel"],
                "janelas": {w: {k: v for k, v in res[svc][med]["janelas"][w].items() if k != "serie"} for w in JANELAS},
                "geral": res[svc][med]["resumo"],
                "limite_sla_vus": limite_sla(res[svc][med]["por_nivel"]),
            }
            for med in arqs
        }
    graf_servicos_m2(res)
    graf_geral(res)
    with open(os.path.join(RAIZ, "resumo.json"), "w", encoding="utf-8") as f:
        json.dump(resumo, f, indent=1, ensure_ascii=False, default=float)

    for svc in SERVICOS:
        print(f"\n### {svc}")
        for med in ("medicao1", "medicao2"):
            g = resumo[svc][med]["geral"]
            d, b = g["duracao"], g["bloqueio"]
            print(f"-- {med}: reqs={g['total_reqs']} vazao_media={g['vazao_media']:.2f} limite_SLA={resumo[svc][med]['limite_sla_vus']} VUs")
            print(f"   dur: avg={d['media']:.2f} med={d['mediana']:.2f} min={d['min']:.2f} max={d['max']:.2f} p95={d['p95']:.2f} p99={d['p99']:.2f}")
            print(f"   blk: avg={b['media']:.2f} med={b['mediana']:.2f} min={b['min']:.2f} max={b['max']:.2f} p95={b['p95']:.2f} p99={b['p99']:.2f}")
            print("   janelas: " + " / ".join(f"{w}s {resumo[svc][med]['janelas'][w]['media']:.1f} (pico {resumo[svc][med]['janelas'][w]['pico']:.1f})" for w in JANELAS))
            for l in resumo[svc][med]["por_nivel"]:
                print("  " + " | ".join(f"{k}={v:.2f}" if isinstance(v, float) else f"{k}={v}" for k, v in l.items()))


if __name__ == "__main__":
    main()
