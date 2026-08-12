-- Migration 014: Reconcile webhook_events nullability and defaults
-- Idempotent DDL update to align event_type and status with canonical schema

UPDATE `webhook_events` SET `event_type` = 'generic' WHERE `event_type` IS NULL;
ALTER TABLE `webhook_events` MODIFY COLUMN `event_type` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'generic';

UPDATE `webhook_events` SET `status` = 'pending' WHERE `status` IS NULL;
ALTER TABLE `webhook_events` MODIFY COLUMN `status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending';
