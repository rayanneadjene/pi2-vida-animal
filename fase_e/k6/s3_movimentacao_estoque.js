// Serviço 3 - Registrar movimentação de estoque (INSERÇÃO + ATUALIZAÇÃO)
// POST /api/estoque/movimentacoes -> INSERT movimentacao_estoque; triggers fazem
// SELECT ... FOR UPDATE e UPDATE produto.quantidade; depois lê vw_produtos_estoque_baixo.
//
// MODO=quente  -> todas as requisições no mesmo produto (ex.: seringa, usada em todo atendimento)
// MODO=espalhado -> produto sorteado entre os 54 não controlados (menos disputa de lock)
import http from 'k6/http';
import { check } from 'k6';
import { BASE_URL, opcoesBase } from './comum.js';

export const options = opcoesBase;

const MODO = __ENV.MODO || 'quente';
// não controlados: 1, 2, 3, 5 (carga inicial) e 6..55 (massa de dados)
const PRODUTOS = [1, 2, 3, 5, ...Array.from({ length: 50 }, (_, i) => i + 6)];

export default function () {
  const produto = MODO === 'quente' ? 5 : PRODUTOS[Math.floor(Math.random() * PRODUTOS.length)];
  const entrada = Math.random() < 0.3;
  const body = JSON.stringify(entrada
    ? { produto_id: produto, usuario_id: 1, tipo: 'ENTRADA', quantidade: 10, motivo: 'Reposição', fornecedor_id: 1 }
    : { produto_id: produto, usuario_id: 3, tipo: 'SAIDA', quantidade: 1, motivo: 'Uso em atendimento' });
  const res = http.post(`${BASE_URL}/api/estoque/movimentacoes`, body, {
    headers: { 'Content-Type': 'application/json' },
    tags: { name: 'POST /api/estoque/movimentacoes' },
  });
  check(res, { 'status 201': (r) => r.status === 201 });
}
