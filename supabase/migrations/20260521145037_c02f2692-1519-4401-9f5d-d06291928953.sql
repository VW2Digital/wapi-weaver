ALTER TABLE public.platform_settings
ADD COLUMN IF NOT EXISTS head_tags text,
ADD COLUMN IF NOT EXISTS body_tags text;

-- Allow anyone (including anon) to read only the tracking tags (head/body)
-- so they can be injected into every page without exposing secrets.
CREATE OR REPLACE FUNCTION public.get_tracking_tags()
RETURNS TABLE(head_tags text, body_tags text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT head_tags, body_tags FROM public.platform_settings WHERE id = 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_tracking_tags() TO anon, authenticated;