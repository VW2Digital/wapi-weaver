-- Migration 051: Promote Meta App connections to active when credentials exist.

UPDATE `meta_app_connections`
SET status = 'active'
WHERE status = 'pending'
  AND app_id IS NOT NULL
  AND app_id != ''
  AND app_secret_encrypted IS NOT NULL
  AND app_secret_encrypted != '';
