-- Migration 030: Idempotent tenant_id alignment and backfill
-- Ensures all multi-tenant entity records have valid tenant_id matching user_id

UPDATE lists SET tenant_id = user_id WHERE (tenant_id IS NULL OR tenant_id = '') AND user_id IS NOT NULL;
UPDATE tags SET tenant_id = user_id WHERE (tenant_id IS NULL OR tenant_id = '') AND user_id IS NOT NULL;
UPDATE list_contacts SET tenant_id = user_id WHERE (tenant_id IS NULL OR tenant_id = '') AND user_id IS NOT NULL;
UPDATE contacts SET tenant_id = user_id WHERE (tenant_id IS NULL OR tenant_id = '') AND user_id IS NOT NULL;
UPDATE campaigns SET tenant_id = user_id WHERE (tenant_id IS NULL OR tenant_id = '') AND user_id IS NOT NULL;
UPDATE templates SET tenant_id = user_id WHERE (tenant_id IS NULL OR tenant_id = '') AND user_id IS NOT NULL;
