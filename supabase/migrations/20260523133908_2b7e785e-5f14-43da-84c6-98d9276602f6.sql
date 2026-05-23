
-- 1) Bloquear privilege escalation em user_roles
-- Permissive policy só permite admins; adicionamos RESTRICTIVE para garantir
CREATE POLICY "user_roles_block_self_insert"
ON public.user_roles
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "user_roles_block_self_update"
ON public.user_roles
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "user_roles_block_self_delete"
ON public.user_roles
AS RESTRICTIVE
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 2) Restringir profiles a authenticated (não public/anon)
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;

CREATE POLICY profiles_select_own ON public.profiles
FOR SELECT TO authenticated
USING (auth.uid() = id);

CREATE POLICY profiles_insert_own ON public.profiles
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY profiles_update_own ON public.profiles
FOR UPDATE TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 3) audit_logs: garantir que ninguém via PostgREST possa escrever/alterar
-- Já não tem policies de INSERT/UPDATE/DELETE → negado por padrão.
-- Adicionar RESTRICTIVE explícita para defesa em profundidade.
CREATE POLICY audit_logs_no_write
ON public.audit_logs
AS RESTRICTIVE
FOR INSERT
TO authenticated, anon
WITH CHECK (false);

CREATE POLICY audit_logs_no_update
ON public.audit_logs
AS RESTRICTIVE
FOR UPDATE
TO authenticated, anon
USING (false);

CREATE POLICY audit_logs_no_delete
ON public.audit_logs
AS RESTRICTIVE
FOR DELETE
TO authenticated, anon
USING (false);

-- 4) Restringir schema_backups a authenticated (já está, mas garantir)
DROP POLICY IF EXISTS schema_backups_admin_select ON public.schema_backups;
DROP POLICY IF EXISTS schema_backups_admin_delete ON public.schema_backups;

CREATE POLICY schema_backups_admin_select ON public.schema_backups
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY schema_backups_admin_delete ON public.schema_backups
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 5) Revogar EXECUTE de funções SECURITY DEFINER internas para usuários autenticados/anon
REVOKE EXECUTE ON FUNCTION public.export_schema_sql_internal() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cron_create_schema_backup() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_schema_backup(text, uuid) FROM PUBLIC, anon, authenticated;

-- export_schema_sql() já verifica has_role internamente — manter executável para admin chamar via RPC
-- mas restringir a authenticated apenas
REVOKE EXECUTE ON FUNCTION public.export_schema_sql() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.export_schema_sql() TO authenticated;
