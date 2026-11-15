#!/usr/bin/env bash
# =====================================================================
# Vida Animal - Fase E: execução de uma rodada de medição dos testes de carga na VPS.
# Para cada serviço: recria a base (esquema físico + carga inicial + massa de dados),
# aplica as otimizações de banco e tuning do MySQL da 2ª medição, sobe a API,
# monitora CPU/memória (API Node.js, mysqld e VPS) e executa o k6 com saída JSON bruta.
#
# Uso (na VPS, a partir de ~/pi2):
#   RODADA=2026-11-15 OUT=~/pi2/resultados/medicao2 bash fase_e/scripts/run_medicao.sh
# Variáveis: OUT, RODADA, DB_POOL (padrão 30), AGENDA_CACHE_TTL_MS (padrão 30000),
#            OTIMIZACOES_DB (1 = aplica otimizações SQL e tuning InnoDB/binlog),
#            INNODB_FLUSH (padrão 2), SYNC_BINLOG (padrão 0), K6 (binário)
# =====================================================================
set -euo pipefail
cd "$(dirname "$0")/../.."          # raiz do projeto (~/pi2)

OUT=${OUT:-$PWD/resultados/medicao2}
RODADA=${RODADA:-$(date +%F)}
K6=${K6:-$(command -v k6 || echo /tmp/k6)}
export DB_POOL=${DB_POOL:-30}
export AGENDA_CACHE_TTL_MS=${AGENDA_CACHE_TTL_MS:-30000}
export NIVEIS=${NIVEIS:-'1,5,10,25,50,100,200,400'} PATAMAR=${PATAMAR:-'10s'} RAMPA=${RAMPA:-'2s'}
OTIMIZACOES_DB=${OTIMIZACOES_DB:-1}
INNODB_FLUSH=${INNODB_FLUSH:-2}
SYNC_BINLOG=${SYNC_BINLOG:-0}
SERVICOS=${SERVICOS:-'s1_agenda s2_estoque'}

rm -rf "$OUT" && mkdir -p "$OUT/raw" "$OUT/recursos"

if [ "$OTIMIZACOES_DB" = 1 ]; then
  sudo mysql -e "SET GLOBAL innodb_flush_log_at_trx_commit = ${INNODB_FLUSH}; SET GLOBAL sync_binlog = ${SYNC_BINLOG};"
fi

cat > "$OUT/meta.json" <<META
{"rodada":"$RODADA","niveis":"$NIVEIS","patamar":"$PATAMAR","rampa":"$RAMPA","db_pool":$DB_POOL,"agenda_cache_ttl_ms":$AGENDA_CACHE_TTL_MS,"otimizacoes_db":$OTIMIZACOES_DB,"innodb_flush_log_at_trx_commit":$INNODB_FLUSH,"sync_binlog":$SYNC_BINLOG}
META
sudo mysql -N -e "SELECT @@version, @@innodb_flush_log_at_trx_commit, @@sync_binlog, @@log_bin, @@innodb_buffer_pool_size" > "$OUT/mysql_config.txt"

MYSQL_PID=$(pgrep -xo mysqld)
for svc in $SERVICOS; do
  case $svc in
    s1_agenda)  script=s1_agenda.js ;;
    s2_estoque) script=s2_movimentacao_estoque.js ;;
    *) echo "serviço desconhecido: $svc"; exit 1 ;;
  esac
  echo "=== $svc ($(date +%T))"
  sudo mysql < fase_c/schema_fisico.sql
  sudo mysql < fase_c/carga_inicial.sql
  node fase_e/db/massa_de_dados.js > "$OUT/recursos/${svc}_massa.txt"
  if [ "$OTIMIZACOES_DB" = 1 ]; then
    sudo mysql < fase_e/db/otimizacoes_medicao2.sql > /dev/null
  fi

  pkill -x node || true; sleep 1
  (cd fase_e/api && nohup node src/server.js > "$OUT/recursos/${svc}_api.log" 2>&1 &)
  for _ in $(seq 20); do curl -sf http://127.0.0.1:3000/api/health > /dev/null && break; sleep 0.5; done
  API_PID=$(pgrep -xo node)

  python3 fase_e/scripts/monitor_recursos.py "$API_PID" "$MYSQL_PID" "$OUT/recursos/${svc}.csv" &
  MON_PID=$!
  "$K6" run --quiet --out "json=$OUT/raw/${svc}.json.gz" --summary-export "$OUT/raw/${svc}_summary.json" \
      "fase_e/k6/$script" > "$OUT/recursos/${svc}_k6.txt" 2>&1 || true
  kill "$MON_PID" 2>/dev/null || true
  [ "$svc" = s1_agenda ] && curl -s http://127.0.0.1:3000/api/agenda/cache > "$OUT/recursos/${svc}_cache.json" || true
done
pkill -x node || true
echo "FINALIZADO ($(date +%T)) -> $OUT"
