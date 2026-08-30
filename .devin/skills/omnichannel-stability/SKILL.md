# OMNICHANNEL STABILITY PROTOCOL

## 1. Visão Geral

Este projeto é um SaaS omnichannel.

Os canais suportados incluem:

* WhatsApp
* Instagram
* Messenger

Cada canal é um provider independente que compartilha um **Messaging Core** comum.

O critério de sucesso é:

```
WhatsApp PASS
+ Instagram PASS
+ Messenger PASS (quando configurado)
= OMNICHANNEL PASS
```

Um provider PASS enquanto outro provider FAIL é considerado **regressão**. A tarefa **não** está concluída.

## 2. Arquitetura Esperada

```
              MESSAGING CORE
                     │
    ┌────────────────┼────────────────┐
    │                │                │
    ▼                ▼                ▼
WhatsApp        Instagram        Messenger
 Adapter          Adapter          Adapter
    │                │                │
    ▼                ▼                ▼
Channel WA       Channel IG       Channel FB
    │                │                │
    ▼                ▼                ▼
Meta App A       Meta App B       Meta App C
```

O core lida com conceitos genéricos:

* conversation
* message
* contact
* contact_identity
* channel_connection
* direction
* status
* media
* queue
* outbox

O **não** assume formatos de payload específicos de nenhum provider.

## 3. Provider Adapters

Cada provider deve possuir seu próprio adapter responsável por:

* construir payload outbound;
* interpretar resposta da API;
* normalizar webhook inbound;
* mapear tipos de mídia;
* mapear `provider_message_id`;
* mapear status;
* validar capabilities daquele provider.

Exemplo nominal:

```ts
// whatsapp.adapter.ts
// instagram.adapter.ts
// messenger.adapter.ts
```

## 4. Resolução de Channel

Toda mensagem precisa carregar contexto de canal:

```
conversation
↓
channel_connection_id
↓
channel_connections
↓
provider
↓
provider adapter
```

Nunca decidir provider apenas pelo `tenant_id`.

## 5. Credenciais

Resolver credenciais pela Channel Connection correta:

* **WhatsApp**: `channel_connection` → Meta App → `phone_number_id` → WhatsApp Access Token
* **Instagram**: `channel_connection` → Meta App → `instagram_business_account_id` / `ig_user_id` → Instagram Access Token
* **Messenger**: `channel_connection` → Meta App → `page_id` → Page Access Token

Proibido:

* Usar o "último" Meta App do tenant.
* Usar o "primeiro" Meta App do tenant.
* Compartilhar Access Token entre providers.
* Cachear credencial sem chave composta por `tenant_id`, `channel_connection_id`, `provider`.

## 6. Outbound Central

O fluxo genérico:

```ts
sendMessage({
  conversationId,
  channelConnectionId,
  type,
  content,
  media,
});
```

Depois:

```
resolve channel
↓
detect provider
↓
provider adapter
↓
send
```

## 7. Frontend

O frontend **não** monta payloads da Meta diretamente.

Envia apenas intenção:

```
send text
send image
send video
```

O backend e os adapters traduzem para cada API.

O composer deve derivar o comportamento da conversa atual:

```
conversation.channel_connection_id
↓
provider
↓
capabilities
```

Não manter provider anterior no state ao trocar de conversa.

## 8. Capability Matrix

Exemplo nominal:

| Tipo      | WhatsApp | Instagram | Messenger |
|-----------|----------|-----------|-----------|
| text      | yes      | yes       | yes       |
| image     | yes      | yes       | yes       |
| video     | yes      | yes       | yes       |
| audio     | yes      | yes       | yes       |
| document  | yes      | no        | yes       |
| sticker   | yes      | yes       | yes       |

O frontend deve consultar capabilities e desabilitar/esconder ações não suportadas.

## 9. Inbound e Outbound Canônico

### Inbound

```
WhatsApp webhook → WhatsApp adapter → CanonicalMessage
Instagram webhook → Instagram adapter → CanonicalMessage
Messenger webhook → Messenger adapter → CanonicalMessage
```

### Outbound

```
CanonicalMessage → provider adapter → Meta API
```

Modelo canônico:

```ts
interface CanonicalMessage {
  provider: string;
  channelConnectionId: string;
  conversationId: string;
  externalMessageId: string;
  senderExternalId: string;
  direction: "incoming" | "outgoing";
  type: string;
  text?: string;
  media?: { url: string; mime_type: string; filename: string };
  status: string;
}
```

## 10. Identidades de Contato

* **WhatsApp**: `provider=whatsapp`, `external_id=wa_id`
* **Instagram**: `provider=instagram`, `external_id=IGSID`
* **Messenger**: `provider=messenger`, `external_id=PSID`

Nunca sobrescrever identities entre providers.

## 11. Isolamento

### Token Isolation

Cada request resolve seu próprio token. Sem estado global:

```
currentProvider
currentAccessToken
currentMetaApp
currentChannel
```

### Multi-Tenant Isolation

Toda query é `tenant_id` scoped. Tenant A WhatsApp nunca afeta Tenant B Instagram.

### Channel Isolation

O status pertence ao `channel_connection`, não ao tenant inteiro.

## 12. Baseline e Regressão

### Antes de Alterar

Registrar baseline:

```
WHATSAPP BEFORE:
  text:
  image:
  video:
  document:

INSTAGRAM BEFORE:
  text:
  image:
  video:
  audio:

MESSENGER BEFORE:
  ...
```

### Depois de Alterar

Rodar:

```
Instagram
+ WhatsApp
+ Messenger (quando configurado)
```

Se um provider previamente funcional falhar, **reverter/corrigir** antes de marcar concluído.

## 13. Testes Obrigatórios

### Sequênciais

1. WhatsApp inbound
2. WhatsApp outbound
3. Instagram inbound
4. Instagram outbound
5. WhatsApp outbound novamente
6. Instagram outbound novamente

Todos devem PASS.

### Troca de Conversa

1. Abrir WhatsApp, enviar texto.
2. Abrir Instagram, enviar imagem.
3. Voltar WhatsApp, enviar documento.

### Isolamento de Falha

* Instagram token inválido, WhatsApp válido → WhatsApp continua PASS.
* WhatsApp token inválido, Instagram válido → Instagram continua PASS.

## 14. Adapter Contract

Cada adapter implementa uma interface comum:

```ts
interface MessagingAdapter {
  sendText(...): Promise<...>;
  sendImage(...): Promise<...>;
  sendVideo(...): Promise<...>;
  sendAudio(...): Promise<...>;
  sendDocument(...): Promise<...>;
  sendSticker(...): Promise<...>;
}
```

Métodos não suportados retornam `UNSUPPORTED_PROVIDER_CAPABILITY`.

Não tentar converter silenciosamente.

## 15. Proibições

* Não fazer um provider usar regras do outro.
* Não refatorar WhatsApp "aproveitando" a implementação do Instagram.
* Não resolver Instagram alterando WhatsApp adapter.
* Não resolver WhatsApp alterando Instagram adapter.
* Não usar fallback entre providers.
* Não espalhar `if provider === whatsapp` por dezenas de componentes.
* Não modificar código funcional sem necessidade.
* Não trocar credentials de outro provider para "corrigir".

## 16. Segurança

Nunca logar:

* App Secret
* Access Token
* Verify Token
* Encryption Key

Cada envio loga:

```
provider
tenant_id
channel_connection_id
meta_app_connection_id
recipient_external_id
message_type
provider_message_id
outcome
```

## 17. Build e Typecheck

Após alterações:

```bash
npm run build
npm run type-check
```

Se disponível, rodar testes de mensageria/adapter.

## 18. OMNICHANNEL REGRESSION REPORT

Para toda implementação de mensageria, entregar:

```
# OMNICHANNEL REGRESSION REPORT

## CHANGE
Provider requested: ...
Files changed: ...
Shared core changed: YES / NO

## WHATSAPP
- Inbound text: PASS / FAIL
- Outbound text: PASS / FAIL
- Image: PASS / FAIL
- Video: PASS / FAIL
- Document: PASS / FAIL
- Regression: PASS / FAIL

## INSTAGRAM
- Inbound text: PASS / FAIL
- Outbound text: PASS / FAIL
- Image: PASS / FAIL
- Video: PASS / FAIL
- Audio: PASS / FAIL
- Regression: PASS / FAIL

## MESSENGER
... quando configurado

## CHANNEL ISOLATION
- WhatsApp uses own channel: PASS / FAIL
- Instagram uses own channel: PASS / FAIL
- Tokens isolated: PASS / FAIL
- Meta Apps isolated: PASS / FAIL

## SEQUENTIAL TEST
- WA → IG → WA: PASS / FAIL
- IG → WA → IG: PASS / FAIL

## FAILURE ISOLATION
- Instagram broken, WhatsApp works: PASS / FAIL
- WhatsApp broken, Instagram works: PASS / FAIL

## BUILD: PASS / FAIL
## TYPECHECK: PASS / FAIL
## TESTS: ...

## OMNICHANNEL REGRESSION: PASS / FAIL
## READY: YES / NO
```

## 19. READY Gate

`READY = YES` somente quando:

* WhatsApp regression = PASS
* Instagram regression = PASS
* Messenger regression = PASS (quando configurado)
* Channel isolation = PASS
* Sequential tests = PASS
* Build = PASS
* Typecheck = PASS

Nunca marcar `READY = YES` com PASS parcial.
