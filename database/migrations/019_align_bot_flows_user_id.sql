-- Ensure bot_flows always records both the owning user and effective tenant.
-- Older installations may have only tenant_id, while others already enforce
-- user_id as NOT NULL. This migration is safe and idempotent for both layouts.

SET @dbname = DATABASE();

SET @user_id_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @dbname
    AND TABLE_NAME = 'bot_flows'
    AND COLUMN_NAME = 'user_id'
);

SET @sql_stmt = IF(
  @user_id_exists = 0,
  'ALTER TABLE `bot_flows` ADD COLUMN `user_id` VARCHAR(36) NULL AFTER `id`',
  'SELECT 1'
);
PREPARE stmt FROM @sql_stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE `bot_flows`
SET `user_id` = `tenant_id`
WHERE `user_id` IS NULL OR `user_id` = '';

ALTER TABLE `bot_flows`
  MODIFY COLUMN `user_id` VARCHAR(36) NOT NULL;
