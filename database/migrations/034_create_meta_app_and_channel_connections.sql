-- Migration 034: Create meta_app_connections and channel_connections (Meta Integration V3)
-- Model: Tenant -> meta_app_connections -> channel_connections (WhatsApp, Instagram, Messenger)

CREATE TABLE IF NOT EXISTS `meta_app_connections` (
  `id` VARCHAR(36) NOT NULL,
  `public_id` VARCHAR(64) NOT NULL,
  `tenant_id` VARCHAR(36) NOT NULL,
  `created_by_user_id` VARCHAR(36) NOT NULL,
  `app_name` VARCHAR(255) NULL,
  `app_id` VARCHAR(100) NOT NULL,
  `app_secret_encrypted` TEXT NOT NULL,
  `webhook_verify_token_encrypted` TEXT NOT NULL,
  `graph_version` VARCHAR(20) NOT NULL DEFAULT 'v26.0',
  `status` ENUM('active', 'pending', 'degraded', 'reauth_required', 'disconnected') NOT NULL DEFAULT 'pending',
  `last_verified_at` DATETIME NULL,
  `last_error` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_meta_app_public_id` (`public_id`),
  UNIQUE KEY `uk_meta_app_tenant_app` (`tenant_id`, `app_id`),
  INDEX `idx_meta_app_tenant` (`tenant_id`),
  INDEX `idx_meta_app_created_by` (`created_by_user_id`),
  INDEX `idx_meta_app_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `channel_connections` (
  `id` VARCHAR(36) NOT NULL,
  `tenant_id` VARCHAR(36) NOT NULL,
  `meta_app_connection_id` VARCHAR(36) NULL,
  `provider` ENUM('whatsapp', 'instagram', 'messenger') NOT NULL,
  `status` ENUM('active', 'pending', 'degraded', 'reauth_required', 'disconnected') NOT NULL DEFAULT 'pending',
  `external_account_id` VARCHAR(255) NULL,
  `display_name` VARCHAR(255) NULL,
  `metadata` JSON NULL,
  `connected_at` DATETIME NULL,
  `disconnected_at` DATETIME NULL,
  `last_health_check_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_channel_provider_ext_acc` (`provider`, `external_account_id`),
  INDEX `idx_channel_conn_tenant` (`tenant_id`),
  INDEX `idx_channel_conn_meta_app` (`meta_app_connection_id`),
  INDEX `idx_channel_conn_provider` (`provider`),
  INDEX `idx_channel_conn_ext_acc` (`provider`, `external_account_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
