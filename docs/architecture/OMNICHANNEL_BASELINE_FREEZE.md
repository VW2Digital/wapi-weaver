# Omnichannel Stable Baseline Freeze

## Status

| Provider | Inbound | Outbound | State |
|----------|---------|----------|-------|
| WhatsApp | FUNCIONANDO | FUNCIONANDO | FROZEN |
| Instagram | FUNCIONANDO | FUNCIONANDO | FROZEN |

## Baseline

- **Commit:** `17d01f0868589858b045ebe4fdb757fd6a6f7914`
- **Short:** `17d01f0`
- **Date:** 2026-08-25
- **Worktree clean:** YES

## Golden Path

- `npx jest tests/jest/omnichannel-golden-path.jest.test.ts --runInBand` — PASS (8/8)
- `npm run build` — PASS
- `npm run type-check` — PASS

## Rule

No provider/core messaging modification is allowed without explicit user
authorization to unlock the baseline.

A feature request is **not** authorization to modify provider routing,
credentials, webhook handlers, adapters or shared golden-path code.

## Explicit Unfreeze Required

Only instructions semantically equivalent to one of the following authorize a
change in the respective area:

- `UNFREEZE WHATSAPP`
- `UNFREEZE INSTAGRAM`
- `UNFREEZE OMNICHANNEL CORE`

Phrases such as "adicionar imagem", "melhorar chat", "profissionalizar
arquitetura" or "corrigir outra coisa" do **not** implicitly unfreeze any
provider.

## Protected Surface

Protected files and paths are listed in `.omnichannel-freeze.json` and enforced
by `scripts/check-omnichannel-freeze.mjs` via:

```bash
npm run guard:omnichannel
```
