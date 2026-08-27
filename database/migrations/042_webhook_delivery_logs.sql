-- Cria tabela de auditoria de entrega de webhooks.
-- Registra toda requisição recebida, incluindo rejeições e falhas,
-- para rastreabilidade completa.
CREATE TABLE IF NOT EXISTS `webhook_delivery_logs` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `provider` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `channel_resource_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `http_status` int DEFAULT NULL,
  `outcome` enum('received','rejected_signature','rejected_unconfigured','rejected_parse','rejected_no_events','persistence_failed','persisted','queued') COLLATE utf8mb4_unicode_ci NOT NULL,
  `raw_body` json DEFAULT NULL,
  `error_message` text COLLATE utf8mb4_unicode_ci,
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `received_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_webhook_delivery_logs_tenant` (`tenant_id`),
  KEY `idx_webhook_delivery_logs_received` (`received_at`),
  KEY `idx_webhook_delivery_logs_provider` (`provider`,`outcome`),
  CONSTRAINT `fk_webhook_delivery_logs_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
