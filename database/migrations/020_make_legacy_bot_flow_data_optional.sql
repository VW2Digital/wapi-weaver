-- Legacy databases stored the complete editor payload in bot_flows.flow_data.
-- The current editor stores normalized steps in bot_steps, so new flows do not
-- populate this obsolete column. Keep old payloads, but stop requiring a value.

SET @dbname = DATABASE();

SET @flow_data_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @dbname
    AND TABLE_NAME = 'bot_flows'
    AND COLUMN_NAME = 'flow_data'
);

SET @sql_stmt = IF(
  @flow_data_exists > 0,
  'ALTER TABLE `bot_flows` MODIFY COLUMN `flow_data` JSON NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql_stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
