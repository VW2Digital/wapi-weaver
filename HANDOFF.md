# Handoff — Reconstrução do Sistema de Recebimento Omnichannel

## Status atual

Fases 1 a 9 concluídas. Arquitetura canônica implementada e commitada no branch `main`.
Type-check passando. Banco atualizado com migrations 036–040.

## O que foi entregue

### Camada canônica (`src/lib/messaging/`)

- `types.ts` — contratos provider-agnostic
- `adapters/` — WhatsApp, Instagram, Messenger
- `event-store.server.ts` — persistência idempotente em `messaging_events`
- `processor.server.ts` — pipeline de processamento
- `services/` — tenant resolution, channel, contact/identity, conversation, message, status, realtime, media, bot

### Handlers refatorados

- `src/routes/api/public/whatsapp-webhook.ts`
- `src/routes/api/public/instagram-webhook.ts`
- `src/routes/api/public/facebook-webhook.ts`

### Worker/fila

- `src/lib/queue/webhook-queue.ts` consome `messaging_events` e chama `processor.server.ts`

### Banco (migrations)

- `038_messaging_event_store.sql`
- `039_contact_identities.sql`
- `040_direct_messages_status_timestamps.sql`

### Testes

- `tests/jest/messaging/adapters.jest.test.ts` (passa)
- `tests/jest/messaging/integration.jest.test.ts` (requer DB)
- `scripts/test-webhooks/send-webhook.mjs` + payloads JSON

## Pendências para a próxima sessão

1. **Testes de integração**
   - O teste de integração ainda não passa 100% por problemas de unique key no banco.
   - Comando: `$env:DB_PASSWORD="S0xbxPfKazBVT8JFy1UEOjIsrjox"; npx jest tests/jest/messaging/integration.jest.test.ts`
   - Possível causa: `direct_messages` pode não ter a unique key `uq_direct_messages_user_wa_id` aplicada no banco real.

2. **Testar webhooks reais**
   - Usar `node scripts/test-webhooks/send-webhook.mjs <whatsapp|instagram|messenger> http://localhost:3000`
   - Substituir `PHONE_ID` / `PAGE_ID` pelos reais.
   - Verificar `messaging_events`, `contacts`, `contact_identities`, `direct_messages`.

3. **Limpar duplicatas em `chat_sessions` e adicionar `UNIQUE`**
   - Migration 037 já sinalizou duplicados.
   - Criar migration `041_chat_sessions_unique.sql` após limpeza.

4. **Remover código legado de `whatsapp-webhook.ts`**
   - `processMetaWebhookEvent` e funções auxiliares não são mais usadas pela rota.

5. **BullMQ/Redis**
   - Validar que `webhookWorker` consome eventos corretamente.

## Comandos úteis para retomar

```bash
# Verificar tipos
npm run type-check

# Aplicar migrations
npm run db:migrate

# Testes
npx jest tests/jest/messaging/adapters.jest.test.ts
$env:DB_PASSWORD="S0xbxPfKazBVT8JFy1UEOjIsrjox"; npx jest tests/jest/messaging/integration.jest.test.ts

# Webhook de teste
node scripts/test-webhooks/send-webhook.mjs whatsapp http://localhost:3000
```

## Notas

- `npm run type-check` deve continuar passando após qualquer alteração.
- Não modificar `database/schema/canonical-schema.sql` sem refletir em migration.
- Não executar limpeza de duplicatas sem confirmar com o usuário (operação destrutiva).
