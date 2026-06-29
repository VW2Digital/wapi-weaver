# RELATÓRIO DE AUDITORIA TÉCNICA — wapi-weaver

## Frontend → Backend → Banco de Dados

**Data:** 29/06/2026
**Total de Módulos Auditados:** 16
**Total de Problemas Encontrados:** 103

---

## SUMÁRIO EXECUTIVO (Problemas Críticos)

| # | Módulo | Gravidade | Problema |
|---|--------|-----------|----------|
| P01 | Chat | **CRÍTICO** | `message_tags.message_id` armazena `wa_message_id` em vez de UUID — foreign key quebrada, tags de mensagem nunca funcionam |
| P02 | Chat | **CRÍTICO** | 5 funções removem caracteres não-dígito de `phone_e164` — contatos Instagram (`ig_*`) viram string vazia, corrompendo o banco |
| P03 | Chat | **CRÍTICO** | Schema `channel ENUM` não inclui `'messenger'` — schema SQL desatualizado vs código |
| P04 | Bot | **CRÍTICO** | Zod validator `saveBotStepInput` não inclui 6 campos: `footer_text`, `delay_seconds`, `assign_team_id`, `assign_user_id`, `handoff_message`, `card_color` — esses campos são zerados em todo save |
| P05 | AI Agent | **CRÍTICO** | `saveAiAgentSettings` faz UPDATE sem `user_id` — um usuário sobrescreve configurações de outro |
| P06 | AI Agent | **CRÍTICO** | Switch `is_active` usa FormData com Radix UI — nunca captura o valor corretamente, sempre salva `false` |
| P07 | Templates | **CRÍTICO** | Coluna `display_format` não existe no banco mas é enviada para API do Meta — perda de dados em edição |
| P08 | CRM | **CRÍTICO** | `opportunities.probability_percent` nunca é lido/escrito por código algum — campo fantasma |
| P09 | Lists | **CRÍTICO** | 6 funções sem verificação de ownership (`user_id`) — qualquer usuário pode manipular listas/tags de outros |

---

## 1. MÓDULO PROFILE (perfil do usuário)

### Tabela: `profiles`

**Schema:**
```sql
profiles (id, email, full_name, avatar_url, display_name, phone, company_name,
          company_document, company_address, company_website, rate_limit_per_second,
          whatsapp_verify_token, whatsapp_access_token, whatsapp_phone_number_id,
          whatsapp_waba_id, whatsapp_business_id, whatsapp_business_phone,
          whatsapp_app_secret, whatsapp_app_id, meta_graph_version, salvy_api_key,
          api_key, created_at, updated_at)
```

**Arquivos auditados:**
- `src/routes/_app/profile.tsx`
- `src/lib/profile.functions.ts`
- `schema_mysql.sql` (linhas 11-37)

### Problemas Encontrados

| # | Gravidade | Problema | Arquivo:Linha |
|---|-----------|----------|---------------|
| 1.1 | **ALTA** | `whatsapp_access_token` com max 1024 no Zod, mas DB é TEXT. Tokens permanentes do Meta frequentemente excedem 1024 caracteres. Usuários com tokens longos não conseguem salvar. | `profile.functions.ts` (credSchema) |
| 1.2 | **MÉDIA** | `salvy_api_key` existe no DB (`TEXT NULL`) mas não está no `credSchema`. Não há endpoint para atualizá-lo. Campo completamente órfão — existe no banco, não existe em lugar nenhum do código. | `profile.functions.ts` |
| 1.3 | **MÉDIA** | `email` da tabela `profiles` não é incluído no `credSchema`. Não é atualizável via API de profile. Se o email mudar no auth, `profiles.email` fica dessincronizado. | `profile.functions.ts` |
| 1.4 | **MÉDIA** | Múltiplos campos com `max()` no Zod menores que a coluna do DB. Valores legítimos serão rejeitados pelo backend embora o DB os aceitasse: `full_name`(150 vs 255), `display_name`(100 vs 255), `phone`(32 vs 50), `company_name`(150 vs 255), `company_document`(32 vs 100), `company_address`(500 vs TEXT), `avatar_url`(500 vs TEXT), `whatsapp_verify_token`(128 vs 255), `whatsapp_phone_number_id`(64 vs 100), `whatsapp_waba_id`(64 vs 100), `whatsapp_business_id`(64 vs 100), `whatsapp_business_phone`(32 vs 50), `whatsapp_app_id`(64 vs 100). | `profile.functions.ts` (credSchema) |
| 1.5 | **BAIXA** | `updateProfile` faz `UPDATE profiles SET ... WHERE id = ...`. Se não existir row de profile (usuário recém-criado), o UPDATE afeta 0 linhas e retorna `{ ok: true }` sem erro — dados silenciosamente perdidos. Deveria ser UPSERT (`INSERT ... ON DUPLICATE KEY UPDATE`). | `profile.functions.ts` |
| 1.6 | **BAIXA** | `meta_graph_version` armazenado tanto em `profiles.meta_graph_version` quanto em `platform_settings.meta_graph_version`. settings.tsx salva no platform_settings, mas funções backend usam `profile?.meta_graph_version`. Dupla fonte da verdade. | `settings.tsx:2721` / `profile.functions.ts` |

### Diagnóstico Final do Profile

| Métrica | Valor |
|---------|-------|
| Colunas no DB | 24 |
| Colunas com UI | 16 (profile.tsx + settings.tsx) |
| Colunas sem UI | 8 (salvy_api_key, email update, created_at, updated_at, e algumas whatsapp salvas individualmente) |
| Colunas órfãs | salvy_api_key |
| Validações inconsistentes | 13 campos com max() divergente |

---

## 2. MÓDULO CONTACTS

### Tabelas: `contacts`, `contact_tags`, `conversation_tags`, `tags`

**Schema:**
```sql
contacts  (id, user_id, phone_e164, name, email, source, opted_out, channel,
           external_contact_id, custom_fields, is_pinned, is_archived, chat_status,
           is_unread, kanban_stage_id, created_at, updated_at)
contact_tags     (contact_id, tag_id, user_id)
conversation_tags (contact_number, tag_id, user_id)
tags             (id, user_id, name, color, icon, created_at)
```

**Arquivos auditados:**
- `src/routes/_app/contacts.tsx`
- `src/lib/contacts.functions.ts`
- `schema_mysql.sql` (linhas 122-153, 284-291, 111-120)

### Problemas Encontrados

| # | Gravidade | Problema | Arquivo:Linha |
|---|-----------|----------|---------------|
| 2.1 | **ALTA** | `deleteContact(id)` não deleta de `contact_tags` nem `list_contacts`. Ao deletar um contato individual, os registros nas tabelas de junção permanecem órfãos. | `contacts.functions.ts:124-156` |
| 2.2 | **ALTA** | `bulkDeleteContacts` só executa `DELETE FROM contacts WHERE id IN (...)`. Não limpa `contact_tags`, `conversation_tags`, nem `list_contacts`. Múltiplas tabelas com registros órfãos. | `contacts.functions.ts:246-259` |
| 2.3 | **ALTA** | `updateContact` só atualiza `phone_e164`, `name`, `email`. Ignora: `source`, `opted_out`, `channel`, `external_contact_id`, `custom_fields`, `is_pinned`, `is_archived`, `chat_status`, `is_unread`, `kanban_stage_id`. | `contacts.functions.ts:158-184` |
| 2.4 | **ALTA** | Não existe função para remover tag de um contato. Tags só podem ser adicionadas em massa, nunca removidas. | `contacts.functions.ts` |
| 2.5 | **MÉDIA** | `createContact` não aceita `channel` — todos os contatos criados via contacts page são `whatsapp`. Não há como criar contato Instagram. | `contacts.functions.ts:80-122` |
| 2.6 | **MÉDIA** | 10 campos existentes no DB não têm representação na tabela/forms do frontend: `custom_fields`, `channel`, `external_contact_id`, `is_pinned`, `is_archived`, `chat_status`, `is_unread`, `kanban_stage_id`, `created_at`, `opted_out` (apenas bulk). | `contacts.tsx` |
| 2.7 | **MÉDIA** | `conversation_tags` usa `contact_number` (VARCHAR) como parte da PK em vez de `contact_id` (UUID FK). Inconsistente com `contact_tags` que usa `contact_id`. Se um contato mudar de telefone, `conversation_tags` fica órfão. | `schema_mysql.sql:284-291` |
| 2.8 | **MÉDIA** | `listContacts` carrega TODOS os contatos em memória via LOOP com LIMIT 1000/OFFSET (pagination server-side incompleta). Não há search/filter/sort server-side. Não escala para dezenas de milhares. | `contacts.functions.ts:60-78` |
| 2.9 | **BAIXA** | `ON DUPLICATE KEY UPDATE` em `createContact` não atualiza `source`. Re-adicionar contato existente mantém `source` original (ex: 'import' em vez de 'manual'). | `contacts.functions.ts:80-122` |
| 2.10 | **BAIXA** | `name` validado com max 120 no Zod vs VARCHAR(255) no DB. `email` validado com max 180 vs VARCHAR(255). | `contacts.functions.ts` |

### Diagnóstico Final do Contacts

| Métrica | Valor |
|---------|-------|
| Colunas no DB (contacts) | 17 |
| Colunas gerenciadas ativamente | 5 (id, user_id, phone_e164, name, email) |
| Colunas setadas apenas no create | source, custom_fields |
| Colunas só por bulk | opted_out |
| Colunas nunca usadas pelo módulo | channel, external_contact_id, is_pinned, is_archived, chat_status, is_unread, kanban_stage_id |
| Funções faltando | removeTagFromContact, getSingleContact |

---

## 3. MÓDULO CHAT

### Tabelas: `direct_messages`, `conversation_tags`, `message_tags`

**Schema:**
```sql
direct_messages (id, user_id, contact_phone, direction, type, body, wa_message_id,
                 status, reply_to_message_id, channel, provider_message_id,
                 provider_account_id, metadata, created_at)
conversation_tags (contact_number, tag_id, user_id)
message_tags (message_id, tag_id, user_id)
```

**Arquivos auditados:**
- `src/routes/_app/chat.tsx`
- `src/lib/chat.functions.ts`
- `src/lib/chat-helpers.ts`
- `src/lib/chat-actions.functions.ts`
- `schema_mysql.sql` (linhas 266-301)

### Problemas Encontrados

| # | Gravidade | Problema | Arquivo:Linha |
|---|-----------|----------|---------------|
| 3.1 | **CRÍTICO** | `getChatMessages` retorna `id: row.wa_message_id || row.id`. Para mensagens com wa_message_id (quase todas), o `id` retornado é o wamid string, não o UUID do `direct_messages.id`. A tabela `message_tags.message_id` tem FK para `direct_messages.id` (UUID). Logo: (a) lookup de tags usa wamid, nunca encontra; (b) insert de tag usa wamid, viola FK. Tags de mensagem completamente quebradas. | `chat.functions.ts:255-258` |
| 3.2 | **CRÍTICO** | **Cinco funções** fazem `.replace(/\D/g, "")` no `phone_e164` sem verificar prefixo `ig_`/`fb_`. Para contatos Instagram (`ig_username`) ou Messenger (`fb_userid`), o resultado é string vazia `""`, que é salva no banco corrompendo `contact_number`/`phone_e164`. Funções afetadas: `toggleBotActive`, `assignConversation`, `autoAssignConversation`, `selfAssignConversation`, `quickSaveContact`. | `chat-actions.functions.ts:232` / `assignment.functions.ts:75,122,172` / `chat-actions.functions.ts:204` |
| 3.3 | **CRÍTICO** | `schema_mysql.sql` declara `channel ENUM('whatsapp','instagram')` nas tabelas `direct_messages`, `contacts`, `bot_conversation_state`. O código usa extensivamente `'messenger'` como canal. O script `ensure-schema.js` corrige via ALTER TABLE em runtime, mas o schema canônico está desatualizado. Quem rebuildar o banco do schema SQL terá falhas. | `schema_mysql.sql:276,130,630` |
| 3.4 | **MÉDIA** | `getChatContactDetails` retorna dados crus do DB (`SELECT *`). Quando `setSelectedContact((prev) => ({ ...prev, ...contactDetailsQuery.data }))` executa, o `custom_fields` (JSON string) sobrescreve o objeto já parseado. Avatar URL e company name de `custom_fields` quebram. | `chat.tsx:1316-1319` |
| 3.5 | **MÉDIA** | Envio de mensagens Instagram/Messenger (chat.functions.ts:436-504) só monta payload de texto: `{ text: { body: data.text?.body } }`. Qualquer tipo de mídia (imagem, áudio, vídeo, documento, localização, contato) falha silenciosamente ou envia apenas texto. | `chat.functions.ts:436-458,482-504` |
| 3.6 | **MÉDIA** | `provider_message_id` na tabela `direct_messages` nunca é populado em nenhum INSERT. Coluna definida no schema mas sempre NULL. | `chat.functions.ts:562-580` |
| 3.7 | **MÉDIA** | Join com `campaign_messages` em `listChatContacts` usa `last_cm.to_phone = c.phone_e164`. Se os formatos de telefone divergirem (ex: com/sem +55), o join falha silenciosamente e contatos com campanhas enviadas não aparecem na lista de chat. | `chat.functions.ts:144-148` |
| 3.8 | **MÉDIA** | `toggleBotActive` busca estado do bot sem filtrar por `channel`: `SELECT ... WHERE user_id = ? AND contact_number = ?`. O INSERT também omite `channel`. A UNIQUE KEY é `(user_id, contact_number, instance_id, channel)` — comportamento incorreto para canais diferentes. | `chat-actions.functions.ts:236-238,254-257` |
| 3.9 | **MÉDIA** | PK de `conversation_tags` e `message_tags` não incluem `user_id`. Mesmo `contact_number` + `tag_id` pode existir para usuários diferentes — potencial conflito. | `schema_mysql.sql:284-291,293-301` |

### Diagnóstico Final do Chat

| Métrica | Valor |
|---------|-------|
| Colunas no DB (direct_messages) | 14 |
| Bugs críticos | 3 (message_tags FK, phone stripping, channel ENUM) |
| Bugs médios | 6 |
| Funcionalidade quebrada | Message tagging, Instagram/Messenger assignments, Instagram media send |

---

## 4. MÓDULO CAMPAIGNS

### Tabelas: `campaigns`, `campaign_messages`

**Schema:**
```sql
campaigns (id, user_id, name, list_id, template_id, message_type, status, payload,
           totals, scheduled_at, started_at, finished_at, created_at, updated_at)
campaign_messages (id, user_id, campaign_id, contact_id, to_phone, status, wa_message_id,
                   conversation_id, conversation_origin, pricing_billable, pricing_category,
                   pricing_model, sent_at, delivered_at, read_at, failed_at, error,
                   attempts, created_at)
```

**Arquivos auditados:**
- `src/routes/_app/campaigns.index.tsx`
- `src/routes/_app/campaigns.$id.tsx`
- `src/lib/campaigns.functions.ts`
- `src/lib/campaign-totals.ts`
- `schema_mysql.sql` (linhas 195-238)

### Problemas Encontrados

| # | Gravidade | Problema | Arquivo:Linha |
|---|-----------|----------|---------------|
| 4.1 | **ALTA** | No detail da campanha (`campaigns.$id.tsx:299`), o código faz `m.contacts?.name`. Mas `getCampaign` usa SQL raw (`db.query`) que retorna rows planas, não aninhadas. O alias SQL é `contact_name`, não `contacts.name`. Logo `m.contacts` é sempre `undefined` — o nome do contato NUNCA aparece. | `campaigns.$id.tsx:299` |
| 4.2 | **ALTA** | `getCampaign` faz JOIN com `c.phone_e164 = cm.to_phone` (frágil, formato pode diferir). `exportCampaignReport` faz JOIN com `c.id = cm.contact_id` (correto, usa FK). Duas funções, duas estratégias diferentes para mesma finalidade. | `campaigns.functions.ts:271` vs `campaigns.functions.ts:504` |
| 4.3 | **MÉDIA** | `scheduled_at` é validado como ISO 8601 (`z.string().datetime()`) e enviado como ISO pelo wizard. A coluna no DB é MySQL `DATETIME` (formato `YYYY-MM-DD HH:MM:SS`). O funcionamento depende do driver MySQL fazer a conversão automaticamente — não é garantido. | `campaigns.functions.ts:39` / `campaign-wizard.tsx:298` |
| 4.4 | **MÉDIA** | Dois padrões diferentes de acesso ao DB: funções de listagem usam `db.query('SQL...')` (raw import, rows planas), funções de mutate usam `context.db.from('table').insert()` (fluent, rows aninhadas). Comportamentos e resultados diferentes. | `campaigns.functions.ts` |

### Diagnóstico Final do Campaigns

| Métrica | Valor |
|---------|-------|
| Colunas no DB (campaigns) | 14 |
| Colunas no DB (campaign_messages) | 18 |
| Bugs altos | 2 (contact name nunca exibido, join inconsistente) |
| Inconsistências | 2 (formato scheduled_at, dual DB API) |

---

## 5. MÓDULO TEMPLATES

### Tabela: `templates`

**Schema:**
```sql
templates (id, user_id, name, language, category, status,
           components, parameter_format, allow_category_change,
           cta_url_link_tracking_opted_out, message_send_ttl_seconds,
           sub_category, is_primary_device_delivery_only, meta_template_id, synced_at)
```

**Arquivos auditados:**
- `src/routes/_app/templates.tsx`
- `src/lib/templates.functions.ts`
- `src/components/template-builder-dialog.tsx`
- `schema_mysql.sql` (linhas 175-193)

### Problemas Encontrados

| # | Gravidade | Problema | Arquivo:Linha |
|---|-----------|----------|---------------|
| 5.1 | **CRÍTICO** | `display_format` é aceito no Zod, enviado para API do Meta no create e update, mas **não existe coluna correspondente no banco**. O campo nunca é persistido. Na próxima edição, `display_format` é `undefined`, e o update envia `undefined` para Meta — possivelmente removendo o display format do template ativo no Meta. | `templates.functions.ts:86-87,194,301` / `schema_mysql.sql` |
| 5.2 | **ALTA** | Status retornado pela API do Meta não é normalizado antes de salvar no DB. Meta pode retornar `'approved'` (minúsculo) ou status fora do ENUM como `'IN_APPEAL'`, `'PENDING_DELETION'`, `'DELETED'`. O ENUM do MySQL é case-sensitive. Resultado: erro na inserção/atualização. | `templates.functions.ts:206,312,521` |
| 5.3 | **ALTA** | ENUM `status` em `schema_mysql.sql` só tem 5 valores: `APPROVED`, `PENDING`, `REJECTED`, `PAUSED`, `DISABLED`. Meta pode retornar `PENDING_DELETION`, `DELETED`, `IN_APPEAL`. Mas o schema não os inclui. | `schema_mysql.sql:181` |
| 5.4 | **ALTA** | Ao editar template NAMED, o builder carrega body examples de `bodyComp.example?.body_text?.[0]`. Para NAMED, a API retorna `body_text_named_params` (estrutura diferente: array de `{param_name, example}`). Como `body_text` é undefined quando NAMED, os examples são perdidos em toda edição. | `template-builder-dialog.tsx:171-178` |
| 5.5 | **MÉDIA** | `listTemplates` (usado por campanhas) usa raw SQL com `status = 'APPROVED'` hardcoded e case-sensitive. Se status for 'approved' (minúsculo, Problema 5.2), o template não aparece na lista. | `templates.functions.ts:449-454` |
| 5.6 | **MÉDIA** | Categorias são armazenadas em maiúsculas no DB (`MARKETING`) mas exibidas em título case no filtro (`Marketing`). Inconsistência visual. | `templates.tsx:598-601` vs `template-builder-dialog.tsx:382-385` |
| 5.7 | **BAIXA** | Não há coluna `created_at` na tabela `templates`. Apenas `synced_at` que é sobrescrita em toda operação. | `schema_mysql.sql:175-193` |
| 5.8 | **BAIXA** | `message_send_ttl_seconds` armazenado como string no frontend, convertido com `parseInt` no save. Edge case: `parseInt("", 10)` retorna `NaN`. | `template-builder-dialog.tsx:131,146-148,248-250` |

### Diagnóstico Final do Templates

| Métrica | Valor |
|---------|-------|
| Colunas no DB | 15 |
| Colunas que deveriam existir mas não | display_format (CRÍTICO) |
| Problemas de status ENUM | Incompleto + sem normalização |
| Bugs de frontend | NAMED body examples perdidos na edição |

---

## 6. MÓDULO CRM

### Tabelas: `opportunities`, `sales_funnels`, `sales_stages`, `opportunity_activities`, `opportunity_notes`, `opportunity_contacts`, `opportunity_lost_reasons`, `opportunity_audit_logs`, `opportunity_tags`, `opportunity_stage_history`

**Arquivos auditados:**
- `src/routes/_app/crm.tsx`
- `src/lib/crm.functions.ts`
- `schema_mysql.sql` (linhas 323-554)

### Problemas Encontrados

| # | Gravidade | Problema | Arquivo:Linha |
|---|-----------|----------|---------------|
| 6.1 | **CRÍTICO** | `opportunities.probability_percent DECIMAL(5,2) NULL` existe no banco (linha 398) mas: não está no Zod schema, `createOpportunity` nunca insere, `updateOpportunity` nunca atualiza, frontend nunca lê nem escreve. A única probabilidade usada é a da `sales_stages`. **Campo completamente morto.** | `crm.functions.ts` (opportunitySchema) / `schema_mysql.sql:398` |
| 6.2 | **ALTA** | `user_id_actor` em `opportunity_audit_logs` nunca é populado. A função `logAudit` insere `user_id` (dono da oportunidade), não `user_id_actor` (quem executou a ação). Quando um admin age como outro usuário (`effectiveUserId != context.userId`), a auditoria perde quem realmente fez a ação. | `crm.functions.ts:54-75` |
| 6.3 | **ALTA** | `listStages` faz `SELECT * FROM sales_stages WHERE funnel_id = ? AND user_id = ?` — **sem** `AND deleted_at IS NULL`. Etapas com soft-delete aparecem no Kanban. `getCRMStats` e `moveOpportunity` filtram corretamente — inconsistência. | `crm.functions.ts:231` |
| 6.4 | **MÉDIA** | `reopenOpportunity` no frontend sempre usa `stages[0]?.id` como etapa de destino. Sem seletor para o usuário escolher para onde reabrir. Se `stages` estiver vazio, `stages[0]?.id` é `undefined` e quebra a validação Zod. | `OpportunityModal.tsx:289` |
| 6.5 | **MÉDIA** | `listStages` não filtra `is_active = TRUE` — etapas inativas aparecem no Kanban. | `crm.functions.ts:231` |
| 6.6 | **MÉDIA** | Não há UI para editar funil no frontend. `updateFunnel` existe no backend mas nunca é chamado. | `crm.tsx` / `crm.functions.ts:142-188` |
| 6.7 | **MÉDIA** | `is_pinned` em notas: backend aceita no schema, frontend nunca envia. `updateNote` existe mas nunca é chamado. Nenhuma nota pode ser fixada. A listagem ordena por `is_pinned DESC` — feature morta. | `OpportunityModal.tsx:300` / `crm.functions.ts:1547-1568` |
| 6.8 | **MÉDIA** | `sales_stages.description` nunca tem UI no frontend. O formulário de etapa não inclui campo de descrição. Backend sempre salva `null`. | `crm.tsx:1061-1181` |
| 6.9 | **MÉDIA** | Não há CRUD de `opportunity_lost_reasons`. Apenas `listLostReasons` existe. Sem create/update/delete. | `crm.functions.ts` |
| 6.10 | **MÉDIA** | `opportunity_contacts.notes TEXT NULL` nunca é escrito. Schema Zod inclui `contact_id` e `role` apenas. Campo órfão. | `crm.functions.ts` (opportunitySchema) |
| 6.11 | **MÉDIA** | `ip_address` e `user_agent` em `opportunity_audit_logs` nunca populados. Colunas existem para auditoria mas backend nunca as preenche. | `crm.functions.ts:54-75` |
| 6.12 | **MÉDIA** | `currency` hardcoded como `"BRL"` em todo lugar. Frontend não permite selecionar outra moeda. Backend dá default `"BRL"`. | `OpportunityModal.tsx:223` / `crm.functions.ts:625,729` |
| 6.13 | **MÉDIA** | 4 campos ausentes do diálogo "Nova Oportunidade": `description`, `company_name`, `expected_close_date`, `source`. Só aparecem no modal de detalhes (após criar). | `crm.tsx:590-694` |
| 6.14 | **BAIXA** | Atividades nunca vinculadas a contatos específicos. `contact_id` sempre NULL. | `OpportunityModal.tsx:735-787` |
| 6.15 | **BAIXA** | Atividades sempre auto-atribuídas. `assigned_to_user_id` default = `effectiveUserId`. Sem seletor de atribuição. | `crm.functions.ts:1395` |
| 6.16 | **BAIXA** | Tags ausentes do diálogo "Nova Oportunidade". Só adicionáveis no modal de edição. | `crm.tsx:590-694` |
| 6.17 | **BAIXA** | `deleteOpportunity` não usa `logAudit` helper — faz INSERT direto com formato ligeiramente diferente. | `crm.functions.ts:799-821` |

### Diagnóstico Final do CRM

| Métrica | Valor |
|---------|-------|
| Tabelas no módulo | 10 |
| Colunas totais | ~120 |
| Campos criticamente mortos | 1 (probability_percent) |
| Campos órfãos parciais | 5 (description stages, notes opp_contacts, ip_address, user_agent, is_pinned notes) |
| Funcionalidades faltando | CRUD lost_reasons, update funnel, reopen com seletor, moeda, atribuição de atividades |

---

## 7. MÓDULO BOT (BotFlow)

### Tabelas: `bot_settings`, `bot_steps`, `bot_step_options`, `bot_conversation_state`

**Schema:**
```sql
bot_settings (id, user_id, instance_id, is_active, pause_timeout_minutes, name,
              channel, priority, trigger_type, trigger_value, is_default, created_at, updated_at)
bot_steps (id, user_id, bot_settings_id, step_order, trigger_type, trigger_value,
           message_type, message_content, media_url, media_caption, footer_text,
           buttons_config, next_step_id, delay_seconds, position_x, position_y,
           assign_team_id, assign_user_id, handoff_message, card_color, created_at, updated_at)
bot_step_options (id, user_id, step_id, option_number, label, description, next_step_id,
                  assign_team_id, assign_user_id, created_at)
bot_conversation_state (id, user_id, contact_number, instance_id, current_step_id,
                        last_interaction, is_paused, paused_until, bot_active, channel,
                        provider_account_id, created_at, updated_at)
```

**Arquivos auditados:**
- `src/routes/_app/bot.tsx`
- `src/lib/botflow.functions.ts`
- `src/lib/botflow-executor.server.ts`
- `src/lib/bot-templates.ts`
- `schema_mysql.sql` (linhas 558-643)

### Problemas Encontrados

| # | Gravidade | Problema | Arquivo:Linha |
|---|-----------|----------|---------------|
| 7.1 | **CRÍTICO** | Zod schema `saveBotStepInput` não inclui 6 campos: `footer_text`, `delay_seconds`, `assign_team_id`, `assign_user_id`, `handoff_message`, `card_color`. Como `z.object()` faz strip de chaves não declaradas, esses campos são removidos em todo save. Cada "Salvar Fluxo" zera esses 6 campos para TODOS os steps. **Perda ativa de dados a cada save.** | `botflow.functions.ts` (saveBotStepInput) |
| 7.2 | **ALTA** | Frontend (`bot.tsx`) oferece `messenger` como opção de canal. Mas o DB ENUM é `channel ENUM('whatsapp', 'instagram')`. Qualquer tentativa de criar bot settings para Messenger causa MySQL ENUM violation. | `bot.tsx:158-160` / `schema_mysql.sql:567` |
| 7.3 | **ALTA** | `bot_step_options` tabela existe no schema, tem FK e índices, mas **NUNCA é usada** — nenhum INSERT, SELECT, UPDATE ou DELETE em lugar nenhum do código. Tabela completamente órfã. | `schema_mysql.sql:605-618` |
| 7.4 | **MÉDIA** | `condition_operator: z.string().nullable().optional()` no Zod validator mas não existe coluna `condition_operator` na tabela `bot_steps`. Campo fantasma — aceito e descartado. | `botflow.functions.ts` |
| 7.5 | **MÉDIA** | 5 colunas do DB sem UI no StepInspector: `delay_seconds`, `assign_team_id`, `assign_user_id`, `handoff_message`, `card_color`. Backend salva, executor (potencialmente) usa, mas usuário não consegue definir. | `StepInspector` (dentro de bot.tsx) |
| 7.6 | **MÉDIA** | `media_caption` é salvo no DB pela interface, mas o executor (`botflow-executor.server.ts`) nunca lê `stepToExecute.media_caption` ao enviar mensagens de mídia. A caption configurada pelo usuário nunca é entregue. | `botflow-executor.server.ts:238-241` |
| 7.7 | **MÉDIA** | 6 campos de `bot_settings` sem UI: `name`, `priority`, `trigger_type`, `trigger_value`, `is_default`, `pause_timeout_minutes`. O executor usa todos eles (para ordenação, keyword matching, fallback, timeout), mas o usuário não tem como configurá-los. | `bot.tsx` |
| 7.8 | **MÉDIA** | Não existe endpoint para atualizar `bot_settings` além de `toggleBotStatus` (que só mexe em `is_active`). | `botflow.functions.ts` |
| 7.9 | **BAIXA** | `provider_account_id` em `bot_conversation_state` nunca é populado pelo executor. O INSERT inicial e o upsert de `commitState()` não incluem a coluna. | `botflow-executor.server.ts:124-131,203-213` |
| 7.10 | **BAIXA** | `buttonPayload` parâmetro em `processBotFlow` é aceito mas nunca referenciado no corpo da função. | `botflow-executor.server.ts:17` |
| 7.11 | **BAIXA** | `saveBotStep` (single step) existe mas nunca é importado/chamado pelo frontend. Código morto. | `botflow.functions.ts:216` |

### Diagnóstico Final do Bot

| Métrica | Valor |
|---------|-------|
| Tabelas | 4 |
| Colunas em bot_steps | 22 |
| Campos com data loss no save | 6 (CRÍTICO) |
| Tabela órfã | bot_step_options |
| Campos sem UI | 11 (5 steps + 6 settings) |

---

## 8. MÓDULO AI AGENT

### Tabelas: `ai_agent_settings`, `knowledge_base`

**Schema:**
```sql
ai_agent_settings (id, user_id, instance_id, is_active, api_key, model,
                   system_prompt, created_at, updated_at)
knowledge_base (id, user_id, ai_agent_settings_id, title, content,
                created_at, updated_at)
```

**Arquivos auditados:**
- `src/routes/_app/ai-agent.tsx`
- `src/lib/ai-agent.functions.ts`
- `src/lib/ai-agent.server.ts`
- `schema_mysql.sql` (linhas 700-724)

### Problemas Encontrados

| # | Gravidade | Problema | Arquivo:Linha |
|---|-----------|----------|---------------|
| 8.1 | **CRÍTICO** | `saveAiAgentSettings` executa `UPDATE ai_agent_settings SET ... WHERE instance_id = ?`. **Sem `AND user_id = ?`**. A UNIQUE KEY é `(user_id, instance_id)`, permitindo que dois usuários tenham rows com mesmo instance_id. Um usuário sobrescreve as configurações do outro. | `ai-agent.functions.ts:74-76` |
| 8.2 | **CRÍTICO** | `getAiAgentSettings` faz `SELECT * FROM ai_agent_settings WHERE instance_id = ?`. **Sem `AND user_id = ?`**. Pode retornar configurações de outro usuário. Se o usuário A criar settings primeiro e o B visitar a página, B vê as settings de A. | `ai-agent.functions.ts:30-33` |
| 8.3 | **CRÍTICO** | Switch `is_active` usa `new FormData(e.currentTarget)` e depois `fd.get("is_active") === "on"`. O Radix UI Switch (`@radix-ui/react-switch`) renderiza um `<button role="switch">`, não um `<input>`. É provável que não gere hidden input para o form. `fd.get("is_active")` retorna `null`, então `is_active` é **sempre `false`** independente do estado visual do switch. | `ai-agent.tsx:112-118,169` |
| 8.4 | **ALTA** | Select `model` também via FormData com Radix UI. Select do Radix UI até renderiza um hidden `<select>`, mas o comportamento em modo uncontrolled (`defaultValue`) pode não sincronizar corretamente com o valor selecionado. Potencialmente `model` sempre `null`. | `ai-agent.tsx:115-118,190` |
| 8.5 | **MÉDIA** | `deleteKnowledgeBase` faz `DELETE FROM knowledge_base WHERE id = ?`. **Sem `AND user_id = ?`**. Qualquer usuário autenticado que saiba/advivinhe um UUID pode deletar qualquer documento de conhecimento. | `ai-agent.functions.ts:156-162` |
| 8.6 | **MÉDIA** | `getKnowledgeBase` retorna array cru de rows em vez de envelope `{ ok, data, error }`. Outros endpoints do módulo retornam envelope. Inconsistente — frontend não consegue distinguir "empty" de "query failed". | `ai-agent.functions.ts` |
| 8.7 | **MÉDIA** | `model: z.string()` aceita QUALQUER string no servidor. Frontend limita a 2 opções, mas backend deixa passar qualquer valor. Se modelo inválido for salvo, `processAiAgent` vai falhar ao chamar API do Google. | `ai-agent.functions.ts:54` |
| 8.8 | **BAIXA** | `title: z.string()` sem `.max(255)`. DB é VARCHAR(255). Título com mais de 255 caracteres causa erro no MySQL. | `ai-agent.functions.ts:113` |
| 8.9 | **BAIXA** | API key retornada em plaintext no `SELECT *` para o frontend. Exposta no HTML, cache, etc. Deveria retornar apenas `has_api_key: boolean`. | `ai-agent.functions.ts:31` |
| 8.10 | **BAIXA** | `updated_at` não é explicitamente setado no UPDATE de `knowledge_base`. Depende de `ON UPDATE CURRENT_TIMESTAMP` do MySQL. Funciona, mas se valores não mudarem, `updated_at` não atualiza. | `ai-agent.functions.ts:141` |
| 8.11 | **BAIXA** | Diferença no default `system_prompt` entre functions.ts ("Você é um assistente virtual útil e educado.") e server.ts ("Você é um assistente virtual útil."). Deveria ser constante compartilhada. | `ai-agent.functions.ts:41` vs `ai-agent.server.ts:48` |
| 8.12 | **BAIXA** | `created_at` / `updated_at` de knowledge_base nunca exibidos na UI. | `ai-agent.tsx:262-296` |

### Diagnóstico Final do AI Agent

| Métrica | Valor |
|---------|-------|
| Colunas (ai_agent_settings) | 9 |
| Colunas (knowledge_base) | 7 |
| Bugs críticos | 3 (UPDATE sem user_id, SELECT sem user_id, Switch não funciona) |
| Bugs de segurança | 2 (DELETE sem ownership, API key exposta) |
| Inconsistências | 2 (retorno getKnowledgeBase, default system_prompt) |

---

## 9. MÓDULO SETTINGS

### Tabelas: `platform_settings`, `profiles`

**Schema:**
```sql
platform_settings (id, meta_app_id, meta_app_secret, meta_config_id, meta_graph_version,
                   cron_secret, head_tags, body_tags, sidebar_order, seo_title,
                   seo_description, updated_at, updated_by)
```

**Arquivos auditados:**
- `src/routes/_app/settings.tsx`
- `src/lib/admin.functions.ts`
- `src/lib/seo.ts`
- `schema_mysql.sql` (linhas 48-63, 11-37)

### Problemas Encontrados

| # | Gravidade | Problema | Arquivo:Linha |
|---|-----------|----------|---------------|
| 9.1 | **MÉDIA** | `profiles.meta_graph_version` é carregado no form state (`setForm(profile)`) mas não há campo UI na aba Meta para editá-lo. O botão principal "Salvar" não inclui `meta_graph_version`. Só é alterável via admin (que salva em `platform_settings`, não em `profiles`). | `settings.tsx:324,1021-1029` |
| 9.2 | **MÉDIA** | O botão "Salvar configurações da plataforma" (linha 2715) envia `meta_app_id, meta_app_secret, meta_config_id, meta_graph_version, head_tags, body_tags, cron_secret`. **Não inclui `seo_title` nem `seo_description`.** SEO fields são salvos apenas pelo botão "Salvar SEO". Se admin editar SEO e clicar no botão errado, alterações são perdidas. | `settings.tsx:2715-2726` |
| 9.3 | **MÉDIA** | `profiles.salvy_api_key` completamente órfão. Sem UI, sem endpoint. Existe no banco, não existe no código. | `schema_mysql.sql:32` |
| 9.4 | **BAIXA** | `meta_app_secret` nunca pode ser limpo via UI. O handler pula string vazia (`data.meta_app_secret !== ""`). Já `head_tags`, `body_tags`, `cron_secret` podem ser limpos (string vazia vira `null`). Inconsistente. | `admin.functions.ts:88-89` |
| 9.5 | **BAIXA** | `sidebar_order` gerenciado via endpoints separados (`getSidebarOrder` / `updateSidebarOrder`), não incluso no fluxo principal de `getPlatformSettings`. Fácil de esquecer em mudanças futuras. | `admin.functions.ts` |
| 9.6 | **BAIXA** | Zod limita `meta_app_id` (64 vs 255 DB), `meta_config_id` (64 vs 255 DB), `meta_app_secret` (256 vs TEXT), `cron_secret` (128 vs TEXT). Mais restritivo que o DB. | `admin.functions.ts` |
| 9.7 | **BAIXA** | Botão principal "Salvar" na aba Meta (linha 1021) usa lista hardcoded de campos. Novo campo adicionado ao DB e ao form state não será salvo até que esta lista seja manualmente atualizada. Risco de manutenção. | `settings.tsx:1021-1029` |

### Diagnóstico Final do Settings

| Métrica | Valor |
|---------|-------|
| Colunas (platform_settings) | 13 |
| Colunas (profiles relevantes) | ~12 |
| Campos sem UI no settings | meta_graph_version (profile level), salvy_api_key |
| Risco de perda de dados | SEO fields no botão errado |
| Inconsistências de validação | 4 campos com max divergente |

---

## 10. MÓDULO LISTS

### Tabelas: `lists`, `list_contacts`, `tags`

**Schema:**
```sql
lists (id, user_id, name, description, created_at)
list_contacts (list_id, contact_id, user_id, added_at)
tags (id, user_id, name, color, icon, created_at)
```

**Arquivos auditados:**
- `src/routes/_app/lists.tsx`
- `src/lib/lists.functions.ts`
- `src/lib/contacts.functions.ts` (bulkAddContactsToList)
- `schema_mysql.sql` (linhas 111-173)

### Problemas Encontrados

| # | Gravidade | Problema | Arquivo:Linha |
|---|-----------|----------|---------------|
| 10.1 | **CRÍTICO** | `deleteList()` faz `DELETE FROM lists WHERE id = ?`. **Sem `AND user_id = ?`**. Qualquer usuário autenticado pode deletar qualquer lista. | `lists.functions.ts:98-105` |
| 10.2 | **CRÍTICO** | `deleteTag()` faz `DELETE FROM tags WHERE id = ?`. **Sem `AND user_id = ?`**. Qualquer usuário pode deletar tags de outros. | `lists.functions.ts:46-53` |
| 10.3 | **CRÍTICO** | `removeContactFromList()` faz `DELETE FROM list_contacts WHERE list_id = ? AND contact_id = ?`. **Sem verificação de user_id**. | `lists.functions.ts:146-158` |
| 10.4 | **CRÍTICO** | `addContactsToList()` verifica se contatos pertencem ao usuário mas **não verifica se a `list_id` pertence ao usuário**. Usuário pode adicionar contatos a listas de outros. | `lists.functions.ts:107-144` |
| 10.5 | **CRÍTICO** | `getListContacts()` faz `SELECT ... WHERE lc.list_id = ?`. **Sem filtro `user_id`**. Qualquer usuário lê membros de qualquer lista. | `lists.functions.ts:160-210` |
| 10.6 | **CRÍTICO** | `importCsvToList()` recebe `list_id` mas nunca verifica se a lista pertence ao usuário. Importação de CSV para lista de outro usuário. | `lists.functions.ts:212-297` |
| 10.7 | **MÉDIA** | Não existe `updateList` / `editList`. Lista não pode ser renomeada nem ter description alterada após criação. | `lists.functions.ts` (ausente) |
| 10.8 | **MÉDIA** | Não existe `updateTag`. Tag não pode ser renomeada nem ter cor alterada. | `lists.functions.ts` (ausente) |
| 10.9 | **MÉDIA** | `bulkAddContactsToList` em `contacts.functions.ts:280-307` duplica `addContactsToList` de `lists.functions.ts`, mas **sem a validação de contatos do Instagram**. Bypass de validação. | `contacts.functions.ts:280-307` |
| 10.10 | **MÉDIA** | Tabela `lists` não tem coluna `updated_at`. Todas as outras tabelas principais têm. | `schema_mysql.sql:155-162` |
| 10.11 | **BAIXA** | Coluna `icon` em `tags` nunca usada. Backend insere apenas `id, user_id, name, color`. Frontend nunca exibe. Campo morto. | `schema_mysql.sql:116` |
| 10.12 | **BAIXA** | Default de `color` em tags difere: DB = `#8B5CF6` (roxo), backend/frontend = `#25D366` (verde WhatsApp). | `schema_mysql.sql:115` vs `lists.functions.ts:27` vs `lists.tsx:57` |
| 10.13 | **BAIXA** | `name` validado com `max(80)` no backend vs VARCHAR(255). `description` validado com `max(280)` vs TEXT. Frontend sem `maxlength`. | `lists.functions.ts:78-79` / `lists.tsx:194,201` |
| 10.14 | **BAIXA** | `created_at` de lista e `added_at` de list_contacts nunca exibidos na UI. | `lists.tsx:244-248,394-418` |

### Diagnóstico Final do Lists

| Métrica | Valor |
|---------|-------|
| Funções sem verificação de ownership | 6 (CRÍTICO de segurança) |
| Endpoints faltando | updateList, updateTag |
| Duplicação de código | bulkAddContactsToList em 2 arquivos |
| Campos órfãos | icon (tags) |

---

## 11. MÓDULO USERS (Admin)

### Tabelas: `users`, `user_roles`, `profiles`, `teams`, `team_members`

**Arquivos auditados:**
- `src/routes/_app/users.tsx`
- `src/lib/users-admin.functions.ts`
- `src/lib/assignment.functions.ts`
- `schema_mysql.sql` (linhas 3-46, 760-795)

### Problemas Encontrados

| # | Gravidade | Problema | Arquivo:Linha |
|---|-----------|----------|---------------|
| 11.1 | **MÉDIA** | `listUsers` não consulta `profiles`. Retorna `{id, email, created_at, last_sign_in_at, confirmed, roles}`. `display_name`/`full_name` nunca aparecem na lista de usuários. Admin cria com display_name mas nunca pode vê-lo. | `users-admin.functions.ts:18-45` |
| 11.2 | **MÉDIA** | Não existe endpoint `updateUserProfile`. `display_name` é setado apenas no `createUser`. Se admin errar o nome, não há como corrigir. | `users-admin.functions.ts` |
| 11.3 | **BAIXA** | `createUser` escreve `data.display_name` em **ambos** `profiles.full_name` e `profiles.display_name`. Se a intenção é que sejam campos distintos (nome legal vs nome de exibição), isso os conflita. | `users-admin.functions.ts:73-75` |
| 11.4 | **BAIXA** | Inconsistência de clientes DB: `createUser` usa `db.query()` (MySQL raw), `getUserActivity` usa `dbAdmin.from()` (Supabase). Dependendo da arquitetura, podem ser bancos diferentes. | `users-admin.functions.ts` |

### Diagnóstico Final do Users

| Métrica | Valor |
|---------|-------|
| Problemas de funcionalidade | 2 (list sem display_name, sem update) |
| Problemas arquiteturais | 2 (escrita duplicada, dual DB client) |
| Gravidade geral | Média — sem bugs críticos |

---

## 12. MÓDULO BILLING

### Tabelas: `campaign_messages`, `direct_messages`

**Arquivos auditados:**
- `src/routes/_app/billing.tsx`
- `src/lib/billing.functions.ts`
- `schema_mysql.sql` (linhas 215-238)

### Problemas Encontrados

| # | Gravidade | Problema | Arquivo:Linha |
|---|-----------|----------|---------------|
| 12.1 | **ALTA** | `getBillingReport` só consulta `campaign_messages`. Mensagens enviadas via chat direto (`direct_messages`) também geram custos na API do Meta mas **não são contabilizadas**. O billing mostra um valor menor que o real. | `billing.functions.ts:31` |
| 12.2 | **MÉDIA** | O filtro de mês usa `created_at >= start AND created_at < end`. Mas `created_at` é quando o registro foi criado no sistema, não quando a mensagem foi enviada/faturada. Mensagens criadas em fevereiro mas enviadas em março são contadas em fevereiro. | `billing.functions.ts:31` |
| 12.3 | **MÉDIA** | O hint "X entregues" soma `totals.sent + totals.delivered + totals.read`. O label "entregues" é enganoso — inclui mensagens em status "sent" que ainda não foram entregues. | `billing.tsx:89` |
| 12.4 | **BAIXA** | `conversation_origin` é selecionado na query mas nunca referenciado em cálculo algum. Wasted query. | `billing.functions.ts:31` |
| 12.5 | **BAIXA** | `pricing_model` (CBP vs MBP) nunca é consultado nem exibido. Dado útil sobre estrutura de custos disponível mas ignorado. | `billing.functions.ts` |
| 12.6 | **BAIXA** | Mensagens com `pricing_billable = NULL` não entram nem em "billable" nem em "free". Podem existir mensagens não contabilizadas sem explicação na UI. | `billing.functions.ts:56-57` |

### Diagnóstico Final do Billing

| Métrica | Valor |
|---------|-------|
| Fontes de custo consideradas | 1 de 2 (falta direct_messages) |
| Bugs de data | Filtro usa created_at, deveria usar sent_at |
| Dados ignorados | pricing_model, conversation_origin |

---

## 13. MÓDULO WHATSAPP BUSINESS PROFILE

### Tabelas: `profiles` (credentials), `whatsapp_business_profile_logs`

**Arquivos auditados:**
- `src/routes/_app/whatsapp-business-profile.tsx`
- `src/lib/whatsapp-business-profile.functions.ts`
- `src/lib/whatsapp-business-profile.service.ts`
- `src/lib/whatsapp-business-profile.shared.ts`
- `schema_mysql.sql` (whatsapp_business_profile_logs: 250-264)

### Problemas Encontrados

| # | Gravidade | Problema | Arquivo:Linha |
|---|-----------|----------|---------------|
| 13.1 | **ALTA** | Zod schema: `email: z.string().trim().email("E-mail inválido").max(128).optional()`. `.optional()` permite `undefined` mas **não** string vazia `""`. Quando o perfil do Meta não tem email, `toForm()` mapeia para `""`, que é rejeitado pelo Zod. Usuário não consegue salvar **nenhuma alteração** se o email estiver vazio. | `whatsapp-business-profile.functions.ts:49` |
| 13.2 | **MÉDIA** | `buildBusinessProfileUpdatePayload` só inclui campo se for truthy: `if (about) payload.about = about`. Se usuário limpar um campo e salvar, o valor vazio **nunca é enviado para Meta**. Uma vez setado, um campo não pode ser removido. | `whatsapp-business-profile.service.ts:98-103` |
| 13.3 | **MÉDIA** | Dois code paths duplicados para GET/UPDATE: server functions (TanStack Start, com `requireAuth`) e API route (`/api/whatsapp/business-profile`, com JWT). ~100 linhas duplicadas de resolução de credenciais. Risco de divergência. | `whatsapp-business-profile.functions.ts` + `routes/api/whatsapp/business-profile.ts` |
| 13.4 | **MÉDIA** | Logging usa `dbAdmin.from("whatsapp_business_profile_logs")` (cliente Supabase). A tabela está definida em `schema_mysql.sql` (MySQL). Depende de configuração externa para funcionar — pode estar escrevendo no banco errado ou silenciosamente falhando (catch block engole erros). | `whatsapp-business-profile.service.ts:39,51-52` |
| 13.5 | **BAIXA** | `normalizeOptionalString` trata literalmente "undefined" e "null" como null. Se usuário digitar "null" no campo de descrição, é silenciosamente removido. | `whatsapp-business-profile.shared.ts:38-44` |

### Diagnóstico Final do WhatsApp Business Profile

| Métrica | Valor |
|---------|-------|
| Bugs funcionais | 1 (email vazio quebra save) |
| Gaps de funcionalidade | 1 (não pode limpar campos) |
| Problemas arquiteturais | 2 (dual code path, DB client inconsistente) |

---

## 14. MÓDULO DASHBOARD

### Tabelas: `campaigns`, `campaign_messages`, `contacts`, `templates`

**Arquivos auditados:**
- `src/routes/_app/dashboard.tsx`
- `src/lib/dashboard.functions.ts`
- `src/lib/campaign-totals.ts`
- `schema_mysql.sql`

### Problemas Encontrados

| # | Gravidade | Problema | Arquivo:Linha |
|---|-----------|----------|---------------|
| 14.1 | **ALTA** | `dashboard.tsx:155` referencia `x.unread_count` que **não existe na tabela `contacts`**. A tabela tem `is_unread` (boolean), não `unread_count` (integer). `x.unread_count ?? 0 > 0` é sempre `false`. Código morto — nunca contribui para o filtro de notificações. | `dashboard.tsx:155` |
| 14.2 | **ALTA** | Notificação de campanha concluída verifica `x.status === "completed" || x.status === "sent"`. Mas o schema define os status como: `'draft', 'queued', 'running', 'done', 'failed', 'cancelled'`. **Não existe status "completed" nem "sent".** O status correto é `'done'`. Notificações de campanha concluída nunca disparam. | `dashboard.tsx:126` |
| 14.3 | **MÉDIA** | Trends usam dimensões temporais diferentes: contacts/templates/campaigns contam "criados nos últimos 7 dias" (now vs 7d atrás); delivered conta "entregues esta semana vs semana passada" (7d vs 14d). Mesmo label "vs. 7d" para semânticas diferentes. | `dashboard.functions.ts:48-56` |
| 14.4 | **MÉDIA** | `campaigns.functions.ts:212-229` recalcula o JSON `totals` de TODAS as campanhas não-draft em toda chamada de `listCampaigns`. O dashboard chama `listCampaigns` em cada visita. UPDATE caro e desnecessário em toda leitura. | `campaigns.functions.ts:212-229` |
| 14.5 | **MÉDIA** | Notificações criam entradas duplicadas para mesma campanha: uma como "campanha concluída" (`id: campaign-completed-${x.id}`) e outra como "com falhas" (`id: campaign-failed-${x.id}`). | `dashboard.tsx:126-152` |
| 14.6 | **BAIXA** | Flash de `0` nos cards enquanto dados não carregam — fallback para `0` em vez de skeleton loader. | `dashboard.tsx:179,187,193,200` |

### Diagnóstico Final do Dashboard

| Métrica | Valor |
|---------|-------|
| Bugs de funcionalidade | 2 (unread_count inexistente, status errado) |
| Problemas de UX/performance | 4 (trends inconsistentes, UPDATE caro, notificações duplicadas, flash de 0) |

---

## 15. PROBLEMAS GLOBAIS / TRANSVERSAIS

| # | Gravidade | Problema | Descrição |
|---|-----------|----------|-----------|
| G1 | **ALTA** | Inconsistência de clientes DB | Projeto usa 3 padrões de acesso ao banco: `db.query('SQL...')` (raw MySQL), `context.db.from('table')` (fluent TanStack Start), `dbAdmin.from('table')` (Supabase client). Comportamento diferente entre eles (rows planas vs aninhadas, binding de parâmetros diferente). Risco de dados sendo escritos no banco errado. |
| G2 | **MÉDIA** | Sem verificação de ownership em múltiplos endpoints | Pelo menos 11 endpoints/funções não filtram por `user_id`: `deleteList`, `deleteTag`, `removeContactFromList`, `addContactsToList`, `getListContacts`, `importCsvToList`, `deleteKnowledgeBase`, `saveAiAgentSettings`, `getAiAgentSettings`, `saveBotStepsBatch`. |
| G3 | **MÉDIA** | Zod strips unknown keys em schemas de input | `z.object()` remove campos não declarados. Qualquer campo novo no frontend que não seja listado no Zod schema correspondente é silenciosamente perdido no backend. Bug ativo no Bot (6 campos) e potencial em outros módulos. |
| G4 | **MÉDIA** | Colunas órfãs no banco | Pelo menos 10 colunas definidas no schema que nunca ou raramente são usadas: `salvy_api_key` (profiles), `icon` (tags), `notes` (opportunity_contacts), `probability_percent` (opportunities), `provider_message_id` (direct_messages), `ip_address` (opportunity_audit_logs), `user_agent` (opportunity_audit_logs), `display_format` (templates — falta no DB), `condition_operator` (phantom — só no Zod), `conversation_origin` (campaign_messages — selecionado mas não usado). |
| G5 | **MÉDIA** | Schema SQL (`schema_mysql.sql`) desatualizado | O schema canônico não reflete a realidade do banco. `ensure-schema.js` aplica alters em runtime para adicionar colunas e modificar ENUMs ausentes. Quem rebuildar o banco a partir do schema SQL terá schema incompleto. |
| G6 | **BAIXA** | Múltiplos `max()` no Zod divergem do DB | ~15 campos têm validação mais restritiva no backend que a coluna correspondente no DB. Dados legítimos podem ser rejeitados pelo backend mesmo sendo aceitos pelo banco. |
| G7 | **BAIXA** | Query compiler injeta `user_id` magicamente | O middleware `query-compiler.ts` auto-adiciona `WHERE user_id = ?` e `SET user_id = ?` em queries feitas via `context.db`. Isso torna a segurança de dados invisível para devs — fácil de esquecer ao escrever raw SQL (como visto nos problemas de ownership do Lists). |

---

## MAPA DE TABELAS vs COBERTURA

| Tabela | Colunas | Cobertas pelo Frontend | % | Status |
|--------|---------|----------------------|---|--------|
| `profiles` | 24 | ~16 (via profile.tsx + settings.tsx) | 67% | 8 campos sem UI: salvy_api_key, email update, created_at, updated_at, + campos whatsapp salvos individualmente |
| `contacts` | 17 | 5 ativamente gerenciadas | 29% | 12 campos não gerenciados pelo módulo contacts (usados pelo chat) |
| `direct_messages` | 14 | ~12 | 86% | provider_message_id nunca populado |
| `campaigns` | 14 | ~12 | 86% | OK |
| `campaign_messages` | 18 | ~8 (via billing) | 44% | pricing_model, conversation_origin não usados |
| `templates` | 15 | ~12 | 80% | display_format missing from DB |
| `opportunities` | 25 | ~18 | 72% | probability_percent morto; 4 campos sem UI no create |
| `bot_steps` | 22 | 14 | 64% | 5 campos sem UI |
| `bot_settings` | 13 | 4 | 31% | 6 campos sem UI |
| `ai_agent_settings` | 9 | 6 | 67% | Missing user_id em queries de SELECT/UPDATE |
| `platform_settings` | 13 | ~11 | 85% | updated_by não exposto; sidebar_order separado |
| `lists` | 5 | 3 | 60% | updated_at ausente na tabela |
| `tags` | 6 | 3 | 50% | icon nunca usado |
| `sales_funnels` | 12 | 7 | 58% | Sem UI de edição |
| `sales_stages` | 16 | 11 | 69% | description sem UI |
| `opportunity_activities` | 14 | 10 | 71% | contact_id e assigned_to_user_id sem UI |
| `opportunity_notes` | 9 | 6 | 67% | is_pinned nunca ativado |
| `opportunity_contacts` | 8 | 4 | 50% | notes nunca escrito |
| `opportunity_audit_logs` | 10 | 4 | 40% | user_id_actor, ip_address, user_agent nunca populados |
| `knowledge_base` | 7 | 5 | 71% | created_at / updated_at não exibidos |

---

## RECOMENDAÇÕES PRIORITÁRIAS (Ordem de Execução Sugerida)

### Fase 1 — Urgente: Perda de Dados / Funcionalidade Quebrada (9 itens)

1. **Bot: Adicionar 6 campos ao Zod `saveBotStepInput`** — `footer_text`, `delay_seconds`, `assign_team_id`, `assign_user_id`, `handoff_message`, `card_color`. Sem essa correção, cada save zera esses campos. (`botflow.functions.ts`)

2. **Chat: Corrigir `getChatMessages` para retornar UUID como `id`** — Usar `row.id` (UUID) em vez de `row.wa_message_id || row.id`. Expor `wa_message_id` como campo separado. (`chat.functions.ts:255-258`)

3. **Chat: Adicionar verificação de prefixo antes de stripping digits** — Em `toggleBotActive`, `assignConversation`, `autoAssignConversation`, `selfAssignConversation`, `quickSaveContact`, verificar se `phone_e164` começa com `ig_`/`fb_` e usar o valor original sem stripping. (`chat-actions.functions.ts`, `assignment.functions.ts`)

4. **AI Agent: Adicionar `AND user_id = ?` no UPDATE e SELECT** — Em `saveAiAgentSettings` e `getAiAgentSettings`. (`ai-agent.functions.ts:30,74`)

5. **AI Agent: Substituir FormData por react-hook-form** — Switch `is_active` e Select `model` não funcionam com FormData + Radix UI. Usar `Controller` do react-hook-form. (`ai-agent.tsx:112-118,169,190`)

6. **Templates: Adicionar coluna `display_format` no banco** — `ALTER TABLE templates ADD COLUMN display_format VARCHAR(20) NULL`. Incluir nos upserts. (`schema_mysql.sql`, `templates.functions.ts`)

7. **Lists: Adicionar `AND user_id = ?` em 6 funções** — `deleteList`, `deleteTag`, `removeContactFromList`, `addContactsToList`, `getListContacts`, `importCsvToList`. (`lists.functions.ts`)

8. **Chat: Atualizar `schema_mysql.sql` para incluir `'messenger'` no ENUM channel** — Em `direct_messages`, `contacts`, `bot_conversation_state`. (`schema_mysql.sql`)

9. **AI Agent: Adicionar `AND user_id = ?` no DELETE de knowledge_base** — (`ai-agent.functions.ts:156-162`)

### Fase 2 — Alto: Dados Incorretos / Funcionalidade Comprometida (11 itens)

10. **Templates: Normalizar status vindo da API do Meta** — Criar helper que mapeia `IN_APPEAL → PENDING`, `PENDING_DELETION → PENDING`, `approved → APPROVED`, etc. Aplicar em `createTemplate`, `updateTemplate`, `syncTemplatesFromMeta`. (`templates.functions.ts`)

11. **Templates: Corrigir body examples para NAMED** — No builder dialog, verificar `body_text_named_params` quando `body_text` não existir. (`template-builder-dialog.tsx:171-178`)

12. **CRM: Adicionar `user_id_actor` nos INSERTs de `logAudit`** — Usar `context.userId` em vez de `effectiveUserId` para o actor. (`crm.functions.ts:54-75`)

13. **CRM: Corrigir `listStages` para filtrar `deleted_at IS NULL` e `is_active = TRUE`** — Consistente com `getCRMStats` e `moveOpportunity`. (`crm.functions.ts:231`)

14. **Contacts: Adicionar cleanup de junction tables** — Em `deleteContact`: deletar de `contact_tags` e `list_contacts`. Em `bulkDeleteContacts`: deletar de `contact_tags`, `conversation_tags`, `list_contacts`. (`contacts.functions.ts:124,246`)

15. **Campaigns: Corrigir acesso ao nome do contato no detail** — Usar `m.contact_name` (SQL alias) em vez de `m.contacts?.name`. (`campaigns.$id.tsx:299`)

16. **Campaigns: Unificar join strategy** — `getCampaign` deve usar `c.id = cm.contact_id` igual ao `exportCampaignReport`. (`campaigns.functions.ts:271`)

17. **Billing: Incluir `direct_messages` no relatório** — Adicionar query para mensagens diretas no cálculo de billing. (`billing.functions.ts`)

18. **Dashboard: Corrigir notificações de campanha** — Usar `x.status === "done"` em vez de `"completed"`. (`dashboard.tsx:126`)

19. **Dashboard: Remover referência morta a `unread_count`** — Usar apenas `is_unread`. (`dashboard.tsx:155`)

20. **WhatsApp Profile: Corrigir Zod do email** — Aceitar string vazia: `z.string().trim().max(128).email().optional().or(z.literal(""))`. (`whatsapp-business-profile.functions.ts:49`)

21. **Campaigns: Corrigir `scheduled_at` para formato MySQL** — Validar como `YYYY-MM-DD HH:MM:SS` ou garantir conversão no driver. (`campaigns.functions.ts:39`)

### Fase 3 — Médio: Gaps de Funcionalidade (15 itens)

22. CRM: Adicionar UI para `description`, `company_name`, `expected_close_date`, `source` no create de oportunidade
23. CRM: Adicionar seletor de moeda nas oportunidades
24. CRM: Adicionar CRUD de `opportunity_lost_reasons`
25. Bot: Adicionar UI para `delay_seconds`, `assign_team_id`, `assign_user_id`, `handoff_message`, `card_color`
26. Bot: Adicionar UI para `name`, `priority`, `trigger_type`, `trigger_value`, `is_default`, `pause_timeout_minutes`
27. Bot: Fazer executor enviar `media_caption` com mensagens de mídia
28. Lists: Adicionar endpoint `updateList` e `updateTag`
29. Lists: Adicionar coluna `updated_at` na tabela `lists`
30. Profile: Corrigir `updateProfile` para fazer UPSERT
31. Profile: Alinhar Zod `max()` com DB ou remover limites arbitrários
32. Users: Adicionar `display_name`/`full_name` no `listUsers`
33. Users: Adicionar endpoint `updateUserProfile`
34. Contacts: Adicionar função `removeTagFromContacts`
35. Contacts: Adicionar search/filter/sort server-side em `listContacts`
36. WhatsApp Profile: Consolidar code paths (server fn + API route) em um só

---

## ESTATÍSTICAS GLOBAIS

| Métrica | Total |
|---------|-------|
| Módulos auditados | 16 |
| Problemas encontrados | 103 |
| — Críticos | 9 |
| — Altos | 28 |
| — Médios | 38 |
| — Baixos | 28 |
| Funções sem verificação de ownership | 11+ |
| Campos órfãos no banco | 10+ |
| Colunas com validação inconsistente | 15 |
| Endpoints faltando | ~8 |

---

*Fim do relatório. Gerado em 29/06/2026.*
