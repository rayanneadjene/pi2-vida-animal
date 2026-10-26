# Sistema de Gestão para Clínica Veterinária "Vida Animal"
## Fase A-1 e A-2 — Especificação de Requisitos e Modelagem

**Disciplina:** Projeto Integrador II  
**Integrantes:** Pierre Claudino Chapetta, Rayanne Adjene Gonçalves de Souza  
**Data:** 01 de outubro de 2026  

---

## 1. Introdução
### 1.1. Objetivo e Visão Geral do Documento
Este documento apresenta a Especificação de Requisitos e a Modelagem Inicial (Fases A-1 e A-2) do sistema de gestão para a clínica veterinária fictícia "Vida Animal". Apresenta o contexto, escopo, atores, regras de negócio, requisitos, e os diagramas e descrições de Casos de Uso e de Classes.

### 1.2. Termos e Siglas
- **Tutor:** responsável legal pelo pet. 
- **Pet:** animal atendido, sempre vinculado a um tutor.
- **Prontuário:** histórico clínico do pet (consultas, diagnósticos, vacinas).
- **No-show:** falta sem cancelamento prévio dentro do prazo. 
- **LGPD:** Lei nº 13.709/2018.
- **RN / RF / RNF / UC:** identificadores de Regra de Negócio, Requisito Funcional, Requisito Não-Funcional e Caso de Uso.

## 2. Visão Geral do Produto
### 2.1. Descrição do Minimundo
A clínica "Vida Animal" atende pequenos animais, mas seus processos são manuais: agendamento por telefone/planilha (gerando conflitos), prontuário em papel (risco de perda de informação) e estoque e financeiro sem controle sistemático. A direção decidiu informatizar esses processos para reduzir retrabalho e melhorar a gestão.

### 2.2. Delimitação do Escopo Inicial
- **Público-alvo:** clínicas veterinárias de pequeno/médio porte (recepção, veterinários e tutores).
- **Macro-funcionalidades:** cadastro de tutores/pets; agendamento; prontuário eletrônico; controle de estoque; emissão de recibos; calendário de vacinas; gestão de usuários.
- **Fora do escopo:** Pagamento online/NFe, app móvel nativo, telemedicina, programa de fidelidade.

## 3. Atores e Envolvidos

### 3.1. Atores (interagem com o sistema)
| Ator | Descrição |
|---|---|
| **Recepcionista** | Cadastra tutores/pets, agenda consultas e emite recibos. |
| **Veterinário** | Realiza consultas, registra o prontuário e prescreve tratamentos. |
| **Administrador do Sistema** | Gerencia usuários, controla estoque, acessos e relatórios. |

> **Nota:** O "Auxiliar Veterinário" listado na Fase A-1 foi absorvido pelo perfil "Administrador do Sistema", já que na prática suas ações no sistema (basicamente movimentar estoque) são as mesmas. Se no futuro houver necessidade de permissões separadas, o ator pode voltar.

### 3.2. Envolvidos (não interagem com o sistema)
| Envolvido | Descrição |
|---|---|
| **Tutor (Cliente)** | Responsável pelo pet; solicita e acompanha atendimentos. Não opera o sistema diretamente — fornece dados ao Recepcionista. |
| **Proprietário(a)/Gerente** | Interessado nos relatórios e resultados; não opera o sistema. |
| **Fornecedor de Insumos**| Não interage com o sistema; afeta a reposição de estoque. |

## 4. Requisitos

### 4.1. Regras de Negócio (RN)
| ID | Descrição | RF Impactado |
|---|---|---|
| **RN-01** | Todo pet atendido pela clínica deve ter um tutor responsável identificado. | RF-02 |
| **RN-02** | Atendimentos só ocorrem dentro do horário de funcionamento (seg-sáb, 8h-19h). | RF-03 |
| **RN-03** | Cancelamento deve ser avisado com 2h de antecedência; senão, conta como falta. | RF-03 |
| **RN-04** | Vacina só pode ser aplicada respeitando o intervalo mínimo da dose anterior. | RF-08 |
| **RN-05** | Medicamento controlado só é dispensado mediante prescrição veterinária. | RF-04, RF-06 |
| **RN-06** | Cada produto deve ter uma quantidade mínima definida em estoque. | RF-06 |
| **RN-07** | Pagamento via PIX tem 5% de desconto sobre o valor do serviço. | RF-07 |
| **RN-08** | Dados sensíveis são confidenciais e devem ser criptografados (LGPD). | RF-01, RF-02, RF-05 |

### 4.2. Requisitos Funcionais (RF)
| ID | Descrição | UC |
|---|---|---|
| **RF-01** | Cadastrar, editar e consultar tutores. | UC-01 |
| **RF-02** | Cadastrar, editar e consultar pets, vinculados a um tutor. | UC-01 |
| **RF-03** | Agendar, reagendar, cancelar e visualizar a agenda de consultas. | UC-02 |
| **RF-04** | Registrar no prontuário a anamnese, o diagnóstico e prescrição. | UC-03 |
| **RF-05** | Consultar o histórico clínico completo de um pet. | UC-03 |
| **RF-06** | Controlar entradas e saídas de estoque, com alerta de nível mínimo. | UC-05 |
| **RF-07** | Emitir recibo do atendimento, aplicando desconto quando cabível. | UC-04 |
| **RF-08** | Manter o calendário de vacinas e sinalizar doses pendentes. | UC-03 |
| **RF-09** | Cadastrar usuários e definir perfis de acesso. | UC-06 |
| **RF-10** | Gerar relatórios gerenciais (atendimentos, faturamento, serviços). | UC-07 |

### 4.3. Requisitos Não-Funcionais (RNF)
| ID | Tipo | Descrição |
|---|---|---|
| **RNF-01** | Usabilidade | Acesso via navegador, responsivo para computador e tablet. |
| **RNF-02** | Desempenho | Operações comuns respondem em até 3 segundos. |
| **RNF-03** | Segurança | Só usuários autenticados (veterinário/administrador) acessam prontuários. |
| **RNF-04** | Confiabilidade | Disponibilidade mínima de 99% no horário de funcionamento. |
| **RNF-05** | Segurança | Senhas armazenadas com criptografia (hash). |
| **RNF-06** | Confiabilidade | Backup automático diário dos dados. |
| **RNF-07** | Portabilidade | Funciona nos navegadores mais usados (Chrome, Firefox, Edge). |

---

## 5. Diagrama de Casos de Uso

Abaixo o diagrama seguindo a notação UML padrão:

![Diagrama de Casos de Uso](diagrama_uc.png)

---

## 6. Cenários dos Casos de Uso (Descrições)

### UC-01 — Cadastrar Tutor e Pet
| Item | Descrição |
|---|---|
| **Identificador / Título** | UC-01 — Cadastrar Tutor e Pet |
| **Tipo do UC** | Primário |
| **Atores** | Recepcionista (Primário) |
| **Objetivo** | Registrar um novo cliente (Tutor) e seu(s) respectivo(s) animal(is) (Pet) no sistema. |
| **Pré-Condições** | O Recepcionista deve estar autenticado no sistema. |
| **Pós-Condições** | Um novo registro de Tutor e ao menos um Pet são persistidos e vinculados. |
| **Trigger (Gatilho)** | O Recepcionista seleciona a opção "Novo Cadastro de Tutor" no sistema. |
| **Fluxo Básico/Principal** | 1. O Recepcionista seleciona a opção "Novo Cadastro de Tutor".<br>2. O sistema exibe o formulário de dados cadastrais.<br>3. O Recepcionista preenche os dados do tutor (nome, CPF, telefone, e-mail, endereço).<br>4. O sistema valida os dados (CPF válido e único) e salva o Tutor. [RN-08]<br>5. O sistema exibe o formulário "Adicionar Pet".<br>6. O Recepcionista insere os dados do animal (nome, espécie, raça, sexo, data de nascimento, peso). [RN-01]<br>7. O sistema salva o Pet, vinculando-o ao Tutor cadastrado.<br>8. O sistema exibe a confirmação do cadastro completo. |
| **Fluxos Alternativos** | **FA-01 — Adicionar múltiplos pets:** No passo 8 do FB, o Recepcionista seleciona "Adicionar outro Pet". O fluxo retorna ao passo 5 do FB para cada pet adicional do mesmo tutor. Ao finalizar, retorna ao passo 8 do FB. |
| **Fluxos de Exceção** | **FE-01 — CPF já cadastrado:** No passo 4 do FB, se o CPF já existir no sistema, o sistema exibe alerta "Tutor já cadastrado" e redireciona para a tela de edição do cadastro existente. O caso de uso é encerrado sem novo cadastro.<br><br>**FE-02 — CPF inválido:** No passo 4 do FB, se o CPF for inválido (dígito verificador incorreto), o sistema exibe alerta e retorna ao passo 3 do FB. |
| **Referências Cruzadas** | RF-01, RF-02, RN-01 (Pet deve ter tutor), RN-08 (LGPD — criptografia de dados sensíveis). |

### UC-02 — Agendar Consulta
| Item | Descrição |
|---|---|
| **Identificador / Título** | UC-02 — Agendar Consulta |
| **Tipo do UC** | Primário |
| **Atores** | Recepcionista (Primário) |
| **Objetivo** | Marcar, reagendar ou cancelar uma consulta para um pet com um veterinário específico. |
| **Pré-Condições** | O Tutor e o Pet devem estar previamente cadastrados (UC-01 realizado). O Recepcionista deve estar autenticado. |
| **Pós-Condições** | A consulta é salva no banco com status "Agendada". |
| **Trigger (Gatilho)** | O Recepcionista acessa a aba de "Agendamentos" no sistema. |
| **Fluxo Básico/Principal** | 1. O Recepcionista acessa a aba de "Agendamentos".<br>2. O sistema exibe o calendário da agenda.<br>3. O Recepcionista busca e seleciona o Pet cadastrado.<br>4. O Recepcionista seleciona o Veterinário desejado, a data e o horário. [RN-02]<br>5. O sistema verifica a disponibilidade do horário.<br>6. O sistema confirma e grava a consulta com status "Agendada". |
| **Fluxos Alternativos** | **FA-01 — Remarcação:** No passo 1 do FB, o Recepcionista localiza uma consulta já existente com status "Agendada" e seleciona "Reagendar". O sistema exibe os dados atuais. O Recepcionista altera a data e/ou horário. O sistema verifica a disponibilidade [RN-02] e atualiza o registro. O fluxo retorna ao passo 6 do FB.<br><br>**FA-02 — Cancelamento dentro do prazo:** No passo 1 do FB, o Recepcionista localiza uma consulta "Agendada" e seleciona "Cancelar". O sistema verifica que faltam mais de 2 horas para a consulta [RN-03], altera o status para "Cancelada" e libera o horário. Retorna ao passo 2 do FB. |
| **Fluxos de Exceção** | **FE-01 — Horário indisponível:** No passo 5 do FB (ou durante FA-01), se o horário estiver ocupado ou fora do expediente [RN-02], o sistema exibe alerta e sugere o próximo horário livre. O fluxo retorna ao passo 4 do FB.<br><br>**FE-02 — Cancelamento fora do prazo (No-show):** No FA-02, se faltarem menos de 2 horas para a consulta, o sistema impede o cancelamento e registra a consulta como "No-show" [RN-03]. O caso de uso é encerrado. |
| **Referências Cruzadas** | RF-03, RN-02 (Horário de funcionamento), RN-03 (Cancelamento / No-show). |

### UC-03 — Realizar Consulta Clínica
| Item | Descrição |
|---|---|
| **Identificador / Título** | UC-03 — Realizar Consulta Clínica |
| **Tipo do UC** | Primário |
| **Atores** | Veterinário (Primário) |
| **Objetivo** | Registrar o atendimento clínico (anamnese, diagnóstico, prescrição) no prontuário do pet e, quando aplicável, atualizar o calendário de vacinas. |
| **Pré-Condições** | Existir uma consulta com status "Agendada" para o Veterinário autenticado. |
| **Pós-Condições** | Consulta finalizada (status "Realizada"), Prontuário criado/atualizado e, se aplicável, calendário de vacinas atualizado. |
| **Trigger (Gatilho)** | O Veterinário clica em "Iniciar Consulta" em sua agenda do dia no sistema. |
| **Fluxo Básico/Principal** | 1. O Veterinário acessa sua agenda do dia.<br>2. O Veterinário seleciona a consulta e clica em "Iniciar Consulta".<br>3. O sistema carrega o histórico clínico do Pet (prontuários anteriores e vacinas). [RF-05]<br>4. O Veterinário preenche a anamnese e os resultados do exame físico.<br>5. O Veterinário insere o diagnóstico e a prescrição. [RN-05]<br>6. O Veterinário clica em "Finalizar Consulta".<br>7. O sistema salva o prontuário e atualiza o status da consulta para "Realizada". |
| **Fluxos Alternativos** | **FA-01 — Aplicação de vacina:** No passo 5 do FB, se houver aplicação de vacina, o Veterinário seleciona "Registrar Vacina". O sistema verifica o intervalo mínimo em relação à dose anterior [RN-04]. Se o intervalo for respeitado, o Veterinário registra a dose no cartão virtual do pet e o sistema calcula automaticamente a data da próxima dose [RF-08]. O fluxo retorna ao passo 6 do FB. |
| **Fluxos de Exceção** | **FE-01 — No-show:** No passo 2 do FB, se o paciente não compareceu, o Veterinário ou Recepcionista seleciona "Registrar No-show". O sistema altera o status da consulta para "No-show" [RN-03]. O caso de uso é encerrado sem criação de prontuário.<br><br>**FE-02 — Intervalo vacinal não respeitado:** No FA-01, se o intervalo mínimo entre doses não for respeitado [RN-04], o sistema exibe alerta e impede o registro da vacina. O Veterinário pode prosseguir sem registrar a vacina, retornando ao passo 6 do FB. |
| **Referências Cruzadas** | RF-04, RF-05, RF-08, RN-03 (No-show), RN-04 (Intervalo vacinal), RN-05 (Medicamento controlado). |

### UC-04 — Emitir Recibo de Pagamento
| Item | Descrição |
|---|---|
| **Identificador / Título** | UC-04 — Emitir Recibo de Pagamento |
| **Tipo do UC** | Primário |
| **Atores** | Recepcionista (Primário) |
| **Objetivo** | Cobrar pelo atendimento e emitir o comprovante de pagamento ao tutor. |
| **Pré-Condições** | A consulta deve ter o status "Realizada" (UC-03 concluído). O Recepcionista deve estar autenticado. |
| **Pós-Condições** | Recibo gerado, consulta marcada como "Paga" e valores registrados no financeiro. |
| **Trigger (Gatilho)** | O Recepcionista acessa o módulo "Financeiro/Faturamento" no sistema. |
| **Fluxo Básico/Principal** | 1. O Recepcionista acessa o módulo "Financeiro/Faturamento".<br>2. O sistema lista as consultas com status "Realizada" pendentes de pagamento.<br>3. O Recepcionista seleciona a consulta desejada.<br>4. O sistema calcula o subtotal com base nos serviços e procedimentos registrados.<br>5. O Recepcionista define a forma de pagamento (Dinheiro, Cartão ou PIX).<br>6. O sistema aplica o desconto de 5% automaticamente, se a forma selecionada for PIX. [RN-07]<br>7. O Recepcionista confirma o pagamento.<br>8. O sistema gera o recibo (PDF/Impressão), atualiza o status da consulta para "Paga" e registra o pagamento. |
| **Fluxos Alternativos** | Nenhum. |
| **Fluxos de Exceção** | **FE-01 — Pagamento não aprovado:** No passo 7 do FB, se o pagamento via cartão for recusado pela operadora, o sistema exibe alerta "Pagamento recusado" e retorna ao passo 5 do FB para que o Recepcionista selecione outra forma de pagamento. |
| **Referências Cruzadas** | RF-07, RN-07 (Desconto 5% PIX). |

### UC-05 — Gerenciar Estoque
| Item | Descrição |
|---|---|
| **Identificador / Título** | UC-05 — Gerenciar Estoque |
| **Tipo do UC** | Primário |
| **Atores** | Administrador do Sistema (Primário) |
| **Objetivo** | Cadastrar produtos, registrar entradas e saídas de estoque e monitorar os níveis mínimos. |
| **Pré-Condições** | O Administrador deve estar autenticado no sistema. |
| **Pós-Condições** | Produto cadastrado/atualizado e movimentação de estoque registrada. |
| **Trigger (Gatilho)** | O Administrador acessa o módulo "Estoque" no sistema. |
| **Fluxo Básico/Principal** | 1. O Administrador acessa o módulo "Estoque".<br>2. O sistema exibe a lista de produtos com suas quantidades atuais.<br>3. O Administrador seleciona um produto e escolhe "Registrar Entrada".<br>4. O Administrador informa a quantidade recebida, o motivo (compra, doação, devolução) e o fornecedor.<br>5. O sistema registra a movimentação de entrada e atualiza a quantidade em estoque do produto.<br>6. O sistema exibe a confirmação da operação. |
| **Fluxos Alternativos** | **FA-01 — Cadastrar novo produto:** No passo 3 do FB, o Administrador seleciona "Novo Produto". Preenche nome, categoria, quantidade mínima, preço unitário, fornecedor e se é controlado. [RN-06] O sistema salva o produto. O fluxo retorna ao passo 2 do FB.<br><br>**FA-02 — Registrar saída de estoque:** No passo 3 do FB, o Administrador seleciona "Registrar Saída". Informa a quantidade, o motivo (uso em procedimento, vencimento, perda) e, se o produto for controlado, vincula a prescrição veterinária correspondente [RN-05]. O sistema atualiza a quantidade e retorna ao passo 6 do FB. |
| **Fluxos de Exceção** | **FE-01 — Estoque abaixo do nível mínimo:** No passo 5 do FB ou no FA-02, se a quantidade resultante ficar igual ou abaixo da quantidade mínima definida [RN-06], o sistema exibe alerta "Estoque Baixo" ao Administrador. O caso de uso não é cancelado; a operação é concluída normalmente, mas o alerta fica visível no painel.<br><br>**FE-02 — Saída de controlado sem prescrição:** No FA-02, se o produto for controlado e não houver prescrição veterinária vinculada, o sistema impede a saída e exibe alerta [RN-05]. O fluxo retorna ao passo 3 do FB. |
| **Referências Cruzadas** | RF-06, RN-05 (Medicamento controlado requer prescrição), RN-06 (Quantidade mínima de estoque). |

### UC-06 — Gerenciar Usuários
| Item | Descrição |
|---|---|
| **Identificador / Título** | UC-06 — Gerenciar Usuários |
| **Tipo do UC** | Primário |
| **Atores** | Administrador do Sistema (Primário) |
| **Objetivo** | Cadastrar, editar, consultar e desativar usuários do sistema, definindo seus perfis de acesso (Recepcionista, Veterinário, Administrador). |
| **Pré-Condições** | O Administrador deve estar autenticado no sistema com perfil "Administrador". |
| **Pós-Condições** | Usuário cadastrado/atualizado com perfil de acesso definido. |
| **Trigger (Gatilho)** | O Administrador acessa o módulo "Gestão de Usuários" no sistema. |
| **Fluxo Básico/Principal** | 1. O Administrador acessa o módulo "Gestão de Usuários".<br>2. O sistema exibe a lista de usuários cadastrados (ativos e inativos).<br>3. O Administrador seleciona "Novo Usuário".<br>4. O Administrador preenche os dados (nome, login, e-mail, senha provisória e perfil de acesso).<br>5. Se o perfil selecionado for "Veterinário", o sistema exige o preenchimento do campo CRMV.<br>6. O sistema valida os dados (login único), criptografa a senha [RN-08] e salva o usuário.<br>7. O sistema exibe a confirmação do cadastro. |
| **Fluxos Alternativos** | **FA-01 — Editar usuário:** No passo 3 do FB, o Administrador seleciona um usuário existente e clica em "Editar". O sistema carrega os dados atuais. O Administrador altera os campos desejados. O sistema valida e salva as alterações. Retorna ao passo 7 do FB.<br><br>**FA-02 — Desativar usuário:** No passo 3 do FB, o Administrador seleciona um usuário ativo e clica em "Desativar". O sistema altera o campo `ativo` para `false`, impedindo futuros logins. Retorna ao passo 2 do FB. |
| **Fluxos de Exceção** | **FE-01 — Login duplicado:** No passo 6 do FB (ou no FA-01), se o login já estiver em uso por outro usuário, o sistema exibe alerta "Login já cadastrado" e retorna ao passo 4 do FB.<br><br>**FE-02 — CRMV não informado:** No passo 5 do FB, se o perfil for "Veterinário" e o CRMV não for preenchido, o sistema exibe alerta e impede o salvamento. Retorna ao passo 4 do FB. |
| **Referências Cruzadas** | RF-09, RN-08 (LGPD — criptografia de senhas). |

### UC-07 — Gerar Relatórios
| Item | Descrição |
|---|---|
| **Identificador / Título** | UC-07 — Gerar Relatórios |
| **Tipo do UC** | Primário |
| **Atores** | Administrador do Sistema (Primário) |
| **Objetivo** | Consultar indicadores gerenciais de atendimentos, faturamento e serviços da clínica. |
| **Pré-Condições** | O Administrador deve estar autenticado no sistema. Devem existir dados de consultas e pagamentos registrados. |
| **Pós-Condições** | Relatório gerado e disponibilizado para visualização ou exportação. |
| **Trigger (Gatilho)** | O Administrador acessa o módulo "Relatórios" no sistema. |
| **Fluxo Básico/Principal** | 1. O Administrador acessa o módulo "Relatórios".<br>2. O sistema exibe os tipos de relatórios disponíveis (Atendimentos por período, Faturamento, Serviços mais realizados, Vacinas pendentes).<br>3. O Administrador seleciona o tipo de relatório desejado.<br>4. O Administrador define os filtros (período, veterinário, tipo de serviço).<br>5. O sistema processa os dados e gera o relatório.<br>6. O sistema exibe o relatório na tela com opção de exportação (PDF/CSV). |
| **Fluxos Alternativos** | **FA-01 — Exportar relatório:** No passo 6 do FB, o Administrador clica em "Exportar". O sistema gera o arquivo no formato escolhido (PDF ou CSV) e disponibiliza para download. Retorna ao passo 6 do FB. |
| **Fluxos de Exceção** | **FE-01 — Sem dados no período:** No passo 5 do FB, se não houver dados para os filtros informados, o sistema exibe mensagem "Nenhum registro encontrado para o período selecionado" e retorna ao passo 4 do FB para ajuste de filtros. |
| **Referências Cruzadas** | RF-10. |

---

## 7. Diagrama de Classes (UML)

O diagrama abaixo apresenta as classes com seus atributos (incluindo chaves naturais marcadas com `<<unique>>`), métodos, associações com nomes de papel e multiplicidades em cada ponta, e composições (losango preenchido) onde há dependência existencial.

![Diagrama de Classes UML](diagrama_classes.png)

#### Notas UML — Restrições de Negócio

| Classe | Restrição / Nota |
|---|---|
| **Pet** | **Chave natural:** {nome + tutor.cpf}. **RN-01:** Todo pet deve obrigatoriamente possuir um tutor. |
| **Usuario** | O atributo `crmv` é obrigatório e preenchido somente quando `perfil = "Veterinário"`. Perfis válidos: {Recepcionista, Veterinário, Administrador}. |
| **Consulta** | **RN-02:** `dataHora` deve estar dentro do horário de funcionamento (seg-sáb, 8h-19h). **Status válidos:** {Agendada, Realizada, Cancelada, No-show, Paga}. **RN-03:** Cancelamento com menos de 2h → status "No-show". |
| **Vacina** | **RN-04:** `dataAplicacao` deve respeitar o intervalo mínimo em relação à `proximaDose` da dose anterior da mesma vacina. |
| **Produto** | **RN-05:** Produto com `controlado = true` só é dispensado mediante prescrição veterinária. **RN-06:** Alerta gerado quando `quantidade ≤ quantidadeMinima`. |
| **Recibo** | **RN-07:** Se `formaPagamento = "PIX"`, `desconto = subtotal × 0,05`. |
| **Tutor** | **RN-08 / LGPD:** `cpf` e dados sensíveis devem ser armazenados com criptografia. |

### 7.1. Descrição Conceitual das Classes

*   **Tutor:** Dono do animal. Chave natural: `cpf`. Composição com `Pet` — deletar o tutor apaga os pets dele (dependência existencial). Dados sensíveis (CPF) criptografados conforme RN-08.

*   **Pet:** Paciente da clínica. Chave natural composta: `{nome + tutor.cpf}` (dois tutores podem ter pets com o mesmo nome, mas um tutor não). Todo pet precisa de um tutor (RN-01). A ligação com `Consulta` e `Vacina` é associação simples, porque esses registros têm vida própria.

*   **Usuario:** Agrupa os perfis de acesso (Recepcionista, Veterinário, Administrador). Chave natural: `login`. O campo `crmv` só é preenchido (e obrigatório) quando o perfil é "Veterinário"; nos demais fica nulo.

*   **Consulta:** Centro do fluxo operacional. O `status` evolui de Agendada → Realizada → Paga, podendo virar Cancelada ou No-show. `dataHora` respeita o expediente (RN-02) e cancelamento tardio vira No-show (RN-03). Composição com `Prontuario` e `Recibo`, já que ambos só existem dentro do contexto de uma consulta.

*   **Prontuario:** Registro médico-legal da consulta. Composição com `Consulta` — não existe prontuário sem consulta. Guarda anamnese, exame físico, diagnóstico e prescrição.

*   **Vacina:** Histórico de vacinação do pet. O sistema valida o intervalo mínimo entre a `dataAplicacao` e a `proximaDose` da aplicação anterior (RN-04).

*   **Produto e MovimentacaoEstoque:** Controle de insumos. Chave natural de `Produto`: `nome`. Itens marcados como `controlado = true` precisam de prescrição para saída (RN-05), e o sistema alerta quando `quantidade ≤ quantidadeMinima` (RN-06). `MovimentacaoEstoque` funciona como classe associativa, ligando o produto ao usuário responsável pela operação.

*   **Recibo:** Comprovante de pagamento gerado após a consulta. Se a forma for PIX, aplica 5% de desconto (RN-07). Tem associação com `Tutor` para saber para quem foi emitido.

