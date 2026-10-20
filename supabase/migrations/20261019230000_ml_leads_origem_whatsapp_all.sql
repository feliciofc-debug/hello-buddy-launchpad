ALTER TABLE public.ml_leads
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'amz'
  CHECK (origem IN ('amz', 'outro_sistema'));

COMMENT ON COLUMN public.ml_leads.origem IS
  'amz = anúncio publicado pela AMZ; outro_sistema = lead de integrador externo.';

ALTER TABLE public.empresa_config
  ADD COLUMN IF NOT EXISTS ml_whatsapp_leads_all_ads boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.empresa_config.ml_whatsapp_leads_all_ads IS
  'Se true, notifica WhatsApp leads de todos os anúncios ML; default só anúncios AMZ.';
