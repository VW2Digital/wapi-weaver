# Disparador WhatsApp Cloud API — MVP completo

Painel web + backend Lovable Cloud + fila de envio + integração real com a WhatsApp Cloud API da Meta.

## Fluxo

```text
Painel / Upload CSV / API externa
        ↓
Backend (server functions + Postgres)
        ↓
Fila campaign_messages (status: pending → sending → sent/failed/delivered/read)
        ↓
Worker disparador → graph.facebook.com/v20.0/{PHONE_ID}/messages
        ↓
Webhook Meta → /api/public/whatsapp-webhook → atualiza status
```

## Stack

- **Auth**: email/senha + Google (Lovable Cloud)
- **DB**: Postgres com RLS por `auth.uid()`
- **Filas**: tabela `campaign_messages` consumida por server function `processQueue` (chamada após criar campanha + endpoint cron `/api/public/cron/process-queue` protegido por `CRON_SECRET`)
- **Webhook Meta**: `/api/public/whatsapp-webhook` (GET verify_token + POST status updates, assinatura `X-Hub-Signature-256`)
- **Ingestão CRM externo**: `/api/public/contacts/ingest` com `X-API-Key` por usuário

## Schema

- `profiles` (id, display_name, whatsapp_phone_number_id, whatsapp_waba_id, api_key) — token de acesso fica em **secret** global `WHATSAPP_ACCESS_TOKEN`
- `contacts` (id, user_id, phone_e164, name, email, custom_fields jsonb, opted_out)
- `tags` (id, user_id, name, color)
- `contact_tags` (contact_id, tag_id)
- `lists` (id, user_id, name, description)
- `list_contacts` (list_id, contact_id)
- `templates` (id, user_id, meta_template_name, language, category, components jsonb, status) — sincronizados da Meta
- `campaigns` (id, user_id, name, template_id, list_id, message_type [template|text|media|interactive], payload jsonb, scheduled_at, status [draft|queued|running|done|failed], totals jsonb)
- `campaign_messages` (id, campaign_id, contact_id, to_phone, status, wa_message_id, error jsonb, sent_at, delivered_at, read_at, attempts)
- `webhook_events` (id, raw jsonb, processed_at) — auditoria

Todas com RLS `user_id = auth.uid()` exceto webhook_events (service role).

## Server functions (src/lib/*.functions.ts)

- `uploadContactsCsv` — parse CSV/XLSX, normaliza E.164, upsert por (user_id, phone)
- `createContact`, `updateContact`, `deleteContact`
- `createList`, `addContactsToList`, `createTag`
- `syncTemplates` — GET `/{WABA_ID}/message_templates` da Meta
- `createCampaign` — valida, expande lista → cria N `campaign_messages` pending, agenda
- `processQueue` — pega batch (até N), envia para Meta com rate-limit (~80 msg/s configurável), retry com backoff
- `getCampaignStats` — agrega status
- `getMetaCredentialsStatus` — verifica se token + phone_id estão ok (ping `/me`)

## Server routes (src/routes/api/public/*)

- `whatsapp-webhook.ts` — verify + status callback (assinatura HMAC com `WHATSAPP_APP_SECRET`)
- `contacts/ingest.ts` — POST com `X-API-Key` → cria contato no CRM
- `cron/process-queue.ts` — chama `processQueue` (header `X-Cron-Secret`)

## Secrets necessários

- `WHATSAPP_ACCESS_TOKEN` (System User permanente)
- `WHATSAPP_APP_SECRET` (para validar assinatura do webhook)
- `WHATSAPP_VERIFY_TOKEN` (string que você define e cola na Meta)
- `CRON_SECRET` (gerado para proteger o endpoint)

Phone Number ID e WABA ID ficam no `profiles` para suportar múltiplos usuários.

## UI (rotas)

- `/login` — email/senha + Google
- `/` (autenticada) — dashboard com cards: contatos, listas, templates aprovados, campanhas últimas 30d, taxa de entrega/leitura
- `/contacts` — tabela + filtros + tags + upload CSV/XLSX + cadastro manual
- `/lists` — CRUD listas, adicionar contatos por filtro/tag
- `/templates` — lista templates sincronizados da Meta, botão "Sincronizar agora"
- `/campaigns` — lista + nova campanha (wizard: 1.tipo de mensagem 2.template ou conteúdo 3.lista/segmento 4.agendamento 5.revisão) + detalhe com progresso e status por contato
- `/settings` — credenciais Meta (Phone Number ID, WABA ID), API key para ingestão externa, webhook URL + verify token para colar no Meta App

## Design

Visual sério/SaaS profissional: sidebar escura, conteúdo claro, verde WhatsApp como accent (`oklch(0.72 0.17 150)`), tipografia Inter+Sora, tokens em `src/styles.css`. Shadcn customizado, tabelas densas, badges de status coloridas.

## Fora do MVP (próximas iterações)

- Inbox bidirecional (responder mensagens recebidas)
- Editor visual de templates + submissão para aprovação Meta
- Webhooks para Zapier/Make
- Multi-número por usuário
- A/B testing de templates

## Ordem de execução

1. Ativar Lovable Cloud + secrets
2. Migrations (todas as tabelas + RLS + trigger profile)
3. Auth (login + rota protegida `_authenticated`)
4. Design system + layout (sidebar)
5. Settings (credenciais + API key)
6. Contacts (CRUD + upload CSV)
7. Lists + Tags
8. Templates (sync com Meta)
9. Campaigns (criar + worker `processQueue`)
10. Webhook público + atualização de status
11. Endpoint público de ingestão externa
12. Dashboard com métricas

Vou implementar tudo nessa ordem em um único loop. Você só vai precisar:
- Confirmar a ativação do Cloud
- Colar `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_SECRET` e definir um `WHATSAPP_VERIFY_TOKEN` quando eu pedir
- Configurar a URL do webhook no painel da Meta (eu mostro qual é) depois do deploy
