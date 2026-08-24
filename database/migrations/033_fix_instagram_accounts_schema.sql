-- Correção do schema das tabelas do Instagram para corresponder ao código (profile.functions.ts e instagram-webhook.ts)

DROP TABLE IF EXISTS instagram_accounts;

CREATE TABLE instagram_accounts (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  ig_user_id VARCHAR(255) NOT NULL,
  username VARCHAR(255) NOT NULL,
  access_token TEXT NOT NULL,
  app_id VARCHAR(255) NULL,
  app_secret TEXT NULL,
  token_expires_at VARCHAR(100) NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_instagram_accounts_user (user_id),
  UNIQUE KEY uq_instagram_accounts_ig_user (ig_user_id),
  CONSTRAINT fk_instagram_accounts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Atualizando instagram_webhook_events para usar user_id
ALTER TABLE instagram_webhook_events DROP FOREIGN KEY fk_instagram_webhook_events_tenant;
ALTER TABLE instagram_webhook_events CHANGE tenant_id user_id VARCHAR(36) NOT NULL;
ALTER TABLE instagram_webhook_events ADD CONSTRAINT fk_instagram_webhook_events_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
