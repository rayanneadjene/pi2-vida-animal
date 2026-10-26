-- =====================================================================
-- Clínica Veterinária "Vida Animal" — Esquema Lógico Relacional (Fase B-3)
-- SGBD alvo: MySQL 8.0 (InnoDB, utf8mb4)
-- Pode ser importado no MySQL Workbench em:
--   File > Import > Reverse Engineer MySQL Create Script...
-- para gerar o diagrama EER (notação pé-de-galinha) na própria ferramenta.
-- =====================================================================

CREATE DATABASE IF NOT EXISTS clinica_vida_animal
  DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE clinica_vida_animal;

-- ---------------------------------------------------------------------
-- Cadastro
-- ---------------------------------------------------------------------
CREATE TABLE tutor (
  id             INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  cpf_hash       CHAR(64)      NOT NULL COMMENT 'SHA-256 do CPF normalizado (busca/unicidade) - RN-08',
  cpf_cifrado    VARBINARY(255) NOT NULL COMMENT 'CPF cifrado com AES-256 pela aplicação - RN-08',
  nome           VARCHAR(120)  NOT NULL,
  telefone       VARCHAR(20)   NOT NULL,
  email          VARCHAR(120)  NULL,
  logradouro     VARCHAR(120)  NULL,
  numero         VARCHAR(10)   NULL,
  complemento    VARCHAR(60)   NULL,
  bairro         VARCHAR(60)   NULL,
  cidade         VARCHAR(60)   NULL,
  uf             CHAR(2)       NULL,
  cep            CHAR(8)       NULL,
  data_cadastro  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pk_tutor PRIMARY KEY (id),
  CONSTRAINT uk_tutor_cpf UNIQUE (cpf_hash),
  CONSTRAINT uk_tutor_email UNIQUE (email)
) ENGINE=InnoDB;

CREATE TABLE pet (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  tutor_id         INT UNSIGNED NOT NULL COMMENT 'RN-01: todo pet tem tutor',
  nome             VARCHAR(60)  NOT NULL,
  especie          VARCHAR(30)  NOT NULL,
  raca             VARCHAR(60)  NULL,
  sexo             CHAR(1)      NOT NULL,
  data_nascimento  DATE         NULL,
  peso_kg          DECIMAL(5,2) NULL,
  CONSTRAINT pk_pet PRIMARY KEY (id),
  CONSTRAINT uk_pet_tutor_nome UNIQUE (tutor_id, nome),
  CONSTRAINT fk_pet_tutor FOREIGN KEY (tutor_id) REFERENCES tutor (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT ck_pet_sexo CHECK (sexo IN ('M', 'F')),
  CONSTRAINT ck_pet_peso CHECK (peso_kg IS NULL OR peso_kg > 0)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Usuários e perfis de acesso
-- ---------------------------------------------------------------------
CREATE TABLE usuario (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  login       VARCHAR(40)  NOT NULL,
  nome        VARCHAR(120) NOT NULL,
  email       VARCHAR(120) NOT NULL,
  senha_hash  CHAR(60)     NOT NULL COMMENT 'bcrypt - RNF-05',
  perfil      ENUM('RECEPCIONISTA', 'VETERINARIO', 'ADMINISTRADOR') NOT NULL,
  crmv        VARCHAR(20)  NULL,
  ativo       BOOLEAN      NOT NULL DEFAULT TRUE,
  CONSTRAINT pk_usuario PRIMARY KEY (id),
  CONSTRAINT uk_usuario_login UNIQUE (login),
  CONSTRAINT uk_usuario_email UNIQUE (email),
  CONSTRAINT uk_usuario_crmv UNIQUE (crmv),
  CONSTRAINT ck_usuario_crmv CHECK (
    (perfil = 'VETERINARIO' AND crmv IS NOT NULL) OR
    (perfil <> 'VETERINARIO' AND crmv IS NULL)
  )
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Agenda e atendimento
-- ---------------------------------------------------------------------
CREATE TABLE consulta (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  pet_id          INT UNSIGNED NOT NULL,
  veterinario_id  INT UNSIGNED NOT NULL,
  data_hora       DATETIME     NOT NULL COMMENT 'RN-02: seg-sab, 8h-19h (validado na aplicação/trigger)',
  tipo            ENUM('ROTINA', 'RETORNO', 'VACINACAO', 'EMERGENCIA') NOT NULL DEFAULT 'ROTINA',
  status          ENUM('AGENDADA', 'REALIZADA', 'CANCELADA', 'NO_SHOW', 'PAGA') NOT NULL DEFAULT 'AGENDADA',
  -- Coluna gerada: só "ocupa" o horário se a consulta não foi cancelada nem virou no-show.
  slot_ativo      DATETIME GENERATED ALWAYS AS (
                    IF(status IN ('AGENDADA', 'REALIZADA', 'PAGA'), data_hora, NULL)
                  ) STORED,
  CONSTRAINT pk_consulta PRIMARY KEY (id),
  CONSTRAINT uk_consulta_vet_horario UNIQUE (veterinario_id, slot_ativo),
  CONSTRAINT fk_consulta_pet FOREIGN KEY (pet_id) REFERENCES pet (id),
  CONSTRAINT fk_consulta_vet FOREIGN KEY (veterinario_id) REFERENCES usuario (id)
) ENGINE=InnoDB;

CREATE INDEX ix_consulta_data ON consulta (data_hora);

CREATE TABLE servico (
  id     INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  nome   VARCHAR(80)   NOT NULL,
  preco  DECIMAL(10,2) NOT NULL,
  ativo  BOOLEAN       NOT NULL DEFAULT TRUE,
  CONSTRAINT pk_servico PRIMARY KEY (id),
  CONSTRAINT uk_servico_nome UNIQUE (nome),
  CONSTRAINT ck_servico_preco CHECK (preco >= 0)
) ENGINE=InnoDB;

CREATE TABLE item_servico (
  consulta_id     INT UNSIGNED  NOT NULL,
  servico_id      INT UNSIGNED  NOT NULL,
  quantidade      SMALLINT      NOT NULL DEFAULT 1,
  valor_unitario  DECIMAL(10,2) NOT NULL COMMENT 'preço praticado no dia (histórico)',
  CONSTRAINT pk_item_servico PRIMARY KEY (consulta_id, servico_id),
  CONSTRAINT fk_item_consulta FOREIGN KEY (consulta_id) REFERENCES consulta (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_item_servico FOREIGN KEY (servico_id) REFERENCES servico (id),
  CONSTRAINT ck_item_qtd CHECK (quantidade > 0),
  CONSTRAINT ck_item_valor CHECK (valor_unitario >= 0)
) ENGINE=InnoDB;

CREATE TABLE prontuario (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  consulta_id    INT UNSIGNED NOT NULL,
  anamnese       TEXT         NOT NULL,
  exame_fisico   TEXT         NULL,
  diagnostico    TEXT         NOT NULL,
  prescricao     TEXT         NULL,
  data_registro  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pk_prontuario PRIMARY KEY (id),
  CONSTRAINT uk_prontuario_consulta UNIQUE (consulta_id),
  CONSTRAINT fk_prontuario_consulta FOREIGN KEY (consulta_id) REFERENCES consulta (id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Vacinação
-- ---------------------------------------------------------------------
CREATE TABLE tipo_vacina (
  id                     INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nome                   VARCHAR(60)  NOT NULL,
  intervalo_minimo_dias  SMALLINT     NOT NULL COMMENT 'RN-04',
  total_doses            SMALLINT     NOT NULL DEFAULT 1,
  CONSTRAINT pk_tipo_vacina PRIMARY KEY (id),
  CONSTRAINT uk_tipo_vacina_nome UNIQUE (nome),
  CONSTRAINT ck_tipo_vacina_intervalo CHECK (intervalo_minimo_dias > 0),
  CONSTRAINT ck_tipo_vacina_doses CHECK (total_doses > 0)
) ENGINE=InnoDB;

CREATE TABLE aplicacao_vacina (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  consulta_id     INT UNSIGNED NOT NULL,
  tipo_vacina_id  INT UNSIGNED NOT NULL,
  numero_dose     SMALLINT     NOT NULL,
  proxima_dose    DATE         NULL COMMENT 'RF-08: data prevista do reforço',
  lote            VARCHAR(30)  NULL,
  CONSTRAINT pk_aplicacao_vacina PRIMARY KEY (id),
  CONSTRAINT uk_aplicacao_consulta_tipo UNIQUE (consulta_id, tipo_vacina_id),
  CONSTRAINT fk_aplicacao_consulta FOREIGN KEY (consulta_id) REFERENCES consulta (id),
  CONSTRAINT fk_aplicacao_tipo FOREIGN KEY (tipo_vacina_id) REFERENCES tipo_vacina (id),
  CONSTRAINT ck_aplicacao_dose CHECK (numero_dose > 0)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Financeiro
-- ---------------------------------------------------------------------
CREATE TABLE recibo (
  id               INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  numero           VARCHAR(20)   NOT NULL COMMENT 'identificador natural, ex.: 2026-000123',
  consulta_id      INT UNSIGNED  NOT NULL,
  emitido_por      INT UNSIGNED  NOT NULL,
  subtotal         DECIMAL(10,2) NOT NULL,
  forma_pagamento  ENUM('DINHEIRO', 'CARTAO', 'PIX') NOT NULL,
  desconto         DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  total            DECIMAL(10,2) GENERATED ALWAYS AS (subtotal - desconto) STORED,
  data_emissao     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pk_recibo PRIMARY KEY (id),
  CONSTRAINT uk_recibo_numero UNIQUE (numero),
  CONSTRAINT uk_recibo_consulta UNIQUE (consulta_id),
  CONSTRAINT fk_recibo_consulta FOREIGN KEY (consulta_id) REFERENCES consulta (id),
  CONSTRAINT fk_recibo_usuario FOREIGN KEY (emitido_por) REFERENCES usuario (id),
  CONSTRAINT ck_recibo_subtotal CHECK (subtotal >= 0),
  -- RN-07: PIX recebe exatamente 5% de desconto; demais formas, nenhum.
  CONSTRAINT ck_recibo_desconto_pix CHECK (
    (forma_pagamento = 'PIX' AND desconto = ROUND(subtotal * 0.05, 2)) OR
    (forma_pagamento <> 'PIX' AND desconto = 0)
  )
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Estoque
-- ---------------------------------------------------------------------
CREATE TABLE fornecedor (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  cnpj          CHAR(14)     NOT NULL,
  razao_social  VARCHAR(120) NOT NULL,
  telefone      VARCHAR(20)  NULL,
  email         VARCHAR(120) NULL,
  CONSTRAINT pk_fornecedor PRIMARY KEY (id),
  CONSTRAINT uk_fornecedor_cnpj UNIQUE (cnpj)
) ENGINE=InnoDB;

CREATE TABLE produto (
  id                 INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  nome               VARCHAR(80)   NOT NULL,
  categoria          VARCHAR(40)   NOT NULL,
  controlado         BOOLEAN       NOT NULL DEFAULT FALSE COMMENT 'RN-05',
  quantidade         INT           NOT NULL DEFAULT 0,
  quantidade_minima  INT           NOT NULL COMMENT 'RN-06',
  preco_unitario     DECIMAL(10,2) NOT NULL,
  fornecedor_id      INT UNSIGNED  NULL COMMENT 'fornecedor habitual',
  CONSTRAINT pk_produto PRIMARY KEY (id),
  CONSTRAINT uk_produto_nome UNIQUE (nome),
  CONSTRAINT fk_produto_fornecedor FOREIGN KEY (fornecedor_id) REFERENCES fornecedor (id),
  CONSTRAINT ck_produto_qtd CHECK (quantidade >= 0),
  CONSTRAINT ck_produto_qtd_min CHECK (quantidade_minima >= 0),
  CONSTRAINT ck_produto_preco CHECK (preco_unitario >= 0)
) ENGINE=InnoDB;

CREATE TABLE movimentacao_estoque (
  id                 INT UNSIGNED NOT NULL AUTO_INCREMENT,
  produto_id         INT UNSIGNED NOT NULL,
  usuario_id         INT UNSIGNED NOT NULL,
  tipo               ENUM('ENTRADA', 'SAIDA') NOT NULL,
  quantidade         INT          NOT NULL,
  motivo             VARCHAR(40)  NOT NULL,
  data_movimentacao  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fornecedor_id      INT UNSIGNED NULL COMMENT 'apenas em ENTRADA',
  prontuario_id      INT UNSIGNED NULL COMMENT 'prescrição que autoriza SAIDA de controlado (RN-05)',
  CONSTRAINT pk_movimentacao PRIMARY KEY (id),
  CONSTRAINT fk_mov_produto FOREIGN KEY (produto_id) REFERENCES produto (id),
  CONSTRAINT fk_mov_usuario FOREIGN KEY (usuario_id) REFERENCES usuario (id),
  CONSTRAINT fk_mov_fornecedor FOREIGN KEY (fornecedor_id) REFERENCES fornecedor (id),
  CONSTRAINT fk_mov_prontuario FOREIGN KEY (prontuario_id) REFERENCES prontuario (id),
  CONSTRAINT ck_mov_qtd CHECK (quantidade > 0),
  CONSTRAINT ck_mov_fornecedor CHECK (tipo = 'ENTRADA' OR fornecedor_id IS NULL),
  CONSTRAINT ck_mov_prontuario CHECK (tipo = 'SAIDA' OR prontuario_id IS NULL)
) ENGINE=InnoDB;

CREATE INDEX ix_mov_produto_data ON movimentacao_estoque (produto_id, data_movimentacao);

-- ---------------------------------------------------------------------
-- Regras que envolvem mais de uma tabela (não expressáveis com CHECK)
-- ---------------------------------------------------------------------
DELIMITER $$

-- RN-05 + controle de saldo: valida a saída e atualiza produto.quantidade
CREATE TRIGGER trg_mov_estoque_bi
BEFORE INSERT ON movimentacao_estoque
FOR EACH ROW
BEGIN
  DECLARE v_controlado BOOLEAN;
  DECLARE v_saldo INT;

  SELECT controlado, quantidade INTO v_controlado, v_saldo
    FROM produto WHERE id = NEW.produto_id FOR UPDATE;

  IF NEW.tipo = 'SAIDA' THEN
    IF v_controlado AND NEW.prontuario_id IS NULL THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'RN-05: saída de produto controlado exige prescrição vinculada';
    END IF;
    IF NEW.quantidade > v_saldo THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Saldo insuficiente em estoque';
    END IF;
  END IF;
END$$

CREATE TRIGGER trg_mov_estoque_ai
AFTER INSERT ON movimentacao_estoque
FOR EACH ROW
BEGIN
  UPDATE produto
     SET quantidade = quantidade + IF(NEW.tipo = 'ENTRADA', NEW.quantidade, -NEW.quantidade)
   WHERE id = NEW.produto_id;
END$$

-- RN-02: horário de funcionamento (segunda a sábado, 8h às 19h)
CREATE TRIGGER trg_consulta_bi
BEFORE INSERT ON consulta
FOR EACH ROW
BEGIN
  IF DAYOFWEEK(NEW.data_hora) = 1
     OR TIME(NEW.data_hora) < '08:00:00'
     OR TIME(NEW.data_hora) >= '19:00:00' THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'RN-02: fora do horário de funcionamento';
  END IF;
END$$

DELIMITER ;

-- RN-06: produtos com estoque baixo (consumida pelo painel/alerta)
CREATE VIEW vw_produtos_estoque_baixo AS
  SELECT id, nome, quantidade, quantidade_minima
    FROM produto
   WHERE quantidade <= quantidade_minima;
