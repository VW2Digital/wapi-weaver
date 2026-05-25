
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS meta_graph_version text NOT NULL DEFAULT 'v20.0';
CREATE INDEX IF NOT EXISTS idx_webhook_events_received_at ON public.webhook_events(received_at);
CREATE INDEX IF NOT EXISTS idx_campaign_messages_status_updated ON public.campaign_messages(status, sent_at);
