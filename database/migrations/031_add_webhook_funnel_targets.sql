-- Migration 031: Add target_funnel_id and target_stage_id to incoming_webhooks
SET @dbname = DATABASE();

SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'incoming_webhooks' AND COLUMN_NAME = 'target_funnel_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `incoming_webhooks` ADD COLUMN `target_funnel_id` VARCHAR(36) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'incoming_webhooks' AND COLUMN_NAME = 'target_stage_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `incoming_webhooks` ADD COLUMN `target_stage_id` VARCHAR(36) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;
