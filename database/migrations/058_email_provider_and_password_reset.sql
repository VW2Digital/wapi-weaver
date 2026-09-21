-- Migration: 058_email_provider_and_password_reset.sql
-- Resend (plataforma) + tokens de recuperação de senha.

CREATE TABLE IF NOT EXISTS `email_provider_settings` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'global',
  `provider` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'resend',
  `api_key_encrypted` text COLLATE utf8mb4_unicode_ci,
  `from_email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `from_name` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reply_to` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_email_provider_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `password_reset_tokens` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `token_hash` char(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `expires_at` datetime NOT NULL,
  `used_at` datetime DEFAULT NULL,
  `requested_ip` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_password_reset_token_hash` (`token_hash`),
  KEY `idx_password_reset_user` (`user_id`),
  KEY `idx_password_reset_tenant` (`tenant_id`),
  CONSTRAINT `fk_password_reset_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
