---

## 9. Projeto Arquitetural do Sistema (Fase B-4)

### 9.1. Visão Geral da Arquitetura

O sistema segue uma arquitetura **cliente-servidor em três camadas físicas**: navegador, servidor de aplicação e SGBD. No backend, a organização lógica segue a **Arquitetura Limpa** (*Clean Architecture*, R. C. Martin), em que as dependências do código apontam sempre para dentro, em direção às regras de negócio:

| Camada (de fora para dentro) | Responsabilidade | Exemplos no sistema |
|---|---|---|
| **Frameworks e Drivers** | Detalhes técnicos substituíveis: banco, criptografia, geração de arquivos. | Repositórios SQL (MySQL), bcrypt/AES, gerador de PDF/CSV. |
| **Adaptadores de Interface** | Converter requisições HTTP/JSON em chamadas aos casos de uso e devolver as respostas. | Controladores REST, middleware de autenticação JWT e autorização por perfil. |
| **Casos de Uso** | Orquestrar cada caso de uso (UC-01 a UC-07) e aplicar as regras da aplicação. | `AgendamentoService` (RN-02, RN-03), `AtendimentoService` (RN-04), `FaturamentoService` (RN-07). |
| **Entidades** | Regras de negócio centrais, independentes de framework. | Tutor, Pet, Consulta, Prontuario, Vacina, Produto, Recibo, Usuario (Seção 7). |

Os casos de uso dependem apenas de **interfaces** (`IRepositorios`, `ICriptografia`, `IGeradorDocumentos`), que são implementadas pela camada de infraestrutura (inversão de dependência). Assim, dá para trocar o SGBD ou a biblioteca de PDF sem alterar as regras de negócio, e os casos de uso podem ser testados com repositórios simulados (*mocks*).

### 9.2. Diagrama de Componentes (visão lógica)

![Diagrama de Componentes](fase_b/diagramas/componentes.png)

**Descrição dos componentes:**

| Componente | Interfaces fornecidas / requeridas | Descrição |
|---|---|---|
| **Aplicação Web (SPA)** | Requer: *API REST* | Interface responsiva para computador e tablet (RNF-01, RNF-07). Um módulo por área funcional; não contém regras de negócio. |
| **Adaptadores de Interface** | Fornece: *API REST (HTTPS/JSON)* | Expõe os *endpoints* (`/tutores`, `/pets`, `/consultas`, `/prontuarios`, `/recibos`, `/produtos`, `/usuarios`, `/relatorios`). O middleware valida o token JWT e o perfil do usuário (ex.: prontuário só para Veterinário/Administrador — RNF-03). |
| **Casos de Uso** | Requer: *IRepositorios*, *ICriptografia*, *IGeradorDocumentos* | Um serviço por caso de uso, rastreável aos UCs da Seção 6. |
| **Entidades de Domínio** | — | Classes do Diagrama de Classes com seus métodos de negócio (ex.: `Consulta.cancelar()`, `Vacina.verificarIntervalo()`, `Recibo.calcularDescontoPix()`). |
| **Repositórios SQL** | Fornece: *IRepositorios* | Persistência no esquema relacional da Seção 8, por meio de ORM/driver MySQL. |
| **Criptografia** | Fornece: *ICriptografia* | Hash de senhas com bcrypt (RNF-05) e cifragem AES-256 do CPF (RN-08). |
| **Gerador de Documentos** | Fornece: *IGeradorDocumentos* | Geração do recibo em PDF (UC-04) e exportação de relatórios em PDF/CSV (UC-07). |
| **SGBD MySQL** | — | Banco `clinica_vida_animal` (Apêndice A). |

### 9.3. Diagrama de Implantação (visão física)

![Diagrama de Implantação](fase_b/diagramas/implantacao.png)

**Descrição dos nós:**

| Nó | Tipo | Artefatos implantados / Observações |
|---|---|---|
| **Estação de Trabalho** (PC ou tablet) | `<<device>>` | Navegador (Chrome, Firefox ou Edge — RNF-07) que executa a SPA `vida-animal-web`. Nenhuma instalação local é necessária. |
| **VPS Oracle Cloud (OCI)** | `<<device>>` | Servidor Ubuntu 22.04 LTS (o mesmo provedor usado no protótipo das fases anteriores). Concentra os ambientes de execução abaixo. |
| ↳ **Nginx** | `<<executionEnvironment>>` | Serve os arquivos estáticos da SPA, termina o TLS (HTTPS na porta 443) e atua como *proxy* reverso para a API. |
| ↳ **Node.js 20 LTS** | `<<executionEnvironment>>` | Executa o artefato `vida-animal-api` (componentes de backend da Seção 9.2), ouvindo apenas em `localhost:3000`. |
| ↳ **MySQL Server 8.0** | `<<executionEnvironment>>` | Hospeda o banco `clinica_vida_animal`, acessível apenas por `localhost:3306` (não exposto à Internet). |
| ↳ **cron** | `<<executionEnvironment>>` | Executa diariamente `backup_diario.sh` (`mysqldump` compactado) — RNF-06. |
| **OCI Object Storage** | `<<device>>` | Armazena as cópias de segurança fora da VPS, com retenção de 30 dias. |

**Decisões de implantação:** apenas a porta 443 fica exposta. A API e o banco escutam somente em *localhost*, o que reduz a superfície de ataque (RNF-03, RN-08). O processo Node.js é supervisionado (ex.: `systemd`/PM2), com reinício automático, para apoiar a meta de disponibilidade de 99% (RNF-04).

---

## 10. Projeto Funcional do Sistema (Modelo de Interações)

### 10.1. Casos de Uso Selecionados

Foram escolhidos os três casos de uso com mais regras de negócio e mais desvios de fluxo. Cada diagrama cobre um único caso de uso:

| Diagrama | Caso de Uso | Justificativa da escolha |
|---|---|---|
| **Sequência** (obrigatório) | UC-03 — Realizar Consulta Clínica | Envolve mais objetos colaborando (Consulta, Pet, Vacina, Prontuario), consulta ao histórico (RF-05), validação vacinal (RN-04) e registro de No-show (RN-03). |
| **Atividades** (obrigatório) | UC-05 — Gerenciar Estoque | Fluxo com várias decisões (entrada, saída, novo produto), bloqueio de controlados sem prescrição (RN-05) e alerta de estoque mínimo (RN-06). |
| **Estados** (escolhido) | UC-02 — Agendar Consulta | O comportamento do UC-02 é essencialmente a evolução do estado da `Consulta` (agendar, reagendar, cancelar, no-show), com guardas de horário (RN-02) e antecedência (RN-03). |

### 10.2. Diagrama de Sequência — UC-03 Realizar Consulta Clínica

![Diagrama de Sequência UC-03](fase_b/diagramas/sequencia_uc03.png)

**Correspondência com a descrição do UC-03 (Seção 6):**

| Mensagens | Fluxo do UC-03 |
|---|---|
| 1 a 7 | FB passos 1–2 (acessar agenda e selecionar consulta). |
| 8 a 14 (fragmento `alt`, 1º operando) | FE-01 — No-show: a consulta muda para `NO_SHOW` (RN-03) e nenhum prontuário é criado. |
| 15 a 22 | FB passo 3 — carregar histórico clínico e vacinas do pet (RF-05). |
| 23 a 24 | FB passos 4–5 — anamnese, exame físico, diagnóstico e prescrição (RN-05). |
| 25 a 33 (fragmento `opt` + `alt`) | FA-01 — aplicação de vacina com verificação de intervalo (RN-04) e cálculo da próxima dose (RF-08). |
| 34 a 35 | FE-02 — intervalo vacinal não respeitado; a vacina não é registrada e o fluxo segue para a finalização. |
| 36 a 44 | FB passos 6–7 — criação do `Prontuario` e mudança do status da consulta para `REALIZADA`. |

> **Nota:** os métodos usados correspondem aos do Diagrama de Classes (`consultarHistorico()`, `listarVacinas()`, `verificarIntervalo()`, `registrarAplicacao()`, `registrar()`, `registrarNoShow()`). Foram acrescentados à classe `Consulta` os métodos `buscarAgendadas()` e `finalizar()`, identificados durante a modelagem das interações.

### 10.3. Diagrama de Atividades — UC-05 Gerenciar Estoque

![Diagrama de Atividades UC-05](fase_b/diagramas/atividades_uc05.png)

**Correspondência com a descrição do UC-05 (Seção 6):**

| Caminho no diagrama | Fluxo do UC-05 |
|---|---|
| Acessar módulo → Exibir lista → Escolher operação | FB passos 1–3. |
| "Cadastrar novo produto? = sim" | FA-01 — cadastro de novo produto com quantidade mínima (RN-06). |
| "Tipo de movimentação = Entrada" | FB passos 4–5 — registro de entrada e atualização do saldo. |
| "Tipo de movimentação = Saída" | FA-02 — registro de saída com subtração do saldo. |
| "Controlado sem prescrição vinculada? = sim" | FE-02 — saída bloqueada (RN-05); a atividade é encerrada sem movimentação. |
| "quantidade ≤ quantidadeMinima? = sim" | FE-01 — alerta "Estoque Baixo" (RN-06); a operação é concluída normalmente. |
| Exibir confirmação | FB passo 6. |

### 10.4. Diagrama de Estados — UC-02 Agendar Consulta

![Diagrama de Estados UC-02](fase_b/diagramas/estados_uc02.png)

**Descrição dos estados e transições do objeto `Consulta` no escopo do UC-02:**

| Estado | Descrição | Ação de entrada |
|---|---|---|
| **Agendada** | Consulta marcada para um pet com um veterinário, em data/hora válida. | Reservar o horário do veterinário na agenda. |
| **Cancelada** | Cancelada com pelo menos 2h de antecedência (FA-02). Estado final. | Liberar o horário na agenda. |
| **No-show** | Tentativa de cancelamento com menos de 2h de antecedência (FE-02). Estado final. | Registrar a falta do tutor. |

| Transição | Evento [guarda] | Fluxo do UC-02 |
|---|---|---|
| início → Agendada | `agendar()` [horário livre e dentro do expediente — RN-02] | FB passos 4–6. |
| Agendada → Agendada | `reagendar()` [novo horário livre e dentro do expediente — RN-02] | FA-01 — Remarcação. |
| Agendada → Cancelada | `cancelar()` [antecedência ≥ 2h — RN-03] | FA-02 — Cancelamento dentro do prazo. |
| Agendada → No-show | `cancelar()` [antecedência < 2h — RN-03] | FE-02 — Cancelamento fora do prazo. |
| Agendada → fim | `iniciarConsulta()` | Encerra o escopo do UC-02; a consulta segue para o UC-03 (estados `REALIZADA` e `PAGA`, tratados nos UC-03 e UC-04). |

> O FE-01 (horário indisponível) não gera transição: a guarda da transição de agendamento/reagendamento é falsa, o objeto permanece no estado atual e o sistema sugere o próximo horário livre.

