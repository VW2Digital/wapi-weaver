# CRM WebChat Contact Pages — Fase 2 Report

## Objetivo
Corrigir a experiência de contatos sem `phone_e164` (principalmente WebChat) nas páginas de CRM: lista de contatos, detalhe do contato e abertura de conversa, sem alterar persistência de custom fields ou dependências legadas de telefone fora do escopo.

## Baseline
- Commit baseline: `72cc7ffe0f8f89e237fdafa1d9cebceb25bcd1d8`
- `npm run guard:omnichannel` → PASS
- `npx tsc --noEmit` → PASS
- `npm run build` → PASS
- Testes de regressão omnichannel + webchat → 316 PASS (46 suites)

## Mudanças realizadas

### 1. `src/lib/services/contacts.service.ts`
- Nova função `getContactDetailForUser(userId, id)` que centraliza o lookup do detalhe do contato.
- JOIN com `contact_identities` (`provider = 'webchat'`) para obter `webchat_external_id`.
- Calcula a chave de thread correta:
  - WhatsApp/Instagram/Messenger: usa `contacts.phone_e164`.
  - WebChat (quando `phone_e164 IS NULL`): usa `CONCAT('wc_', ci_web.external_id)`.
- Mantém isolamento de tenant (`getTenantFilter`) em todas as queries.

### 2. `src/lib/contacts.functions.ts`
- `getContactDetail` agora delega para `getContactDetailForUser`, mantendo a mesma interface com o frontend.

### 3. `src/routes/_app/contacts.index.tsx`
- Adicionados helpers `getContactDisplayPhone` e `getContactThreadPhone`.
- Busca da lista agora é null-safe e procura em `phone_e164`, `whatsapp_number` (CRM phone real), nome e e-mail.
- Coluna "Telefone" exibe `+phone_e164` para WhatsApp, o handle `ig_/fb_` para Instagram/Messenger, `+whatsapp_number` para WebChat com prechat phone, ou "—" quando não há telefone.
- Nunca renderiza `+undefined`, `+null` ou `wc_<uuid>` como telefone.
- Ação "Mandar mensagem" navega com `contactId` + chave de thread correta (`wc_<visitorId>` para WebChat).
- Labels de exclusão e checkbox usam nome/telefone visível com fallback seguro.

### 4. `src/routes/_app/contacts.$id.tsx`
- Adicionados os mesmos helpers `getContactDisplayPhone` e `getContactThreadPhone`.
- Título do detalhe usa `contact.name || displayPhone || "Sem identificador"` (sem `+undefined`).
- Sidebar exibe telefone formatado ou "—".
- Botão "Ligar" só aparece quando há um telefone real (começa com `+`).
- Botão "Mensagem" abre `/chat` passando `contactId` e a chave de thread correta (`wc_<visitorId>`), garantindo que a conversa WebChat seja resolvida no Inbox.

### 5. `tests/jest/crm-contact/webchat-contact-pages.jest.test.ts`
- Cobre:
  - `getContactDetailForUser` carrega histórico de WebChat por `wc_<visitorId>` sem `phone_e164`.
  - Isolamento entre contatos WebChat diferentes.
  - `listContactsForUser` inclui contatos WebChat com `phone_e164` null e `whatsapp_number` preenchido.
  - Contato WhatsApp continua carregando histórico por `phone_e164`.

### 6. `jest.config.cjs`
- Adicionado `moduleNameMapper` para resolver imports com extensão `.js` dentro de arquivos `.ts` no ambiente de teste Jest/ts-jest.

## Regras respeitadas
- `wc_<visitorId>` nunca é exibido como telefone.
- Números de telefone não são usados para inferir provider.
- `direct_messages.contact_phone` continua sendo a chave de thread real (`wc_<visitorId>`).
- Nenhuma alteração em `updateContactForUser`, persistência de custom fields ou nas tabelas legadas associadas.
- Nenhum arquivo protegido do omnichannel core foi modificado (`guard:omnichannel` PASS).

## Verificação final
```
npm run guard:omnichannel        → PASS
npx tsc --noEmit                 → PASS
npm run build                    → PASS
node --env-file=.env.validation ./node_modules/jest/bin/jest.js \
  --testPathPatterns="(omnichannel-golden-path|omnichannel-next|inbox-webchat-integration|webchat|crm-contact)" \
  --runInBand --forceExit          → 46 suites, 316 tests PASS
```

## Status
Fase 2 concluída: contact list, contact detail e abertura de conversa WebChat estão corrigidos para contatos sem `phone_e164`.

## Pendências / fora do escopo
- `updateContactForUser` ainda altera `phone_e164` sem sincronizar tabelas legadas (já documentado como fora de escopo).
- Sobrescrita total de `contacts.custom_fields` por `ensureContact` não foi alterada.
- Dualidade `contacts.custom_fields` vs `contact_custom_field_values` permanece como débito técnico.
- Testes E2E de navegação real no browser não foram executados; apenas testes de servidor/service e build/typecheck.
