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

## Evidencias Coletadas
- O browser mostrou navegacao client-side imediata de `/` para `/dashboard`, sem passagem por `/login`.
- `performance.navigation.redirectCount = 0`, entao nao houve redirect HTTP.
- O log de rede mostrou repeticao dos mesmos `serverFns` durante a carga inicial, especialmente:
  - `getCurrentUserRoles`
  - `getSidebarOrder`
  - `getLicenseStatus`
  - `listTemplates`
  - `listContacts`
  - `listCampaigns`
  - `getDashboardStats`
- O browser confirmou para todos os handlers acima o padrao:
  - pelo menos 1 request abortado
  - pelo menos 1 request concluido com `200`
- Contagens observadas na mesma recarga:
  - `getCurrentUserRoles`: 1 abort + 4 respostas 200
  - `getSidebarOrder`: 1 abort + 4 respostas 200
  - `getLicenseStatus`: 1 abort + 2 respostas 200
  - `listTemplates`: 1 abort + 1 resposta 200
  - `listContacts`: 1 abort + 1 resposta 200
  - `listCampaigns`: 1 abort + 1 resposta 200
  - `getDashboardStats`: 1 abort + 1 resposta 200

## Hipoteses Avaliadas
- Hipotese 1: cancelamento por redirecionamento para `/login`
  - Rejeitada. Nao houve ida para `/login`.
- Hipotese 4: dev server recompila e derruba requests
  - Sem evidencia confirmatoria nesta coleta.
- Hipotese 2 e 3: reexecucao/re-render/invalidation na carga inicial
  - Fortemente suportadas pela repeticao imediata dos mesmos `serverFns` e pelas respostas `200` subsequentes.
- Hipotese 5: falha compartilhada de sessao/permissao
  - Rejeitada para estes endpoints, pois todos completam `200`.

## Conclusao Parcial
- Os `ERR_ABORTED` desta lista nao indicam falha definitiva dos handlers.
- O padrao observado e de requisicoes canceladas durante a fase inicial de navegacao/hydration, seguidas de requisicoes equivalentes bem-sucedidas.
- O problema atual parece ser ruido de bootstrap/re-render, nao erro funcional do backend desses `serverFns`.
