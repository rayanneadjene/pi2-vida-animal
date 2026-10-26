-- =====================================================================
-- Vida Animal — Carga inicial (Fase C-5)
-- Pré-requisito: schema_fisico.sql já executado.
-- Execução:  mysql -u root -p < carga_inicial.sql
-- Datas de consultas respeitam RN-02 (seg–sáb, 8h–19h), validada por trigger.
-- Os hashes de senha abaixo são APENAS ilustrativos (formato bcrypt, 60 car.);
-- a aplicação gera os reais. O CPF é cifrado com AES e indexado por SHA-256.
-- =====================================================================
USE clinica_vida_animal;
SET @chave = 'chave-demo-apenas-desenvolvimento';

START TRANSACTION;

-- Usuários (RF-09). VETERINARIO exige CRMV; demais perfis não possuem.
INSERT INTO usuario (id, login, nome, email, senha_hash, perfil, crmv) VALUES
 (1, 'admin',    'Rayanne Souza',   'admin@vidaanimal.com',    '$2b$10$abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0', 'ADMINISTRADOR', NULL),
 (2, 'recep1',   'Carla Menezes',   'carla@vidaanimal.com',    '$2b$10$abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1', 'RECEPCIONISTA', NULL),
 (3, 'vet.pedro','Pedro Chapetta',  'pedro@vidaanimal.com',    '$2b$10$abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ2', 'VETERINARIO',  'CRMV-RJ 12345'),
 (4, 'vet.ana',  'Ana Beatriz Lima','ana@vidaanimal.com',      '$2b$10$abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ3', 'VETERINARIO',  'CRMV-RJ 23456');

-- Tutores (RF-01). CPFs fictícios.
INSERT INTO tutor (id, cpf_hash, cpf_cifrado, nome, telefone, email, logradouro, numero, bairro, cidade, uf, cep) VALUES
 (1, SHA2('11144477735',256), AES_ENCRYPT('11144477735', @chave), 'Marcos Oliveira', '21988880001', 'marcos@email.com',  'Rua das Flores',  '100', 'Centro',    'Rio de Janeiro', 'RJ', '20000000'),
 (2, SHA2('52998224725',256), AES_ENCRYPT('52998224725', @chave), 'Juliana Pires',   '21988880002', 'juliana@email.com', 'Av. Brasil',      '2500','Penha',     'Rio de Janeiro', 'RJ', '21000000'),
 (3, SHA2('39053344705',256), AES_ENCRYPT('39053344705', @chave), 'Roberto Castro',  '21988880003', NULL,                'Rua Verde',       '45',  'Tijuca',    'Rio de Janeiro', 'RJ', '20500000');

-- Pets (RF-02). RN-01: todo pet tem tutor.
INSERT INTO pet (id, tutor_id, nome, especie, raca, sexo, data_nascimento, peso_kg) VALUES
 (1, 1, 'Thor',  'Cão',   'Labrador',     'M', '2020-03-10', 30.50),
 (2, 1, 'Luna',  'Gato',  'Siamês',       'F', '2022-07-21',  4.20),
 (3, 2, 'Bidu',  'Cão',   'Vira-lata',    'M', '2018-11-02', 12.80),
 (4, 3, 'Mel',   'Cão',   'Poodle',       'F', '2023-01-15',  5.10);

-- Catálogo de serviços (preço de tabela)
INSERT INTO servico (id, nome, preco) VALUES
 (1, 'Consulta de rotina',    120.00),
 (2, 'Aplicação de vacina',    80.00),
 (3, 'Consulta de retorno',    60.00),
 (4, 'Atendimento de emergência', 250.00),
 (5, 'Exame de sangue',       150.00);

-- Tipos de vacina (RN-04: intervalo mínimo entre doses)
INSERT INTO tipo_vacina (id, nome, intervalo_minimo_dias, total_doses) VALUES
 (1, 'V10 (polivalente canina)', 21, 3),
 (2, 'Antirrábica',             365, 1),
 (3, 'Tríplice felina (V3)',     21, 3);

-- Fornecedores e produtos. Estoque nasce em 0 e é abastecido por ENTRADAs,
-- pois o trigger trg_mov_estoque_ai mantém produto.quantidade.
INSERT INTO fornecedor (id, cnpj, razao_social, telefone, email) VALUES
 (1, '11222333000181', 'VetDistribuidora Ltda', '2133330001', 'vendas@vetdist.com'),
 (2, '44555666000172', 'FarmaPet Comércio S.A.', '2133330002', 'contato@farmapet.com');

INSERT INTO produto (id, nome, categoria, controlado, quantidade, quantidade_minima, preco_unitario, fornecedor_id) VALUES
 (1, 'Vacina V10',              'Vacina',      FALSE, 0, 10,  45.00, 1),
 (2, 'Vacina Antirrábica',      'Vacina',      FALSE, 0, 10,  30.00, 1),
 (3, 'Dipirona veterinária',    'Medicamento', FALSE, 0, 15,  12.50, 2),
 (4, 'Tramadol 50 mg',          'Medicamento', TRUE,  0,  5,  28.00, 2),
 (5, 'Seringa descartável 5ml', 'Material',    FALSE, 0, 50,   1.20, 1);

-- Consultas (RF-03). Datas passadas e futuras; RN-02 validada por trigger.
INSERT INTO consulta (id, pet_id, veterinario_id, data_hora, tipo, status) VALUES
 (1, 1, 3, '2026-10-05 09:00:00', 'ROTINA',     'PAGA'),
 (2, 2, 4, '2026-10-05 10:00:00', 'VACINACAO',  'PAGA'),
 (3, 3, 3, '2026-10-06 14:00:00', 'EMERGENCIA', 'REALIZADA'),
 (4, 1, 3, '2026-10-14 09:00:00', 'RETORNO',    'AGENDADA'),
 (5, 4, 4, '2026-10-08 15:00:00', 'ROTINA',     'CANCELADA'),
 (6, 4, 4, '2026-10-09 16:00:00', 'ROTINA',     'NO_SHOW');

INSERT INTO item_servico (consulta_id, servico_id, quantidade, valor_unitario) VALUES
 (1, 1, 1, 120.00),
 (2, 2, 1,  80.00),
 (3, 4, 1, 250.00),
 (3, 5, 1, 150.00);

-- Prontuários (RF-04)
INSERT INTO prontuario (id, consulta_id, anamnese, exame_fisico, diagnostico, prescricao) VALUES
 (1, 1, 'Tutor relata apetite normal; check-up anual.', 'Sem alterações.', 'Animal saudável.', NULL),
 (2, 3, 'Dor intensa e claudicação após queda.', 'Dor à palpação do membro posterior direito.', 'Contusão com suspeita de lesão ligamentar.', 'Tramadol 50 mg, 1 comprimido a cada 12h por 5 dias.');

-- Vacinação (RF-08). proxima_dose = data + intervalo mínimo (RN-04).
INSERT INTO aplicacao_vacina (consulta_id, tipo_vacina_id, numero_dose, proxima_dose, lote) VALUES
 (2, 3, 1, '2026-10-26', 'LT-V3-2026A');

-- Recibos (RF-07). RN-07: PIX = 5% de desconto exato; demais formas = 0.
INSERT INTO recibo (numero, consulta_id, emitido_por, subtotal, forma_pagamento, desconto) VALUES
 ('2026-000001', 1, 2, 120.00, 'PIX',    6.00),
 ('2026-000002', 2, 2,  80.00, 'CARTAO', 0.00);

-- Movimentações de estoque (RF-06). ENTRADAs primeiro; depois SAÍDAs.
INSERT INTO movimentacao_estoque (produto_id, usuario_id, tipo, quantidade, motivo, data_movimentacao, fornecedor_id) VALUES
 (1, 1, 'ENTRADA', 30, 'Compra inicial', '2026-10-01 08:30:00', 1),
 (2, 1, 'ENTRADA', 20, 'Compra inicial', '2026-10-01 08:30:00', 1),
 (3, 1, 'ENTRADA', 40, 'Compra inicial', '2026-10-01 08:35:00', 2),
 (4, 1, 'ENTRADA',  8, 'Compra inicial', '2026-10-01 08:35:00', 2),
 (5, 1, 'ENTRADA',100, 'Compra inicial', '2026-10-01 08:40:00', 1);

INSERT INTO movimentacao_estoque (produto_id, usuario_id, tipo, quantidade, motivo, data_movimentacao, prontuario_id) VALUES
 (5, 4, 'SAIDA', 1, 'Uso em vacinação',   '2026-10-05 10:05:00', NULL),
 (4, 3, 'SAIDA', 5, 'Dispensa prescrita (RN-05)', '2026-10-06 15:00:00', 2);  -- controlado: exige prontuário

COMMIT;

-- Conferência rápida
-- SELECT * FROM vw_produtos_estoque_baixo;  -- deve listar 'Tramadol 50 mg' (3 <= 5)
