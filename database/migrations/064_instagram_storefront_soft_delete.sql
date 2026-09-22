-- Soft-delete for Instagram public storefronts.
-- Keeps audit rows, frees slug uniqueness, and allows one active vitrine per tenant.

SET @db := DATABASE();

SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'instagram_storefront_settings' AND COLUMN_NAME = 'deleted_at'
);
SET @sql := IF(@exists = 0,
  'ALTER TABLE `instagram_storefront_settings` ADD COLUMN `deleted_at` datetime DEFAULT NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'instagram_storefront_settings' AND COLUMN_NAME = 'deleted_by'
);
SET @sql := IF(@exists = 0,
  'ALTER TABLE `instagram_storefront_settings` ADD COLUMN `deleted_by` varchar(36) DEFAULT NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'instagram_storefront_settings' AND INDEX_NAME = 'idx_instagram_storefront_tenant'
);
SET @sql := IF(@exists = 0,
  'ALTER TABLE `instagram_storefront_settings` ADD KEY `idx_instagram_storefront_tenant` (`tenant_id`)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'instagram_storefront_settings' AND INDEX_NAME = 'uq_instagram_storefront_tenant'
);
SET @sql := IF(@exists > 0,
  'ALTER TABLE `instagram_storefront_settings` DROP INDEX `uq_instagram_storefront_tenant`',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'instagram_storefront_settings' AND INDEX_NAME = 'idx_instagram_storefront_deleted'
);
SET @sql := IF(@exists = 0,
  'ALTER TABLE `instagram_storefront_settings` ADD KEY `idx_instagram_storefront_deleted` (`tenant_id`, `deleted_at`)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
