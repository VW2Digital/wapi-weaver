# CRM Universal Contact/Lead — Schema & Code Audit Report

**Projeto:** wapi-weaver  
**Baseline funcional:** `72cc7ff` (omnichannel freeze ativo)  
**Guard:** `npm run guard:omnichannel` = PASS  
**Data:** audit gerado a partir do estado atual do repo  

---

## 1. Resumo Executivo

O modelo de `contacts` do projeto evoluiu de um CRM telefone-centrico (WhatsApp) para uma visão omnichannel (WhatsApp, Instagram, Messenger, WebChat). A transição ainda está **incompleta**: `contacts.phone_e164` continua sendo usado ao mesmo tempo como (a) chave primária de lookup, (b) thread de mensagens (`direct_messages.contact_phone`) e (c) identidade de provider para Instagram/Messenger/WebChat. Isso gera gaps claros na página de detalhes e lista de contatos para canais sem número real, além de `drift` entre `canonical-schema.sql` e as migrations aplicadas.

O trabalho recente de WebChat já corrigiu o armazenamento do pre-chat: nome, e-mail e telefone do visitante são salvos em `contacts.name`/`email` e `contacts.whatsapp_number` (telefone) / `custom_fields`, mantendo `contacts.phone_e164 = NULL` para evitar conflito com WhatsApp. O Inbox (`src/routes/_app/chat.tsx`) já foi ajustado para renderizar o telefone via `getDisplayPhone`. Porém, **as rotas de CRM (`contacts.index.tsx`, `contacts.$id.tsx`) e `getContactDetail` ainda não sabem lidar com `phone_e164 = NULL`**, o que gera bugs de exibição e busca.

---

## 2. Modelo de Dados — `contacts`

### 2.1 Tabela principal

`database/schema/canonical-schema.sql` (linhas 608-654):

```sql
CREATE TABLE IF NOT EXISTS `contacts` (
  `id` varchar(36) ... NOT NULL,
  `tenant_id` varchar(36) ... NOT NULL,
  `user_id` varchar(36) ... NOT NULL,
  `phone_e164` varchar(50) ... NOT NULL,   -- migration 054 tornou NULL
  `name` varchar(255) ... DEFAULT NULL,
  `email` varchar(255) ... DEFAULT NULL,
  `source` varchar(255) ... DEFAULT NULL,
  `opted_out` tinyint(1) NOT NULL DEFAULT '0',
  `custom_fields` json DEFAULT NULL,
  ...
  `company` varchar(255) ... DEFAULT NULL,
  `position` varchar(255) ... DEFAULT NULL,
  `normalized_phone` varchar(50) ... DEFAULT NULL, -- aparentemente não usado
  `instagram_id` varchar(255) ... DEFAULT NULL COMMENT 'Instagram user ID for Instagram contacts',
  `whatsapp_number` varchar(50) ... DEFAULT NULL COMMENT 'WhatsApp phone number for WhatsApp contacts',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_contact` (`user_id`,`phone_e164`),
  UNIQUE KEY `uq_contact_channel_external` (`user_id`,`channel`,`external_contact_id`),
  ...
)
```

Pontos relevantes:

- `phone_e164` é `NOT NULL` em `canonical-schema.sql`, mas a migration `054_webchat.sql` (linhas 15-20) o tornou `NULL DEFAULT NULL` para permitir WebChat sem telefone.
- `normalized_phone` existe no schema mas não é referenciado em `src/**/*.ts` — campo morto.
- `whatsapp_number` é usado para WhatsApp e, agora, para o telefone do pre-chat do WebChat.
- `instagram_id` e `external_contact_id` guardam identidades específicas de provider.

### 2.2 Identidades separadas (`contact_identities`)

A migration `039_contact_identities.sql` introduziu a tabela `contact_identities` para guardar múltiplas identidades por provider (`database/schema/canonical-schema.sql:569-588`):

```sql
`external_id` varchar(255) ... NOT NULL,
`phone_e164` varchar(50) ... DEFAULT NULL,
`username` varchar(255) ... DEFAULT NULL,
UNIQUE KEY `uq_contact_identities_tenant_provider_external` (`tenant_id`,`provider`,`external_id`)
```

Porém, o código ainda roteia e busca conversas majoritariamente pelo `contacts.phone_e164` ou por handles sintéticos (`ig_`, `fb_`, `wc_`). A tabela `contact_identities` é usada pontualmente (ex.: `listChatContacts` faz `LEFT JOIN contact_identities ci_web`), mas não é a fonte primária de roteamento.

### 2.3 Campos customizados

Há **dois/ três sistemas paralelos**:

1. `contact_custom_fields` + `contact_custom_field_values` — modelo canônico atual (`canonical-schema.sql:513-559`).
2. `custom_fields` (tabela legada, `canonical-schema.sql:694-705`).
3. `contacts.custom_fields` JSON — ainda usado por `ensureContact` para metadados de avatar/perfil e pelo quick-save do WebChat (`src/lib/chat-actions.functions.ts:355`).

Risco: `ensureContact` faz `ON DUPLICATE KEY UPDATE custom_fields = VALUES(custom_fields)` (`src/lib/messaging/services/contact-identity.service.ts:165`), ou seja, **sobrescreve o JSON inteiro** a cada evento inbound, apagando dados do pre-chat se não forem re-mergeados.

---

## 3. Provider x Campos de Telefone/Identidade

| Provider | `phone_e164` | `whatsapp_number` | `instagram_id` | `external_contact_id` | `direct_messages.contact_phone` |
|---|---|---|---|---|---|
| **WhatsApp** | dígitos E.164 | `phoneE164` | `null` | `null` | `5511999999999` |
| **Instagram** | `ig_<scoped_id>` | `null` | `externalId` | `externalId` | `ig_<scoped_id>` |
| **Messenger** | `fb_<psid>` | `null` | `null` | `externalId` | `fb_<psid>` |
| **WebChat** | `NULL` | telefone pre-chat (quando informado) | `null` | `visitor_id` | `wc_<visitor_id>` |

Fontes:
- `src/lib/messaging/processor.server.ts:18-35` — normalização do `contact_phone` por provider.
- `src/lib/messaging/services/contact-identity.service.ts:147-151` — atribui `instagram_id`, `whatsapp_number`, `external_contact_id`.
- `src/lib/webchat/session.service.ts:99-118` — cria WebChat com `phoneE164: null` e `phoneNumber` no pre-chat.
- `src/lib/chat.functions.ts:302` — `COALESCE(c.phone_e164, CONCAT('wc_', ci_web.external_id)) as phone_e164` no Inbox.

---

## 4. Modelo de Thread / Conversação

### 4.1 `direct_messages.contact_phone`

É a chave de thread, não o `contact_id`. O processador guarda:

- WhatsApp: dígitos limpos.
- Instagram: `ig_<id>`.
- Messenger: `fb_<id>`.
- WebChat: `wc_<visitor_id>`.

`canonical-schema.sql:707-742` define a tabela sem `channel_connection_id` nem `conversation_id`. As migrations `045_add_channel_connection_id_to_messaging.sql` e `046_add_routing_references_to_outbox.sql` adicionam essas colunas, mas elas estão ausentes do schema canônico.

### 4.2 `chat_sessions`

`canonical-schema.sql:475-492`:

```sql
UNIQUE KEY `uq_chat_sessions_contact_id` (`contact_id`)
```

Esse índice é **global e não scoped** por tenant, e impede múltiplas conversas/identidades por contato. Isso conflita com a ideia de um lead ter WhatsApp + Instagram + Messenger + WebChat simultaneamente. Quando há múltiplas sessões, `findConversationByContactPhone` joga `AMBIGUOUS_CONVERSATION` (`src/lib/messaging/conversation-channel.service.ts:130-138`).

### 4.3 Pressuposto “uma thread por contato”

Várias funções são construídas em cima de um único endereço por contato:

- `getChatMessages` filtra por `contact_phone` (`src/lib/chat.functions.ts:549-565`).
- `markMessagesAsRead` filtra por `contact_phone` (`src/lib/chat.functions.ts:398-422`).
- `quickSaveContact` migra `direct_messages.contact_phone`, `conversation_assignments.contact_phone`, `campaign_messages.to_phone`, `conversation_tags`, `bot_conversation_state.contact_number` quando o telefone muda (`src/lib/chat-actions.functions.ts:414-508`).
- `getContactDetail` carrega mensagens usando `contact.phone_e164` (`src/lib/contacts.functions.ts:188-196`).

Consequência: mudar o telefone de um contato requer cascatear a alteração em várias tabelas; e contatos sem `phone_e164` (WebChat) simplesmente não mostram mensagens na tela de detalhes do CRM.

---

## 5. Gaps e Bugs Identificados

### 5.1 Detalhes do contato não carregam mensagens de WebChat

`src/lib/contacts.functions.ts:188-196`:

```ts
const phone = contact.phone_e164;
const messages = (await db.query(
  `SELECT ... FROM direct_messages WHERE contact_phone = ? ...`,
  [phone, ...msgParams],
)) as any[];
```

Para WebChat `phone` é `NULL`; a query retorna vazio. O correto seria usar `COALESCE(contact.phone_e164, CONCAT('wc_', webchat_external_id))` ou receber o `conversation_id`/`contact_id`.

### 5.2 Lista de contatos quebra para `phone_e164 = null`

`src/routes/_app/contacts.index.tsx:391-406`:

```ts
return (
  c.phone_e164.includes(search) ||  // .includes em null → TypeError
  c.name?.toLowerCase().includes(s) ||
  c.email?.toLowerCase().includes(s)
);
```

Além disso, a busca usa `search` (original) em vez de `s` (lowercase) no telefone, enquanto usa `s` nos demais campos — inconsistência case-sensitive.

### 5.3 Página de detalhes do contato exibe “+undefined” para WebChat

`src/routes/_app/contacts.$id.tsx:134-135`:

```ts
const isNonPhoneId = contact?.phone_e164?.startsWith("ig_") || contact?.phone_e164?.startsWith("fb_");
const displayPhone = isNonPhoneId ? contact?.phone_e164 : `+${contact?.phone_e164}`;
```

Para WebChat `phone_e164` é `undefined`, resultando em `displayPhone = "+undefined"`. A linha 250 repete `+${contact.phone_e164}` na sidebar.

### 5.4 Botão “Ligar” e navegação para chat no detalhe do contato

`src/routes/_app/contacts.$id.tsx:101-104`:

```ts
const phone = String(contact.phone_e164 ?? "").replace(/\D/g, "");
window.location.assign(`/chat?contactId=${...}&phone=${encodeURIComponent(phone)}`);
```

Para WebChat `phone` fica vazio, e o chat pode abrir sem a thread correta. A mesma função `openChatMut` chama `updateChatStatus({ contactId, status: "aberto" })`, que é válida, mas a navegação perde o contexto.

`src/routes/_app/contacts.$id.tsx:271-283` também mostra o botão de ligação baseado apenas em `phone_e164 && !isNonPhoneId`, o que para WebChat é falsamente desativado/ativo de forma errada.

### 5.5 `updateContactForUser` não migra tabelas dependentes

`src/lib/services/contacts.service.ts:92-99` atualiza `phone_e164` sem replicar a mudança em:

- `direct_messages.contact_phone`
- `conversation_assignments.contact_phone`
- `conversation_tags.contact_number`
- `campaign_messages.to_phone`
- `bot_conversation_state.contact_number`
- `whatsapp_flow_submissions.contact_phone`

`quickSaveContact` já faz essa migração (`src/lib/chat-actions.functions.ts:414-508`), mas a edição via formulário de CRM não. Isso pode orfanar mensagens e histórico.

### 5.6 `ensureContact` sobrescreve `custom_fields`

`src/lib/messaging/services/contact-identity.service.ts:165`:

```sql
ON DUPLICATE KEY UPDATE
  ...
  custom_fields = VALUES(custom_fields),
```

Se um evento inbound do WhatsApp/Instagram reprocessar um contato WebChat, os metadados do pre-chat (`email`, `phone`) podem sumir a menos que sejam re-incluídos na payload. A função não faz merge.

### 5.7 `contacts` create/update ainda exige telefone

`src/lib/contacts.functions.ts:8-16`:

```ts
const contactInput = z.object({
  phone: z.string().trim().min(8).max(32),
  ...
});
```

Não é possível criar um contato manual de Instagram/Messenger/WebChat sem inventar um telefone. O canal é opcional e só `whatsapp`/`instagram`/`messenger` no `updateContactInput` — **falta `webchat`** (`src/lib/contacts.functions.ts:103`).

### 5.8 `chat.tsx` ainda tem alguns usos diretos de `phone_e164`

Apesar da função `getDisplayPhone` já existir, alguns trechos usam `phone_e164` como thread key e para tags:

- `src/routes/_app/chat.tsx:1514` salva `chat:active_contact_phone` com `c.phone_e164`.
- `src/routes/_app/chat.tsx:2962-2963` procura contatos comparando `c.phone_e164`.
- `src/routes/_app/chat.tsx:3333` e `3473` filtram `conversationTag.contact_number === contact.phone_e164`, sem considerar `wc_`.
- `src/routes/_app/chat.tsx:5509-5511` passa `recipientPhone={selectedContact.phone_e164?.replace(/\D/g, "") || ""}` para `CallButton`; para WebChat isso fica vazio.

### 5.9 Renderização de custom fields — dual storage e formatação duplicada

Há **duas fontes de verdade** para valores de campos customizados:

1. `contact_custom_fields` + `contact_custom_field_values` (tabela normalizada).
2. `contacts.custom_fields` JSON (legado).

A lista em `contacts.index.tsx:905-925` lê os valores diretamente do JSON `c.custom_fields[c.fieldDef.key]`, sem formatação por tipo. Já a página de detalhes (`contacts.$id.tsx:382-407`) e o modal de oportunidade (`OpportunityModal.tsx:889-913`) leem de `cfValueMap` (provavelmente `contact_custom_field_values`) e aplicam formatação ad-hoc para `boolean`, `multi_select` e `currency`. O Inbox (`chat.tsx:7380-7419`) apenas imprime todas as chaves do JSON `custom_fields` exceto fotos, sem respeitar `is_active`/`show_on_details` e sem formatação, podendo vazar chaves internas (`wa_id`, `is_blocked`, etc.) na UI.

Outros problemas:

- Não existe um componente compartilhado de exibição (`CustomFieldDisplay`); a formatação está duplicada entre detalhe e oportunidade.
- `CustomFieldInput` armazena booleanos como strings `"true"`/`"false"`, e os pontos de exibição tratam ambos, o que é frágil.
- Currency é formatado manualmente de formas diferentes (`R$` estático no input vs `R$ ${val}` nas views).
- A lista salva os valores em **ambas** as tabelas (`contacts.index.tsx:679-685` e `1437-1445`), mas depois lê só do JSON, criando risco de divergência.

### 5.10 Drift entre `canonical-schema.sql` e migrations

- `channel_connections.provider` enum: `canonical-schema.sql:425` = `('whatsapp','instagram','messenger')`; migration `054_webchat.sql:7-11` adiciona `'webchat'`.
- `contacts.phone_e164` nullability: diferença entre canonical e migration 054.
- `direct_messages` e `chat_sessions` não têm `channel_connection_id`/`conversation_id` no canonical, mas migrations 045/046 as adicionam.
- Tabelas `webchat_widgets` e `webchat_sessions` existem na migration 054, mas não no canonical.
- `direct_messages.status` enum difere: canonical inclui `'queued'`; `012_reconcile_full_schema_with_local.sql` não.
- `bot_settings.channel` enum (`canonical-schema.sql:233`) ainda não inclui `'webchat'`, impedindo fluxos de bot para WebChat.
- `sales_funnels` e `bot_conversation_state` têm definições divergentes entre `001_canonical_schema.sql` e `canonical-schema.sql`.

### 5.11 Motor de custom fields — auditoria aprofundada

A auditoria específica do motor de campos personalizados revelou problemas arquiteturais além dos já citados:

- `custom_fields` (tabela legada, `canonical-schema.sql:694-705`) está **morta**: nenhum código em `src/` a lê ou escreve.
- O motor real é `contact_custom_fields` + `contact_custom_field_values`, mas a maior parte do sistema escreve diretamente no JSON `contacts.custom_fields`.
- **Duas fontes de valores não sincronizadas:**
  - `contact_custom_field_values` é lida/escrita por `custom-fields.functions.ts` e usada no detalhe, edição e oportunidade.
  - `contacts.custom_fields` JSON é usado pela lista, chat, CRM, campanhas, bot flows, webhooks, WhatsApp e WebChat.
- **Sem validação de valores:** `saveContactCustomFieldValues` aceita `z.any().nullable()` (`custom-fields.functions.ts:198-200`); `contacts.custom_fields` é JSON livre em todas as integrações.
- **`required` não é enforceado:** o asterisco na UI existe, mas não há validação no save.
- **Delete de definição não limpa JSON:** ao deletar um campo, `contact_custom_field_values` é removido por cascade, mas `contacts.custom_fields` JSON mantém os pares antigos.
- **`webhook_field_mappings.custom_field_id` sem FK**, gerando mappings órfãos.
- **Bot flows ignoram o motor canônico:** `executeSaveVariable` escreve chaves arbitrárias em `contacts.custom_fields` sem validar contra `contact_custom_fields`.
- **Filtro de tenant inconsistente:**
  - `custom-fields.functions.ts` filtra por `user_id` apenas (não por `tenant_id`) nas operações de CRUD.
  - `saveContactCustomFieldValues` não verifica se o contato/definição pertence ao caller antes de escrever (`:209-219`).
  - `updateContactProfilePhoto` (`contacts.functions.ts:56-58`) executa `UPDATE contacts SET custom_fields = ? WHERE id = ?` **sem `user_id`/`tenant_id`**, o que é uma falha crítica de isolamento multi-tenant.
- Não há coluna `entity_type`; campos customizados são hard-coded apenas para contatos.

---

## 6. Recomendações Priorizadas

### Imediatas (próxima fase)

1. **Corrigir `getContactDetail` para canais sem `phone_e164`.**  
   Usar `contact_identities` ou `COALESCE(c.phone_e164, CONCAT('wc_', ci_web.external_id))` para carregar `direct_messages`.

2. **Corrigir `contacts.index.tsx`**  
   - Tratar `phone_e164` nulo na busca (`(contact.phone_e164 ?? "").includes(...)`).  
   - Buscar também em `whatsapp_number`, `email`, `name` e `external_contact_id`.  
   - Padronizar uso da string lowercase (`s`) em todos os campos.

3. **Corrigir `contacts.$id.tsx`**  
   - Usar `getDisplayPhone`/lógica equivalente para WebChat (`whatsapp_number`).  
   - Evitar `+${undefined}`.  
   - Carregar mensagens pelo `conversation_id` ou thread key correto.  
   - Ocultar/esconder botão “Ligar” quando não houver telefone real.

4. **Ajustar `updateContactForUser`**  
   Replicar a migração de `phone_e164` nas tabelas dependentes, reaproveitando a lógica de `quickSaveContact`.

5. **Merge-safe em `custom_fields` no `ensureContact`**  
   Em vez de `custom_fields = VALUES(custom_fields)`, fazer `JSON_MERGE_PATCH` com os dados do evento inbound preservando chaves existentes (ex.: pre-chat `email`/`phone`).

### Médio prazo (arquitetura)

6. **Separar “telefone real” de “provider handle”**.  
   Criar uma coluna `provider_handle`/`thread_key` (ou usar `contact_identities`) e deixar `phone_e164` apenas para números reais. Isso elimina a confusão com `ig_`, `fb_`, `wc_` e permite múltiplas identidades por contato.

7. **Revisar `chat_sessions.uq_chat_sessions_contact_id`**.  
   Tornar scoped por `(tenant_id, contact_id)` e permitir uma sessão por `(contact_id, channel_connection_id)`, não uma única sessão global.

8. **Regenerar `canonical-schema.sql` a partir do banco local/migrations**.  
   Garantir que webchat, `channel_connection_id`, `conversation_id` e `phone_e164 NULL` estejam refletidos.

9. **Unificar custom fields**.  
   Definir se `contacts.custom_fields` JSON é apenas metadados transientes (avatar, etc.) e migrar dados de negócio para `contact_custom_field_values`. Criar um componente `CustomFieldDisplay` reutilizável e padronizar booleanos/currency; atualizar `chat.tsx` para respeitar `show_on_details`/`is_active`.

10. **Atualizar `bot_settings.channel` enum**.  
    Incluir `'webchat'` para permitir automações no canal.

### BAU / hygiène

11. Avaliar remover `contacts.normalized_phone` (não referenciado) ou documentar seu propósito.
12. Garantir que toda query em `contacts`/`direct_messages` filtre por `tenant_id` (regra do `AGENTS.md`).
13. **Corrigir `updateContactProfilePhoto`** — adicionar `AND user_id = ?`/`tenant_id` no `UPDATE` para evitar vazamento multi-tenant.
14. **Auditar `saveContactCustomFieldValues`** — verificar ownership de `contact_id` e `custom_field_id` antes de inserir/atualizar.
15. Rodar `npm run build`, `npm run type-check` e `npm run guard:omnichannel` após qualquer alteração.

---

## 7. Próximo Passo Recomendado

A fase atual concluiu o tratamento do **pre-chat WebChat no Inbox**. A próxima fase lógica é:

**“Fase 2 — Suporte a WebChat na lista e detalhes de contatos do CRM”**
- Objetivo: garantir que contatos WebChat (`phone_e164 = NULL`) possam ser listados, buscados e visualizados em `/contacts` e `/contacts/:id` sem crash e com suas mensagens carregadas.
- Escopo restrito: `src/routes/_app/contacts.index.tsx`, `src/routes/_app/contacts.$id.tsx`, `src/lib/contacts.functions.ts` (`getContactDetail`), e testes de regressão.
- Não alterar providers WhatsApp/Instagram/Messenger (freeze ativo).
- Entrega: PR com os ajustes + `CRM_WEBCHAT_CONTACT_PAGES_REPORT.md` + `guard:omnichannel` PASS.

---

## 8. Referências Rápidas

- `database/schema/canonical-schema.sql:608-654` — definição de `contacts`.
- `database/migrations/054_webchat.sql:15-20` — `phone_e164` NULL para WebChat.
- `database/schema/canonical-schema.sql:569-588` — `contact_identities`.
- `database/schema/canonical-schema.sql:707-742` — `direct_messages`.
- `database/migrations/045_add_channel_connection_id_to_messaging.sql` e `046_add_routing_references_to_outbox.sql` — colunas de roteamento adicionadas.
- `src/lib/messaging/services/contact-identity.service.ts:91-202` — `ensureContact`.
- `src/lib/messaging/processor.server.ts:18-35` — `getContactPhoneForIdentity`.
- `src/lib/chat.functions.ts:302` — join WebChat no Inbox.
- `src/lib/contacts.functions.ts:188-196` — `getContactDetail` carrega mensagens.
- `src/routes/_app/contacts.index.tsx:391-406` — filtro da lista.
- `src/routes/_app/contacts.$id.tsx:101-104,134-135,250,271-283` — detalhes do contato.
- `src/lib/chat-actions.functions.ts:44-58,308-508` — `quickSaveContact` e migração de telefone.
- `src/components/contacts/custom-field-input.tsx:24` — componente de input de custom fields.
- `src/routes/_app/contacts.index.tsx:234,642-653,905-925,1382-1393,1437-1445` — lista, formulário e persistência dupla de custom fields.
- `src/routes/_app/contacts.$id.tsx:382-407` — exibição de custom fields no detalhe.
- `src/routes/_app/chat.tsx:7380-7419` — exibição “raw” de custom fields no Inbox.
- `src/components/crm/OpportunityModal.tsx:889-913` — exibição de custom fields na oportunidade.
- `src/lib/custom-fields.functions.ts:77-222` — CRUD e valores de custom fields.
- `src/lib/contacts.functions.ts:18-60` — `updateContactProfilePhoto` sem filtro de tenant no UPDATE.
- `src/lib/botflow-control.ts:442-489` — `executeSaveVariable` escreve no JSON de `contacts.custom_fields`.
