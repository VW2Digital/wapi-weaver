-- Migration 053: Revert 052.
--
-- 052 set channel_connections.external_account_id for Instagram to the
-- instagram_business_account_id. That value is NOT a valid Graph node for
-- POST /{node}/messages: Meta answers 400 (#3) "Application does not have the
-- capability to make this API call", which broke Instagram outbound.
--
-- Proven by probing both nodes with the channel token:
--   POST /v26.0/<page_id>/messages                      -> 200 + message_id
--   POST /v26.0/<instagram_business_account_id>/messages -> 400 (#3)
--
-- For Instagram, external_account_id is the OUTBOUND SEND NODE (page_id).
-- Inbound resolves the channel through instagram_accounts.page_id.

UPDATE `channel_connections` cc
JOIN `instagram_accounts` ia ON ia.tenant_id = cc.tenant_id
SET cc.external_account_id = ia.page_id
WHERE cc.provider = 'instagram'
  AND ia.page_id IS NOT NULL
  AND cc.external_account_id <> ia.page_id;
