# META V3 — ENV CLEANUP REPORT

## REMOVED GLOBAL META ENV VARIABLES

- `VITE_META_APP_ID`: REMOVED
- `VITE_META_CONFIG_ID`: REMOVED
- `META_APP_SECRET`: REMOVED
- `META_WEBHOOK_VERIFY_TOKEN`: REMOVED

## INFRASTRUCTURE ENV

- `META_CREDENTIALS_ENCRYPTION_KEY`: REQUIRED (mantido no `.env` e `install.sh`)

## META CONFIG STORAGE

- App ID: database / `meta_app_connections.app_id`
- Config ID: database / `meta_app_connections.meta_config_id` (adicionado via migration 043)
- App Secret: database encrypted / `meta_app_connections.app_secret_encrypted`
- Verify Token: database encrypted / `meta_app_connections.webhook_verify_token_encrypted`

## PLATFORM SETTINGS

- Runtime dependency: LEGACY / DEPRECATED (ainda lido pelos webhooks legados, mas sem fallback de ENV)
- Legacy only: YES

## PROFILES LEGACY

- Runtime dependency: ainda usado pelos webhooks legados para `whatsapp_app_secret` e `whatsapp_verify_token`
- Nenhum código novo V3 deve depender dele

## INSTAGRAM LEGACY

- `instagram_accounts.app_secret` ainda pode ser usado pelos webhooks legados
- Webhook V3 `meta-webhook.$publicId` resolve tudo via `meta_app_connections`

## WEBHOOK POST

- Global secret fallback: NO
- Connection secret: YES (em `meta-webhook.$publicId` via `getMetaAppConnectionByPublicId`)
- Webhooks legados ainda podem usar `platform_settings` / `profiles` / `instagram_accounts` (sem ENV)

## WEBHOOK GET

- Global verify token fallback: NO
- Connection verify token: YES (em `meta-webhook.$publicId`)
- Webhooks legados ainda usam `validateWebhookVerifyToken` sem fallback de ENV

## FRONTEND

- Global VITE App ID dependency: NO
- Global VITE Config ID dependency: NO
- Tenant scoped configuration: YES (busca `app_id` e `meta_config_id` de `meta_app_connections`)

## DOCKER

- Verificar manualmente `docker-compose.yml`, `docker-compose.production.yml`, `Dockerfile` e entrypoints para remover quaisquer referências restantes às variáveis removidas.
- `META_CREDENTIALS_ENCRYPTION_KEY` deve estar disponível no backend/worker.

## INSTALLER

- Global Meta credential generation: NO
- Encryption key configured: YES (gera `META_CREDENTIALS_ENCRYPTION_KEY` se ausente)

## TEST WITHOUT OLD ENV

- `npm run type-check`: PASS
- `npm run build`: PASS
- Aplicação inicia sem as variáveis removidas: não testado em runtime
- GET V3 / POST V3: não testado em runtime

## MULTI-TENANT

- Tenant A/B config isolation: implementado em `meta-webhook.$publicId` via `channel_connections` cross-check
- Cross-tenant: não testado em runtime

## GLOBAL SEARCH (src/)

- `VITE_META_APP_ID` runtime refs: 0 (apenas comentários)
- `VITE_META_CONFIG_ID` runtime refs: 0 (apenas comentários)
- `META_APP_SECRET` runtime refs: 0 (apenas comentários e mensagens de erro)
- `META_WEBHOOK_VERIFY_TOKEN` runtime refs: 0 (apenas comentários)

## LEGACY DATA DELETED

- NO

## DESTRUCTIVE OPERATIONS

- NONE

## ENV ARCHITECTURE STATUS

- CORRECT FOR MULTI-TENANT SAAS (em progresso — webhooks legados ainda existem e usam sources legados, mas sem ENV)

## ARQUIVOS ALTERADOS

1. `.env.example` — removidas `VITE_META_APP_ID`, `VITE_META_CONFIG_ID`, `META_APP_SECRET`
2. `install.sh` — removida leitura/escrita de credenciais Meta globais; adicionado `META_CREDENTIALS_ENCRYPTION_KEY`
3. `src/lib/messaging/services/platform-config.service.ts` — removidos fallbacks de ENV
4. `src/lib/messaging/services/meta-app-connection.service.ts` — adicionado `meta_config_id`
5. `src/lib/profile.functions.ts` — adicionada `getDefaultMetaAppConnectionForEmbeddedSignup`
6. `src/lib/whatsapp-business-profile.functions.ts` — usa `meta_app_connections` para App ID/Secret
7. `src/lib/messaging/services/channel.service.ts` — removido `process.env.META_APP_SECRET`
8. `src/routes/_app/settings.tsx` — remove `import.meta.env.VITE_META_*`; busca conexão do tenant
9. `database/migrations/043_add_meta_config_id_to_meta_app_connections.sql` — nova migration
10. `database/schema/required-columns.json` — adicionado `meta_config_id` em `meta_app_connections`
