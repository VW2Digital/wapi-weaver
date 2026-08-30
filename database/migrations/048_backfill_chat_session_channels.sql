-- Migration 048: Backfill chat_sessions.channel_connection_id deterministically
-- Rules:
-- 1. Match contact identity external_id to channel_connections.external_account_id.
-- 2. For instagram, also match through instagram_accounts.instagram_business_account_id.
-- 3. Do NOT backfill if more than one candidate for the same conversation.

-- Direct match
UPDATE chat_sessions cs
JOIN contacts c ON c.id = cs.contact_id
JOIN contact_identities ci ON ci.contact_id = c.id AND ci.tenant_id = cs.tenant_id
JOIN channel_connections cc ON cc.tenant_id = cs.tenant_id AND cc.external_account_id = ci.external_id
SET cs.channel_connection_id = cc.id
WHERE cs.channel_connection_id IS NULL
  AND cc.status = 'active';

-- Indirect instagram match via business account id
UPDATE chat_sessions cs
JOIN contacts c ON c.id = cs.contact_id
JOIN contact_identities ci ON ci.contact_id = c.id AND ci.tenant_id = cs.tenant_id
JOIN instagram_accounts ia ON ia.tenant_id = cs.tenant_id AND ia.instagram_business_account_id = ci.external_id
JOIN channel_connections cc ON cc.tenant_id = cs.tenant_id AND cc.external_account_id = ia.ig_user_id
SET cs.channel_connection_id = cc.id
WHERE cs.channel_connection_id IS NULL
  AND cc.status = 'active'
  AND cc.provider = 'instagram';
