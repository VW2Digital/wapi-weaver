-- WhatsApp Solution Partner lifecycle: onboarding, billing, portfolio link and migration.

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'platform_settings'
    AND column_name = 'meta_system_user_id'
);
SET @add_col := IF(@col_exists = 0,
  'ALTER TABLE `platform_settings` ADD COLUMN `meta_system_user_id` varchar(100) NULL AFTER `system_user_token`',
  'SELECT 1;');
PREPARE stmt FROM @add_col;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'platform_settings'
    AND column_name = 'meta_system_user_token_encrypted'
);
SET @add_col := IF(@col_exists = 0,
  'ALTER TABLE `platform_settings` ADD COLUMN `meta_system_user_token_encrypted` text NULL AFTER `meta_system_user_id`',
  'SELECT 1;');
PREPARE stmt FROM @add_col;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'platform_settings'
    AND column_name = 'meta_extended_credit_line_id'
);
SET @add_col := IF(@col_exists = 0,
  'ALTER TABLE `platform_settings` ADD COLUMN `meta_extended_credit_line_id` varchar(100) NULL AFTER `meta_system_user_token_encrypted`',
  'SELECT 1;');
PREPARE stmt FROM @add_col;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS `whatsapp_partner_accounts` (
  `id` varchar(36) NOT NULL,
  `tenant_id` varchar(36) NOT NULL,
  `channel_connection_id` varchar(36) DEFAULT NULL,
  `meta_app_connection_id` varchar(36) DEFAULT NULL,
  `customer_business_id` varchar(100) DEFAULT NULL,
  `waba_id` varchar(100) NOT NULL,
  `phone_number_id` varchar(100) DEFAULT NULL,
  `business_token_encrypted` text,
  `billing_mode` enum('customer_payment','shared_credit') NOT NULL DEFAULT 'customer_payment',
  `payment_status` enum('pending','action_required','ready','error') NOT NULL DEFAULT 'pending',
  `primary_funding_id` varchar(100) DEFAULT NULL,
  `credit_allocation_id` varchar(100) DEFAULT NULL,
  `partner_status` enum('pending','active','revoked','error') NOT NULL DEFAULT 'pending',
  `system_user_assigned` tinyint(1) NOT NULL DEFAULT '0',
  `migration_type` enum('new','coexistence','obo','grant_only','phone') NOT NULL DEFAULT 'new',
  `migration_status` enum('not_required','pending','completed','action_required','error') NOT NULL DEFAULT 'not_required',
  `flow_finish_type` varchar(80) DEFAULT NULL,
  `last_error` text,
  `last_synced_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_whatsapp_partner_waba` (`waba_id`),
  KEY `idx_whatsapp_partner_tenant` (`tenant_id`),
  KEY `idx_whatsapp_partner_channel` (`channel_connection_id`),
  KEY `idx_whatsapp_partner_status` (`partner_status`,`payment_status`,`migration_status`),
  CONSTRAINT `fk_whatsapp_partner_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_whatsapp_partner_channel` FOREIGN KEY (`channel_connection_id`) REFERENCES `channel_connections` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `whatsapp_partner_operations` (
  `id` varchar(36) NOT NULL,
  `tenant_id` varchar(36) NOT NULL,
  `partner_account_id` varchar(36) NOT NULL,
  `operation_type` enum('onboarding','payment_check','credit_share','system_user_assign','migration') NOT NULL,
  `idempotency_key` varchar(191) NOT NULL,
  `status` enum('pending','processing','completed','action_required','failed') NOT NULL DEFAULT 'pending',
  `request_json` json DEFAULT NULL,
  `response_json` json DEFAULT NULL,
  `meta_trace_id` varchar(255) DEFAULT NULL,
  `error_message` text,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `completed_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_whatsapp_partner_operation` (`tenant_id`,`idempotency_key`),
  KEY `idx_whatsapp_partner_operations_account` (`tenant_id`,`partner_account_id`,`created_at`),
  CONSTRAINT `fk_whatsapp_partner_operation_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_whatsapp_partner_operation_account` FOREIGN KEY (`partner_account_id`) REFERENCES `whatsapp_partner_accounts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
