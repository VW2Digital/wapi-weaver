-- Preserve the Facebook User token from the existing Instagram OAuth flow.
-- Instagram Direct continues using its Page token from channel_connections.
-- Public Content reuses this encrypted User token without a second OAuth flow.

SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'instagram_accounts'
    AND column_name = 'facebook_user_access_token_encrypted'
);
SET @add_col := IF(
  @col_exists = 0,
  'ALTER TABLE `instagram_accounts` ADD COLUMN `facebook_user_access_token_encrypted` text NULL AFTER `access_token`',
  'SELECT 1'
);
PREPARE stmt FROM @add_col;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
