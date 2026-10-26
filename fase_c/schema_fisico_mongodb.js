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
