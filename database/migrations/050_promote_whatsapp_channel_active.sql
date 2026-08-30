-- Migration 050: Promote WhatsApp channel to active if credentials are present.
-- This is a one-time health promotion, not a manual status hack.
-- Conditions: channel is pending, provider is whatsapp, linked to active Meta App, and has encrypted access token.

UPDATE `channel_connections` cc
JOIN `meta_app_connections` mac ON mac.id = cc.meta_app_connection_id
SET cc.status = 'active'
WHERE cc.provider = 'whatsapp'
  AND cc.status = 'pending'
  AND cc.access_token_encrypted IS NOT NULL
  AND cc.access_token_encrypted != ''
  AND mac.status = 'active';
