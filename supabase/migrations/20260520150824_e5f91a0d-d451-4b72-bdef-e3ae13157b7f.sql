
-- =========== ENUMS ===========
create type public.message_type as enum ('template','text','media','interactive');
create type public.campaign_status as enum ('draft','queued','running','done','failed','cancelled');
create type public.message_status as enum ('pending','sending','sent','delivered','read','failed');
create type public.template_status as enum ('APPROVED','PENDING','REJECTED','PAUSED','DISABLED');

-- =========== PROFILES ===========
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  email text,
  whatsapp_phone_number_id text,
  whatsapp_waba_id text,
  whatsapp_business_phone text,
  api_key text not null unique default encode(gen_random_bytes(24),'hex'),
  rate_limit_per_second int not null default 20,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);

-- Trigger: auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Generic updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

-- =========== CONTACTS ===========
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  phone_e164 text not null,
  name text,
  email text,
  custom_fields jsonb not null default '{}'::jsonb,
  opted_out boolean not null default false,
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, phone_e164)
);
alter table public.contacts enable row level security;
create index contacts_user_idx on public.contacts(user_id);

create policy "contacts_all_own" on public.contacts for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create trigger contacts_updated before update on public.contacts
  for each row execute function public.set_updated_at();

-- =========== TAGS ===========
create table public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text not null default '#25D366',
  created_at timestamptz not null default now(),
  unique (user_id, name)
);
alter table public.tags enable row level security;
create policy "tags_all_own" on public.tags for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.contact_tags (
  contact_id uuid not null references public.contacts(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (contact_id, tag_id)
);
alter table public.contact_tags enable row level security;
create policy "contact_tags_all_own" on public.contact_tags for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =========== LISTS ===========
create table public.lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);
alter table public.lists enable row level security;
create policy "lists_all_own" on public.lists for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.list_contacts (
  list_id uuid not null references public.lists(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (list_id, contact_id)
);
alter table public.list_contacts enable row level security;
create policy "list_contacts_all_own" on public.list_contacts for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index list_contacts_list_idx on public.list_contacts(list_id);

-- =========== TEMPLATES (mirror of Meta) ===========
create table public.templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  meta_template_id text,
  name text not null,
  language text not null,
  category text,
  status public.template_status not null default 'PENDING',
  components jsonb not null default '[]'::jsonb,
  synced_at timestamptz not null default now(),
  unique (user_id, name, language)
);
alter table public.templates enable row level security;
create policy "templates_all_own" on public.templates for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =========== CAMPAIGNS ===========
create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  message_type public.message_type not null,
  template_id uuid references public.templates(id) on delete set null,
  list_id uuid references public.lists(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  status public.campaign_status not null default 'draft',
  scheduled_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  totals jsonb not null default '{"total":0,"pending":0,"sent":0,"delivered":0,"read":0,"failed":0}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.campaigns enable row level security;
create policy "campaigns_all_own" on public.campaigns for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create trigger campaigns_updated before update on public.campaigns
  for each row execute function public.set_updated_at();

-- =========== CAMPAIGN MESSAGES (queue) ===========
create table public.campaign_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  to_phone text not null,
  status public.message_status not null default 'pending',
  wa_message_id text,
  error jsonb,
  attempts int not null default 0,
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.campaign_messages enable row level security;
create index cm_pending_idx on public.campaign_messages(campaign_id, status);
create index cm_user_idx on public.campaign_messages(user_id, status);
create index cm_wa_id_idx on public.campaign_messages(wa_message_id);
create policy "cm_select_own" on public.campaign_messages for select using (auth.uid() = user_id);

-- =========== WEBHOOK EVENTS (audit, service role only) ===========
create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'whatsapp',
  raw jsonb not null,
  processed boolean not null default false,
  received_at timestamptz not null default now()
);
alter table public.webhook_events enable row level security;
-- no policies = only service_role can access
