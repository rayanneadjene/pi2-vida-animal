// Serviço 1 - Visualizar agenda de consultas (UC-03 / RF-03) - LEITURA
// GET /api/agenda?data=AAAA-MM-DD[&veterinario_id=N]
const { Router } = require('express');
const pool = require('../db');

const router = Router();
const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;

router.get('/', async (req, res, next) => {
  try {
    const { data, veterinario_id: vetId } = req.query;
    if (!DATA_RE.test(data || '')) {
      return res.status(400).json({ erro: 'Parâmetro "data" obrigatório (AAAA-MM-DD)' });
    }

    const params = [`${data} 00:00:00`, `${data} 23:59:59`];
    let filtroVet = '';
    if (vetId) {
      filtroVet = 'AND c.veterinario_id = ?';
      params.push(Number(vetId));
    }

    // Usa ix_consulta_data (data_hora); junta pet, tutor e veterinário
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

    res.json({ data, total: linhas.length, consultas: linhas });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
