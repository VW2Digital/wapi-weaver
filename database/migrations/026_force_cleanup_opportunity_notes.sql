-- ignore-errors
-- Migration 026: Force cleanup of legacy opportunity columns
-- This migration runs the cleanup again because migration 025 had a syntax error in some environments but was marked as applied.

UPDATE `opportunity_notes` SET `body` = `note` WHERE (`body` IS NULL OR `body` = '') AND `note` IS NOT NULL AND `note` != '';

ALTER TABLE `opportunity_notes` DROP COLUMN `note`;

ALTER TABLE `opportunity_notes` DROP COLUMN `tenant_id`;

ALTER TABLE `opportunity_notes` DROP COLUMN `created_by_user_id`;

ALTER TABLE `opportunities` DROP COLUMN `lost_notes`;
