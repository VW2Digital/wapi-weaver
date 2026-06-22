-- PostgreSQL Schema Migration for wapi-weaver (CRM & Salvy integration)

-- 1. Custom ENUM Types
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'opportunity_status') THEN
    CREATE TYPE public.opportunity_status AS ENUM ('open', 'won', 'lost', 'paused', 'archived');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'opportunity_temperature') THEN
    CREATE TYPE public.opportunity_temperature AS ENUM ('cold', 'warm', 'hot');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'opportunity_priority') THEN
    CREATE TYPE public.opportunity_priority AS ENUM ('low', 'medium', 'high', 'urgent');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'opportunity_activity_type') THEN
    CREATE TYPE public.opportunity_activity_type AS ENUM ('call', 'email', 'meeting', 'task', 'note', 'whatsapp', 'proposal', 'follow_up', 'other');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'opportunity_activity_status') THEN
    CREATE TYPE public.opportunity_activity_status AS ENUM ('pending', 'done', 'canceled');
  END IF;
END $$;

-- 2. Tables

-- salvy_numbers
CREATE TABLE IF NOT EXISTS public.salvy_numbers (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  salvy_id TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  area_code INTEGER NULL,
  name TEXT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  cost_center TEXT NULL,
  cancel_reason TEXT NULL,
  created_at_remote TIMESTAMPTZ NULL,
  canceled_at TIMESTAMPTZ NULL,
  raw JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_user_salvy UNIQUE (user_id, salvy_id)
);

-- sales_funnels
CREATE TABLE IF NOT EXISTS public.sales_funnels (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL,
  CONSTRAINT uq_sales_funnels_user_slug UNIQUE (user_id, slug)
);

-- sales_stages
CREATE TABLE IF NOT EXISTS public.sales_stages (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  funnel_id UUID NOT NULL REFERENCES public.sales_funnels(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT NULL,
  color TEXT NULL,
  probability_percent DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_won_stage BOOLEAN NOT NULL DEFAULT FALSE,
  is_lost_stage BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL,
  CONSTRAINT uq_sales_stages_funnel_slug UNIQUE (funnel_id, slug)
);

-- opportunity_lost_reasons
CREATE TABLE IF NOT EXISTS public.opportunity_lost_reasons (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_lost_reasons_user_name UNIQUE (user_id, name)
);

-- opportunities
CREATE TABLE IF NOT EXISTS public.opportunities (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  funnel_id UUID NOT NULL REFERENCES public.sales_funnels(id) ON DELETE RESTRICT,
  stage_id UUID NOT NULL REFERENCES public.sales_stages(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  description TEXT NULL,
  primary_contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  company_name TEXT NULL,
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  value DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  currency CHAR(3) NOT NULL DEFAULT 'BRL',
  probability_percent DECIMAL(5,2) NULL,
  expected_close_date DATE NULL,
  closed_at TIMESTAMPTZ NULL,
  status public.opportunity_status NOT NULL DEFAULT 'open',
  source TEXT NULL,
  temperature public.opportunity_temperature NULL,
  priority public.opportunity_priority NOT NULL DEFAULT 'medium',
  lost_reason_id UUID REFERENCES public.opportunity_lost_reasons(id) ON DELETE SET NULL,
  lost_reason_text TEXT NULL,
  kanban_order DECIMAL(20,10) NOT NULL DEFAULT 0,
  last_activity_at TIMESTAMPTZ NULL,
  next_activity_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL
);

-- opportunity_contacts
CREATE TABLE IF NOT EXISTS public.opportunity_contacts (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  role TEXT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_opportunity_contact UNIQUE (opportunity_id, contact_id)
);

-- opportunity_stage_history
CREATE TABLE IF NOT EXISTS public.opportunity_stage_history (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  funnel_id UUID NOT NULL REFERENCES public.sales_funnels(id) ON DELETE CASCADE,
  from_stage_id UUID REFERENCES public.sales_stages(id) ON DELETE SET NULL,
  to_stage_id UUID NOT NULL REFERENCES public.sales_stages(id) ON DELETE CASCADE,
  moved_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  moved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason TEXT NULL,
  old_status TEXT NULL,
  new_status TEXT NULL
);

-- opportunity_activities
CREATE TABLE IF NOT EXISTS public.opportunity_activities (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  assigned_to_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  type public.opportunity_activity_type NOT NULL DEFAULT 'task',
  title TEXT NOT NULL,
  description TEXT NULL,
  status public.opportunity_activity_status NOT NULL DEFAULT 'pending',
  due_at TIMESTAMPTZ NULL,
  completed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL
);

-- opportunity_notes
CREATE TABLE IF NOT EXISTS public.opportunity_notes (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  user_id_creator UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL
);

-- opportunity_tags
CREATE TABLE IF NOT EXISTS public.opportunity_tags (
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  PRIMARY KEY (opportunity_id, tag_id)
);

-- opportunity_audit_logs
CREATE TABLE IF NOT EXISTS public.opportunity_audit_logs (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE CASCADE,
  user_id_actor UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  old_values JSONB NULL,
  new_values JSONB NULL,
  ip_address TEXT NULL,
  user_agent TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Row Level Security (RLS) Configuration
ALTER TABLE public.salvy_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_funnels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_lost_reasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_stage_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_audit_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any to prevent duplicate errors
DROP POLICY IF EXISTS salvy_numbers_all_own ON public.salvy_numbers;
DROP POLICY IF EXISTS sales_funnels_all_own ON public.sales_funnels;
DROP POLICY IF EXISTS sales_stages_all_own ON public.sales_stages;
DROP POLICY IF EXISTS opportunity_lost_reasons_all_own ON public.opportunity_lost_reasons;
DROP POLICY IF EXISTS opportunities_all_own ON public.opportunities;
DROP POLICY IF EXISTS opportunity_contacts_all_own ON public.opportunity_contacts;
DROP POLICY IF EXISTS opportunity_stage_history_all_own ON public.opportunity_stage_history;
DROP POLICY IF EXISTS opportunity_activities_all_own ON public.opportunity_activities;
DROP POLICY IF EXISTS opportunity_notes_all_own ON public.opportunity_notes;
DROP POLICY IF EXISTS opportunity_tags_all_own ON public.opportunity_tags;
DROP POLICY IF EXISTS opportunity_audit_logs_all_own ON public.opportunity_audit_logs;

-- Create policies
CREATE POLICY salvy_numbers_all_own ON public.salvy_numbers FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY sales_funnels_all_own ON public.sales_funnels FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY sales_stages_all_own ON public.sales_stages FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY opportunity_lost_reasons_all_own ON public.opportunity_lost_reasons FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY opportunities_all_own ON public.opportunities FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY opportunity_contacts_all_own ON public.opportunity_contacts FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY opportunity_stage_history_all_own ON public.opportunity_stage_history FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY opportunity_activities_all_own ON public.opportunity_activities FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY opportunity_notes_all_own ON public.opportunity_notes FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY opportunity_tags_all_own ON public.opportunity_tags FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY opportunity_audit_logs_all_own ON public.opportunity_audit_logs FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 4. Triggers for updated_at tracking
-- Helper block to safely create triggers (checking if they exist)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'salvy_numbers_updated') THEN
    CREATE TRIGGER salvy_numbers_updated BEFORE UPDATE ON public.salvy_numbers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sales_funnels_updated') THEN
    CREATE TRIGGER sales_funnels_updated BEFORE UPDATE ON public.sales_funnels FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sales_stages_updated') THEN
    CREATE TRIGGER sales_stages_updated BEFORE UPDATE ON public.sales_stages FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'opportunity_lost_reasons_updated') THEN
    CREATE TRIGGER opportunity_lost_reasons_updated BEFORE UPDATE ON public.opportunity_lost_reasons FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'opportunities_updated') THEN
    CREATE TRIGGER opportunities_updated BEFORE UPDATE ON public.opportunities FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'opportunity_contacts_updated') THEN
    CREATE TRIGGER opportunity_contacts_updated BEFORE UPDATE ON public.opportunity_contacts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'opportunity_activities_updated') THEN
    CREATE TRIGGER opportunity_activities_updated BEFORE UPDATE ON public.opportunity_activities FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'opportunity_notes_updated') THEN
    CREATE TRIGGER opportunity_notes_updated BEFORE UPDATE ON public.opportunity_notes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- 5. Optimization Indexes
CREATE INDEX IF NOT EXISTS idx_opportunities_funnel_stage_order ON public.opportunities(user_id, funnel_id, stage_id, kanban_order);
CREATE INDEX IF NOT EXISTS idx_opportunities_status ON public.opportunities(user_id, status);
CREATE INDEX IF NOT EXISTS idx_opportunities_owner ON public.opportunities(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_primary_contact ON public.opportunities(primary_contact_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_expected_close ON public.opportunities(expected_close_date);
CREATE INDEX IF NOT EXISTS idx_opportunities_last_act ON public.opportunities(last_activity_at);
CREATE INDEX IF NOT EXISTS idx_opportunities_next_act ON public.opportunities(next_activity_at);
CREATE INDEX IF NOT EXISTS idx_opportunities_deleted ON public.opportunities(deleted_at);

CREATE INDEX IF NOT EXISTS idx_opt_contacts_contact ON public.opportunity_contacts(contact_id);
CREATE INDEX IF NOT EXISTS idx_opt_contacts_primary ON public.opportunity_contacts(opportunity_id, is_primary);

CREATE INDEX IF NOT EXISTS idx_stage_history_opp ON public.opportunity_stage_history(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_stage_history_funnel ON public.opportunity_stage_history(funnel_id);
CREATE INDEX IF NOT EXISTS idx_stage_history_moved ON public.opportunity_stage_history(moved_at);

CREATE INDEX IF NOT EXISTS idx_opt_activities_opp ON public.opportunity_activities(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_opt_activities_due ON public.opportunity_activities(due_at);
CREATE INDEX IF NOT EXISTS idx_opt_activities_status ON public.opportunity_activities(status);

CREATE INDEX IF NOT EXISTS idx_opt_notes_opp ON public.opportunity_notes(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_opt_notes_pinned ON public.opportunity_notes(is_pinned);

CREATE INDEX IF NOT EXISTS idx_opt_audit_opp ON public.opportunity_audit_logs(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_opt_audit_created ON public.opportunity_audit_logs(created_at);
