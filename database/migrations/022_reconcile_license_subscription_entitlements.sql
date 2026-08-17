-- Reconcile the two historical entitlement mirrors without shortening valid access.
-- Explicit administrative blocks in licenses remain authoritative.

UPDATE subscriptions s
JOIN licenses l ON l.tenant_id = s.tenant_id
SET
  s.status = CASE
    WHEN LOWER(l.status) IN ('blocked', 'suspended') THEN 'suspended'
    WHEN LOWER(l.status) = 'cancelled' THEN 'cancelled'
    WHEN GREATEST(
      CASE WHEN LOWER(l.status) = 'active' THEN COALESCE(l.expires_at, '9999-12-31 23:59:59') ELSE '1000-01-01 00:00:00' END,
      COALESCE(s.current_period_end, s.expires_at),
      CASE WHEN s.status = 'past_due' THEN COALESCE(s.grace_period_ends_at, s.expires_at) ELSE s.expires_at END
    ) > NOW() THEN
      CASE
        WHEN s.status = 'past_due' AND s.grace_period_ends_at > NOW() THEN 'past_due'
        ELSE 'active'
      END
    ELSE 'suspended'
  END,
  s.expires_at = CASE
    WHEN LOWER(l.status) IN ('blocked', 'suspended', 'cancelled') THEN s.expires_at
    ELSE GREATEST(
      CASE WHEN LOWER(l.status) = 'active' THEN COALESCE(l.expires_at, '9999-12-31 23:59:59') ELSE '1000-01-01 00:00:00' END,
      COALESCE(s.current_period_end, s.expires_at),
      CASE WHEN s.status = 'past_due' THEN COALESCE(s.grace_period_ends_at, s.expires_at) ELSE s.expires_at END
    )
  END,
  s.current_period_end = CASE
    WHEN LOWER(l.status) IN ('blocked', 'suspended', 'cancelled') THEN s.current_period_end
    ELSE GREATEST(
      CASE WHEN LOWER(l.status) = 'active' THEN COALESCE(l.expires_at, '9999-12-31 23:59:59') ELSE '1000-01-01 00:00:00' END,
      COALESCE(s.current_period_end, s.expires_at),
      CASE WHEN s.status = 'past_due' THEN COALESCE(s.grace_period_ends_at, s.expires_at) ELSE s.expires_at END
    )
  END,
  s.updated_at = NOW();

UPDATE licenses l
JOIN subscriptions s ON s.tenant_id = l.tenant_id
SET
  l.status = CASE
    WHEN LOWER(l.status) IN ('blocked', 'suspended', 'cancelled') THEN l.status
    WHEN s.status IN ('active', 'trial', 'expiring', 'past_due')
      AND COALESCE(s.current_period_end, s.expires_at) > NOW() THEN 'active'
    ELSE 'expired'
  END,
  l.expires_at = CASE
    WHEN LOWER(l.status) IN ('blocked', 'suspended', 'cancelled') THEN l.expires_at
    ELSE COALESCE(s.current_period_end, s.expires_at, l.expires_at)
  END;
