BEGIN;

ALTER TABLE public.tenant_logos
  DROP CONSTRAINT IF EXISTS tenant_logos_variant_check;

ALTER TABLE public.tenant_logos
  ADD CONSTRAINT tenant_logos_variant_check
  CHECK (
    variant IN (
      'default',
      'light_background',
      'dark_background',
      'video'
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS tenant_logos_user_variant_ativa_idx
  ON public.tenant_logos (user_id, variant)
  WHERE ativo;

COMMIT;
