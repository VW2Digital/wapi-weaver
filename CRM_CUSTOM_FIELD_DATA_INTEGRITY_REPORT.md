# CRM Custom Field Data Integrity — Fase 3 Report

## Objetivo
Tornar os campos personalizados do CRM resilientes a perda de dados, garantir
um único caminho canônico de escrita/leitura, validar tipos e opções,
respeitar isolamento multi-tenant e proteger contra conflitos de atualização
concorrentes entre canais (inbound messaging, UI, bot, import, webhooks).

## Baseline
- Commit baseline: `72cc7ffe0f8f89e237fdafa1d9cebceb25bcd1d8`
- `npm run guard:omnichannel` → PASS
- `npx tsc --noEmit` → PASS
- `npm run build` → PASS
- `npm run lint` → ainda apresenta erros de `prettier/prettier` em CRLF em
  arquivos pré-existentes fora do escopo; os arquivos alterados nesta fase
  (`contact-custom-field.service.ts` e teste) passam no lint local.
- Testes de regressão:
  - `tests/jest/crm-contact` → 37 PASS (3 suites)
  - `tests/jest/omnichannel-golden-path`, `omnichannel-next`,
    `inbox-webchat-integration`, `webchat` → 312 PASS (45 suites)

## Auditoria de dados

### Tabelas envolvidas
| Tabela | Papel | Observações |
|--------|-------|-------------|
| `contact_custom_fields` | Definições dos campos personalizados do CRM | `user_id` + `key` unique (`uq_user_field`); tem `tenant_id` e `type` ENUM ampliado. |
| `contact_custom_field_values` | Valores canônicos por contato | Unique `(user_id, contact_id, custom_field_id)` (`uq_contact_field`); colunas `value` e `value_json`. |
| `contacts.custom_fields` | Cache/compatibilidade JSON legado | Armazena avatar e metadados de provedor (`wa_id`, `instagram_username`, etc.). Atualizado de forma a preservar chaves desconhecidas. |
| `custom_fields` (legada) | Tabela antiga não usada | Vazia em produção/local (`0` linhas); não faz parte do source of truth. |

### Inventário de dados legados (banco local de teste)
- `legacy custom_fields rows`: 0
- `contact_custom_fields rows`: 2 (definições modernas)
- `contact_custom_field_values rows`: 1
- `contacts with custom_fields JSON not null`: 8
- Chaves encontradas em `contacts.custom_fields`: `avatar_url`, `display_phone_number`, `email`, `phone`, `phone_number_id`, `source`, `wa_id`.

Conclusão: as chaves no JSON atual são **metadados de provedor** (avatar,
identificadores de canal). Os valores de CRM custom fields estão migrando para
`contact_custom_field_values`, que é o source of truth.

### Writers/Readers mapeados
**Writers principais:**
- `src/lib/services/contact-custom-field.service.ts` (novo) — caminho canônico.
- `src/lib/custom-fields.functions.ts` — `saveContactCustomFieldValues` delega para o service.
- `src/lib/services/contacts.service.ts` — `createContactForUser`/`updateContactForUser` sincronizam JSON → relacional.
- `src/lib/messaging/services/contact-identity.service.ts` — `ensureContact` (inbound messaging).
- `src/lib/botflow-control.ts` — `executeSaveVariable` (bot).
- `src/lib/contacts.functions.ts` — `bulkUpsertContacts` (import CSV/webhook).
- `src/lib/webhooks.server.ts` — `ensureContactFromWebhook` + insert manual em `contact_custom_field_values`.
- `src/routes/api/public/whatsapp-webhook.ts` — `dbAdmin.from("contacts").update({ custom_fields })`.

**Readers principais:**
- `src/lib/custom-fields.functions.ts` — `getCustomFieldValuesBatch` delega para o service.
- `src/routes/_app/contacts.index.tsx` — `getCustomFieldValuesBatch`.
- `src/routes/_app/contacts.$id.tsx` — `getCustomFieldValuesBatch`.
- `src/lib/crm.functions.ts` — ainda lê `contacts.custom_fields` (cache JSON mantido sincronizado).
- `src/lib/lists.tsx`, `dashboard.tsx` — leitura ocasional do JSON.

## Decisões de arquitetura
1. **Source of truth:** `contact_custom_field_values` + `contact_custom_fields`.
2. **Cache/compatibilidade:** `contacts.custom_fields` JSON continua sendo
   atualizado para manter leitores legados (CRM, listas) funcionando sem
   refatoração imediata.
3. **Escrita atômica:** toda atualização canônica usa `FOR UPDATE` sobre a linha
   do contato dentro de uma transação.
4. **Partial update:** apenas os campos enviados são alterados/removidos; os
   demais são preservados.
5. **Validação:** tipo, e-mail, número, data, `select`/`multi_select` e
   opções são validados antes de persistir.
6. **Tenant isolation:** toda query filtra por `user_id` do tenant efetivo e
   verifica se a definição e o contato pertencem ao tenant.
7. **Proteção contra prototype pollution:** chaves `__proto__`, `prototype` e
   `constructor` são rejeitadas.

## Mudanças realizadas

### 1. `src/lib/services/contact-custom-field.service.ts` (novo)
- `validateCustomFieldValue(def, value)` — validação centralizada por tipo.
- `setContactFieldValues(tenantId, contactId, values)` — upsert/delete canônico
  com `FOR UPDATE` e sincronização do JSON `contacts.custom_fields`.
- `getContactFieldValues(tenantId, contactId)` — leitura canônica.
- `getContactFieldValuesBatch(tenantId, contactIds)` — leitura batch para UI.
- `syncContactFieldValuesFromJson(tenantId, contactId, customFieldsJson)` —
  helper para callers legados que ainda enviam `custom_fields` JSON.

### 2. `src/lib/custom-fields.functions.ts`
- `getCustomFieldValuesBatch` delega para o service.
- `saveContactCustomFieldValues` delega para o service, ganhando validação,
  isolamento e sincronização JSON.

### 3. `src/lib/services/contacts.service.ts`
- `createContactForUser` e `updateContactForUser` agora chamam
  `syncContactFieldValuesFromJson` após atualizar `contacts.custom_fields`.
- `updateContactForUser` mescla o JSON recebido com o existente antes de
  sobrescrever, preservando metadados de provedor.

### 4. `src/lib/messaging/services/contact-identity.service.ts`
- `ensureContact` usa `JSON_MERGE_PATCH(COALESCE(custom_fields, '{}'), ...)` no
  `ON DUPLICATE KEY UPDATE`, garantindo que metadados inbound não apaguem campos
  personalizados existentes.
- Preserva `name` e `email` existentes com `COALESCE(name, VALUES(name))`.
- Limpa chaves `undefined` e chaves perigosas do payload JSON.

### 5. `src/lib/botflow-control.ts`
- `executeSaveVariable` no escopo `contact` tenta primeiro gravar via
  `ContactCustomFieldService` quando a chave corresponde a uma definição de
  campo personalizado.
- Chaves desconhecidas continuam sendo salvas no JSON legado, mas com
  `JSON_MERGE_PATCH(...)` para não apagar outras chaves.

### 6. `src/lib/contacts.functions.ts`
- `bulkUpsertContacts` altera o `ON DUPLICATE KEY UPDATE` de `custom_fields` para
  usar `JSON_MERGE_PATCH(COALESCE(custom_fields, '{}'), VALUES(custom_fields))`.

### 7. `tests/jest/crm-contact/custom-field-data-integrity.jest.test.ts` (novo)
Cobertura:
- Atualização parcial preserva campos não enviados.
- Limpeza explícita (`null`) remove o valor sem tocar nos demais.
- `ensureContact` não apaga `custom_fields` nem sobrescreve `name` manual.
- `ensureContact` mescla múltiplas chaves de provedor (`wa_id`, `source`, etc.).
- `updateContactForUser` sincroniza campos do JSON para a tabela canônica.
- Bot grava em campo canônico e preserva campos existentes.
- Variáveis desconhecidas do bot fazem merge seguro no JSON.
- Escrita cross-tenant é bloqueada (contato de outro tenant).
- Definição de outro tenant não pode ser usada.
- Validação de tipo (número inválido, formato BR `1.234,56`).
- Validação de `select` rejeita opção não autorizada.
- Prototype pollution (`__proto__`) é rejeitado.
- Leitura batch retorna valores canônicos.

## Evidência de execução

```bash
$ npm run guard:omnichannel
OMNICHANNEL FREEZE: PASS (no protected changes since baseline)

$ npx tsc --noEmit
(exit 0)

$ npm run build
✓ built in 15.18s

$ node --env-file=.env.validation ./node_modules/jest/bin/jest.js tests/jest/crm-contact --runInBand --forceExit
Test Suites: 3 passed, 3 total
Tests:       37 passed, 37 total

$ node --env-file=.env.validation ./node_modules/jest/bin/jest.js tests/jest/omnichannel-golden-path tests/jest/omnichannel-next tests/jest/inbox-webchat-integration tests/jest/webchat --runInBand --forceExit
Test Suites: 45 passed, 45 total
Tests:       312 passed, 312 total
```

## Fora de escopo / débito técnico remanescente
- `src/lib/crm.functions.ts`, `lists.tsx` e `dashboard.tsx` ainda leem
  `contacts.custom_fields` JSON. Como o JSON agora é mantido sincronizado com
  a tabela canônica, esses leitores continuam funcionando, mas devem migrar
  para `getContactFieldValues*` em uma fase futura.
- `src/lib/contacts.functions.ts` `bulkUpsertContacts` protege o JSON contra
  perda, mas ainda não sincroniza campos personalizados do JSON para
  `contact_custom_field_values` durante importações em massa. Se o CSV mapear
  campos personalizados, é recomendado chamar
  `syncContactFieldValuesFromJson` por contato após o upsert.
- `src/lib/webhooks.server.ts` insere manualmente em
  `contact_custom_field_values` sem passar pelo service; continua validando
  ownership, mas não realiza validação de tipo. Migração para o service pode ser
  feita futuramente.
- `npm run lint` global ainda falha por problemas de `prettier/prettier` em
  arquivos com CRLF que não foram alterados nesta fase.

## Arquivos alterados
- `src/lib/services/contact-custom-field.service.ts` (novo)
- `src/lib/custom-fields.functions.ts`
- `src/lib/services/contacts.service.ts`
- `src/lib/messaging/services/contact-identity.service.ts`
- `src/lib/botflow-control.ts`
- `src/lib/contacts.functions.ts`
- `tests/jest/crm-contact/custom-field-data-integrity.jest.test.ts` (novo)
- `CRM_CUSTOM_FIELD_DATA_INTEGRITY_REPORT.md` (este arquivo)
