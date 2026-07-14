# Arquitetura do Sistema WAPI Weaver

## 1. Visão Arquitetural
A aplicação é construída sob uma stack moderna, reativa e isomorfa, projetada para gerenciar multitenancy (múltiplos clientes SaaS).

- **Frontend (SPA/SSR)**: React 18 / 19 com TanStack Start / TanStack Router.
- **Backend (API + Workers)**: Node.js, empacotado via Vite / Vinxi / Nitro Engine.
- **Banco de Dados**: MySQL 8.0+ (Executado via Docker em ambiente local ou na VPS).
- **Estilização**: TailwindCSS + Componentes do shadcn/ui.
- **Filas e Assincronicidade**: P-Queue em memória (Processamento de Webhooks).

## 2. Fluxos de Dados (Data Flows)

### A. Recebimento de Mensagens (Webhook Meta)
1. **Requisição HTTP POST** chega da Meta Graph API no endpoint `/api/public/whatsapp-webhook`.
2. **Camada de Validação**: O *middleware* calcula a hash SHA256 do corpo bruto e verifica a compatibilidade com a `X-Hub-Signature-256`. Identifica-se a assinatura correta entre todos os clientes multitenancy.
3. **Enfileiramento**: Em caso de aprovação (HTTP 200 retornado à Meta imediatamente), a mensagem entra em uma fila assíncrona (`webhookQueue`).
4. **Resolução de Contatos**: O sistema aciona `ensureWhatsAppContact` que identifica ou insere um novo contato (`phone_e164`) de forma idempotente, sem duplicar registros.
5. **Gravação**: A mensagem é classificada e inserida em `direct_messages` / `campaign_messages`.
6. **Automação (Flows/Bots)**: Se aplicável, o sistema varre `whatsapp_flows` para reagir à resposta interativa do cliente, movendo a etapa no funil do CRM.

### B. Envio de Mensagens (Saída)
1. O usuário aciona via CRM (Dashboard) o envio, ou uma Automação reativa dispara via Webhook interno.
2. A aplicação constrói o *payload* (Texto, Mídia ou Template).
3. Uma requisição POST vai para `https://graph.facebook.com/v20.0/{Phone_ID}/messages` carregando o *Access Token* vinculado ao `user_id` (Token da empresa, mantido seguro).
4. O ID devolvido pela API da Meta (`wa_message_id`) é armazenado localmente para futuro cruzamento com os status de leitura/recebimento no webhook.

## 3. Gestão de Entidades
O Banco (MySQL) adota chaves UUID (36 caracteres). As entidades centrais amarram o SaaS:
- `users` (Gerenciador/Licenciado - Admin/Super Admin)
- `profiles` (Configurações de Integração de cada user)
- `contacts` e `opportunities` (O coração do CRM isolado por user_id)
- `campaigns` / `lists` (Motor de disparo ativo)
