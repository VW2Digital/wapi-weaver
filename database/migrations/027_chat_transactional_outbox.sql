-- Migration 027: durable transactional outbox for direct chat messages.

SET @db_name = DATABASE();

SET @client_message_column = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'direct_messages'
    AND COLUMN_NAME = 'client_message_id'
);
SET @sql_stmt = IF(
  @client_message_column = 0,
  'ALTER TABLE `direct_messages` ADD COLUMN `client_message_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `id`',
  'SELECT 1'
);
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

ALTER TABLE `direct_messages`
  MODIFY COLUMN `status` enum('queued','sent','delivered','read','failed')
  COLLATE utf8mb4_unicode_ci DEFAULT 'sent';

SET @client_message_index = (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'direct_messages'
    AND INDEX_NAME = 'uq_dm_user_client_message'
);
SET @sql_stmt = IF(
  @client_message_index = 0,
  'ALTER TABLE `direct_messages` ADD UNIQUE KEY `uq_dm_user_client_message` (`user_id`,`client_message_id`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS `chat_message_outbox` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `message_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `channel` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `recipient` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `provider_recipient_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `provider_account_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `payload` json NOT NULL,
  `status` enum('pending','processing','retry','sent','failed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `attempts` int NOT NULL DEFAULT '0',
  `max_attempts` int NOT NULL DEFAULT '5',
  `next_attempt_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `locked_at` datetime DEFAULT NULL,
  `locked_by` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `provider_message_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `last_error` text COLLATE utf8mb4_unicode_ci,
  `response_payload` json DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `sent_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_chat_outbox_message` (`message_id`),
  KEY `idx_chat_outbox_schedule` (`status`,`next_attempt_at`,`locked_at`),
  KEY `idx_chat_outbox_tenant` (`tenant_id`,`created_at`),
  CONSTRAINT `fk_chat_outbox_message` FOREIGN KEY (`message_id`) REFERENCES `direct_messages` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_chat_outbox_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_chat_outbox_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
