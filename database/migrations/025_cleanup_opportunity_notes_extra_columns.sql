-- ignore-errors
-- Migration 025: Cleanup legacy columns from opportunity_notes
-- Fixes "Field 'note' doesn't have a default value" error on VPS by aligning with canonical schema

-- 1. Migrate data from 'note' to 'body' if body is empty and note has data
-- This will fail gracefully if 'note' doesn't exist, thanks to ignore-errors
UPDATE `opportunity_notes` SET `body` = `note` WHERE (`body` IS NULL OR `body` = '') AND `note` IS NOT NULL AND `note` != '';

-- 2. Drop 'note' column
ALTER TABLE `opportunity_notes` DROP COLUMN `note`;

-- 3. Drop 'tenant_id' column
ALTER TABLE `opportunity_notes` DROP COLUMN `tenant_id`;

-- 4. Drop 'created_by_user_id' column
ALTER TABLE `opportunity_notes` DROP COLUMN `created_by_user_id`;

-- 5. Drop 'lost_notes' from opportunities
ALTER TABLE `opportunities` DROP COLUMN `lost_notes`;
