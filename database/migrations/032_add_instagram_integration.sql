-- 032_add_instagram_integration.sql
-- Add Instagram Messaging API Tables

CREATE TABLE IF NOT EXISTS `instagram_accounts` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `tenant_id` VARCHAR(36) NOT NULL,
  `user_id` VARCHAR(36) NOT NULL,
  `page_id` VARCHAR(100) NOT NULL,
  `instagram_business_account_id` VARCHAR(100) NOT NULL,
  `page_name` VARCHAR(255) NULL,
  `instagram_username` VARCHAR(255) NULL,
  `access_token` TEXT NOT NULL,
  `token_expires_at` DATETIME NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `webhook_subscribed` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_instagram_page` (`tenant_id`, `page_id`),
  UNIQUE KEY `uq_instagram_ig_account` (`tenant_id`, `instagram_business_account_id`),
  INDEX `idx_instagram_accounts_tenant` (`tenant_id`),
  INDEX `idx_instagram_accounts_user` (`user_id`),
  CONSTRAINT `fk_instagram_accounts_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_instagram_accounts_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `instagram_webhook_events` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `tenant_id` VARCHAR(36) NULL,
  `page_id` VARCHAR(100) NULL,
  `instagram_business_account_id` VARCHAR(100) NULL,
  `event_type` VARCHAR(100) NOT NULL,
  `message_mid` VARCHAR(255) NULL,
  `sender_id` VARCHAR(100) NULL,
  `recipient_id` VARCHAR(100) NULL,
  `payload` JSON NOT NULL,
  `processed` TINYINT(1) NOT NULL DEFAULT 0,
  `processed_at` DATETIME NULL,
  `error_message` TEXT NULL,
  `received_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_instagram_mid` (`message_mid`),
  INDEX `idx_ig_webhook_tenant` (`tenant_id`),
  INDEX `idx_ig_webhook_page` (`page_id`),
  INDEX `idx_ig_webhook_processed` (`processed`, `received_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE direct_messages MODIFY COLUMN channel VARCHAR(50) NOT NULL DEFAULT 'whatsapp';
ALTER TABLE bot_settings MODIFY COLUMN channel ENUM('whatsapp', 'instagram', 'messenger') NOT NULL DEFAULT 'whatsapp';
ALTER TABLE contacts MODIFY COLUMN channel VARCHAR(50) NOT NULL DEFAULT 'whatsapp';
ALTER TABLE bot_flows MODIFY COLUMN channel VARCHAR(50) NOT NULL DEFAULT 'whatsapp';
ALTER TABLE chat_message_outbox MODIFY COLUMN channel VARCHAR(50) NOT NULL DEFAULT 'whatsapp';
