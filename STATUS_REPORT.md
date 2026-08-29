# STATUS COMPLETO — WAPI Weaver V3 Meta

## RESUMO EXECUTIVO

A arquitetura V3 para Meta/WhatsApp foi implementada, validada localmente e implantada em produção. A aplicação responde via HTTPS, o schema está sincronizado, a connection V3 foi migrada a partir do legacy `profiles` e nenhum dado legado foi removido.

A próxima etapa depende exclusivamente do operador: configurar a Callback URL e Verify Token no Meta Developers e enviar/receber mensagens reais do WhatsApp.

## REPOSITÓRIO LOCAL

- Último commit local: `78c2767`
- Último commit remoto/produção: `66470d6` (reset hard para o bundle `78c2767`, mas `git rev-parse` remoto mostra `66470d6` porque o bundle HEAD não atualizou o `HEAD` local — o working tree contém o conteúdo de `78c2767`)
- Estado: limpo (nenhuma modificação unstaged)

### Build / Type-check / Testes locais

| Comando | Resultado |
|---------|-----------|
| `npm run type-check` | PASS |
| `npm run build` | PASS |
| `npx vitest run tests/meta-v3-*.test.ts` | 19 passed, 0 failed |

### O que foi entregue nas fases D–F

- `META_CREDENTIALS_ENCRYPTION_KEY` persistente, lado servidor.
- Tabelas `meta_app_connections` e `channel_connections` criadas.
- `meta_config_id` e `access_token_encrypted` adicionados.
- `channel.service.ts` reescrito V3-first com fallback legacy apenas quando não existe V3.
- `processor.server.ts` fail-closed quando `getChannelConfig` retorna `null`.
- `canonical-schema.sql`, `schema-contract.json`, `required-tables.json`, `required-columns.json` regenerados.
- Documentação `docs/CONFIGURACAO-META.md` e `docs/SEGURANCA.md` atualizadas.
- Testes `meta-v3-*` passando.

## PRODUÇÃO (103.63.28.182 / app.blivcrm.com)

### Infraestrutura

| Serviço | Status |
|---------|--------|
| Docker | OK |
| `wapi_weaver_mysql` | healthy |
| `wapi_weaver_redis` | healthy |
| `wapi_weaver_app` | running (port 3003) |
| `wapi_weaver_phpmyadmin` | running (port 8082) |

### Deploy

- Backup criado: `wapi-weaver-pre-phase-g-1788024267.sql` (7.7 MB) em `/root/backups/`
- Build Docker: PASS
- Migrations aplicadas: 034, 043, 044
- Schema parity Phase A: PASS (0 erros bloqueantes)
- App subiu e validou banco

### Variáveis de ambiente

- `APP_URL` = `https://app.blivcrm.com` (SET)
- `META_CREDENTIALS_ENCRYPTION_KEY` = SET (produção)
- `LICENSE_*` = ausentes (conforme solicitado)
- `VITE_META_APP_ID`, `VITE_META_CONFIG_ID`, `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN` = ausentes

### Connection V3 em produção

| Campo | Valor |
|-------|-------|
| `meta_app_connections.id` | `1bebeadd-aa44-4910-9819-92bd1ccf0108` |
| `public_id` | `cb608647-8c32-4a31-b69a-5c23fb84fbea` |
| `tenant_id` | `eb98852e-25a1-437a-abc8-dfa5e2632832` |
| `app_id` | `1783038629742610` |
| `status` | `pending` |
| `channel_connections.id` | `0f55ffb7-9df0-48a3-8a31-424df2d9465c` |
| `provider` | `whatsapp` |
| `external_account_id` | `1107720082434785` |
| `access_token_encrypted` | SET |

A connection foi migrada a partir do legacy `profiles` (mesmo tenant) com a chave de produção. O `public_id` de produção é **diferente** do `public_id` local.

### CRM de produção (baseline)

| Tabela | Registros |
|--------|-----------|
| contacts | 5 |
| contact_identities | 1 |
| direct_messages | 159 |
| chat_sessions | 4 |
| opportunities | 3 |
| users | 3 |

### Testes HTTPS na produção

- `GET https://app.blivcrm.com/api/public/meta-webhook/{public_id}?...verify_token=wrong` → `403`
- `POST https://app.blivcrm.com/api/public/meta-webhook/{public_id}` sem HMAC → `403`

A rota pública está acessível via HTTPS e rejeita tokens/HMAC inválidos. O teste com Verify Token correto e POST com HMAC correto **não foi concluído** por falta de credenciais visíveis durante a execução.

## O QUE ESTÁ FUNCIONANDO

1. V3 local e produção: schema, migrations, build, deploy.
2. Criptografia: `app_secret`, `webhook_verify_token` e `access_token` com `META_CREDENTIALS_ENCRYPTION_KEY` de cada ambiente.
3. Webhook V3 public route: `/api/public/meta-webhook/{public_id}`.
4. Fail-closed: V3 quebrado não cai para legacy.
5. Legacy preservado: `profiles.whatsapp_*` não foram apagados.
6. WhatsApp Channel migrated: `channel_connections` aponta para `meta_app_connections` real.
7. `APP_URL` configurado para `https://app.blivcrm.com`.

## O QUE FALTA FINALIZAR / PRÓXIMAS ETAPAS

1. **Configuração no Meta Developers**
   - Acessar o App `1783038629742610` no Meta for Developers.
   - Configurar Callback URL: `https://app.blivcrm.com/api/public/meta-webhook/cb608647-8c32-4a31-b69a-5c23fb84fbea`
   - Colar o Verify Token da connection (não foi exposto aqui; consultar no banco de produção com a chave correta se necessário).
   - Guardar o callback URL e o Verify Token em local seguro.

2. **Teste real de GET (Meta verification)**
   - Após salvar no Meta, aguardar a Meta enviar o request de verificação.
   - Validar `last_verified_at` atualizado.

3. **Teste real de inbound WhatsApp**
   - Enviar mensagem do WhatsApp para o número `1107720082434785`.
   - Confirmar:
     - `messaging_events` inserido.
     - BullMQ enfileirou.
     - Worker processou.
     - `contact` + `contact_identity` criados corretamente.
     - Mensagem aparece no Inbox/Chat.

4. **Teste real de outbound WhatsApp**
   - Responder pela UI.
   - Confirmar uso do `access_token_encrypted` V3 (não `profiles.whatsapp_access_token`).
   - Confirmar `provider_message_id` retornado.

5. **Teste real de status**
   - `sent`, `delivered`, `read` atualizados sem regredir (monotônicos).

6. **Janela de observação de 72h**
   - Monitorar `webhook_delivery_logs`, `messaging_events`, logs do worker.
   - Contar V3 vs legacy.
   - Verificar duplicatas.

7. **Possíveis pontos técnicos a conferir**
   - O `status` da `meta_app_connection` está `pending` até o primeiro GET real da Meta; após sucesso pode-se considerar `active`.
   - O Verify Token e App Secret da connection produção precisam ser acessíveis apenas server-side.
   - O worker BullMQ não foi testado com evento real.
   - O callback legacy (`/api/public/whatsapp-webhook` etc.) continua ativo, mas nada foi removido.

## ARQUIVOS GERADOS / RELATÓRIOS

- `META_V3_ENV_CLEANUP_REPORT.md`
- `META_V3_ENV_CLOSURE_REPORT.md`
- `META_V3_ENV_FINAL_VALIDATION_REPORT.md`
- `META_V3_PHASE_D3_REPORT.md`
- `META_V3_PHASE_E_REPORT.md`
- `META_V3_PHASE_F_REPORT.md`
- `STATUS_REPORT.md` (este)

## NOTAS DE SEGURANÇA

- Nenhum `App Secret`, `Access Token`, `Verify Token` ou `META_CREDENTIALS_ENCRYPTION_KEY` foi incluído neste relatório.
- A senha SSH e as chaves de criptografia dos ambientes não foram expostas.
- A senha do banco remoto não foi mostrada.
- O `.env` de produção continua em `/var/www/wapi-weaver/.env` e é respeitado pelo `docker-compose`.

## DECISÕES PENDENTES DO OPERADOR

- Quer prosseguir com a configuração no Meta Developers neste momento?
- Prefere que eu gere um comando seguro para copiar o `Verify Token` de produção sem exibi-lo?
- Há domínio/HTTPS adicional a ser validado (por exemplo, `app.blivcrm.com`)?
- Deseja ativar um worker separado ou o worker dentro do container app é suficiente?
