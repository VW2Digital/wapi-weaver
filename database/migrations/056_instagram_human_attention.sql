-- Instagram human attention: takeover columns and audit log.
-- Window state itself is derived from the latest inbound direct_messages row.

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'bot_conversation_state'
    AND column_name = 'human_takeover_at'
);
SET @add_col := IF(@col_exists = 0,
  'ALTER TABLE `bot_conversation_state` ADD COLUMN `human_takeover_at` DATETIME NULL',
  'SELECT 1;');
PREPARE stmt FROM @add_col;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'bot_conversation_state'
    AND column_name = 'human_takeover_by'
);
SET @add_col := IF(@col_exists = 0,
  'ALTER TABLE `bot_conversation_state` ADD COLUMN `human_takeover_by` VARCHAR(36) NULL',
  'SELECT 1;');
PREPARE stmt FROM @add_col;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'bot_conversation_state'
    AND column_name = 'takeover_restore_ai'
);
SET @add_col := IF(@col_exists = 0,
  'ALTER TABLE `bot_conversation_state` ADD COLUMN `takeover_restore_ai` TINYINT(1) NULL',
  'SELECT 1;');
PREPARE stmt FROM @add_col;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS `instagram_attention_events` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `contact_phone` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ig_account_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `action` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `window_state` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `message_id` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `meta_error_code` int DEFAULT NULL,
  `meta_error_subcode` int DEFAULT NULL,
  `fbtrace_id` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `detail_json` json DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ig_attention_tenant` (`tenant_id`, `contact_phone`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
