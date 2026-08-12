-- Migration 013: Reconcile billing_plans Update Drift
-- Idempotent, data-safe DDL updates to add missing billing_plans columns on UPDATE

SET @dbname = DATABASE();

-- 1. billing_plans.price_cents
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'billing_plans' AND COLUMN_NAME = 'price_cents');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `billing_plans` ADD COLUMN `price_cents` int NOT NULL DEFAULT \'0\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2. billing_plans.billing_cycle
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'billing_plans' AND COLUMN_NAME = 'billing_cycle');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `billing_plans` ADD COLUMN `billing_cycle` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT \'monthly\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3. billing_plans.trial_days
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'billing_plans' AND COLUMN_NAME = 'trial_days');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `billing_plans` ADD COLUMN `trial_days` int NOT NULL DEFAULT \'0\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 4. billing_plans.features_json
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'billing_plans' AND COLUMN_NAME = 'features_json');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `billing_plans` ADD COLUMN `features_json` json DEFAULT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 5. billing_plans.sort_order
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'billing_plans' AND COLUMN_NAME = 'sort_order');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `billing_plans` ADD COLUMN `sort_order` int NOT NULL DEFAULT \'0\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;
