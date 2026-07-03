[OPEN] Debug session: template-contact-name

## Sintoma
- O preenchimento do nome do contato em variáveis de template nao esta funcionando.
- O template enviado para a Meta falha por causa da variavel esperada no corpo.

## Hipoteses
1. O builder de variaveis do template nao esta lendo `name`/`custom_fields` do contato correto ao montar os placeholders.
2. O fluxo de campanha esta substituindo `{{nome}}` por vazio ou mantendo literal incorreto, causando payload invalido para a Meta.
3. O preview da tela usa uma fonte de dados diferente da usada no envio real, entao a interface parece correta mas o payload final sai quebrado.
4. O mapeamento entre variaveis amigaveis (`nome`) e parametros da Meta esta inconsistente no momento de serializar `components`.
5. O contato alvo nao possui `name` persistido como esperado e falta fallback seguro antes do envio do template.

## Evidencias Pendentes
- Local exato onde as variaveis do template sao resolvidas para preview.
- Local exato onde as variaveis do template sao resolvidas para envio real.
- Payload final enviado para a Meta quando `{{nome}}` e usado.
- Origem do nome do contato no backend e no frontend.

## Proximo Passo
- Localizar o fluxo de preview e envio do template.
- Instrumentar os pontos de resolucao de variaveis e montagem do payload.

## Evidencias Coletadas
- O preview do wizard em `campaign-wizard.tsx` apenas injeta o valor digitado no campo da variavel; se o usuario digita `{{nome}}`, o preview mostra literalmente `{{nome}}`.
- O envio real no cron chama `buildWhatsAppPayload(...)` com `contacts(name, custom_fields)` carregados de `campaign_messages`.
- O builder do payload possui interpolacao explicita: `{{name}}` e `{{nome}}` usam `contact.name`, e outras chaves usam `contact.custom_fields`.
- Falhas historicas registradas no banco para campanhas template nao apontam erro de variavel vazia; apontam erro Meta `(#132001) Template name does not exist in the translation`.
- Nessas mesmas falhas historicas, o contato tinha nome preenchido (`Vinicius` e `Contato +5591985646076`) e o payload salvo da campanha continha `variables: ["{{nome}}", ...]`.
- O template do print `confirmacao_cadastro / pt_BR` nao foi encontrado na tabela local `templates` para o usuario atual.

## Estado Atual
- Instrumentacao adicionada em `process-queue.ts` para capturar:
  - nome do contato carregado
  - `template_placeholders`
  - `variables`
  - payload final enviado a Meta
  - erro/sucesso devolvido pela Meta
- Falta reproduzir o caso atual com o template do print para confirmar qual hipotese vale de fato.
