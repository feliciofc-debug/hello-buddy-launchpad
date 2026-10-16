-- Lead morno / resumo / retomada da vitrine (DDL only; cron manual separado)

CREATE TABLE IF NOT EXISTS public.vitrine_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  contact_number text NOT NULL,
  veiculo_id uuid NULL,
  evento text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vitrine_eventos_evento_check CHECK (
    evento IN (
      'marca', 'faixa', 'detalhe', 'fotos',
      'interesse', 'consultor', 'visita', 'financiamento', 'troca'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_vitrine_eventos_tenant_contact_time
  ON public.vitrine_eventos (user_id, contact_number, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_vitrine_eventos_tenant_veiculo_time
  ON public.vitrine_eventos (user_id, veiculo_id, created_at DESC)
  WHERE veiculo_id IS NOT NULL;

ALTER TABLE public.vitrine_eventos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vitrine_eventos_select_own ON public.vitrine_eventos;
CREATE POLICY vitrine_eventos_select_own ON public.vitrine_eventos
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT ON public.vitrine_eventos TO authenticated;
GRANT ALL ON public.vitrine_eventos TO service_role;

CREATE TABLE IF NOT EXISTS public.vitrine_lead_morno_agenda (
  user_id uuid NOT NULL,
  contact_number text NOT NULL,
  contact_name text NULL,
  run_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, contact_number),
  CONSTRAINT vitrine_lead_morno_agenda_status_check CHECK (
    status IN ('pending', 'cancelled', 'done')
  )
);

CREATE INDEX IF NOT EXISTS idx_vitrine_lead_morno_agenda_due
  ON public.vitrine_lead_morno_agenda (status, run_at)
  WHERE status = 'pending';

GRANT ALL ON public.vitrine_lead_morno_agenda TO service_role;

CREATE TABLE IF NOT EXISTS public.vitrine_lead_morno_enviados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  contact_number text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vitrine_lead_morno_enviados_contact
  ON public.vitrine_lead_morno_enviados (user_id, contact_number, sent_at DESC);

GRANT ALL ON public.vitrine_lead_morno_enviados TO service_role;

CREATE TABLE IF NOT EXISTS public.vitrine_retomada_agenda (
  user_id uuid NOT NULL,
  contact_number text NOT NULL,
  veiculo_id uuid NOT NULL,
  contact_name text NULL,
  vehicle_label text NULL,
  run_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, contact_number, veiculo_id),
  CONSTRAINT vitrine_retomada_agenda_status_check CHECK (
    status IN ('pending', 'cancelled', 'done')
  )
);

CREATE INDEX IF NOT EXISTS idx_vitrine_retomada_agenda_due
  ON public.vitrine_retomada_agenda (status, run_at)
  WHERE status = 'pending';

GRANT ALL ON public.vitrine_retomada_agenda TO service_role;

CREATE TABLE IF NOT EXISTS public.vitrine_retomada_enviados (
  user_id uuid NOT NULL,
  contact_number text NOT NULL,
  veiculo_id uuid NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, contact_number, veiculo_id)
);

GRANT ALL ON public.vitrine_retomada_enviados TO service_role;

CREATE TABLE IF NOT EXISTS public.vitrine_contato_prefs (
  user_id uuid NOT NULL,
  contact_number text NOT NULL,
  retomada_opt_out boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, contact_number)
);

GRANT ALL ON public.vitrine_contato_prefs TO service_role;

ALTER TABLE public.empresa_config
  ADD COLUMN IF NOT EXISTS vitrine_lead_morno_ativo boolean NOT NULL DEFAULT true;

ALTER TABLE public.empresa_config
  ADD COLUMN IF NOT EXISTS vitrine_resumo_diario_ativo boolean NOT NULL DEFAULT true;

ALTER TABLE public.empresa_config
  ADD COLUMN IF NOT EXISTS vitrine_retomada_ativa boolean NOT NULL DEFAULT false;

ALTER TABLE public.empresa_config
  ADD COLUMN IF NOT EXISTS vitrine_resumo_ultimo_dia_sp date NULL;

COMMENT ON COLUMN public.empresa_config.vitrine_lead_morno_ativo IS
  'Alerta ao dono quando cliente viu detalhe/fotos e não converteu (vitrine CRM).';
COMMENT ON COLUMN public.empresa_config.vitrine_resumo_diario_ativo IS
  'Resumo diário 19h SP de movimento na vitrine.';
COMMENT ON COLUMN public.empresa_config.vitrine_retomada_ativa IS
  'Retomada automática ao cliente após 2h sem conversão (desligado por default).';
COMMENT ON COLUMN public.empresa_config.vitrine_resumo_ultimo_dia_sp IS
  'Último dia (calendário SP) em que o resumo diário foi enviado.';

CREATE TABLE IF NOT EXISTS public.vitrine_crm_tick_meta (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.vitrine_crm_tick_meta TO service_role;
