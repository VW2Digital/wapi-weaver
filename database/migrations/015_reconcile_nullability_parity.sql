-- ignore-errors
-- Migration 015: Reconcile nullability parity (Phase A) for Grupo A and Grupo B columns
-- Idempotent DDL updates and pre-audit backfills to align DB columns with canonical schema


SET @dbname = DATABASE();

-- 1. ai_agent_settings.is_active
UPDATE `ai_agent_settings` SET `is_active` = 0 WHERE `is_active` IS NULL;
SET @col_is_null = (SELECT IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ai_agent_settings' AND COLUMN_NAME = 'is_active');
SET @sql_stmt = IF(@col_is_null = 'YES', 'ALTER TABLE `ai_agent_settings` MODIFY COLUMN `is_active` tinyint(1) NOT NULL DEFAULT \'0\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2. ai_agent_settings.model
UPDATE `ai_agent_settings` SET `model` = 'gemini-2.5-flash' WHERE `model` IS NULL;
SET @col_is_null = (SELECT IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ai_agent_settings' AND COLUMN_NAME = 'model');
SET @sql_stmt = IF(@col_is_null = 'YES', 'ALTER TABLE `ai_agent_settings` MODIFY COLUMN `model` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT \'gemini-2.5-flash\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3. ai_usage_logs.prompt_tokens
UPDATE `ai_usage_logs` SET `prompt_tokens` = 0 WHERE `prompt_tokens` IS NULL;
SET @col_is_null = (SELECT IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ai_usage_logs' AND COLUMN_NAME = 'prompt_tokens');
SET @sql_stmt = IF(@col_is_null = 'YES', 'ALTER TABLE `ai_usage_logs` MODIFY COLUMN `prompt_tokens` int NOT NULL DEFAULT \'0\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 4. ai_usage_logs.completion_tokens
UPDATE `ai_usage_logs` SET `completion_tokens` = 0 WHERE `completion_tokens` IS NULL;
SET @col_is_null = (SELECT IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ai_usage_logs' AND COLUMN_NAME = 'completion_tokens');
SET @sql_stmt = IF(@col_is_null = 'YES', 'ALTER TABLE `ai_usage_logs` MODIFY COLUMN `completion_tokens` int NOT NULL DEFAULT \'0\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 5. ai_usage_logs.total_tokens
UPDATE `ai_usage_logs` SET `total_tokens` = 0 WHERE `total_tokens` IS NULL;
SET @col_is_null = (SELECT IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ai_usage_logs' AND COLUMN_NAME = 'total_tokens');
SET @sql_stmt = IF(@col_is_null = 'YES', 'ALTER TABLE `ai_usage_logs` MODIFY COLUMN `total_tokens` int NOT NULL DEFAULT \'0\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 6. audit_logs.created_at
UPDATE `audit_logs` SET `created_at` = NOW() WHERE `created_at` IS NULL;
SET @col_is_null = (SELECT IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'audit_logs' AND COLUMN_NAME = 'created_at');
SET @sql_stmt = IF(@col_is_null = 'YES', 'ALTER TABLE `audit_logs` MODIFY COLUMN `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 7. automation_actions.action_type
UPDATE `automation_actions` SET `action_type` = 'send_message' WHERE `action_type` IS NULL;
SET @col_is_null = (SELECT IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'automation_actions' AND COLUMN_NAME = 'action_type');
SET @sql_stmt = IF(@col_is_null = 'YES', 'ALTER TABLE `automation_actions` MODIFY COLUMN `action_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 8. automation_logs.status
UPDATE `automation_logs` SET `status` = 'success' WHERE `status` IS NULL;
SET @col_is_null = (SELECT IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'automation_logs' AND COLUMN_NAME = 'status');
SET @sql_stmt = IF(@col_is_null = 'YES', 'ALTER TABLE `automation_logs` MODIFY COLUMN `status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT \'success\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 9. automation_rules.is_active
UPDATE `automation_rules` SET `is_active` = 1 WHERE `is_active` IS NULL;
SET @col_is_null = (SELECT IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'automation_rules' AND COLUMN_NAME = 'is_active');
SET @sql_stmt = IF(@col_is_null = 'YES', 'ALTER TABLE `automation_rules` MODIFY COLUMN `is_active` tinyint(1) NOT NULL DEFAULT \'1\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 10. automation_triggers.event_type
UPDATE `automation_triggers` SET `event_type` = 'custom' WHERE `event_type` IS NULL;
SET @col_is_null = (SELECT IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'automation_triggers' AND COLUMN_NAME = 'event_type');
SET @sql_stmt = IF(@col_is_null = 'YES', 'ALTER TABLE `automation_triggers` MODIFY COLUMN `event_type` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 11. billing_invoices.amount
UPDATE `billing_invoices` SET `amount` = 0.00 WHERE `amount` IS NULL;
SET @col_is_null = (SELECT IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'billing_invoices' AND COLUMN_NAME = 'amount');
SET @sql_stmt = IF(@col_is_null = 'YES', 'ALTER TABLE `billing_invoices` MODIFY COLUMN `amount` decimal(10,2) NOT NULL DEFAULT \'0.00\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 12. billing_invoices.currency
UPDATE `billing_invoices` SET `currency` = 'BRL' WHERE `currency` IS NULL;
SET @col_is_null = (SELECT IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'billing_invoices' AND COLUMN_NAME = 'currency');
SET @sql_stmt = IF(@col_is_null = 'YES', 'ALTER TABLE `billing_invoices` MODIFY COLUMN `currency` varchar(3) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT \'BRL\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 13. billing_invoices.status
UPDATE `billing_invoices` SET `status` = 'pending' WHERE `status` IS NULL;
SET @col_is_null = (SELECT IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'billing_invoices' AND COLUMN_NAME = 'status');
SET @sql_stmt = IF(@col_is_null = 'YES', 'ALTER TABLE `billing_invoices` MODIFY COLUMN `status` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT \'pending\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 14. billing_payments.amount
UPDATE `billing_payments` SET `amount` = 0.00 WHERE `amount` IS NULL;
SET @col_is_null = (SELECT IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'billing_payments' AND COLUMN_NAME = 'amount');
SET @sql_stmt = IF(@col_is_null = 'YES', 'ALTER TABLE `billing_payments` MODIFY COLUMN `amount` decimal(10,2) NOT NULL DEFAULT \'0.00\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 15. billing_payments.currency
UPDATE `billing_payments` SET `currency` = 'BRL' WHERE `currency` IS NULL;
SET @col_is_null = (SELECT IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'billing_payments' AND COLUMN_NAME = 'currency');
SET @sql_stmt = IF(@col_is_null = 'YES', 'ALTER TABLE `billing_payments` MODIFY COLUMN `currency` varchar(3) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT \'BRL\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 16. billing_payments.payment_method
UPDATE `billing_payments` SET `payment_method` = 'pix' WHERE `payment_method` IS NULL;
SET @col_is_null = (SELECT IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'billing_payments' AND COLUMN_NAME = 'payment_method');
SET @sql_stmt = IF(@col_is_null = 'YES', 'ALTER TABLE `billing_payments` MODIFY COLUMN `payment_method` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 17. billing_payments.status
UPDATE `billing_payments` SET `status` = 'pending' WHERE `status` IS NULL;
SET @col_is_null = (SELECT IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'billing_payments' AND COLUMN_NAME = 'status');
SET @sql_stmt = IF(@col_is_null = 'YES', 'ALTER TABLE `billing_payments` MODIFY COLUMN `status` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT \'pending\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 18. billing_plans.price
UPDATE `billing_plans` SET `price` = 0.00 WHERE `price` IS NULL;
SET @col_is_null = (SELECT IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'billing_plans' AND COLUMN_NAME = 'price');
SET @sql_stmt = IF(@col_is_null = 'YES', 'ALTER TABLE `billing_plans` MODIFY COLUMN `price` decimal(10,2) NOT NULL DEFAULT \'0.00\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 19. billing_plans.currency
UPDATE `billing_plans` SET `currency` = 'BRL' WHERE `currency` IS NULL;
SET @col_is_null = (SELECT IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'billing_plans' AND COLUMN_NAME = 'currency');
SET @sql_stmt = IF(@col_is_null = 'YES', 'ALTER TABLE `billing_plans` MODIFY COLUMN `currency` varchar(3) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT \'BRL\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 20. billing_plans.billing_cycle
UPDATE `billing_plans` SET `billing_cycle` = 'monthly' WHERE `billing_cycle` IS NULL;
SET @col_is_null = (SELECT IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'billing_plans' AND COLUMN_NAME = 'billing_cycle');
SET @sql_stmt = IF(@col_is_null = 'YES', 'ALTER TABLE `billing_plans` MODIFY COLUMN `billing_cycle` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT \'monthly\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 21. billing_subscriptions.status
UPDATE `billing_subscriptions` SET `status` = 'active' WHERE `status` IS NULL;
SET @col_is_null = (SELECT IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'billing_subscriptions' AND COLUMN_NAME = 'status');
SET @sql_stmt = IF(@col_is_null = 'YES', 'ALTER TABLE `billing_subscriptions` MODIFY COLUMN `status` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT \'active\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 22. billing_webhook_events.event_type
UPDATE `billing_webhook_events` SET `event_type` = 'generic' WHERE `event_type` IS NULL;
SET @col_is_null = (SELECT IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'billing_webhook_events' AND COLUMN_NAME = 'event_type');
SET @sql_stmt = IF(@col_is_null = 'YES', 'ALTER TABLE `billing_webhook_events` MODIFY COLUMN `event_type` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 23. billing_webhook_events.status
UPDATE `billing_webhook_events` SET `status` = 'pending' WHERE `status` IS NULL;
SET @col_is_null = (SELECT IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'billing_webhook_events' AND COLUMN_NAME = 'status');
SET @sql_stmt = IF(@col_is_null = 'YES', 'ALTER TABLE `billing_webhook_events` MODIFY COLUMN `status` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT \'pending\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 24. bot_flows.is_active
UPDATE `bot_flows` SET `is_active` = 1 WHERE `is_active` IS NULL;
SET @col_is_null = (SELECT IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'bot_flows' AND COLUMN_NAME = 'is_active');
SET @sql_stmt = IF(@col_is_null = 'YES', 'ALTER TABLE `bot_flows` MODIFY COLUMN `is_active` tinyint(1) NOT NULL DEFAULT \'1\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 25. calendar_events.start_time
UPDATE `calendar_events` SET `start_time` = NOW() WHERE `start_time` IS NULL;
SET @col_is_null = (SELECT IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'calendar_events' AND COLUMN_NAME = 'start_time');
SET @sql_stmt = IF(@col_is_null = 'YES', 'ALTER TABLE `calendar_events` MODIFY COLUMN `start_time` datetime NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 26. calendar_events.end_time
UPDATE `calendar_events` SET `end_time` = DATE_ADD(NOW(), INTERVAL 1 HOUR) WHERE `end_time` IS NULL;
SET @col_is_null = (SELECT IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'calendar_events' AND COLUMN_NAME = 'end_time');
SET @sql_stmt = IF(@col_is_null = 'YES', 'ALTER TABLE `calendar_events` MODIFY COLUMN `end_time` datetime NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 27. campaign_messages.status
UPDATE `campaign_messages` SET `status` = 'pending' WHERE `status` IS NULL;
SET @col_is_null = (SELECT IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'campaign_messages' AND COLUMN_NAME = 'status');
SET @sql_stmt = IF(@col_is_null = 'YES', 'ALTER TABLE `campaign_messages` MODIFY COLUMN `status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT \'pending\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 28. campaigns.status
UPDATE `campaigns` SET `status` = 'draft' WHERE `status` IS NULL;
SET @col_is_null = (SELECT IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'campaigns' AND COLUMN_NAME = 'status');
SET @sql_stmt = IF(@col_is_null = 'YES', 'ALTER TABLE `campaigns` MODIFY COLUMN `status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT \'draft\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 29. contacts.is_active
UPDATE `contacts` SET `is_active` = 1 WHERE `is_active` IS NULL;
SET @col_is_null = (SELECT IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'contacts' AND COLUMN_NAME = 'is_active');
SET @sql_stmt = IF(@col_is_null = 'YES', 'ALTER TABLE `contacts` MODIFY COLUMN `is_active` tinyint(1) NOT NULL DEFAULT \'1\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 30. contacts.opted_out
UPDATE `contacts` SET `opted_out` = 0 WHERE `opted_out` IS NULL;
SET @col_is_null = (SELECT IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'contacts' AND COLUMN_NAME = 'opted_out');
SET @sql_stmt = IF(@col_is_null = 'YES', 'ALTER TABLE `contacts` MODIFY COLUMN `opted_out` tinyint(1) NOT NULL DEFAULT \'0\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 31. ds_agents.is_active
UPDATE `ds_agents` SET `is_active` = 1 WHERE `is_active` IS NULL;
SET @col_is_null = (SELECT IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'ds_agents' AND COLUMN_NAME = 'is_active');
SET @sql_stmt = IF(@col_is_null = 'YES', 'ALTER TABLE `ds_agents` MODIFY COLUMN `is_active` tinyint(1) NOT NULL DEFAULT \'1\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 32. integration_tokens.service
UPDATE `integration_tokens` SET `service` = 'generic' WHERE `service` IS NULL;
SET @col_is_null = (SELECT IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'integration_tokens' AND COLUMN_NAME = 'service');
SET @sql_stmt = IF(@col_is_null = 'YES', 'ALTER TABLE `integration_tokens` MODIFY COLUMN `service` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 33. licenses.status
UPDATE `licenses` SET `status` = 'active' WHERE `status` IS NULL;
SET @col_is_null = (SELECT IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'licenses' AND COLUMN_NAME = 'status');
SET @sql_stmt = IF(@col_is_null = 'YES', 'ALTER TABLE `licenses` MODIFY COLUMN `status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT \'active\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 34. licenses.max_instances
UPDATE `licenses` SET `max_instances` = 1 WHERE `max_instances` IS NULL;
SET @col_is_null = (SELECT IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'licenses' AND COLUMN_NAME = 'max_instances');
SET @sql_stmt = IF(@col_is_null = 'YES', 'ALTER TABLE `licenses` MODIFY COLUMN `max_instances` int NOT NULL DEFAULT \'1\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 35. message_templates.category
UPDATE `message_templates` SET `category` = 'general' WHERE `category` IS NULL;
SET @col_is_null = (SELECT IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'message_templates' AND COLUMN_NAME = 'category');
SET @sql_stmt = IF(@col_is_null = 'YES', 'ALTER TABLE `message_templates` MODIFY COLUMN `category` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT \'general\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 36. messages.direction
UPDATE `messages` SET `direction` = 'inbound' WHERE `direction` IS NULL;
SET @col_is_null = (SELECT IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'messages' AND COLUMN_NAME = 'direction');
SET @sql_stmt = IF(@col_is_null = 'YES', 'ALTER TABLE `messages` MODIFY COLUMN `direction` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 37. messages.type
UPDATE `messages` SET `type` = 'text' WHERE `type` IS NULL;
SET @col_is_null = (SELECT IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'messages' AND COLUMN_NAME = 'type');
SET @sql_stmt = IF(@col_is_null = 'YES', 'ALTER TABLE `messages` MODIFY COLUMN `type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT \'text\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 38. messages.status
UPDATE `messages` SET `status` = 'sent' WHERE `status` IS NULL;
SET @col_is_null = (SELECT IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'messages' AND COLUMN_NAME = 'status');
SET @sql_stmt = IF(@col_is_null = 'YES', 'ALTER TABLE `messages` MODIFY COLUMN `status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT \'sent\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 39. opportunities.stage_id
UPDATE `opportunities` SET `stage_id` = 'default' WHERE `stage_id` IS NULL;
SET @col_is_null = (SELECT IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunities' AND COLUMN_NAME = 'stage_id');
SET @sql_stmt = IF(@col_is_null = 'YES', 'ALTER TABLE `opportunities` MODIFY COLUMN `stage_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 40. opportunity_stages.position
UPDATE `opportunity_stages` SET `position` = 0 WHERE `position` IS NULL;
SET @col_is_null = (SELECT IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunity_stages' AND COLUMN_NAME = 'position');
SET @sql_stmt = IF(@col_is_null = 'YES', 'ALTER TABLE `opportunity_stages` MODIFY COLUMN `position` int NOT NULL DEFAULT \'0\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 41. opportunity_stages.pipeline_id
UPDATE `opportunity_stages` SET `pipeline_id` = 'default' WHERE `pipeline_id` IS NULL;
SET @col_is_null = (SELECT IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunity_stages' AND COLUMN_NAME = 'pipeline_id');
SET @sql_stmt = IF(@col_is_null = 'YES', 'ALTER TABLE `opportunity_stages` MODIFY COLUMN `pipeline_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 42. payment_gateways.gateway_id
UPDATE `payment_gateways` SET `gateway_id` = 'mercadopago' WHERE `gateway_id` IS NULL;
SET @col_is_null = (SELECT IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'payment_gateways' AND COLUMN_NAME = 'gateway_id');
SET @sql_stmt = IF(@col_is_null = 'YES', 'ALTER TABLE `payment_gateways` MODIFY COLUMN `gateway_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 43. payment_gateways.is_active
UPDATE `payment_gateways` SET `is_active` = 1 WHERE `is_active` IS NULL;
SET @col_is_null = (SELECT IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'payment_gateways' AND COLUMN_NAME = 'is_active');
SET @sql_stmt = IF(@col_is_null = 'YES', 'ALTER TABLE `payment_gateways` MODIFY COLUMN `is_active` tinyint(1) NOT NULL DEFAULT \'1\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 44. payment_transactions.amount
UPDATE `payment_transactions` SET `amount` = 0.00 WHERE `amount` IS NULL;
SET @col_is_null = (SELECT IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'payment_transactions' AND COLUMN_NAME = 'amount');
SET @sql_stmt = IF(@col_is_null = 'YES', 'ALTER TABLE `payment_transactions` MODIFY COLUMN `amount` decimal(10,2) NOT NULL DEFAULT \'0.00\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 45. payment_transactions.currency
UPDATE `payment_transactions` SET `currency` = 'BRL' WHERE `currency` IS NULL;
SET @col_is_null = (SELECT IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'payment_transactions' AND COLUMN_NAME = 'currency');
SET @sql_stmt = IF(@col_is_null = 'YES', 'ALTER TABLE `payment_transactions` MODIFY COLUMN `currency` varchar(3) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT \'BRL\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 46. payment_transactions.status
UPDATE `payment_transactions` SET `status` = 'pending' WHERE `status` IS NULL;
SET @col_is_null = (SELECT IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'payment_transactions' AND COLUMN_NAME = 'status');
SET @sql_stmt = IF(@col_is_null = 'YES', 'ALTER TABLE `payment_transactions` MODIFY COLUMN `status` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT \'pending\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 47. subscription_events.event_type
UPDATE `subscription_events` SET `event_type` = 'generic' WHERE `event_type` IS NULL;
SET @col_is_null = (SELECT IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'subscription_events' AND COLUMN_NAME = 'event_type');
SET @sql_stmt = IF(@col_is_null = 'YES', 'ALTER TABLE `subscription_events` MODIFY COLUMN `event_type` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 48. subscription_plans.price
UPDATE `subscription_plans` SET `price` = 0.00 WHERE `price` IS NULL;
SET @col_is_null = (SELECT IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'subscription_plans' AND COLUMN_NAME = 'price');
SET @sql_stmt = IF(@col_is_null = 'YES', 'ALTER TABLE `subscription_plans` MODIFY COLUMN `price` decimal(10,2) NOT NULL DEFAULT \'0.00\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 49. subscription_plans.is_active
UPDATE `subscription_plans` SET `is_active` = 1 WHERE `is_active` IS NULL;
SET @col_is_null = (SELECT IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'subscription_plans' AND COLUMN_NAME = 'is_active');
SET @sql_stmt = IF(@col_is_null = 'YES', 'ALTER TABLE `subscription_plans` MODIFY COLUMN `is_active` tinyint(1) NOT NULL DEFAULT \'1\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 50. subscriptions.status
UPDATE `subscriptions` SET `status` = 'trial' WHERE `status` IS NULL;
SET @col_is_null = (SELECT IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'subscriptions' AND COLUMN_NAME = 'status');
SET @sql_stmt = IF(@col_is_null = 'YES', 'ALTER TABLE `subscriptions` MODIFY COLUMN `status` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT \'trial\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 51. subscriptions.auto_renew
UPDATE `subscriptions` SET `auto_renew` = 0 WHERE `auto_renew` IS NULL;
SET @col_is_null = (SELECT IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'subscriptions' AND COLUMN_NAME = 'auto_renew');
SET @sql_stmt = IF(@col_is_null = 'YES', 'ALTER TABLE `subscriptions` MODIFY COLUMN `auto_renew` tinyint(1) NOT NULL DEFAULT \'0\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 52. system_logs.level
UPDATE `system_logs` SET `level` = 'info' WHERE `level` IS NULL;
SET @col_is_null = (SELECT IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'system_logs' AND COLUMN_NAME = 'level');
SET @sql_stmt = IF(@col_is_null = 'YES', 'ALTER TABLE `system_logs` MODIFY COLUMN `level` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT \'info\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 53. system_logs.message
UPDATE `system_logs` SET `message` = 'system_event' WHERE `message` IS NULL;
SET @col_is_null = (SELECT IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'system_logs' AND COLUMN_NAME = 'message');
SET @sql_stmt = IF(@col_is_null = 'YES', 'ALTER TABLE `system_logs` MODIFY COLUMN `message` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 54. system_logs.created_at
UPDATE `system_logs` SET `created_at` = NOW() WHERE `created_at` IS NULL;
SET @col_is_null = (SELECT IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'system_logs' AND COLUMN_NAME = 'created_at');
SET @sql_stmt = IF(@col_is_null = 'YES', 'ALTER TABLE `system_logs` MODIFY COLUMN `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 55. system_settings.setting_key
UPDATE `system_settings` SET `setting_key` = 'unknown' WHERE `setting_key` IS NULL;
SET @col_is_null = (SELECT IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'system_settings' AND COLUMN_NAME = 'setting_key');
SET @sql_stmt = IF(@col_is_null = 'YES', 'ALTER TABLE `system_settings` MODIFY COLUMN `setting_key` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 56. tags.name
UPDATE `tags` SET `name` = 'tag' WHERE `name` IS NULL;
SET @col_is_null = (SELECT IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'tags' AND COLUMN_NAME = 'name');
SET @sql_stmt = IF(@col_is_null = 'YES', 'ALTER TABLE `tags` MODIFY COLUMN `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 57. users.status
UPDATE `users` SET `status` = 'active' WHERE `status` IS NULL;
SET @col_is_null = (SELECT IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'users' AND COLUMN_NAME = 'status');
SET @sql_stmt = IF(@col_is_null = 'YES', 'ALTER TABLE `users` MODIFY COLUMN `status` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT \'active\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 58. users.role
UPDATE `users` SET `role` = 'user' WHERE `role` IS NULL;
SET @col_is_null = (SELECT IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'users' AND COLUMN_NAME = 'role');
SET @sql_stmt = IF(@col_is_null = 'YES', 'ALTER TABLE `users` MODIFY COLUMN `role` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT \'user\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 59. webhook_events.event_type
UPDATE `webhook_events` SET `event_type` = 'generic' WHERE `event_type` IS NULL;
SET @col_is_null = (SELECT IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'webhook_events' AND COLUMN_NAME = 'event_type');
SET @sql_stmt = IF(@col_is_null = 'YES', 'ALTER TABLE `webhook_events` MODIFY COLUMN `event_type` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT \'generic\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 60. webhook_events.status
UPDATE `webhook_events` SET `status` = 'pending' WHERE `status` IS NULL;
SET @col_is_null = (SELECT IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'webhook_events' AND COLUMN_NAME = 'status');
SET @sql_stmt = IF(@col_is_null = 'YES', 'ALTER TABLE `webhook_events` MODIFY COLUMN `status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT \'pending\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 61. whatsapp_instances.status
UPDATE `whatsapp_instances` SET `status` = 'disconnected' WHERE `status` IS NULL;
SET @col_is_null = (SELECT IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'whatsapp_instances' AND COLUMN_NAME = 'status');
SET @sql_stmt = IF(@col_is_null = 'YES', 'ALTER TABLE `whatsapp_instances` MODIFY COLUMN `status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT \'disconnected\'', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 62. whatsapp_instances.instance_name
UPDATE `whatsapp_instances` SET `instance_name` = 'default_instance' WHERE `instance_name` IS NULL;
SET @col_is_null = (SELECT IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'whatsapp_instances' AND COLUMN_NAME = 'instance_name');
SET @sql_stmt = IF(@col_is_null = 'YES', 'ALTER TABLE `whatsapp_instances` MODIFY COLUMN `instance_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 63. whatsapp_instances.qrcode_updated_at
UPDATE `whatsapp_instances` SET `qrcode_updated_at` = NOW() WHERE `qrcode_updated_at` IS NULL;
SET @col_is_null = (SELECT IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'whatsapp_instances' AND COLUMN_NAME = 'qrcode_updated_at');
SET @sql_stmt = IF(@col_is_null = 'YES', 'ALTER TABLE `whatsapp_instances` MODIFY COLUMN `qrcode_updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 64. whatsapp_instances.created_at
UPDATE `whatsapp_instances` SET `created_at` = NOW() WHERE `created_at` IS NULL;
SET @col_is_null = (SELECT IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'whatsapp_instances' AND COLUMN_NAME = 'created_at');
SET @sql_stmt = IF(@col_is_null = 'YES', 'ALTER TABLE `whatsapp_instances` MODIFY COLUMN `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;
