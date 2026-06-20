CREATE TABLE public.direct_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_phone TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('incoming', 'outgoing')),
  type TEXT NOT NULL DEFAULT 'text' CHECK (type IN ('text', 'reaction', 'image')),
  body TEXT NOT NULL,
  wa_message_id TEXT,
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read', 'failed')),
  reply_to_message_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Habilita o RLS (Row Level Security)
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

-- Cria políticas de acesso
CREATE POLICY "Users can view their own direct messages"
  ON public.direct_messages FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own direct messages"
  ON public.direct_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own direct messages"
  ON public.direct_messages FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own direct messages"
  ON public.direct_messages FOR DELETE
  USING (auth.uid() = user_id);

-- Cria índices para acelerar buscas por contato e por wamid
CREATE INDEX idx_direct_messages_user_phone ON public.direct_messages(user_id, contact_phone);
CREATE INDEX idx_direct_messages_wa_id ON public.direct_messages(wa_message_id);
