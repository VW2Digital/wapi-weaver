-- Migration 007: Restore active runtime tables missing from canonical schema
-- Restores notifications, schema_backups, and webhook_bot_logs

CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  action_url VARCHAR(255) NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  unique_key VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read_at DATETIME NULL,
  UNIQUE KEY uq_notifications_unique_key (unique_key),
  INDEX idx_notifications_tenant (tenant_id),
  INDEX idx_notifications_user (user_id),
  FOREIGN KEY (tenant_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS schema_backups (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  created_by VARCHAR(36) NULL,
  source VARCHAR(255) NOT NULL,
  sql LONGTEXT NOT NULL,
  size_bytes INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_schema_backups_created_by (created_by),
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS webhook_bot_logs (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  flow_id VARCHAR(36) NOT NULL,
  flow_name VARCHAR(255) NOT NULL,
  contact_id VARCHAR(36) NOT NULL,
  is_match BOOLEAN NOT NULL DEFAULT FALSE,
  raw_conditions JSON NOT NULL,
  raw_payload JSON NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_wbl_tenant_contact (tenant_id, contact_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
