-- Migration 028: remove legacy foreign keys that prevent the canonical
-- nullable subscription columns from being reconciled on upgraded installs.

SET @db_name = DATABASE();

-- The canonical subscription_events table intentionally does not constrain
-- tenant_id: historical/system events may not belong to a current user.
SET @foreign_keys = (
  SELECT GROUP_CONCAT(
    CONCAT('DROP FOREIGN KEY `', REPLACE(CONSTRAINT_NAME, '`', '``'), '`')
    ORDER BY CONSTRAINT_NAME
    SEPARATOR ', '
  )
  FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'subscription_events'
    AND COLUMN_NAME = 'tenant_id'
    AND REFERENCED_TABLE_NAME IS NOT NULL
);
SET @sql_stmt = IF(
  @foreign_keys IS NULL,
  'SELECT 1',
  CONCAT('ALTER TABLE `subscription_events` ', @foreign_keys)
);
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'subscription_events'
    AND COLUMN_NAME = 'tenant_id'
);
SET @sql_stmt = IF(
  @column_exists = 1,
  'ALTER TABLE `subscription_events` MODIFY COLUMN `tenant_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- The canonical subscriptions table stores external gateway customer IDs.
-- A legacy FK to users(id) is invalid for this field and also blocks NULL.
SET @foreign_keys = (
  SELECT GROUP_CONCAT(
    CONCAT('DROP FOREIGN KEY `', REPLACE(CONSTRAINT_NAME, '`', '``'), '`')
    ORDER BY CONSTRAINT_NAME
    SEPARATOR ', '
  )
  FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'subscriptions'
    AND COLUMN_NAME = 'customer_id'
    AND REFERENCED_TABLE_NAME IS NOT NULL
);
SET @sql_stmt = IF(
  @foreign_keys IS NULL,
  'SELECT 1',
  CONCAT('ALTER TABLE `subscriptions` ', @foreign_keys)
);
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'subscriptions'
    AND COLUMN_NAME = 'customer_id'
);
SET @sql_stmt = IF(
  @column_exists = 1,
  'ALTER TABLE `subscriptions` MODIFY COLUMN `customer_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;
