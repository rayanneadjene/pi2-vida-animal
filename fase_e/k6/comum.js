// Configuração comum dos testes de carga (k6) da Fase E.
//
// Perfil "degraus" (step load): a concorrência (VUs = usuários virtuais simultâneos,
// sem think time) sobe em patamares e cada patamar é mantido por um intervalo fixo.
// Isso permite observar, para cada nível de concorrência, a latência e a vazão,
// e identificar o limite de requisições simultâneas (ponto de saturação).
export const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

const NIVEIS = (__ENV.NIVEIS || '1,5,10,25,50,100,200,400').split(',').map(Number);
const PATAMAR = __ENV.PATAMAR || '10s';   // duração de cada degrau
const RAMPA = __ENV.RAMPA || '2s';        // transição entre degraus

export function estagios() {
  const s = [];
  for (const n of NIVEIS) {
    s.push({ duration: RAMPA, target: n });
    s.push({ duration: PATAMAR, target: n });
  }
  s.push({ duration: RAMPA, target: 0 });
  return s;
}

export const opcoesBase = {
  scenarios: {
    degraus: { executor: 'ramping-vus', startVUs: 0, stages: estagios(), gracefulRampDown: '10s' },
  },
  // SLA do projeto: RNF-02 -> operações normais em até 3 s; erros < 1%
  thresholds: {
    http_req_duration: ['p(95)<3000'],
    http_req_failed: ['rate<0.01'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
  discardResponseBodies: true,
};
