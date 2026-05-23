GRANT EXECUTE ON FUNCTION public.export_schema_sql_internal() TO service_role;
GRANT EXECUTE ON FUNCTION public.create_schema_backup(text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.cron_create_schema_backup() TO service_role;