ALTER TABLE public.empresa_config
  ADD COLUMN IF NOT EXISTS vitrine_veiculos_demo BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.empresa_config.vitrine_veiculos_demo IS
  'Quando true, permite vitrine WhatsApp de veiculos_estoque para clientes (com intent explícita).';
