-- Persist per-contact facts and a short summary for DS Agente replies.

CREATE TABLE IF NOT EXISTS `ds_agent_contact_memory` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `agent_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `contact_phone` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `facts` text COLLATE utf8mb4_unicode_ci,
  `conversation_summary` text COLLATE utf8mb4_unicode_ci,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_ds_agent_contact_memory` (`tenant_id`,`agent_id`,`contact_phone`),
  KEY `idx_ds_mem_agent` (`agent_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
