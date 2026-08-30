-- Migration 049: Add channel_connection_id and meta_app_connection_id to messaging_events

SET @cc_exists := (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'messaging_events'
    AND column_name = 'channel_connection_id');

SET @add_cc := IF(@cc_exists = 0,
  'ALTER TABLE `messaging_events` ADD COLUMN `channel_connection_id` VARCHAR(36) NULL AFTER `channel_resource_id`, ADD INDEX `idx_messaging_events_channel_conn` (`channel_connection_id`);',
  'SELECT 1;');

PREPARE stmt FROM @add_cc;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @mac_exists := (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'messaging_events'
    AND column_name = 'meta_app_connection_id');

SET @add_mac := IF(@mac_exists = 0,
  'ALTER TABLE `messaging_events` ADD COLUMN `meta_app_connection_id` VARCHAR(36) NULL AFTER `channel_connection_id`;',
  'SELECT 1;');

PREPARE stmt2 FROM @add_mac;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;
