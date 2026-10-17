-- ML-4: inbox + leads + perguntas

CREATE TABLE IF NOT EXISTS public.ml_notification_inbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id text NOT NULL UNIQUE,
  topic text NOT NULL,
  resource text NOT NULL,
  ml_user_id bigint NOT NULL,
  user_id uuid NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'done', 'failed')),
  attempts int NOT NULL DEFAULT 0,
  last_error text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz NULL
);

CREATE INDEX IF NOT EXISTS idx_ml_notification_inbox_pending
  ON public.ml_notification_inbox (status, created_at)
  WHERE status = 'pending';

ALTER TABLE public.ml_notification_inbox ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.ml_notification_inbox TO service_role;

CREATE TABLE IF NOT EXISTS public.ml_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  ml_lead_id text NOT NULL,
  item_id text NOT NULL,
  veiculo_id uuid NULL,
  contact_type text NOT NULL,
  buyer_name text NULL,
  buyer_phone text NULL,
  buyer_email text NULL,
  is_guest boolean NOT NULL DEFAULT false,
  permalink text NULL,
  owner_notified_at timestamptz NULL,
  raw jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, ml_lead_id)
);

ALTER TABLE public.ml_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ml_leads_select_own ON public.ml_leads;
CREATE POLICY ml_leads_select_own ON public.ml_leads
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT ON public.ml_leads TO authenticated;
GRANT ALL ON public.ml_leads TO service_role;

CREATE TABLE IF NOT EXISTS public.ml_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  question_id bigint NOT NULL,
  item_id text NOT NULL,
  veiculo_id uuid NULL,
  text text NOT NULL,
  status text NULL,
  permalink text NULL,
  raw jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, question_id)
);

ALTER TABLE public.ml_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ml_questions_select_own ON public.ml_questions;
CREATE POLICY ml_questions_select_own ON public.ml_questions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT ON public.ml_questions TO authenticated;
GRANT ALL ON public.ml_questions TO service_role;

CREATE TABLE IF NOT EXISTS public.ml_crm_tick_meta (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ml_crm_tick_meta ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.ml_crm_tick_meta TO service_role;
