ALTER TABLE public.campaign_messages
  ADD COLUMN IF NOT EXISTS pricing_billable boolean,
  ADD COLUMN IF NOT EXISTS pricing_category text,
  ADD COLUMN IF NOT EXISTS pricing_model text,
  ADD COLUMN IF NOT EXISTS conversation_id text,
  ADD COLUMN IF NOT EXISTS conversation_origin text;

CREATE INDEX IF NOT EXISTS idx_campaign_messages_billing
  ON public.campaign_messages (user_id, created_at DESC, pricing_category);