-- Add Instagram and WhatsApp specific fields to contacts table
-- Migration: 021_add_instagram_whatsapp_fields_to_contacts.sql
-- Description: Add instagram_id and whatsapp_number fields to support Instagram and WhatsApp contact creation
-- Idempotente: verifica information_schema antes de adicionar colunas/indexes.

SET FOREIGN_KEY_CHECKS = 0;

SET @col_exists = (SELECT COUNT(*)
                   FROM information_schema.COLUMNS
                   WHERE TABLE_SCHEMA = DATABASE()
                     AND TABLE_NAME = 'contacts'
                     AND COLUMN_NAME = 'instagram_id');
SET @sql = IF(@col_exists = 0,
              'ALTER TABLE `contacts` ADD COLUMN `instagram_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT "Instagram user ID for Instagram contacts" AFTER `normalized_phone`',
              'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*)
                   FROM information_schema.COLUMNS
                   WHERE TABLE_SCHEMA = DATABASE()
                     AND TABLE_NAME = 'contacts'
                     AND COLUMN_NAME = 'whatsapp_number');
SET @sql = IF(@col_exists = 0,
              'ALTER TABLE `contacts` ADD COLUMN `whatsapp_number` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT "WhatsApp phone number for WhatsApp contacts" AFTER `instagram_id`',
              'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_exists = (SELECT COUNT(*)
                   FROM information_schema.STATISTICS
                   WHERE TABLE_SCHEMA = DATABASE()
                     AND TABLE_NAME = 'contacts'
                     AND INDEX_NAME = 'idx_contacts_instagram_id');
SET @sql = IF(@idx_exists = 0,
              'CREATE INDEX `idx_contacts_instagram_id` ON `contacts` (`instagram_id`)',
              'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_exists = (SELECT COUNT(*)
                   FROM information_schema.STATISTICS
                   WHERE TABLE_SCHEMA = DATABASE()
                     AND TABLE_NAME = 'contacts'
                     AND INDEX_NAME = 'idx_contacts_whatsapp_number');
SET @sql = IF(@idx_exists = 0,
              'CREATE INDEX `idx_contacts_whatsapp_number` ON `contacts` (`whatsapp_number`)',
              'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET FOREIGN_KEY_CHECKS = 1;
