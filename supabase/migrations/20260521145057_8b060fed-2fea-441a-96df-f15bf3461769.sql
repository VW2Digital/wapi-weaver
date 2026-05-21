REVOKE EXECUTE ON FUNCTION public.get_tracking_tags() FROM anon, authenticated, public;
DROP FUNCTION IF EXISTS public.get_tracking_tags();