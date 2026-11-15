// Cache em memória com expiração (TTL) e coalescência de requisições concorrentes.
// Otimização da Fase E - 2ª medição (hipóteses 1 e 3 do Serviço 1):
//  - evita repetir, a cada requisição, a mesma junção de 4 tabelas no MySQL;
//  - guarda a resposta JÁ SERIALIZADA (Buffer JSON), eliminando o JSON.stringify
//    de ~25 KB no event loop do Node.js a cada chamada;
//  - "single-flight": se várias requisições pedem a mesma chave ao mesmo tempo e ela
//    ainda não está no cache, apenas UMA consulta vai ao banco e as demais aguardam
//    a mesma Promise (evita o "efeito manada" / cache stampede);
//  - "stale-while-revalidate" + TTL com variação aleatória (±20%): entradas vencidas
//    continuam sendo servidas enquanto são recarregadas em segundo plano, e os
//    vencimentos não acontecem todos no mesmo instante.
class CacheTTL {
  constructor({ ttlMs = 30000, maxItens = 1000 } = {}) {
    this.ttlMs = ttlMs;
    this.maxItens = maxItens;
    this.itens = new Map();      // chave -> { valor, expiraEm }
    this.pendentes = new Map();  // chave -> Promise em andamento
    this.acertos = 0;
    this.faltas = 0;
    this.revalidacoes = 0;
  }

  async obter(chave, carregar) {
    const agora = Date.now();
    const item = this.itens.get(chave);
    if (item && item.expiraEm > agora) {
      this.acertos++;
      return item.valor;
    }
    const pendente = this.pendentes.get(chave);
    if (item) {
      // "stale-while-revalidate": a entrada expirou, mas ainda é devolvida
      // imediatamente enquanto UMA recarga é feita em segundo plano. Assim, o
      // vencimento simultâneo de várias chaves não gera rajadas de consultas que
      // bloqueiam as requisições (o dado fica, no máximo, ~1 recarga atrasado).
      this.acertos++;
      if (!pendente) {
        this.revalidacoes++;
        this._carregar(chave, carregar).catch(() => {});
      }
      return item.valor;
    }
    if (pendente) {
      this.acertos++;
      return pendente;
    }

    this.faltas++;
    return this._carregar(chave, carregar);
  }

  _carregar(chave, carregar) {
    const p = (async () => {
      try {
        const valor = await carregar();
        this.itens.delete(chave);
        if (this.itens.size >= this.maxItens) {
          // descarta a entrada mais antiga (ordem de inserção do Map)
          this.itens.delete(this.itens.keys().next().value);
        }
        const ttl = this.ttlMs * (0.8 + 0.4 * Math.random());
        this.itens.set(chave, { valor, expiraEm: Date.now() + ttl });
        return valor;
      } finally {
        this.pendentes.delete(chave);
      }
    })();
    this.pendentes.set(chave, p);
    return p;
  }

  // Invalidação explícita: deve ser chamada por qualquer rota que altere consultas
  // (agendar, remarcar, cancelar) para que a agenda nunca fique desatualizada além do TTL.
  invalidar(prefixo) {
    for (const chave of this.itens.keys()) {
      if (!prefixo || chave.startsWith(prefixo)) this.itens.delete(chave);
    }
  }

  estatisticas() {
    const total = this.acertos + this.faltas;
    return {
      itens: this.itens.size,
      acertos: this.acertos,
      faltas: this.faltas,
      revalidacoes_em_segundo_plano: this.revalidacoes,
      taxa_acerto: total ? +(this.acertos / total).toFixed(4) : 0,
      ttl_ms: this.ttlMs,
    };
  }
}

module.exports = CacheTTL;
