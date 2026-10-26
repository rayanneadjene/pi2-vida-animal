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
