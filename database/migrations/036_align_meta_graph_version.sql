-- Ajusta o default do meta_graph_version para v26.0 nas tabelas que o possuem,
-- refletindo o padrão definido em AGENTS.md e evitando requisições a versões
-- obsoletas da Meta Graph API.
ALTER TABLE `platform_settings`
  MODIFY COLUMN `meta_graph_version` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'v26.0';

ALTER TABLE `profiles`
  MODIFY COLUMN `meta_graph_version` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'v26.0';
