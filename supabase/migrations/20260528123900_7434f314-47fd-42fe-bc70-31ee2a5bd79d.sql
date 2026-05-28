
ALTER TABLE public.webhook_events ADD COLUMN IF NOT EXISTS user_id uuid;
CREATE INDEX IF NOT EXISTS webhook_events_user_id_received_at_idx ON public.webhook_events (user_id, received_at DESC);

GRANT SELECT ON public.webhook_events TO authenticated;

DROP POLICY IF EXISTS webhook_events_select_own ON public.webhook_events;
CREATE POLICY webhook_events_select_own
  ON public.webhook_events
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
