-- Migration: 059_drop_payment_gateway_settings_tenant_fk.sql
--
-- Salvar Mercado Pago da plataforma falha com:
--   CONSTRAINT `payment_gateway_settings_ibfk_1`
--   FOREIGN KEY (`tenant_id`) REFERENCES `users` (`id`)
--
-- A config da plataforma usa tenant_id = 'global', que não é um users.id.
-- A migration 018 já tentou dropar essa FK, mas em produção ela ainda existe
-- (018 está no baseline e foi marcada como aplicada sem remover a constraint).
--
-- SAFE / IDEMPOTENT: se a FK não existir, executa SELECT 1.

SET @payment_gateway_tenant_fk := (
    SELECT kcu.CONSTRAINT_NAME
    FROM information_schema.KEY_COLUMN_USAGE AS kcu
    WHERE kcu.TABLE_SCHEMA = DATABASE()
      AND kcu.TABLE_NAME = 'payment_gateway_settings'
      AND kcu.COLUMN_NAME = 'tenant_id'
      AND kcu.REFERENCED_TABLE_NAME = 'users'
    LIMIT 1
);

SET @drop_payment_gateway_tenant_fk_sql := IF(
    @payment_gateway_tenant_fk IS NULL,
    'SELECT 1',
    CONCAT(
        'ALTER TABLE `payment_gateway_settings` DROP FOREIGN KEY `',
        REPLACE(@payment_gateway_tenant_fk, '`', '``'),
        '`'
    )
);

PREPARE stmt_drop_payment_gateway_tenant_fk
FROM @drop_payment_gateway_tenant_fk_sql;

EXECUTE stmt_drop_payment_gateway_tenant_fk;

DEALLOCATE PREPARE stmt_drop_payment_gateway_tenant_fk;
