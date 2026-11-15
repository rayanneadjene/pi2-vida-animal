// Serviço 1 - Visualizar agenda de consultas (UC-03 / RF-03) - LEITURA
// GET /api/agenda?data=AAAA-MM-DD[&veterinario_id=N]
//
// Otimizações da 2ª medição (Fase E):
//  1. Cache em memória (TTL = AGENDA_CACHE_TTL_MS, padrão 30 s) com coalescência de
//     requisições concorrentes -> a junção de 4 tabelas só é executada no MySQL na
//     primeira consulta de cada dia dentro da janela do TTL (hipóteses 1 e 3).
//  2. A resposta é armazenada já serializada (Buffer JSON) e enviada sem novo
//     JSON.stringify nem cálculo de ETag (hipótese 3).
//  3. O índice de cobertura ix_consulta_agenda (data_hora, veterinario_id, pet_id,
//     tipo, status) - fase_e/db/otimizacoes_medicao2.sql - elimina o acesso ao índice
//     clusterizado de `consulta` para cada linha do dia (hipótese 2).
const { Router } = require('express');
const pool = require('../db');
const CacheTTL = require('../cache');

const router = Router();
const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;
const TTL = Number(process.env.AGENDA_CACHE_TTL_MS ?? 30000);
const cache = new CacheTTL({ ttlMs: TTL, maxItens: 1000 });

async function carregarAgenda(data, vetId) {
  const params = [`${data} 00:00:00`, `${data} 23:59:59`];
  let filtroVet = '';
  if (vetId) {
    filtroVet = 'AND c.veterinario_id = ?';
    params.push(vetId);
  }

  // Usa ix_consulta_agenda (cobertura); junta pet, tutor e veterinário
  const [linhas] = await pool.query(
    `SELECT c.id, c.data_hora, c.tipo, c.status,
            p.id AS pet_id, p.nome AS pet_nome, p.especie,
            t.id AS tutor_id, t.nome AS tutor_nome, t.telefone AS tutor_telefone,
            u.id AS veterinario_id, u.nome AS veterinario_nome, u.crmv
       FROM consulta c
       JOIN pet p     ON p.id = c.pet_id
       JOIN tutor t   ON t.id = p.tutor_id
       JOIN usuario u ON u.id = c.veterinario_id
      WHERE c.data_hora BETWEEN ? AND ? ${filtroVet}
      ORDER BY c.data_hora, u.nome`,
    params,
  );

  return Buffer.from(JSON.stringify({ data, total: linhas.length, consultas: linhas }));
}

router.get('/', async (req, res, next) => {
  try {
    const { data, veterinario_id: vet } = req.query;
    if (!DATA_RE.test(data || '')) {
      return res.status(400).json({ erro: 'Parâmetro "data" obrigatório (AAAA-MM-DD)' });
    }
    let vetId = null;
    if (vet !== undefined && vet !== '') {
      if (!/^\d+$/.test(String(vet)) || Number(vet) <= 0) {
        return res.status(400).json({ erro: 'Parâmetro "veterinario_id" inválido' });
      }
      vetId = Number(vet);
    }

    const corpo = TTL > 0
      ? await cache.obter(`${data}|${vetId || ''}`, () => carregarAgenda(data, vetId))
      : await carregarAgenda(data, vetId);

    res.set('Content-Type', 'application/json; charset=utf-8');
    res.set('Cache-Control', `private, max-age=${Math.floor(TTL / 1000)}`);
    res.end(corpo);
  } catch (err) {
    next(err);
  }
});

// Estatísticas do cache (acertos/faltas), usadas no relatório da 2ª medição
router.get('/cache', (_req, res) => res.json(cache.estatisticas()));

router.cache = cache;
module.exports = router;
