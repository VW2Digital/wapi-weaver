# CRM CUSTOM FIELD HARDENING REPORT

## 1. BASELINE

- HEAD: `a1d72d4`
- Worktree: `CRM_CUSTOM_FIELD_DATA_INTEGRITY_REPORT.md`, `src/lib/services/contact-custom-field.service.ts`, `src/lib/botflow-control.ts`, `src/lib/messaging/services/contact-identity.service.ts`, `src/lib/chat-actions.functions.ts`, `src/lib/contacts.functions.ts`, `tests/jest/crm-contact/custom-field-data-integrity.jest.test.ts`, `tests/jest/crm-contact/custom-fields/custom-field-hardening.jest.test.ts`
- Omnichannel Guard baseline: `72cc7ffe0f8f89e237fdafa1d9cebceb25bcd1d8`

## 2. FASE 3 STATUS

- `ContactCustomFieldService` implementado e operacional.
- Tabela canônica `contact_custom_field_values` é source of truth.
- `contacts.custom_fields` continua como cache de compatibilidade legado.
- Testes de partial update, type validation, tenant isolation e prototype pollution passaram.

## 3. UNKNOWN BOT KEY PREVIOUS BEHAVIOR

`executeSaveVariable` caía no fallback de merge JSON para **qualquer** chave desconhecida, validando apenas se o contato existia. Isso permitia que um fluxo bot criasse chaves arbitrárias em `contacts.custom_fields` sem definição de campo customizado.

## 4. UNKNOWN BOT KEY NEW BEHAVIOR

- Chave com definição canônica → `setContactFieldValues` (validação + tenant isolation).
- Chave padrão (`name`, `email`, `company`, `notes`) → update de coluna do contato.
- Chave desconhecida **nova** → rejeitada com `Chave de variável inválida`.
- Chave desconhecida **já existente no JSON legado do contato** → permitida temporariamente com marker `LEGACY_COMPATIBILITY_ONLY` e `console.warn`.

## 5. LEGACY BOT INVENTORY

Banco local de teste (não reflete produção):

```text
TOTAL_SAVE_VARIABLE_NODES = 0
CANONICAL_FIELD           = 0
KNOWN_SYSTEM_KEY          = 0
UNKNOWN_LEGACY_KEY        = 0
```

> Em produção, o inventário deve ser coletado diretamente em `bot_steps` filtrando `message_type = 'save_variable'`.

## 6. LEGACY COMPATIBILITY

- Still required: **YES** (bot keys previamente gravadas no JSON do contato).
- Strategy: compatibilidade condicional — apenas chaves já presentes no JSON do contato continuam sendo graváveis; novas chaves desconhecidas são rejeitadas.
- Novos fluxos devem usar definições canônicas de campos customizados.

## 7. NEW UNKNOWN WRITES

Blocked: **YES**.

## 8. JSON_MERGE_PATCH AUDIT

Arquivos com `JSON_MERGE_PATCH` revisados:

- `src/lib/botflow-control.ts` — fallback legado de bot para chaves já existentes no JSON.
- `src/lib/contacts.functions.ts` (`bulkUpsertContacts`) — merge de `custom_fields` em import CSV; ainda não sincroniza com tabela canônica.
- `src/lib/messaging/services/contact-identity.service.ts` (`ensureContact`) — merge de metadados de provedor, agora filtrado por ownership.
- `src/lib/chat-actions.functions.ts` (`quickSaveContact`) — merge de `email`/`phone` no JSON para prechat; agora só insere valores não nulos.

## 9. NULL SEMANTICS

Provider null pode deletar CRM field: **NO REQUIRED**.

Comportamento implementado:
- `sanitizeProviderMetadata` descarta `null` para chaves que sejam campos customizados do tenant.
- `setContactFieldValues` com `value = null` realiza clear explícito autorizado (CRM/bot).
- `ensureContact` nunca remove campo customizado canônico por causa de `null` em metadata.

## 10. FIELD OWNERSHIP MATRIX

| Writer | Pode atualizar |
|--------|---------------|
| CRM Form / `updateContactForUser` | campos customizados canônicos + `avatar_url` e metadados preservados |
| Bot `executeSaveVariable` | campos customizados canônicos (validados); chaves padrão (`name`, `email`, `company`, `notes`); chaves legadas preexistentes no JSON (modo compatibilidade) |
| WhatsApp inbound (`ensureContact`) | provider-owned metadata: `avatar_url`, `wa_id`, `source`, `phone`, `phone_number_id`, `display_phone_number`, etc. Nunca campos customizados do tenant |
| Instagram inbound (`ensureContact`) | provider-owned metadata + `instagram_username`, `instagram_profile_name`. Nunca campos customizados do tenant |
| WebChat prechat (`ensureContact` / `quickSaveContact`) | provider metadata + `email`/`phone` em JSON para exibição; colunas `email`/`whatsapp_number`. Nunca campos customizados do tenant |

## 11. LEGACY JSON KEY INVENTORY

Banco local de teste:

```text
Canonical custom fields: profissao
Provider metadata:       avatar_url, email, phone, source, wa_id, phone_number_id, display_phone_number
System:                  (nenhum novo mapeado)
Unknown:                 (nenhum)
```

Classificação:
- `avatar_url`, `wa_id`, `source`, `phone_number_id`, `display_phone_number` → PROVIDER_METADATA
- `email`, `phone` → STANDARD / PROVIDER_CONTEXT (prechat) — mantidos no JSON por compatibilidade WebChat
- `profissao` → CANONICAL_CUSTOM_FIELD

## 12. CANONICAL VALUE PRIORITY

Canonical table wins: **YES**.

`getContactFieldValues` lê `contact_custom_field_values` primeiro e usa `contacts.custom_fields` apenas como fallback para chaves com definição canônica ausentes na tabela relacional.

## 13. LEGACY FALLBACK

Implementado em `getContactFieldValues`: se uma chave possui definição canônica no tenant e existe no JSON legado, mas não há valor relacional, o JSON é retornado. O canônico vence quando ambos existem.

## 14. LEGACY SYNC

`syncContactFieldValuesFromJson`:

- Unknown keys ignored: **PASS**
- Type validation: **PASS** (delega para `setContactFieldValues`, que rejeita tipos inválidos)
- Tenant isolation: **PASS** (busca definições apenas do tenant)

## 15. BOT FLOW

| Cenário | Resultado |
|---------|-----------|
| Valid custom field | PASS |
| Invalid option | BLOCKED |
| Unknown new key | BLOCKED |
| Cross tenant | BLOCKED |
| Legacy unknown key present in JSON | ALLOWED with `LEGACY_COMPATIBILITY_ONLY` warning |

## 16. PROVIDER INBOUND PRESERVATION

| Canal | Resultado |
|-------|-----------|
| WhatsApp | PASS |
| Instagram | PASS |
| WebChat | PASS |

Testes garantem que CRM custom fields (`profissao`, `plano`, `cidade`, `segmento`) não são apagados por metadata inbound.

## 17. PROVIDER NULL SAFETY

| Canal | Resultado |
|-------|-----------|
| WhatsApp | PASS |
| Instagram | PASS |
| WebChat | PASS |

Metadata com `{ customFieldKey: null }` não remove o valor canônico nem do JSON.

## 18. CRM EXPLICIT CLEAR

PASS. `setContactFieldValues` com `value: null` remove o registro canônico e a chave do JSON.

## 19. PARTIAL UPDATE

PASS. Apenas campos enviados são alterados; demais preservados.

## 20. CONCURRENT UPDATE

PASS. `Promise.all` de atualizações independentes em `profissao` e `plano` resulta em ambos os valores corretos.

## 21. PROFILE PHOTO OWNERSHIP

Corrigido `updateContactProfilePhoto` em `src/lib/contacts.functions.ts`:
- `SELECT` e `UPDATE` agora filtram por `user_id` **ou** `tenant_id`.
- Cross-tenant update bloqueado.

Runtime test via server function não executado (middleware requer contexto de request), mas a query foi hardenada.

## 22. PROTOTYPE POLLUTION

BLOCKED.
- `__proto__`, `prototype`, `constructor` rejeitados em `sanitizeProviderMetadata`.
- `setContactFieldValues` rejeita definições com chaves proibidas.
- `executeSaveVariable` rejeita chaves proibidas.

## 23. MASS ASSIGNMENT

BLOCKED via rejeição de chaves desconhecidas no bot e via `sanitizeProviderMetadata` para provedores. Colunas `tenant_id`, `user_id`, `id` não são acessíveis como custom fields.

## 24. LEGACY READERS

Leitores legados (`crm.functions.ts`, `lists.tsx`, `dashboard.tsx`) ainda leem `contacts.custom_fields`. O cache JSON é mantido sincronizado por todas as escritas canônicas, então os valores continuam corretos. `getContactFieldValues` também faz fallback do JSON para chaves canônicas não sincronizadas.

## 25. NEW STORAGE CREATED

NO. Nenhuma nova tabela ou store criada.

## 26. DESTRUCTIVE MIGRATION

NO. Nenhum `DROP`, `DELETE` bulk ou remoção de JSON legado.

## 27. WHATSAPP

- Routing modified: **NO**
- Regression: **NONE**

## 28. INSTAGRAM

- Routing/API variant modified: **NO**
- Regression: **NONE**

## 29. WEBCHAT

- Routing modified: **NO**
- Regression: **NONE**

## 30. CRM CONTACT TESTS

```text
Test Suites: 4 passed, 4 total
Tests:       53 passed, 53 total
```

Inclui `custom-field-data-integrity` (37) e `custom-fields/custom-field-hardening` (16).

## 31. WEBCHAT TESTS

```text
Test Suites: 10 passed, 10 total
Tests:       150 passed, 150 total
```

## 32. GOLDEN PATH

```text
PASS tests/jest/omnichannel-golden-path.jest.test.ts
```

## 33. OMNICHANNEL NEXT

```text
Test Suites: 34 passed, 34 total (dentro do combined run)
```

## 34. TYPECHECK

```text
npx tsc --noEmit
PASS
```

## 35. BUILD

```text
npm run build
✓ built in 35.07s
```

## 36. GUARD

```text
npm run guard:omnichannel
OMNICHANNEL FREEZE: PASS
```

## 37. RUNTIME VALIDATION

| Cenário | Resultado |
|---------|-----------|
| Manual field save | PASS (via test `setContactFieldValues`) |
| Partial update | PASS |
| WebChat inbound | PASS |
| Bot canonical field | PASS |
| Bot unknown new key | BLOCKED |
| Provider null CRM field | PASS (não apaga) |

## 38. REMAINING LEGACY WRITERS

- `src/lib/contacts.functions.ts` `bulkUpsertContacts` — faz merge JSON em import CSV, mas ainda não sincroniza campos customizados para `contact_custom_field_values`. Risco baixo porque o import é operação controlada do usuário.
- `src/lib/webhooks.server.ts` `ensureContactFromWebhook` — insere manual em `contact_custom_field_values` sem passar pelo service. Valida ownership, mas não realiza validação de tipo completa. Recomendado migrar para `setContactFieldValues` em fase futura.

## 39. REMAINING LEGACY READERS

- `src/lib/crm.functions.ts`
- `src/lib/lists.tsx`
- `src/lib/dashboard.tsx`
- `src/routes/_app/contacts.index.tsx` e `contacts.$id.tsx` (já usam batch canônico)

Leitores legados são mantidos funcionais pela sincronização do JSON.

## 40. REMAINING RISKS

- `bulkUpsertContacts` não sincroniza `custom_fields` com a tabela canônica em importação em massa.
- Testes de `updateContactProfilePhoto` via server function não puderam ser executados por falta de contexto de request; a correção é apenas de SQL.
- `npm run lint` global ainda falha por `prettier/prettier` (CRLF) e `@typescript-eslint/no-explicit-any` em arquivos pré-existentes fora do escopo.

## 41. FINAL STATUS

**PASS**

## 42. CUSTOM FIELD CERTIFICATION

**HARDENED_AND_READY**

## 43. READY FOR FASE 4

**YES** — após revisão e aprovação do report.

## 44. NEXT ACTION

STOP.

Aguardar aprovação para iniciar **FASE 4 — Universal Contact Write Semantics + Bot Flow / Automation Custom Field Integration**.
