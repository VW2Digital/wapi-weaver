[OPEN] Debug session: lead-chat-messages

## Sintoma
- Mensagens dos leads nao aparecem no chat.
- Tambem foi relatado que nao atualizam em tempo real.

## Hipoteses
1. O webhook inbound recebe a mensagem, mas falha ao gravar em `direct_messages`.
2. A mensagem e gravada, mas o lead nao entra na lista retornada por `listChatContacts`.
3. O backend busca mensagens com chave errada (`user_id`, `contact_phone` ou `channel`) e por isso o chat retorna vazio.
4. O frontend faz polling, mas a selecao/invalidacao nao acompanha corretamente o lead atualizado.

## Evidencias Pendentes
- Confirmado: o schema de `contacts` e `direct_messages` esta compativel com o codigo atual.
- Confirmado: o perfil ativo possui `whatsapp_phone_number_id = 1208698542320885`.
- Confirmado: os ultimos `webhook_events` validos tambem usam `phone_number_id = 1208698542320885`.
- Confirmado: nao existem `webhook_events` rejeitados (`user_id IS NULL`) para WhatsApp.
- Confirmado: os ultimos registros recentes no banco sao de `channel = whatsapp_group`.
- Confirmado: em `channel = whatsapp` existem apenas mensagens `outgoing` recentes; nao ha `incoming` recentes de leads.
- Forte indicio: o endpoint nao esta recebendo webhooks inbound individuais recentes da Meta, entao o chat nao tem novos registros para listar.

## Proximo Passo
- Validar configuracao externa do webhook na Meta: app em Live, campo `messages` inscrito e override correto do endpoint, WABA e phone number.
