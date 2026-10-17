-- LM.3: aviso imediato ao dono (demos / conta expo)

ALTER TABLE public.empresa_config
  ADD COLUMN IF NOT EXISTS vitrine_lead_ao_vivo boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.empresa_config.vitrine_lead_ao_vivo IS
  'Aviso ao dono em segundos quando cliente abre detalhe/fotos (demos). Desligado = lead morno 10 min.';

CREATE TABLE IF NOT EXISTS public.vitrine_lead_ao_vivo_enviados (
  user_id uuid NOT NULL,
  contact_number text NOT NULL,
  veiculo_id uuid NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, contact_number, veiculo_id)
);

CREATE INDEX IF NOT EXISTS idx_vitrine_lead_ao_vivo_enviados_sent
  ON public.vitrine_lead_ao_vivo_enviados (user_id, contact_number, sent_at DESC);

GRANT ALL ON public.vitrine_lead_ao_vivo_enviados TO service_role;
