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
- Atualizado o perfil do sistema para os novos IDs da Meta informados pelo usuario.
- Validado: a Graph API respondeu `400 GraphMethodException (code 100 / subcode 33)` ao consultar o novo `whatsapp_phone_number_id` com o token salvo no perfil.
- Confirmado adicionalmente: ao inspecionar o token salvo via `debug_token`, a Meta respondeu `(#100) The App_id in the input_token did not match the Viewing App`.
- Conclusao atual: os IDs foram corrigidos no banco, mas o `whatsapp_access_token` salvo ainda pertence a outro app/token antigo e nao ao `app_id = 1783038629742610` configurado agora.
- Proximo teste: salvar/atualizar o access token gerado no app atual da Meta para esse novo numero/WABA e repetir o ping da Graph API.
- Teste operacional executado com a credencial atual:
  - `GET /<phone_number_id>?fields=is_on_biz_app,platform_type...` falhou com `GraphMethodException code 100 / subcode 33`.
  - `POST /<phone_number_id>/smb_app_data` com `sync_type = smb_app_state_sync` falhou com `GraphMethodException code 100 / subcode 33`.
  - `POST /<phone_number_id>/smb_app_data` com `sync_type = history` falhou com `GraphMethodException code 100 / subcode 33`.
- Confirmado apos o teste operacional: nao houve novos `webhook_events` do numero novo, nem novos contatos/mensagens `channel = whatsapp` para o usuario afetado.
- Conclusao consolidada: a implementacao de Coexistencia ja esta pronta no sistema, mas a execucao real continua bloqueada exclusivamente pela credencial Meta atual, que nao enxerga o `phone_number_id = 1107720082434785`.
