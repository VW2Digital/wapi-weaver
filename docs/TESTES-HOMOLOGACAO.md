# Check-list de Testes de Homologação (E2E)

Antes de migrar tráfego real (clientes) para o WAPI Weaver, certifique-se de executar e checar os seguintes testes end-to-end simulando cenários produtivos.

## 1. Webhooks da Meta
- [ ] **Desafio do Verificador (GET)**: Configurar e salvar a URL do Webhook na Meta. Verificar se o servidor responde ao `hub.challenge` com sucesso (Código HTTP 200 e sem injeção de HTML, apenas texto puro/numérico).
- [ ] **Validação de Assinatura Inválida**: Enviar um POST artificial na rota do Webhook usando Postman (sem a `X-Hub-Signature-256` correta) e verificar se o sistema ignora o payload por segurança.
- [ ] **Recebimento de Mensagem de Texto**: Enviar um *"Olá"* de um WhatsApp comum para o número da empresa (WABA) e confirmar no CRM (Painel Chats) se o card aparece imediatamente e sem duplicação na tabela `direct_messages`.
- [ ] **Recebimento de Mídias (Imagem, Áudio)**: Mandar uma foto e um áudio da rua, validando o download/parse no banco de dados.

## 2. Envio de Mensagens (Outbound)
- [ ] **Envio de Texto Básico**: Pelo chat do CRM, enviar um "Oi" de volta para o cliente. Confirmar recebimento no smartphone.
- [ ] **Status de Leitura (Blue Ticks)**: Abrir a mensagem no smartphone e constatar se o status muda para `read` ou `Lido` no painel do CRM através da atualização de status do webhook.
- [ ] **Mensagens de Templates (HSM)**: Abrir campanha com 1 único número de teste. Enviar Template (disparo em massa). Validar status no CRM (`pending` -> `delivered`).

## 3. Multi-Tenancy (Isolamento de Contas)
- [ ] **Criação de Usuário Fictício**: Logar como Administrador Master, criar um novo tenant "Cliente B".
- [ ] **Vazamento de Contatos**: Logar na conta "Cliente B". Verificar a lista de Contatos. A lista DEVE estar vazia. Ele não pode visualizar os contatos ou mensagens de outros SaaS.

## 4. Comportamento Offline (Crash)
- [ ] **Resiliência de Banco de Dados**: Pare o contêiner MySQL (`docker stop wapi_weaver_mysql`). A página Web do Node.js deve manter rotas operantes e lançar erros contidos. Assim que retornar o banco (`docker start`), recarregar a tela deve restaurar os dados perfeitamente sem falhas crônicas.
