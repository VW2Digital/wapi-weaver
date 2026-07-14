# Auditoria de Segurança WAPI Weaver (OWASP)

## 1. Verificação do Webhook (Authentication/Authorization)
A principal vulnerabilidade num CRM integrado ao WhatsApp é o acesso indevido ao webhook público, forjando mensagens que não vieram da Meta (Injeção de Spam no banco de dados).
**Resolução Implementada**:
- Uso da rota `/api/public/whatsapp-webhook` com função `verifySignature(rawBody, signatureHeader, appSecret)`.
- Comparação constante `crypto.timingSafeEqual` que mitiga ataques de *Timing Attack* de força bruta.
- Somente com o payload validado contra o secret da Meta (`META_APP_SECRET` ou `whatsapp_app_secret` da tabela `profiles`), as mensagens são persistidas no DB.

## 2. Injeção de SQL (SQLi)
- A aplicação usa *Query Builders* / *ORM approaches* nas chamadas, sanitizando as entradas.
- O campo `phone_digits` sempre sofre conversão `/\\D+/g` (Sanitização purificando caracteres de Regex, garantindo somente números e mantendo o formato DDI + DDD).
- Uso do MySQL2 de forma controlada.

## 3. Isolamento de Tenant (Cross-Tenant Data Leakage)
A falha mais crítica de SaaS é um cliente acessar conversas de outro.
- **Camada de Repositório**: Todas as chamadas de banco do Webhook para ler contatos (`ensureWhatsAppContact`) injetam o `userId` implicitamente em todo `.eq("user_id", userId)`. É arquitetonicamente seguro, desde que o programador preserve a regra de `.eq("user_id")` no Query Builder de qualquer nova query.

## 4. Rate Limiting e DDoS
- **Proteção Local**: Utilização da função genérica `isRateLimited` para os webhooks da Meta, configurada a 200 req/min. Cuidado especial deve ser mantido, caso ultrapassado, os webhooks darão Timeout (Erro 429) e a Meta re-tentará de forma agressiva (Backoff). Recomenda-se aumentar ou aplicar limites com base em IPs da Cloudflare para o frontend e liberar Webhooks apenas para ASNs da Meta se houver tráfego intenso.

## 5. Exposição de Segredos (Secrets Exposure)
- Variáveis no `.env` não são expostas ao browser se não contiverem o prefixo obrigatório do framework Frontend (ex: VITE_).
- Não faça log de objetos inteiros nas chamadas do webhook (evite fazer log do payload completo se incluir números/nomes reais num VPS log não seguro, por questões de LGPD).
