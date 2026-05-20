
alter table public.profiles
  add column if not exists whatsapp_access_token text,
  add column if not exists whatsapp_app_secret text,
  add column if not exists whatsapp_verify_token text;
