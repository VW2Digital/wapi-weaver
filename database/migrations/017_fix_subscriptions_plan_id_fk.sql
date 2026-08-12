-- Migration: 017_fix_subscriptions_plan_id_fk.sql
--
-- ROOT CAUSE FIX: A FK on subscriptions.plan_id incorrectly references billing_plans.id
-- but subscriptions.plan_id stores subscription_plans.id (access plan, not commercial product).
-- This FK mismatch causes processApprovedPayment to rollback silently on every approved PIX payment,
-- leaving subscriptions in trial/suspended state after successful payment.
--
-- Fix: DROP the wrong FK dynamically (constraint-name agnostic).
-- Application-level validation via validateSubscriptionPlan() ensures plan_id integrity
-- against subscription_plans at INSERT/UPDATE time.
--
-- SAFE       : does not fail on fresh install (no FK exists -> executes SELECT 1).
-- IDEMPOTENT : re-running after FK is already gone -> executes SELECT 1, no error.
-- AGNOSTIC   : discovers the FK by column+referenced_table, never by hardcoded name.

SET @wrong_subscriptions_plan_fk := (
    SELECT kcu.CONSTRAINT_NAME
    FROM information_schema.KEY_COLUMN_USAGE AS kcu
    WHERE kcu.TABLE_SCHEMA = DATABASE()
      AND kcu.TABLE_NAME = 'subscriptions'
      AND kcu.COLUMN_NAME = 'plan_id'
      AND kcu.REFERENCED_TABLE_NAME = 'billing_plans'
    LIMIT 1
);

SET @drop_wrong_subscriptions_plan_fk_sql := IF(
    @wrong_subscriptions_plan_fk IS NULL,
    'SELECT 1',
    CONCAT(
        'ALTER TABLE `subscriptions` DROP FOREIGN KEY `',
        REPLACE(@wrong_subscriptions_plan_fk, '`', '``'),
        '`'
    )
);

PREPARE stmt_drop_wrong_subscriptions_plan_fk
FROM @drop_wrong_subscriptions_plan_fk_sql;

EXECUTE stmt_drop_wrong_subscriptions_plan_fk;

DEALLOCATE PREPARE stmt_drop_wrong_subscriptions_plan_fk;
