-- Revisão de integridade para tabelas de mensagens/conversas.
-- 1. O outbox é um registro de auditoria e retry; preferimos RESTRICT.
--    Mantido comentado porque a versão do MySQL do ambiente não suporta
--    DROP FOREIGN KEY IF EXISTS. Se o banco ainda estiver com CASCADE,
--    ajustar manualmente ou via schema canônico.
--
-- ALTER TABLE `chat_message_outbox`
--   DROP FOREIGN KEY `fk_chat_outbox_message`,
--   ADD CONSTRAINT `fk_chat_outbox_message`
--     FOREIGN KEY (`message_id`) REFERENCES `direct_messages` (`id`) ON DELETE RESTRICT;

-- 2. Adiciona índice de cobertura para a query de chat_sessions por tenant + contato.
--    Não adiciona UNIQUE devido a duplicados existentes (ex: tenant 6da... contact 958...)
--    que precisam ser limpos antes.
ALTER TABLE `chat_sessions`
  ADD KEY `idx_chat_sessions_tenant_contact` (`tenant_id`,`contact_id`);
