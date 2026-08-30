-- Migration 047: Backfill deterministic Instagram channel_connection from instagram_accounts
-- Only creates when: one active account, external_account_id present, meta_app exists for tenant.

SET @ig_count := (SELECT COUNT(*) FROM instagram_accounts WHERE is_active = 1);
SET @meta_app_id := (SELECT id FROM meta_app_connections WHERE status = 'active' OR status = 'pending' LIMIT 1);
SET @tenant_id := (SELECT tenant_id FROM instagram_accounts WHERE is_active = 1 LIMIT 1);
SET @ig_user_id := (SELECT ig_user_id FROM instagram_accounts WHERE is_active = 1 LIMIT 1);

SET @create_ig := IF(@ig_count = 1 AND @ig_user_id IS NOT NULL,
  'INSERT IGNORE INTO channel_connections
    (id, tenant_id, meta_app_connection_id, provider, status, external_account_id, display_name, access_token_encrypted, created_at, updated_at)
   VALUES (UUID(), @tenant_id, @meta_app_id, "instagram", "active", @ig_user_id,
           CONCAT("Instagram (", @ig_user_id, ")"),
           (SELECT access_token FROM instagram_accounts WHERE is_active = 1 LIMIT 1),
           NOW(), NOW())',
  'SELECT 1;');

PREPARE stmt FROM @create_ig;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
