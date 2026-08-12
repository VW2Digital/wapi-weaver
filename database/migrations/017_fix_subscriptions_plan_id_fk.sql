-- Migration: 017_fix_subscriptions_plan_id_fk.sql
-- 
-- ROOT CAUSE FIX: subscriptions_ibfk_3 incorrectly references billing_plans.id
-- but subscriptions.plan_id stores subscription_plans.id (access plan, not commercial product).
-- This FK mismatch causes processApprovedPayment to rollback silently on every approved PIX payment,
-- leaving subscriptions in trial/suspended state after successful payment.
--
-- Fix: DROP the wrong FK. Application-level validation via validateSubscriptionPlan() ensures
-- plan_id integrity against subscription_plans at INSERT/UPDATE time.

ALTER TABLE `subscriptions` DROP FOREIGN KEY `subscriptions_ibfk_3`;
