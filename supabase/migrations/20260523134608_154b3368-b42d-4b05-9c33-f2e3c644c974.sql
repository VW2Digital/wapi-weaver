
-- 1) Fix privilege escalation: restrictive policies should prevent self-role mutation
DROP POLICY IF EXISTS user_roles_block_self_insert ON public.user_roles;
DROP POLICY IF EXISTS user_roles_block_self_update ON public.user_roles;
DROP POLICY IF EXISTS user_roles_block_self_delete ON public.user_roles;

CREATE POLICY user_roles_block_self_insert ON public.user_roles
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (user_id <> auth.uid());

CREATE POLICY user_roles_block_self_update ON public.user_roles
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (user_id <> auth.uid())
  WITH CHECK (user_id <> auth.uid());

CREATE POLICY user_roles_block_self_delete ON public.user_roles
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (user_id <> auth.uid());

-- 2) Tighten policies on owner-scoped tables: target 'authenticated' instead of 'public'
DROP POLICY IF EXISTS contacts_all_own ON public.contacts;
CREATE POLICY contacts_all_own ON public.contacts
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS contact_tags_all_own ON public.contact_tags;
CREATE POLICY contact_tags_all_own ON public.contact_tags
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS lists_all_own ON public.lists;
CREATE POLICY lists_all_own ON public.lists
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS list_contacts_all_own ON public.list_contacts;
CREATE POLICY list_contacts_all_own ON public.list_contacts
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS cm_select_own ON public.campaign_messages;
CREATE POLICY cm_select_own ON public.campaign_messages
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS templates_all_own ON public.templates;
CREATE POLICY templates_all_own ON public.templates
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS campaigns_all_own ON public.campaigns;
CREATE POLICY campaigns_all_own ON public.campaigns
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS tags_all_own ON public.tags;
CREATE POLICY tags_all_own ON public.tags
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 3) schema_backups: add admin INSERT policy (writes currently rely on SECURITY DEFINER,
--    but adding an explicit policy removes ambiguity for the scanner and future direct writes)
CREATE POLICY schema_backups_admin_insert ON public.schema_backups
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 4) Revoke EXECUTE on admin-only SECURITY DEFINER function from authenticated.
--    The app calls export_schema_sql_internal via the service_role server function instead.
REVOKE EXECUTE ON FUNCTION public.export_schema_sql() FROM authenticated, anon, public;
