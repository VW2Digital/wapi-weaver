-- Migration 012: Full Schema Reconciliation with Local Contract
-- Idempotent, data-safe DDL updates to evolve VPS database to target schema

SET @dbname = DATABASE();

-- ai_agent_settings.id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ai_agent_settings' AND COLUMN_NAME = 'id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ai_agent_settings` ADD COLUMN `id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ai_agent_settings.user_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ai_agent_settings' AND COLUMN_NAME = 'user_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ai_agent_settings` ADD COLUMN `user_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ai_agent_settings.instance_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ai_agent_settings' AND COLUMN_NAME = 'instance_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ai_agent_settings` ADD COLUMN `instance_id` varchar(50) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ai_agent_settings.is_active
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ai_agent_settings' AND COLUMN_NAME = 'is_active');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ai_agent_settings` ADD COLUMN `is_active` tinyint(1) NOT NULL DEFAULT \'0\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ai_agent_settings.api_key
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ai_agent_settings' AND COLUMN_NAME = 'api_key');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ai_agent_settings` ADD COLUMN `api_key` varchar(255) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ai_agent_settings.model
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ai_agent_settings' AND COLUMN_NAME = 'model');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ai_agent_settings` ADD COLUMN `model` varchar(50) NOT NULL DEFAULT \'gemini-2.5-flash\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ai_agent_settings.system_prompt
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ai_agent_settings' AND COLUMN_NAME = 'system_prompt');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ai_agent_settings` ADD COLUMN `system_prompt` text NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ai_agent_settings.created_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ai_agent_settings' AND COLUMN_NAME = 'created_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ai_agent_settings` ADD COLUMN `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ai_agent_settings.updated_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ai_agent_settings' AND COLUMN_NAME = 'updated_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ai_agent_settings` ADD COLUMN `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ai_usage_logs.id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ai_usage_logs' AND COLUMN_NAME = 'id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ai_usage_logs` ADD COLUMN `id` bigint AUTO_INCREMENT NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ai_usage_logs.tenant_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ai_usage_logs' AND COLUMN_NAME = 'tenant_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ai_usage_logs` ADD COLUMN `tenant_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ai_usage_logs.contact_phone
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ai_usage_logs' AND COLUMN_NAME = 'contact_phone');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ai_usage_logs` ADD COLUMN `contact_phone` varchar(50) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ai_usage_logs.model
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ai_usage_logs' AND COLUMN_NAME = 'model');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ai_usage_logs` ADD COLUMN `model` varchar(100) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ai_usage_logs.prompt_tokens
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ai_usage_logs' AND COLUMN_NAME = 'prompt_tokens');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ai_usage_logs` ADD COLUMN `prompt_tokens` int NOT NULL DEFAULT \'0\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ai_usage_logs.completion_tokens
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ai_usage_logs' AND COLUMN_NAME = 'completion_tokens');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ai_usage_logs` ADD COLUMN `completion_tokens` int NOT NULL DEFAULT \'0\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ai_usage_logs.total_tokens
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ai_usage_logs' AND COLUMN_NAME = 'total_tokens');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ai_usage_logs` ADD COLUMN `total_tokens` int NOT NULL DEFAULT \'0\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ai_usage_logs.created_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ai_usage_logs' AND COLUMN_NAME = 'created_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ai_usage_logs` ADD COLUMN `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- audit_logs.id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'audit_logs' AND COLUMN_NAME = 'id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `audit_logs` ADD COLUMN `id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- audit_logs.user_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'audit_logs' AND COLUMN_NAME = 'user_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `audit_logs` ADD COLUMN `user_id` varchar(36) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- audit_logs.tenant_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'audit_logs' AND COLUMN_NAME = 'tenant_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `audit_logs` ADD COLUMN `tenant_id` varchar(36) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- audit_logs.action
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'audit_logs' AND COLUMN_NAME = 'action');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `audit_logs` ADD COLUMN `action` varchar(255) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- audit_logs.entity_type
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'audit_logs' AND COLUMN_NAME = 'entity_type');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `audit_logs` ADD COLUMN `entity_type` varchar(100) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- audit_logs.entity_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'audit_logs' AND COLUMN_NAME = 'entity_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `audit_logs` ADD COLUMN `entity_id` varchar(100) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- audit_logs.actor_email
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'audit_logs' AND COLUMN_NAME = 'actor_email');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `audit_logs` ADD COLUMN `actor_email` varchar(255) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- audit_logs.ip
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'audit_logs' AND COLUMN_NAME = 'ip');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `audit_logs` ADD COLUMN `ip` varchar(50) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- audit_logs.user_agent
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'audit_logs' AND COLUMN_NAME = 'user_agent');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `audit_logs` ADD COLUMN `user_agent` text NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- audit_logs.metadata
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'audit_logs' AND COLUMN_NAME = 'metadata');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `audit_logs` ADD COLUMN `metadata` json NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- audit_logs.created_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'audit_logs' AND COLUMN_NAME = 'created_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `audit_logs` ADD COLUMN `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- billing_invoices.id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'billing_invoices' AND COLUMN_NAME = 'id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `billing_invoices` ADD COLUMN `id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- billing_invoices.tenant_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'billing_invoices' AND COLUMN_NAME = 'tenant_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `billing_invoices` ADD COLUMN `tenant_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- billing_invoices.customer_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'billing_invoices' AND COLUMN_NAME = 'customer_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `billing_invoices` ADD COLUMN `customer_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- billing_invoices.subscription_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'billing_invoices' AND COLUMN_NAME = 'subscription_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `billing_invoices` ADD COLUMN `subscription_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- billing_invoices.plan_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'billing_invoices' AND COLUMN_NAME = 'plan_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `billing_invoices` ADD COLUMN `plan_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- billing_invoices.invoice_number
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'billing_invoices' AND COLUMN_NAME = 'invoice_number');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `billing_invoices` ADD COLUMN `invoice_number` varchar(50) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- billing_invoices.description
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'billing_invoices' AND COLUMN_NAME = 'description');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `billing_invoices` ADD COLUMN `description` text NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- billing_invoices.amount
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'billing_invoices' AND COLUMN_NAME = 'amount');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `billing_invoices` ADD COLUMN `amount` decimal(10,2) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- billing_invoices.currency
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'billing_invoices' AND COLUMN_NAME = 'currency');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `billing_invoices` ADD COLUMN `currency` varchar(10) NOT NULL DEFAULT \'BRL\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- billing_invoices.status
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'billing_invoices' AND COLUMN_NAME = 'status');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `billing_invoices` ADD COLUMN `status` enum(\'draft\',\'pending\',\'paid\',\'failed\',\'expired\',\'cancelled\',\'refunded\') NOT NULL DEFAULT \'pending\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- billing_invoices.due_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'billing_invoices' AND COLUMN_NAME = 'due_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `billing_invoices` ADD COLUMN `due_at` datetime NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- billing_invoices.paid_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'billing_invoices' AND COLUMN_NAME = 'paid_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `billing_invoices` ADD COLUMN `paid_at` datetime NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- billing_invoices.cancelled_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'billing_invoices' AND COLUMN_NAME = 'cancelled_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `billing_invoices` ADD COLUMN `cancelled_at` datetime NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- billing_invoices.external_reference
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'billing_invoices' AND COLUMN_NAME = 'external_reference');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `billing_invoices` ADD COLUMN `external_reference` varchar(255) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- billing_invoices.metadata
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'billing_invoices' AND COLUMN_NAME = 'metadata');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `billing_invoices` ADD COLUMN `metadata` json NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- billing_invoices.created_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'billing_invoices' AND COLUMN_NAME = 'created_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `billing_invoices` ADD COLUMN `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- billing_invoices.updated_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'billing_invoices' AND COLUMN_NAME = 'updated_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `billing_invoices` ADD COLUMN `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- billing_payments.id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'billing_payments' AND COLUMN_NAME = 'id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `billing_payments` ADD COLUMN `id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- billing_payments.tenant_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'billing_payments' AND COLUMN_NAME = 'tenant_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `billing_payments` ADD COLUMN `tenant_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- billing_payments.customer_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'billing_payments' AND COLUMN_NAME = 'customer_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `billing_payments` ADD COLUMN `customer_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- billing_payments.subscription_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'billing_payments' AND COLUMN_NAME = 'subscription_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `billing_payments` ADD COLUMN `subscription_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- billing_payments.invoice_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'billing_payments' AND COLUMN_NAME = 'invoice_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `billing_payments` ADD COLUMN `invoice_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- billing_payments.provider
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'billing_payments' AND COLUMN_NAME = 'provider');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `billing_payments` ADD COLUMN `provider` varchar(50) NOT NULL DEFAULT \'mercadopago\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- billing_payments.provider_payment_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'billing_payments' AND COLUMN_NAME = 'provider_payment_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `billing_payments` ADD COLUMN `provider_payment_id` varchar(255) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- billing_payments.provider_order_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'billing_payments' AND COLUMN_NAME = 'provider_order_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `billing_payments` ADD COLUMN `provider_order_id` varchar(255) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- billing_payments.provider_preference_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'billing_payments' AND COLUMN_NAME = 'provider_preference_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `billing_payments` ADD COLUMN `provider_preference_id` varchar(255) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- billing_payments.external_reference
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'billing_payments' AND COLUMN_NAME = 'external_reference');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `billing_payments` ADD COLUMN `external_reference` varchar(255) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- billing_payments.payment_method
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'billing_payments' AND COLUMN_NAME = 'payment_method');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `billing_payments` ADD COLUMN `payment_method` varchar(50) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- billing_payments.payment_type
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'billing_payments' AND COLUMN_NAME = 'payment_type');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `billing_payments` ADD COLUMN `payment_type` varchar(50) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- billing_payments.status
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'billing_payments' AND COLUMN_NAME = 'status');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `billing_payments` ADD COLUMN `status` varchar(50) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- billing_payments.status_detail
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'billing_payments' AND COLUMN_NAME = 'status_detail');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `billing_payments` ADD COLUMN `status_detail` varchar(255) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- billing_payments.amount
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'billing_payments' AND COLUMN_NAME = 'amount');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `billing_payments` ADD COLUMN `amount` decimal(10,2) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- billing_payments.currency
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'billing_payments' AND COLUMN_NAME = 'currency');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `billing_payments` ADD COLUMN `currency` varchar(10) NOT NULL DEFAULT \'BRL\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- billing_payments.installments
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'billing_payments' AND COLUMN_NAME = 'installments');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `billing_payments` ADD COLUMN `installments` int NOT NULL DEFAULT \'1\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- billing_payments.payer_email
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'billing_payments' AND COLUMN_NAME = 'payer_email');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `billing_payments` ADD COLUMN `payer_email` varchar(255) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- billing_payments.approved_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'billing_payments' AND COLUMN_NAME = 'approved_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `billing_payments` ADD COLUMN `approved_at` datetime NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- billing_payments.expires_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'billing_payments' AND COLUMN_NAME = 'expires_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `billing_payments` ADD COLUMN `expires_at` datetime NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- billing_payments.raw_response
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'billing_payments' AND COLUMN_NAME = 'raw_response');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `billing_payments` ADD COLUMN `raw_response` json NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- billing_payments.environment
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'billing_payments' AND COLUMN_NAME = 'environment');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `billing_payments` ADD COLUMN `environment` enum(\'sandbox\',\'production\') NOT NULL DEFAULT \'sandbox\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- billing_payments.created_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'billing_payments' AND COLUMN_NAME = 'created_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `billing_payments` ADD COLUMN `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- billing_payments.updated_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'billing_payments' AND COLUMN_NAME = 'updated_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `billing_payments` ADD COLUMN `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- billing_plans.id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'billing_plans' AND COLUMN_NAME = 'id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `billing_plans` ADD COLUMN `id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- billing_plans.name
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'billing_plans' AND COLUMN_NAME = 'name');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `billing_plans` ADD COLUMN `name` varchar(255) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- billing_plans.description
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'billing_plans' AND COLUMN_NAME = 'description');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `billing_plans` ADD COLUMN `description` text NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- billing_plans.price
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'billing_plans' AND COLUMN_NAME = 'price');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `billing_plans` ADD COLUMN `price` decimal(10,2) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- billing_plans.currency
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'billing_plans' AND COLUMN_NAME = 'currency');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `billing_plans` ADD COLUMN `currency` varchar(10) NOT NULL DEFAULT \'BRL\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- billing_plans.billing_interval
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'billing_plans' AND COLUMN_NAME = 'billing_interval');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `billing_plans` ADD COLUMN `billing_interval` enum(\'day\',\'week\',\'month\',\'year\') NOT NULL DEFAULT \'month\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- billing_plans.billing_interval_count
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'billing_plans' AND COLUMN_NAME = 'billing_interval_count');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `billing_plans` ADD COLUMN `billing_interval_count` int NOT NULL DEFAULT \'1\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- billing_plans.duration_days
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'billing_plans' AND COLUMN_NAME = 'duration_days');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `billing_plans` ADD COLUMN `duration_days` int NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- billing_plans.features
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'billing_plans' AND COLUMN_NAME = 'features');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `billing_plans` ADD COLUMN `features` json NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- billing_plans.is_active
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'billing_plans' AND COLUMN_NAME = 'is_active');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `billing_plans` ADD COLUMN `is_active` tinyint(1) NOT NULL DEFAULT \'1\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- billing_plans.created_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'billing_plans' AND COLUMN_NAME = 'created_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `billing_plans` ADD COLUMN `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- billing_plans.updated_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'billing_plans' AND COLUMN_NAME = 'updated_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `billing_plans` ADD COLUMN `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- billing_plans.subscription_plan_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'billing_plans' AND COLUMN_NAME = 'subscription_plan_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `billing_plans` ADD COLUMN `subscription_plan_id` varchar(36) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- billing_webhook_events.id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'billing_webhook_events' AND COLUMN_NAME = 'id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `billing_webhook_events` ADD COLUMN `id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- billing_webhook_events.provider
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'billing_webhook_events' AND COLUMN_NAME = 'provider');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `billing_webhook_events` ADD COLUMN `provider` varchar(50) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- billing_webhook_events.environment
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'billing_webhook_events' AND COLUMN_NAME = 'environment');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `billing_webhook_events` ADD COLUMN `environment` enum(\'sandbox\',\'production\') NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- billing_webhook_events.event_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'billing_webhook_events' AND COLUMN_NAME = 'event_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `billing_webhook_events` ADD COLUMN `event_id` varchar(255) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- billing_webhook_events.event_type
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'billing_webhook_events' AND COLUMN_NAME = 'event_type');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `billing_webhook_events` ADD COLUMN `event_type` varchar(100) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- billing_webhook_events.resource_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'billing_webhook_events' AND COLUMN_NAME = 'resource_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `billing_webhook_events` ADD COLUMN `resource_id` varchar(255) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- billing_webhook_events.request_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'billing_webhook_events' AND COLUMN_NAME = 'request_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `billing_webhook_events` ADD COLUMN `request_id` varchar(255) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- billing_webhook_events.tenant_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'billing_webhook_events' AND COLUMN_NAME = 'tenant_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `billing_webhook_events` ADD COLUMN `tenant_id` varchar(36) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- billing_webhook_events.invoice_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'billing_webhook_events' AND COLUMN_NAME = 'invoice_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `billing_webhook_events` ADD COLUMN `invoice_id` varchar(36) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- billing_webhook_events.payment_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'billing_webhook_events' AND COLUMN_NAME = 'payment_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `billing_webhook_events` ADD COLUMN `payment_id` varchar(36) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- billing_webhook_events.payload_hash
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'billing_webhook_events' AND COLUMN_NAME = 'payload_hash');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `billing_webhook_events` ADD COLUMN `payload_hash` varchar(64) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- billing_webhook_events.payload
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'billing_webhook_events' AND COLUMN_NAME = 'payload');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `billing_webhook_events` ADD COLUMN `payload` json NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- billing_webhook_events.status
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'billing_webhook_events' AND COLUMN_NAME = 'status');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `billing_webhook_events` ADD COLUMN `status` enum(\'received\',\'processing\',\'processed\',\'ignored\',\'failed\') NOT NULL DEFAULT \'received\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- billing_webhook_events.attempts
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'billing_webhook_events' AND COLUMN_NAME = 'attempts');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `billing_webhook_events` ADD COLUMN `attempts` int NOT NULL DEFAULT \'0\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- billing_webhook_events.error_code
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'billing_webhook_events' AND COLUMN_NAME = 'error_code');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `billing_webhook_events` ADD COLUMN `error_code` varchar(100) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- billing_webhook_events.error_message
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'billing_webhook_events' AND COLUMN_NAME = 'error_message');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `billing_webhook_events` ADD COLUMN `error_message` text NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- billing_webhook_events.provider_created_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'billing_webhook_events' AND COLUMN_NAME = 'provider_created_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `billing_webhook_events` ADD COLUMN `provider_created_at` datetime NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- billing_webhook_events.received_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'billing_webhook_events' AND COLUMN_NAME = 'received_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `billing_webhook_events` ADD COLUMN `received_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- billing_webhook_events.processing_started_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'billing_webhook_events' AND COLUMN_NAME = 'processing_started_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `billing_webhook_events` ADD COLUMN `processing_started_at` datetime NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- billing_webhook_events.processed_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'billing_webhook_events' AND COLUMN_NAME = 'processed_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `billing_webhook_events` ADD COLUMN `processed_at` datetime NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- bot_conversation_state.id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'bot_conversation_state' AND COLUMN_NAME = 'id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `bot_conversation_state` ADD COLUMN `id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- bot_conversation_state.tenant_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'bot_conversation_state' AND COLUMN_NAME = 'tenant_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `bot_conversation_state` ADD COLUMN `tenant_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- bot_conversation_state.user_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'bot_conversation_state' AND COLUMN_NAME = 'user_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `bot_conversation_state` ADD COLUMN `user_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- bot_conversation_state.contact_number
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'bot_conversation_state' AND COLUMN_NAME = 'contact_number');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `bot_conversation_state` ADD COLUMN `contact_number` varchar(50) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- bot_conversation_state.instance_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'bot_conversation_state' AND COLUMN_NAME = 'instance_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `bot_conversation_state` ADD COLUMN `instance_id` varchar(50) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- bot_conversation_state.current_step_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'bot_conversation_state' AND COLUMN_NAME = 'current_step_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `bot_conversation_state` ADD COLUMN `current_step_id` varchar(36) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- bot_conversation_state.last_interaction
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'bot_conversation_state' AND COLUMN_NAME = 'last_interaction');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `bot_conversation_state` ADD COLUMN `last_interaction` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- bot_conversation_state.is_paused
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'bot_conversation_state' AND COLUMN_NAME = 'is_paused');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `bot_conversation_state` ADD COLUMN `is_paused` tinyint(1) NOT NULL DEFAULT \'0\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- bot_conversation_state.paused_until
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'bot_conversation_state' AND COLUMN_NAME = 'paused_until');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `bot_conversation_state` ADD COLUMN `paused_until` datetime NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- bot_conversation_state.bot_active
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'bot_conversation_state' AND COLUMN_NAME = 'bot_active');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `bot_conversation_state` ADD COLUMN `bot_active` tinyint(1) NOT NULL DEFAULT \'1\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- bot_conversation_state.created_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'bot_conversation_state' AND COLUMN_NAME = 'created_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `bot_conversation_state` ADD COLUMN `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- bot_conversation_state.updated_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'bot_conversation_state' AND COLUMN_NAME = 'updated_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `bot_conversation_state` ADD COLUMN `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- bot_conversation_state.channel
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'bot_conversation_state' AND COLUMN_NAME = 'channel');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `bot_conversation_state` ADD COLUMN `channel` varchar(50) NOT NULL DEFAULT \'whatsapp\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- bot_conversation_state.provider_account_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'bot_conversation_state' AND COLUMN_NAME = 'provider_account_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `bot_conversation_state` ADD COLUMN `provider_account_id` varchar(255) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- bot_flows.id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'bot_flows' AND COLUMN_NAME = 'id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `bot_flows` ADD COLUMN `id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- bot_flows.tenant_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'bot_flows' AND COLUMN_NAME = 'tenant_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `bot_flows` ADD COLUMN `tenant_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- bot_flows.name
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'bot_flows' AND COLUMN_NAME = 'name');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `bot_flows` ADD COLUMN `name` varchar(255) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- bot_flows.channel
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'bot_flows' AND COLUMN_NAME = 'channel');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `bot_flows` ADD COLUMN `channel` varchar(50) NOT NULL DEFAULT \'whatsapp\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- bot_flows.is_active
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'bot_flows' AND COLUMN_NAME = 'is_active');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `bot_flows` ADD COLUMN `is_active` tinyint(1) NOT NULL DEFAULT \'0\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- bot_flows.triggers_count
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'bot_flows' AND COLUMN_NAME = 'triggers_count');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `bot_flows` ADD COLUMN `triggers_count` int NOT NULL DEFAULT \'1\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- bot_flows.actions_count
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'bot_flows' AND COLUMN_NAME = 'actions_count');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `bot_flows` ADD COLUMN `actions_count` int NOT NULL DEFAULT \'1\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- bot_flows.last_executed_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'bot_flows' AND COLUMN_NAME = 'last_executed_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `bot_flows` ADD COLUMN `last_executed_at` datetime NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- bot_flows.created_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'bot_flows' AND COLUMN_NAME = 'created_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `bot_flows` ADD COLUMN `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- bot_flows.updated_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'bot_flows' AND COLUMN_NAME = 'updated_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `bot_flows` ADD COLUMN `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- bot_settings.id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'bot_settings' AND COLUMN_NAME = 'id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `bot_settings` ADD COLUMN `id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- bot_settings.tenant_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'bot_settings' AND COLUMN_NAME = 'tenant_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `bot_settings` ADD COLUMN `tenant_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- bot_settings.user_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'bot_settings' AND COLUMN_NAME = 'user_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `bot_settings` ADD COLUMN `user_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- bot_settings.instance_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'bot_settings' AND COLUMN_NAME = 'instance_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `bot_settings` ADD COLUMN `instance_id` varchar(50) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- bot_settings.is_active
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'bot_settings' AND COLUMN_NAME = 'is_active');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `bot_settings` ADD COLUMN `is_active` tinyint(1) NOT NULL DEFAULT \'0\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- bot_settings.pause_timeout_minutes
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'bot_settings' AND COLUMN_NAME = 'pause_timeout_minutes');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `bot_settings` ADD COLUMN `pause_timeout_minutes` int NOT NULL DEFAULT \'60\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- bot_settings.created_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'bot_settings' AND COLUMN_NAME = 'created_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `bot_settings` ADD COLUMN `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- bot_settings.updated_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'bot_settings' AND COLUMN_NAME = 'updated_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `bot_settings` ADD COLUMN `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- bot_settings.name
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'bot_settings' AND COLUMN_NAME = 'name');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `bot_settings` ADD COLUMN `name` varchar(150) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- bot_settings.channel
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'bot_settings' AND COLUMN_NAME = 'channel');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `bot_settings` ADD COLUMN `channel` enum(\'whatsapp\',\'instagram\',\'messenger\') NOT NULL DEFAULT \'whatsapp\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- bot_settings.priority
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'bot_settings' AND COLUMN_NAME = 'priority');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `bot_settings` ADD COLUMN `priority` int NOT NULL DEFAULT \'0\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- bot_settings.trigger_type
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'bot_settings' AND COLUMN_NAME = 'trigger_type');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `bot_settings` ADD COLUMN `trigger_type` varchar(50) NOT NULL DEFAULT \'start\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- bot_settings.trigger_value
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'bot_settings' AND COLUMN_NAME = 'trigger_value');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `bot_settings` ADD COLUMN `trigger_value` varchar(255) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- bot_settings.is_default
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'bot_settings' AND COLUMN_NAME = 'is_default');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `bot_settings` ADD COLUMN `is_default` tinyint(1) NOT NULL DEFAULT \'0\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- bot_step_options.id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'bot_step_options' AND COLUMN_NAME = 'id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `bot_step_options` ADD COLUMN `id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- bot_step_options.tenant_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'bot_step_options' AND COLUMN_NAME = 'tenant_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `bot_step_options` ADD COLUMN `tenant_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- bot_step_options.user_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'bot_step_options' AND COLUMN_NAME = 'user_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `bot_step_options` ADD COLUMN `user_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- bot_step_options.step_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'bot_step_options' AND COLUMN_NAME = 'step_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `bot_step_options` ADD COLUMN `step_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- bot_step_options.option_number
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'bot_step_options' AND COLUMN_NAME = 'option_number');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `bot_step_options` ADD COLUMN `option_number` int NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- bot_step_options.label
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'bot_step_options' AND COLUMN_NAME = 'label');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `bot_step_options` ADD COLUMN `label` varchar(50) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- bot_step_options.description
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'bot_step_options' AND COLUMN_NAME = 'description');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `bot_step_options` ADD COLUMN `description` varchar(255) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- bot_step_options.next_step_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'bot_step_options' AND COLUMN_NAME = 'next_step_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `bot_step_options` ADD COLUMN `next_step_id` varchar(36) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- bot_step_options.assign_team_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'bot_step_options' AND COLUMN_NAME = 'assign_team_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `bot_step_options` ADD COLUMN `assign_team_id` varchar(36) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- bot_step_options.assign_user_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'bot_step_options' AND COLUMN_NAME = 'assign_user_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `bot_step_options` ADD COLUMN `assign_user_id` varchar(36) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- bot_step_options.created_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'bot_step_options' AND COLUMN_NAME = 'created_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `bot_step_options` ADD COLUMN `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- bot_steps.id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'bot_steps' AND COLUMN_NAME = 'id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `bot_steps` ADD COLUMN `id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- bot_steps.tenant_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'bot_steps' AND COLUMN_NAME = 'tenant_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `bot_steps` ADD COLUMN `tenant_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- bot_steps.user_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'bot_steps' AND COLUMN_NAME = 'user_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `bot_steps` ADD COLUMN `user_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- bot_steps.bot_settings_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'bot_steps' AND COLUMN_NAME = 'bot_settings_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `bot_steps` ADD COLUMN `bot_settings_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- bot_steps.step_order
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'bot_steps' AND COLUMN_NAME = 'step_order');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `bot_steps` ADD COLUMN `step_order` int NOT NULL DEFAULT \'1\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- bot_steps.trigger_type
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'bot_steps' AND COLUMN_NAME = 'trigger_type');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `bot_steps` ADD COLUMN `trigger_type` varchar(50) NOT NULL DEFAULT \'keyword\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- bot_steps.trigger_value
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'bot_steps' AND COLUMN_NAME = 'trigger_value');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `bot_steps` ADD COLUMN `trigger_value` text NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- bot_steps.message_type
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'bot_steps' AND COLUMN_NAME = 'message_type');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `bot_steps` ADD COLUMN `message_type` varchar(50) NOT NULL DEFAULT \'text\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- bot_steps.message_content
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'bot_steps' AND COLUMN_NAME = 'message_content');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `bot_steps` ADD COLUMN `message_content` text NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- bot_steps.media_caption
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'bot_steps' AND COLUMN_NAME = 'media_caption');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `bot_steps` ADD COLUMN `media_caption` text NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- bot_steps.footer_text
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'bot_steps' AND COLUMN_NAME = 'footer_text');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `bot_steps` ADD COLUMN `footer_text` varchar(255) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- bot_steps.buttons_config
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'bot_steps' AND COLUMN_NAME = 'buttons_config');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `bot_steps` ADD COLUMN `buttons_config` json NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- bot_steps.next_step_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'bot_steps' AND COLUMN_NAME = 'next_step_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `bot_steps` ADD COLUMN `next_step_id` varchar(36) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- bot_steps.delay_seconds
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'bot_steps' AND COLUMN_NAME = 'delay_seconds');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `bot_steps` ADD COLUMN `delay_seconds` int NOT NULL DEFAULT \'0\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- bot_steps.assign_team_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'bot_steps' AND COLUMN_NAME = 'assign_team_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `bot_steps` ADD COLUMN `assign_team_id` varchar(36) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- bot_steps.assign_user_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'bot_steps' AND COLUMN_NAME = 'assign_user_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `bot_steps` ADD COLUMN `assign_user_id` varchar(36) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- bot_steps.handoff_message
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'bot_steps' AND COLUMN_NAME = 'handoff_message');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `bot_steps` ADD COLUMN `handoff_message` text NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- bot_steps.card_color
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'bot_steps' AND COLUMN_NAME = 'card_color');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `bot_steps` ADD COLUMN `card_color` varchar(50) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- bot_steps.created_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'bot_steps' AND COLUMN_NAME = 'created_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `bot_steps` ADD COLUMN `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- bot_steps.updated_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'bot_steps' AND COLUMN_NAME = 'updated_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `bot_steps` ADD COLUMN `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- bot_steps.media_url
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'bot_steps' AND COLUMN_NAME = 'media_url');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `bot_steps` ADD COLUMN `media_url` varchar(1024) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- bot_steps.position_x
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'bot_steps' AND COLUMN_NAME = 'position_x');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `bot_steps` ADD COLUMN `position_x` float NOT NULL DEFAULT \'0\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- bot_steps.position_y
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'bot_steps' AND COLUMN_NAME = 'position_y');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `bot_steps` ADD COLUMN `position_y` float NOT NULL DEFAULT \'0\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- bot_steps.flow_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'bot_steps' AND COLUMN_NAME = 'flow_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `bot_steps` ADD COLUMN `flow_id` varchar(36) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- calendar_events.id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'calendar_events' AND COLUMN_NAME = 'id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `calendar_events` ADD COLUMN `id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- calendar_events.tenant_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'calendar_events' AND COLUMN_NAME = 'tenant_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `calendar_events` ADD COLUMN `tenant_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- calendar_events.user_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'calendar_events' AND COLUMN_NAME = 'user_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `calendar_events` ADD COLUMN `user_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- calendar_events.title
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'calendar_events' AND COLUMN_NAME = 'title');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `calendar_events` ADD COLUMN `title` varchar(255) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- calendar_events.description
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'calendar_events' AND COLUMN_NAME = 'description');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `calendar_events` ADD COLUMN `description` text NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- calendar_events.event_type
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'calendar_events' AND COLUMN_NAME = 'event_type');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `calendar_events` ADD COLUMN `event_type` varchar(50) NOT NULL DEFAULT \'reuniao\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- calendar_events.status
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'calendar_events' AND COLUMN_NAME = 'status');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `calendar_events` ADD COLUMN `status` varchar(50) NOT NULL DEFAULT \'agendado\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- calendar_events.start_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'calendar_events' AND COLUMN_NAME = 'start_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `calendar_events` ADD COLUMN `start_at` datetime NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- calendar_events.end_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'calendar_events' AND COLUMN_NAME = 'end_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `calendar_events` ADD COLUMN `end_at` datetime NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- calendar_events.all_day
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'calendar_events' AND COLUMN_NAME = 'all_day');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `calendar_events` ADD COLUMN `all_day` tinyint(1) NOT NULL DEFAULT \'0\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- calendar_events.timezone
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'calendar_events' AND COLUMN_NAME = 'timezone');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `calendar_events` ADD COLUMN `timezone` varchar(100) NOT NULL DEFAULT \'America/Sao_Paulo\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- calendar_events.contact_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'calendar_events' AND COLUMN_NAME = 'contact_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `calendar_events` ADD COLUMN `contact_id` varchar(36) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- calendar_events.responsible_user_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'calendar_events' AND COLUMN_NAME = 'responsible_user_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `calendar_events` ADD COLUMN `responsible_user_id` varchar(36) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- calendar_events.team_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'calendar_events' AND COLUMN_NAME = 'team_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `calendar_events` ADD COLUMN `team_id` varchar(36) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- calendar_events.ds_agent_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'calendar_events' AND COLUMN_NAME = 'ds_agent_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `calendar_events` ADD COLUMN `ds_agent_id` varchar(36) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- calendar_events.location
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'calendar_events' AND COLUMN_NAME = 'location');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `calendar_events` ADD COLUMN `location` varchar(500) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- calendar_events.meeting_url
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'calendar_events' AND COLUMN_NAME = 'meeting_url');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `calendar_events` ADD COLUMN `meeting_url` varchar(1000) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- calendar_events.color
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'calendar_events' AND COLUMN_NAME = 'color');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `calendar_events` ADD COLUMN `color` varchar(30) NULL DEFAULT \'#7C3AED\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- calendar_events.recurrence_type
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'calendar_events' AND COLUMN_NAME = 'recurrence_type');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `calendar_events` ADD COLUMN `recurrence_type` varchar(50) NULL DEFAULT \'none\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- calendar_events.recurrence_rule
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'calendar_events' AND COLUMN_NAME = 'recurrence_rule');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `calendar_events` ADD COLUMN `recurrence_rule` text NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- calendar_events.reminder_minutes
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'calendar_events' AND COLUMN_NAME = 'reminder_minutes');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `calendar_events` ADD COLUMN `reminder_minutes` int NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- calendar_events.created_by_type
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'calendar_events' AND COLUMN_NAME = 'created_by_type');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `calendar_events` ADD COLUMN `created_by_type` enum(\'user\',\'ds_agent\',\'system\') NOT NULL DEFAULT \'user\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- calendar_events.created_by_user_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'calendar_events' AND COLUMN_NAME = 'created_by_user_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `calendar_events` ADD COLUMN `created_by_user_id` varchar(36) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- calendar_events.created_by_agent_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'calendar_events' AND COLUMN_NAME = 'created_by_agent_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `calendar_events` ADD COLUMN `created_by_agent_id` varchar(36) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- calendar_events.metadata
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'calendar_events' AND COLUMN_NAME = 'metadata');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `calendar_events` ADD COLUMN `metadata` json NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- calendar_events.created_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'calendar_events' AND COLUMN_NAME = 'created_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `calendar_events` ADD COLUMN `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- calendar_events.updated_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'calendar_events' AND COLUMN_NAME = 'updated_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `calendar_events` ADD COLUMN `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- calendar_events.deleted_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'calendar_events' AND COLUMN_NAME = 'deleted_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `calendar_events` ADD COLUMN `deleted_at` datetime NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- campaign_logs.id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'campaign_logs' AND COLUMN_NAME = 'id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `campaign_logs` ADD COLUMN `id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- campaign_logs.campaign_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'campaign_logs' AND COLUMN_NAME = 'campaign_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `campaign_logs` ADD COLUMN `campaign_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- campaign_logs.contact_number
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'campaign_logs' AND COLUMN_NAME = 'contact_number');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `campaign_logs` ADD COLUMN `contact_number` varchar(50) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- campaign_logs.status
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'campaign_logs' AND COLUMN_NAME = 'status');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `campaign_logs` ADD COLUMN `status` enum(\'sent\',\'delivered\',\'read\',\'failed\') NOT NULL DEFAULT \'sent\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- campaign_logs.error_message
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'campaign_logs' AND COLUMN_NAME = 'error_message');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `campaign_logs` ADD COLUMN `error_message` text NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- campaign_logs.created_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'campaign_logs' AND COLUMN_NAME = 'created_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `campaign_logs` ADD COLUMN `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- campaign_messages.id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'campaign_messages' AND COLUMN_NAME = 'id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `campaign_messages` ADD COLUMN `id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- campaign_messages.tenant_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'campaign_messages' AND COLUMN_NAME = 'tenant_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `campaign_messages` ADD COLUMN `tenant_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- campaign_messages.user_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'campaign_messages' AND COLUMN_NAME = 'user_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `campaign_messages` ADD COLUMN `user_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- campaign_messages.campaign_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'campaign_messages' AND COLUMN_NAME = 'campaign_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `campaign_messages` ADD COLUMN `campaign_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- campaign_messages.contact_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'campaign_messages' AND COLUMN_NAME = 'contact_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `campaign_messages` ADD COLUMN `contact_id` varchar(36) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- campaign_messages.to_phone
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'campaign_messages' AND COLUMN_NAME = 'to_phone');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `campaign_messages` ADD COLUMN `to_phone` varchar(50) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- campaign_messages.status
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'campaign_messages' AND COLUMN_NAME = 'status');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `campaign_messages` ADD COLUMN `status` enum(\'pending\',\'sending\',\'sent\',\'delivered\',\'read\',\'failed\') NOT NULL DEFAULT \'pending\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- campaign_messages.wa_message_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'campaign_messages' AND COLUMN_NAME = 'wa_message_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `campaign_messages` ADD COLUMN `wa_message_id` varchar(255) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- campaign_messages.conversation_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'campaign_messages' AND COLUMN_NAME = 'conversation_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `campaign_messages` ADD COLUMN `conversation_id` varchar(255) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- campaign_messages.conversation_origin
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'campaign_messages' AND COLUMN_NAME = 'conversation_origin');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `campaign_messages` ADD COLUMN `conversation_origin` varchar(255) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- campaign_messages.pricing_billable
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'campaign_messages' AND COLUMN_NAME = 'pricing_billable');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `campaign_messages` ADD COLUMN `pricing_billable` tinyint(1) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- campaign_messages.pricing_category
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'campaign_messages' AND COLUMN_NAME = 'pricing_category');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `campaign_messages` ADD COLUMN `pricing_category` varchar(50) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- campaign_messages.pricing_model
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'campaign_messages' AND COLUMN_NAME = 'pricing_model');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `campaign_messages` ADD COLUMN `pricing_model` varchar(50) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- campaign_messages.sent_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'campaign_messages' AND COLUMN_NAME = 'sent_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `campaign_messages` ADD COLUMN `sent_at` datetime NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- campaign_messages.delivered_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'campaign_messages' AND COLUMN_NAME = 'delivered_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `campaign_messages` ADD COLUMN `delivered_at` datetime NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- campaign_messages.read_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'campaign_messages' AND COLUMN_NAME = 'read_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `campaign_messages` ADD COLUMN `read_at` datetime NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- campaign_messages.failed_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'campaign_messages' AND COLUMN_NAME = 'failed_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `campaign_messages` ADD COLUMN `failed_at` datetime NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- campaign_messages.error
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'campaign_messages' AND COLUMN_NAME = 'error');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `campaign_messages` ADD COLUMN `error` json NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- campaign_messages.attempts
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'campaign_messages' AND COLUMN_NAME = 'attempts');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `campaign_messages` ADD COLUMN `attempts` int NOT NULL DEFAULT \'0\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- campaign_messages.created_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'campaign_messages' AND COLUMN_NAME = 'created_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `campaign_messages` ADD COLUMN `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- campaigns.id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'campaigns' AND COLUMN_NAME = 'id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `campaigns` ADD COLUMN `id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- campaigns.tenant_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'campaigns' AND COLUMN_NAME = 'tenant_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `campaigns` ADD COLUMN `tenant_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- campaigns.user_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'campaigns' AND COLUMN_NAME = 'user_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `campaigns` ADD COLUMN `user_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- campaigns.name
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'campaigns' AND COLUMN_NAME = 'name');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `campaigns` ADD COLUMN `name` varchar(255) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- campaigns.list_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'campaigns' AND COLUMN_NAME = 'list_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `campaigns` ADD COLUMN `list_id` varchar(36) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- campaigns.template_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'campaigns' AND COLUMN_NAME = 'template_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `campaigns` ADD COLUMN `template_id` varchar(36) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- campaigns.message_type
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'campaigns' AND COLUMN_NAME = 'message_type');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `campaigns` ADD COLUMN `message_type` enum(\'template\',\'text\',\'media\',\'interactive\') NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- campaigns.status
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'campaigns' AND COLUMN_NAME = 'status');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `campaigns` ADD COLUMN `status` enum(\'draft\',\'queued\',\'running\',\'done\',\'failed\',\'cancelled\') NOT NULL DEFAULT \'draft\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- campaigns.payload
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'campaigns' AND COLUMN_NAME = 'payload');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `campaigns` ADD COLUMN `payload` json NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- campaigns.totals
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'campaigns' AND COLUMN_NAME = 'totals');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `campaigns` ADD COLUMN `totals` json NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- campaigns.scheduled_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'campaigns' AND COLUMN_NAME = 'scheduled_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `campaigns` ADD COLUMN `scheduled_at` datetime NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- campaigns.started_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'campaigns' AND COLUMN_NAME = 'started_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `campaigns` ADD COLUMN `started_at` datetime NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- campaigns.finished_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'campaigns' AND COLUMN_NAME = 'finished_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `campaigns` ADD COLUMN `finished_at` datetime NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- campaigns.created_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'campaigns' AND COLUMN_NAME = 'created_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `campaigns` ADD COLUMN `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- campaigns.updated_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'campaigns' AND COLUMN_NAME = 'updated_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `campaigns` ADD COLUMN `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- chat_sessions.id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'chat_sessions' AND COLUMN_NAME = 'id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `chat_sessions` ADD COLUMN `id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- chat_sessions.tenant_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'chat_sessions' AND COLUMN_NAME = 'tenant_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `chat_sessions` ADD COLUMN `tenant_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- chat_sessions.user_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'chat_sessions' AND COLUMN_NAME = 'user_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `chat_sessions` ADD COLUMN `user_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- chat_sessions.contact_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'chat_sessions' AND COLUMN_NAME = 'contact_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `chat_sessions` ADD COLUMN `contact_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- chat_sessions.status
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'chat_sessions' AND COLUMN_NAME = 'status');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `chat_sessions` ADD COLUMN `status` varchar(50) NOT NULL DEFAULT \'aguardando\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- chat_sessions.started_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'chat_sessions' AND COLUMN_NAME = 'started_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `chat_sessions` ADD COLUMN `started_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- chat_sessions.answered_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'chat_sessions' AND COLUMN_NAME = 'answered_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `chat_sessions` ADD COLUMN `answered_at` datetime NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- chat_sessions.closed_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'chat_sessions' AND COLUMN_NAME = 'closed_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `chat_sessions` ADD COLUMN `closed_at` datetime NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- contact_activities.id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'contact_activities' AND COLUMN_NAME = 'id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `contact_activities` ADD COLUMN `id` bigint unsigned AUTO_INCREMENT NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- contact_activities.contact_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'contact_activities' AND COLUMN_NAME = 'contact_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `contact_activities` ADD COLUMN `contact_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- contact_activities.tenant_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'contact_activities' AND COLUMN_NAME = 'tenant_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `contact_activities` ADD COLUMN `tenant_id` varchar(36) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- contact_activities.type
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'contact_activities' AND COLUMN_NAME = 'type');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `contact_activities` ADD COLUMN `type` varchar(50) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- contact_activities.title
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'contact_activities' AND COLUMN_NAME = 'title');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `contact_activities` ADD COLUMN `title` varchar(255) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- contact_activities.description
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'contact_activities' AND COLUMN_NAME = 'description');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `contact_activities` ADD COLUMN `description` text NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- contact_activities.source_type
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'contact_activities' AND COLUMN_NAME = 'source_type');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `contact_activities` ADD COLUMN `source_type` varchar(50) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- contact_activities.source_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'contact_activities' AND COLUMN_NAME = 'source_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `contact_activities` ADD COLUMN `source_id` varchar(36) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- contact_activities.payload
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'contact_activities' AND COLUMN_NAME = 'payload');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `contact_activities` ADD COLUMN `payload` json NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- contact_activities.created_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'contact_activities' AND COLUMN_NAME = 'created_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `contact_activities` ADD COLUMN `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- contact_activities.user_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'contact_activities' AND COLUMN_NAME = 'user_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `contact_activities` ADD COLUMN `user_id` varchar(36) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- contact_custom_field_values.id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'contact_custom_field_values' AND COLUMN_NAME = 'id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `contact_custom_field_values` ADD COLUMN `id` bigint unsigned AUTO_INCREMENT NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- contact_custom_field_values.user_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'contact_custom_field_values' AND COLUMN_NAME = 'user_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `contact_custom_field_values` ADD COLUMN `user_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- contact_custom_field_values.contact_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'contact_custom_field_values' AND COLUMN_NAME = 'contact_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `contact_custom_field_values` ADD COLUMN `contact_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- contact_custom_field_values.custom_field_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'contact_custom_field_values' AND COLUMN_NAME = 'custom_field_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `contact_custom_field_values` ADD COLUMN `custom_field_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- contact_custom_field_values.value
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'contact_custom_field_values' AND COLUMN_NAME = 'value');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `contact_custom_field_values` ADD COLUMN `value` text NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- contact_custom_field_values.value_json
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'contact_custom_field_values' AND COLUMN_NAME = 'value_json');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `contact_custom_field_values` ADD COLUMN `value_json` json NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- contact_custom_field_values.created_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'contact_custom_field_values' AND COLUMN_NAME = 'created_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `contact_custom_field_values` ADD COLUMN `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- contact_custom_field_values.updated_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'contact_custom_field_values' AND COLUMN_NAME = 'updated_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `contact_custom_field_values` ADD COLUMN `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- contact_custom_fields.tenant_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'contact_custom_fields' AND COLUMN_NAME = 'tenant_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `contact_custom_fields` ADD COLUMN `tenant_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- contact_custom_fields.user_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'contact_custom_fields' AND COLUMN_NAME = 'user_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `contact_custom_fields` ADD COLUMN `user_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- contact_custom_fields.label
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'contact_custom_fields' AND COLUMN_NAME = 'label');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `contact_custom_fields` ADD COLUMN `label` varchar(255) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- contact_custom_fields.type
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'contact_custom_fields' AND COLUMN_NAME = 'type');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `contact_custom_fields` ADD COLUMN `type` enum(\'text\',\'textarea\',\'number\',\'currency\',\'date\',\'datetime\',\'select\',\'multi_select\',\'boolean\',\'email\',\'phone\',\'url\') NOT NULL DEFAULT \'text\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- contact_custom_fields.placeholder
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'contact_custom_fields' AND COLUMN_NAME = 'placeholder');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `contact_custom_fields` ADD COLUMN `placeholder` text NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- contact_custom_fields.options
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'contact_custom_fields' AND COLUMN_NAME = 'options');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `contact_custom_fields` ADD COLUMN `options` json NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- contact_custom_fields.default_value
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'contact_custom_fields' AND COLUMN_NAME = 'default_value');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `contact_custom_fields` ADD COLUMN `default_value` text NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- contact_custom_fields.required
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'contact_custom_fields' AND COLUMN_NAME = 'required');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `contact_custom_fields` ADD COLUMN `required` tinyint(1) NOT NULL DEFAULT \'0\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- contact_custom_fields.show_on_form
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'contact_custom_fields' AND COLUMN_NAME = 'show_on_form');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `contact_custom_fields` ADD COLUMN `show_on_form` tinyint(1) NOT NULL DEFAULT \'1\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- contact_custom_fields.show_on_table
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'contact_custom_fields' AND COLUMN_NAME = 'show_on_table');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `contact_custom_fields` ADD COLUMN `show_on_table` tinyint(1) NOT NULL DEFAULT \'0\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- contact_custom_fields.show_on_details
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'contact_custom_fields' AND COLUMN_NAME = 'show_on_details');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `contact_custom_fields` ADD COLUMN `show_on_details` tinyint(1) NOT NULL DEFAULT \'1\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- contact_custom_fields.is_active
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'contact_custom_fields' AND COLUMN_NAME = 'is_active');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `contact_custom_fields` ADD COLUMN `is_active` tinyint(1) NOT NULL DEFAULT \'1\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- contact_custom_fields.sort_order
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'contact_custom_fields' AND COLUMN_NAME = 'sort_order');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `contact_custom_fields` ADD COLUMN `sort_order` int NOT NULL DEFAULT \'0\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- contact_custom_fields.created_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'contact_custom_fields' AND COLUMN_NAME = 'created_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `contact_custom_fields` ADD COLUMN `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- contact_custom_fields.updated_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'contact_custom_fields' AND COLUMN_NAME = 'updated_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `contact_custom_fields` ADD COLUMN `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- contact_groups.contact_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'contact_groups' AND COLUMN_NAME = 'contact_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `contact_groups` ADD COLUMN `contact_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- contact_groups.group_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'contact_groups' AND COLUMN_NAME = 'group_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `contact_groups` ADD COLUMN `group_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- contact_tags.contact_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'contact_tags' AND COLUMN_NAME = 'contact_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `contact_tags` ADD COLUMN `contact_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- contact_tags.tag_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'contact_tags' AND COLUMN_NAME = 'tag_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `contact_tags` ADD COLUMN `tag_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- contact_tags.user_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'contact_tags' AND COLUMN_NAME = 'user_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `contact_tags` ADD COLUMN `user_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- contact_tags.tenant_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'contact_tags' AND COLUMN_NAME = 'tenant_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `contact_tags` ADD COLUMN `tenant_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- contacts.id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'contacts' AND COLUMN_NAME = 'id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `contacts` ADD COLUMN `id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- contacts.tenant_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'contacts' AND COLUMN_NAME = 'tenant_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `contacts` ADD COLUMN `tenant_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- contacts.user_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'contacts' AND COLUMN_NAME = 'user_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `contacts` ADD COLUMN `user_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- contacts.phone_e164
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'contacts' AND COLUMN_NAME = 'phone_e164');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `contacts` ADD COLUMN `phone_e164` varchar(50) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- contacts.name
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'contacts' AND COLUMN_NAME = 'name');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `contacts` ADD COLUMN `name` varchar(255) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- contacts.email
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'contacts' AND COLUMN_NAME = 'email');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `contacts` ADD COLUMN `email` varchar(255) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- contacts.source
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'contacts' AND COLUMN_NAME = 'source');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `contacts` ADD COLUMN `source` varchar(255) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- contacts.opted_out
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'contacts' AND COLUMN_NAME = 'opted_out');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `contacts` ADD COLUMN `opted_out` tinyint(1) NOT NULL DEFAULT \'0\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- contacts.custom_fields
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'contacts' AND COLUMN_NAME = 'custom_fields');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `contacts` ADD COLUMN `custom_fields` json NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- contacts.created_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'contacts' AND COLUMN_NAME = 'created_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `contacts` ADD COLUMN `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- contacts.updated_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'contacts' AND COLUMN_NAME = 'updated_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `contacts` ADD COLUMN `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- contacts.is_pinned
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'contacts' AND COLUMN_NAME = 'is_pinned');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `contacts` ADD COLUMN `is_pinned` tinyint(1) NOT NULL DEFAULT \'0\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- contacts.is_archived
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'contacts' AND COLUMN_NAME = 'is_archived');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `contacts` ADD COLUMN `is_archived` tinyint(1) NOT NULL DEFAULT \'0\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- contacts.chat_status
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'contacts' AND COLUMN_NAME = 'chat_status');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `contacts` ADD COLUMN `chat_status` varchar(50) NOT NULL DEFAULT \'aberto\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- contacts.is_unread
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'contacts' AND COLUMN_NAME = 'is_unread');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `contacts` ADD COLUMN `is_unread` tinyint(1) NOT NULL DEFAULT \'0\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- contacts.kanban_stage_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'contacts' AND COLUMN_NAME = 'kanban_stage_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `contacts` ADD COLUMN `kanban_stage_id` varchar(36) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- contacts.channel
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'contacts' AND COLUMN_NAME = 'channel');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `contacts` ADD COLUMN `channel` varchar(50) NOT NULL DEFAULT \'whatsapp\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- contacts.external_contact_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'contacts' AND COLUMN_NAME = 'external_contact_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `contacts` ADD COLUMN `external_contact_id` varchar(255) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- contacts.source_type
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'contacts' AND COLUMN_NAME = 'source_type');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `contacts` ADD COLUMN `source_type` varchar(50) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- contacts.source_name
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'contacts' AND COLUMN_NAME = 'source_name');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `contacts` ADD COLUMN `source_name` varchar(255) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- contacts.source_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'contacts' AND COLUMN_NAME = 'source_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `contacts` ADD COLUMN `source_id` varchar(36) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- contacts.external_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'contacts' AND COLUMN_NAME = 'external_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `contacts` ADD COLUMN `external_id` varchar(255) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- contacts.metadata
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'contacts' AND COLUMN_NAME = 'metadata');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `contacts` ADD COLUMN `metadata` json NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- contacts.last_interaction_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'contacts' AND COLUMN_NAME = 'last_interaction_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `contacts` ADD COLUMN `last_interaction_at` datetime NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- contacts.company
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'contacts' AND COLUMN_NAME = 'company');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `contacts` ADD COLUMN `company` varchar(255) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- contacts.position
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'contacts' AND COLUMN_NAME = 'position');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `contacts` ADD COLUMN `position` varchar(255) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- contacts.notes
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'contacts' AND COLUMN_NAME = 'notes');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `contacts` ADD COLUMN `notes` text NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- contacts.status
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'contacts' AND COLUMN_NAME = 'status');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `contacts` ADD COLUMN `status` varchar(50) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- contacts.responsible_user_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'contacts' AND COLUMN_NAME = 'responsible_user_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `contacts` ADD COLUMN `responsible_user_id` varchar(36) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- contacts.normalized_phone
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'contacts' AND COLUMN_NAME = 'normalized_phone');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `contacts` ADD COLUMN `normalized_phone` varchar(50) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- conversation_assignments.id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'conversation_assignments' AND COLUMN_NAME = 'id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `conversation_assignments` ADD COLUMN `id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- conversation_assignments.tenant_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'conversation_assignments' AND COLUMN_NAME = 'tenant_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `conversation_assignments` ADD COLUMN `tenant_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- conversation_assignments.user_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'conversation_assignments' AND COLUMN_NAME = 'user_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `conversation_assignments` ADD COLUMN `user_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- conversation_assignments.contact_phone
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'conversation_assignments' AND COLUMN_NAME = 'contact_phone');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `conversation_assignments` ADD COLUMN `contact_phone` varchar(50) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- conversation_assignments.team_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'conversation_assignments' AND COLUMN_NAME = 'team_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `conversation_assignments` ADD COLUMN `team_id` varchar(36) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- conversation_assignments.agent_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'conversation_assignments' AND COLUMN_NAME = 'agent_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `conversation_assignments` ADD COLUMN `agent_id` varchar(36) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- conversation_assignments.assigned_by
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'conversation_assignments' AND COLUMN_NAME = 'assigned_by');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `conversation_assignments` ADD COLUMN `assigned_by` varchar(36) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- conversation_assignments.assigned_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'conversation_assignments' AND COLUMN_NAME = 'assigned_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `conversation_assignments` ADD COLUMN `assigned_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- conversation_assignments.unassigned_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'conversation_assignments' AND COLUMN_NAME = 'unassigned_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `conversation_assignments` ADD COLUMN `unassigned_at` datetime NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- conversation_assignments.is_active
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'conversation_assignments' AND COLUMN_NAME = 'is_active');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `conversation_assignments` ADD COLUMN `is_active` tinyint(1) NOT NULL DEFAULT \'1\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- conversation_tags.contact_number
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'conversation_tags' AND COLUMN_NAME = 'contact_number');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `conversation_tags` ADD COLUMN `contact_number` varchar(50) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- conversation_tags.tag_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'conversation_tags' AND COLUMN_NAME = 'tag_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `conversation_tags` ADD COLUMN `tag_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- conversation_tags.user_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'conversation_tags' AND COLUMN_NAME = 'user_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `conversation_tags` ADD COLUMN `user_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- custom_fields.id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'custom_fields' AND COLUMN_NAME = 'id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `custom_fields` ADD COLUMN `id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- custom_fields.user_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'custom_fields' AND COLUMN_NAME = 'user_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `custom_fields` ADD COLUMN `user_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- custom_fields.field_key
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'custom_fields' AND COLUMN_NAME = 'field_key');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `custom_fields` ADD COLUMN `field_key` varchar(100) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- custom_fields.field_label
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'custom_fields' AND COLUMN_NAME = 'field_label');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `custom_fields` ADD COLUMN `field_label` varchar(255) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- custom_fields.field_type
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'custom_fields' AND COLUMN_NAME = 'field_type');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `custom_fields` ADD COLUMN `field_type` enum(\'text\',\'number\',\'date\',\'select\',\'boolean\') NOT NULL DEFAULT \'text\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- custom_fields.options_json
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'custom_fields' AND COLUMN_NAME = 'options_json');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `custom_fields` ADD COLUMN `options_json` json NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- custom_fields.created_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'custom_fields' AND COLUMN_NAME = 'created_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `custom_fields` ADD COLUMN `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- direct_messages.id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'direct_messages' AND COLUMN_NAME = 'id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `direct_messages` ADD COLUMN `id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- direct_messages.tenant_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'direct_messages' AND COLUMN_NAME = 'tenant_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `direct_messages` ADD COLUMN `tenant_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- direct_messages.user_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'direct_messages' AND COLUMN_NAME = 'user_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `direct_messages` ADD COLUMN `user_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- direct_messages.contact_phone
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'direct_messages' AND COLUMN_NAME = 'contact_phone');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `direct_messages` ADD COLUMN `contact_phone` varchar(50) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- direct_messages.direction
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'direct_messages' AND COLUMN_NAME = 'direction');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `direct_messages` ADD COLUMN `direction` enum(\'incoming\',\'outgoing\') NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- direct_messages.type
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'direct_messages' AND COLUMN_NAME = 'type');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `direct_messages` ADD COLUMN `type` enum(\'text\',\'reaction\',\'image\',\'audio\',\'video\',\'document\',\'sticker\',\'location\',\'contacts\') NOT NULL DEFAULT \'text\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- direct_messages.body
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'direct_messages' AND COLUMN_NAME = 'body');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `direct_messages` ADD COLUMN `body` text NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- direct_messages.wa_message_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'direct_messages' AND COLUMN_NAME = 'wa_message_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `direct_messages` ADD COLUMN `wa_message_id` varchar(255) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- direct_messages.status
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'direct_messages' AND COLUMN_NAME = 'status');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `direct_messages` ADD COLUMN `status` enum(\'sent\',\'delivered\',\'read\',\'failed\') NULL DEFAULT \'sent\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- direct_messages.reply_to_message_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'direct_messages' AND COLUMN_NAME = 'reply_to_message_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `direct_messages` ADD COLUMN `reply_to_message_id` varchar(255) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- direct_messages.metadata
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'direct_messages' AND COLUMN_NAME = 'metadata');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `direct_messages` ADD COLUMN `metadata` json NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- direct_messages.created_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'direct_messages' AND COLUMN_NAME = 'created_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `direct_messages` ADD COLUMN `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- direct_messages.channel
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'direct_messages' AND COLUMN_NAME = 'channel');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `direct_messages` ADD COLUMN `channel` varchar(50) NOT NULL DEFAULT \'whatsapp\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- direct_messages.provider_message_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'direct_messages' AND COLUMN_NAME = 'provider_message_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `direct_messages` ADD COLUMN `provider_message_id` varchar(255) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- direct_messages.provider_account_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'direct_messages' AND COLUMN_NAME = 'provider_account_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `direct_messages` ADD COLUMN `provider_account_id` varchar(255) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- direct_messages.sender_wa_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'direct_messages' AND COLUMN_NAME = 'sender_wa_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `direct_messages` ADD COLUMN `sender_wa_id` varchar(50) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- direct_messages.sender_name
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'direct_messages' AND COLUMN_NAME = 'sender_name');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `direct_messages` ADD COLUMN `sender_name` varchar(255) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- direct_messages.recipient_type
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'direct_messages' AND COLUMN_NAME = 'recipient_type');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `direct_messages` ADD COLUMN `recipient_type` varchar(50) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- direct_messages.external_group_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'direct_messages' AND COLUMN_NAME = 'external_group_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `direct_messages` ADD COLUMN `external_group_id` varchar(100) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- direct_messages.raw_payload
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'direct_messages' AND COLUMN_NAME = 'raw_payload');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `direct_messages` ADD COLUMN `raw_payload` json NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_assignments.id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_assignments' AND COLUMN_NAME = 'id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_assignments` ADD COLUMN `id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_assignments.tenant_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_assignments' AND COLUMN_NAME = 'tenant_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_assignments` ADD COLUMN `tenant_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_assignments.agent_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_assignments' AND COLUMN_NAME = 'agent_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_assignments` ADD COLUMN `agent_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_assignments.whatsapp_session_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_assignments' AND COLUMN_NAME = 'whatsapp_session_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_assignments` ADD COLUMN `whatsapp_session_id` varchar(36) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_assignments.funnel_stage_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_assignments' AND COLUMN_NAME = 'funnel_stage_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_assignments` ADD COLUMN `funnel_stage_id` varchar(36) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_assignments.created_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_assignments' AND COLUMN_NAME = 'created_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_assignments` ADD COLUMN `created_at` datetime NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_assignments.updated_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_assignments' AND COLUMN_NAME = 'updated_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_assignments` ADD COLUMN `updated_at` datetime NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_calendar_availability.id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_calendar_availability' AND COLUMN_NAME = 'id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_calendar_availability` ADD COLUMN `id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_calendar_availability.agent_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_calendar_availability' AND COLUMN_NAME = 'agent_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_calendar_availability` ADD COLUMN `agent_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_calendar_availability.tenant_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_calendar_availability' AND COLUMN_NAME = 'tenant_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_calendar_availability` ADD COLUMN `tenant_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_calendar_availability.weekday
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_calendar_availability' AND COLUMN_NAME = 'weekday');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_calendar_availability` ADD COLUMN `weekday` tinyint NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_calendar_availability.start_time
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_calendar_availability' AND COLUMN_NAME = 'start_time');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_calendar_availability` ADD COLUMN `start_time` time NOT NULL DEFAULT \'08:00:00\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_calendar_availability.end_time
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_calendar_availability' AND COLUMN_NAME = 'end_time');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_calendar_availability` ADD COLUMN `end_time` time NOT NULL DEFAULT \'18:00:00\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_calendar_availability.active
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_calendar_availability' AND COLUMN_NAME = 'active');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_calendar_availability` ADD COLUMN `active` tinyint(1) NOT NULL DEFAULT \'1\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_folders.id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_folders' AND COLUMN_NAME = 'id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_folders` ADD COLUMN `id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_folders.tenant_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_folders' AND COLUMN_NAME = 'tenant_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_folders` ADD COLUMN `tenant_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_folders.name
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_folders' AND COLUMN_NAME = 'name');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_folders` ADD COLUMN `name` varchar(255) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_folders.created_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_folders' AND COLUMN_NAME = 'created_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_folders` ADD COLUMN `created_at` datetime NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_folders.updated_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_folders' AND COLUMN_NAME = 'updated_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_folders` ADD COLUMN `updated_at` datetime NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_followups.id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_followups' AND COLUMN_NAME = 'id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_followups` ADD COLUMN `id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_followups.agent_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_followups' AND COLUMN_NAME = 'agent_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_followups` ADD COLUMN `agent_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_followups.tenant_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_followups' AND COLUMN_NAME = 'tenant_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_followups` ADD COLUMN `tenant_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_followups.name
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_followups' AND COLUMN_NAME = 'name');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_followups` ADD COLUMN `name` varchar(255) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_followups.message
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_followups' AND COLUMN_NAME = 'message');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_followups` ADD COLUMN `message` text NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_followups.type
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_followups' AND COLUMN_NAME = 'type');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_followups` ADD COLUMN `type` enum(\'manual\',\'generativo\') NOT NULL DEFAULT \'manual\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_followups.recurrence
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_followups' AND COLUMN_NAME = 'recurrence');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_followups` ADD COLUMN `recurrence` enum(\'unico\',\'recorrente\',\'diario\') NOT NULL DEFAULT \'unico\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_followups.wait_amount
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_followups' AND COLUMN_NAME = 'wait_amount');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_followups` ADD COLUMN `wait_amount` int NOT NULL DEFAULT \'10\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_followups.wait_unit
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_followups' AND COLUMN_NAME = 'wait_unit');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_followups` ADD COLUMN `wait_unit` enum(\'minutos\',\'horas\',\'dias\') NOT NULL DEFAULT \'minutos\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_followups.created_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_followups' AND COLUMN_NAME = 'created_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_followups` ADD COLUMN `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_knowledge.id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_knowledge' AND COLUMN_NAME = 'id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_knowledge` ADD COLUMN `id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_knowledge.tenant_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_knowledge' AND COLUMN_NAME = 'tenant_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_knowledge` ADD COLUMN `tenant_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_knowledge.agent_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_knowledge' AND COLUMN_NAME = 'agent_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_knowledge` ADD COLUMN `agent_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_knowledge.title
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_knowledge' AND COLUMN_NAME = 'title');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_knowledge` ADD COLUMN `title` varchar(255) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_knowledge.type
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_knowledge' AND COLUMN_NAME = 'type');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_knowledge` ADD COLUMN `type` enum(\'text\',\'faq\',\'url\',\'pdf\') NULL DEFAULT \'text\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_knowledge.content
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_knowledge' AND COLUMN_NAME = 'content');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_knowledge` ADD COLUMN `content` longtext NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_knowledge.status
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_knowledge' AND COLUMN_NAME = 'status');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_knowledge` ADD COLUMN `status` enum(\'pending\',\'indexed\',\'error\') NULL DEFAULT \'pending\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_knowledge.created_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_knowledge' AND COLUMN_NAME = 'created_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_knowledge` ADD COLUMN `created_at` datetime NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_knowledge.updated_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_knowledge' AND COLUMN_NAME = 'updated_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_knowledge` ADD COLUMN `updated_at` datetime NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_knowledge_files.id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_knowledge_files' AND COLUMN_NAME = 'id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_knowledge_files` ADD COLUMN `id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_knowledge_files.agent_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_knowledge_files' AND COLUMN_NAME = 'agent_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_knowledge_files` ADD COLUMN `agent_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_knowledge_files.tenant_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_knowledge_files' AND COLUMN_NAME = 'tenant_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_knowledge_files` ADD COLUMN `tenant_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_knowledge_files.file_name
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_knowledge_files' AND COLUMN_NAME = 'file_name');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_knowledge_files` ADD COLUMN `file_name` varchar(255) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_knowledge_files.file_size_kb
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_knowledge_files' AND COLUMN_NAME = 'file_size_kb');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_knowledge_files` ADD COLUMN `file_size_kb` int NOT NULL DEFAULT \'0\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_knowledge_files.page_count
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_knowledge_files' AND COLUMN_NAME = 'page_count');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_knowledge_files` ADD COLUMN `page_count` int NOT NULL DEFAULT \'1\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_knowledge_files.status
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_knowledge_files' AND COLUMN_NAME = 'status');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_knowledge_files` ADD COLUMN `status` enum(\'ativo\',\'inativo\') NOT NULL DEFAULT \'ativo\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_knowledge_files.storage_path
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_knowledge_files' AND COLUMN_NAME = 'storage_path');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_knowledge_files` ADD COLUMN `storage_path` text NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_knowledge_files.uploaded_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_knowledge_files' AND COLUMN_NAME = 'uploaded_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_knowledge_files` ADD COLUMN `uploaded_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_knowledge_links.id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_knowledge_links' AND COLUMN_NAME = 'id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_knowledge_links` ADD COLUMN `id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_knowledge_links.agent_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_knowledge_links' AND COLUMN_NAME = 'agent_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_knowledge_links` ADD COLUMN `agent_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_knowledge_links.tenant_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_knowledge_links' AND COLUMN_NAME = 'tenant_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_knowledge_links` ADD COLUMN `tenant_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_knowledge_links.url
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_knowledge_links' AND COLUMN_NAME = 'url');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_knowledge_links` ADD COLUMN `url` text NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_knowledge_links.status
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_knowledge_links' AND COLUMN_NAME = 'status');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_knowledge_links` ADD COLUMN `status` enum(\'pendente\',\'indexado\',\'erro\') NOT NULL DEFAULT \'pendente\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_knowledge_links.created_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_knowledge_links' AND COLUMN_NAME = 'created_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_knowledge_links` ADD COLUMN `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_logs.id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_logs' AND COLUMN_NAME = 'id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_logs` ADD COLUMN `id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_logs.tenant_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_logs' AND COLUMN_NAME = 'tenant_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_logs` ADD COLUMN `tenant_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_logs.agent_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_logs' AND COLUMN_NAME = 'agent_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_logs` ADD COLUMN `agent_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_logs.level
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_logs' AND COLUMN_NAME = 'level');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_logs` ADD COLUMN `level` enum(\'info\',\'warn\',\'error\') NULL DEFAULT \'info\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_logs.message
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_logs' AND COLUMN_NAME = 'message');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_logs` ADD COLUMN `message` text NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_logs.details
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_logs' AND COLUMN_NAME = 'details');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_logs` ADD COLUMN `details` json NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_logs.created_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_logs' AND COLUMN_NAME = 'created_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_logs` ADD COLUMN `created_at` datetime NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_sessions.id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_sessions' AND COLUMN_NAME = 'id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_sessions` ADD COLUMN `id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_sessions.tenant_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_sessions' AND COLUMN_NAME = 'tenant_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_sessions` ADD COLUMN `tenant_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_sessions.agent_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_sessions' AND COLUMN_NAME = 'agent_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_sessions` ADD COLUMN `agent_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_sessions.contact_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_sessions' AND COLUMN_NAME = 'contact_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_sessions` ADD COLUMN `contact_id` varchar(36) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_sessions.status
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_sessions' AND COLUMN_NAME = 'status');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_sessions` ADD COLUMN `status` enum(\'active\',\'paused\',\'completed\') NULL DEFAULT \'active\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_sessions.created_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_sessions' AND COLUMN_NAME = 'created_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_sessions` ADD COLUMN `created_at` datetime NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_sessions.updated_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_sessions' AND COLUMN_NAME = 'updated_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_sessions` ADD COLUMN `updated_at` datetime NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_subagents.id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_subagents' AND COLUMN_NAME = 'id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_subagents` ADD COLUMN `id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_subagents.tenant_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_subagents' AND COLUMN_NAME = 'tenant_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_subagents` ADD COLUMN `tenant_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_subagents.agent_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_subagents' AND COLUMN_NAME = 'agent_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_subagents` ADD COLUMN `agent_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_subagents.name
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_subagents' AND COLUMN_NAME = 'name');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_subagents` ADD COLUMN `name` varchar(255) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_subagents.role
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_subagents' AND COLUMN_NAME = 'role');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_subagents` ADD COLUMN `role` varchar(255) NOT NULL DEFAULT \'\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_subagents.instructions
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_subagents' AND COLUMN_NAME = 'instructions');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_subagents` ADD COLUMN `instructions` text NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_subagents.exec_order
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_subagents' AND COLUMN_NAME = 'exec_order');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_subagents` ADD COLUMN `exec_order` int NULL DEFAULT \'0\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_subagents.model
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_subagents' AND COLUMN_NAME = 'model');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_subagents` ADD COLUMN `model` varchar(100) NULL DEFAULT \'gpt-4o-mini\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_subagents.status
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_subagents' AND COLUMN_NAME = 'status');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_subagents` ADD COLUMN `status` enum(\'active\',\'inactive\') NULL DEFAULT \'active\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_subagents.created_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_subagents' AND COLUMN_NAME = 'created_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_subagents` ADD COLUMN `created_at` datetime NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_subagents.updated_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_subagents' AND COLUMN_NAME = 'updated_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_subagents` ADD COLUMN `updated_at` datetime NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_tools.id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_tools' AND COLUMN_NAME = 'id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_tools` ADD COLUMN `id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_tools.tenant_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_tools' AND COLUMN_NAME = 'tenant_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_tools` ADD COLUMN `tenant_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_tools.agent_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_tools' AND COLUMN_NAME = 'agent_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_tools` ADD COLUMN `agent_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_tools.name
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_tools' AND COLUMN_NAME = 'name');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_tools` ADD COLUMN `name` varchar(255) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_tools.description
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_tools' AND COLUMN_NAME = 'description');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_tools` ADD COLUMN `description` text NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_tools.permissions
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_tools' AND COLUMN_NAME = 'permissions');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_tools` ADD COLUMN `permissions` json NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_tools.require_confirmation
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_tools' AND COLUMN_NAME = 'require_confirmation');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_tools` ADD COLUMN `require_confirmation` tinyint(1) NULL DEFAULT \'1\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_tools.is_active
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_tools' AND COLUMN_NAME = 'is_active');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_tools` ADD COLUMN `is_active` tinyint(1) NULL DEFAULT \'1\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_tools.created_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_tools' AND COLUMN_NAME = 'created_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_tools` ADD COLUMN `created_at` datetime NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_tools.updated_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_tools' AND COLUMN_NAME = 'updated_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_tools` ADD COLUMN `updated_at` datetime NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_usage.id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_usage' AND COLUMN_NAME = 'id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_usage` ADD COLUMN `id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_usage.tenant_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_usage' AND COLUMN_NAME = 'tenant_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_usage` ADD COLUMN `tenant_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_usage.agent_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_usage' AND COLUMN_NAME = 'agent_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_usage` ADD COLUMN `agent_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_usage.session_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_usage' AND COLUMN_NAME = 'session_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_usage` ADD COLUMN `session_id` varchar(36) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_usage.prompt_tokens
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_usage' AND COLUMN_NAME = 'prompt_tokens');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_usage` ADD COLUMN `prompt_tokens` int NULL DEFAULT \'0\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_usage.completion_tokens
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_usage' AND COLUMN_NAME = 'completion_tokens');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_usage` ADD COLUMN `completion_tokens` int NULL DEFAULT \'0\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_usage.total_tokens
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_usage' AND COLUMN_NAME = 'total_tokens');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_usage` ADD COLUMN `total_tokens` int NULL DEFAULT \'0\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_usage.tools_called
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_usage' AND COLUMN_NAME = 'tools_called');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_usage` ADD COLUMN `tools_called` json NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_usage.response_time_ms
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_usage' AND COLUMN_NAME = 'response_time_ms');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_usage` ADD COLUMN `response_time_ms` int NULL DEFAULT \'0\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_usage.created_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_usage' AND COLUMN_NAME = 'created_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_usage` ADD COLUMN `created_at` datetime NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_usage_logs.id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_usage_logs' AND COLUMN_NAME = 'id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_usage_logs` ADD COLUMN `id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_usage_logs.agent_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_usage_logs' AND COLUMN_NAME = 'agent_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_usage_logs` ADD COLUMN `agent_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_usage_logs.tenant_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_usage_logs' AND COLUMN_NAME = 'tenant_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_usage_logs` ADD COLUMN `tenant_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_usage_logs.model
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_usage_logs' AND COLUMN_NAME = 'model');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_usage_logs` ADD COLUMN `model` varchar(100) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_usage_logs.provider
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_usage_logs' AND COLUMN_NAME = 'provider');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_usage_logs` ADD COLUMN `provider` varchar(100) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_usage_logs.category
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_usage_logs' AND COLUMN_NAME = 'category');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_usage_logs` ADD COLUMN `category` enum(\'action_analysis\',\'completion\',\'embedding\',\'query_rewriting\',\'transcription\') NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_usage_logs.tokens
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_usage_logs' AND COLUMN_NAME = 'tokens');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_usage_logs` ADD COLUMN `tokens` int NOT NULL DEFAULT \'0\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_usage_logs.cost_usd
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_usage_logs' AND COLUMN_NAME = 'cost_usd');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_usage_logs` ADD COLUMN `cost_usd` decimal(10,4) NOT NULL DEFAULT \'0.0000\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agent_usage_logs.created_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agent_usage_logs' AND COLUMN_NAME = 'created_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agent_usage_logs` ADD COLUMN `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agents.id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agents' AND COLUMN_NAME = 'id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agents` ADD COLUMN `id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agents.tenant_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agents' AND COLUMN_NAME = 'tenant_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agents` ADD COLUMN `tenant_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agents.folder_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agents' AND COLUMN_NAME = 'folder_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agents` ADD COLUMN `folder_id` varchar(36) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agents.name
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agents' AND COLUMN_NAME = 'name');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agents` ADD COLUMN `name` varchar(255) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agents.provider
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agents' AND COLUMN_NAME = 'provider');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agents` ADD COLUMN `provider` varchar(50) NOT NULL DEFAULT \'openai\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agents.api_key_encrypted
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agents' AND COLUMN_NAME = 'api_key_encrypted');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agents` ADD COLUMN `api_key_encrypted` text NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agents.model
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agents' AND COLUMN_NAME = 'model');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agents` ADD COLUMN `model` varchar(100) NOT NULL DEFAULT \'gpt-4o-mini\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agents.status
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agents' AND COLUMN_NAME = 'status');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agents` ADD COLUMN `status` enum(\'active\',\'inactive\') NULL DEFAULT \'inactive\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agents.system_prompt
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agents' AND COLUMN_NAME = 'system_prompt');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agents` ADD COLUMN `system_prompt` longtext NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agents.answer_only_assigned
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agents' AND COLUMN_NAME = 'answer_only_assigned');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agents` ADD COLUMN `answer_only_assigned` tinyint(1) NULL DEFAULT \'0\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agents.chunk_responses
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agents' AND COLUMN_NAME = 'chunk_responses');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agents` ADD COLUMN `chunk_responses` tinyint(1) NULL DEFAULT \'0\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agents.process_images
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agents' AND COLUMN_NAME = 'process_images');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agents` ADD COLUMN `process_images` tinyint(1) NULL DEFAULT \'0\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agents.process_audio
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agents' AND COLUMN_NAME = 'process_audio');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agents` ADD COLUMN `process_audio` tinyint(1) NULL DEFAULT \'0\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agents.disable_outside_hours
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agents' AND COLUMN_NAME = 'disable_outside_hours');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agents` ADD COLUMN `disable_outside_hours` tinyint(1) NULL DEFAULT \'0\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agents.pause_on_human
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agents' AND COLUMN_NAME = 'pause_on_human');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agents` ADD COLUMN `pause_on_human` tinyint(1) NULL DEFAULT \'1\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agents.wait_time_seconds
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agents' AND COLUMN_NAME = 'wait_time_seconds');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agents` ADD COLUMN `wait_time_seconds` int NULL DEFAULT \'0\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agents.max_messages_per_interaction
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agents' AND COLUMN_NAME = 'max_messages_per_interaction');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agents` ADD COLUMN `max_messages_per_interaction` int NULL DEFAULT \'5\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agents.temperature
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agents' AND COLUMN_NAME = 'temperature');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agents` ADD COLUMN `temperature` decimal(3,2) NULL DEFAULT \'0.70\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agents.max_tokens
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agents' AND COLUMN_NAME = 'max_tokens');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agents` ADD COLUMN `max_tokens` int NULL DEFAULT \'1000\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agents.created_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agents' AND COLUMN_NAME = 'created_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agents` ADD COLUMN `created_at` datetime NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agents.updated_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agents' AND COLUMN_NAME = 'updated_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agents` ADD COLUMN `updated_at` datetime NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agents.instructions_basic
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agents' AND COLUMN_NAME = 'instructions_basic');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agents` ADD COLUMN `instructions_basic` text NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agents.instructions_advanced
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agents' AND COLUMN_NAME = 'instructions_advanced');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agents` ADD COLUMN `instructions_advanced` text NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agents.mode
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agents' AND COLUMN_NAME = 'mode');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agents` ADD COLUMN `mode` enum(\'basico\',\'avancado\') NOT NULL DEFAULT \'basico\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agents.reply_with_assigned_agent
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agents' AND COLUMN_NAME = 'reply_with_assigned_agent');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agents` ADD COLUMN `reply_with_assigned_agent` tinyint(1) NOT NULL DEFAULT \'0\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agents.split_replies_in_blocks
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agents' AND COLUMN_NAME = 'split_replies_in_blocks');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agents` ADD COLUMN `split_replies_in_blocks` tinyint(1) NOT NULL DEFAULT \'0\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ds_agents.disabled_outside_platform
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agents' AND COLUMN_NAME = 'disabled_outside_platform');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `ds_agents` ADD COLUMN `disabled_outside_platform` tinyint(1) NOT NULL DEFAULT \'0\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- facebook_pages.id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'facebook_pages' AND COLUMN_NAME = 'id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `facebook_pages` ADD COLUMN `id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- facebook_pages.workspace_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'facebook_pages' AND COLUMN_NAME = 'workspace_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `facebook_pages` ADD COLUMN `workspace_id` varchar(36) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- facebook_pages.user_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'facebook_pages' AND COLUMN_NAME = 'user_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `facebook_pages` ADD COLUMN `user_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- facebook_pages.page_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'facebook_pages' AND COLUMN_NAME = 'page_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `facebook_pages` ADD COLUMN `page_id` varchar(64) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- facebook_pages.page_name
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'facebook_pages' AND COLUMN_NAME = 'page_name');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `facebook_pages` ADD COLUMN `page_name` varchar(255) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- facebook_pages.page_access_token
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'facebook_pages' AND COLUMN_NAME = 'page_access_token');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `facebook_pages` ADD COLUMN `page_access_token` text NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- facebook_pages.status
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'facebook_pages' AND COLUMN_NAME = 'status');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `facebook_pages` ADD COLUMN `status` varchar(32) NOT NULL DEFAULT \'active\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- facebook_pages.permissions_json
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'facebook_pages' AND COLUMN_NAME = 'permissions_json');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `facebook_pages` ADD COLUMN `permissions_json` text NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- facebook_pages.token_expires_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'facebook_pages' AND COLUMN_NAME = 'token_expires_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `facebook_pages` ADD COLUMN `token_expires_at` varchar(64) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- facebook_pages.webhook_subscribed
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'facebook_pages' AND COLUMN_NAME = 'webhook_subscribed');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `facebook_pages` ADD COLUMN `webhook_subscribed` tinyint(1) NOT NULL DEFAULT \'0\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- facebook_pages.created_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'facebook_pages' AND COLUMN_NAME = 'created_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `facebook_pages` ADD COLUMN `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- facebook_pages.updated_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'facebook_pages' AND COLUMN_NAME = 'updated_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `facebook_pages` ADD COLUMN `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- facebook_webhook_events.id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'facebook_webhook_events' AND COLUMN_NAME = 'id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `facebook_webhook_events` ADD COLUMN `id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- facebook_webhook_events.user_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'facebook_webhook_events' AND COLUMN_NAME = 'user_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `facebook_webhook_events` ADD COLUMN `user_id` varchar(36) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- facebook_webhook_events.raw
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'facebook_webhook_events' AND COLUMN_NAME = 'raw');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `facebook_webhook_events` ADD COLUMN `raw` json NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- facebook_webhook_events.processed
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'facebook_webhook_events' AND COLUMN_NAME = 'processed');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `facebook_webhook_events` ADD COLUMN `processed` tinyint(1) NOT NULL DEFAULT \'0\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- facebook_webhook_events.received_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'facebook_webhook_events' AND COLUMN_NAME = 'received_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `facebook_webhook_events` ADD COLUMN `received_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- groups.id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'groups' AND COLUMN_NAME = 'id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `groups` ADD COLUMN `id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- groups.user_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'groups' AND COLUMN_NAME = 'user_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `groups` ADD COLUMN `user_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- groups.name
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'groups' AND COLUMN_NAME = 'name');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `groups` ADD COLUMN `name` varchar(255) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- groups.description
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'groups' AND COLUMN_NAME = 'description');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `groups` ADD COLUMN `description` text NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- groups.created_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'groups' AND COLUMN_NAME = 'created_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `groups` ADD COLUMN `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- groups.updated_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'groups' AND COLUMN_NAME = 'updated_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `groups` ADD COLUMN `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- incoming_webhook_events.id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'incoming_webhook_events' AND COLUMN_NAME = 'id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `incoming_webhook_events` ADD COLUMN `id` bigint unsigned AUTO_INCREMENT NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- incoming_webhook_events.incoming_webhook_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'incoming_webhook_events' AND COLUMN_NAME = 'incoming_webhook_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `incoming_webhook_events` ADD COLUMN `incoming_webhook_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- incoming_webhook_events.payload
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'incoming_webhook_events' AND COLUMN_NAME = 'payload');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `incoming_webhook_events` ADD COLUMN `payload` json NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- incoming_webhook_events.status
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'incoming_webhook_events' AND COLUMN_NAME = 'status');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `incoming_webhook_events` ADD COLUMN `status` enum(\'success\',\'error\') NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- incoming_webhook_events.error_message
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'incoming_webhook_events' AND COLUMN_NAME = 'error_message');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `incoming_webhook_events` ADD COLUMN `error_message` text NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- incoming_webhook_events.created_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'incoming_webhook_events' AND COLUMN_NAME = 'created_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `incoming_webhook_events` ADD COLUMN `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- incoming_webhook_events.user_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'incoming_webhook_events' AND COLUMN_NAME = 'user_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `incoming_webhook_events` ADD COLUMN `user_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- incoming_webhook_events.webhook_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'incoming_webhook_events' AND COLUMN_NAME = 'webhook_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `incoming_webhook_events` ADD COLUMN `webhook_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- incoming_webhook_events.contact_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'incoming_webhook_events' AND COLUMN_NAME = 'contact_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `incoming_webhook_events` ADD COLUMN `contact_id` varchar(36) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- incoming_webhook_events.idempotency_key
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'incoming_webhook_events' AND COLUMN_NAME = 'idempotency_key');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `incoming_webhook_events` ADD COLUMN `idempotency_key` varchar(64) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- incoming_webhook_events.action
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'incoming_webhook_events' AND COLUMN_NAME = 'action');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `incoming_webhook_events` ADD COLUMN `action` varchar(50) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- incoming_webhook_events.raw_payload
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'incoming_webhook_events' AND COLUMN_NAME = 'raw_payload');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `incoming_webhook_events` ADD COLUMN `raw_payload` json NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- incoming_webhook_events.mapped_standard_fields
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'incoming_webhook_events' AND COLUMN_NAME = 'mapped_standard_fields');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `incoming_webhook_events` ADD COLUMN `mapped_standard_fields` json NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- incoming_webhook_events.mapped_custom_fields
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'incoming_webhook_events' AND COLUMN_NAME = 'mapped_custom_fields');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `incoming_webhook_events` ADD COLUMN `mapped_custom_fields` json NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- incoming_webhook_events.unmapped_fields
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'incoming_webhook_events' AND COLUMN_NAME = 'unmapped_fields');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `incoming_webhook_events` ADD COLUMN `unmapped_fields` json NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- incoming_webhook_events.headers
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'incoming_webhook_events' AND COLUMN_NAME = 'headers');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `incoming_webhook_events` ADD COLUMN `headers` json NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- incoming_webhook_events.ip_address
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'incoming_webhook_events' AND COLUMN_NAME = 'ip_address');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `incoming_webhook_events` ADD COLUMN `ip_address` varchar(45) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- incoming_webhook_events.user_agent
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'incoming_webhook_events' AND COLUMN_NAME = 'user_agent');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `incoming_webhook_events` ADD COLUMN `user_agent` text NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- incoming_webhook_events.error_code
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'incoming_webhook_events' AND COLUMN_NAME = 'error_code');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `incoming_webhook_events` ADD COLUMN `error_code` varchar(50) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- incoming_webhook_events.received_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'incoming_webhook_events' AND COLUMN_NAME = 'received_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `incoming_webhook_events` ADD COLUMN `received_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- incoming_webhook_events.processed_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'incoming_webhook_events' AND COLUMN_NAME = 'processed_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `incoming_webhook_events` ADD COLUMN `processed_at` datetime NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- incoming_webhook_events.processing_duration_ms
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'incoming_webhook_events' AND COLUMN_NAME = 'processing_duration_ms');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `incoming_webhook_events` ADD COLUMN `processing_duration_ms` int unsigned NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- incoming_webhook_events.updated_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'incoming_webhook_events' AND COLUMN_NAME = 'updated_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `incoming_webhook_events` ADD COLUMN `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- incoming_webhooks.id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'incoming_webhooks' AND COLUMN_NAME = 'id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `incoming_webhooks` ADD COLUMN `id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- incoming_webhooks.tenant_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'incoming_webhooks' AND COLUMN_NAME = 'tenant_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `incoming_webhooks` ADD COLUMN `tenant_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- incoming_webhooks.name
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'incoming_webhooks' AND COLUMN_NAME = 'name');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `incoming_webhooks` ADD COLUMN `name` varchar(255) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- incoming_webhooks.token
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'incoming_webhooks' AND COLUMN_NAME = 'token');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `incoming_webhooks` ADD COLUMN `token` varchar(64) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- incoming_webhooks.status
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'incoming_webhooks' AND COLUMN_NAME = 'status');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `incoming_webhooks` ADD COLUMN `status` enum(\'listening\',\'paused\') NOT NULL DEFAULT \'listening\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- incoming_webhooks.events_count
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'incoming_webhooks' AND COLUMN_NAME = 'events_count');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `incoming_webhooks` ADD COLUMN `events_count` int NOT NULL DEFAULT \'0\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- incoming_webhooks.leads_count
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'incoming_webhooks' AND COLUMN_NAME = 'leads_count');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `incoming_webhooks` ADD COLUMN `leads_count` int NOT NULL DEFAULT \'0\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- incoming_webhooks.last_event_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'incoming_webhooks' AND COLUMN_NAME = 'last_event_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `incoming_webhooks` ADD COLUMN `last_event_at` datetime NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- incoming_webhooks.created_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'incoming_webhooks' AND COLUMN_NAME = 'created_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `incoming_webhooks` ADD COLUMN `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- incoming_webhooks.updated_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'incoming_webhooks' AND COLUMN_NAME = 'updated_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `incoming_webhooks` ADD COLUMN `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- incoming_webhooks.field_labels
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'incoming_webhooks' AND COLUMN_NAME = 'field_labels');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `incoming_webhooks` ADD COLUMN `field_labels` json NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- instagram_accounts.id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'instagram_accounts' AND COLUMN_NAME = 'id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `instagram_accounts` ADD COLUMN `id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- instagram_accounts.user_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'instagram_accounts' AND COLUMN_NAME = 'user_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `instagram_accounts` ADD COLUMN `user_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- instagram_accounts.ig_user_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'instagram_accounts' AND COLUMN_NAME = 'ig_user_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `instagram_accounts` ADD COLUMN `ig_user_id` varchar(100) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- instagram_accounts.username
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'instagram_accounts' AND COLUMN_NAME = 'username');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `instagram_accounts` ADD COLUMN `username` varchar(100) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- instagram_accounts.access_token
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'instagram_accounts' AND COLUMN_NAME = 'access_token');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `instagram_accounts` ADD COLUMN `access_token` text NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- instagram_accounts.token_expires_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'instagram_accounts' AND COLUMN_NAME = 'token_expires_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `instagram_accounts` ADD COLUMN `token_expires_at` datetime NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- instagram_accounts.status
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'instagram_accounts' AND COLUMN_NAME = 'status');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `instagram_accounts` ADD COLUMN `status` varchar(50) NOT NULL DEFAULT \'active\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- instagram_accounts.created_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'instagram_accounts' AND COLUMN_NAME = 'created_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `instagram_accounts` ADD COLUMN `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- instagram_accounts.updated_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'instagram_accounts' AND COLUMN_NAME = 'updated_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `instagram_accounts` ADD COLUMN `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- instagram_webhook_events.id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'instagram_webhook_events' AND COLUMN_NAME = 'id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `instagram_webhook_events` ADD COLUMN `id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- instagram_webhook_events.user_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'instagram_webhook_events' AND COLUMN_NAME = 'user_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `instagram_webhook_events` ADD COLUMN `user_id` varchar(36) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- instagram_webhook_events.raw
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'instagram_webhook_events' AND COLUMN_NAME = 'raw');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `instagram_webhook_events` ADD COLUMN `raw` json NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- instagram_webhook_events.processed
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'instagram_webhook_events' AND COLUMN_NAME = 'processed');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `instagram_webhook_events` ADD COLUMN `processed` tinyint(1) NOT NULL DEFAULT \'0\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- instagram_webhook_events.received_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'instagram_webhook_events' AND COLUMN_NAME = 'received_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `instagram_webhook_events` ADD COLUMN `received_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- knowledge_base.id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'knowledge_base' AND COLUMN_NAME = 'id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `knowledge_base` ADD COLUMN `id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- knowledge_base.user_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'knowledge_base' AND COLUMN_NAME = 'user_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `knowledge_base` ADD COLUMN `user_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- knowledge_base.ai_agent_settings_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'knowledge_base' AND COLUMN_NAME = 'ai_agent_settings_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `knowledge_base` ADD COLUMN `ai_agent_settings_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- knowledge_base.title
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'knowledge_base' AND COLUMN_NAME = 'title');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `knowledge_base` ADD COLUMN `title` varchar(255) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- knowledge_base.content
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'knowledge_base' AND COLUMN_NAME = 'content');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `knowledge_base` ADD COLUMN `content` text NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- knowledge_base.created_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'knowledge_base' AND COLUMN_NAME = 'created_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `knowledge_base` ADD COLUMN `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- knowledge_base.updated_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'knowledge_base' AND COLUMN_NAME = 'updated_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `knowledge_base` ADD COLUMN `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- license_activations.id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'license_activations' AND COLUMN_NAME = 'id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `license_activations` ADD COLUMN `id` bigint unsigned AUTO_INCREMENT NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- license_activations.license_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'license_activations' AND COLUMN_NAME = 'license_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `license_activations` ADD COLUMN `license_id` bigint unsigned NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- license_activations.domain
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'license_activations' AND COLUMN_NAME = 'domain');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `license_activations` ADD COLUMN `domain` varchar(190) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- license_activations.installation_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'license_activations' AND COLUMN_NAME = 'installation_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `license_activations` ADD COLUMN `installation_id` varchar(120) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- license_activations.ip_address
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'license_activations' AND COLUMN_NAME = 'ip_address');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `license_activations` ADD COLUMN `ip_address` varchar(80) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- license_activations.status
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'license_activations' AND COLUMN_NAME = 'status');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `license_activations` ADD COLUMN `status` varchar(30) NOT NULL DEFAULT \'active\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- license_activations.activated_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'license_activations' AND COLUMN_NAME = 'activated_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `license_activations` ADD COLUMN `activated_at` datetime NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- license_settings.id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'license_settings' AND COLUMN_NAME = 'id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `license_settings` ADD COLUMN `id` int NOT NULL DEFAULT \'1\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- license_settings.license_key_encrypted
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'license_settings' AND COLUMN_NAME = 'license_key_encrypted');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `license_settings` ADD COLUMN `license_key_encrypted` text NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- license_settings.license_status
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'license_settings' AND COLUMN_NAME = 'license_status');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `license_settings` ADD COLUMN `license_status` varchar(50) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- license_settings.plan
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'license_settings' AND COLUMN_NAME = 'plan');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `license_settings` ADD COLUMN `plan` varchar(100) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- license_settings.features_json
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'license_settings' AND COLUMN_NAME = 'features_json');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `license_settings` ADD COLUMN `features_json` json NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- license_settings.domain
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'license_settings' AND COLUMN_NAME = 'domain');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `license_settings` ADD COLUMN `domain` varchar(255) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- license_settings.installation_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'license_settings' AND COLUMN_NAME = 'installation_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `license_settings` ADD COLUMN `installation_id` varchar(255) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- license_settings.activated_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'license_settings' AND COLUMN_NAME = 'activated_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `license_settings` ADD COLUMN `activated_at` datetime NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- license_settings.last_validated_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'license_settings' AND COLUMN_NAME = 'last_validated_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `license_settings` ADD COLUMN `last_validated_at` datetime NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- license_settings.expires_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'license_settings' AND COLUMN_NAME = 'expires_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `license_settings` ADD COLUMN `expires_at` datetime NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- license_settings.cache_valid_until
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'license_settings' AND COLUMN_NAME = 'cache_valid_until');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `license_settings` ADD COLUMN `cache_valid_until` datetime NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- license_settings.grace_until
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'license_settings' AND COLUMN_NAME = 'grace_until');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `license_settings` ADD COLUMN `grace_until` datetime NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- license_settings.last_error
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'license_settings' AND COLUMN_NAME = 'last_error');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `license_settings` ADD COLUMN `last_error` text NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- license_settings.created_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'license_settings' AND COLUMN_NAME = 'created_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `license_settings` ADD COLUMN `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- license_settings.updated_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'license_settings' AND COLUMN_NAME = 'updated_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `license_settings` ADD COLUMN `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- license_validation_logs.id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'license_validation_logs' AND COLUMN_NAME = 'id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `license_validation_logs` ADD COLUMN `id` bigint unsigned AUTO_INCREMENT NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- license_validation_logs.license_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'license_validation_logs' AND COLUMN_NAME = 'license_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `license_validation_logs` ADD COLUMN `license_id` bigint unsigned NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- license_validation_logs.domain
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'license_validation_logs' AND COLUMN_NAME = 'domain');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `license_validation_logs` ADD COLUMN `domain` varchar(190) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- license_validation_logs.ip_address
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'license_validation_logs' AND COLUMN_NAME = 'ip_address');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `license_validation_logs` ADD COLUMN `ip_address` varchar(80) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- license_validation_logs.created_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'license_validation_logs' AND COLUMN_NAME = 'created_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `license_validation_logs` ADD COLUMN `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- licenses.id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'licenses' AND COLUMN_NAME = 'id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `licenses` ADD COLUMN `id` bigint unsigned AUTO_INCREMENT NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- licenses.license_key_hash
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'licenses' AND COLUMN_NAME = 'license_key_hash');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `licenses` ADD COLUMN `license_key_hash` char(64) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- licenses.license_key_preview
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'licenses' AND COLUMN_NAME = 'license_key_preview');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `licenses` ADD COLUMN `license_key_preview` varchar(60) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- licenses.client_name
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'licenses' AND COLUMN_NAME = 'client_name');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `licenses` ADD COLUMN `client_name` varchar(160) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- licenses.client_email
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'licenses' AND COLUMN_NAME = 'client_email');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `licenses` ADD COLUMN `client_email` varchar(190) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- licenses.plan
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'licenses' AND COLUMN_NAME = 'plan');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `licenses` ADD COLUMN `plan` varchar(80) NOT NULL DEFAULT \'basic\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- licenses.status
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'licenses' AND COLUMN_NAME = 'status');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `licenses` ADD COLUMN `status` varchar(30) NOT NULL DEFAULT \'active\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- licenses.expires_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'licenses' AND COLUMN_NAME = 'expires_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `licenses` ADD COLUMN `expires_at` datetime NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- licenses.created_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'licenses' AND COLUMN_NAME = 'created_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `licenses` ADD COLUMN `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- licenses.updated_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'licenses' AND COLUMN_NAME = 'updated_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `licenses` ADD COLUMN `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- licenses.tenant_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'licenses' AND COLUMN_NAME = 'tenant_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `licenses` ADD COLUMN `tenant_id` varchar(36) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- list_contacts.list_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'list_contacts' AND COLUMN_NAME = 'list_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `list_contacts` ADD COLUMN `list_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- list_contacts.contact_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'list_contacts' AND COLUMN_NAME = 'contact_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `list_contacts` ADD COLUMN `contact_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- list_contacts.user_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'list_contacts' AND COLUMN_NAME = 'user_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `list_contacts` ADD COLUMN `user_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- list_contacts.added_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'list_contacts' AND COLUMN_NAME = 'added_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `list_contacts` ADD COLUMN `added_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- list_contacts.tenant_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'list_contacts' AND COLUMN_NAME = 'tenant_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `list_contacts` ADD COLUMN `tenant_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- lists.id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'lists' AND COLUMN_NAME = 'id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `lists` ADD COLUMN `id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- lists.tenant_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'lists' AND COLUMN_NAME = 'tenant_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `lists` ADD COLUMN `tenant_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- lists.user_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'lists' AND COLUMN_NAME = 'user_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `lists` ADD COLUMN `user_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- lists.name
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'lists' AND COLUMN_NAME = 'name');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `lists` ADD COLUMN `name` varchar(255) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- lists.description
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'lists' AND COLUMN_NAME = 'description');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `lists` ADD COLUMN `description` text NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- lists.created_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'lists' AND COLUMN_NAME = 'created_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `lists` ADD COLUMN `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- lists.updated_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'lists' AND COLUMN_NAME = 'updated_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `lists` ADD COLUMN `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- message_tags.message_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'message_tags' AND COLUMN_NAME = 'message_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `message_tags` ADD COLUMN `message_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- message_tags.tag_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'message_tags' AND COLUMN_NAME = 'tag_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `message_tags` ADD COLUMN `tag_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- message_tags.user_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'message_tags' AND COLUMN_NAME = 'user_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `message_tags` ADD COLUMN `user_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- notifications.id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `notifications` ADD COLUMN `id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- notifications.tenant_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'tenant_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `notifications` ADD COLUMN `tenant_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- notifications.user_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'user_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `notifications` ADD COLUMN `user_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- notifications.type
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'type');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `notifications` ADD COLUMN `type` varchar(50) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- notifications.title
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'title');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `notifications` ADD COLUMN `title` varchar(255) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- notifications.message
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'message');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `notifications` ADD COLUMN `message` text NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- notifications.action_url
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'action_url');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `notifications` ADD COLUMN `action_url` varchar(255) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- notifications.is_read
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'is_read');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `notifications` ADD COLUMN `is_read` tinyint(1) NOT NULL DEFAULT \'0\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- notifications.unique_key
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'unique_key');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `notifications` ADD COLUMN `unique_key` varchar(255) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- notifications.created_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'created_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `notifications` ADD COLUMN `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- notifications.read_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'read_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `notifications` ADD COLUMN `read_at` datetime NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunities.id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunities' AND COLUMN_NAME = 'id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunities` ADD COLUMN `id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunities.tenant_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunities' AND COLUMN_NAME = 'tenant_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunities` ADD COLUMN `tenant_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunities.user_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunities' AND COLUMN_NAME = 'user_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunities` ADD COLUMN `user_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunities.funnel_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunities' AND COLUMN_NAME = 'funnel_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunities` ADD COLUMN `funnel_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunities.stage_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunities' AND COLUMN_NAME = 'stage_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunities` ADD COLUMN `stage_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunities.title
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunities' AND COLUMN_NAME = 'title');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunities` ADD COLUMN `title` varchar(200) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunities.description
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunities' AND COLUMN_NAME = 'description');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunities` ADD COLUMN `description` text NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunities.primary_contact_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunities' AND COLUMN_NAME = 'primary_contact_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunities` ADD COLUMN `primary_contact_id` varchar(36) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunities.company_name
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunities' AND COLUMN_NAME = 'company_name');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunities` ADD COLUMN `company_name` varchar(255) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunities.owner_user_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunities' AND COLUMN_NAME = 'owner_user_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunities` ADD COLUMN `owner_user_id` varchar(36) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunities.created_by_user_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunities' AND COLUMN_NAME = 'created_by_user_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunities` ADD COLUMN `created_by_user_id` varchar(36) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunities.updated_by_user_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunities' AND COLUMN_NAME = 'updated_by_user_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunities` ADD COLUMN `updated_by_user_id` varchar(36) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunities.value
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunities' AND COLUMN_NAME = 'value');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunities` ADD COLUMN `value` decimal(15,2) NOT NULL DEFAULT \'0.00\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunities.currency
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunities' AND COLUMN_NAME = 'currency');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunities` ADD COLUMN `currency` char(3) NOT NULL DEFAULT \'BRL\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunities.probability_percent
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunities' AND COLUMN_NAME = 'probability_percent');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunities` ADD COLUMN `probability_percent` decimal(5,2) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunities.expected_close_date
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunities' AND COLUMN_NAME = 'expected_close_date');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunities` ADD COLUMN `expected_close_date` date NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunities.closed_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunities' AND COLUMN_NAME = 'closed_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunities` ADD COLUMN `closed_at` datetime NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunities.status
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunities' AND COLUMN_NAME = 'status');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunities` ADD COLUMN `status` enum(\'open\',\'won\',\'lost\',\'paused\',\'archived\') NOT NULL DEFAULT \'open\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunities.source
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunities' AND COLUMN_NAME = 'source');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunities` ADD COLUMN `source` varchar(100) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunities.temperature
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunities' AND COLUMN_NAME = 'temperature');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunities` ADD COLUMN `temperature` enum(\'cold\',\'warm\',\'hot\') NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunities.priority
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunities' AND COLUMN_NAME = 'priority');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunities` ADD COLUMN `priority` enum(\'low\',\'medium\',\'high\',\'urgent\') NOT NULL DEFAULT \'medium\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunities.lost_reason_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunities' AND COLUMN_NAME = 'lost_reason_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunities` ADD COLUMN `lost_reason_id` varchar(36) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunities.lost_reason_text
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunities' AND COLUMN_NAME = 'lost_reason_text');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunities` ADD COLUMN `lost_reason_text` text NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunities.kanban_order
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunities' AND COLUMN_NAME = 'kanban_order');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunities` ADD COLUMN `kanban_order` decimal(20,10) NOT NULL DEFAULT \'0.0000000000\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunities.last_activity_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunities' AND COLUMN_NAME = 'last_activity_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunities` ADD COLUMN `last_activity_at` datetime NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunities.next_activity_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunities' AND COLUMN_NAME = 'next_activity_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunities` ADD COLUMN `next_activity_at` datetime NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunities.created_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunities' AND COLUMN_NAME = 'created_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunities` ADD COLUMN `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunities.updated_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunities' AND COLUMN_NAME = 'updated_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunities` ADD COLUMN `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunities.deleted_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunities' AND COLUMN_NAME = 'deleted_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunities` ADD COLUMN `deleted_at` datetime NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunity_activities.id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunity_activities' AND COLUMN_NAME = 'id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunity_activities` ADD COLUMN `id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunity_activities.user_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunity_activities' AND COLUMN_NAME = 'user_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunity_activities` ADD COLUMN `user_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunity_activities.opportunity_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunity_activities' AND COLUMN_NAME = 'opportunity_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunity_activities` ADD COLUMN `opportunity_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunity_activities.contact_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunity_activities' AND COLUMN_NAME = 'contact_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunity_activities` ADD COLUMN `contact_id` varchar(36) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunity_activities.assigned_to_user_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunity_activities' AND COLUMN_NAME = 'assigned_to_user_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunity_activities` ADD COLUMN `assigned_to_user_id` varchar(36) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunity_activities.created_by_user_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunity_activities' AND COLUMN_NAME = 'created_by_user_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunity_activities` ADD COLUMN `created_by_user_id` varchar(36) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunity_activities.type
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunity_activities' AND COLUMN_NAME = 'type');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunity_activities` ADD COLUMN `type` enum(\'call\',\'email\',\'meeting\',\'task\',\'note\',\'whatsapp\',\'proposal\',\'follow_up\',\'other\') NOT NULL DEFAULT \'task\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunity_activities.title
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunity_activities' AND COLUMN_NAME = 'title');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunity_activities` ADD COLUMN `title` varchar(200) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunity_activities.description
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunity_activities' AND COLUMN_NAME = 'description');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunity_activities` ADD COLUMN `description` text NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunity_activities.status
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunity_activities' AND COLUMN_NAME = 'status');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunity_activities` ADD COLUMN `status` enum(\'pending\',\'done\',\'canceled\') NOT NULL DEFAULT \'pending\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunity_activities.due_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunity_activities' AND COLUMN_NAME = 'due_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunity_activities` ADD COLUMN `due_at` datetime NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunity_activities.completed_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunity_activities' AND COLUMN_NAME = 'completed_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunity_activities` ADD COLUMN `completed_at` datetime NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunity_activities.created_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunity_activities' AND COLUMN_NAME = 'created_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunity_activities` ADD COLUMN `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunity_activities.updated_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunity_activities' AND COLUMN_NAME = 'updated_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunity_activities` ADD COLUMN `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunity_activities.deleted_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunity_activities' AND COLUMN_NAME = 'deleted_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunity_activities` ADD COLUMN `deleted_at` datetime NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunity_audit_logs.id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunity_audit_logs' AND COLUMN_NAME = 'id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunity_audit_logs` ADD COLUMN `id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunity_audit_logs.tenant_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunity_audit_logs' AND COLUMN_NAME = 'tenant_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunity_audit_logs` ADD COLUMN `tenant_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunity_audit_logs.user_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunity_audit_logs' AND COLUMN_NAME = 'user_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunity_audit_logs` ADD COLUMN `user_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunity_audit_logs.opportunity_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunity_audit_logs' AND COLUMN_NAME = 'opportunity_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunity_audit_logs` ADD COLUMN `opportunity_id` varchar(36) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunity_audit_logs.user_id_actor
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunity_audit_logs' AND COLUMN_NAME = 'user_id_actor');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunity_audit_logs` ADD COLUMN `user_id_actor` varchar(36) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunity_audit_logs.action
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunity_audit_logs' AND COLUMN_NAME = 'action');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunity_audit_logs` ADD COLUMN `action` varchar(100) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunity_audit_logs.old_values
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunity_audit_logs' AND COLUMN_NAME = 'old_values');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunity_audit_logs` ADD COLUMN `old_values` json NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunity_audit_logs.new_values
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunity_audit_logs' AND COLUMN_NAME = 'new_values');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunity_audit_logs` ADD COLUMN `new_values` json NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunity_audit_logs.ip_address
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunity_audit_logs' AND COLUMN_NAME = 'ip_address');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunity_audit_logs` ADD COLUMN `ip_address` varchar(45) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunity_audit_logs.user_agent
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunity_audit_logs' AND COLUMN_NAME = 'user_agent');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunity_audit_logs` ADD COLUMN `user_agent` text NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunity_audit_logs.created_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunity_audit_logs' AND COLUMN_NAME = 'created_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunity_audit_logs` ADD COLUMN `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunity_contacts.id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunity_contacts' AND COLUMN_NAME = 'id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunity_contacts` ADD COLUMN `id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunity_contacts.tenant_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunity_contacts' AND COLUMN_NAME = 'tenant_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunity_contacts` ADD COLUMN `tenant_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunity_contacts.user_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunity_contacts' AND COLUMN_NAME = 'user_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunity_contacts` ADD COLUMN `user_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunity_contacts.opportunity_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunity_contacts' AND COLUMN_NAME = 'opportunity_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunity_contacts` ADD COLUMN `opportunity_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunity_contacts.contact_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunity_contacts' AND COLUMN_NAME = 'contact_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunity_contacts` ADD COLUMN `contact_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunity_contacts.role
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunity_contacts' AND COLUMN_NAME = 'role');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunity_contacts` ADD COLUMN `role` varchar(100) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunity_contacts.is_primary
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunity_contacts' AND COLUMN_NAME = 'is_primary');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunity_contacts` ADD COLUMN `is_primary` tinyint(1) NOT NULL DEFAULT \'0\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunity_contacts.notes
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunity_contacts' AND COLUMN_NAME = 'notes');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunity_contacts` ADD COLUMN `notes` text NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunity_contacts.created_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunity_contacts' AND COLUMN_NAME = 'created_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunity_contacts` ADD COLUMN `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunity_contacts.updated_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunity_contacts' AND COLUMN_NAME = 'updated_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunity_contacts` ADD COLUMN `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunity_lost_reasons.id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunity_lost_reasons' AND COLUMN_NAME = 'id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunity_lost_reasons` ADD COLUMN `id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunity_lost_reasons.tenant_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunity_lost_reasons' AND COLUMN_NAME = 'tenant_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunity_lost_reasons` ADD COLUMN `tenant_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunity_lost_reasons.user_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunity_lost_reasons' AND COLUMN_NAME = 'user_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunity_lost_reasons` ADD COLUMN `user_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunity_lost_reasons.name
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunity_lost_reasons' AND COLUMN_NAME = 'name');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunity_lost_reasons` ADD COLUMN `name` varchar(150) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunity_lost_reasons.description
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunity_lost_reasons' AND COLUMN_NAME = 'description');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunity_lost_reasons` ADD COLUMN `description` text NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunity_lost_reasons.is_active
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunity_lost_reasons' AND COLUMN_NAME = 'is_active');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunity_lost_reasons` ADD COLUMN `is_active` tinyint(1) NOT NULL DEFAULT \'1\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunity_lost_reasons.sort_order
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunity_lost_reasons' AND COLUMN_NAME = 'sort_order');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunity_lost_reasons` ADD COLUMN `sort_order` int NOT NULL DEFAULT \'0\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunity_lost_reasons.created_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunity_lost_reasons' AND COLUMN_NAME = 'created_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunity_lost_reasons` ADD COLUMN `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunity_lost_reasons.updated_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunity_lost_reasons' AND COLUMN_NAME = 'updated_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunity_lost_reasons` ADD COLUMN `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunity_notes.id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunity_notes' AND COLUMN_NAME = 'id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunity_notes` ADD COLUMN `id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunity_notes.user_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunity_notes' AND COLUMN_NAME = 'user_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunity_notes` ADD COLUMN `user_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunity_notes.opportunity_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunity_notes' AND COLUMN_NAME = 'opportunity_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunity_notes` ADD COLUMN `opportunity_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunity_notes.user_id_creator
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunity_notes' AND COLUMN_NAME = 'user_id_creator');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunity_notes` ADD COLUMN `user_id_creator` varchar(36) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunity_notes.body
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunity_notes' AND COLUMN_NAME = 'body');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunity_notes` ADD COLUMN `body` text NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunity_notes.is_pinned
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunity_notes' AND COLUMN_NAME = 'is_pinned');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunity_notes` ADD COLUMN `is_pinned` tinyint(1) NOT NULL DEFAULT \'0\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunity_notes.created_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunity_notes' AND COLUMN_NAME = 'created_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunity_notes` ADD COLUMN `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunity_notes.updated_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunity_notes' AND COLUMN_NAME = 'updated_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunity_notes` ADD COLUMN `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunity_notes.deleted_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunity_notes' AND COLUMN_NAME = 'deleted_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunity_notes` ADD COLUMN `deleted_at` datetime NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunity_stage_history.id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunity_stage_history' AND COLUMN_NAME = 'id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunity_stage_history` ADD COLUMN `id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunity_stage_history.tenant_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunity_stage_history' AND COLUMN_NAME = 'tenant_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunity_stage_history` ADD COLUMN `tenant_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunity_stage_history.user_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunity_stage_history' AND COLUMN_NAME = 'user_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunity_stage_history` ADD COLUMN `user_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunity_stage_history.opportunity_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunity_stage_history' AND COLUMN_NAME = 'opportunity_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunity_stage_history` ADD COLUMN `opportunity_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunity_stage_history.funnel_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunity_stage_history' AND COLUMN_NAME = 'funnel_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunity_stage_history` ADD COLUMN `funnel_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunity_stage_history.from_stage_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunity_stage_history' AND COLUMN_NAME = 'from_stage_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunity_stage_history` ADD COLUMN `from_stage_id` varchar(36) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunity_stage_history.to_stage_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunity_stage_history' AND COLUMN_NAME = 'to_stage_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunity_stage_history` ADD COLUMN `to_stage_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunity_stage_history.moved_by_user_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunity_stage_history' AND COLUMN_NAME = 'moved_by_user_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunity_stage_history` ADD COLUMN `moved_by_user_id` varchar(36) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunity_stage_history.moved_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunity_stage_history' AND COLUMN_NAME = 'moved_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunity_stage_history` ADD COLUMN `moved_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunity_stage_history.reason
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunity_stage_history' AND COLUMN_NAME = 'reason');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunity_stage_history` ADD COLUMN `reason` text NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunity_stage_history.old_status
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunity_stage_history' AND COLUMN_NAME = 'old_status');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunity_stage_history` ADD COLUMN `old_status` varchar(50) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunity_stage_history.new_status
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunity_stage_history' AND COLUMN_NAME = 'new_status');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunity_stage_history` ADD COLUMN `new_status` varchar(50) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunity_tags.opportunity_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunity_tags' AND COLUMN_NAME = 'opportunity_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunity_tags` ADD COLUMN `opportunity_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunity_tags.tag_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunity_tags' AND COLUMN_NAME = 'tag_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunity_tags` ADD COLUMN `tag_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opportunity_tags.user_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunity_tags' AND COLUMN_NAME = 'user_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `opportunity_tags` ADD COLUMN `user_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- outgoing_webhook_logs.id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'outgoing_webhook_logs' AND COLUMN_NAME = 'id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `outgoing_webhook_logs` ADD COLUMN `id` bigint unsigned AUTO_INCREMENT NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- outgoing_webhook_logs.outgoing_webhook_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'outgoing_webhook_logs' AND COLUMN_NAME = 'outgoing_webhook_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `outgoing_webhook_logs` ADD COLUMN `outgoing_webhook_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- outgoing_webhook_logs.event_type
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'outgoing_webhook_logs' AND COLUMN_NAME = 'event_type');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `outgoing_webhook_logs` ADD COLUMN `event_type` varchar(100) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- outgoing_webhook_logs.payload_sent
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'outgoing_webhook_logs' AND COLUMN_NAME = 'payload_sent');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `outgoing_webhook_logs` ADD COLUMN `payload_sent` json NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- outgoing_webhook_logs.response_status
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'outgoing_webhook_logs' AND COLUMN_NAME = 'response_status');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `outgoing_webhook_logs` ADD COLUMN `response_status` int NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- outgoing_webhook_logs.response_body
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'outgoing_webhook_logs' AND COLUMN_NAME = 'response_body');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `outgoing_webhook_logs` ADD COLUMN `response_body` text NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- outgoing_webhook_logs.attempt_number
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'outgoing_webhook_logs' AND COLUMN_NAME = 'attempt_number');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `outgoing_webhook_logs` ADD COLUMN `attempt_number` int NOT NULL DEFAULT \'1\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- outgoing_webhook_logs.success
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'outgoing_webhook_logs' AND COLUMN_NAME = 'success');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `outgoing_webhook_logs` ADD COLUMN `success` tinyint(1) NOT NULL DEFAULT \'0\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- outgoing_webhook_logs.created_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'outgoing_webhook_logs' AND COLUMN_NAME = 'created_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `outgoing_webhook_logs` ADD COLUMN `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- outgoing_webhooks.id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'outgoing_webhooks' AND COLUMN_NAME = 'id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `outgoing_webhooks` ADD COLUMN `id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- outgoing_webhooks.tenant_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'outgoing_webhooks' AND COLUMN_NAME = 'tenant_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `outgoing_webhooks` ADD COLUMN `tenant_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- outgoing_webhooks.url
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'outgoing_webhooks' AND COLUMN_NAME = 'url');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `outgoing_webhooks` ADD COLUMN `url` varchar(500) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- outgoing_webhooks.event_type
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'outgoing_webhooks' AND COLUMN_NAME = 'event_type');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `outgoing_webhooks` ADD COLUMN `event_type` varchar(100) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- outgoing_webhooks.status
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'outgoing_webhooks' AND COLUMN_NAME = 'status');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `outgoing_webhooks` ADD COLUMN `status` enum(\'active\',\'paused\') NOT NULL DEFAULT \'active\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- outgoing_webhooks.retry_count
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'outgoing_webhooks' AND COLUMN_NAME = 'retry_count');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `outgoing_webhooks` ADD COLUMN `retry_count` int NOT NULL DEFAULT \'3\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- outgoing_webhooks.created_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'outgoing_webhooks' AND COLUMN_NAME = 'created_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `outgoing_webhooks` ADD COLUMN `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- outgoing_webhooks.updated_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'outgoing_webhooks' AND COLUMN_NAME = 'updated_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `outgoing_webhooks` ADD COLUMN `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- payment_gateway_settings.environment
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'payment_gateway_settings' AND COLUMN_NAME = 'environment');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `payment_gateway_settings` ADD COLUMN `environment` enum(\'sandbox\',\'production\') NOT NULL DEFAULT \'sandbox\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- payment_gateway_settings.checkout_mode
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'payment_gateway_settings' AND COLUMN_NAME = 'checkout_mode');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `payment_gateway_settings` ADD COLUMN `checkout_mode` enum(\'transparent\',\'redirect\') NOT NULL DEFAULT \'redirect\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- payment_gateway_settings.sandbox_access_token
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'payment_gateway_settings' AND COLUMN_NAME = 'sandbox_access_token');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `payment_gateway_settings` ADD COLUMN `sandbox_access_token` text NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- payment_gateway_settings.sandbox_public_key
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'payment_gateway_settings' AND COLUMN_NAME = 'sandbox_public_key');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `payment_gateway_settings` ADD COLUMN `sandbox_public_key` text NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- payment_gateway_settings.sandbox_client_secret
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'payment_gateway_settings' AND COLUMN_NAME = 'sandbox_client_secret');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `payment_gateway_settings` ADD COLUMN `sandbox_client_secret` text NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- payment_gateway_settings.production_access_token
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'payment_gateway_settings' AND COLUMN_NAME = 'production_access_token');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `payment_gateway_settings` ADD COLUMN `production_access_token` text NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- payment_gateway_settings.production_public_key
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'payment_gateway_settings' AND COLUMN_NAME = 'production_public_key');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `payment_gateway_settings` ADD COLUMN `production_public_key` text NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- payment_gateway_settings.production_client_secret
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'payment_gateway_settings' AND COLUMN_NAME = 'production_client_secret');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `payment_gateway_settings` ADD COLUMN `production_client_secret` text NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- payment_gateway_settings.webhook_secret
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'payment_gateway_settings' AND COLUMN_NAME = 'webhook_secret');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `payment_gateway_settings` ADD COLUMN `webhook_secret` text NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- payment_gateway_settings.created_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'payment_gateway_settings' AND COLUMN_NAME = 'created_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `payment_gateway_settings` ADD COLUMN `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- payment_gateway_settings.updated_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'payment_gateway_settings' AND COLUMN_NAME = 'updated_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `payment_gateway_settings` ADD COLUMN `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- platform_banners.id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'platform_banners' AND COLUMN_NAME = 'id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `platform_banners` ADD COLUMN `id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- platform_banners.title
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'platform_banners' AND COLUMN_NAME = 'title');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `platform_banners` ADD COLUMN `title` varchar(255) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- platform_banners.subtitle
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'platform_banners' AND COLUMN_NAME = 'subtitle');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `platform_banners` ADD COLUMN `subtitle` text NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- platform_banners.cta_label
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'platform_banners' AND COLUMN_NAME = 'cta_label');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `platform_banners` ADD COLUMN `cta_label` varchar(100) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- platform_banners.cta_url
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'platform_banners' AND COLUMN_NAME = 'cta_url');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `platform_banners` ADD COLUMN `cta_url` varchar(500) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- platform_banners.image_path
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'platform_banners' AND COLUMN_NAME = 'image_path');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `platform_banners` ADD COLUMN `image_path` varchar(500) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- platform_banners.is_active
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'platform_banners' AND COLUMN_NAME = 'is_active');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `platform_banners` ADD COLUMN `is_active` tinyint(1) NOT NULL DEFAULT \'1\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- platform_banners.display_order
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'platform_banners' AND COLUMN_NAME = 'display_order');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `platform_banners` ADD COLUMN `display_order` int NOT NULL DEFAULT \'0\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- platform_banners.created_by
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'platform_banners' AND COLUMN_NAME = 'created_by');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `platform_banners` ADD COLUMN `created_by` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- platform_banners.created_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'platform_banners' AND COLUMN_NAME = 'created_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `platform_banners` ADD COLUMN `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- platform_banners.updated_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'platform_banners' AND COLUMN_NAME = 'updated_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `platform_banners` ADD COLUMN `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- platform_settings.id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'platform_settings' AND COLUMN_NAME = 'id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `platform_settings` ADD COLUMN `id` int NOT NULL DEFAULT \'1\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- platform_settings.meta_app_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'platform_settings' AND COLUMN_NAME = 'meta_app_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `platform_settings` ADD COLUMN `meta_app_id` varchar(255) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- platform_settings.meta_app_secret
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'platform_settings' AND COLUMN_NAME = 'meta_app_secret');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `platform_settings` ADD COLUMN `meta_app_secret` text NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- platform_settings.meta_config_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'platform_settings' AND COLUMN_NAME = 'meta_config_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `platform_settings` ADD COLUMN `meta_config_id` varchar(255) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- platform_settings.meta_graph_version
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'platform_settings' AND COLUMN_NAME = 'meta_graph_version');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `platform_settings` ADD COLUMN `meta_graph_version` varchar(50) NOT NULL DEFAULT \'v20.0\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- platform_settings.cron_secret
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'platform_settings' AND COLUMN_NAME = 'cron_secret');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `platform_settings` ADD COLUMN `cron_secret` text NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- platform_settings.head_tags
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'platform_settings' AND COLUMN_NAME = 'head_tags');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `platform_settings` ADD COLUMN `head_tags` text NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- platform_settings.body_tags
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'platform_settings' AND COLUMN_NAME = 'body_tags');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `platform_settings` ADD COLUMN `body_tags` text NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- platform_settings.updated_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'platform_settings' AND COLUMN_NAME = 'updated_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `platform_settings` ADD COLUMN `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- platform_settings.updated_by
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'platform_settings' AND COLUMN_NAME = 'updated_by');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `platform_settings` ADD COLUMN `updated_by` varchar(36) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- platform_settings.sidebar_order
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'platform_settings' AND COLUMN_NAME = 'sidebar_order');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `platform_settings` ADD COLUMN `sidebar_order` text NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- platform_settings.seo_title
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'platform_settings' AND COLUMN_NAME = 'seo_title');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `platform_settings` ADD COLUMN `seo_title` varchar(128) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- platform_settings.seo_description
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'platform_settings' AND COLUMN_NAME = 'seo_description');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `platform_settings` ADD COLUMN `seo_description` varchar(320) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- platform_settings.license_key
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'platform_settings' AND COLUMN_NAME = 'license_key');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `platform_settings` ADD COLUMN `license_key` varchar(255) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- platform_settings.license_token
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'platform_settings' AND COLUMN_NAME = 'license_token');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `platform_settings` ADD COLUMN `license_token` text NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- platform_settings.installation_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'platform_settings' AND COLUMN_NAME = 'installation_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `platform_settings` ADD COLUMN `installation_id` varchar(255) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- platform_settings.license_grace_period_start
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'platform_settings' AND COLUMN_NAME = 'license_grace_period_start');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `platform_settings` ADD COLUMN `license_grace_period_start` datetime NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- profiles.id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'profiles' AND COLUMN_NAME = 'id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `profiles` ADD COLUMN `id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- profiles.email
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'profiles' AND COLUMN_NAME = 'email');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `profiles` ADD COLUMN `email` varchar(255) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- profiles.full_name
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'profiles' AND COLUMN_NAME = 'full_name');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `profiles` ADD COLUMN `full_name` varchar(255) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- profiles.avatar_url
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'profiles' AND COLUMN_NAME = 'avatar_url');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `profiles` ADD COLUMN `avatar_url` text NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- profiles.display_name
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'profiles' AND COLUMN_NAME = 'display_name');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `profiles` ADD COLUMN `display_name` varchar(255) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- profiles.phone
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'profiles' AND COLUMN_NAME = 'phone');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `profiles` ADD COLUMN `phone` varchar(50) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- profiles.company_name
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'profiles' AND COLUMN_NAME = 'company_name');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `profiles` ADD COLUMN `company_name` varchar(255) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- profiles.company_document
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'profiles' AND COLUMN_NAME = 'company_document');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `profiles` ADD COLUMN `company_document` varchar(100) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- profiles.company_address
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'profiles' AND COLUMN_NAME = 'company_address');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `profiles` ADD COLUMN `company_address` text NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- profiles.company_website
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'profiles' AND COLUMN_NAME = 'company_website');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `profiles` ADD COLUMN `company_website` varchar(255) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- profiles.rate_limit_per_second
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'profiles' AND COLUMN_NAME = 'rate_limit_per_second');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `profiles` ADD COLUMN `rate_limit_per_second` int NOT NULL DEFAULT \'10\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- profiles.whatsapp_verify_token
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'profiles' AND COLUMN_NAME = 'whatsapp_verify_token');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `profiles` ADD COLUMN `whatsapp_verify_token` varchar(255) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- profiles.whatsapp_access_token
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'profiles' AND COLUMN_NAME = 'whatsapp_access_token');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `profiles` ADD COLUMN `whatsapp_access_token` text NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- profiles.whatsapp_phone_number_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'profiles' AND COLUMN_NAME = 'whatsapp_phone_number_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `profiles` ADD COLUMN `whatsapp_phone_number_id` varchar(100) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- profiles.whatsapp_waba_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'profiles' AND COLUMN_NAME = 'whatsapp_waba_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `profiles` ADD COLUMN `whatsapp_waba_id` varchar(100) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- profiles.whatsapp_business_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'profiles' AND COLUMN_NAME = 'whatsapp_business_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `profiles` ADD COLUMN `whatsapp_business_id` varchar(100) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- profiles.whatsapp_business_phone
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'profiles' AND COLUMN_NAME = 'whatsapp_business_phone');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `profiles` ADD COLUMN `whatsapp_business_phone` varchar(50) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- profiles.whatsapp_app_secret
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'profiles' AND COLUMN_NAME = 'whatsapp_app_secret');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `profiles` ADD COLUMN `whatsapp_app_secret` text NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- profiles.meta_graph_version
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'profiles' AND COLUMN_NAME = 'meta_graph_version');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `profiles` ADD COLUMN `meta_graph_version` varchar(50) NOT NULL DEFAULT \'v20.0\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- profiles.salvy_api_key
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'profiles' AND COLUMN_NAME = 'salvy_api_key');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `profiles` ADD COLUMN `salvy_api_key` text NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- profiles.created_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'profiles' AND COLUMN_NAME = 'created_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `profiles` ADD COLUMN `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- profiles.updated_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'profiles' AND COLUMN_NAME = 'updated_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `profiles` ADD COLUMN `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- profiles.api_key
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'profiles' AND COLUMN_NAME = 'api_key');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `profiles` ADD COLUMN `api_key` varchar(255) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- profiles.whatsapp_app_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'profiles' AND COLUMN_NAME = 'whatsapp_app_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `profiles` ADD COLUMN `whatsapp_app_id` varchar(100) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- sales_funnels.id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'sales_funnels' AND COLUMN_NAME = 'id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `sales_funnels` ADD COLUMN `id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- sales_funnels.tenant_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'sales_funnels' AND COLUMN_NAME = 'tenant_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `sales_funnels` ADD COLUMN `tenant_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- sales_funnels.user_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'sales_funnels' AND COLUMN_NAME = 'user_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `sales_funnels` ADD COLUMN `user_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- sales_funnels.name
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'sales_funnels' AND COLUMN_NAME = 'name');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `sales_funnels` ADD COLUMN `name` varchar(150) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- sales_funnels.slug
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'sales_funnels' AND COLUMN_NAME = 'slug');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `sales_funnels` ADD COLUMN `slug` varchar(180) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- sales_funnels.description
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'sales_funnels' AND COLUMN_NAME = 'description');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `sales_funnels` ADD COLUMN `description` text NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- sales_funnels.is_default
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'sales_funnels' AND COLUMN_NAME = 'is_default');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `sales_funnels` ADD COLUMN `is_default` tinyint(1) NOT NULL DEFAULT \'0\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- sales_funnels.is_active
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'sales_funnels' AND COLUMN_NAME = 'is_active');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `sales_funnels` ADD COLUMN `is_active` tinyint(1) NOT NULL DEFAULT \'1\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- sales_funnels.sort_order
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'sales_funnels' AND COLUMN_NAME = 'sort_order');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `sales_funnels` ADD COLUMN `sort_order` int NOT NULL DEFAULT \'0\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- sales_funnels.created_by_user_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'sales_funnels' AND COLUMN_NAME = 'created_by_user_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `sales_funnels` ADD COLUMN `created_by_user_id` varchar(36) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- sales_funnels.updated_by_user_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'sales_funnels' AND COLUMN_NAME = 'updated_by_user_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `sales_funnels` ADD COLUMN `updated_by_user_id` varchar(36) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- sales_funnels.created_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'sales_funnels' AND COLUMN_NAME = 'created_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `sales_funnels` ADD COLUMN `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- sales_funnels.updated_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'sales_funnels' AND COLUMN_NAME = 'updated_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `sales_funnels` ADD COLUMN `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- sales_funnels.deleted_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'sales_funnels' AND COLUMN_NAME = 'deleted_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `sales_funnels` ADD COLUMN `deleted_at` datetime NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- sales_stages.id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'sales_stages' AND COLUMN_NAME = 'id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `sales_stages` ADD COLUMN `id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- sales_stages.tenant_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'sales_stages' AND COLUMN_NAME = 'tenant_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `sales_stages` ADD COLUMN `tenant_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- sales_stages.user_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'sales_stages' AND COLUMN_NAME = 'user_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `sales_stages` ADD COLUMN `user_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- sales_stages.funnel_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'sales_stages' AND COLUMN_NAME = 'funnel_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `sales_stages` ADD COLUMN `funnel_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- sales_stages.name
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'sales_stages' AND COLUMN_NAME = 'name');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `sales_stages` ADD COLUMN `name` varchar(150) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- sales_stages.slug
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'sales_stages' AND COLUMN_NAME = 'slug');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `sales_stages` ADD COLUMN `slug` varchar(180) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- sales_stages.description
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'sales_stages' AND COLUMN_NAME = 'description');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `sales_stages` ADD COLUMN `description` text NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- sales_stages.color
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'sales_stages' AND COLUMN_NAME = 'color');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `sales_stages` ADD COLUMN `color` varchar(30) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- sales_stages.probability_percent
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'sales_stages' AND COLUMN_NAME = 'probability_percent');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `sales_stages` ADD COLUMN `probability_percent` decimal(5,2) NOT NULL DEFAULT \'0.00\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- sales_stages.sort_order
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'sales_stages' AND COLUMN_NAME = 'sort_order');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `sales_stages` ADD COLUMN `sort_order` int NOT NULL DEFAULT \'0\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- sales_stages.is_won_stage
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'sales_stages' AND COLUMN_NAME = 'is_won_stage');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `sales_stages` ADD COLUMN `is_won_stage` tinyint(1) NOT NULL DEFAULT \'0\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- sales_stages.is_lost_stage
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'sales_stages' AND COLUMN_NAME = 'is_lost_stage');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `sales_stages` ADD COLUMN `is_lost_stage` tinyint(1) NOT NULL DEFAULT \'0\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- sales_stages.is_active
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'sales_stages' AND COLUMN_NAME = 'is_active');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `sales_stages` ADD COLUMN `is_active` tinyint(1) NOT NULL DEFAULT \'1\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- sales_stages.created_by_user_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'sales_stages' AND COLUMN_NAME = 'created_by_user_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `sales_stages` ADD COLUMN `created_by_user_id` varchar(36) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- sales_stages.updated_by_user_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'sales_stages' AND COLUMN_NAME = 'updated_by_user_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `sales_stages` ADD COLUMN `updated_by_user_id` varchar(36) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- sales_stages.created_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'sales_stages' AND COLUMN_NAME = 'created_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `sales_stages` ADD COLUMN `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- sales_stages.updated_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'sales_stages' AND COLUMN_NAME = 'updated_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `sales_stages` ADD COLUMN `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- sales_stages.deleted_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'sales_stages' AND COLUMN_NAME = 'deleted_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `sales_stages` ADD COLUMN `deleted_at` datetime NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- salvy_numbers.id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'salvy_numbers' AND COLUMN_NAME = 'id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `salvy_numbers` ADD COLUMN `id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- salvy_numbers.user_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'salvy_numbers' AND COLUMN_NAME = 'user_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `salvy_numbers` ADD COLUMN `user_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- salvy_numbers.salvy_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'salvy_numbers' AND COLUMN_NAME = 'salvy_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `salvy_numbers` ADD COLUMN `salvy_id` varchar(100) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- salvy_numbers.phone_number
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'salvy_numbers' AND COLUMN_NAME = 'phone_number');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `salvy_numbers` ADD COLUMN `phone_number` varchar(50) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- salvy_numbers.area_code
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'salvy_numbers' AND COLUMN_NAME = 'area_code');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `salvy_numbers` ADD COLUMN `area_code` int NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- salvy_numbers.name
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'salvy_numbers' AND COLUMN_NAME = 'name');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `salvy_numbers` ADD COLUMN `name` varchar(255) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- salvy_numbers.status
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'salvy_numbers' AND COLUMN_NAME = 'status');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `salvy_numbers` ADD COLUMN `status` varchar(50) NOT NULL DEFAULT \'pending\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- salvy_numbers.cost_center
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'salvy_numbers' AND COLUMN_NAME = 'cost_center');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `salvy_numbers` ADD COLUMN `cost_center` varchar(255) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- salvy_numbers.cancel_reason
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'salvy_numbers' AND COLUMN_NAME = 'cancel_reason');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `salvy_numbers` ADD COLUMN `cancel_reason` text NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- salvy_numbers.created_at_remote
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'salvy_numbers' AND COLUMN_NAME = 'created_at_remote');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `salvy_numbers` ADD COLUMN `created_at_remote` datetime NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- salvy_numbers.canceled_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'salvy_numbers' AND COLUMN_NAME = 'canceled_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `salvy_numbers` ADD COLUMN `canceled_at` datetime NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- salvy_numbers.raw
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'salvy_numbers' AND COLUMN_NAME = 'raw');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `salvy_numbers` ADD COLUMN `raw` json NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- salvy_numbers.created_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'salvy_numbers' AND COLUMN_NAME = 'created_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `salvy_numbers` ADD COLUMN `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- salvy_numbers.updated_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'salvy_numbers' AND COLUMN_NAME = 'updated_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `salvy_numbers` ADD COLUMN `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- schema_backups.id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'schema_backups' AND COLUMN_NAME = 'id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `schema_backups` ADD COLUMN `id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- schema_backups.created_by
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'schema_backups' AND COLUMN_NAME = 'created_by');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `schema_backups` ADD COLUMN `created_by` varchar(36) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- schema_backups.source
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'schema_backups' AND COLUMN_NAME = 'source');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `schema_backups` ADD COLUMN `source` varchar(255) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- schema_backups.size_bytes
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'schema_backups' AND COLUMN_NAME = 'size_bytes');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `schema_backups` ADD COLUMN `size_bytes` int NOT NULL DEFAULT \'0\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- schema_backups.created_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'schema_backups' AND COLUMN_NAME = 'created_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `schema_backups` ADD COLUMN `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- subscription_events.id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'subscription_events' AND COLUMN_NAME = 'id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `subscription_events` ADD COLUMN `id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- subscription_events.tenant_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'subscription_events' AND COLUMN_NAME = 'tenant_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `subscription_events` ADD COLUMN `tenant_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- subscription_events.subscription_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'subscription_events' AND COLUMN_NAME = 'subscription_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `subscription_events` ADD COLUMN `subscription_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- subscription_events.event_type
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'subscription_events' AND COLUMN_NAME = 'event_type');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `subscription_events` ADD COLUMN `event_type` varchar(100) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- subscription_events.previous_status
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'subscription_events' AND COLUMN_NAME = 'previous_status');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `subscription_events` ADD COLUMN `previous_status` varchar(50) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- subscription_events.new_status
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'subscription_events' AND COLUMN_NAME = 'new_status');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `subscription_events` ADD COLUMN `new_status` varchar(50) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- subscription_events.invoice_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'subscription_events' AND COLUMN_NAME = 'invoice_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `subscription_events` ADD COLUMN `invoice_id` varchar(36) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- subscription_events.payment_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'subscription_events' AND COLUMN_NAME = 'payment_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `subscription_events` ADD COLUMN `payment_id` varchar(36) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- subscription_events.metadata
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'subscription_events' AND COLUMN_NAME = 'metadata');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `subscription_events` ADD COLUMN `metadata` json NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- subscription_events.created_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'subscription_events' AND COLUMN_NAME = 'created_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `subscription_events` ADD COLUMN `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- subscription_events.created_by
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'subscription_events' AND COLUMN_NAME = 'created_by');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `subscription_events` ADD COLUMN `created_by` varchar(36) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- subscription_plan_changes.id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'subscription_plan_changes' AND COLUMN_NAME = 'id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `subscription_plan_changes` ADD COLUMN `id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- subscription_plan_changes.tenant_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'subscription_plan_changes' AND COLUMN_NAME = 'tenant_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `subscription_plan_changes` ADD COLUMN `tenant_id` varchar(255) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- subscription_plan_changes.subscription_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'subscription_plan_changes' AND COLUMN_NAME = 'subscription_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `subscription_plan_changes` ADD COLUMN `subscription_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- subscription_plan_changes.old_plan
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'subscription_plan_changes' AND COLUMN_NAME = 'old_plan');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `subscription_plan_changes` ADD COLUMN `old_plan` varchar(64) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- subscription_plan_changes.new_plan
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'subscription_plan_changes' AND COLUMN_NAME = 'new_plan');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `subscription_plan_changes` ADD COLUMN `new_plan` varchar(64) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- subscription_plan_changes.effective_date
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'subscription_plan_changes' AND COLUMN_NAME = 'effective_date');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `subscription_plan_changes` ADD COLUMN `effective_date` datetime NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- subscription_plan_changes.applied_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'subscription_plan_changes' AND COLUMN_NAME = 'applied_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `subscription_plan_changes` ADD COLUMN `applied_at` datetime NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- subscription_plan_changes.created_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'subscription_plan_changes' AND COLUMN_NAME = 'created_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `subscription_plan_changes` ADD COLUMN `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- subscription_plans.id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'subscription_plans' AND COLUMN_NAME = 'id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `subscription_plans` ADD COLUMN `id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- subscription_plans.name
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'subscription_plans' AND COLUMN_NAME = 'name');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `subscription_plans` ADD COLUMN `name` varchar(100) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- subscription_plans.slug
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'subscription_plans' AND COLUMN_NAME = 'slug');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `subscription_plans` ADD COLUMN `slug` varchar(80) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- subscription_plans.description
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'subscription_plans' AND COLUMN_NAME = 'description');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `subscription_plans` ADD COLUMN `description` text NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- subscription_plans.max_agents
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'subscription_plans' AND COLUMN_NAME = 'max_agents');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `subscription_plans` ADD COLUMN `max_agents` int NULL DEFAULT \'1\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- subscription_plans.max_funnels
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'subscription_plans' AND COLUMN_NAME = 'max_funnels');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `subscription_plans` ADD COLUMN `max_funnels` int NULL DEFAULT \'1\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- subscription_plans.max_users
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'subscription_plans' AND COLUMN_NAME = 'max_users');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `subscription_plans` ADD COLUMN `max_users` int NULL DEFAULT \'1\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- subscription_plans.features_json
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'subscription_plans' AND COLUMN_NAME = 'features_json');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `subscription_plans` ADD COLUMN `features_json` json NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- subscription_plans.is_active
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'subscription_plans' AND COLUMN_NAME = 'is_active');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `subscription_plans` ADD COLUMN `is_active` tinyint(1) NULL DEFAULT \'1\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- subscription_plans.created_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'subscription_plans' AND COLUMN_NAME = 'created_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `subscription_plans` ADD COLUMN `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- subscription_plans.updated_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'subscription_plans' AND COLUMN_NAME = 'updated_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `subscription_plans` ADD COLUMN `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- subscriptions.id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'subscriptions' AND COLUMN_NAME = 'id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `subscriptions` ADD COLUMN `id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- subscriptions.tenant_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'subscriptions' AND COLUMN_NAME = 'tenant_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `subscriptions` ADD COLUMN `tenant_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- subscriptions.customer_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'subscriptions' AND COLUMN_NAME = 'customer_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `subscriptions` ADD COLUMN `customer_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- subscriptions.plan_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'subscriptions' AND COLUMN_NAME = 'plan_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `subscriptions` ADD COLUMN `plan_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- subscriptions.status
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'subscriptions' AND COLUMN_NAME = 'status');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `subscriptions` ADD COLUMN `status` enum(\'trial\',\'active\',\'expiring\',\'pending_payment\',\'past_due\',\'suspended\',\'cancelled\') NOT NULL DEFAULT \'trial\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- subscriptions.starts_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'subscriptions' AND COLUMN_NAME = 'starts_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `subscriptions` ADD COLUMN `starts_at` datetime NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- subscriptions.expires_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'subscriptions' AND COLUMN_NAME = 'expires_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `subscriptions` ADD COLUMN `expires_at` datetime NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- subscriptions.grace_period_ends_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'subscriptions' AND COLUMN_NAME = 'grace_period_ends_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `subscriptions` ADD COLUMN `grace_period_ends_at` datetime NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- subscriptions.last_payment_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'subscriptions' AND COLUMN_NAME = 'last_payment_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `subscriptions` ADD COLUMN `last_payment_at` datetime NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- subscriptions.next_billing_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'subscriptions' AND COLUMN_NAME = 'next_billing_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `subscriptions` ADD COLUMN `next_billing_at` datetime NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- subscriptions.auto_renew
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'subscriptions' AND COLUMN_NAME = 'auto_renew');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `subscriptions` ADD COLUMN `auto_renew` tinyint(1) NOT NULL DEFAULT \'0\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- subscriptions.created_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'subscriptions' AND COLUMN_NAME = 'created_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `subscriptions` ADD COLUMN `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- subscriptions.updated_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'subscriptions' AND COLUMN_NAME = 'updated_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `subscriptions` ADD COLUMN `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- tags.id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'tags' AND COLUMN_NAME = 'id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `tags` ADD COLUMN `id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- tags.tenant_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'tags' AND COLUMN_NAME = 'tenant_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `tags` ADD COLUMN `tenant_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- tags.user_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'tags' AND COLUMN_NAME = 'user_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `tags` ADD COLUMN `user_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- tags.name
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'tags' AND COLUMN_NAME = 'name');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `tags` ADD COLUMN `name` varchar(255) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- tags.color
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'tags' AND COLUMN_NAME = 'color');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `tags` ADD COLUMN `color` varchar(50) NOT NULL DEFAULT \'#8B5CF6\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- tags.created_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'tags' AND COLUMN_NAME = 'created_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `tags` ADD COLUMN `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- tags.icon
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'tags' AND COLUMN_NAME = 'icon');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `tags` ADD COLUMN `icon` varchar(50) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- team_members.id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'team_members' AND COLUMN_NAME = 'id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `team_members` ADD COLUMN `id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- team_members.team_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'team_members' AND COLUMN_NAME = 'team_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `team_members` ADD COLUMN `team_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- team_members.user_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'team_members' AND COLUMN_NAME = 'user_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `team_members` ADD COLUMN `user_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- team_members.role
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'team_members' AND COLUMN_NAME = 'role');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `team_members` ADD COLUMN `role` enum(\'agent\',\'supervisor\') NOT NULL DEFAULT \'agent\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- team_members.joined_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'team_members' AND COLUMN_NAME = 'joined_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `team_members` ADD COLUMN `joined_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- teams.id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'teams' AND COLUMN_NAME = 'id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `teams` ADD COLUMN `id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- teams.tenant_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'teams' AND COLUMN_NAME = 'tenant_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `teams` ADD COLUMN `tenant_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- teams.user_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'teams' AND COLUMN_NAME = 'user_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `teams` ADD COLUMN `user_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- teams.name
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'teams' AND COLUMN_NAME = 'name');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `teams` ADD COLUMN `name` varchar(255) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- teams.description
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'teams' AND COLUMN_NAME = 'description');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `teams` ADD COLUMN `description` text NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- teams.auto_assign_mode
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'teams' AND COLUMN_NAME = 'auto_assign_mode');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `teams` ADD COLUMN `auto_assign_mode` enum(\'manual\',\'round_robin\',\'least_busy\') NOT NULL DEFAULT \'manual\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- teams.created_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'teams' AND COLUMN_NAME = 'created_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `teams` ADD COLUMN `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- templates.id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'templates' AND COLUMN_NAME = 'id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `templates` ADD COLUMN `id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- templates.tenant_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'templates' AND COLUMN_NAME = 'tenant_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `templates` ADD COLUMN `tenant_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- templates.user_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'templates' AND COLUMN_NAME = 'user_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `templates` ADD COLUMN `user_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- templates.name
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'templates' AND COLUMN_NAME = 'name');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `templates` ADD COLUMN `name` varchar(255) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- templates.language
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'templates' AND COLUMN_NAME = 'language');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `templates` ADD COLUMN `language` varchar(50) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- templates.category
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'templates' AND COLUMN_NAME = 'category');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `templates` ADD COLUMN `category` varchar(50) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- templates.status
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'templates' AND COLUMN_NAME = 'status');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `templates` ADD COLUMN `status` enum(\'APPROVED\',\'PENDING\',\'REJECTED\',\'PAUSED\',\'DISABLED\') NOT NULL DEFAULT \'PENDING\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- templates.components
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'templates' AND COLUMN_NAME = 'components');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `templates` ADD COLUMN `components` json NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- templates.meta_template_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'templates' AND COLUMN_NAME = 'meta_template_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `templates` ADD COLUMN `meta_template_id` varchar(255) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- templates.synced_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'templates' AND COLUMN_NAME = 'synced_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `templates` ADD COLUMN `synced_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- templates.parameter_format
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'templates' AND COLUMN_NAME = 'parameter_format');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `templates` ADD COLUMN `parameter_format` varchar(50) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- templates.allow_category_change
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'templates' AND COLUMN_NAME = 'allow_category_change');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `templates` ADD COLUMN `allow_category_change` tinyint(1) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- templates.cta_url_link_tracking_opted_out
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'templates' AND COLUMN_NAME = 'cta_url_link_tracking_opted_out');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `templates` ADD COLUMN `cta_url_link_tracking_opted_out` tinyint(1) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- templates.message_send_ttl_seconds
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'templates' AND COLUMN_NAME = 'message_send_ttl_seconds');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `templates` ADD COLUMN `message_send_ttl_seconds` int NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- templates.sub_category
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'templates' AND COLUMN_NAME = 'sub_category');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `templates` ADD COLUMN `sub_category` varchar(100) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- templates.is_primary_device_delivery_only
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'templates' AND COLUMN_NAME = 'is_primary_device_delivery_only');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `templates` ADD COLUMN `is_primary_device_delivery_only` tinyint(1) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- templates.display_format
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'templates' AND COLUMN_NAME = 'display_format');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `templates` ADD COLUMN `display_format` varchar(20) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- user_roles.id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'user_roles' AND COLUMN_NAME = 'id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `user_roles` ADD COLUMN `id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- user_roles.user_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'user_roles' AND COLUMN_NAME = 'user_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `user_roles` ADD COLUMN `user_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- user_roles.role
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'user_roles' AND COLUMN_NAME = 'role');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `user_roles` ADD COLUMN `role` enum(\'admin_master\',\'admin\',\'user\') NOT NULL DEFAULT \'user\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- user_roles.created_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'user_roles' AND COLUMN_NAME = 'created_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `user_roles` ADD COLUMN `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- users.id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'users' AND COLUMN_NAME = 'id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `users` ADD COLUMN `id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- users.email
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'users' AND COLUMN_NAME = 'email');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `users` ADD COLUMN `email` varchar(255) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- users.password_hash
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'users' AND COLUMN_NAME = 'password_hash');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `users` ADD COLUMN `password_hash` varchar(255) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- users.created_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'users' AND COLUMN_NAME = 'created_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `users` ADD COLUMN `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- users.updated_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'users' AND COLUMN_NAME = 'updated_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `users` ADD COLUMN `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- webhook_bot_logs.id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'webhook_bot_logs' AND COLUMN_NAME = 'id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `webhook_bot_logs` ADD COLUMN `id` int AUTO_INCREMENT NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- webhook_bot_logs.tenant_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'webhook_bot_logs' AND COLUMN_NAME = 'tenant_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `webhook_bot_logs` ADD COLUMN `tenant_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- webhook_bot_logs.flow_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'webhook_bot_logs' AND COLUMN_NAME = 'flow_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `webhook_bot_logs` ADD COLUMN `flow_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- webhook_bot_logs.flow_name
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'webhook_bot_logs' AND COLUMN_NAME = 'flow_name');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `webhook_bot_logs` ADD COLUMN `flow_name` varchar(255) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- webhook_bot_logs.contact_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'webhook_bot_logs' AND COLUMN_NAME = 'contact_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `webhook_bot_logs` ADD COLUMN `contact_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- webhook_bot_logs.is_match
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'webhook_bot_logs' AND COLUMN_NAME = 'is_match');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `webhook_bot_logs` ADD COLUMN `is_match` tinyint(1) NOT NULL DEFAULT \'0\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- webhook_bot_logs.raw_conditions
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'webhook_bot_logs' AND COLUMN_NAME = 'raw_conditions');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `webhook_bot_logs` ADD COLUMN `raw_conditions` json NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- webhook_bot_logs.raw_payload
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'webhook_bot_logs' AND COLUMN_NAME = 'raw_payload');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `webhook_bot_logs` ADD COLUMN `raw_payload` json NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- webhook_bot_logs.created_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'webhook_bot_logs' AND COLUMN_NAME = 'created_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `webhook_bot_logs` ADD COLUMN `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- webhook_events.id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'webhook_events' AND COLUMN_NAME = 'id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `webhook_events` ADD COLUMN `id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- webhook_events.user_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'webhook_events' AND COLUMN_NAME = 'user_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `webhook_events` ADD COLUMN `user_id` varchar(36) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- webhook_events.source
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'webhook_events' AND COLUMN_NAME = 'source');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `webhook_events` ADD COLUMN `source` varchar(100) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- webhook_events.raw
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'webhook_events' AND COLUMN_NAME = 'raw');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `webhook_events` ADD COLUMN `raw` json NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- webhook_events.processed
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'webhook_events' AND COLUMN_NAME = 'processed');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `webhook_events` ADD COLUMN `processed` tinyint(1) NOT NULL DEFAULT \'0\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- webhook_events.received_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'webhook_events' AND COLUMN_NAME = 'received_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `webhook_events` ADD COLUMN `received_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- webhook_field_mappings.id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'webhook_field_mappings' AND COLUMN_NAME = 'id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `webhook_field_mappings` ADD COLUMN `id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- webhook_field_mappings.user_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'webhook_field_mappings' AND COLUMN_NAME = 'user_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `webhook_field_mappings` ADD COLUMN `user_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- webhook_field_mappings.webhook_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'webhook_field_mappings' AND COLUMN_NAME = 'webhook_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `webhook_field_mappings` ADD COLUMN `webhook_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- webhook_field_mappings.external_field
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'webhook_field_mappings' AND COLUMN_NAME = 'external_field');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `webhook_field_mappings` ADD COLUMN `external_field` varchar(255) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- webhook_field_mappings.target_type
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'webhook_field_mappings' AND COLUMN_NAME = 'target_type');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `webhook_field_mappings` ADD COLUMN `target_type` enum(\'standard\',\'custom\',\'ignore\') NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- webhook_field_mappings.target_key
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'webhook_field_mappings' AND COLUMN_NAME = 'target_key');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `webhook_field_mappings` ADD COLUMN `target_key` varchar(100) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- webhook_field_mappings.custom_field_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'webhook_field_mappings' AND COLUMN_NAME = 'custom_field_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `webhook_field_mappings` ADD COLUMN `custom_field_id` varchar(36) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- webhook_field_mappings.transformation
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'webhook_field_mappings' AND COLUMN_NAME = 'transformation');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `webhook_field_mappings` ADD COLUMN `transformation` varchar(50) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- webhook_field_mappings.default_value
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'webhook_field_mappings' AND COLUMN_NAME = 'default_value');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `webhook_field_mappings` ADD COLUMN `default_value` text NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- webhook_field_mappings.is_required
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'webhook_field_mappings' AND COLUMN_NAME = 'is_required');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `webhook_field_mappings` ADD COLUMN `is_required` tinyint(1) NOT NULL DEFAULT \'0\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- webhook_field_mappings.created_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'webhook_field_mappings' AND COLUMN_NAME = 'created_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `webhook_field_mappings` ADD COLUMN `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- webhook_field_mappings.updated_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'webhook_field_mappings' AND COLUMN_NAME = 'updated_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `webhook_field_mappings` ADD COLUMN `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- whatsapp_business_profile_logs.id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'whatsapp_business_profile_logs' AND COLUMN_NAME = 'id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `whatsapp_business_profile_logs` ADD COLUMN `id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- whatsapp_business_profile_logs.user_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'whatsapp_business_profile_logs' AND COLUMN_NAME = 'user_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `whatsapp_business_profile_logs` ADD COLUMN `user_id` varchar(36) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- whatsapp_business_profile_logs.tenant_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'whatsapp_business_profile_logs' AND COLUMN_NAME = 'tenant_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `whatsapp_business_profile_logs` ADD COLUMN `tenant_id` varchar(36) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- whatsapp_business_profile_logs.phone_number_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'whatsapp_business_profile_logs' AND COLUMN_NAME = 'phone_number_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `whatsapp_business_profile_logs` ADD COLUMN `phone_number_id` varchar(100) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- whatsapp_business_profile_logs.action
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'whatsapp_business_profile_logs' AND COLUMN_NAME = 'action');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `whatsapp_business_profile_logs` ADD COLUMN `action` enum(\'fetch_profile\',\'update_profile\',\'upload_profile_picture\',\'update_profile_picture\') NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- whatsapp_business_profile_logs.old_data_json
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'whatsapp_business_profile_logs' AND COLUMN_NAME = 'old_data_json');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `whatsapp_business_profile_logs` ADD COLUMN `old_data_json` json NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- whatsapp_business_profile_logs.new_data_json
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'whatsapp_business_profile_logs' AND COLUMN_NAME = 'new_data_json');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `whatsapp_business_profile_logs` ADD COLUMN `new_data_json` json NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- whatsapp_business_profile_logs.meta_response_json
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'whatsapp_business_profile_logs' AND COLUMN_NAME = 'meta_response_json');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `whatsapp_business_profile_logs` ADD COLUMN `meta_response_json` json NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- whatsapp_business_profile_logs.success
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'whatsapp_business_profile_logs' AND COLUMN_NAME = 'success');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `whatsapp_business_profile_logs` ADD COLUMN `success` tinyint(1) NOT NULL DEFAULT \'0\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- whatsapp_business_profile_logs.error_code
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'whatsapp_business_profile_logs' AND COLUMN_NAME = 'error_code');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `whatsapp_business_profile_logs` ADD COLUMN `error_code` varchar(100) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- whatsapp_business_profile_logs.error_message
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'whatsapp_business_profile_logs' AND COLUMN_NAME = 'error_message');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `whatsapp_business_profile_logs` ADD COLUMN `error_message` text NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- whatsapp_business_profile_logs.created_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'whatsapp_business_profile_logs' AND COLUMN_NAME = 'created_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `whatsapp_business_profile_logs` ADD COLUMN `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- whatsapp_business_profile_logs.updated_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'whatsapp_business_profile_logs' AND COLUMN_NAME = 'updated_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `whatsapp_business_profile_logs` ADD COLUMN `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- whatsapp_flow_submissions.id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'whatsapp_flow_submissions' AND COLUMN_NAME = 'id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `whatsapp_flow_submissions` ADD COLUMN `id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- whatsapp_flow_submissions.user_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'whatsapp_flow_submissions' AND COLUMN_NAME = 'user_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `whatsapp_flow_submissions` ADD COLUMN `user_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- whatsapp_flow_submissions.contact_phone
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'whatsapp_flow_submissions' AND COLUMN_NAME = 'contact_phone');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `whatsapp_flow_submissions` ADD COLUMN `contact_phone` varchar(50) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- whatsapp_flow_submissions.flow_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'whatsapp_flow_submissions' AND COLUMN_NAME = 'flow_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `whatsapp_flow_submissions` ADD COLUMN `flow_id` varchar(100) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- whatsapp_flow_submissions.flow_token
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'whatsapp_flow_submissions' AND COLUMN_NAME = 'flow_token');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `whatsapp_flow_submissions` ADD COLUMN `flow_token` varchar(255) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- whatsapp_flow_submissions.response_json
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'whatsapp_flow_submissions' AND COLUMN_NAME = 'response_json');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `whatsapp_flow_submissions` ADD COLUMN `response_json` json NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- whatsapp_flow_submissions.created_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'whatsapp_flow_submissions' AND COLUMN_NAME = 'created_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `whatsapp_flow_submissions` ADD COLUMN `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- whatsapp_flows.id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'whatsapp_flows' AND COLUMN_NAME = 'id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `whatsapp_flows` ADD COLUMN `id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- whatsapp_flows.user_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'whatsapp_flows' AND COLUMN_NAME = 'user_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `whatsapp_flows` ADD COLUMN `user_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- whatsapp_flows.flow_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'whatsapp_flows' AND COLUMN_NAME = 'flow_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `whatsapp_flows` ADD COLUMN `flow_id` varchar(100) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- whatsapp_flows.flow_name
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'whatsapp_flows' AND COLUMN_NAME = 'flow_name');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `whatsapp_flows` ADD COLUMN `flow_name` varchar(255) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- whatsapp_flows.waba_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'whatsapp_flows' AND COLUMN_NAME = 'waba_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `whatsapp_flows` ADD COLUMN `waba_id` varchar(100) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- whatsapp_flows.phone_number_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'whatsapp_flows' AND COLUMN_NAME = 'phone_number_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `whatsapp_flows` ADD COLUMN `phone_number_id` varchar(100) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- whatsapp_flows.status
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'whatsapp_flows' AND COLUMN_NAME = 'status');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `whatsapp_flows` ADD COLUMN `status` varchar(50) NOT NULL DEFAULT \'draft\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- whatsapp_flows.flow_json
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'whatsapp_flows' AND COLUMN_NAME = 'flow_json');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `whatsapp_flows` ADD COLUMN `flow_json` json NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- whatsapp_flows.endpoint_url
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'whatsapp_flows' AND COLUMN_NAME = 'endpoint_url');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `whatsapp_flows` ADD COLUMN `endpoint_url` varchar(500) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- whatsapp_flows.created_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'whatsapp_flows' AND COLUMN_NAME = 'created_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `whatsapp_flows` ADD COLUMN `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- whatsapp_flows.updated_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'whatsapp_flows' AND COLUMN_NAME = 'updated_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `whatsapp_flows` ADD COLUMN `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- whatsapp_group_participants.id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'whatsapp_group_participants' AND COLUMN_NAME = 'id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `whatsapp_group_participants` ADD COLUMN `id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- whatsapp_group_participants.user_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'whatsapp_group_participants' AND COLUMN_NAME = 'user_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `whatsapp_group_participants` ADD COLUMN `user_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- whatsapp_group_participants.group_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'whatsapp_group_participants' AND COLUMN_NAME = 'group_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `whatsapp_group_participants` ADD COLUMN `group_id` varchar(100) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- whatsapp_group_participants.wa_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'whatsapp_group_participants' AND COLUMN_NAME = 'wa_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `whatsapp_group_participants` ADD COLUMN `wa_id` varchar(50) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- whatsapp_group_participants.name
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'whatsapp_group_participants' AND COLUMN_NAME = 'name');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `whatsapp_group_participants` ADD COLUMN `name` varchar(255) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- whatsapp_group_participants.status
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'whatsapp_group_participants' AND COLUMN_NAME = 'status');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `whatsapp_group_participants` ADD COLUMN `status` varchar(50) NOT NULL DEFAULT \'active\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- whatsapp_group_participants.joined_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'whatsapp_group_participants' AND COLUMN_NAME = 'joined_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `whatsapp_group_participants` ADD COLUMN `joined_at` datetime NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- whatsapp_group_participants.left_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'whatsapp_group_participants' AND COLUMN_NAME = 'left_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `whatsapp_group_participants` ADD COLUMN `left_at` datetime NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- whatsapp_group_participants.created_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'whatsapp_group_participants' AND COLUMN_NAME = 'created_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `whatsapp_group_participants` ADD COLUMN `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- whatsapp_group_participants.updated_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'whatsapp_group_participants' AND COLUMN_NAME = 'updated_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `whatsapp_group_participants` ADD COLUMN `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- whatsapp_groups.id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'whatsapp_groups' AND COLUMN_NAME = 'id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `whatsapp_groups` ADD COLUMN `id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- whatsapp_groups.user_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'whatsapp_groups' AND COLUMN_NAME = 'user_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `whatsapp_groups` ADD COLUMN `user_id` varchar(36) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- whatsapp_groups.instance_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'whatsapp_groups' AND COLUMN_NAME = 'instance_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `whatsapp_groups` ADD COLUMN `instance_id` varchar(100) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- whatsapp_groups.group_id
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'whatsapp_groups' AND COLUMN_NAME = 'group_id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `whatsapp_groups` ADD COLUMN `group_id` varchar(100) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- whatsapp_groups.name
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'whatsapp_groups' AND COLUMN_NAME = 'name');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `whatsapp_groups` ADD COLUMN `name` varchar(255) NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- whatsapp_groups.description
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'whatsapp_groups' AND COLUMN_NAME = 'description');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `whatsapp_groups` ADD COLUMN `description` text NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- whatsapp_groups.invite_link
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'whatsapp_groups' AND COLUMN_NAME = 'invite_link');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `whatsapp_groups` ADD COLUMN `invite_link` text NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- whatsapp_groups.status
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'whatsapp_groups' AND COLUMN_NAME = 'status');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `whatsapp_groups` ADD COLUMN `status` varchar(50) NOT NULL DEFAULT \'active\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- whatsapp_groups.error_message
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'whatsapp_groups' AND COLUMN_NAME = 'error_message');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `whatsapp_groups` ADD COLUMN `error_message` text NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- whatsapp_groups.created_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'whatsapp_groups' AND COLUMN_NAME = 'created_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `whatsapp_groups` ADD COLUMN `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- whatsapp_groups.updated_at
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'whatsapp_groups' AND COLUMN_NAME = 'updated_at');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE `whatsapp_groups` ADD COLUMN `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

