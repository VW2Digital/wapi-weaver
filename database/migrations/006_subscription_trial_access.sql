-- ==============================================================================
-- BLIV CRM / WAPI WEAVER - MIGRATION 006: SUBSCRIPTION TRIAL ACCESS
-- ==============================================================================
-- Adiciona campos de controle de trial de 3 dias e datas de ciclo na tabela subscriptions.
-- ==============================================================================

SET @has_trial_started = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'subscriptions' AND COLUMN_NAME = 'trial_started_at'
);
SET @sql = IF(@has_trial_started = 0, 'ALTER TABLE subscriptions ADD COLUMN trial_started_at DATETIME NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_trial_ends = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'subscriptions' AND COLUMN_NAME = 'trial_ends_at'
);
SET @sql = IF(@has_trial_ends = 0, 'ALTER TABLE subscriptions ADD COLUMN trial_ends_at DATETIME NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_trial_consumed = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'subscriptions' AND COLUMN_NAME = 'trial_consumed_at'
);
SET @sql = IF(@has_trial_consumed = 0, 'ALTER TABLE subscriptions ADD COLUMN trial_consumed_at DATETIME NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_activated_at = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'subscriptions' AND COLUMN_NAME = 'activated_at'
);
SET @sql = IF(@has_activated_at = 0, 'ALTER TABLE subscriptions ADD COLUMN activated_at DATETIME NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_cancelled_at = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'subscriptions' AND COLUMN_NAME = 'cancelled_at'
);
SET @sql = IF(@has_cancelled_at = 0, 'ALTER TABLE subscriptions ADD COLUMN cancelled_at DATETIME NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
