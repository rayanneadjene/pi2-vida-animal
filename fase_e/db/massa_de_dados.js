// =====================================================================
// Vida Animal - Massa de dados para os testes de carga (Fase E)
// Pré-requisito: fase_c/schema_fisico.sql + fase_c/carga_inicial.sql já executados.
// Gera um volume próximo ao de ~1 ano de operação de uma clínica de médio porte:
//   20 veterinários extras, 5.000 tutores, 8.000 pets, ~45.000 consultas (2026),
//   50 produtos extras com saldo inicial. Usa PRNG com semente fixa -> reprodutível.
// =====================================================================
const mysql = require('../api/node_modules/mysql2/promise');

const N_VETS = 20;
const N_TUTORES = 5000;
const N_PETS = 8000;
const N_PRODUTOS = 50;
const OCUPACAO = 0.3;           // fração dos horários de 30 min ocupados por veterinário
const LOTE = 1000;

// PRNG determinístico (mulberry32)
let seed = 20261108;
function rand() {
  seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const pad = (n, w = 2) => String(n).padStart(w, '0');

async function inserirEmLotes(conn, sqlPrefixo, linhas, placeholder) {
  for (let i = 0; i < linhas.length; i += LOTE) {
    const lote = linhas.slice(i, i + LOTE);
    await conn.query(`${sqlPrefixo} VALUES ${lote.map(() => placeholder).join(',')}`, lote.flat());
  }
}

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'vida',
    password: process.env.DB_PASS || 'vida123',
    database: process.env.DB_NAME || 'clinica_vida_animal',
  });
  const t0 = Date.now();

  // Veterinários (ids 5..24) - senha_hash ilustrativa (formato bcrypt)
  const vets = [];
  for (let i = 1; i <= N_VETS; i++) {
    vets.push([`vet.${i}`, `Veterinário ${i}`, `vet${i}@vidaanimal.com`,
      `$2b$10$${'x'.repeat(52)}${pad(i)}`.slice(0, 60), 'VETERINARIO', `CRMV-RJ ${30000 + i}`]);
  }
  await inserirEmLotes(conn, 'INSERT INTO usuario (login, nome, email, senha_hash, perfil, crmv)', vets, '(?,?,?,?,?,?)');
  const [vetRows] = await conn.query("SELECT id FROM usuario WHERE perfil = 'VETERINARIO'");
  const vetIds = vetRows.map((r) => r.id);

  // Tutores - CPF cifrado (AES) e indexado por SHA-256 (RN-08), como na carga inicial
  const nomes = ['Ana', 'Bruno', 'Carla', 'Diego', 'Elisa', 'Fábio', 'Gabriela', 'Hugo', 'Isabela', 'João', 'Larissa', 'Marcelo'];
  const sobrenomes = ['Silva', 'Souza', 'Oliveira', 'Pereira', 'Costa', 'Almeida', 'Ferreira', 'Rodrigues', 'Lima', 'Gomes'];
  const tutores = [];
  for (let i = 1; i <= N_TUTORES; i++) {
    const cpf = String(70000000000 + i);
    tutores.push([cpf, cpf, `${pick(nomes)} ${pick(sobrenomes)} ${i}`, `2197${pad(i, 7)}`,
      `tutor${i}@email.com`, 'Rio de Janeiro', 'RJ']);
  }
  await inserirEmLotes(conn,
    'INSERT INTO tutor (cpf_hash, cpf_cifrado, nome, telefone, email, cidade, uf)', tutores,
    "(SHA2(?,256), AES_ENCRYPT(?, 'chave-demo-apenas-desenvolvimento'), ?, ?, ?, ?, ?)");
  const [[{ minT, maxT }]] = await conn.query('SELECT MIN(id) minT, MAX(id) maxT FROM tutor');

  // Pets
  const especies = [['Cão', ['Labrador', 'Poodle', 'Vira-lata', 'Shih-tzu', 'Bulldog']], ['Gato', ['Siamês', 'Persa', 'SRD']]];
  const pets = [];
  for (let i = 1; i <= N_PETS; i++) {
    const [esp, racas] = rand() < 0.65 ? especies[0] : especies[1];
    pets.push([minT + Math.floor(rand() * (maxT - minT + 1)), `Pet ${i}`, esp, pick(racas),
      rand() < 0.5 ? 'M' : 'F', `20${pad(10 + Math.floor(rand() * 15))}-${pad(1 + Math.floor(rand() * 12))}-15`,
      (2 + rand() * 35).toFixed(2)]);
  }
  await inserirEmLotes(conn, 'INSERT INTO pet (tutor_id, nome, especie, raca, sexo, data_nascimento, peso_kg)', pets, '(?,?,?,?,?,?,?)');
  const [[{ minP, maxP }]] = await conn.query('SELECT MIN(id) minP, MAX(id) maxP FROM pet');

  // Consultas de 2026 (seg-sáb, 08:00-18:30, slots de 30 min) - respeitam RN-02 e a UK de horário
  const consultas = [];
  const hoje = new Date('2026-11-08T00:00:00Z');
  for (let d = new Date('2026-01-05T00:00:00Z'); d <= new Date('2026-12-31T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1)) {
    if (d.getUTCDay() === 0) continue; // domingo
    const dia = d.toISOString().slice(0, 10);
    const passado = d < hoje;
    for (const vet of vetIds) {
      for (let slot = 0; slot < 22; slot++) {
        if (rand() >= OCUPACAO) continue;
        const hora = `${pad(8 + Math.floor(slot / 2))}:${slot % 2 ? '30' : '00'}:00`;
        const r = rand();
        const status = passado ? (r < 0.75 ? 'PAGA' : r < 0.85 ? 'REALIZADA' : r < 0.95 ? 'CANCELADA' : 'NO_SHOW')
          : (r < 0.93 ? 'AGENDADA' : 'CANCELADA');
        consultas.push([minP + Math.floor(rand() * (maxP - minP + 1)), vet, `${dia} ${hora}`,
          pick(['ROTINA', 'ROTINA', 'RETORNO', 'VACINACAO', 'EMERGENCIA']), status]);
      }
    }
  }
  // INSERT IGNORE: descarta colisões com os horários já ocupados pela carga inicial (out/2026)
  await inserirEmLotes(conn, 'INSERT IGNORE INTO consulta (pet_id, veterinario_id, data_hora, tipo, status)', consultas, '(?,?,?,?,?)');

  // Produtos extras + saldo inicial (ENTRADA) para que as SAÍDAs do teste não esgotem o estoque
  const produtos = [];
  for (let i = 1; i <= N_PRODUTOS; i++) {
    produtos.push([`Produto teste ${pad(i)}`, pick(['Medicamento', 'Material', 'Vacina', 'Higiene']), 20, (5 + rand() * 100).toFixed(2), rand() < 0.5 ? 1 : 2]);
  }
  await inserirEmLotes(conn, 'INSERT INTO produto (nome, categoria, quantidade_minima, preco_unitario, fornecedor_id)', produtos, '(?,?,?,?,?)');
  // (INSERT ... SELECT FROM produto não é permitido: o trigger atualiza a própria tabela produto)
  const [naoControlados] = await conn.query('SELECT id, fornecedor_id FROM produto WHERE controlado = FALSE');
  await inserirEmLotes(conn,
    'INSERT INTO movimentacao_estoque (produto_id, usuario_id, tipo, quantidade, motivo, fornecedor_id)',
    naoControlados.map((p) => [p.id, 1, 'ENTRADA', 1000000, 'Saldo inicial p/ teste de carga', p.fornecedor_id]),
    '(?,?,?,?,?,?)');

  const [[tot]] = await conn.query(
    `SELECT (SELECT COUNT(*) FROM usuario) usuarios, (SELECT COUNT(*) FROM tutor) tutores,
            (SELECT COUNT(*) FROM pet) pets, (SELECT COUNT(*) FROM consulta) consultas,
            (SELECT COUNT(*) FROM produto) produtos, (SELECT COUNT(*) FROM movimentacao_estoque) movimentacoes`,
  );
  console.log(`   massa gerada em ${((Date.now() - t0) / 1000).toFixed(1)}s:`, tot);
  await conn.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
