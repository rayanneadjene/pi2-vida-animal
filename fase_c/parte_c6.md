
---

## 12. Esquema Físico e Carga Inicial do Banco de Dados Não Relacional (Fase C-6)

### 12.1. SGBD Não Relacional Utilizado

| Item | Definição |
|---|---|
| **SGBD** | **MongoDB 7.0 Community Edition** (SGBD NoSQL orientado a documentos; classificado como **CP** no Teorema CAP — Consistência e Tolerância a Partição) |
| **Motor de armazenamento** | **WiredTiger** (controle de concorrência multiversão MVCC, transações ACID multi-documento, compressão nativa Snappy e índices em árvore B+) |
| **Formato físico / Codificação** | Documentos binários **BSON** (*Binary JSON*) codificados em UTF-8 |
| **Linguagem específica** | **MQL** (*MongoDB Query Language* / JavaScript para `mongosh`), com validação declarativa via `$jsonSchema` e `$expr` |
| **Scripts** | [`fase_c/schema_fisico_mongodb.js`](fase_c/schema_fisico_mongodb.js) (esquema, restrições e índices) e [`fase_c/carga_inicial_mongodb.js`](fase_c/carga_inicial_mongodb.js) (carga inicial) |
| **Ordem de execução** | `mongosh < fase_c/schema_fisico_mongodb.js` e depois `mongosh < fase_c/carga_inicial_mongodb.js` |

### 12.2. Decisões do Esquema Físico e Mapeamento para Agregados

A transição do modelo relacional normalizado em 3FN (13 tabelas na Seção 11) para o modelo físico orientado a documentos no MongoDB resultou em **8 coleções** e **1 *view***, aplicando os padrões de projeto de agregados NoSQL (*Embedding* vs. *Referencing*):

1. **Documentos embutidos 1:1 e 1:0..1 (*Embedded Subdocuments*):**
   - `tutores.endereco`: o endereço compõe exclusivamente o cadastro do tutor e é sempre lido junto com ele.
   - `consultas.prontuario` e `consultas.recibo`: no modelo de domínio (Seção 7), uma consulta gera no máximo um prontuário (`0..1`) e um recibo (`0..1`). Embuti-los no próprio documento da consulta elimina junções (`$lookup`) ao abrir o histórico clínico (UC-03) ou o comprovante financeiro (UC-04), além de garantir atomicidade na gravação de um único documento BSON.
   - `produtos.fornecedor`: os dados do fornecedor habitual ficam aninhados no produto, evitando uma coleção separada apenas para consulta cadastral.
2. **Arrays de subdocumentos embutidos 1:N limitados (*Bounded Embedded Arrays*):**
   - `pets.vacinas_aplicadas`: um pet recebe um número reduzido e limitado de doses ao longo da vida (dezenas de subdocumentos, longe do limite de 16 MB do BSON). Embutir o histórico vacinal diretamente no documento de `pets` permite carregar a carteira de vacinação em uma única leitura (RF-05, RF-08) e indexar `vacinas_aplicadas.proxima_dose` com um **índice *multikey***.
   - `consultas.itens_servico`: substitui a tabela associativa `item_servico`, armazenando dentro da própria consulta os serviços executados e o `valor_unitario` histórico praticado no atendimento.
3. **Referências (`ObjectId`) para agregados com ciclo de vida próprio ou crescimento contínuo (*Unbounded Growth*):**
   - `tutores` (1) ← `pets` (N) ← `consultas` (N): mantidos em coleções separadas porque `pets` e `consultas` são consultados diretamente pela agenda e pelo prontuário, e o histórico de consultas de toda a clínica cresce continuamente.
   - `movimentacoes_estoque`: mantida em coleção própria (referenciando `produto_id`, `usuario_id` e `consulta_id`), pois o extrato de entradas e saídas de um produto cresce indefinidamente ao longo do tempo e não deve formar um array ilimitado dentro de `produtos`.
4. **Desnormalização controlada para desempenho (RNF-02):**
   - `pets.tutor_resumo` (`{ nome, telefone }`) e `consultas.resumo_atendimento` (`{ pet_nome, tutor_nome, veterinario_nome }`) replicam campos de leitura frequente na recepção e na agenda diária, evitando operações `$lookup` nas telas mais acessadas.

**Resumo das coleções, chaves, índices e restrições físicas:**

| Coleção (PK: `_id`) | Chaves únicas e compostas (UK) | Índices secundários / *Multikey* | Principais restrições (`$jsonSchema` / `$expr`) |
|---|---|---|---|
| **usuarios** | `uk_usuario_login` (`login`); `uk_usuario_email` (`email`); `uk_usuario_crmv` (`crmv`, *partial*) | — | `perfil` ∈ {`ADMINISTRADOR`, `RECEPCIONISTA`, `VETERINARIO`}; `oneOf` exige `crmv` se e só se `VETERINARIO`; `senha_hash` bcrypt 60 car. (RNF-05). |
| **tutores** | `uk_tutor_cpf` (`cpf_hash`); `uk_tutor_email` (`email`, *partial*) | `ix_tutor_nome` (`nome`) | `cpf_hash` (SHA-256, 64 car.) e `cpf_cifrado` (`binData` AES-256) obrigatórios (RN-08); subdocumento `endereco` com CEP de 8 dígitos. |
| **pets** | **Composta:** `uk_pet_tutor_nome` (`tutor_id` + `nome`) | **Multikey:** `ix_pet_vacinas_proxima` (`vacinas_aplicadas.proxima_dose`) | `tutor_id` obrigatório (`objectId`, RN-01); `sexo` ∈ {`'M'`, `'F'`}; `peso_kg > 0`; validação dos itens de `vacinas_aplicadas`. |
| **servicos** | `uk_servico_nome` (`nome`) | — | `preco >= 0`; `ativo` booleano. |
| **tipos_vacina** | `uk_tipo_vacina_nome` (`nome`) | — | `intervalo_minimo_dias >= 1` (RN-04); `total_doses >= 1`. |
| **consultas** | **Composta parcial:** `uk_consulta_vet_horario_ativo` (`veterinario_id` + `data_hora`); `uk_recibo_numero` (`recibo.numero`, *partial*) | **Composto:** `ix_consulta_pet_data` (`pet_id`, `data_hora: -1`); `ix_consulta_data` (`data_hora`) | `$expr` valida RN-02 (seg–sáb, 8h–19h) e RN-07 (`recibo.total = subtotal - desconto` e desconto de 5% exclusivo para `PIX`). |
| **produtos** | `uk_produto_nome` (`nome`) | — | `quantidade >= 0`, `quantidade_minima >= 0` (RN-06), `preco_unitario >= 0`; subdocumento `fornecedor` com CNPJ de 14 dígitos. |
| **movimentacoes_estoque** | — | **Composto:** `ix_mov_produto_data` (`produto_id`, `data_movimentacao: -1`) | `quantidade >= 1`; `oneOf` impõe RN-05: saída de controlado (`produto_controlado: true`) exige `consulta_id` (`objectId`) não nulo. |

**Atendimento às Regras de Negócio no SGBD Não Relacional:**

| Regra | Mecanismo físico no MongoDB |
|---|---|
| **RN-01** (pet com tutor) | Campo `tutor_id` com `bsonType: "objectId"` listado em `required` no `$jsonSchema` da coleção `pets`. |
| **RN-02** (horário e sem conflito) | Expressão `$expr` com `$dayOfWeek` e `$hour` no validador de `consultas` (seg–sáb, 8h–19h) + **chave composta única parcial** `uk_consulta_vet_horario_ativo` (`partialFilterExpression: { status: { $in: ["AGENDADA", "REALIZADA", "PAGA"] } }`), que libera o horário automaticamente quando a consulta passa para `CANCELADA` ou `NO_SHOW`. |
| **RN-04** (intervalo vacinal) | Campo `intervalo_minimo_dias` (`minimum: 1`) em `tipos_vacina` e registro de `proxima_dose` nos subdocumentos de `pets.vacinas_aplicadas`, indexado via índice *multikey*. |
| **RN-05** (controlado exige prescrição) | Cláusula `oneOf` no `$jsonSchema` de `movimentacoes_estoque`: quando `tipo = "SAIDA"` e `produto_controlado = true`, o campo `consulta_id` é obrigado a ser um `objectId` válido. |
| **RN-06** (estoque mínimo) | View `vw_produtos_estoque_baixo` criada com `db.createView` e estágio `$match: { $expr: { $lte: ["$quantidade", "$quantidade_minima"] } }`. |
| **RN-07** (desconto PIX de 5%) | Expressão `$expr` no validador de `consultas`: exige `recibo.total == recibo.subtotal - recibo.desconto` e `recibo.desconto == round(recibo.subtotal * 0.05, 2)` se `forma_pagamento == "PIX"` (ou `0` caso contrário). |
| **RN-08 / RNF-05** (LGPD e senha) | `tutores.cpf_cifrado` (`bsonType: "binData"`, AES-256), `tutores.cpf_hash` (SHA-256, 64 caracteres, índice único) e `usuarios.senha_hash` (bcrypt, 60 caracteres). |

---

### 12.3. Diagramas da Estrutura e Organização Física no SGBD Não Relacional

#### 12.3.1. Diagrama do Esquema de Coleções, Documentos Embutidos e Referências

O diagrama abaixo representa a estrutura das 8 coleções do banco `clinica_vida_animal` no MongoDB, destacando os subdocumentos embutidos (`<<Embedded 1:1>>` e `<<Embedded 0..1>>`), os arrays de subdocumentos (`<<Embedded 0..*>>`), as chaves compostas e índices (`<<UK>>`, `<<UK1>>`, `<<UK_Partial>>`, `<<Multikey Index>>`) e os relacionamentos por referência (`ObjectId`):

![Diagrama do Esquema de Coleções e Agregados NoSQL](fase_c/diagramas/esquema_nosql_agregados.png)

#### 12.3.2. Diagrama de Exemplo da Organização Física dos Documentos BSON

O diagrama a seguir exemplifica a **organização física real dos dados** armazenados no motor WiredTiger do MongoDB a partir de instâncias da carga inicial, ilustrando como o aninhamento físico (subdocumentos `endereco`, `tutor_resumo`, `prontuario`, `recibo`, `fornecedor` e arrays `vacinas_aplicadas`, `itens_servico`) coexiste com o encadeamento por `ObjectId` entre coleções (`tutores` ← `pets` ← `consultas` ← `movimentacoes_estoque` → `produtos`):

![Diagrama de Exemplo da Organização Física dos Dados no MongoDB](fase_c/diagramas/exemplo_organizacao_fisica_nosql.png)

---

### 12.4. Script do Esquema Físico Não Relacional (`schema_fisico_mongodb.js`)

```javascript
// =====================================================================
// Clínica Veterinária "Vida Animal" — Esquema Físico Não Relacional (Fase C-6)
// SGBD alvo: MongoDB 7.0+ (Motor WiredTiger, codificação BSON/UTF-8)
// Execução:  mongosh < fase_c/schema_fisico_mongodb.js
// =====================================================================

db = db.getSiblingDB("clinica_vida_animal");

// Remove coleções e views anteriores para recriação limpa do esquema
db.vw_produtos_estoque_baixo.drop();
db.movimentacoes_estoque.drop();
db.consultas.drop();
db.produtos.drop();
db.tipos_vacina.drop();
db.servicos.drop();
db.pets.drop();
db.tutores.drop();
db.usuarios.drop();

// ---------------------------------------------------------------------
// 1. Coleção: usuarios (RF-09, RNF-05)
// Restrição condicional (oneOf): CRMV é obrigatório se e somente se
// o perfil for VETERINARIO.
// ---------------------------------------------------------------------
db.createCollection("usuarios", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["login", "nome", "email", "senha_hash", "perfil", "ativo"],
      properties: {
        login:      { bsonType: "string", minLength: 3, maxLength: 40 },
        nome:       { bsonType: "string", minLength: 2, maxLength: 120 },
        email:      { bsonType: "string", pattern: "^.+@.+\\..+$" },
        senha_hash: { bsonType: "string", minLength: 60, maxLength: 60, description: "Hash bcrypt (RNF-05)" },
        perfil:     { enum: ["ADMINISTRADOR", "RECEPCIONISTA", "VETERINARIO"] },
        crmv:       { bsonType: ["string", "null"], maxLength: 20 },
        ativo:      { bsonType: "bool" }
      },
      oneOf: [
        { properties: { perfil: { enum: ["VETERINARIO"] }, crmv: { bsonType: "string", minLength: 4 } }, required: ["crmv"] },
        { properties: { perfil: { enum: ["ADMINISTRADOR", "RECEPCIONISTA"] }, crmv: { bsonType: "null" } } }
      ]
    }
  },
  validationLevel: "strict",
  validationAction: "error"
});

db.usuarios.createIndex({ login: 1 }, { name: "uk_usuario_login", unique: true });
db.usuarios.createIndex({ email: 1 }, { name: "uk_usuario_email", unique: true });
db.usuarios.createIndex(
  { crmv: 1 },
  { name: "uk_usuario_crmv", unique: true, partialFilterExpression: { crmv: { $type: "string" } } }
);

// ---------------------------------------------------------------------
// 2. Coleção: tutores (RF-01, RN-08)
// Embute o subdocumento 'endereco' (1:1 fortemente acoplado).
// ---------------------------------------------------------------------
db.createCollection("tutores", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["cpf_hash", "cpf_cifrado", "nome", "telefone", "data_cadastro"],
      properties: {
        cpf_hash:      { bsonType: "string", minLength: 64, maxLength: 64, description: "SHA-256 do CPF (RN-08)" },
        cpf_cifrado:   { bsonType: "binData", description: "CPF cifrado com AES-256 (RN-08)" },
        nome:          { bsonType: "string", minLength: 2, maxLength: 120 },
        telefone:      { bsonType: "string", minLength: 8, maxLength: 20 },
        email:         { bsonType: ["string", "null"] },
        data_cadastro: { bsonType: "date" },
        endereco: {
          bsonType: "object",
          required: ["logradouro", "numero", "bairro", "cidade", "uf", "cep"],
          properties: {
            logradouro:  { bsonType: "string", maxLength: 120 },
            numero:      { bsonType: "string", maxLength: 10 },
            complemento: { bsonType: ["string", "null"], maxLength: 60 },
            bairro:      { bsonType: "string", maxLength: 60 },
            cidade:      { bsonType: "string", maxLength: 60 },
            uf:          { bsonType: "string", minLength: 2, maxLength: 2 },
            cep:         { bsonType: "string", pattern: "^[0-9]{8}$" }
          }
        }
      }
    }
  },
  validationLevel: "strict",
  validationAction: "error"
});

db.tutores.createIndex({ cpf_hash: 1 }, { name: "uk_tutor_cpf", unique: true });
db.tutores.createIndex(
  { email: 1 },
  { name: "uk_tutor_email", unique: true, partialFilterExpression: { email: { $type: "string" } } }
);
db.tutores.createIndex({ nome: 1 }, { name: "ix_tutor_nome" });

// ---------------------------------------------------------------------
// 3. Coleção: pets (RF-02, RF-08, RN-01, RN-04)
// Chave composta única (tutor_id, nome). Embute 'tutor_resumo' e o array
// limitado 'vacinas_aplicadas' (histórico vacinal do pet).
// ---------------------------------------------------------------------
db.createCollection("pets", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["tutor_id", "nome", "especie", "sexo", "tutor_resumo", "vacinas_aplicadas"],
      properties: {
        tutor_id:        { bsonType: "objectId", description: "RN-01: todo pet possui tutor obrigatório" },
        nome:            { bsonType: "string", minLength: 1, maxLength: 60 },
        especie:         { bsonType: "string", maxLength: 30 },
        raca:            { bsonType: ["string", "null"], maxLength: 60 },
        sexo:            { enum: ["M", "F"] },
        data_nascimento: { bsonType: ["date", "null"] },
        peso_kg:         { bsonType: ["double", "int", "decimal", "null"], exclusiveMinimum: 0 },
        tutor_resumo: {
          bsonType: "object",
          required: ["nome", "telefone"],
          properties: {
            nome:     { bsonType: "string" },
            telefone: { bsonType: "string" }
          }
        },
        vacinas_aplicadas: {
          bsonType: "array",
          items: {
            bsonType: "object",
            required: ["tipo_vacina_id", "nome_vacina", "numero_dose", "data_aplicacao", "consulta_id"],
            properties: {
              tipo_vacina_id: { bsonType: "objectId" },
              nome_vacina:    { bsonType: "string" },
              numero_dose:    { bsonType: "int", minimum: 1 },
              data_aplicacao: { bsonType: "date" },
              proxima_dose:   { bsonType: ["date", "null"] },
              lote:           { bsonType: ["string", "null"], maxLength: 30 },
              consulta_id:    { bsonType: "objectId" }
            }
          }
        }
      }
    }
  },
  validationLevel: "strict",
  validationAction: "error"
});

// Chave composta única: um mesmo tutor não pode ter dois pets com o mesmo nome
db.pets.createIndex({ tutor_id: 1, nome: 1 }, { name: "uk_pet_tutor_nome", unique: true });
// Índice Multikey sobre o array de subdocumentos para busca de doses pendentes (RF-08)
db.pets.createIndex({ "vacinas_aplicadas.proxima_dose": 1 }, { name: "ix_pet_vacinas_proxima" });

// ---------------------------------------------------------------------
// 4. Coleções de Catálogo: servicos e tipos_vacina (RN-04)
// ---------------------------------------------------------------------
db.createCollection("servicos", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["nome", "preco", "ativo"],
      properties: {
        nome:  { bsonType: "string", maxLength: 80 },
        preco: { bsonType: ["double", "int", "decimal"], minimum: 0 },
        ativo: { bsonType: "bool" }
      }
    }
  },
  validationLevel: "strict",
  validationAction: "error"
});

db.servicos.createIndex({ nome: 1 }, { name: "uk_servico_nome", unique: true });

db.createCollection("tipos_vacina", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["nome", "intervalo_minimo_dias", "total_doses"],
      properties: {
        nome:                  { bsonType: "string", maxLength: 60 },
        intervalo_minimo_dias: { bsonType: "int", minimum: 1, description: "RN-04: intervalo mínimo em dias" },
        total_doses:           { bsonType: "int", minimum: 1 }
      }
    }
  },
  validationLevel: "strict",
  validationAction: "error"
});

db.tipos_vacina.createIndex({ nome: 1 }, { name: "uk_tipo_vacina_nome", unique: true });

// ---------------------------------------------------------------------
// 5. Coleção: consultas (RF-03, RF-04, RF-05, RF-07, RN-02, RN-03, RN-07)
// Agregado de atendimento: unifica a consulta, os itens de serviço
// realizados, o prontuário clínico (0..1) e o recibo financeiro (0..1).
// Valida RN-02 (horário comercial seg-sáb 8h-19h) e RN-07 (desconto PIX 5%).
// ---------------------------------------------------------------------
db.createCollection("consultas", {
  validator: {
    $and: [
      {
        $jsonSchema: {
          bsonType: "object",
          required: ["pet_id", "veterinario_id", "data_hora", "tipo", "status", "resumo_atendimento", "itens_servico"],
          properties: {
            pet_id:         { bsonType: "objectId" },
            veterinario_id: { bsonType: "objectId" },
            data_hora:      { bsonType: "date" },
            tipo:           { enum: ["ROTINA", "RETORNO", "VACINACAO", "EMERGENCIA"] },
            status:         { enum: ["AGENDADA", "REALIZADA", "CANCELADA", "NO_SHOW", "PAGA"] },
            resumo_atendimento: {
              bsonType: "object",
              required: ["pet_nome", "tutor_nome", "veterinario_nome"],
              properties: {
                pet_nome:         { bsonType: "string" },
                tutor_nome:       { bsonType: "string" },
                veterinario_nome: { bsonType: "string" }
              }
            },
            itens_servico: {
              bsonType: "array",
              items: {
                bsonType: "object",
                required: ["servico_id", "nome", "quantidade", "valor_unitario"],
                properties: {
                  servico_id:     { bsonType: "objectId" },
                  nome:           { bsonType: "string" },
                  quantidade:     { bsonType: "int", minimum: 1 },
                  valor_unitario: { bsonType: ["double", "int", "decimal"], minimum: 0 }
                }
              }
            },
            prontuario: {
              bsonType: ["object", "null"],
              required: ["anamnese", "diagnostico", "data_registro"],
              properties: {
                anamnese:      { bsonType: "string" },
                exame_fisico:  { bsonType: ["string", "null"] },
                diagnostico:   { bsonType: "string" },
                prescricao:    { bsonType: ["string", "null"] },
                data_registro: { bsonType: "date" }
              }
            },
            recibo: {
              bsonType: ["object", "null"],
              required: ["numero", "emitido_por", "subtotal", "forma_pagamento", "desconto", "total", "data_emissao"],
              properties: {
                numero:          { bsonType: "string", maxLength: 20 },
                emitido_por:     { bsonType: "objectId" },
                subtotal:        { bsonType: ["double", "int", "decimal"], minimum: 0 },
                forma_pagamento: { enum: ["DINHEIRO", "CARTAO", "PIX"] },
                desconto:        { bsonType: ["double", "int", "decimal"], minimum: 0 },
                total:           { bsonType: ["double", "int", "decimal"], minimum: 0 },
                data_emissao:    { bsonType: "date" }
              }
            }
          }
        }
      },
      {
        // RN-02: Horário de funcionamento (segunda a sábado, 8h às 19h UTC)
        $expr: {
          $and: [
            { $ne: [{ $dayOfWeek: "$data_hora" }, 1] },
            { $gte: [{ $hour: "$data_hora" }, 8] },
            { $lt: [{ $hour: "$data_hora" }, 19] }
          ]
        }
      },
      {
        // RN-07: Se houver recibo emitido, valida total = subtotal - desconto e PIX = 5%
        $expr: {
          $cond: {
            if: { $eq: [{ $ifNull: ["$recibo", null] }, null] },
            then: true,
            else: {
              $and: [
                { $eq: ["$recibo.total", { $subtract: ["$recibo.subtotal", "$recibo.desconto"] }] },
                {
                  $cond: {
                    if: { $eq: ["$recibo.forma_pagamento", "PIX"] },
                    then: { $eq: ["$recibo.desconto", { $round: [{ $multiply: ["$recibo.subtotal", 0.05] }, 2] }] },
                    else: { $eq: ["$recibo.desconto", 0] }
                  }
                }
              ]
            }
          }
        }
      }
    ]
  },
  validationLevel: "strict",
  validationAction: "error"
});

// Chave composta única parcial: impede conflito de horário do mesmo veterinário
// apenas para consultas ativas (AGENDADA, REALIZADA, PAGA), liberando o slot em CANCELADA/NO_SHOW
db.consultas.createIndex(
  { veterinario_id: 1, data_hora: 1 },
  {
    name: "uk_consulta_vet_horario_ativo",
    unique: true,
    partialFilterExpression: { status: { $in: ["AGENDADA", "REALIZADA", "PAGA"] } }
  }
);

// Índice único parcial para o número do recibo embutido
db.consultas.createIndex(
  { "recibo.numero": 1 },
  {
    name: "uk_recibo_numero",
    unique: true,
    partialFilterExpression: { "recibo.numero": { $type: "string" } }
  }
);

// Índice composto para histórico clínico do pet em ordem cronológica (UC-03 / RF-05)
db.consultas.createIndex({ pet_id: 1, data_hora: -1 }, { name: "ix_consulta_pet_data" });
// Índice secundário por data para listagem da agenda e faturamento
db.consultas.createIndex({ data_hora: 1 }, { name: "ix_consulta_data" });

// ---------------------------------------------------------------------
// 6. Coleção: produtos (RF-06, RN-05, RN-06)
// Embute os dados do fornecedor habitual no subdocumento 'fornecedor'.
// ---------------------------------------------------------------------
db.createCollection("produtos", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["nome", "categoria", "controlado", "quantidade", "quantidade_minima", "preco_unitario"],
      properties: {
        nome:              { bsonType: "string", maxLength: 80 },
        categoria:         { bsonType: "string", maxLength: 40 },
        controlado:        { bsonType: "bool", description: "RN-05: exige prescrição para saída" },
        quantidade:        { bsonType: "int", minimum: 0 },
        quantidade_minima: { bsonType: "int", minimum: 0, description: "RN-06: estoque mínimo" },
        preco_unitario:    { bsonType: ["double", "int", "decimal"], minimum: 0 },
        fornecedor: {
          bsonType: ["object", "null"],
          required: ["cnpj", "razao_social"],
          properties: {
            cnpj:         { bsonType: "string", pattern: "^[0-9]{14}$" },
            razao_social: { bsonType: "string", maxLength: 120 },
            telefone:     { bsonType: ["string", "null"] },
            email:        { bsonType: ["string", "null"] }
          }
        }
      }
    }
  },
  validationLevel: "strict",
  validationAction: "error"
});

db.produtos.createIndex({ nome: 1 }, { name: "uk_produto_nome", unique: true });

// ---------------------------------------------------------------------
// 7. Coleção: movimentacoes_estoque (RF-06, RN-05)
// Coleção separada (crescimento contínuo / unbounded array).
// Restrição condicional: fornecedor_cnpj restrito a ENTRADA;
// consulta_id (prescrição) restrito a SAIDA e obrigatório se controlado.
// ---------------------------------------------------------------------
db.createCollection("movimentacoes_estoque", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["produto_id", "usuario_id", "tipo", "quantidade", "motivo", "data_movimentacao", "produto_controlado"],
      properties: {
        produto_id:         { bsonType: "objectId" },
        usuario_id:         { bsonType: "objectId" },
        tipo:               { enum: ["ENTRADA", "SAIDA"] },
        quantidade:         { bsonType: "int", minimum: 1 },
        motivo:             { bsonType: "string", maxLength: 60 },
        data_movimentacao:  { bsonType: "date" },
        produto_controlado: { bsonType: "bool" },
        fornecedor_cnpj:    { bsonType: ["string", "null"], pattern: "^[0-9]{14}$" },
        consulta_id:        { bsonType: ["objectId", "null"], description: "Prescrição que autoriza saída (RN-05)" }
      },
      oneOf: [
        {
          // ENTRADA: aceita fornecedor_cnpj, mas não consulta_id
          properties: { tipo: { enum: ["ENTRADA"] }, consulta_id: { bsonType: "null" } }
        },
        {
          // SAIDA de produto NÃO controlado: fornecedor_cnpj nulo
          properties: {
            tipo: { enum: ["SAIDA"] },
            produto_controlado: { enum: [false] },
            fornecedor_cnpj: { bsonType: "null" }
          }
        },
        {
          // RN-05 — SAIDA de produto CONTROLADO: exige consulta_id (ObjectId da prescrição)
          properties: {
            tipo: { enum: ["SAIDA"] },
            produto_controlado: { enum: [true] },
            fornecedor_cnpj: { bsonType: "null" },
            consulta_id: { bsonType: "objectId" }
          },
          required: ["consulta_id"]
        }
      ]
    }
  },
  validationLevel: "strict",
  validationAction: "error"
});

// Índice composto para extrato de movimentações por produto e data
db.movimentacoes_estoque.createIndex(
  { produto_id: 1, data_movimentacao: -1 },
  { name: "ix_mov_produto_data" }
);

// ---------------------------------------------------------------------
// 8. View: vw_produtos_estoque_baixo (RN-06)
// Pipeline de agregação equivalente à VIEW relacional para alerta de estoque
// ---------------------------------------------------------------------
db.createView("vw_produtos_estoque_baixo", "produtos", [
  { $match: { $expr: { $lte: ["$quantidade", "$quantidade_minima"] } } },
  { $project: { _id: 1, nome: 1, categoria: 1, quantidade: 1, quantidade_minima: 1 } }
]);

print("Esquema físico MongoDB (clinica_vida_animal) criado com sucesso.");
```

---

### 12.5. Carga Inicial do Banco de Dados Não Relacional (`carga_inicial_mongodb.js`)

A carga inicial insere documentos equivalentes aos do banco relacional (Seção 11.4): **4 usuários** (um administrador, uma recepcionista e dois veterinários com CRMV), **3 tutores** (com subdocumento `endereco`, `cpf_hash` e `cpf_cifrado`), **4 pets** (com `tutor_resumo` e array `vacinas_aplicadas`), **5 serviços**, **3 tipos de vacina**, **5 produtos** (com subdocumento `fornecedor` embutido), **6 consultas** nos estados `PAGA`, `AGENDADA`, `CANCELADA` e `NO_SHOW` (contendo `itens_servico`, `prontuario` e `recibo` embutidos) e **7 movimentações de estoque** (5 entradas e 2 saídas, atualizando `produtos.quantidade` atomicamente com o operador `$inc`).

```javascript
// =====================================================================
// Clínica Veterinária "Vida Animal" — Carga Inicial Não Relacional (Fase C-6)
// Pré-requisito: schema_fisico_mongodb.js já executado.
// Execução:      mongosh < fase_c/carga_inicial_mongodb.js
// =====================================================================

db = db.getSiblingDB("clinica_vida_animal");

// Identificadores ObjectId determinísticos para rastreabilidade entre coleções
const ids = {
  usuarios: {
    admin:    ObjectId("670a00000000000000000001"),
    recep1:   ObjectId("670a00000000000000000002"),
    vetPedro: ObjectId("670a00000000000000000003"),
    vetAna:   ObjectId("670a00000000000000000004")
  },
  tutores: {
    marcos:   ObjectId("670a01000000000000000101"),
    juliana:  ObjectId("670a01000000000000000102"),
    roberto:  ObjectId("670a01000000000000000103")
  },
  pets: {
    thor:     ObjectId("670a02000000000000000201"),
    luna:     ObjectId("670a02000000000000000202"),
    bidu:     ObjectId("670a02000000000000000203"),
    mel:      ObjectId("670a02000000000000000204")
  },
  servicos: {
    rotina:     ObjectId("670a03000000000000000301"),
    vacina:     ObjectId("670a03000000000000000302"),
    retorno:    ObjectId("670a03000000000000000303"),
    emergencia: ObjectId("670a03000000000000000304"),
    exame:      ObjectId("670a03000000000000000305")
  },
  tiposVacina: {
    v10:         ObjectId("670a04000000000000000401"),
    antirrabica: ObjectId("670a04000000000000000402"),
    v3:          ObjectId("670a04000000000000000403")
  },
  produtos: {
    vacinaV10:    ObjectId("670a05000000000000000501"),
    vacinaRaiva:  ObjectId("670a05000000000000000502"),
    dipirona:     ObjectId("670a05000000000000000503"),
    tramadol:     ObjectId("670a05000000000000000504"),
    seringa:      ObjectId("670a05000000000000000505")
  },
  consultas: {
    c1: ObjectId("670a06000000000000000601"),
    c2: ObjectId("670a06000000000000000602"),
    c3: ObjectId("670a06000000000000000603"),
    c4: ObjectId("670a06000000000000000604"),
    c5: ObjectId("670a06000000000000000605"),
    c6: ObjectId("670a06000000000000000606")
  }
};

// ---------------------------------------------------------------------
// 1. Usuários (RF-09, RNF-05)
// ---------------------------------------------------------------------
db.usuarios.insertMany([
  {
    _id: ids.usuarios.admin,
    login: "admin",
    nome: "Rayanne Souza",
    email: "admin@vidaanimal.com",
    senha_hash: "$2b$10$abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0",
    perfil: "ADMINISTRADOR",
    crmv: null,
    ativo: true
  },
  {
    _id: ids.usuarios.recep1,
    login: "recep1",
    nome: "Carla Menezes",
    email: "carla@vidaanimal.com",
    senha_hash: "$2b$10$abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1",
    perfil: "RECEPCIONISTA",
    crmv: null,
    ativo: true
  },
  {
    _id: ids.usuarios.vetPedro,
    login: "vet.pedro",
    nome: "Pedro Chapetta",
    email: "pedro@vidaanimal.com",
    senha_hash: "$2b$10$abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ2",
    perfil: "VETERINARIO",
    crmv: "CRMV-RJ 12345",
    ativo: true
  },
  {
    _id: ids.usuarios.vetAna,
    login: "vet.ana",
    nome: "Ana Beatriz Lima",
    email: "ana@vidaanimal.com",
    senha_hash: "$2b$10$abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ3",
    perfil: "VETERINARIO",
    crmv: "CRMV-RJ 23456",
    ativo: true
  }
]);

// ---------------------------------------------------------------------
// 2. Tutores com subdocumento 'endereco' embutido (RF-01, RN-08)
// ---------------------------------------------------------------------
db.tutores.insertMany([
  {
    _id: ids.tutores.marcos,
    cpf_hash: "8f3a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789e91b",
    cpf_cifrado: BinData(0, "U2FsdGVkX19tYXJjb3Nfb2xpdmVpcmFfY3BmX2FlczI1Ng=="),
    nome: "Marcos Oliveira",
    telefone: "21988880001",
    email: "marcos@email.com",
    data_cadastro: new Date("2026-10-01T08:00:00Z"),
    endereco: {
      logradouro: "Rua das Flores",
      numero: "100",
      complemento: null,
      bairro: "Centro",
      cidade: "Rio de Janeiro",
      uf: "RJ",
      cep: "20000000"
    }
  },
  {
    _id: ids.tutores.juliana,
    cpf_hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852c442",
    cpf_cifrado: BinData(0, "U2FsdGVkX19qdWxpYW5hX3BpcmVzX2NwZl9hZXMyNTY="),
    nome: "Juliana Pires",
    telefone: "21988880002",
    email: "juliana@email.com",
    data_cadastro: new Date("2026-10-01T08:10:00Z"),
    endereco: {
      logradouro: "Av. Brasil",
      numero: "2500",
      complemento: "Bloco 2",
      bairro: "Penha",
      cidade: "Rio de Janeiro",
      uf: "RJ",
      cep: "21000000"
    }
  },
  {
    _id: ids.tutores.roberto,
    cpf_hash: "4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a",
    cpf_cifrado: BinData(0, "U2FsdGVkX19yb2JlcnRvX2Nhc3Ryb19jcGZFYWVzMjU2"),
    nome: "Roberto Castro",
    telefone: "21988880003",
    email: null,
    data_cadastro: new Date("2026-10-01T08:20:00Z"),
    endereco: {
      logradouro: "Rua Verde",
      numero: "45",
      complemento: null,
      bairro: "Tijuca",
      cidade: "Rio de Janeiro",
      uf: "RJ",
      cep: "20500000"
    }
  }
]);

// ---------------------------------------------------------------------
// 3. Catálogo de Serviços e Tipos de Vacina (RN-04)
// ---------------------------------------------------------------------
db.servicos.insertMany([
  { _id: ids.servicos.rotina,     nome: "Consulta de rotina",        preco: 120.00, ativo: true },
  { _id: ids.servicos.vacina,     nome: "Aplicação de vacina",       preco:  80.00, ativo: true },
  { _id: ids.servicos.retorno,    nome: "Consulta de retorno",       preco:  60.00, ativo: true },
  { _id: ids.servicos.emergencia, nome: "Atendimento de emergência", preco: 250.00, ativo: true },
  { _id: ids.servicos.exame,      nome: "Exame de sangue",           preco: 150.00, ativo: true }
]);

db.tipos_vacina.insertMany([
  { _id: ids.tiposVacina.v10,         nome: "V10 (polivalente canina)", intervalo_minimo_dias:  21, total_doses: 3 },
  { _id: ids.tiposVacina.antirrabica, nome: "Antirrábica",              intervalo_minimo_dias: 365, total_doses: 1 },
  { _id: ids.tiposVacina.v3,          nome: "Tríplice felina (V3)",     intervalo_minimo_dias:  21, total_doses: 3 }
]);

// ---------------------------------------------------------------------
// 4. Pets com 'tutor_resumo' e array 'vacinas_aplicadas' embutidos (RF-02, RF-08, RN-01)
// ---------------------------------------------------------------------
db.pets.insertMany([
  {
    _id: ids.pets.thor,
    tutor_id: ids.tutores.marcos,
    nome: "Thor",
    especie: "Cão",
    raca: "Labrador",
    sexo: "M",
    data_nascimento: new Date("2020-03-10T00:00:00Z"),
    peso_kg: 30.50,
    tutor_resumo: { nome: "Marcos Oliveira", telefone: "21988880001" },
    vacinas_aplicadas: []
  },
  {
    _id: ids.pets.luna,
    tutor_id: ids.tutores.marcos,
    nome: "Luna",
    especie: "Gato",
    raca: "Siamês",
    sexo: "F",
    data_nascimento: new Date("2022-07-21T00:00:00Z"),
    peso_kg: 4.20,
    tutor_resumo: { nome: "Marcos Oliveira", telefone: "21988880001" },
    vacinas_aplicadas: [
      {
        tipo_vacina_id: ids.tiposVacina.v3,
        nome_vacina: "Tríplice felina (V3)",
        numero_dose: 1,
        data_aplicacao: new Date("2026-10-05T10:00:00Z"),
        proxima_dose: new Date("2026-10-26T00:00:00Z"),
        lote: "LT-V3-2026A",
        consulta_id: ids.consultas.c2
      }
    ]
  },
  {
    _id: ids.pets.bidu,
    tutor_id: ids.tutores.juliana,
    nome: "Bidu",
    especie: "Cão",
    raca: "Vira-lata",
    sexo: "M",
    data_nascimento: new Date("2018-11-02T00:00:00Z"),
    peso_kg: 12.80,
    tutor_resumo: { nome: "Juliana Pires", telefone: "21988880002" },
    vacinas_aplicadas: [
      {
        tipo_vacina_id: ids.tiposVacina.antirrabica,
        nome_vacina: "Antirrábica",
        numero_dose: 1,
        data_aplicacao: new Date("2026-06-10T10:00:00Z"),
        proxima_dose: new Date("2027-06-10T00:00:00Z"),
        lote: "LT-AR-2026B",
        consulta_id: ids.consultas.c3
      }
    ]
  },
  {
    _id: ids.pets.mel,
    tutor_id: ids.tutores.roberto,
    nome: "Mel",
    especie: "Cão",
    raca: "Poodle",
    sexo: "F",
    data_nascimento: new Date("2023-01-15T00:00:00Z"),
    peso_kg: 5.10,
    tutor_resumo: { nome: "Roberto Castro", telefone: "21988880003" },
    vacinas_aplicadas: []
  }
]);

// ---------------------------------------------------------------------
// 5. Produtos com 'fornecedor' embutido (RF-06, RN-05, RN-06)
// Saldo nasce em 0 e é atualizado pelas movimentações de estoque ($inc)
// ---------------------------------------------------------------------
const fornVetDist = {
  cnpj: "11222333000181",
  razao_social: "VetDistribuidora Ltda",
  telefone: "2133330001",
  email: "vendas@vetdist.com"
};
const fornFarmaPet = {
  cnpj: "44555666000172",
  razao_social: "FarmaPet Comércio S.A.",
  telefone: "2133330002",
  email: "contato@farmapet.com"
};

db.produtos.insertMany([
  { _id: ids.produtos.vacinaV10,   nome: "Vacina V10",              categoria: "Vacina",      controlado: false, quantidade: 0, quantidade_minima: 10, preco_unitario: 45.00, fornecedor: fornVetDist },
  { _id: ids.produtos.vacinaRaiva, nome: "Vacina Antirrábica",      categoria: "Vacina",      controlado: false, quantidade: 0, quantidade_minima: 10, preco_unitario: 30.00, fornecedor: fornVetDist },
  { _id: ids.produtos.dipirona,    nome: "Dipirona veterinária",    categoria: "Medicamento", controlado: false, quantidade: 0, quantidade_minima: 15, preco_unitario: 12.50, fornecedor: fornFarmaPet },
  { _id: ids.produtos.tramadol,    nome: "Tramadol 50 mg",          categoria: "Medicamento", controlado: true,  quantidade: 0, quantidade_minima:  5, preco_unitario: 28.00, fornecedor: fornFarmaPet },
  { _id: ids.produtos.seringa,     nome: "Seringa descartável 5ml", categoria: "Material",    controlado: false, quantidade: 0, quantidade_minima: 50, preco_unitario:  1.20, fornecedor: fornVetDist }
]);

// ---------------------------------------------------------------------
// 6. Consultas com 'itens_servico', 'prontuario' e 'recibo' embutidos
// Exercita RN-02 (seg-sáb 8h-19h), RN-03 (NO_SHOW) e RN-07 (PIX = 5%)
// ---------------------------------------------------------------------
db.consultas.insertMany([
  {
    _id: ids.consultas.c1,
    pet_id: ids.pets.thor,
    veterinario_id: ids.usuarios.vetPedro,
    data_hora: new Date("2026-10-05T09:00:00Z"),
    tipo: "ROTINA",
    status: "PAGA",
    resumo_atendimento: { pet_nome: "Thor", tutor_nome: "Marcos Oliveira", veterinario_nome: "Pedro Chapetta" },
    itens_servico: [
      { servico_id: ids.servicos.rotina, nome: "Consulta de rotina", quantidade: 1, valor_unitario: 120.00 }
    ],
    prontuario: {
      anamnese: "Tutor relata apetite normal; check-up anual.",
      exame_fisico: "Sem alterações.",
      diagnostico: "Animal saudável.",
      prescricao: null,
      data_registro: new Date("2026-10-05T09:30:00Z")
    },
    recibo: {
      numero: "2026-000001",
      emitido_por: ids.usuarios.recep1,
      subtotal: 120.00,
      forma_pagamento: "PIX",
      desconto: 6.00,
      total: 114.00,
      data_emissao: new Date("2026-10-05T09:40:00Z")
    }
  },
  {
    _id: ids.consultas.c2,
    pet_id: ids.pets.luna,
    veterinario_id: ids.usuarios.vetAna,
    data_hora: new Date("2026-10-05T10:00:00Z"),
    tipo: "VACINACAO",
    status: "PAGA",
    resumo_atendimento: { pet_nome: "Luna", tutor_nome: "Marcos Oliveira", veterinario_nome: "Ana Beatriz Lima" },
    itens_servico: [
      { servico_id: ids.servicos.vacina, nome: "Aplicação de vacina", quantidade: 1, valor_unitario: 80.00 }
    ],
    prontuario: null,
    recibo: {
      numero: "2026-000002",
      emitido_por: ids.usuarios.recep1,
      subtotal: 80.00,
      forma_pagamento: "CARTAO",
      desconto: 0.00,
      total: 80.00,
      data_emissao: new Date("2026-10-05T10:30:00Z")
    }
  },
  {
    _id: ids.consultas.c3,
    pet_id: ids.pets.bidu,
    veterinario_id: ids.usuarios.vetPedro,
    data_hora: new Date("2026-10-06T14:00:00Z"),
    tipo: "EMERGENCIA",
    status: "PAGA",
    resumo_atendimento: { pet_nome: "Bidu", tutor_nome: "Juliana Pires", veterinario_nome: "Pedro Chapetta" },
    itens_servico: [
      { servico_id: ids.servicos.emergencia, nome: "Atendimento de emergência", quantidade: 1, valor_unitario: 250.00 },
      { servico_id: ids.servicos.exame,      nome: "Exame de sangue",           quantidade: 1, valor_unitario: 150.00 }
    ],
    prontuario: {
      anamnese: "Dor intensa e claudicação após queda.",
      exame_fisico: "Dor à palpação do membro posterior direito.",
      diagnostico: "Contusão com suspeita de lesão ligamentar.",
      prescricao: "Tramadol 50 mg, 1 comprimido a cada 12h por 5 dias.",
      data_registro: new Date("2026-10-06T14:45:00Z")
    },
    recibo: {
      numero: "2026-000003",
      emitido_por: ids.usuarios.recep1,
      subtotal: 400.00,
      forma_pagamento: "PIX",
      desconto: 20.00,
      total: 380.00,
      data_emissao: new Date("2026-10-06T14:55:00Z")
    }
  },
  {
    _id: ids.consultas.c4,
    pet_id: ids.pets.thor,
    veterinario_id: ids.usuarios.vetPedro,
    data_hora: new Date("2026-10-14T09:00:00Z"),
    tipo: "RETORNO",
    status: "AGENDADA",
    resumo_atendimento: { pet_nome: "Thor", tutor_nome: "Marcos Oliveira", veterinario_nome: "Pedro Chapetta" },
    itens_servico: [],
    prontuario: null,
    recibo: null
  },
  {
    _id: ids.consultas.c5,
    pet_id: ids.pets.mel,
    veterinario_id: ids.usuarios.vetAna,
    data_hora: new Date("2026-10-08T15:00:00Z"),
    tipo: "ROTINA",
    status: "CANCELADA",
    resumo_atendimento: { pet_nome: "Mel", tutor_nome: "Roberto Castro", veterinario_nome: "Ana Beatriz Lima" },
    itens_servico: [],
    prontuario: null,
    recibo: null
  },
  {
    _id: ids.consultas.c6,
    pet_id: ids.pets.mel,
    veterinario_id: ids.usuarios.vetAna,
    data_hora: new Date("2026-10-09T16:00:00Z"),
    tipo: "ROTINA",
    status: "NO_SHOW",
    resumo_atendimento: { pet_nome: "Mel", tutor_nome: "Roberto Castro", veterinario_nome: "Ana Beatriz Lima" },
    itens_servico: [],
    prontuario: null,
    recibo: null
  }
]);

// ---------------------------------------------------------------------
// 7. Movimentações de Estoque e Atualização Atômica de Saldo (RF-06, RN-05)
// Função auxiliar que registra a movimentação e atualiza o saldo ($inc)
// ---------------------------------------------------------------------
function registrarMovimentacao(doc) {
  const prod = db.produtos.findOne({ _id: doc.produto_id });
  if (doc.tipo === "SAIDA" && prod.quantidade < doc.quantidade) {
    throw new Error("Saldo insuficiente em estoque para o produto: " + prod.nome);
  }
  db.movimentacoes_estoque.insertOne(doc);
  const delta = doc.tipo === "ENTRADA" ? doc.quantidade : -doc.quantidade;
  db.produtos.updateOne({ _id: doc.produto_id }, { $inc: { quantidade: delta } });
}

// Entradas iniciais de estoque
registrarMovimentacao({ _id: ObjectId("670a07000000000000000701"), produto_id: ids.produtos.vacinaV10,   usuario_id: ids.usuarios.admin, tipo: "ENTRADA", quantidade:  30, motivo: "Compra inicial", data_movimentacao: new Date("2026-10-01T08:30:00Z"), produto_controlado: false, fornecedor_cnpj: "11222333000181", consulta_id: null });
registrarMovimentacao({ _id: ObjectId("670a07000000000000000702"), produto_id: ids.produtos.vacinaRaiva, usuario_id: ids.usuarios.admin, tipo: "ENTRADA", quantidade:  20, motivo: "Compra inicial", data_movimentacao: new Date("2026-10-01T08:30:00Z"), produto_controlado: false, fornecedor_cnpj: "11222333000181", consulta_id: null });
registrarMovimentacao({ _id: ObjectId("670a07000000000000000703"), produto_id: ids.produtos.dipirona,    usuario_id: ids.usuarios.admin, tipo: "ENTRADA", quantidade:  40, motivo: "Compra inicial", data_movimentacao: new Date("2026-10-01T08:35:00Z"), produto_controlado: false, fornecedor_cnpj: "44555666000172", consulta_id: null });
registrarMovimentacao({ _id: ObjectId("670a07000000000000000704"), produto_id: ids.produtos.tramadol,    usuario_id: ids.usuarios.admin, tipo: "ENTRADA", quantidade:   8, motivo: "Compra inicial", data_movimentacao: new Date("2026-10-01T08:35:00Z"), produto_controlado: true,  fornecedor_cnpj: "44555666000172", consulta_id: null });
registrarMovimentacao({ _id: ObjectId("670a07000000000000000705"), produto_id: ids.produtos.seringa,     usuario_id: ids.usuarios.admin, tipo: "ENTRADA", quantidade: 100, motivo: "Compra inicial", data_movimentacao: new Date("2026-10-01T08:40:00Z"), produto_controlado: false, fornecedor_cnpj: "11222333000181", consulta_id: null });

// Saídas de estoque (incluindo saída de medicamento controlado vinculada à Consulta #3 — RN-05)
registrarMovimentacao({ _id: ObjectId("670a07000000000000000706"), produto_id: ids.produtos.seringa,  usuario_id: ids.usuarios.vetAna,   tipo: "SAIDA", quantidade: 1, motivo: "Uso em vacinação",          data_movimentacao: new Date("2026-10-05T10:05:00Z"), produto_controlado: false, fornecedor_cnpj: null, consulta_id: null });
registrarMovimentacao({ _id: ObjectId("670a07000000000000000707"), produto_id: ids.produtos.tramadol, usuario_id: ids.usuarios.vetPedro, tipo: "SAIDA", quantidade: 5, motivo: "Dispensa prescrita (RN-05)", data_movimentacao: new Date("2026-10-06T15:00:00Z"), produto_controlado: true,  fornecedor_cnpj: null, consulta_id: ids.consultas.c3 });

// Conferência rápida (RN-06): deve listar 'Tramadol 50 mg' (quantidade: 3 <= quantidade_minima: 5)
print("Produtos com estoque baixo (RN-06):");
printjson(db.vw_produtos_estoque_baixo.find().toArray());
```

---

### 12.6. Validação do Esquema e da Carga Inicial Não Relacional

As restrições declarativas (`$jsonSchema`, `oneOf` e `$expr`) e os índices únicos/compostos/parciais garantem diretamente no SGBD MongoDB a rejeição de operações que violem as regras de negócio do domínio:

| Teste de violação | Resultado no MongoDB | Mecanismo físico acionado |
|---|---|---|
| Pet inserido sem `tutor_id` (RN-01) | `Document failed validation` (`MongoServerError: Code 121`) | `required: ["tutor_id"]` + `bsonType: "objectId"` em `pets` |
| Consulta agendada em domingo ou fora de 8h–19h (RN-02) | `Document failed validation` (`MongoServerError: Code 121`) | Expressão `$expr` (`$dayOfWeek` e `$hour`) em `consultas` |
| Duas consultas ativas do mesmo veterinário no mesmo horário (RN-02) | `E11000 duplicate key error collection: clinica_vida_animal.consultas` | Índice composto único parcial `uk_consulta_vet_horario_ativo` |
| Dois pets com mesmo nome para o mesmo tutor | `E11000 duplicate key error collection: clinica_vida_animal.pets` | Chave composta única `uk_pet_tutor_nome` (`{ tutor_id: 1, nome: 1 }`) |
| Saída de produto controlado sem `consulta_id` da prescrição (RN-05) | `Document failed validation` (`MongoServerError: Code 121`) | Cláusula `oneOf` em `movimentacoes_estoque` |
| Recibo PIX com desconto diferente de 5% (RN-07) | `Document failed validation` (`MongoServerError: Code 121`) | Expressão `$expr` sobre `recibo.forma_pagamento`, `desconto` e `total` |
| Veterinário sem CRMV ou Recepcionista com CRMV (RF-09) | `Document failed validation` (`MongoServerError: Code 121`) | Cláusula `oneOf` em `usuarios` |

Após a execução da carga inicial, `db.vw_produtos_estoque_baixo.find()` retorna o documento do produto *Tramadol 50 mg* (`quantidade: 3`, `quantidade_minima: 5`), comprovando o funcionamento do alerta de estoque mínimo (RN-06).
