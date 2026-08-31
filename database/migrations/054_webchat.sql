-- Migration 054: Additive WebChat schema.
--
-- Introduces webchat as a legitimate messaging provider.
-- No destructive changes; no WhatsApp/Instagram data touched.

-- Allow webchat as a channel provider.
ALTER TABLE `channel_connections`
  MODIFY COLUMN `provider`
    ENUM('whatsapp','instagram','messenger','webchat')
    COLLATE utf8mb4_unicode_ci
    NOT NULL;

-- WebChat visitors do not have a phone number.
-- Existing rows keep their values; new webchat rows can leave it NULL.
ALTER TABLE `contacts`
  MODIFY COLUMN `phone_e164`
    VARCHAR(50)
    COLLATE utf8mb4_unicode_ci
    NULL
    DEFAULT NULL;

-- Widget configuration exposed via public id.
CREATE TABLE IF NOT EXISTS `webchat_widgets` (
  `id` VARCHAR(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tenant_id` VARCHAR(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `channel_connection_id` VARCHAR(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `public_id` VARCHAR(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` VARCHAR(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `enabled` TINYINT(1) NOT NULL DEFAULT '1',
  `title` VARCHAR(255) COLLATE utf8mb4_unicode_ci DEFAULT 'Chat',
  `welcome_message` TEXT COLLATE utf8mb4_unicode_ci,
  `placeholder` VARCHAR(255) COLLATE utf8mb4_unicode_ci DEFAULT 'Digite uma mensagem...',
  `accent_color` VARCHAR(7) COLLATE utf8mb4_unicode_ci DEFAULT '#0ea5e9',
  `position` ENUM('bottom-right','bottom-left') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'bottom-right',
  `allowed_origins` TEXT COLLATE utf8mb4_unicode_ci,
  `prechat_enabled` TINYINT(1) NOT NULL DEFAULT '0',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_webchat_widget_public` (`public_id`),
  UNIQUE KEY `uk_webchat_widget_channel` (`channel_connection_id`),
  KEY `idx_webchat_widget_tenant` (`tenant_id`),
  CONSTRAINT `fk_webchat_widget_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_webchat_widget_channel` FOREIGN KEY (`channel_connection_id`) REFERENCES `channel_connections` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Visitor session state for the WebChat widget.
CREATE TABLE IF NOT EXISTS `webchat_sessions` (
  `id` VARCHAR(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tenant_id` VARCHAR(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `widget_id` VARCHAR(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `channel_connection_id` VARCHAR(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `visitor_id` VARCHAR(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `contact_identity_id` VARCHAR(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `conversation_id` VARCHAR(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `token_hash` VARCHAR(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` ENUM('active','closed','expired') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `expires_at` DATETIME DEFAULT NULL,
  `last_seen_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_webchat_session_token` (`token_hash`),
  UNIQUE KEY `uk_webchat_session_visitor` (`widget_id`,`visitor_id`),
  KEY `idx_webchat_session_tenant` (`tenant_id`),
  KEY `idx_webchat_session_conversation` (`conversation_id`),
  KEY `idx_webchat_session_widget` (`widget_id`),
  CONSTRAINT `fk_webchat_session_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_webchat_session_widget` FOREIGN KEY (`widget_id`) REFERENCES `webchat_widgets` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_webchat_session_channel` FOREIGN KEY (`channel_connection_id`) REFERENCES `channel_connections` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
