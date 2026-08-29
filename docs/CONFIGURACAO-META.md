# Configuração da Meta Graph API (WhatsApp Business / Instagram / Messenger)

## 1. Passo a Passo no Painel de Desenvolvedor da Meta

1. Acesse o [Meta for Developers](https://developers.facebook.com/).
2. Crie ou selecione o seu App do tipo **Negócios (Business)**.
3. Adicione os produtos necessários: **WhatsApp**, **Instagram** ou **Messenger**.
4. Configure os parâmetros da **API Cloud**:
   - Vá em **WhatsApp > Configurações da API**.
   - Anote o seu **Phone Number ID** e o **WhatsApp Business Account ID** (WABA ID).
   - Estes deverão ser copiados pelo usuário (admin) para o painel de configurações do CRM no WAPI Weaver.

## 2. Configuração do Webhook

O WAPI Weaver reage ativamente às mensagens via Webhook. A URL do Webhook do servidor deverá ser pública e com protocolo HTTPS válido.

Cada Meta App Connection gera um `public_id` único e um Verify Token criptografado. A URL de callback para a Meta deve ser:

- **URL de Callback V3 (WhatsApp / Instagram / Messenger)**: `https://seu-dominio.com/api/public/meta-webhook/{public_id}`
- **Token de Verificação**: fornecido pela UI de Configurações > Integrações Meta (coluna `webhook_verify_token_encrypted` de `meta_app_connections`, descriptografada no backend).

As URLs legados ainda são suportadas durante o cutover:

- `/api/public/whatsapp-webhook`
- `/api/public/instagram-webhook`
- `/api/public/facebook-webhook`

A variável global `META_WEBHOOK_VERIFY_TOKEN` **não existe mais**.

## 3. Segurança do Webhook (App Secret)

Para a aplicação multitenancy validar se as requisições estão vindo de fato da Meta, ela utiliza o **App Secret** armazenado na `meta_app_connections` daquele tenant (coluna `app_secret_encrypted`, descriptografada no backend).

1. Em **Configurações > Básico** do seu App na Meta, exiba e copie a **Chave Secreta do Aplicativo (App Secret)**.
2. No WAPI Weaver, em **Configurações > Integrações Meta**, cadastre a Meta App Connection com o **App ID**, **App Secret** e, quando aplicável, o **Config ID**.
3. O WAPI Weaver gera automaticamente o **public_id** e o **Verify Token** para o webhook.

**Não existe mais `META_APP_SECRET` global no `.env`.**

## 4. Chave de Criptografia de Infraestrutura

O SaaS precisa de uma chave de infraestrutura:

```env
META_CREDENTIALS_ENCRYPTION_KEY=hex-64-char-encryption-key
```

Essa chave é usada **apenas pelo backend** para criptografar/descriptografar as credenciais Meta de cada tenant. Ela deve ser armazenada no Secret Manager ou no `.env` do servidor/worker. **Nunca exponha essa chave no frontend.**

## 5. Versão da Graph API

Por padrão, o WAPI Weaver está homologado para a versão `v26.0`. A versão pode ser configurada por Meta App Connection (`graph_version`). Garanta no painel da Meta que você chamará endpoints compatíveis para evitar comportamentos inesperados.
