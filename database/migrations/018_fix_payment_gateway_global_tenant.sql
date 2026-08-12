-- Migration 018: Fix payment_gateway_settings for global platform config
--
-- PROBLEM: payment_gateway_settings has a FK (tenant_id → users.id ON DELETE CASCADE)
-- that prevents saving the platform-level config with tenant_id='global' (not a real user).
-- This FK is semantically wrong: the table holds BOTH tenant-specific and platform-level configs.
--
-- FIX:
--   1. Drop FK payment_gateway_settings_ibfk_1
--   2. Update the existing platform config record to tenant_id='global'
--      (preserving all encrypted credentials already stored)

-- Step 1: Drop the FK that prevents 'global' as tenant_id
ALTER TABLE `payment_gateway_settings`
  DROP FOREIGN KEY `payment_gateway_settings_ibfk_1`;

-- Step 2: Rename the existing platform config record to use 'global' as identifier
-- This targets the record that is NOT already 'global' and has no other tenant-specific meaning.
-- Only updates if a 'global' record does not already exist (idempotent).
UPDATE `payment_gateway_settings`
SET `tenant_id` = 'global'
WHERE `tenant_id` != 'global'
  AND `provider` = 'mercadopago'
  AND NOT EXISTS (
    SELECT 1 FROM (SELECT tenant_id FROM `payment_gateway_settings` WHERE `tenant_id` = 'global') AS g
  );
