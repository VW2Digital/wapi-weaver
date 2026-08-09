-- Migration 010: Align subscription_plans table with local working database schema
-- Safe, idempotent column drops, modifications, and additions for MySQL 8.

SET @dbname = DATABASE();

-- 1. Safely drop obsolete column 'code' if present in subscription_plans
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'subscription_plans' AND COLUMN_NAME = 'code');
SET @sql_stmt = IF(@col_exists > 0, 'ALTER TABLE subscription_plans DROP COLUMN code', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2. Safely drop obsolete column 'price_monthly' if present
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'subscription_plans' AND COLUMN_NAME = 'price_monthly');
SET @sql_stmt = IF(@col_exists > 0, 'ALTER TABLE subscription_plans DROP COLUMN price_monthly', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3. Safely drop obsolete column 'price_yearly' if present
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'subscription_plans' AND COLUMN_NAME = 'price_yearly');
SET @sql_stmt = IF(@col_exists > 0, 'ALTER TABLE subscription_plans DROP COLUMN price_yearly', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 4. Safely drop obsolete column 'max_contacts' if present
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'subscription_plans' AND COLUMN_NAME = 'max_contacts');
SET @sql_stmt = IF(@col_exists > 0, 'ALTER TABLE subscription_plans DROP COLUMN max_contacts', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 5. Safely drop obsolete column 'max_campaigns' if present
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'subscription_plans' AND COLUMN_NAME = 'max_campaigns');
SET @sql_stmt = IF(@col_exists > 0, 'ALTER TABLE subscription_plans DROP COLUMN max_campaigns', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 6. Add missing local column 'stripe_product_id'
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'subscription_plans' AND COLUMN_NAME = 'stripe_product_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE subscription_plans ADD COLUMN stripe_product_id VARCHAR(255) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 7. Add missing local column 'stripe_price_id'
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'subscription_plans' AND COLUMN_NAME = 'stripe_price_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE subscription_plans ADD COLUMN stripe_price_id VARCHAR(255) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 8. Add missing local column 'max_ai_tokens' (DEFAULT 500000)
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'subscription_plans' AND COLUMN_NAME = 'max_ai_tokens');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE subscription_plans ADD COLUMN max_ai_tokens INT NOT NULL DEFAULT 500000', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 9. Modify column definitions to match local DB nullability and defaults
ALTER TABLE subscription_plans MODIFY COLUMN max_agents INT NULL DEFAULT 1;
ALTER TABLE subscription_plans MODIFY COLUMN max_funnels INT NULL DEFAULT 1;
ALTER TABLE subscription_plans MODIFY COLUMN max_users INT NULL DEFAULT 1;
ALTER TABLE subscription_plans MODIFY COLUMN is_active BOOLEAN NULL DEFAULT true;

-- 10. Ensure slug is NOT NULL and UNIQUE
UPDATE subscription_plans SET slug = CONCAT('plan-', id) WHERE slug IS NULL OR TRIM(slug) = '';
ALTER TABLE subscription_plans MODIFY COLUMN slug VARCHAR(80) NOT NULL;

-- Safely add UNIQUE index on slug if not exists
SET @index_exists = (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @dbname
    AND TABLE_NAME = 'subscription_plans'
    AND COLUMN_NAME = 'slug'
    AND NON_UNIQUE = 0
);
SET @sql_stmt = IF(@index_exists = 0, 'ALTER TABLE subscription_plans ADD UNIQUE INDEX slug (slug)', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;
