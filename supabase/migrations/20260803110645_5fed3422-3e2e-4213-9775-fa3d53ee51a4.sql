ALTER TABLE public.campanhas_recorrentes
  ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES public.whatsapp_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS canal text NOT NULL DEFAULT 'meta_cloud';

ALTER TABLE public.historico_envios
  ADD COLUMN IF NOT EXISTS canal text DEFAULT 'meta_cloud',
  ADD COLUMN IF NOT EXISTS template_id uuid,
  ADD COLUMN IF NOT EXISTS message_id text;

CREATE INDEX IF NOT EXISTS idx_historico_envios_canal ON public.historico_envios(canal);