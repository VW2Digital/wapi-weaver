-- Add Instagram Messaging API Tables

CREATE TABLE IF NOT EXISTS instagram_accounts (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  ig_user_id VARCHAR(255) NOT NULL,
  page_id VARCHAR(255) NOT NULL,
  page_access_token TEXT NOT NULL,
  page_access_token_expires_at DATETIME NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  app_secret TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_instagram_accounts_tenant (tenant_id),
  UNIQUE KEY uq_instagram_accounts_ig_user (ig_user_id),
  CONSTRAINT fk_instagram_accounts_tenant FOREIGN KEY (tenant_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS instagram_webhook_events (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  event_id VARCHAR(255) NULL,
  event_type VARCHAR(100) NULL,
  raw JSON NOT NULL,
  payload JSON NULL,
  processed BOOLEAN NOT NULL DEFAULT 0,
  processed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_instagram_webhook_event_id (event_id),
  CONSTRAINT fk_instagram_webhook_events_tenant FOREIGN KEY (tenant_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE direct_messages MODIFY COLUMN channel VARCHAR(50) NOT NULL DEFAULT 'whatsapp';
ALTER TABLE bot_settings MODIFY COLUMN channel ENUM('whatsapp', 'instagram', 'messenger') NOT NULL DEFAULT 'whatsapp';
ALTER TABLE contacts MODIFY COLUMN channel VARCHAR(50) NOT NULL DEFAULT 'whatsapp';
ALTER TABLE bot_flows MODIFY COLUMN channel VARCHAR(50) NOT NULL DEFAULT 'whatsapp';
ALTER TABLE chat_message_outbox MODIFY COLUMN channel VARCHAR(50) NOT NULL DEFAULT 'whatsapp';
