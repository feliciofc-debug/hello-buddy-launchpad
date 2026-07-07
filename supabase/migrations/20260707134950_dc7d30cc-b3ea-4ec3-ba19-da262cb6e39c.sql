ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS incluir_cta_whatsapp boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.produtos.incluir_cta_whatsapp IS
  'Feature A.2: quando true, o autopilot-social aplica appendWhatsappCta (sanduíche topo+fim) na legenda deste produto usando o display_phone do agente do tenant. Default FALSE preserva 100% o comportamento atual.';