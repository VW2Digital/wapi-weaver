# Mercado Pago Subscription and Billing Integration

Este documento detalha o funcionamento, arquitetura e instruções de configuração para a integração nativa de cobrança recorrente e planos SaaS da plataforma com o **Mercado Pago**.

---

## 🛠️ Arquitetura do Banco de Dados

A integração utiliza tabelas MySQL nativas para garantir idempotência, controle multitenant isolado e histórico completo de transações:

1. **`payment_gateway_settings`**: Armazena credenciais (Sandbox/Produção) de forma isolada por tenant ou globais da plataforma (`tenant_id = 'global'`). Chaves de Access Token e Client Secret são salvas encriptadas com algoritmo **AES-256-GCM**.
2. **`billing_plans`**: Cadastro dos planos da plataforma, limites e preços.
3. **`subscriptions`**: Vincula o tenant ao plano contratado e controla a validade (`expires_at`), carência (`grace_period_ends_at`) e status (`active`, `expiring`, `past_due`, `suspended`).
4. **`billing_invoices`**: Registra cada período de cobrança (faturas emitidas).
5. **`billing_payments`**: Armazena cada tentativa de pagamento, QR Code PIX gerado e respostas do Mercado Pago.
6. **`webhook_events`**: Garante idempotência absoluta ao registrar cada notificação do webhook do Mercado Pago.

---

## 🔒 Segurança & Encriptação de Credenciais

Os segredos do Mercado Pago (`access_token` e `client_secret`) nunca são salvos em texto aberto ou expostos ao frontend.
- **Utilitário**: [encryption.ts](file:///d:/APLICA%C3%87%C3%95ES/Disparador/wapi-weaver/src/lib/encryption.ts)
- **Algoritmo**: `aes-256-gcm`
- **Chave**: Definida pela variável de ambiente `MERCADOPAGO_ENCRYPTION_KEY` (deve ter 32 bytes). Caso não definida, a plataforma gera uma chave local estável baseada no `JWT_SECRET`.

---

## ⚙️ Configuração dos Webhooks

Para processamento de faturas em tempo real, configure um Webhook no painel do Mercado Pago:

1. Acesse o painel de desenvolvedor do Mercado Pago.
2. Crie ou configure sua aplicação.
3. Vá em **Webhooks** e cadastre a seguinte URL de Notificação:
   ```
   https://[SEU_DOMINIO]/api/webhooks/mercadopago
   ```
4. Selecione o evento **payment** (pagamentos criados e atualizados).
5. (Opcional) Insira a chave de assinatura gerada no campo correspondente nas configurações da plataforma.

---

## 🔁 Fluxo de Pagamentos Suportados

A integração suporta três fluxos na página de **Consumo & Faturamento**:

### 1. PIX Transparente
- O cliente preenche o e-mail e documento.
- A plataforma gera o QR Code e código Copia e Cola via API do Mercado Pago.
- Um pooling inteligente atualiza a tela no momento em que a confirmação é recebida pelo Webhook.

### 2. Cartão de Crédito Transparente
- O cliente digita os dados do cartão diretamente.
- O frontend tokeniza os dados de forma segura nos servidores do Mercado Pago.
- O token gerado é enviado ao backend, que processa a cobrança imediatamente.

### 3. Redirect (Checkout Pro)
- O cliente é direcionado à página oficial do Mercado Pago para efetuar o pagamento.
- Ao concluir, o Mercado Pago redireciona de volta à plataforma atualizando o status.

---

## 🕰️ Verificação de Vencimentos (Job em Segundo Plano)

O servidor executa uma verificação diária automática:
- **Intervalo**: A cada 24 horas.
- **Aviso de Vencimento**: 3 dias antes do vencimento, exibe alertas dinâmicos no dashboard (sem duplicar notificações graças à chave única `subscription_expiring:{sub_id}:{data}:{dias}`).
- **Suspensão**: Ao atingir a data de vencimento acrescida da tolerância (carência), altera o status da assinatura para `suspended` e bloqueia as APIs do WhatsApp (`/api/whatsapp/*`) retornando `402 Payment Required`.
