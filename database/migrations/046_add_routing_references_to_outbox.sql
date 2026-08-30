-- Migration 046: Add channel and conversation routing references to outbox and direct_messages

-- chat_message_outbox
SET @col_exists := (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'chat_message_outbox'
    AND column_name = 'channel_connection_id');

SET @add_col := IF(@col_exists = 0,
  'ALTER TABLE `chat_message_outbox` ADD COLUMN `channel_connection_id` VARCHAR(36) NULL AFTER `provider_account_id`, ADD INDEX `idx_outbox_channel_conn` (`channel_connection_id`);',
  'SELECT 1;');

PREPARE stmt FROM @add_col;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists2 := (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'chat_message_outbox'
    AND column_name = 'conversation_id');

SET @add_col2 := IF(@col_exists2 = 0,
  'ALTER TABLE `chat_message_outbox` ADD COLUMN `conversation_id` VARCHAR(36) NULL AFTER `channel_connection_id`, ADD INDEX `idx_outbox_conversation` (`conversation_id`);',
  'SELECT 1;');

PREPARE stmt2 FROM @add_col2;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;

-- direct_messages
SET @col_exists3 := (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'direct_messages'
    AND column_name = 'conversation_id');

SET @add_col3 := IF(@col_exists3 = 0,
  'ALTER TABLE `direct_messages` ADD COLUMN `conversation_id` VARCHAR(36) NULL AFTER `channel_connection_id`, ADD INDEX `idx_direct_messages_conversation` (`conversation_id`);',
  'SELECT 1;');

PREPARE stmt3 FROM @add_col3;
EXECUTE stmt3;
DEALLOCATE PREPARE stmt3;
