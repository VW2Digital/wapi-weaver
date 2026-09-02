# CRM CONTACT CHANNEL VALIDATION FIX REPORT

## 1. BASELINE

HEAD:
```
851fd27
```

Worktree:
```
 M jest.config.cjs
 M src/lib/contacts.functions.ts
 M src/lib/services/contacts.service.ts
 M src/routes/_app/contacts.$id.tsx
 M src/routes/_app/contacts.index.tsx
?? src/lib/contacts.schema.ts
?? tests/jest/crm-contact/
```

Baseline gates (executados antes das alterações deste fix):
```
npm run guard:omnichannel        → PASS
npx tsc --noEmit                 → PASS
npm run build                    → PASS
npx jest <suites de regressão>   → 47 suites, 336 tests PASS
```

## 2. REPRODUCED ERROR

PASS

Original error (mensagem do Zod):
```text
code = invalid_value
values = ["whatsapp", "instagram", "messenger"]
path = ["channel"]
message = Invalid option: expected one of "whatsapp" | "instagram" | "messenger"
```

Reproduzido via `updateContactInput.safeParse({ channel: "webchat", ... })` antes da correção.

## 3. ROOT CAUSE

- Frontend validation / Server validation: `updateContactInput` em `src/lib/contacts.functions.ts` usava `channel: z.enum(["whatsapp", "instagram", "messenger"]).optional()`.
- Create validation: `contactInput` não continha `channel` (create ignorava o canal selecionado).
- Persistence: `createContactForUser` não persistia `channel` nem `whatsapp_number`.
- Update persistence: `updateContactForUser` rejeitava `phone` vazio e não preservava `phone_e164` / `channel` / external ids em updates parciais.
- UI: dropdown "Canal" na tela de contatos só oferecia "WhatsApp".

## 4. CHANNEL SOURCE OF TRUTH

Novo contrato canônico: `src/lib/contacts.schema.ts`

```ts
export const CONTACT_CHANNELS = ["whatsapp", "instagram", "messenger", "webchat"] as const;
export const contactChannelSchema = z.enum(CONTACT_CHANNELS);
export type ContactChannel = z.infer<typeof contactChannelSchema>;
```

Utilizado por:
- `src/lib/contacts.functions.ts` (`createContact` e `updateContact`)
- `src/routes/_app/contacts.index.tsx` (dropdowns de Canal no create/edit)
- Testes unitários de validação

## 5. OLD ACCEPTED VALUES

whatsapp: YES
instagram: YES
messenger: YES
webchat: NO

## 6. NEW ACCEPTED VALUES

whatsapp: YES
instagram: YES
messenger: YES
webchat: YES

## 7. INVALID VALUE

Rejected: PASS

```ts
contactInput.safeParse({ channel: "telegram" })    → FAIL
updateContactInput.safeParse({ channel: "telegram" }) → FAIL
```

## 8. CREATE CONTACT WEBCHAT

PASS

```ts
await createContactForUser(userId, {
  phone: "",
  name: "Maria",
  channel: "webchat",
});
```

Resultado: `contact.channel === "webchat" && contact.phone_e164 === null`.

## 9. UPDATE CONTACT WEBCHAT

PASS

- Editar nome de contato WebChat existente preserva `channel = webchat`.
- Editar telefone em contato WebChat grava em `whatsapp_number` e mantém `phone_e164 = null`.

## 10. PHONELESS WEBCHAT

PASS

- Create com `phone: ""` e `channel: "webchat"` persiste `phone_e164 = NULL`.
- Update de contato WebChat sem telefone preserva `phone_e164 = NULL`.

Observação: schema canônico (`canonical-schema.sql`) define `contacts.phone_e164` como `NOT NULL`, mas o banco local utilizado nos testes aceita `NULL` (webchat-prechat e novos testes inserem NULL com sucesso). Isso é listado em riscos remanescentes.

## 11. CUSTOM FIELD SAVE

PASS

- Create com `custom_fields: { profissao: "Advogada" }` persiste corretamente.
- Update com `custom_fields: { profissao: "Médica" }` atualiza corretamente.

## 12. CUSTOM FIELD PRESERVATION

PASS

- Update que não envia `custom_fields` preserva os valores existentes.
- Update que envia `custom_fields` sobrescreve apenas as chaves enviadas.

## 13. EXTERNAL ID PRESERVATION

PASS

- `updateContactForUser` preserva `external_id` e `external_contact_id` quando o payload envia string vazia ou não envia.
- Teste: contato criado com `external_contact_id = "wc-visitor-123"` mantém o valor após update de nome.

## 14. WEBCHAT PROVIDER PRESERVATION

PASS

- Editar dados CRM de um contato WebChat não altera `channel`.
- `direct_messages.contact_phone` continua sendo resolvido por `wc_<visitorId>` (não alterado neste fix).

## 15. WHATSAPP REGRESSION

NONE REQUIRED

- Create WhatsApp com telefone normaliza e persiste `phone_e164`.
- Update WhatsApp mantém `phone_e164` quando `phone` vazio.
- Detalhe do contato carrega histórico por `phone_e164`.

## 16. INSTAGRAM REGRESSION

NONE REQUIRED

- Create Instagram com `phone: "ig_123456"` persiste `phone_e164 = "ig_123456"`.
- Update Instagram preserva canal e identificador.

## 17. MESSENGER REGRESSION

NONE REQUIRED

- Create Messenger com `phone: "fb_123456"` persiste `phone_e164 = "fb_123456"`.
- Update Messenger preserva canal e identificador.

## 18. WEBCHAT REGRESSION

NONE REQUIRED

- Testes de `webchat-contact-pages` continuam PASS.
- Histórico WebChat continua carregando por `wc_<visitorId>`.

## 19. DATABASE ENUM

Compatible: YES

`contacts.channel` é `varchar(50) NOT NULL DEFAULT 'whatsapp'` (não é `ENUM`). Nenhuma migration necessária para aceitar `webchat`.

## 20. CHANNEL NULLABILITY

Current:
- `channel` é `NOT NULL DEFAULT 'whatsapp'` no banco.
- Nos schemas Zod `channel` é `optional().nullable()`; serviços defaultam para `"whatsapp"` quando ausente.

Recommended:
- Manter `channel` obrigatório no banco com default `whatsapp`.
- Para contatos puramente CRM sem provider, `channel` pode ser `"whatsapp"` (default) até que exista uma semântica explícita de "sem canal".

Changed: NO — não alteramos nullability da coluna.

## 21. FILES MODIFIED

- `src/lib/contacts.schema.ts` (NOVO) — contrato canônico de canais e schemas de create/update.
- `src/lib/contacts.functions.ts` — importa schemas canônicos; remove duplicação de enums.
- `src/lib/services/contacts.service.ts` — `createContactForUser` e `updateContactForUser` suportam webchat, phoneless, `whatsapp_number`, preservação de ids e canal.
- `src/routes/_app/contacts.index.tsx` — dropdowns de Canal com WhatsApp/Instagram/Messenger/WebChat; create envia `channel`; validação de telefone condicional.
- `tests/jest/crm-contact/contact-channel-validation.jest.test.ts` (NOVO) — matrix de validação e testes de persistência.
- `jest.config.cjs` — mapper de `.js` para testes (adicionado em fase anterior e mantido).
- `src/routes/_app/contacts.$id.tsx` — ajustes de Fase 2 para contatos phoneless (contexto anterior).

## 22. PROTECTED FILES

Nenhum arquivo protegido do omnichannel core foi modificado.

```
npm run guard:omnichannel → PASS
```

## 23. TESTS

CRM contact:
```
PASS tests/jest/crm-contact/contact-channel-validation.jest.test.ts (20 tests)
PASS tests/jest/crm-contact/webchat-contact-pages.jest.test.ts (4 tests)
```

Regressão:
```
PASS tests/jest/omnichannel-golden-path.jest.test.ts
PASS tests/jest/omnichannel-next (múltiplas suites)
PASS tests/jest/inbox-webchat-integration.jest.test.ts
PASS tests/jest/webchat (múltiplas suites)

Total: 47 suites, 336 tests PASS
```

## 24. TYPECHECK

PASS

```
npx tsc --noEmit
```

## 25. BUILD

PASS

```
npm run build
```

## 26. GUARD

PASS

```
npm run guard:omnichannel
OMNICHANNEL FREEZE: PASS (no protected changes since baseline)
```

## 27. LOCAL BROWSER VALIDATION

Create: NOT_EXECUTED
Edit: NOT_EXECUTED
Reload: NOT_EXECUTED

A verificação foi feita via testes de servidor e build/typecheck. Não executamos `npm run dev` + interação real no navegador.

## 28. REMAINING RISKS

- `contacts.phone_e164` é `NOT NULL` no `canonical-schema.sql`, mas o banco local aceita `NULL`. Se o banco de produção for estritamente `NOT NULL`, criação/update de contatos WebChat sem telefone falhará e exigirá migration.
- Dualidade entre `contacts.custom_fields` e `contact_custom_field_values` não foi resolvida.
- `ensureContact` sobrescrevendo `contacts.custom_fields` continua fora de escopo.
- Campos `external_id` e `external_contact_id` ainda são editáveis na UI; o backend preserva-os quando vazios, mas ainda podem ser alterados intencionalmente.
- `source`/`source_type` são preservados quando vazios; isso é seguro para contatos de origem automática, mas pode surpreender se o usuário quiser limpar.

## 29. FINAL STATUS

PASS

`channel = webchat` passa por create/update, contatos WebChat phoneless funcionam, custom fields e external IDs são preservados, canais inválidos continuam rejeitados, e todas as regressões omnichannel/webchat permanecem PASS.

## 30. NEXT ACTION

STOP
