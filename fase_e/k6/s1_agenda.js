// Serviço 1 - Visualizar agenda do dia (LEITURA)
// GET /api/agenda?data=AAAA-MM-DD  -> JOIN consulta + pet + tutor + usuario
import http from 'k6/http';
import { check } from 'k6';
import { BASE_URL, opcoesBase } from './comum.js';

export const options = opcoesBase;

// Dias úteis de 2026 com agenda populada pela massa de dados
const DIAS = [];
for (let d = new Date(Date.UTC(2026, 0, 5)); d <= new Date(Date.UTC(2026, 11, 31)); d.setUTCDate(d.getUTCDate() + 1)) {
  if (d.getUTCDay() !== 0) DIAS.push(d.toISOString().slice(0, 10));
}

export default function () {
  const dia = DIAS[Math.floor(Math.random() * DIAS.length)];
  const res = http.get(`${BASE_URL}/api/agenda?data=${dia}`, { tags: { name: 'GET /api/agenda' } });
  check(res, { 'status 200': (r) => r.status === 200 });
}
