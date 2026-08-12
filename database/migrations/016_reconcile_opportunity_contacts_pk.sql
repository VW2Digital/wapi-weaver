-- Migration 016: Reconcile opportunity_contacts Primary Key (Phase A)
-- Isolated migration to align PK from composite (opportunity_id, contact_id) to (id)

SET @dbname = DATABASE();

-- 1. Garante que a coluna 'id' existe
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunity_contacts' AND COLUMN_NAME = 'id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunity_contacts` ADD COLUMN `id` varchar(36) NOT NULL FIRST', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2. Popula IDs nulos/vazios com UUID() de forma segura
UPDATE `opportunity_contacts` SET `id` = UUID() WHERE `id` IS NULL OR `id` = '';

-- 3. Valida a chave primária atual antes de alterar
SET @pk_is_id = (
  SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE 
  WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunity_contacts' AND CONSTRAINT_NAME = 'PRIMARY' AND COLUMN_NAME = 'id'
);

-- 4. Se a PK ainda for a chave composta legada, executa a troca segura
SET @sql_stmt = IF(@pk_is_id = 0, 'ALTER TABLE `opportunity_contacts` DROP PRIMARY KEY, ADD PRIMARY KEY (`id`), ADD UNIQUE KEY `uq_opportunity_contact` (`opportunity_id`,`contact_id`)', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;
