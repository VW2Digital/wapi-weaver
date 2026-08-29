-- Migration 043: Add meta_config_id to meta_app_connections for Embedded Signup
-- Model: Tenant -> meta_app_connections (app_id, app_secret, meta_config_id)

SET @col_exists := (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'meta_app_connections'
    AND column_name = 'meta_config_id');

SET @add_col := IF(@col_exists = 0,
  'ALTER TABLE `meta_app_connections` ADD COLUMN `meta_config_id` VARCHAR(100) NULL AFTER `app_secret_encrypted`;',
  'SELECT 1;');

PREPARE stmt FROM @add_col;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
