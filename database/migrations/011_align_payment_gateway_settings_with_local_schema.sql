-- Migration 011: Align payment_gateway_settings table with local working schema
-- Safe, data-preserving column & key alignment for MySQL 8.

SET @dbname = DATABASE();

-- 1. Pre-validation: Check for duplicate tenant_id values before modifying primary key
SET @dup_tenants = (
  SELECT COUNT(*) FROM (
    SELECT tenant_id FROM payment_gateway_settings GROUP BY tenant_id HAVING COUNT(*) > 1
  ) d
);
SET @sql_stmt = IF(@dup_tenants > 0, 'SIGNAL SQLSTATE \'45000\' SET MESSAGE_TEXT = \'Migration 011 failed: Duplicate tenant_id found in payment_gateway_settings.\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2. Pre-validation: Check for orphan tenant_id values before creating Foreign Key
SET @orphan_tenants = (
  SELECT COUNT(*)
  FROM payment_gateway_settings p
  LEFT JOIN users u ON u.id = p.tenant_id
  WHERE u.id IS NULL
);
SET @sql_stmt = IF(@orphan_tenants > 0, 'SIGNAL SQLSTATE \'45000\' SET MESSAGE_TEXT = \'Migration 011 failed: Orphan tenant_id found in payment_gateway_settings.\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3. Ensure tenant_id column exists and is VARCHAR(36)
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'payment_gateway_settings' AND COLUMN_NAME = 'tenant_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE payment_gateway_settings ADD COLUMN tenant_id VARCHAR(36) NOT NULL', 'ALTER TABLE payment_gateway_settings MODIFY COLUMN tenant_id VARCHAR(36) NOT NULL');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 4. Primary Key Alignment: Ensure tenant_id is the primary key FIRST before modifying id column to NULL
SET @pk_is_tenant = (
  SELECT COUNT(*)
  FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = @dbname
    AND TABLE_NAME = 'payment_gateway_settings'
    AND CONSTRAINT_NAME = 'PRIMARY'
    AND COLUMN_NAME = 'tenant_id'
);

SET @has_any_pk = (
  SELECT COUNT(*)
  FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = @dbname
    AND TABLE_NAME = 'payment_gateway_settings'
    AND CONSTRAINT_NAME = 'PRIMARY'
);

-- Drop old PK if not tenant_id, then add PK(tenant_id)
SET @sql_stmt = IF(@pk_is_tenant = 0 AND @has_any_pk > 0, 'ALTER TABLE payment_gateway_settings DROP PRIMARY KEY, ADD PRIMARY KEY (tenant_id)', IF(@pk_is_tenant = 0, 'ALTER TABLE payment_gateway_settings ADD PRIMARY KEY (tenant_id)', 'SELECT 1'));
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 5. Modify id column to CHAR(36) NULL if exists (now safe as id is no longer part of PRIMARY KEY)
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'payment_gateway_settings' AND COLUMN_NAME = 'id');
SET @sql_stmt = IF(@col_exists > 0, 'ALTER TABLE payment_gateway_settings MODIFY COLUMN id CHAR(36) NULL', 'ALTER TABLE payment_gateway_settings ADD COLUMN id CHAR(36) NULL');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 6. Modify sandbox_client_id and production_client_id to VARCHAR(255) NULL
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'payment_gateway_settings' AND COLUMN_NAME = 'sandbox_client_id');
SET @sql_stmt = IF(@col_exists > 0, 'ALTER TABLE payment_gateway_settings MODIFY COLUMN sandbox_client_id VARCHAR(255) NULL', 'ALTER TABLE payment_gateway_settings ADD COLUMN sandbox_client_id VARCHAR(255) NULL');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'payment_gateway_settings' AND COLUMN_NAME = 'production_client_id');
SET @sql_stmt = IF(@col_exists > 0, 'ALTER TABLE payment_gateway_settings MODIFY COLUMN production_client_id VARCHAR(255) NULL', 'ALTER TABLE payment_gateway_settings ADD COLUMN production_client_id VARCHAR(255) NULL');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 7. Ensure provider column exists with DEFAULT 'mercadopago'
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'payment_gateway_settings' AND COLUMN_NAME = 'provider');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE payment_gateway_settings ADD COLUMN provider VARCHAR(40) NOT NULL DEFAULT \'mercadopago\'', 'ALTER TABLE payment_gateway_settings MODIFY COLUMN provider VARCHAR(40) NOT NULL DEFAULT \'mercadopago\'');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 8. Foreign Key Alignment: Ensure FK on tenant_id -> users(id) ON DELETE CASCADE
SET @fk_exists = (
  SELECT COUNT(*)
  FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = @dbname
    AND TABLE_NAME = 'payment_gateway_settings'
    AND CONSTRAINT_NAME = 'payment_gateway_settings_ibfk_1'
);

SET @sql_stmt = IF(@fk_exists = 0, 'ALTER TABLE payment_gateway_settings ADD CONSTRAINT payment_gateway_settings_ibfk_1 FOREIGN KEY (tenant_id) REFERENCES users(id) ON DELETE CASCADE', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;
