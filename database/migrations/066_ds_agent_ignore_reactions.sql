-- DS Agente: ignore WhatsApp message reactions by default.

SET @db := DATABASE();

SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'ds_agents' AND COLUMN_NAME = 'ignore_message_reactions'
);
SET @sql := IF(@exists = 0,
  'ALTER TABLE `ds_agents` ADD COLUMN `ignore_message_reactions` tinyint(1) NOT NULL DEFAULT 1',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
