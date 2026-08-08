-- 003_runtime_schema_alignment.sql
-- Migration de alinhamento de esquemas para a aplicação BLIV CRM / WAPI Weaver
-- NOTA: Arquivo em SQL puro, sem comandos DELIMITER ou procedimentos armazenados.

CREATE TABLE IF NOT EXISTS templates (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  language VARCHAR(10) NOT NULL DEFAULT 'pt_BR',
  category VARCHAR(50) NOT NULL DEFAULT 'MARKETING',
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  components JSON NULL,
  parameter_format VARCHAR(50) NULL,
  allow_category_change BOOLEAN NOT NULL DEFAULT TRUE,
  cta_url_link_tracking_opted_out BOOLEAN NOT NULL DEFAULT FALSE,
  message_send_ttl_seconds INT NULL,
  sub_category VARCHAR(100) NULL,
  display_format VARCHAR(100) NULL,
  is_primary_device_delivery_only BOOLEAN NOT NULL DEFAULT FALSE,
  meta_template_id VARCHAR(255) NULL,
  synced_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_templates_user_name_lang (user_id, name, language),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS bot_steps (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  flow_id VARCHAR(36) NULL,
  user_id VARCHAR(36) NULL,
  bot_settings_id VARCHAR(36) NULL,
  step_order INT NOT NULL DEFAULT 0,
  trigger_type VARCHAR(50) NULL,
  trigger_value VARCHAR(255) NULL,
  next_step_id VARCHAR(36) NULL,
  step_type VARCHAR(50) NULL,
  content JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE campaigns MODIFY COLUMN status VARCHAR(50) NOT NULL DEFAULT 'draft';

ALTER TABLE campaign_messages MODIFY COLUMN status VARCHAR(50) NOT NULL DEFAULT 'pending';
