# MIGRATION LOG — Remoção do Módulo AI Agent Legado & Transição para DS Agente

**Data/Hora da Remoção:** 2026-07-31

---

## 1. Arquivos Legados Mapeados e Removidos

- `src/routes/_app/ai-agent.tsx` (Rota e UI do módulo antigo de AI Agent)
- `src/lib/ai-agent.server.ts` (Execução server-side da integração com Gemini antiga)
- `src/lib/ai-agent.functions.ts` (Server functions para ler/salvar `ai_agent_settings` e `knowledge_base`)

---

## 2. Tabelas MySQL Legadas Droppadas / Desativadas

- `ai_agent_settings` (Tabela que armazenava `instance_id`, `is_active`, `api_key`, `model`, `system_prompt`)
- `knowledge_base` (Tabela que armazenava `title`, `content` associados a `ai_agent_settings_id`)

---

## 3. Dump Lógico do Schema Legado (Backup de Referência)

```sql
-- Backup das estruturas antigas droppadas em 2026-07-31
CREATE TABLE IF NOT EXISTS `ai_agent_settings` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `user_id` VARCHAR(36) NOT NULL,
  `instance_id` VARCHAR(100) NOT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 0,
  `api_key` TEXT NULL,
  `model` VARCHAR(100) NOT NULL DEFAULT 'gemini-2.5-flash',
  `system_prompt` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `knowledge_base` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `user_id` VARCHAR(36) NOT NULL,
  `ai_agent_settings_id` VARCHAR(36) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `content` LONGTEXT NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`ai_agent_settings_id`) REFERENCES `ai_agent_settings`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## 4. Atualizações de Rota no Projeto

- Rota de navegação em `src/routes/_app.tsx`: alterada de `/ai-agent` para `/ds-agente`.
- As novas rotas serão criadas em `src/routes/_app/ds-agente/index.tsx` e `src/routes/_app/ds-agente/$agentId.tsx`.
