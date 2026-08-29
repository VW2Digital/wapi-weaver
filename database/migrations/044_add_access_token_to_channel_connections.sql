-- Migration 044: Add access_token_encrypted to channel_connections for V3 WhatsApp token storage

SET @col_exists := (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'channel_connections'
    AND column_name = 'access_token_encrypted');

SET @add_col := IF(@col_exists = 0,
  'ALTER TABLE `channel_connections` ADD COLUMN `access_token_encrypted` TEXT NULL AFTER `metadata`;',
  'SELECT 1;');

PREPARE stmt FROM @add_col;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
