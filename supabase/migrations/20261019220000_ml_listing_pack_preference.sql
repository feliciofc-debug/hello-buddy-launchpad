ALTER TABLE public.empresa_config
  ADD COLUMN IF NOT EXISTS ml_listing_pack_preference text NULL
    DEFAULT 'classic_first'
  CHECK (
    ml_listing_pack_preference IS NULL
    OR ml_listing_pack_preference IN ('destaque_first', 'classic_first')
  );

COMMENT ON COLUMN public.empresa_config.ml_listing_pack_preference IS
  'Ordem de pacotes ML. Default classic_first (Clássico/silver primeiro).';
