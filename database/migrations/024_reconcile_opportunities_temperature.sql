-- ignore-errors
-- Migration 024: Reconcile opportunities.temperature column nullability and default value
-- Fixes "Column 'temperature' cannot be null" on existing production databases

SET @dbname = DATABASE();

-- 1. Backfill any existing NULL/empty values
UPDATE `opportunities` SET `temperature` = 'warm' WHERE `temperature` IS NULL OR `temperature` = '';

-- 2. Ensure opportunities.temperature is enum/varchar with default 'warm' and allows NULL
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunities' AND COLUMN_NAME = 'temperature');
SET @sql_stmt = IF(@col_exists > 0, 'ALTER TABLE `opportunities` MODIFY COLUMN `temperature` enum(\'cold\',\'warm\',\'hot\') NULL DEFAULT \'warm\'', 'ALTER TABLE `opportunities` ADD COLUMN `temperature` enum(\'cold\',\'warm\',\'hot\') NULL DEFAULT \'warm\'');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;
