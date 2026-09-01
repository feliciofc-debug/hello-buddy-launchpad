ALTER TABLE public.whatsapp_cloud_agent_config
  ADD COLUMN IF NOT EXISTS owner_alt_phones text[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE public.lead_encaminhamentos
  ADD COLUMN IF NOT EXISTS destino_dono text,
  ADD COLUMN IF NOT EXISTS status_entrega text NOT NULL DEFAULT 'aceita',
  ADD COLUMN IF NOT EXISTS status_atualizado_em timestamptz,
  ADD COLUMN IF NOT EXISTS erro_entrega text;

ALTER TABLE public.lead_encaminhamentos
  DROP CONSTRAINT IF EXISTS lead_encaminhamentos_status_entrega_check;
ALTER TABLE public.lead_encaminhamentos
  ADD CONSTRAINT lead_encaminhamentos_status_entrega_check
  CHECK (status_entrega IN ('aceita','enviada','entregue','lida','falhou'));

CREATE INDEX IF NOT EXISTS idx_lead_encaminhamentos_wamid_dono
  ON public.lead_encaminhamentos (wamid_dono)
  WHERE wamid_dono IS NOT NULL;

COMMENT ON COLUMN public.whatsapp_cloud_agent_config.owner_alt_phones IS 'Números adicionais do mesmo responsável, normalizados em formato internacional.';
COMMENT ON COLUMN public.lead_encaminhamentos.status_entrega IS 'Estado real mais recente informado pela Meta para a notificação ao dono.';