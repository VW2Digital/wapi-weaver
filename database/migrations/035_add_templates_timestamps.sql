-- ignore-errors
-- 035_add_templates_timestamps.sql
-- Adiciona timestamps a tabela templates para consultas de filtragem.
-- Idempotente: verifica information_schema antes de adicionar.

SET FOREIGN_KEY_CHECKS = 0;

-- Adiciona created_at
SET @col_exists = (SELECT COUNT(*)
                   FROM information_schema.COLUMNS
                   WHERE TABLE_SCHEMA = 'wapi_weaver'
                     AND TABLE_NAME = 'templates'
                     AND COLUMN_NAME = 'created_at');
SET @sql = IF(@col_exists = 0,
              'ALTER TABLE `templates` ADD COLUMN `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP',
              'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Adiciona updated_at
SET @col_exists = (SELECT COUNT(*)
                   FROM information_schema.COLUMNS
                   WHERE TABLE_SCHEMA = 'wapi_weaver'
                     AND TABLE_NAME = 'templates'
                     AND COLUMN_NAME = 'updated_at');
SET @sql = IF(@col_exists = 0,
              'ALTER TABLE `templates` ADD COLUMN `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
              'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Adiciona indexes
SET @idx_exists = (SELECT COUNT(*)
                   FROM information_schema.STATISTICS
                   WHERE TABLE_SCHEMA = 'wapi_weaver'
                     AND TABLE_NAME = 'templates'
                     AND INDEX_NAME = 'idx_templates_created_at');
SET @sql = IF(@idx_exists = 0,
              'CREATE INDEX `idx_templates_created_at` ON `templates` (`created_at`)',
              'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_exists = (SELECT COUNT(*)
                   FROM information_schema.STATISTICS
                   WHERE TABLE_SCHEMA = 'wapi_weaver'
                     AND TABLE_NAME = 'templates'
                     AND INDEX_NAME = 'idx_templates_updated_at');
SET @sql = IF(@idx_exists = 0,
              'CREATE INDEX `idx_templates_updated_at` ON `templates` (`updated_at`)',
              'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET FOREIGN_KEY_CHECKS = 1;
