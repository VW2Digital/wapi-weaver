
REVOKE EXECUTE ON FUNCTION public.export_schema_sql() FROM authenticated, anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.export_schema_sql() TO service_role;
