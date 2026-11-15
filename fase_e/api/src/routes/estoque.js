// Serviço 2 - Registrar movimentação de estoque (UC-06 / RF-06) - LEITURA + INSERÇÃO + ATUALIZAÇÃO
// POST /api/estoque/movimentacoes
//   { produto_id, usuario_id, tipo: "ENTRADA"|"SAIDA", quantidade, motivo, fornecedor_id?, prontuario_id? }
// Os triggers trg_mov_estoque_bi (SELECT ... FOR UPDATE + RN-05 + saldo) e
// trg_mov_estoque_ai (UPDATE produto.quantidade) completam a operação.
//
// Otimizações da 2ª medição (Fase E):
//  1. Stored procedure sp_registrar_movimentacao (fase_e/db/otimizacoes_medicao2.sql)
//     chamada via prepared statement (pool.execute): executa o INSERT (e seus triggers)
//     em autocommit e, já após liberar o X-lock sobre `produto`, lê o saldo e o alerta
//     da RN-06 em um ÚNICO round-trip SQL em vez de 4 (BEGIN + INSERT + SELECT view + COMMIT)
//     (hipóteses 1 e 2).
//  2. Sem pool.getConnection() reservando conexão durante toda a requisição; com o pool
//     ampliado (DB_POOL = 30, fase_e/api/src/db.js) o MySQL agrupa commits concorrentes
//     (group commit), reduzindo o custo por transação (hipótese 3).
const { Router } = require('express');
const pool = require('../db');

const router = Router();

router.post('/movimentacoes', async (req, res, next) => {
  const b = req.body || {};
  if (!b.produto_id || !b.usuario_id || !['ENTRADA', 'SAIDA'].includes(b.tipo) || !(b.quantidade > 0) || !b.motivo) {
    return res.status(400).json({ erro: 'Campos obrigatórios: produto_id, usuario_id, tipo, quantidade > 0, motivo' });
  }

  try {
    const [rows] = await pool.execute(
      'CALL sp_registrar_movimentacao(?, ?, ?, ?, ?, ?, ?)',
      [
        b.produto_id,
        b.usuario_id,
        b.tipo,
        b.quantidade,
        b.motivo,
        b.tipo === 'ENTRADA' ? b.fornecedor_id || null : null,
        b.tipo === 'SAIDA' ? b.prontuario_id || null : null,
      ],
    );
    const prod = rows[0][0];
    res.status(201).json({
      movimentacao_id: prod.movimentacao_id,
      produto: {
        id: prod.id,
        nome: prod.nome,
        quantidade: prod.quantidade,
        quantidade_minima: prod.quantidade_minima,
        estoque_baixo: !!prod.estoque_baixo,
      },
    });
  } catch (err) {
    if (err.sqlState === '45000') return res.status(422).json({ erro: err.sqlMessage });
    if (err.code === 'ER_NO_REFERENCED_ROW_2') return res.status(422).json({ erro: 'Produto/usuário inexistente' });
    if (err.code === 'ER_LOCK_DEADLOCK' || err.code === 'ER_LOCK_WAIT_TIMEOUT') {
      return res.status(503).json({ erro: 'Conflito de concorrência no estoque, tente novamente' });
    }
    next(err);
  }
});

module.exports = router;
