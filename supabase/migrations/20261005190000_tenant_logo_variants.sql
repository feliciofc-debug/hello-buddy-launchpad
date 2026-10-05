ALTER TABLE public.tenant_logos
  ADD COLUMN IF NOT EXISTS variant TEXT NOT NULL DEFAULT 'default'
  CHECK (variant IN ('default', 'light_background', 'dark_background'));

DROP INDEX IF EXISTS public.tenant_logos_user_ativa_idx;

CREATE UNIQUE INDEX IF NOT EXISTS tenant_logos_user_variant_ativa_idx
  ON public.tenant_logos (user_id, variant)
  WHERE ativo;
