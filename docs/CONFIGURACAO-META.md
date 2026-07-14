# Configuração da Meta Graph API (WhatsApp Business)

## 1. Passo a Passo no Painel de Desenvolvedor da Meta

1. Acesse o [Meta for Developers](https://developers.facebook.com/).
2. Crie ou selecione o seu App do tipo **Negócios (Business)**.
3. Adicione o produto **WhatsApp**.
4. Configure os parâmetros da **API Cloud**:
   - Vá em **WhatsApp > Configurações da API**.
   - Note o seu **Phone Number ID** e o **WhatsApp Business Account ID** (WABA ID).
   - Estes deverão ser copiados pelo usuário (admin) para o painel de configurações do CRM no WAPI Weaver.

## 2. Configuração do Webhook
O WAPI Weaver reage ativamente às mensagens via Webhook. A URL do Webhook do servidor deverá ser pública e com protocolo HTTPS válido.

- **URL de Callback**: `https://seu-dominio.com/api/public/whatsapp-webhook`
- **Token de Verificação**: Configure uma *string* longa e adicione a mesma *string* ao arquivo `.env` do seu projeto WAPI Weaver como a variável `META_VERIFY_TOKEN`. Exemplo: `WAPI_WEAVER_VERIFY_2026_SECURE`.
- **Inscrições de Campos (Fields Subscriptions)**:
  - `messages` (Obrigatório para receber textos, áudios, imagens de clientes e status de leitura).
  - `message_template_status_update` (Obrigatório para monitoramento de templates).

## 3. Segurança do Webhook (App Secret)
Para a aplicação multitenancy validar se as requisições estão vindo de fato da Meta, ela utilizará a variável `META_APP_SECRET`. 

1. Em **Configurações > Básico** do seu App na Meta, exiba e copie a **Chave Secreta do Aplicativo (App Secret)**.
2. No seu CRM (WAPI Weaver), cada Perfil (tenant) ou o arquivo `.env` global deve deter essa secret. O sistema varrerá a tabela `profiles` na coluna `whatsapp_app_secret` comparando as assinaturas SHA-256 (`X-Hub-Signature-256`) na entrada do webhook.

## 4. Versão da Graph API
Por padrão, o WAPI Weaver está homologado para as versões `v19.0` e `v20.0`. Garanta no painel da Meta que você chamará endpoints destas versões para evitar comportamentos inesperados em envios de templates (Message Templates).
