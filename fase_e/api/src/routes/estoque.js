// Serviço 3 - Registrar movimentação de estoque (UC-06 / RF-06) - INSERÇÃO + ATUALIZAÇÃO
// POST /api/estoque/movimentacoes
//   { produto_id, usuario_id, tipo: "ENTRADA"|"SAIDA", quantidade, motivo, fornecedor_id?, prontuario_id? }
// Os triggers trg_mov_estoque_bi (SELECT ... FOR UPDATE + RN-05 + saldo) e
// trg_mov_estoque_ai (UPDATE produto.quantidade) completam a operação.
// Após gravar, consulta a view vw_produtos_estoque_baixo para sinalizar o alerta da RN-06.
const { Router } = require('express');
const pool = require('../db');

const router = Router();

router.post('/movimentacoes', async (req, res, next) => {
  const b = req.body || {};
  if (!b.produto_id || !b.usuario_id || !['ENTRADA', 'SAIDA'].includes(b.tipo) || !(b.quantidade > 0) || !b.motivo) {
    return res.status(400).json({ erro: 'Campos obrigatórios: produto_id, usuario_id, tipo, quantidade > 0, motivo' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [r] = await conn.query(
      `INSERT INTO movimentacao_estoque
         (produto_id, usuario_id, tipo, quantidade, motivo, fornecedor_id, prontuario_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [b.produto_id, b.usuario_id, b.tipo, b.quantidade, b.motivo,
        b.tipo === 'ENTRADA' ? b.fornecedor_id || null : null,
        b.tipo === 'SAIDA' ? b.prontuario_id || null : null],
    );
    const [[prod]] = await conn.query(
      `SELECT p.id, p.nome, p.quantidade, p.quantidade_minima,
              (b.id IS NOT NULL) AS estoque_baixo
         FROM produto p
         LEFT JOIN vw_produtos_estoque_baixo b ON b.id = p.id
        WHERE p.id = ?`,
      [b.produto_id],
    );
    await conn.commit();
    res.status(201).json({ movimentacao_id: r.insertId, produto: { ...prod, estoque_baixo: !!prod.estoque_baixo } });
  } catch (err) {
    await conn.rollback().catch(() => {});
    if (err.sqlState === '45000') return res.status(422).json({ erro: err.sqlMessage });
    if (err.code === 'ER_NO_REFERENCED_ROW_2') return res.status(422).json({ erro: 'Produto/usuário inexistente' });
    if (err.code === 'ER_LOCK_DEADLOCK' || err.code === 'ER_LOCK_WAIT_TIMEOUT') {
      return res.status(503).json({ erro: 'Conflito de concorrência no estoque, tente novamente' });
    }
    next(err);
  } finally {
    conn.release();
  }
});

module.exports = router;
