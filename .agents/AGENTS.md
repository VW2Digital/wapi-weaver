# Visual & Experience Guidelines

Follow these guidelines for visual aesthetics, layout, and UI/UX patterns:

## Reference Design Systems
- **Linear**: Clean, minimal, modern, highly-productive, low noise, strong hierarchy.
- **Vercel / Geist**: SaaS style, generous whitespace, high contrast, crisp typography, clean grids, tech-premium feel.
- **Stripe**: Excellent data presentation, sidebars, dashboard grids, tables, clean actions/filters.
- **Shopify Polaris**: Clear forms, buttons, success/error feedback, easy configuration flows.
- **Atlassian**: Consistent badges, menus, labels, and clear status indications.
- **IBM Carbon**: Accessible, robust, high contrast, clean enterprise-grade tables.
- **Apple HIG**: Clarity, legibility, micro-interactions, clean padding/spacing.

## Styling Rules
- **Themes**: Light background or subtle gray, white cards with soft/delicate borders.
- **Shadows**: Very soft, subtle elevation.
- **Spacing**: Consistent margins and padding.
- **Colors**: Restricted, professional accent colors (avoid overly saturated primaries/multitudinous highlights).
- **Transitions**: Smooth micro-animations on interactive states.
- **No Emojis**: NUNCA use emojis na interface (botões, badges, abas, seletores, textos de UI). Use SEMPRE ícones vetoriais SVG da biblioteca (`lucide-react`).
- **Botões de Voltar**: TODOS os botões "Voltar" de navegabilidade em cabeçalhos de tela devem ficar posicionados à DIREITA (na área de ações do topo), nunca no lado esquerdo do título.
- **Meta Graph API Version**: Utilizar SEMPRE as versões recentes da Meta Graph API entre **v24.0**, **v25.0** e **v26.0** (com padrão em **v26.0**). Nunca utilizar ou regredir para versões antigas (v17 a v23).

---

## Database & Docker Guidelines
- **Docker Container**: The local MySQL database runs in a Docker container named `wapi_weaver_mysql`.
- **Database Configuration**:
  - **Host**: `localhost` (from outside Docker) or `banco-mysql` (inside Docker network).
  - **Port**: `3306`
  - **User**: `wapi_user`
  - **Password**: `S0xbxPfKazBVT8JFy1UEOjIsrjox`
  - **Database Name**: `wapi_weaver`
- **Troubleshooting**: If database connection fails (e.g. `AggregateError`), verify that the `wapi_weaver_mysql` container is running in Docker. If it is stopped, start it using `docker start wapi_weaver_mysql` or Docker Desktop.
  - **Path/Mounting Errors**: If Docker fails to start the container with mount/path errors (e.g., trying to reference files from an old directory path like `C:\` instead of the current `D:\`), reset and rebuild the containers in the current working directory by running:
    1. `docker-compose down`
    2. `docker-compose up -d`
    This will recreate the containers and update Docker's host file mounts to the correct current workspace directory.

---

## Port Map — wapi-weaver (LOCAL DEV)

Portas fixas deste projeto. NÃO alterar sem avisar. Outros projetos do usuário rodam em portas
diferentes e podem colidir — sempre confirme qual projeto está em qual porta antes de redirecionar
ou alterar configurações de rede/proxy.

| Serviço         | URL                      | Notas                                          |
|-----------------|--------------------------|------------------------------------------------|
| **Frontend**    | http://localhost:8080    | `npm run dev` → Vite dev server (TanStack Start) |
| **Backend API** | http://localhost:8081    | API/servidor Node quando separado do SSR        |
| **MySQL UI**    | http://localhost:8082    | Painel visual do banco MySQL                   |

---

# Regras de Comportamento do Agente

## 1. ESCOPO — faça SOMENTE o que foi pedido

- NÃO refatore, "melhore", renomeie ou reorganize código fora do que foi
  explicitamente solicitado. Se encontrar algo relevante fora do escopo,
  **reporte no final da resposta**, não corrija por conta própria.
- NÃO adicione bibliotecas, dependências, componentes de UI ou padrões novos
  que não foram pedidos. Se achar que uma lib resolveria melhor, pergunte antes
  de instalar.
- NÃO crie arquivos, pastas, rotas, variáveis de ambiente ou configs extras
  que não foram solicitados.
- Se a tarefa tocar em múltiplos arquivos e não estiver claro se algo está
  dentro do escopo, PARE e pergunte antes de alterar.

## 2. NÃO ALUCINE CONCLUSÃO

- NUNCA declare uma tarefa como "concluída", "corrigida" ou "funcionando" sem
  anexar evidência real: saída de terminal, log de build, resultado de curl,
  print de console, ou trecho de código alterado.
- Rodar `npm run build` sem erro NÃO é prova de que a funcionalidade funciona
  em runtime. Rode e teste em runtime antes de afirmar sucesso.
- Se não for possível testar, diga isso explicitamente — não presuma que
  "deve estar funcionando".
- Se um teste falhar ou o comportamento for incerto, reporte o estado real,
  mesmo que pareça um passo atrás.

## 3. NÃO INVENTE CONTEXTO

- NÃO assuma nomes de tabelas, colunas, endpoints, variáveis de ambiente ou
  estrutura de arquivos que você não verificou no projeto. Sempre leia o
  arquivo/schema real antes de referenciá-lo.
- NÃO invente valores de configuração (chaves, URLs, IDs) — se não existir no
  projeto, pergunte ou marque como placeholder explícito (`# TODO: preencher`).
- Se precisar saber algo sobre o projeto que não está visível no contexto
  atual, abra e leia o arquivo antes de escrever código que depende dele.

## 4. MUDANÇAS MÍNIMAS E REVISÁVEIS

- Prefira o menor diff possível que resolve o problema pedido.
- NÃO reescreva um arquivo inteiro se a mudança necessária é pontual.
- Mantenha o estilo de código já existente no projeto (nomenclatura,
  formatação, padrão de imports) em vez de impor seu próprio estilo.
- Ao final de cada tarefa, liste exatamente quais arquivos foram alterados e
  um resumo de uma linha do que mudou em cada um.

## 5. PARE E PERGUNTE QUANDO HOUVER AMBIGUIDADE

- Se o pedido puder ser interpretado de duas formas diferentes com resultados
  de código distintos, pare e pergunte — não escolha a interpretação mais
  "impressionante" ou mais abrangente.
- Se a tarefa pedida depender de uma decisão de produto que não foi
  especificada, pergunte antes de decidir sozinho.

## 6. DADOS SENSÍVEIS

- NUNCA hardcode chaves de API, tokens ou credenciais no código. Sempre use
  variáveis de ambiente já existentes no projeto (confira o `.env.example`
  antes de inventar um nome novo de variável).

## 7. FORMATO DE RESPOSTA AO FIM DE CADA TAREFA

Toda tarefa deve terminar com:

```
## O que foi feito
- [lista objetiva do que foi alterado]

## Evidência
- [comando rodado + saída real, ou trecho de log/console]

## Fora do escopo (se aplicável)
- [problemas identificados mas não corrigidos, por estarem fora do pedido]

## Pendências / não testado
- [qualquer coisa que não pôde ser verificada e por quê]
```

Se qualquer uma dessas seções não puder ser preenchida com honestidade,
isso é um sinal de que a tarefa não está realmente concluída.

---

# OMNICHANNEL NON-REGRESSION — MANDATORY

Este projeto é um SaaS omnichannel.

WhatsApp, Instagram e Messenger são canais independentes que compartilham um Messaging Core.

É PROIBIDO considerar uma alteração concluída se ela fizer um provider funcionar e causar regressão em outro provider já funcional.

Regras obrigatórias:

* WhatsApp, Instagram e Messenger devem coexistir.
* Cada provider usa sua própria `channel_connection`.
* Cada provider usa suas próprias credentials.
* Cada channel resolve sua própria `meta_app_connection_id`.
* Nunca resolver credencial por "latest Meta App do tenant".
* Nunca compartilhar Access Token entre providers.
* Nunca usar estado global mutável para provider/token/channel.
* Toda operação de envio deve ser roteada por `channel_connection_id` ou contexto equivalente determinístico.
* Alteração em código compartilhado exige regressão dos providers afetados.
* Alteração no Instagram exige regressão do WhatsApp.
* Alteração no WhatsApp exige regressão do Instagram.
* Alteração no Messaging Core exige regressão de todos os providers configurados.
* Um provider quebrado não pode derrubar os demais.
* Nunca corrigir uma integração trocando credentials de outro provider.
* Nunca declarar PASS parcial como tarefa concluída.

Critério:

WhatsApp PASS + Instagram FAIL = FAIL

Instagram PASS + WhatsApp FAIL = FAIL

WhatsApp PASS + Instagram PASS = PASS

Messenger também entra no gate quando estiver configurado.

Antes de editar mensageria, informar:

* provider alvo;
* arquivos que serão modificados;
* shared files afetados;
* providers sob risco;
* regressões obrigatórias.

Depois da alteração, executar e informar no mínimo:

* WhatsApp regression;
* Instagram regression;
* Messenger regression quando configurado;
* channel isolation;
* build;
* typecheck;
* testes de mensageria.

Se algum provider previamente funcional falhar:

NÃO marcar tarefa como concluída.

Investigar o `git diff`, localizar a regressão e corrigir a abstração.

## OMNICHANNEL GOLDEN PATH IS A RELEASE GATE

O teste `tests/jest/omnichannel-golden-path.jest.test.ts` é o gate de release da mensageria.

Ele prova, no MESMO build, que WhatsApp e Instagram enviam cada um pelo seu próprio
`channel_connection`, com a credencial do canal resolvida (decriptada) antes de chegar
na Meta, e cobre: credential resolution, channel isolation, WA → IG → WA, IG → WA → IG,
parallel e failure isolation.

Qualquer alteração nos arquivos protegidos abaixo exige rodar o Golden Path e reportar
o resultado:

```
src/routes/_app/chat.tsx
src/lib/chat.functions.ts
src/lib/chat-outbox.server.ts
src/lib/messaging/outbound/**
src/lib/messaging/channel*
src/lib/messaging/conversation*
src/lib/messaging/message*
```

Regras:

* O Golden Path NÃO substitui os testes específicos de provider — ambos são obrigatórios.
* `WhatsApp unit PASS` + `Golden Path FAIL` = FAIL. Tarefa não concluída.
* Nunca declarar outbound restaurado sem `provider_message_id` persistido.
* Nunca declarar PASS com base apenas em HTTP 200.

## 9. CONGELAMENTO DE ESCOPO DO INSTAGRAM

- **O módulo de Instagram está CONGELADO em funcionalidade.** A base atual (mensagens de texto, imagem, áudio, vídeo, documento e sticker) atinge o objetivo do projeto e NÃO deve ser expandida.
- NÃO adicione novos endpoints, colunas, tabelas, telas, canais, mídias, interações ou automações relacionadas ao Instagram sem aprovação explícita do usuário.
- Correções de bugs no fluxo existente são permitidas, mas NÃO representam expansão de escopo.
- Sempre que um pedido envolver Instagram, pare e confirme se trata-se de (a) correção de bug no escopo congelado ou (b) nova funcionalidade. No caso (b), avise que o escopo está congelado e peça autorização para prosseguir.

## 8. REGRA PERMANENTE DE PARIDADE E EVOLUÇÃO DO INSTALLER

- **O `install.sh` DEVE ACOMPANHAR A EVOLUÇÃO DA APLICAÇÃO**: Toda nova tabela, coluna, índice, FK, migration, variável de ambiente ou dependência de infra DEVE ser integrada ao contrato do repositório (`canonical-schema.sql`, `required-tables.json`, `required-columns.json`, `database/migrations/`) e o `install.sh` DEVE ser auditado.
- **PARIDADE OBRIGATÓRIA**: `BANCO LOCAL == FRESH INSTALL == UPDATE VPS`. A aplicação deve funcionar 1:1 tanto em instalações limpas quanto em updates de VPS.
- **DDL CENTRALIZADO**: O `install.sh` orquestra instalações e updates executando `create-all-tables.js`, `migrate.js` e `validate-database.js`. Não colocar comandos SQL DDL diretamente no script Bash.
- **NUNCA HARDCODAR QUANTIDADE DE TABELAS**: A validação lê dinamicamente a contagem do manifesto `database/schema/required-tables.json`.
- **SEMPRE AUDITAR IMPACTO DE DEPLOY**: Ao criar qualquer funcionalidade nova, verificar se há impacto em banco, env, serviços ou dependências. Se houver, atualizar manifests e installer. Se não houver, registrar explicitamente `INSTALL.SH REVIEWED — NO CHANGE REQUIRED`.

---

# OMNICHANNEL FREEZE — MANDATORY

WhatsApp and Instagram are currently a protected stable baseline.

Do not modify their runtime behavior unless the user explicitly authorizes an
`OMNICHANNEL UNFREEZE`.

A feature request is **not** authorization to modify provider routing,
credentials, webhook handlers, adapters or shared golden-path code.

Explicit unfreeze phrases required:

- `UNFREEZE WHATSAPP`
- `UNFREEZE INSTAGRAM`
- `UNFREEZE OMNICHANNEL CORE`

Protected surface is listed in `.omnichannel-freeze.json` and enforced by:

```bash
npm run guard:omnichannel
```

Before any messaging change, the agent must run the guard and confirm
`OMNICHANNEL FREEZE: PASS`.

