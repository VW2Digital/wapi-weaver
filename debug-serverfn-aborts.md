[OPEN] Debug session: serverfn-aborts

## Sintoma
- O navegador mostra varios `net::ERR_ABORTED` em chamadas `/_serverFn/...` na carga da aplicacao.
- Os aborts afetam multiplos handlers, incluindo:
  - `getCurrentUserRoles`
  - `listTemplates`
  - `getLicenseStatus`
  - `getSidebarOrder`
  - `listContacts`
  - `getSeoSettings`
  - `listCampaigns`
  - `getDashboardStats`

## Hipoteses
1. As requisicoes sao canceladas por redirecionamento de autenticacao durante o bootstrap.
2. Existe remount/invalidation em cascata que recria queries e aborta requests anteriores.
3. Algum provider global reseta estado ou navega cedo demais, cancelando os `serverFns`.
4. O dev server recompila/recarrega durante a carga e interrompe requests em andamento.
5. Ha uma falha compartilhada de sessao/permissao que muda a arvore renderizada e gera cancelamentos em lote.

## Evidencias Pendentes
- Fluxo real de navegacao na carga inicial.
- Estado da sessao/autenticacao enquanto os aborts acontecem.
- Sequencia entre requests iniciados, abortados e requests subsequentes.
- Se os handlers abortados chegam a ser executados no servidor.

## Proximo Passo
- Mapear bootstrap da autenticacao e rotas globais.
- Instrumentar o fluxo de auth/navegacao que pode cancelar os `serverFns`.
