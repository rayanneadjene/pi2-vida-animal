// vida-animal-api - ponto de entrada (Node.js + Express + MySQL)
const express = require('express');
const pool = require('./db');

const app = express();
app.use(express.json());

app.get('/api/health', async (_req, res) => {
  await pool.query('SELECT 1');
  res.json({ status: 'ok', pool: Number(process.env.DB_POOL || 10) });
});

app.use('/api/agenda', require('./routes/agenda'));
app.use('/api/estoque', require('./routes/estoque'));

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err.code || '', err.message);
  res.status(500).json({ erro: 'Erro interno' });
});

const port = Number(process.env.API_PORT || 3000);
app.listen(port, '127.0.0.1', () => {
  console.log(`vida-animal-api ouvindo em http://localhost:${port} (pool MySQL = ${process.env.DB_POOL || 10})`);
});
