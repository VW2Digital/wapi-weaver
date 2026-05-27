
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS salvy_api_key text;

CREATE TABLE IF NOT EXISTS public.salvy_numbers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  salvy_id text NOT NULL,
  phone_number text NOT NULL,
  area_code integer,
  name text,
  status text NOT NULL DEFAULT 'pending',
  cost_center text,
  cancel_reason text,
  created_at_remote timestamptz,
  canceled_at timestamptz,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, salvy_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.salvy_numbers TO authenticated;
GRANT ALL ON public.salvy_numbers TO service_role;

ALTER TABLE public.salvy_numbers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "salvy_numbers_all_own" ON public.salvy_numbers
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER salvy_numbers_set_updated_at
  BEFORE UPDATE ON public.salvy_numbers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_salvy_numbers_user ON public.salvy_numbers(user_id);
