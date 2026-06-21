-- MySQL Database Schema for wapi-weaver

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS profiles (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  email VARCHAR(255) NULL,
  full_name VARCHAR(255) NULL,
  avatar_url TEXT NULL,
  display_name VARCHAR(255) NULL,
  phone VARCHAR(50) NULL,
  company_name VARCHAR(255) NULL,
  company_document VARCHAR(100) NULL,
  company_address TEXT NULL,
  company_website VARCHAR(255) NULL,
  rate_limit_per_second INT NOT NULL DEFAULT 10,
  whatsapp_verify_token VARCHAR(255) NULL,
  whatsapp_access_token TEXT NULL,
  whatsapp_phone_number_id VARCHAR(100) NULL,
  whatsapp_waba_id VARCHAR(100) NULL,
  whatsapp_business_id VARCHAR(100) NULL,
  whatsapp_business_phone VARCHAR(50) NULL,
  whatsapp_app_secret TEXT NULL,
  meta_graph_version VARCHAR(50) NOT NULL DEFAULT 'v20.0',
  salvy_api_key TEXT NULL,
  api_key TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_roles (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  role ENUM('admin', 'user') NOT NULL DEFAULT 'user',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_roles (user_id, role),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS platform_settings (
  id INT NOT NULL PRIMARY KEY DEFAULT 1,
  meta_app_id VARCHAR(255) NULL,
  meta_app_secret TEXT NULL,
  meta_config_id VARCHAR(255) NULL,
  meta_graph_version VARCHAR(50) NOT NULL DEFAULT 'v20.0',
  cron_secret TEXT NULL,
  head_tags TEXT NULL,
  body_tags TEXT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by VARCHAR(36) NULL,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(36) NULL,
  action VARCHAR(255) NOT NULL,
  entity_type VARCHAR(100) NULL,
  entity_id VARCHAR(100) NULL,
  actor_email VARCHAR(255) NULL,
  ip VARCHAR(50) NULL,
  user_agent TEXT NULL,
  metadata JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS schema_backups (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  created_by VARCHAR(36) NULL,
  source VARCHAR(255) NOT NULL,
  `sql` LONGTEXT NOT NULL,
  size_bytes INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS salvy_numbers (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  salvy_id VARCHAR(100) NOT NULL,
  phone_number VARCHAR(50) NOT NULL,
  area_code INT NULL,
  name VARCHAR(255) NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  cost_center VARCHAR(255) NULL,
  cancel_reason TEXT NULL,
  created_at_remote DATETIME NULL,
  canceled_at DATETIME NULL,
  raw JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_salvy (user_id, salvy_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tags (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  color VARCHAR(50) NOT NULL DEFAULT '#8B5CF6',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_tag (user_id, name),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS contacts (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  phone_e164 VARCHAR(50) NOT NULL,
  name VARCHAR(255) NULL,
  email VARCHAR(255) NULL,
  source VARCHAR(255) NULL,
  opted_out BOOLEAN NOT NULL DEFAULT false,
  custom_fields JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_contact (user_id, phone_e164),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS contact_tags (
  contact_id VARCHAR(36) NOT NULL,
  tag_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  PRIMARY KEY (contact_id, tag_id),
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS lists (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS list_contacts (
  list_id VARCHAR(36) NOT NULL,
  contact_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  added_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (list_id, contact_id),
  FOREIGN KEY (list_id) REFERENCES lists(id) ON DELETE CASCADE,
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS templates (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  language VARCHAR(50) NOT NULL,
  category VARCHAR(50) NULL,
  status ENUM('APPROVED', 'PENDING', 'REJECTED', 'PAUSED', 'DISABLED') NOT NULL DEFAULT 'PENDING',
  components JSON NULL,
  meta_template_id VARCHAR(255) NULL,
  synced_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_template (user_id, name, language),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS campaigns (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  list_id VARCHAR(36) NULL,
  template_id VARCHAR(36) NULL,
  message_type ENUM('template', 'text', 'media', 'interactive') NOT NULL,
  status ENUM('draft', 'queued', 'running', 'done', 'failed', 'cancelled') NOT NULL DEFAULT 'draft',
  payload JSON NULL,
  totals JSON NULL,
  scheduled_at DATETIME NULL,
  started_at DATETIME NULL,
  finished_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (list_id) REFERENCES lists(id) ON DELETE SET NULL,
  FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS campaign_messages (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  campaign_id VARCHAR(36) NOT NULL,
  contact_id VARCHAR(36) NULL,
  to_phone VARCHAR(50) NOT NULL,
  status ENUM('pending', 'sending', 'sent', 'delivered', 'read', 'failed') NOT NULL DEFAULT 'pending',
  wa_message_id VARCHAR(255) NULL,
  conversation_id VARCHAR(255) NULL,
  conversation_origin VARCHAR(255) NULL,
  pricing_billable BOOLEAN NULL,
  pricing_category VARCHAR(50) NULL,
  pricing_model VARCHAR(50) NULL,
  sent_at DATETIME NULL,
  delivered_at DATETIME NULL,
  read_at DATETIME NULL,
  failed_at DATETIME NULL,
  error JSON NULL,
  attempts INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS webhook_events (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(36) NULL,
  source VARCHAR(100) NOT NULL,
  raw JSON NOT NULL,
  processed BOOLEAN NOT NULL DEFAULT false,
  received_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS direct_messages (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  contact_phone VARCHAR(50) NOT NULL,
  direction ENUM('incoming', 'outgoing') NOT NULL,
  type ENUM('text', 'reaction', 'image') NOT NULL DEFAULT 'text',
  body TEXT NOT NULL,
  wa_message_id VARCHAR(255) NULL,
  status ENUM('sent', 'delivered', 'read', 'failed') DEFAULT 'sent',
  reply_to_message_id VARCHAR(255) NULL,
  metadata JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Optimization Indexes
CREATE INDEX idx_campaign_messages_wa_msg ON campaign_messages(wa_message_id);
CREATE INDEX idx_campaign_messages_camp_status ON campaign_messages(campaign_id, status);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX idx_webhook_events_processed ON webhook_events(processed, received_at);
CREATE INDEX idx_contacts_user_opted ON contacts(user_id, opted_out);
CREATE INDEX idx_direct_messages_user_phone ON direct_messages(user_id, contact_phone);
CREATE INDEX idx_direct_messages_wa_id ON direct_messages(wa_message_id);


