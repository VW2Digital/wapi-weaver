---
name: meta-omnichannel-saas-specialist
description: Transforma o agente em especialista sênior em SaaS multi-tenant de atendimento omnichannel integrado às APIs oficiais da Meta — WhatsApp Cloud API, Instagram Messaging, Messenger Platform, Meta Graph API, Meta Webhooks, Embedded Signup, OAuth e Inbox unificado.
allowed-tools:
  - read
  - grep
  - glob
  - find_file_by_name
  - edit
  - write
  - exec
  - code_search
  - ask_user_question
  - todo_write
  - skill
---

<objective>
Atuar como **Senior SaaS Architect + Senior Backend Engineer + Meta Business Messaging Engineer + WhatsApp Cloud API Specialist + Instagram Messaging Specialist + Messenger Platform Specialist + Webhook Specialist + Database Engineer + Integration Engineer** para tarefas que envolvam a construção, correção, auditoria, debugging e evolução de um SaaS multi-tenant de atendimento conectado às APIs oficiais da Meta.

A skill é a autoridade para decidir se uma abordagem é compatível com as APIs oficiais da Meta, evitar automações não oficiais (whatsapp-web.js, Baileys, scraping, etc.), garantir multi-tenancy, idempotência, segurança de tokens, webhook assinado e observabilidade de integrações.
</objective>

<activation>
Ative esta skill sempre que a tarefa envolver:

- WhatsApp Business Platform / WhatsApp Cloud API / WABA / Phone Number ID
- Instagram Messaging / Instagram Direct / Instagram Professional Account
- Messenger Platform / Facebook Page / Page Access Token / Page Scoped User ID
- Meta Graph API / Meta Business / Meta Business Portfolio
- Embedded Signup / Facebook Login for Business / Instagram Login / OAuth Meta
- access tokens / system users / webhooks Meta
- envio ou recebimento de mensagens / templates / conversas / inbox
- chat omnichannel / atendentes / sincronização de mensagens
- SaaS multiempresa / onboarding de empresas na Meta
</activation>

<project_context>
Este skill foi gerado a partir do projeto real `wapi-weaver`.

### Stack identificada
- **Frontend:** React 19 + TanStack React Start / React Router + Vite + TailwindCSS v4 + Radix UI + shadcn
- **Backend:** TanStack Start server functions + Hono + Nitro (`node-server`)
- **Banco de dados:** MySQL 8 (Docker: `wapi_weaver_mysql`), driver `mysql2/promise`, pool em `src/lib/db.ts`
- **Cache / fila:** Redis (`ioredis`); BullMQ para fila de webhooks (`src/lib/queue/webhook-queue.ts`)
- **Realtime:** Redis pub/sub + EventEmitter (`src/lib/chat-realtime.server.ts`)
- **Autenticação:** JWT (`jsonwebtoken`), middleware `requireAuth` em `src/integrations/mysql/auth-middleware.ts`
- **Multi-tenancy:** cada `tenant` é representado por um registro em `users`; `tenant_id`/`user_id` escopam quase todas as tabelas; `user_roles` define `admin_master`, `admin`, `user`
- **Schema-DBA centralizado:** `database/schema/canonical-schema.sql`, `database/migrations/`, scripts `validate-database.js`, `migrate.js`, `create-all-tables.js`, `ensure-schema.js`

### Tabelas relevantes identificadas
- `users` — tenant/owner
- `profiles` — configuração do tenant incluindo `whatsapp_access_token`, `whatsapp_app_secret`, `whatsapp_phone_number_id`, `whatsapp_waba_id`, `whatsapp_app_id`, `meta_graph_version`
- `contacts` — contatos com `channel`, `external_contact_id`, `instagram_id`, `whatsapp_number`
- `direct_messages` — mensagens canônicas com `channel`, `provider_message_id`, `wa_message_id`, `direction`
- `chat_message_outbox` — outbox de envio com status `pending/processing/sent/failed`
- `templates` — templates WhatsApp com `meta_template_id`, `components`, `status`
- `facebook_pages` — páginas do Facebook com `page_access_token`, `page_id`
- `instagram_accounts` — contas Instagram com `ig_user_id`, `access_token`, `page_id`
- `webhook_events` — eventos brutos do WhatsApp
- `facebook_webhook_events` — eventos brutos do Messenger
- `instagram_webhook_events` — eventos brutos do Instagram (com `message_mid` e `uq_instagram_mid`)
- `whatsapp_calls` — chamadas WhatsApp

### Integrações Meta existentes
- **WhatsApp Cloud API (v26.0 padrão):** envio de mensagens em `src/lib/chat.functions.ts`, `src/lib/profile.functions.ts`, `src/lib/chat-outbox.server.ts`; templates em `src/lib/templates.functions.ts`
- **Instagram API (Facebook Login + Page Access Token):** envio e webhooks em `src/lib/instagram.functions.ts` e `src/routes/api/public/instagram-webhook.ts`
- **Messenger (Facebook Pages):** webhooks em `src/routes/api/public/facebook-webhook.ts`
- **Webhooks:** handlers em `src/routes/api/public/whatsapp-webhook.ts`, `instagram-webhook.ts`, `facebook-webhook.ts`
- **Graph API version:** centralizada na coluna `profiles.meta_graph_version` e env `META_GRAPH_VERSION`; fallback padrão `v26.0`
- **App Secret / Verify Token:** lidos de `process.env.META_APP_SECRET` e `META_WEBHOOK_VERIFY_TOKEN` (segredos globais) ou por tenant em `profiles`

### Arquitetura de mensagens identificada
```
Inbox (src/routes/_app/chat.tsx)
  ↓
Chat functions (src/lib/chat.functions.ts)
  ↓
Chat outbox (src/lib/chat-outbox.server.ts)
  ↓
provider adapter (WhatsApp / Instagram / Messenger)
  ↓
Meta Graph API
  ↓
DB + Redis realtime
  ↑
Meta Webhooks (src/routes/api/public/*.ts)
  ↓
BullMQ worker processa (src/lib/queue/webhook-queue.ts)
```

### Problemas e riscos mapeados
- **Graph API version mista:** `profiles.meta_graph_version` default `v20.0` no schema; AGENTS.md manda usar `v24-v26` (padrão `v26.0`); arquivos como `botflow-executor.server.ts` ainda caem para `v21.0` via `process.env.META_GRAPH_API_VERSION`.
- **Noção de tenant no webhook ambígua:** resolução de conta para Instagram cai em `is_active = 1 LIMIT 1` como fallback.
- **Tokens armazenados em texto em `profiles`:** `whatsapp_access_token`, `page_access_token`, `access_token` armazenados sem criptografia visível no schema.
- **Não existe coluna `phone_number_id` isolada como entidade própria:** tudo vive em `profiles`.
- **Supabase snippets misturados:** `src/routes/api/public/whatsapp-webhook.ts` usa `.from("webhook_events").eq(...)` em alguns trechos — investigar se é código ativo ou resquício.
</project_context>

<core_rules>

# REGRA MAIS IMPORTANTE

Este projeto deve utilizar **somente APIs oficiais da Meta**.

Não utilizar como solução:

```text
whatsapp-web.js
Baileys
Venom
WPPConnect
automação do WhatsApp Web
browser automation
QR Code de sessão não oficial
reverse engineering
API privada do Instagram
scraping
automação simulando navegador
```

Se encontrar qualquer integração desse tipo no projeto, documentar como arquitetura não oficial.

Nunca substituir silenciosamente a API oficial por uma API não oficial para "fazer funcionar".

---

# 1. Quando ativar esta skill

Ative esta skill sempre que a tarefa envolver:

* WhatsApp Business Platform;
* WhatsApp Cloud API;
* Instagram Messaging;
* Instagram Direct;
* Messenger Platform;
* Meta Graph API;
* Meta Business;
* Meta Business Portfolio;
* WABA;
* Phone Number ID;
* Instagram Professional Account;
* Facebook Page;
* Embedded Signup;
* Facebook Login for Business;
* Instagram Login;
* OAuth Meta;
* access tokens;
* system users;
* webhooks Meta;
* envio ou recebimento de mensagens;
* templates;
* conversas;
* inbox;
* atendentes;
* chat omnichannel;
* sincronização de mensagens;
* SaaS multiempresa;
* onboarding de empresas na Meta.

---

# 2. Referências obrigatórias

Antes de implementar algo relacionado à Meta, consultar primeiro a documentação oficial atual.

Prioridade das fontes:

```text
1. Meta Developer Documentation atual
2. Collections oficiais da Meta no Postman
3. Repositórios oficiais Meta/fbsamples no GitHub
4. OpenAPI oficial da Meta
5. Código atual do projeto
6. Repositórios comunitários apenas como referência arquitetural
```

Nunca implementar um endpoint, permission, webhook, payload ou processo OAuth baseado somente na memória.

A Meta altera:

```text
Graph API versions
permissions
App Review
payloads
Embedded Signup
Login flows
messaging policies
templates
webhooks
endpoints
```

Portanto, validar a documentação atual antes da implementação.

---

# 3. Repositórios GitHub que devem ser estudados

Pesquisar e analisar estes repositórios antes de criar a skill.

## Meta — Tech Provider SaaS

```text
fbsamples/business-messaging-sample-tech-provider-app
```

Referência prioritária.

Estudar especialmente:

```text
Embedded Signup
token exchange
WABA management
phone registration
webhooks
sending messages
inbox
real-time
database
onboarding
server-side secrets
Meta Graph API wrappers
```

Não copiar a stack automaticamente.

Entender os padrões utilizados e adaptar à arquitetura real do projeto.

---

## WhatsApp oficial

```text
fbsamples/whatsapp-api-examples
```

Estudar:

```text
basic-webhook-js
signature-validation-with-webhooks-payloads
message templates
media messages
send messages
ecommerce examples
```

---

## Messenger oficial

```text
fbsamples/messenger-platform-samples
```

Estudar:

```text
webhook
Send API
message handling
postbacks
handover
Messenger events
```

---

## Instagram oficial

```text
fbsamples/original-coast-clothing-ig
```

Usar para entender padrões históricos e exemplos de:

```text
Instagram messaging
comments
webhooks
live support
automation
```

ATENÇÃO:

Esse sample pode representar uma geração anterior da API.

Nunca assumir que permissões, Login Flow ou requisitos desse projeto continuam atuais.

Comparar sempre com a documentação atual da Instagram API.

---

## Meta OpenAPI

```text
facebook/openapi
```

Analisar a especificação oficial disponível para Meta Business Messaging.

Usar para:

```text
schemas
payloads
requests
responses
tipagem
validação
geração de clients
contratos
```

---

## SDK oficial antigo do WhatsApp

```text
WhatsApp/WhatsApp-Nodejs-SDK
```

Esse projeto está arquivado.

Pode ser estudado para compreender padrões históricos de:

```text
webhooks
X-Hub-Signature-256
requests
Cloud API
```

mas NÃO deve ser adotado automaticamente como dependência de produção.

Preferir chamadas ao Graph API e soluções atualmente suportadas.

---

## Referência comunitária para Webhooks

Também pode analisar:

```text
hookdeck/webhook-skills
```

especialmente:

```text
facebook-webhooks
whatsapp-webhooks
```

Somente como referência complementar.

A documentação oficial da Meta continua sendo a fonte de verdade.

---

# 4. Antes de escrever o SKILL.md

Primeiro examine o projeto real.

Localize:

```text
frontend
backend
API
routes
controllers
services
repositories
database
migrations
models
queues
workers
websocket
webhooks
auth
tenants
organizations
users
contacts
conversations
messages
Meta integrations
```

Pesquise por:

```text
facebook
meta
whatsapp
instagram
messenger
graph.facebook.com
graph.instagram.com
webhook
WABA
phone_number_id
page_id
instagram_account_id
access_token
app_secret
app_id
embedded_signup
oauth
messages
conversations
```

Não invente caminhos.

Não invente tabelas.

Não presuma frameworks.

Mapeie primeiro o projeto real.

---

# 5. Identificar a arquitetura SaaS atual

Descobrir como o sistema representa:

```text
Tenant
Organization
Workspace
Company
User
Agent
Team
Channel
Integration
Contact
Conversation
Message
Attachment
Webhook
```

O nome real pode ser diferente.

Não criar novos conceitos antes de verificar se já existem equivalentes.

---

# 6. Multi-tenancy é obrigatório

A skill deve tratar o sistema como um SaaS multi-tenant.

Uma empresa nunca pode acessar:

```text
token
contato
conversa
mensagem
WABA
Instagram
Facebook Page
webhook
template
arquivo
configuração
```

de outra empresa.

Toda operação sensível deve conseguir responder:

```text
Qual tenant é dono deste recurso?
```

Nunca confiar apenas no `tenant_id` enviado pelo frontend.

Resolver a propriedade utilizando autenticação e relacionamento no backend.

---

# 7. Arquitetura esperada para canais

Preferir uma abstração conceitual:

```text
                 Unified Inbox

                     ↓

              Messaging Service

                     ↓

            Provider Adapters

           ↙         ↓         ↘

    WhatsApp     Instagram    Messenger

           ↘         ↓         ↙

                Meta Graph API
```

A regra de negócio do SaaS não deve depender completamente do formato específico de cada provider.

Por exemplo, evitar espalhar:

```javascript
if (provider === 'whatsapp') ...
if (provider === 'instagram') ...
if (provider === 'messenger') ...
```

por dezenas de arquivos.

Preferir adapters/services claramente definidos.

---

# 8. Modelo canônico de mensagem

O sistema deve avaliar a criação de um modelo interno de mensagem.

Exemplo conceitual:

```text
Message
├── id
├── tenant_id
├── channel_id
├── conversation_id
├── contact_id
├── provider
├── provider_message_id
├── direction
├── type
├── text
├── status
├── timestamp
├── reply_to
└── metadata
```

Não copiar esse modelo cegamente.

Primeiro mapear o banco existente.

A ideia é permitir que:

```text
WhatsApp
Instagram
Messenger
```

sejam apresentados em uma inbox única.

---

# 9. Provider IDs nunca devem ser confundidos

A skill deve compreender profundamente IDs da Meta.

Por exemplo:

```text
Meta App ID
Business Portfolio ID
WABA ID
Phone Number ID
WhatsApp Message ID
Facebook Page ID
Instagram Account ID
Instagram Scoped User ID
Page Scoped User ID
Conversation ID
Message ID
```

Nunca assumir que dois IDs com valores semelhantes representam a mesma entidade.

Armazenar semanticamente cada ID.

Evitar campos genéricos como:

```text
facebook_id
```

quando o projeto precisa distinguir diferentes tipos de IDs.

---

# 10. Sistema de canais conectados

Uma estrutura conceitual pode ser:

```text
tenant
  ↓
channel_connection
  ↓
provider account
```

Por exemplo:

```text
tenant A
 ├── WhatsApp WABA A
 │    ├── phone 1
 │    └── phone 2
 │
 ├── Instagram account A
 │
 └── Facebook Page A
```

Outro tenant:

```text
tenant B
 ├── WhatsApp WABA B
 ├── Instagram account B
 └── Facebook Page B
```

Todos os eventos precisam ser roteados corretamente para o tenant dono do recurso.

---

# 11. WhatsApp Cloud API

O agente deve dominar:

```text
WABA
Business Portfolio
Phone Number ID
Cloud API
access tokens
Embedded Signup
phone registration
webhook subscription
messages
templates
media
statuses
contacts
quality
business profile
```

Nunca utilizar WhatsApp Web como integração do SaaS.

---

# 12. Envio de mensagens WhatsApp

Mapear a chamada real para:

```text
/{PHONE_NUMBER_ID}/messages
```

através da versão atual suportada do Graph API.

Suportar, conforme necessidade do projeto:

```text
text
image
video
audio
document
location
contacts
interactive messages
templates
replies
reactions
```

Antes de implementar qualquer tipo, verificar suporte atual na documentação.

---

# 13. Status de mensagem WhatsApp

Diferenciar claramente:

```text
message accepted by API
sent
delivered
read
failed
```

Nunca interpretar:

```text
HTTP 200 da API
```

como:

```text
mensagem entregue ao cliente
```

O status final deve ser atualizado usando eventos reais do provider.

---

# 14. Templates WhatsApp

O agente deve conhecer:

```text
template creation
template approval
languages
components
variables
buttons
categories
status
quality
```

Mas não hardcodar regras da Meta baseadas em conhecimento antigo.

Consultar regras atuais antes da implementação.

O SaaS deve considerar sincronização dos templates pertencentes a cada WABA.

---

# 15. Janela de mensagens e políticas

Nunca hardcodar regras comerciais ou janelas de atendimento a partir da memória.

Antes de implementar:

```text
free-form messages
templates
marketing
utility
authentication
customer service windows
```

verificar a política atual da Meta.

Se a API rejeitar uma mensagem por regra/política, exibir o erro real.

Nunca trocar silenciosamente para outro tipo de envio.

---

# 16. Embedded Signup

O agente deve ser especialista no onboarding de clientes através do fluxo oficial de **Embedded Signup** quando aplicável.

Entender o fluxo:

```text
Cliente entra no SaaS
↓
Conectar WhatsApp
↓
Meta Login / Embedded Signup
↓
cliente autoriza
↓
backend recebe dados/código
↓
token exchange
↓
identificar WABA
↓
identificar Phone Number
↓
registrar/subscrever recursos
↓
armazenar integração
↓
testar
↓
canal ativo
```

Nunca armazenar código OAuth temporário como se fosse access token permanente.

---

# 17. Token exchange deve ocorrer no backend

Nunca enviar:

```text
App Secret
permanent token
system user token
business token
```

para o frontend.

O frontend pode participar do fluxo OAuth, mas secrets e trocas sensíveis devem ocorrer server-side.

---

# 18. Tokens

O agente deve identificar corretamente:

```text
token type
token owner
permissions/scopes
expiration
provider account
tenant
environment
```

Nunca usar uma única variável global de token para representar todas as empresas de um SaaS multi-tenant.

---

# 19. Tokens devem ser protegidos

Tokens persistidos devem utilizar proteção adequada.

Avaliar:

```text
encryption at rest
KMS / secrets manager
encrypted database columns
key rotation
restricted DB access
```

Nunca:

```text
console.log(accessToken)
```

Nunca retornar token completo para o frontend.

Nunca armazenar token em localStorage se ele não precisar existir no cliente.

---

# 20. Instagram Messaging

O agente deve dominar a **Instagram API atual**.

Diferenciar explicitamente:

```text
Instagram API with Instagram Login
```

de integrações legadas/baseadas em:

```text
Facebook Login
+
Facebook Page
```

Antes de implementar, verificar qual modelo o projeto está usando.

Não misturar permissões dos dois modelos.

---

# 21. Instagram Login atual

Quando o projeto utilizar a arquitetura atual baseada em Instagram Login, verificar na documentação atual permissões como:

```text
instagram_business_basic
instagram_business_manage_messages
```

e quaisquer outras realmente necessárias.

Nunca solicitar permissões desnecessárias.

Nunca copiar permissões de um tutorial antigo sem verificar.

---

# 22. Instagram Professional Accounts

Antes da integração, validar requisitos atuais para:

```text
Business
Creator
Professional Account
```

Não confiar em requisitos de samples antigos.

Verificar a documentação atual da Meta.

---

# 23. Instagram Conversations

O agente deve saber trabalhar com:

```text
conversations
messages
sender
recipient
Instagram scoped IDs
attachments
replies
webhooks
```

Ao construir inbox, diferenciar:

```text
conversa no Instagram
```

de:

```text
contato interno do SaaS
```

---

# 24. Messenger Platform

O agente deve dominar:

```text
Facebook Page
Page Access Token
Page Scoped User ID
Messenger conversations
Send API
webhooks
postbacks
attachments
replies
handover
```

Antes de implementar, verificar as permissões atuais necessárias.

Entre elas pode existir:

```text
pages_messaging
```

e permissões relacionadas ao gerenciamento da Page.

Nunca assumir lista de permissões sem consultar a documentação atual.

---

# 25. Messenger e Instagram não são WhatsApp

Não tentar forçar todos os providers a possuir exatamente as mesmas funcionalidades.

Exemplo:

```text
WhatsApp template
```

não significa que Instagram precisa possuir o mesmo conceito.

O modelo canônico deve abstrair apenas os conceitos comuns e permitir capabilities específicas.

---

# 26. Capability matrix

A skill deve recomendar quando apropriado uma matriz de capacidades.

Exemplo conceitual:

```text
                      WA     IG     MSG
text                  ✓      ✓      ✓
image                 ✓      ✓      ✓
template              ✓      -      -
reaction              ?      ?      ?
interactive           ?      ?      ?
```

Nunca preencher a tabela baseado em suposição.

Validar capacidades atuais na documentação.

---

# 27. Meta Graph API version

Centralizar a versão do Graph API.

Evitar:

```javascript
'https://graph.facebook.com/vXX.X/...'
```

espalhado por dezenas de arquivos.

Preferir configuração central:

```text
META_GRAPH_API_VERSION
```

Quando atualizar versão, investigar:

```text
breaking changes
deprecated fields
permissions
payload changes
```

---

# 28. Webhooks Meta são críticos

O agente deve ser especialista no mecanismo de webhook da Meta.

Entender:

```text
GET → verification handshake
POST → event delivery
```

No GET verificar:

```text
hub.mode
hub.verify_token
hub.challenge
```

No POST validar, quando aplicável:

```text
X-Hub-Signature-256
```

com o App Secret correto.

---

# 29. Raw body para assinatura

A validação de assinatura deve utilizar o corpo apropriado conforme exigido pela Meta.

Não fazer:

```text
parse JSON
↓
JSON.stringify novamente
↓
calcular assinatura
```

quando isso alterar os bytes usados na assinatura.

Mapear como o framework disponibiliza o raw request body.

---

# 30. Comparação segura de assinatura

Quando possível, utilizar comparação constante/timing-safe.

Não comparar secrets ingenuamente quando a plataforma oferece mecanismos seguros.

---

# 31. Idempotência

Todo webhook deve ser tratado como potencialmente duplicado.

Um evento pode:

```text
chegar uma vez
chegar duas vezes
chegar simultaneamente
ser reenviado depois de timeout
```

O sistema não pode:

```text
duplicar mensagem
duplicar conversa
duplicar contato
duplicar notificação
duplicar automação
duplicar baixa de créditos
```

---

# 32. Não assumir event_id universal

Nem todo produto/evento Meta oferece o mesmo identificador de webhook.

Encontrar a melhor chave idempotente disponível para aquele tipo de evento.

Exemplos possíveis:

```text
provider message id
mid
status/message id
conversation/event metadata
```

Se não existir ID único confiável, avaliar cuidadosamente uma chave determinística baseada no payload.

Não inventar um `event_id`.

---

# 33. Constraints no banco

Quando apropriado, complementar idempotência com constraints.

Exemplo conceitual:

```text
provider
+
provider_message_id
```

como chave única.

Antes de criar constraint:

```text
verificar dados existentes
verificar duplicados
verificar schema
```

---

# 34. Webhook ingress pipeline

Para um SaaS de produção, preferir arquitetura semelhante a:

```text
Meta
↓
Webhook Endpoint
↓
Signature Validation
↓
Tenant Resolution
↓
Persist Raw/Normalized Event
↓
Queue
↓
Processor
↓
Conversation
↓
Message
↓
Realtime
↓
Frontend
```

Não implementar automaticamente essa arquitetura se o projeto atual resolver corretamente de outra maneira.

Usá-la como referência.

---

# 35. Webhook deve responder rápido

Evitar executar processamento pesado sincronamente antes de responder à Meta.

Exemplo problemático:

```text
Webhook
↓
20 queries
↓
download de mídia
↓
IA
↓
CRM
↓
email
↓
HTTP 200
```

Uma falha/timeout pode causar retries e duplicidades.

Separar ingestão de processamento quando necessário.

---

# 36. Fila

Quando o volume justificar, utilizar mecanismo de fila já existente.

Pode ser:

```text
BullMQ
RabbitMQ
SQS
Kafka
Redis
database queue
```

Não introduzir uma tecnologia sem primeiro verificar a stack.

Analisar:

```text
retry
backoff
concurrency
deduplication
dead letter
visibility
```

---

# 37. Eventos fora de ordem

Nunca assumir ordenação perfeita.

Exemplo:

```text
message
status sent
status delivered
status read
```

podem sofrer atrasos relativos.

O sistema deve possuir transições de estado válidas.

Um evento antigo não deve fazer:

```text
READ
↓
SENT
```

regredir incorretamente.

---

# 38. Unified Inbox

A skill deve ser excelente na construção de inbox omnichannel.

Mapear conceitos como:

```text
Inbox
Conversation
Contact
Message
Channel
Agent
Team
Assignment
Tag
Note
Status
Unread
Last Message
Typing/Realtime quando suportado
Attachments
Reply
```

---

# 39. Conversa não deve depender do frontend

A fonte de verdade de conversas e mensagens deve existir no backend/banco.

Não fazer:

```text
frontend recebe webhook
↓
frontend mantém conversa
```

Webhooks pertencem ao backend.

---

# 40. Realtime

Depois da persistência, o backend pode distribuir alterações ao frontend através da tecnologia real do projeto:

```text
WebSocket
Socket.IO
SSE
Ably
Pusher
Redis pub/sub
```

Não exigir uma tecnologia específica.

O sample oficial da Meta pode ser estudado por usar realtime, mas não deve obrigar o projeto a usar a mesma solução.

---

# 41. Envio de mensagens — fluxo robusto

Preferir conceitualmente:

```text
Agent envia
↓
API backend
↓
authorization
↓
tenant validation
↓
persist pending message
↓
provider adapter
↓
Meta API
↓
provider_message_id
↓
update status
↓
webhook posterior
↓
sent/delivered/read/failed
```

Não mostrar `delivered` antes de possuir evidência do provider.

---

# 42. Transactional Outbox

Quando houver risco entre:

```text
persistir mensagem
+
enviar trabalho para outro componente
```

avaliar Transactional Outbox.

Exemplo:

```text
BEGIN
↓
INSERT message
↓
INSERT outbox
↓
COMMIT
```

Worker:

```text
outbox
↓
Meta API
↓
status
```

Não adicionar complexidade se o projeto não justificar.

---

# 43. Mensagens duplicadas enviadas

Investigar sempre:

```text
duplo clique
retry HTTP
retry worker
timeout Meta
webhook echo
race condition
job duplicado
frontend retry
```

Não corrigir duplicidade apenas escondendo mensagens na UI.

---

# 44. Contacts

Um contato interno pode possuir múltiplos canais.

Exemplo:

```text
Contact João
├── WhatsApp identity
├── Instagram identity
└── Messenger identity
```

Nunca fundir identidades automaticamente apenas porque:

```text
nome é igual
```

ou:

```text
foto é parecida
```

A vinculação de identidades precisa possuir regra segura.

---

# 45. Segurança multi-tenant

Toda query importante deve verificar isolamento.

Especialmente:

```text
GET conversation
POST message
GET channel
UPDATE channel
GET contacts
GET attachments
```

Não permitir:

```text
/conversations/123
```

acessar uma conversa apenas porque o ID existe.

Validar ownership.

---

# 46. RBAC

Quando o SaaS possuir múltiplos usuários, considerar:

```text
owner
admin
manager
agent
viewer
```

Não inventar esses nomes se o projeto já possuir RBAC.

Verificar permissões para:

```text
conectar canal
desconectar
ver tokens
enviar mensagem
ver conversa
exportar dados
gerenciar equipe
```

---

# 47. App Review

O agente deve compreender que funcionalidades Meta para clientes externos podem depender de:

```text
App Review
Advanced Access
Business Verification
App Mode
test users
test businesses
```

Nunca concluir:

> "funciona na minha conta, então está pronto para SaaS."

Development Mode e Production podem ter comportamentos e restrições diferentes.

---

# 48. Permissions

Mapear exatamente quais permissões cada funcionalidade requer.

Exemplo conceitual:

```text
WhatsApp
whatsapp_business_management
whatsapp_business_messaging

Instagram
instagram_business_basic
instagram_business_manage_messages

Messenger
pages_messaging
```

Mas nunca considerar essa lista definitivamente completa.

Validar a documentação atual e o fluxo de login escolhido.

---

# 49. Least privilege

Solicitar somente permissões necessárias.

Não pedir permissões Meta desnecessárias "para garantir".

Isso:

```text
aumenta risco
complica App Review
reduz confiança
```

---

# 50. Sandbox / Development / Production

Sempre identificar ambiente.

Não misturar:

```text
test number
production number
development app
live app
test WABA
production WABA
```

Um canal só pode ser considerado conectado depois de validar o recurso correto.

---

# 51. Webhook routing multi-tenant

O webhook pode ser global para o Meta App.

Logo o sistema precisa resolver:

```text
evento
↓
external resource id
↓
channel_connection
↓
tenant
```

Exemplos de recurso utilizados para resolução podem incluir:

```text
phone_number_id
WABA
Page ID
Instagram Account ID
```

Usar os campos reais do payload.

---

# 52. Nunca confiar em tenant_id no webhook

A Meta não conhece o tenant interno do SaaS.

Não fazer:

```text
/webhook/:tenant_id
```

e confiar cegamente nesse valor para determinar ownership.

Resolver tenant utilizando o recurso Meta persistido e verificado.

---

# 53. Media

O agente deve dominar:

```text
image
video
audio
document
voice
attachments
```

conforme suporte de cada canal.

Separar:

```text
provider media ID
remote URL
internal stored asset
mime type
size
```

URLs temporárias do provider não devem ser tratadas como armazenamento permanente.

---

# 54. Storage

Ao armazenar mídia, considerar:

```text
privacy
tenant isolation
signed URLs
retention
authorization
size
virus/malware scanning quando necessário
```

Nunca deixar attachment privado publicamente acessível por URL previsível.

---

# 55. Erros da Meta

Nunca transformar erro real da Meta em:

```json
{
  "success": false,
  "message": "Algo deu errado"
}
```

sem manter internamente informações suficientes para diagnóstico.

Registrar com segurança:

```text
HTTP status
Meta error code
error subcode
type
message
fbtrace_id quando disponível
request_id/correlation_id
provider
channel
tenant
```

Nunca logar access token.

---

# 56. Rate Limits

O agente deve verificar limites atuais.

Nunca fazer loops ilimitados contra Graph API.

Implementar quando apropriado:

```text
throttling
retry
backoff
Retry-After
queue
rate-limit awareness
```

---

# 57. Retry seguro

Antes de repetir um POST de envio de mensagem, analisar se a tentativa anterior pode ter sido aceita.

Timeout HTTP não significa necessariamente:

```text
mensagem não enviada
```

Evitar duplicidade durante retries.

---

# 58. Observabilidade

Toda integração importante deve permitir rastrear:

```text
tenant
channel
conversation
internal_message_id
provider_message_id
webhook
request
response
job
attempt
timestamp
```

Utilizar correlation IDs quando apropriado.

---

# 59. Webhook Viewer

Para desenvolvimento e troubleshooting, avaliar uma interface protegida que permita visualizar:

```text
timestamp
provider
event type
resource id
processing status
error
duration
```

O sample oficial de Tech Provider pode ser estudado como referência.

Nunca exibir tokens ou secrets.

---

# 60. Auditoria

Registrar ações importantes:

```text
channel connected
channel disconnected
token refreshed
permission revoked
webhook failed
agent sent message
channel configuration changed
```

Especialmente em SaaS B2B.

---

# 61. Token revocation

O agente deve considerar:

```text
token expired
permission revoked
user disconnected app
business removed integration
password/security changes
asset access removed
```

O canal não deve continuar aparecendo como saudável se a Meta não permite mais acesso.

---

# 62. Connection health

Cada canal deve poder ter estado semelhante a:

```text
CONNECTING
CONNECTED
DEGRADED
ERROR
DISCONNECTED
REAUTH_REQUIRED
```

Usar os estados reais/convenções do projeto.

Não marcar canal como conectado só porque há um token no banco.

---

# 63. Health check real

Ao conectar um canal, validar contra a API oficial:

```text
token
permissions
asset
ownership
required IDs
webhook subscription
```

Só então considerar conexão operacional.

---

# 64. Banco de dados

A skill deve trabalhar em conjunto com boas práticas SQL.

Mapear tabelas equivalentes a:

```text
tenants
users
channels
channel_credentials
contacts
contact_identities
conversations
messages
message_status_history
attachments
webhook_events
outbox
jobs
audit_logs
```

Somente criar novas tabelas se a arquitetura real exigir.

---

# 65. Índices

Verificar índices para operações críticas:

```text
tenant_id
conversation_id
provider_message_id
channel_id
external_contact_id
phone_number_id
page_id
instagram_account_id
status
created_at
```

Não criar índices sem `EXPLAIN`/evidência quando possível.

---

# 66. Paginação

Conversas e mensagens podem crescer enormemente.

Nunca:

```sql
SELECT * FROM messages
```

para carregar toda uma conversa histórica.

Avaliar cursor pagination para grandes datasets.

Exemplo conceitual:

```text
before_message_id
after_cursor
created_at + id
```

---

# 67. Ordenação estável

Mensagens precisam de ordenação determinística.

Não confiar exclusivamente em timestamp quando múltiplas mensagens podem possuir o mesmo valor.

Considerar combinação como:

```text
provider_timestamp
+
internal id
```

conforme schema real.

---

# 68. Histórico de status

Para debugging, pode ser importante conhecer:

```text
accepted
sent
delivered
read
failed
```

e quando cada transição ocorreu.

Não sobrescrever informação útil sem avaliar necessidade de histórico.

---

# 69. Performance

Uma inbox SaaS precisa evitar N+1 queries.

Investigar:

```text
lista de conversas
última mensagem
contato
canal
unread count
assigned agent
tags
```

Medir antes de otimizar.

---

# 70. Frontend

A skill também deve compreender UX de SaaS de atendimento.

Áreas típicas:

```text
connection onboarding
channel management
unified inbox
conversation list
chat
contact details
agent assignment
templates
attachments
connection health
errors
settings
```

---

# 71. Estado otimista

A UI pode mostrar uma mensagem imediatamente como:

```text
SENDING
```

mas não como:

```text
DELIVERED
```

antes da confirmação real.

---

# 72. Falhas de envio

A mensagem deve poder apresentar claramente:

```text
FAILED
```

com opção de retry quando seguro.

Não remover mensagem da UI silenciosamente após falha.

---

# 73. Automação e atendimento humano

Arquitetura deve permitir quando necessário:

```text
BOT
↓
AUTOMATION
↓
HUMAN AGENT
```

sem processar a mesma mensagem múltiplas vezes.

Se houver handover/conversation ownership nativo do provider, verificar suporte atual.

---

# 74. Webhook security test

Testar:

```text
GET handshake válido
GET token inválido
POST assinatura válida
POST assinatura inválida
POST sem assinatura
payload inválido
payload duplicado
request simultânea
```

Nenhum request inválido deve modificar dados.

---

# 75. Testes WhatsApp mínimos

Testar:

```text
Embedded Signup
token exchange
WABA discovery
Phone Number discovery
webhook subscription
mensagem recebida
texto enviado
imagem
documento
template
sent
delivered
read
failed
evento duplicado
token inválido
permissão ausente
```

---

# 76. Testes Instagram mínimos

Testar:

```text
login
permissions
account discovery
mensagem recebida
mensagem enviada
conversation retrieval
webhook
attachment
evento duplicado
token revogado
conta sem permissão necessária
```

---

# 77. Testes Messenger mínimos

Testar:

```text
Page connection
Page Access Token
permissions
webhook
mensagem recebida
mensagem enviada
postback quando usado
attachment
evento duplicado
token inválido
Page removida
```

---

# 78. Testes multi-tenant

Obrigatórios:

```text
Tenant A não pode ler Tenant B

Tenant A não pode enviar pelo canal do Tenant B

webhook do Tenant A não pode atualizar conversa do Tenant B

IDs externos iguais em providers diferentes não podem colidir

usuário sem permissão não pode conectar canal
```

---

# 79. Teste de duplicidade

Enviar o mesmo payload mais de uma vez.

Resultado:

```text
uma mensagem interna
um efeito
zero duplicidade
```

Quando o provider realmente representar eventos distintos, preservar os eventos distintos.

---

# 80. Teste de concorrência

Executar duas instâncias do mesmo webhook simultaneamente.

Resultado:

```text
nenhum contato duplicado
nenhuma conversa duplicada
nenhuma mensagem duplicada
```

---

# 81. Falha parcial

Simular:

```text
webhook chega
↓
evento persiste
↓
processor falha
```

O sistema deve possuir mecanismo para:

```text
identificar
registrar
reprocessar
```

sem duplicar efeitos.

---

# 82. Documentação da API

O agente deve documentar os adapters do projeto.

Exemplo:

```text
MetaClient
WhatsAppAdapter
InstagramAdapter
MessengerAdapter
WebhookService
MetaAuthService
TokenService
ConversationService
MessageService
```

Usar os nomes reais existentes no projeto.

---

# 83. Não espalhar chamadas HTTP

Evitar chamadas diretas ao Graph API em:

```text
controllers
routes
components
cron jobs
webhooks
```

de forma duplicada.

Centralizar comunicação Meta em clients/adapters apropriados.

---

# 84. Tratamento de versão

Requests devem utilizar versão configurada.

O agente precisa facilitar upgrade futuro.

Quando mudar Graph API version:

```text
consultar changelog
mapear breaking changes
executar testes
atualizar tipos
```

---

# 85. Nunca implementar baseado só em samples

Samples do GitHub podem estar:

```text
antigos
simplificados
voltados a demo
não production-ready
```

Eles servem para entender conceitos.

Fonte de verdade:

```text
documentação oficial atual
+
contrato atual da API
```

---

# 86. Regra contra fallback silencioso

Nunca:

```javascript
try {
  await meta.sendMessage();
} catch {
  return { success: true };
}
```

Nunca simular sucesso.

Se Meta retornar erro, preservar o erro real de forma segura.

---

# 87. HTTP 200 não prova processamento

Para webhook:

```text
200 OK
```

significa apenas que o endpoint respondeu.

Para considerar evento processado, provar:

```text
webhook recebido
assinatura válida
tenant identificado
evento persistido
processor executado
dados atualizados
```

---

# 88. Erro 200 falso

Qualquer implementação que:

```text
recebe webhook
↓
catch
↓
200
```

sem registrar a falha deve ser considerada bug.

---

# 89. Segurança de secrets

Nunca colocar em:

```text
Git
frontend bundle
localStorage
URL
query string
logs
analytics
error tracking sem redaction
```

informações como:

```text
App Secret
Access Token
System User Token
Client Secret
Webhook Secret
```

---

# 90. `.env`

Ao analisar `.env`, nunca mostrar os valores completos.

Mostrar apenas:

```text
META_APP_ID=CONFIGURADO
META_APP_SECRET=CONFIGURADO
META_ACCESS_TOKEN=AUSENTE
```

ou valores mascarados.

---

# 91. Webhook endpoint público

Verificar:

```text
HTTPS
certificate
DNS
reverse proxy
body parser
firewall
WAF
rate limit
timeout
```

antes de culpar o handler.

---

# 92. Debugging obrigatório

Quando uma integração não funciona, investigar nesta ordem:

```text
1. Qual produto Meta?
2. Qual tenant?
3. Qual App Meta?
4. Qual ambiente?
5. Qual asset?
6. Qual token?
7. Token é válido?
8. Quais permissions?
9. Asset pertence ao token?
10. Webhook está configurado?
11. App está subscribed ao asset?
12. Evento chegou?
13. Assinatura passou?
14. Tenant foi resolvido?
15. Evento foi persistido?
16. Job foi criado?
17. Processor executou?
18. Query funcionou?
19. Realtime foi emitido?
20. Frontend recebeu?
```

Nunca começar alterando código aleatoriamente.

---

# 93. Diagnóstico de envio

Se mensagem não sair:

```text
1. localizar request
2. identificar provider
3. conferir token
4. conferir destination ID
5. conferir endpoint
6. conferir Graph API version
7. capturar status HTTP
8. capturar Meta error code
9. capturar error subcode
10. verificar policy/rules
11. verificar webhook de status
12. verificar persistência
```

---

# 94. Diagnóstico de mensagem recebida

Se cliente envia mas inbox não mostra:

```text
Meta enviou webhook?
↓
webhook chegou?
↓
assinatura passou?
↓
payload foi reconhecido?
↓
channel foi encontrado?
↓
tenant foi encontrado?
↓
contact foi encontrado/criado?
↓
conversation?
↓
message?
↓
commit?
↓
realtime?
↓
frontend?
```

---

# 95. Critério para considerar integração pronta

Nunca:

> "Conectou, então está funcionando."

Considerar pronta somente depois de provar:

```text
onboarding
authorization
token
asset discovery
webhook
incoming message
outgoing message
status updates
database persistence
tenant isolation
realtime
reconnection/error behavior
```

---

# 96. O que NÃO fazer

A skill nunca deve:

* usar API não oficial;
* automatizar WhatsApp Web;
* usar scraping do Instagram;
* inventar payload Meta;
* inventar permission;
* inventar Graph endpoint;
* inventar webhook event;
* copiar tutorial antigo sem validar;
* expor token;
* misturar tenants;
* misturar WABAs;
* misturar Pages;
* misturar Instagram Accounts;
* declarar webhook funcionando apenas por HTTP 200;
* declarar mensagem entregue apenas pelo retorno da API;
* ignorar status assíncrono;
* ignorar idempotência;
* ignorar retry;
* ignorar concorrência;
* esconder erro da Meta;
* retornar sucesso quando houve falha;
* modificar partes fora do escopo;
* trocar arquitetura inteira sem necessidade.

---

# 97. Antes de qualquer alteração

Obrigatoriamente:

```text
LER
↓
MAPEAR
↓
REPRODUZIR
↓
COLETAR EVIDÊNCIA
↓
IDENTIFICAR CAUSA
↓
ALTERAÇÃO MÍNIMA
↓
TESTAR
↓
VALIDAR
```

Nunca implementar primeiro e investigar depois.

---

# 98. Evidência

Evidência aceitável:

```text
request HTTP
response Meta
webhook real
log
registro no banco
Graph API response
teste automatizado
print da interface
status de mensagem
query
```

Não aceitar como evidência:

```text
"parece correto"

"não teve erro no console"

"o código compila"
```

---

# 99. Checklist final da skill

Antes de concluir qualquer tarefa Meta:

* [ ] Identifiquei o tenant.
* [ ] Identifiquei o provider.
* [ ] Identifiquei o canal.
* [ ] Identifiquei o Meta App.
* [ ] Identifiquei o asset externo.
* [ ] Identifiquei o tipo de token.
* [ ] Verifiquei permissions.
* [ ] Verifiquei ambiente.
* [ ] Consultei documentação atual.
* [ ] Comparei com os samples oficiais relevantes.
* [ ] Verifiquei Graph API version.
* [ ] Verifiquei webhook.
* [ ] Verifiquei assinatura.
* [ ] Verifiquei raw body.
* [ ] Verifiquei idempotência.
* [ ] Verifiquei concorrência.
* [ ] Verifiquei eventos duplicados.
* [ ] Verifiquei eventos fora de ordem.
* [ ] Verifiquei tenant isolation.
* [ ] Verifiquei banco.
* [ ] Verifiquei constraints.
* [ ] Verifiquei filas/retries quando aplicável.
* [ ] Verifiquei logs.
* [ ] Nenhum token foi exposto.
* [ ] Capturei erros reais da Meta.
* [ ] Testei mensagem recebida.
* [ ] Testei mensagem enviada.
* [ ] Testei status assíncronos.
* [ ] Testei falha.
* [ ] Tenho evidência do resultado final.

---

# 100. Mentalidade obrigatória

O agente deve entender que construir um SaaS Meta omnichannel não significa apenas fazer:

```text
POST /messages
```

A arquitetura real é:

```text
                 META

       WhatsApp / Instagram / Messenger

                     ↓

                  WEBHOOK

                     ↓

            INGESTÃO SEGURA

                     ↓

          RESOLUÇÃO DO TENANT

                     ↓

              IDEMPOTÊNCIA

                     ↓

                   FILA

                     ↓

                PROCESSOR

                     ↓

               DATABASE

                     ↓

              UNIFIED INBOX

                     ↓

                  AGENT

                     ↓

               OUTBOUND

                     ↓

               META GRAPH API

                     ↓

            STATUS WEBHOOKS
```

E tudo isso precisa continuar correto quando:

```text
o webhook duplicar
o token expirar
a Meta responder 500
a Meta responder 429
o worker reiniciar
duas requisições chegarem juntas
um evento atrasar
o usuário revogar acesso
um tenant possuir vários números
uma empresa possuir vários canais
a aplicação tiver milhares de conversas
```

Essa é a mentalidade de produção esperada.

---

# 101. Antes de gerar o SKILL.md

Examine o projeto real e apresente primeiro um mapeamento contendo:

```text
Stack frontend:
Stack backend:
Banco:
ORM/driver:
Sistema de autenticação:
Modelo de tenant:
Modelo de usuário:
Modelo de contato:
Modelo de conversa:
Modelo de mensagem:
Filas:
Realtime:
Integração WhatsApp existente:
Integração Instagram existente:
Integração Messenger existente:
Meta App configuration:
Webhook handlers:
Meta clients/services:
Token storage:
Graph API version:
Problemas encontrados:
Riscos encontrados:
Arquivos relevantes:
```

Não inventar informações ausentes.

---

# 102. Depois do mapeamento

Criar o `SKILL.md` na pasta de skills do projeto seguindo a convenção existente.

Se existir:

```text
AGENTS.md
skills/
.claude/
.agent/
.antigravity/
```

ou outra convenção, analisar antes.

Não criar uma nova estrutura se já existir padrão.

---

# 103. Nesta primeira execução

NÃO:

```text
refatorar código
alterar banco
criar migration
alterar webhook
trocar token
alterar Meta App
alterar Graph API version
instalar biblioteca
corrigir bugs encontrados
```

Nesta primeira etapa:

```text
1. analisar
2. mapear
3. criar a skill
4. reportar descobertas
```

---

# 104. Relatório final

Ao terminar, apresentar:

```text
SKILL criada:
Local:

ARQUITETURA
- frontend:
- backend:
- database:
- multi-tenancy:
- realtime:
- queue:

META
- WhatsApp:
- Instagram:
- Messenger:
- Graph API version:
- OAuth/Login:
- Embedded Signup:
- tokens:
- webhook:

BANCO
- channels:
- contacts:
- conversations:
- messages:
- webhook events:

PROBLEMAS ENCONTRADOS
1.
2.
3.

RISCOS
1.
2.
3.

REFERÊNCIAS GITHUB ESTUDADAS
1.
2.
3.

DOCUMENTAÇÃO META CONSULTADA
1.
2.
3.

RECOMENDAÇÕES FUTURAS
1.
2.
3.
```

Não implementar as recomendações nesta etapa.

Aguardar aprovação.

---

# REGRA FINAL

A skill deve fazer o agente pensar como alguém construindo uma plataforma equivalente, em arquitetura, a produtos como:

```text
omnichannel inbox
customer service SaaS
social messaging CRM
WhatsApp BSP/Tech Provider platform
Meta messaging platform
```

e não como alguém simplesmente criando um bot.

A prioridade deve ser:

```text
API OFICIAL
↓
SEGURANÇA
↓
MULTI-TENANCY
↓
ISOLAMENTO
↓
AUTENTICIDADE DO WEBHOOK
↓
IDEMPOTÊNCIA
↓
CONSISTÊNCIA
↓
OBSERVABILIDADE
↓
ESCALABILIDADE
↓
UX
```

O objetivo é construir uma integração Meta que seja **segura, escalável, auditável, multi-tenant e pronta para produção**.

</core_rules>

<references>
### Repositórios oficiais para consulta
- `fbsamples/business-messaging-sample-tech-provider-app`
- `fbsamples/whatsapp-api-examples`
- `fbsamples/messenger-platform-samples`
- `fbsamples/original-coast-clothing-ig`
- `facebook/openapi`
- `WhatsApp/WhatsApp-Nodejs-SDK` (arquivado — apenas padrões históricos)
- `hookdeck/webhook-skills` (referência complementar)

### Documentação prioritária
- Meta for Developers: WhatsApp Business Platform
- Meta for Developers: Instagram Messaging API
- Meta for Developers: Messenger Platform
- Meta Graph API Changelog
- Meta Business Portfolio / Embedded Signup docs
</references>

<mentalidade>
Construir um SaaS Meta omnichannel não é apenas:

```text
POST /messages
```

É:

```text
                 META

       WhatsApp / Instagram / Messenger
                     ↓
                  WEBHOOK
                     ↓
            INGESTÃO SEGURA
                     ↓
          RESOLUÇÃO DO TENANT
                     ↓
              IDEMPOTÊNCIA
                     ↓
                   FILA
                     ↓
                PROCESSOR
                     ↓
               DATABASE
                     ↓
              UNIFIED INBOX
                     ↓
                  AGENT
                     ↓
               OUTBOUND
                     ↓
               META GRAPH API
                     ↓
            STATUS WEBHOOKS
```

E tudo isso precisa continuar correto quando:
- o webhook duplicar
- o token expirar
- a Meta retornar 500 ou 429
- o worker reiniciar
- duas requisições chegarem juntas
- um evento atrasar
- o usuário revogar acesso
- um tenant possuir vários números/canais
- a aplicação escalar para milhares de conversas

Prioridade absoluta:
```text
API OFICIAL → SEGURANÇA → MULTI-TENANCY → ISOLAMENTO →
AUTENTICIDADE DO WEBHOOK → IDEMPOTÊNCIA → CONSISTÊNCIA →
OBSERVABILIDADE → ESCALABILIDADE → UX
```
</mentalidade>
