-- DS Agente: permite desligar um follow-up sem apagar a regra.
-- Regras antigas nascem ativas.

SET @db := DATABASE();

SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'ds_agent_followups' AND COLUMN_NAME = 'active'
);
SET @sql := IF(@exists = 0,
  'ALTER TABLE `ds_agent_followups` ADD COLUMN `active` tinyint(1) NOT NULL DEFAULT 1',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
