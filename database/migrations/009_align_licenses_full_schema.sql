-- Migration 009: Align licenses, license_activations, and license_validation_logs full schema
-- Safe, idempotent column additions for MySQL 8 using information_schema and prepared statements.

-- 1. Add missing columns to licenses
SET @dbname = DATABASE();

-- licenses.product_name
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'licenses' AND COLUMN_NAME = 'product_name');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE licenses ADD COLUMN product_name VARCHAR(255) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- licenses.app_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'licenses' AND COLUMN_NAME = 'app_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE licenses ADD COLUMN app_id VARCHAR(100) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- licenses.max_activations
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'licenses' AND COLUMN_NAME = 'max_activations');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE licenses ADD COLUMN max_activations INT NOT NULL DEFAULT 1', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- licenses.max_users
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'licenses' AND COLUMN_NAME = 'max_users');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE licenses ADD COLUMN max_users INT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- licenses.features_json
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'licenses' AND COLUMN_NAME = 'features_json');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE licenses ADD COLUMN features_json JSON NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- licenses.notes
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'licenses' AND COLUMN_NAME = 'notes');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE licenses ADD COLUMN notes TEXT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- licenses.stripe_customer_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'licenses' AND COLUMN_NAME = 'stripe_customer_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE licenses ADD COLUMN stripe_customer_id VARCHAR(255) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- licenses.stripe_subscription_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'licenses' AND COLUMN_NAME = 'stripe_subscription_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE licenses ADD COLUMN stripe_subscription_id VARCHAR(255) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- licenses.ai_tokens_used
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'licenses' AND COLUMN_NAME = 'ai_tokens_used');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE licenses ADD COLUMN ai_tokens_used INT NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;


-- 2. Add missing columns to license_activations

-- license_activations.app_url
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'license_activations' AND COLUMN_NAME = 'app_url');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE license_activations ADD COLUMN app_url VARCHAR(255) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- license_activations.user_agent
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'license_activations' AND COLUMN_NAME = 'user_agent');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE license_activations ADD COLUMN user_agent TEXT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- license_activations.last_check_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'license_activations' AND COLUMN_NAME = 'last_check_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE license_activations ADD COLUMN last_check_at DATETIME NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- license_activations.created_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'license_activations' AND COLUMN_NAME = 'created_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE license_activations ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- license_activations.updated_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'license_activations' AND COLUMN_NAME = 'updated_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE license_activations ADD COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;


-- 3. Add missing columns to license_validation_logs and migrate historical data

-- license_validation_logs.app_url
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'license_validation_logs' AND COLUMN_NAME = 'app_url');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE license_validation_logs ADD COLUMN app_url VARCHAR(255) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- license_validation_logs.installation_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'license_validation_logs' AND COLUMN_NAME = 'installation_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE license_validation_logs ADD COLUMN installation_id VARCHAR(255) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- license_validation_logs.app_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'license_validation_logs' AND COLUMN_NAME = 'app_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE license_validation_logs ADD COLUMN app_id VARCHAR(100) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- license_validation_logs.result
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'license_validation_logs' AND COLUMN_NAME = 'result');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE license_validation_logs ADD COLUMN result VARCHAR(50) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- license_validation_logs.reason
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'license_validation_logs' AND COLUMN_NAME = 'reason');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE license_validation_logs ADD COLUMN reason TEXT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- license_validation_logs.payload_json
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'license_validation_logs' AND COLUMN_NAME = 'payload_json');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE license_validation_logs ADD COLUMN payload_json JSON NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Data migration from status -> result and message -> reason if historical columns exist
SET @has_status = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'license_validation_logs' AND COLUMN_NAME = 'status');
SET @sql_stmt = IF(@has_status > 0, 'UPDATE license_validation_logs SET result = status WHERE result IS NULL AND status IS NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_message = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'license_validation_logs' AND COLUMN_NAME = 'message');
SET @sql_stmt = IF(@has_message > 0, 'UPDATE license_validation_logs SET reason = message WHERE reason IS NULL AND message IS NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;
