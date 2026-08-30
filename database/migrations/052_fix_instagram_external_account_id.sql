-- Migration 052: Correct Instagram channel external_account_id to use instagram_business_account_id/ig_user_id.

UPDATE `channel_connections` cc
JOIN `instagram_accounts` ia ON ia.tenant_id = cc.tenant_id
SET cc.external_account_id = COALESCE(ia.instagram_business_account_id, ia.ig_user_id)
WHERE cc.provider = 'instagram'
  AND cc.external_account_id != COALESCE(ia.instagram_business_account_id, ia.ig_user_id);
