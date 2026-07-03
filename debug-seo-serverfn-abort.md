[OPEN] Debug session: seo-serverfn-abort

## Sintoma
- O navegador mostra `net::ERR_ABORTED` ao chamar o server function `getSeoSettings`.
- A URL afetada e o split apontam para `src/lib/admin.functions.ts`.

## Hipoteses
1. `getSeoSettings` esta lancando erro no servidor antes de responder.
2. A query usada por `getSeoSettings` depende de schema/coluna ausente no banco local.
3. O middleware de autenticacao/permissao esta encerrando a requisicao de forma inesperada.
4. O dev server esta reiniciando ou quebrando ao carregar o split de `admin.functions.ts`.
5. Ha erro de importacao/avaliacao do modulo que impede a execucao do handler.

## Evidencias Pendentes
- Implementacao exata de `getSeoSettings`.
- Stack/log do servidor no momento da chamada.
- Estado da tabela/colunas acessadas pelo handler.
- Confirmacao se o modulo compila e carrega sem diagnosticos.

## Proximo Passo
- Localizar `getSeoSettings`.
- Instrumentar o handler e capturar a falha runtime.

## Evidencias Coletadas
- `getSeoSettings` esta definido em `src/lib/admin.functions.ts` e a raiz chama esse serverFn em `src/routes/__root.tsx`.
- Reproducao no navegador mostrou o request real do app para `getSeoSettings` com:
  - metodo `GET`
  - header `x-tsr-serverFn: true`
  - `accept: application/x-tss-framed, application/x-ndjson, application/json`
  - resposta `200 OK`
- A chamada manual sem os headers do protocolo do TanStack devolveu `403 Forbidden`, o que explica a divergencia entre uma chamada bruta e a chamada real do app.
- Nos testes de recarga, os `ERR_ABORTED` reproduzidos apareceram em outros serverFns, nao em `getSeoSettings`.
- Portanto, ate o momento, a hipotese de falha especifica em `getSeoSettings` nao foi confirmada.

## Conclusao Parcial
- `getSeoSettings` parece saudavel no fluxo real do navegador.
- O `ERR_ABORTED` visto isoladamente nessa URL provavelmente foi efeito colateral de cancelamento de request em recarga/navegacao, nao a causa raiz do problema.
