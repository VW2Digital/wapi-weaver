-- Migration 045: Add deterministic channel routing references to chat_sessions and direct_messages

-- Add channel_connection_id to chat_sessions (nullable initially; backfilled deterministically)
SET @col_exists := (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'chat_sessions'
    AND column_name = 'channel_connection_id');

SET @add_col := IF(@col_exists = 0,
  'ALTER TABLE `chat_sessions` ADD COLUMN `channel_connection_id` VARCHAR(36) NULL AFTER `contact_id`, ADD INDEX `idx_chat_sessions_channel_conn` (`channel_connection_id`);',
  'SELECT 1;');

PREPARE stmt FROM @add_col;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add channel_connection_id to direct_messages (nullable initially; written for all new messages)
SET @col_exists2 := (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'direct_messages'
    AND column_name = 'channel_connection_id');

SET @add_col2 := IF(@col_exists2 = 0,
  'ALTER TABLE `direct_messages` ADD COLUMN `channel_connection_id` VARCHAR(36) NULL AFTER `user_id`, ADD INDEX `idx_direct_messages_channel_conn` (`channel_connection_id`);',
  'SELECT 1;');

PREPARE stmt2 FROM @add_col2;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;
