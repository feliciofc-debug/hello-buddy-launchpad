ALTER TABLE public.empresa_config
  ADD COLUMN IF NOT EXISTS silvester_dossie_ativo boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.empresa_config.silvester_dossie_ativo IS
  'Quando true, o hook Silvester no processor e silvester-extract-document processam dossiê para o tenant.';
