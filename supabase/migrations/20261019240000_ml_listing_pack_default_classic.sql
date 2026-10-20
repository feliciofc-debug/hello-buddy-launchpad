ALTER TABLE public.empresa_config
  ALTER COLUMN ml_listing_pack_preference SET DEFAULT 'classic_first';

COMMENT ON COLUMN public.empresa_config.ml_listing_pack_preference IS
  'Ordem de pacotes ML. Default classic_first (Clássico/silver primeiro).';
