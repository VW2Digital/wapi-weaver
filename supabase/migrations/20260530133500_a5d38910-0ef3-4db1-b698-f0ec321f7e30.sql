-- Fix webhook_events policy conflict: drop blanket deny so the user-scoped SELECT policy is the single source of truth.
DROP POLICY IF EXISTS webhook_events_no_access ON public.webhook_events;

-- Explicit deny for writes from anon/authenticated (server only via service role).
CREATE POLICY webhook_events_no_insert ON public.webhook_events
  AS RESTRICTIVE FOR INSERT TO anon, authenticated WITH CHECK (false);
CREATE POLICY webhook_events_no_update ON public.webhook_events
  AS RESTRICTIVE FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY webhook_events_no_delete ON public.webhook_events
  AS RESTRICTIVE FOR DELETE TO anon, authenticated USING (false);

-- Restrict avatars bucket listing: only owners can list their own avatar objects.
-- Public read of individual objects still works via direct URL since bucket is public.
DROP POLICY IF EXISTS "Avatars are publicly listable" ON storage.objects;
CREATE POLICY "Users can list their own avatars"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
