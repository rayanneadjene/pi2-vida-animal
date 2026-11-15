-- =====================================================================
-- Vida Animal - Otimizações de banco da Fase E (2ª medição dos testes de carga)
-- Executar após fase_c/schema_fisico.sql, fase_c/carga_inicial.sql e
-- fase_e/db/massa_de_dados.js:
--   sudo mysql < fase_e/db/otimizacoes_medicao2.sql
-- =====================================================================
USE clinica_vida_animal;

-- 1. Serviço 1 (GET /api/agenda) - hipótese 2 da 1ª medição.
-- ix_consulta_data (data_hora) obrigava, para cada uma das ~150 consultas do dia,
-- um acesso extra ao índice clusterizado (PK) de `consulta` para obter
-- veterinario_id, pet_id, tipo e status. O índice de cobertura abaixo contém todas
-- as colunas de `consulta` usadas pela agenda (o id já vem embutido em todo índice
-- secundário do InnoDB), de modo que a varredura por intervalo de data é resolvida
-- somente pelo índice ("Covering index range scan").
CREATE INDEX ix_consulta_agenda
    ON consulta (data_hora, veterinario_id, pet_id, tipo, status);

-- ix_consulta_data passa a ser redundante (prefixo do novo índice): removê-lo
-- reduz o custo de manutenção em cada INSERT/UPDATE de consulta.
DROP INDEX ix_consulta_data ON consulta;

-- 2. Serviço 2 (POST /api/estoque/movimentacoes) - hipóteses 1 e 2 da 1ª medição.
-- Reúne em um único round-trip SQL a inserção (que dispara trg_mov_estoque_bi e
-- trg_mov_estoque_ai) e a leitura pós-commit do saldo/alerta (RN-06).
-- Como a procedure roda em autocommit (sem START TRANSACTION explícito), o InnoDB
-- efetiva o INSERT e libera o X-lock sobre `produto` antes de executar o SELECT.
DROP PROCEDURE IF EXISTS sp_registrar_movimentacao;
DELIMITER $$
CREATE PROCEDURE sp_registrar_movimentacao(
  IN p_produto_id INT UNSIGNED,
  IN p_usuario_id INT UNSIGNED,
  IN p_tipo ENUM('ENTRADA', 'SAIDA'),
  IN p_quantidade INT,
  IN p_motivo VARCHAR(120),
  IN p_fornecedor_id INT UNSIGNED,
  IN p_prontuario_id INT UNSIGNED
)
BEGIN
  INSERT INTO movimentacao_estoque
    (produto_id, usuario_id, tipo, quantidade, motivo, fornecedor_id, prontuario_id)
  VALUES
    (p_produto_id, p_usuario_id, p_tipo, p_quantidade, p_motivo, p_fornecedor_id, p_prontuario_id);

  SELECT LAST_INSERT_ID() AS movimentacao_id,
         id, nome, quantidade, quantidade_minima,
         (quantidade <= quantidade_minima) AS estoque_baixo
    FROM produto
   WHERE id = p_produto_id;
END$$
DELIMITER ;

ANALYZE TABLE consulta, pet, tutor, usuario, produto, movimentacao_estoque;
