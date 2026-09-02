# FASE 4 — Universal Contact Write Semantics (Lead Field Layer)

## 1. OBJETIVO

Introduzir uma camada universal de escrita/leitura de campos de Lead no CRM, substituindo (e mantendo compatibilidade com) os caminhos legados de string solta usados pelos nós de bot:

- `save_variable` com `key` textual
- `condition` com comparação puramente textual (`left`/`right`)
- `resolveTemplate` lendo `contact.custom_fields` JSON

O novo contrato é `LeadFieldReference`:

```ts
type LeadFieldReference =
  | { kind: "standard"; field: StandardLeadField }
  | { kind: "custom"; field: string /* fieldDefinitionId or key */ };
```

## 2. ARQUITETURA ENTREGUE

```
┌─────────────────────────────────────────────────────────────┐
│  Bot Flow Editor (StepInspector.tsx)                        │
│  - Lead Field picker em "Salvar Variável"                   │
│  - Lead Field picker em "Condição"                          │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  LeadFieldService (src/lib/services/lead-field.service.ts)  │
│  - listLeadFields(tenantId)                                   │
│  - getLeadFieldValue(tenantId, contactId, ref)              │
│  - setLeadFieldValue(tenantId, contactId, ref, value)       │
└──────────────────────┬──────────────────────────────────────┘
                       │
           ┌───────────┴───────────┐
           ▼                       ▼
   Standard fields            Custom fields
   (contacts table)           (contact_custom_field_values)
```

### 2.1 Lead Field Registry

Local: `src/lib/services/lead-field.service.ts`

Campos padrão expostos:

| key                     | coluna              | tipo      | validação extra |
|-------------------------|---------------------|-----------|-----------------|
| `name`                  | `name`              | text      | —               |
| `email`                 | `email`             | email     | regex           |
| `phone`                 | `phone_e164`/`whatsapp_number` | phone | `normalizeToE164` |
| `company`               | `company`           | text      | —               |
| `position`              | `position`          | text      | —               |
| `notes`                 | `notes`             | textarea  | —               |
| `responsible_user_id`   | `responsible_user_id`| user     | existência no tenant |

Campos custom vem de `contact_custom_fields` (`is_active = 1`) do tenant.

### 2.2 Universal Writer

`setLeadFieldValue`:

1. Valida posse do tenant.
2. Para `standard`: valida tipo (`email`, `phone`, `responsible_user_id`) e atualiza as colunas corretas.
3. Para `custom`: resolve definição ativa e delega para `setContactFieldValues` (validação de tipo/options inclusa).
4. Telefone em contatos `webchat` preserva `phone_e164 = null` e atualiza `whatsapp_number`, sem alterar `channel`.
5. Telefone em contatos WhatsApp atualiza `phone_e164` e `whatsapp_number` e `normalized_phone`.

### 2.3 Universal Reader

`getLeadFieldValue`:

- `standard`: query direta na tabela `contacts`.
- `custom`: delega para `getContactFieldValues` (canônico vence, fallback JSON).

### 2.4 Bot Flow Runtime

`src/lib/botflow-control.ts`:

- `SaveVariableConfig` ganhou `field?: LeadFieldReference`.
- `executeSaveVariable` usa `setLeadFieldValue` quando `field` está presente; legado `key` continua funcional.
- `ConditionRule` ganhou `field?: LeadFieldReference` e `value?: unknown`.
- `evaluateCondition` tornou-se `async` e suporta:
  - regras legadas (`left`/`right` strings);
  - regras tipadas por `field`, com comparação numérica, select, boolean, data, multi_select e texto.
- `resolveTemplate` agora resolve:
  - `{{contact.<key>}}` para standard e custom fields;
  - `{{lead.<key>}}` como alias;
  - `{{contact.custom_fields.<key>}}` legado;
  - fallback por chave solta contra `ctx.variables` e depois `customFields`.

`src/lib/botflow-executor.server.ts`:

- Ao carregar o contato, chama `getContactFieldValues` para preencher `ctx.contact.customFields` com os valores canônicos (não somente o JSON legacy).
- Carrega `leadFieldDefinitions` em `executionContext` para avaliação tipada sem N+1.
- `condition` agora é `await`-ed e erros são logados (sem quebrar o fluxo).

### 2.5 Bot Flow Editor UI

`src/components/bot-flow/StepInspector.tsx`:

- Novo hook `listLeadFields` server function (`useServerFn`).
- Em `save_variable` (escopo `contact`):
  - Select "Campo do Lead" mostra standard + custom ativos.
  - Se selecionado, guarda `field: LeadFieldReference` e `key` para reutilização como variável.
  - Modo "Entrada manual (legado)" continua permitindo `key` textual.
- Em `condition`:
  - Select por regra para escolher "Expressão manual" ou um Lead Field.
  - Se Lead Field selecionado, preenche `field` e `left` = `{{contact.<key>}}`.
  - Lista de operadores estendida com `is_true`, `is_false`, `is_empty`, `is_not_empty`, `before`, `after`.

## 3. ARQUIVOS ALTERADOS / CRIADOS

| arquivo | ação | motivo |
|---|---|---|
| `src/lib/services/lead-field.service.ts` | criado | Lead Field Registry, read, write, operator map |
| `src/lib/custom-fields.functions.ts` | modificado | `listLeadFieldsFn` server function para o picker |
| `src/lib/botflow-control.ts` | modificado | typed `executeSaveVariable`, `evaluateCondition`, `resolveTemplate` |
| `src/lib/botflow-executor.server.ts` | modificado | preload canonical custom fields + `leadFieldDefinitions` |
| `src/components/bot-flow/StepInspector.tsx` | modificado | Lead Field picker em Save Variable e Condition |
| `tests/jest/botflow/lead-field-service.jest.test.ts` | criado | testes do service |
| `tests/jest/botflow/lead-field-runtime.jest.test.ts` | criado | testes de runtime bot |
| `FASE4_AUDIT_SUMMARY.md` | criado | consolidação da fase de auditoria |
| `CRM_LEAD_FIELD_REPORT.md` | criado | este relatório |

## 4. TESTES

### 4.1 Novos

```bash
node --env-file=.env.validation ./node_modules/jest/bin/jest.js tests/jest/botflow --runInBand --forceExit --testTimeout=10000
```

Resultado:

```
PASS tests/jest/botflow/lead-field-service.jest.test.ts
PASS tests/jest/botflow/lead-field-runtime.jest.test.ts

Test Suites: 2 passed, 2 total
Tests:       19 passed, 19 total
```

Cobertura:

- listagem de campos padrão + custom ativos
- exclusão de campos inativos
- escrita/leitura de `name`, `email`, `company`, `position`, `notes`
- validação de e-mail inválido
- telefone webchat preserva `channel` e `phone_e164 = null`
- telefone whatsapp atualiza `phone_e164` e `whatsapp_number`
- escrita/leitura de campo custom por `fieldDefinitionId`
- rejeição de option inválida em `select`
- campo inativo retorna erro
- cross-tenant bloqueado
- rename do custom field preserva valor (busca por id)
- `executeSaveVariable` com `field` padrão e custom
- `evaluateCondition` tipado numérico, select e operador inválido
- `resolveTemplate` com `contact.<key>`, `lead.<key>`, `contact.custom_fields.<key>`
- condições legadas ainda funcionam

### 4.2 Regressão

| suite | resultado |
|---|---|
| `tests/jest/crm-contact` | PASS (53 tests) |
| `tests/jest/webchat` | PASS (150 tests) |
| `tests/jest/omnichannel-golden-path` | PASS (8 tests) |
| `tests/jest/bot-lifecycle` | PASS (8 tests) |
| `tests/jest/inbox-webchat-integration` | PASS (3 tests) |
| `tests/jest/messaging/{integration,failure-isolation,adapters}` | PASS (10 tests) |
| `npx tsc --noEmit` | PASS |
| `npm run build` | PASS |

## 5. DECISÕES E RESTRIÇÕES

1. **Backward compatibility first**: nodes `save_variable` e `condition` legados sem `field` continuam funcionando com as mesmas semânticas de string.
2. **Canonical custom fields win**: `botflow-executor.server.ts` agora carrega `contact_custom_field_values` para o contexto, então `resolveTemplate` usa a fonte canônica.
3. **Phone update does not switch provider**: em contatos `webchat`, `phone_e164` permanece `null` e `whatsapp_number` é atualizado; `channel` não é alterado.
4. **Invalid operator for field type throws**: `evaluateCondition` lança `LEAD_FIELD_INVALID_OPERATOR` para configurações inválidas; o executor captura e trata como `false` para não interromper fluxos em produção.
5. **Cross-tenant blocked**: `setLeadFieldValue` e `getLeadFieldValue` restringem `contact` e `contact_custom_fields` ao `tenantId`.
6. **No DB migration**: reutiliza tabelas existentes (`contacts`, `contact_custom_fields`, `contact_custom_field_values`).

## 6. GAPS REMANESCENTES / PRÓXIMAS FASES

- **Campanhas**: `whatsapp-payload.ts` ainda lê `contact.custom_fields` JSON para interpolação. O JSON é mantido sincronizado pela escrita canônica, então funciona, mas pode ser migrado para ler direto de `contact_custom_field_values`.
- **AI Agent node**: ainda sem suporte a Lead Field reference no inspector do nó `link_ai_agent`.
- **Autocomplete / busca no picker**: o select atual lista campos; busca por label/key seria melhoria futura.
- **Validação de operadores por tipo no editor**: o select mostra todos os operadores; pode-se filtrar dinamicamente usando `getOperatorsForFieldType` replicado no cliente ou exposto como server function.
- **Batch updates**: `bulkUpsertContacts` ainda escreve `custom_fields` JSON sem validação canônica. A ser coberto por FASE 15+ do spec.
- **Delete/rename lifecycle**: campo custom inativo/deletado já dispara `LEAD_FIELD_UNAVAILABLE`, mas UI de arquivamento ainda não integrada.

## 7. OMNICHANNEL / SECURITY IMPACT

- Nenhum arquivo protegido (`.omnichannel-freeze.json`) foi alterado.
- `botflow-executor.server.ts` não é protegido e continua delegando envio de mensagens aos adapters existentes.
- Golden Path de mensageria passa sem regressão.

## 8. STATUS

- **Build**: PASS
- **Type-check**: PASS
- **CRM tests**: PASS
- **WebChat tests**: PASS
- **Omnichannel Golden Path**: PASS
- **Bot lifecycle**: PASS
- **Messaging tests**: PASS

**FASE 4 — Universal Contact Write Semantics: concluída e pronta para merge.**
