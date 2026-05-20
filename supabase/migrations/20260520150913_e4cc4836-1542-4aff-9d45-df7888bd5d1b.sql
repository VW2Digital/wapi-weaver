
-- Fix search_path on set_updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin new.updated_at = now(); return new; end;
$$;

-- Lock down execution of internal trigger functions (only owner/service role can call directly)
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;

-- Explicit deny-all policy on webhook_events (service_role bypasses RLS anyway)
create policy "webhook_events_no_access" on public.webhook_events
  for all to anon, authenticated using (false) with check (false);
