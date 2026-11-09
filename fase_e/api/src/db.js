// Pool de conexões com o MySQL (componente "Repositórios SQL" da Fase B-4).
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'vida',
  password: process.env.DB_PASS || 'vida123',
  database: process.env.DB_NAME || 'clinica_vida_animal',
  // Tamanho do pool: uma das hipóteses de gargalo avaliadas na Fase E
  connectionLimit: Number(process.env.DB_POOL || 10),
  waitForConnections: true,
  queueLimit: 0,
  dateStrings: true,
  timezone: 'Z',
});

module.exports = pool;
