
-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Tabela de histórico
CREATE TABLE IF NOT EXISTS public.schema_backups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'auto', -- 'auto' | 'manual'
  size_bytes integer NOT NULL DEFAULT 0,
  sql text NOT NULL,
  created_by uuid
);

CREATE INDEX IF NOT EXISTS idx_schema_backups_created_at
  ON public.schema_backups (created_at DESC);

ALTER TABLE public.schema_backups ENABLE ROW LEVEL SECURITY;

-- Apenas admins podem listar/ler. Inserções/limpeza ocorrem via funções SECURITY DEFINER chamadas pelo backend.
DROP POLICY IF EXISTS schema_backups_admin_select ON public.schema_backups;
CREATE POLICY schema_backups_admin_select
  ON public.schema_backups FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS schema_backups_admin_delete ON public.schema_backups;
CREATE POLICY schema_backups_admin_delete
  ON public.schema_backups FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Função para criar um backup (usa export_schema_sql() já existente).
-- Retorna o id do backup criado. Mantém apenas as 30 versões mais recentes.
CREATE OR REPLACE FUNCTION public.create_schema_backup(_source text DEFAULT 'auto', _user uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $func$
DECLARE
  dump text;
  new_id uuid;
BEGIN
  -- Gera o dump (a função export_schema_sql exige admin; aqui contornamos por se rodar via cron/service_role)
  -- Por isso replicamos a chamada interna como SECURITY DEFINER e pulamos o has_role quando _user é NULL (cron).
  IF _user IS NOT NULL AND NOT public.has_role(_user, 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Chama a função existente como superuser deste DEFINER
  EXECUTE 'SELECT public.export_schema_sql_internal()' INTO dump;

  INSERT INTO public.schema_backups (source, size_bytes, sql, created_by)
  VALUES (COALESCE(_source, 'auto'), COALESCE(length(dump), 0), COALESCE(dump, ''), _user)
  RETURNING id INTO new_id;

  -- Mantém apenas as 30 versões mais recentes
  DELETE FROM public.schema_backups
   WHERE id IN (
     SELECT id FROM public.schema_backups
      ORDER BY created_at DESC OFFSET 30
   );

  RETURN new_id;
END;
$func$;

REVOKE ALL ON FUNCTION public.create_schema_backup(text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_schema_backup(text, uuid) TO service_role;

-- Versão interna do dump (sem o gate has_role) usada APENAS por create_schema_backup acima.
-- Mantém o mesmo conteúdo do export_schema_sql() público.
CREATE OR REPLACE FUNCTION public.export_schema_sql_internal()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $func$
DECLARE
  out_sql text := '';
  r record;
  cols text;
  pk text;
  policy_cmd text;
BEGIN
  out_sql := '-- Schema dump (public) gerado em ' || now()::text || E'\n';
  out_sql := out_sql || E'-- Apenas DDL. Não inclui dados.\n\n';

  out_sql := out_sql || E'-- =====================\n-- ENUMS\n-- =====================\n';
  FOR r IN
    SELECT n.nspname, t.typname,
           string_agg(quote_literal(e.enumlabel), ', ' ORDER BY e.enumsortorder) AS labels
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
    GROUP BY n.nspname, t.typname
    ORDER BY t.typname
  LOOP
    out_sql := out_sql || format(E'CREATE TYPE %I.%I AS ENUM (%s);\n', r.nspname, r.typname, r.labels);
  END LOOP;
  out_sql := out_sql || E'\n';

  out_sql := out_sql || E'-- =====================\n-- TABELAS\n-- =====================\n';
  FOR r IN
    SELECT c.oid, c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
    ORDER BY c.relname
  LOOP
    SELECT string_agg(
      format('  %I %s%s%s',
        a.attname,
        format_type(a.atttypid, a.atttypmod),
        CASE WHEN a.attnotnull THEN ' NOT NULL' ELSE '' END,
        CASE WHEN ad.adbin IS NOT NULL
             THEN ' DEFAULT ' || pg_get_expr(ad.adbin, ad.adrelid)
             ELSE '' END
      ), E',\n' ORDER BY a.attnum
    )
    INTO cols
    FROM pg_attribute a
    LEFT JOIN pg_attrdef ad ON ad.adrelid = a.attrelid AND ad.adnum = a.attnum
    WHERE a.attrelid = r.oid AND a.attnum > 0 AND NOT a.attisdropped;

    SELECT format(',\n  CONSTRAINT %I PRIMARY KEY (%s)',
      con.conname,
      (SELECT string_agg(quote_ident(att.attname), ', ' ORDER BY array_position(con.conkey, att.attnum))
         FROM pg_attribute att
        WHERE att.attrelid = r.oid AND att.attnum = ANY(con.conkey)))
    INTO pk
    FROM pg_constraint con
    WHERE con.conrelid = r.oid AND con.contype = 'p'
    LIMIT 1;

    out_sql := out_sql || format(E'\nCREATE TABLE public.%I (\n%s%s\n);\n',
      r.relname, cols, COALESCE(pk, ''));
  END LOOP;

  out_sql := out_sql || E'\n-- =====================\n-- CONSTRAINTS (FK/UNIQUE/CHECK)\n-- =====================\n';
  FOR r IN
    SELECT c.relname AS table_name, con.conname,
           pg_get_constraintdef(con.oid) AS def
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND con.contype IN ('f','u','c')
    ORDER BY c.relname, con.conname
  LOOP
    out_sql := out_sql || format(E'ALTER TABLE public.%I ADD CONSTRAINT %I %s;\n',
      r.table_name, r.conname, r.def);
  END LOOP;

  out_sql := out_sql || E'\n-- =====================\n-- ÍNDICES\n-- =====================\n';
  FOR r IN
    SELECT indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname NOT IN (SELECT conname FROM pg_constraint WHERE contype IN ('p','u'))
    ORDER BY tablename, indexname
  LOOP
    out_sql := out_sql || r.indexdef || E';\n';
  END LOOP;

  out_sql := out_sql || E'\n-- =====================\n-- ROW LEVEL SECURITY\n-- =====================\n';
  FOR r IN
    SELECT c.relname FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity
    ORDER BY c.relname
  LOOP
    out_sql := out_sql || format(E'ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;\n', r.relname);
  END LOOP;

  out_sql := out_sql || E'\n-- Policies\n';
  FOR r IN
    SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
    FROM pg_policies WHERE schemaname='public' ORDER BY tablename, policyname
  LOOP
    policy_cmd := format('CREATE POLICY %I ON public.%I AS %s FOR %s TO %s',
      r.policyname, r.tablename, COALESCE(r.permissive,'PERMISSIVE'),
      r.cmd, array_to_string(r.roles, ', '));
    IF r.qual IS NOT NULL THEN policy_cmd := policy_cmd || ' USING (' || r.qual || ')'; END IF;
    IF r.with_check IS NOT NULL THEN policy_cmd := policy_cmd || ' WITH CHECK (' || r.with_check || ')'; END IF;
    out_sql := out_sql || policy_cmd || E';\n';
  END LOOP;

  out_sql := out_sql || E'\n-- =====================\n-- FUNÇÕES\n-- =====================\n';
  FOR r IN
    SELECT pg_get_functiondef(p.oid) AS def
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname='public' AND p.prokind='f' ORDER BY p.proname
  LOOP
    out_sql := out_sql || r.def || E';\n\n';
  END LOOP;

  out_sql := out_sql || E'-- =====================\n-- TRIGGERS\n-- =====================\n';
  FOR r IN
    SELECT pg_get_triggerdef(t.oid) AS def
    FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname='public' AND NOT t.tgisinternal
    ORDER BY c.relname, t.tgname
  LOOP
    out_sql := out_sql || r.def || E';\n';
  END LOOP;

  RETURN out_sql;
END;
$func$;

REVOKE ALL ON FUNCTION public.export_schema_sql_internal() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.export_schema_sql_internal() TO service_role;

-- Wrapper SQL para a rotina cron (não precisa de service_role no statement, pois o cron roda como superuser)
CREATE OR REPLACE FUNCTION public.cron_create_schema_backup()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $func$
BEGIN
  PERFORM public.create_schema_backup('auto', NULL);
END;
$func$;

REVOKE ALL ON FUNCTION public.cron_create_schema_backup() FROM PUBLIC, anon, authenticated;

-- Agenda: backup diário às 03:00 UTC
SELECT cron.unschedule('schema-backup-daily') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='schema-backup-daily');
SELECT cron.schedule('schema-backup-daily', '0 3 * * *', $$SELECT public.cron_create_schema_backup();$$);
