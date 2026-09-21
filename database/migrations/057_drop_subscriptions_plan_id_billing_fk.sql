-- Migration: 057_drop_subscriptions_plan_id_billing_fk.sql
--
-- Cadastro de conta falha com:
--   CONSTRAINT `subscriptions_ibfk_3` FOREIGN KEY (`plan_id`) REFERENCES `billing_plans` (`id`)
--
-- subscriptions.plan_id guarda subscription_plans.id (plano de acesso do trial).
-- billing_plans.id é o produto comercial do checkout. São IDs diferentes.
-- A migration 017 já tentou dropar essa FK, mas em produção ela ainda existe
-- (017 está no baseline e foi marcada como aplicada sem remover a constraint).
--
-- SAFE / IDEMPOTENT: se a FK não existir, executa SELECT 1.

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
