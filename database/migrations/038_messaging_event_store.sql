-- Cria a tabela canônica de eventos de mensageria.
-- Esta tabela desacopla o ingress de webhooks do processamento,
-- garantindo idempotência por (tenant_id, provider, external_event_id)
-- e permitindo processamento assíncrono via fila.
CREATE TABLE IF NOT EXISTS `messaging_events` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `provider` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `channel_resource_id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `external_event_id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `event_type` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload_json` json NOT NULL,
  `raw_payload_json` json NOT NULL,
  `status` enum('pending','processing','completed','failed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `attempt_count` int NOT NULL DEFAULT '0',
  `last_error` text COLLATE utf8mb4_unicode_ci,
  `received_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `processed_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_messaging_events_tenant_provider_external` (`tenant_id`,`provider`,`external_event_id`),
  KEY `idx_messaging_events_status` (`status`,`received_at`),
  KEY `idx_messaging_events_provider` (`provider`,`channel_resource_id`),
  KEY `idx_messaging_events_tenant` (`tenant_id`),
  CONSTRAINT `fk_messaging_events_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_messaging_events_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
