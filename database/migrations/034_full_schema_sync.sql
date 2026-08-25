-- ignore-errors
-- 034_full_schema_sync.sql
-- Sincroniza a VPS com o estado do banco local (2026-08-25).
-- Idempotente: usa IF NOT EXISTS / IF EXISTS em todos os comandos.

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Tabela schema_migrations
CREATE TABLE IF NOT EXISTS `schema_migrations` (
  `version` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `applied_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`version`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. audit_logs: coluna ip_address
ALTER TABLE `audit_logs`
  ADD COLUMN IF NOT EXISTS `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL;

-- 3. contacts: normalized_phone + indice
ALTER TABLE `contacts`
  ADD COLUMN IF NOT EXISTS `normalized_phone` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL;
CREATE INDEX IF NOT EXISTS `idx_contacts_normalized_phone` ON `contacts` (`user_id`, `normalized_phone`);

-- 4. direct_messages: raw_payload
ALTER TABLE `direct_messages`
  ADD COLUMN IF NOT EXISTS `raw_payload` json DEFAULT NULL;

-- 5. profiles: whatsapp_app_id
ALTER TABLE `profiles`
  ADD COLUMN IF NOT EXISTS `whatsapp_app_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL;

-- 6. ds_agents: novas colunas
ALTER TABLE `ds_agents`
  ADD COLUMN IF NOT EXISTS `instructions_basic`        text COLLATE utf8mb4_unicode_ci,
  ADD COLUMN IF NOT EXISTS `instructions_advanced`     text COLLATE utf8mb4_unicode_ci,
  ADD COLUMN IF NOT EXISTS `reply_with_assigned_agent` tinyint(1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `split_replies_in_blocks`   tinyint(1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `disabled_outside_platform` tinyint(1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `prompt`                    text COLLATE utf8mb4_unicode_ci,
  ADD COLUMN IF NOT EXISTS `is_active`                 tinyint(1) NOT NULL DEFAULT 1;

-- 6b. ds_agents: enum mode (nao pode usar IF NOT EXISTS para ENUM)
ALTER TABLE `ds_agents`
  ADD COLUMN IF NOT EXISTS `mode` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'basico';

-- 7. templates: colunas avancadas Meta
ALTER TABLE `templates`
  ADD COLUMN IF NOT EXISTS `parameter_format`                varchar(50)  COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `allow_category_change`           tinyint(1)   DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `cta_url_link_tracking_opted_out` tinyint(1)   DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `message_send_ttl_seconds`        int          DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `sub_category`                    varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `is_primary_device_delivery_only` tinyint(1)   DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `display_format`                  varchar(20)  COLLATE utf8mb4_unicode_ci DEFAULT NULL;

-- 8. chat_message_outbox: sent_at
ALTER TABLE `chat_message_outbox`
  ADD COLUMN IF NOT EXISTS `sent_at` datetime DEFAULT NULL;

-- 9. notifications: read_at
ALTER TABLE `notifications`
  ADD COLUMN IF NOT EXISTS `read_at` datetime DEFAULT NULL;

-- 10. billing_invoices: due_date
ALTER TABLE `billing_invoices`
  ADD COLUMN IF NOT EXISTS `due_date` datetime DEFAULT NULL;

-- 11. instagram_accounts: colunas legado
ALTER TABLE `instagram_accounts`
  ADD COLUMN IF NOT EXISTS `ig_user_id`                    varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `username`                      varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `app_id`                        varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `app_secret`                    text COLLATE utf8mb4_unicode_ci,
  ADD COLUMN IF NOT EXISTS `token_expires_at`              varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `page_id`                       varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `instagram_business_account_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `page_name`                     varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `instagram_username`            varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `is_active`                     tinyint(1) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS `webhook_subscribed`            tinyint(1) NOT NULL DEFAULT 0;

-- 12. whatsapp_calls
CREATE TABLE IF NOT EXISTS `whatsapp_calls` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `chat_session_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `contact_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone_number_id` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `whatsapp_call_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `direction` enum('inbound','outbound') COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('incoming','connecting','ringing','active','rejected','ended','failed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'incoming',
  `started_at` datetime DEFAULT NULL,
  `answered_at` datetime DEFAULT NULL,
  `ended_at` datetime DEFAULT NULL,
  `duration_seconds` int DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_whatsapp_calls_tenant` (`tenant_id`),
  KEY `idx_whatsapp_calls_chat_session` (`chat_session_id`),
  KEY `idx_whatsapp_calls_contact` (`contact_id`),
  KEY `idx_whatsapp_calls_whatsapp_id` (`whatsapp_call_id`),
  KEY `idx_whatsapp_calls_status` (`status`),
  KEY `idx_whatsapp_calls_created` (`created_at`),
  CONSTRAINT `whatsapp_calls_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `whatsapp_calls_ibfk_2` FOREIGN KEY (`chat_session_id`) REFERENCES `chat_sessions` (`id`) ON DELETE SET NULL,
  CONSTRAINT `whatsapp_calls_ibfk_3` FOREIGN KEY (`contact_id`) REFERENCES `contacts` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13. whatsapp_business_profile_logs
CREATE TABLE IF NOT EXISTS `whatsapp_business_profile_logs` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone_number_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `action` enum('fetch_profile','update_profile','upload_profile_picture','update_profile_picture') COLLATE utf8mb4_unicode_ci NOT NULL,
  `old_data_json` json DEFAULT NULL,
  `new_data_json` json DEFAULT NULL,
  `meta_response_json` json DEFAULT NULL,
  `success` tinyint(1) NOT NULL DEFAULT 0,
  `error_code` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `error_message` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_wab_profile_logs_user_created` (`user_id`,`created_at`),
  KEY `idx_wab_profile_logs_phone_created` (`phone_number_id`,`created_at`),
  KEY `idx_wab_logs_tenant` (`tenant_id`),
  CONSTRAINT `fk_wab_logs_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `whatsapp_business_profile_logs_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 14. outgoing_webhooks
CREATE TABLE IF NOT EXISTS `outgoing_webhooks` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `url` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `event_type` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('active','paused') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `retry_count` int NOT NULL DEFAULT 3,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_outgoing_webhooks_tenant` (`tenant_id`),
  CONSTRAINT `outgoing_webhooks_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 15. outgoing_webhook_logs
CREATE TABLE IF NOT EXISTS `outgoing_webhook_logs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `outgoing_webhook_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `event_type` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload_sent` json NOT NULL,
  `response_status` int DEFAULT NULL,
  `response_body` text COLLATE utf8mb4_unicode_ci,
  `attempt_number` int NOT NULL DEFAULT 1,
  `success` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_outgoing_webhook_logs_webhook` (`outgoing_webhook_id`),
  CONSTRAINT `outgoing_webhook_logs_ibfk_1` FOREIGN KEY (`outgoing_webhook_id`) REFERENCES `outgoing_webhooks` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 16. whatsapp_group_participants
CREATE TABLE IF NOT EXISTS `whatsapp_group_participants` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `group_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `wa_id` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `joined_at` datetime DEFAULT NULL,
  `left_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `whatsapp_group_participants_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 17. whatsapp_groups
CREATE TABLE IF NOT EXISTS `whatsapp_groups` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `instance_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `group_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `invite_link` text COLLATE utf8mb4_unicode_ci,
  `status` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `error_message` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `group_id` (`group_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `whatsapp_groups_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 18. whatsapp_flow_submissions
CREATE TABLE IF NOT EXISTS `whatsapp_flow_submissions` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `contact_phone` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `flow_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `flow_token` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `response_json` json NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `whatsapp_flow_submissions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 19. whatsapp_flows
CREATE TABLE IF NOT EXISTS `whatsapp_flows` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `flow_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `flow_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `waba_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone_number_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'draft',
  `flow_json` json DEFAULT NULL,
  `endpoint_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `flow_id` (`flow_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `whatsapp_flows_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Registra esta migration
INSERT IGNORE INTO `schema_migrations` (`version`) VALUES ('034_full_schema_sync');

SET FOREIGN_KEY_CHECKS = 1;
