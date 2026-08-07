-- 002_fix_indexes_and_constraints.sql
-- Ajustes defensivos de índices e integridade referencial

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Deduplicação e índice de integridade de user_roles
DELETE ur1 FROM user_roles ur1
JOIN user_roles ur2 ON ur1.user_id = ur2.user_id
WHERE ur1.id > ur2.id;

-- 2. Normalizar mensagens de campanha antigas sem status
UPDATE campaign_messages SET status = 'pending' WHERE status IS NULL OR status = '';

-- 3. Limpeza de registros de licença duplicados sem tenant_id
DELETE FROM licenses WHERE tenant_id IS NULL AND id NOT IN (SELECT MIN(id) FROM licenses GROUP BY client_email);

SET FOREIGN_KEY_CHECKS = 1;
