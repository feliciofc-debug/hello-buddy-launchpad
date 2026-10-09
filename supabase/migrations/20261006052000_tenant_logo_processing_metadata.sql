ALTER TABLE public.tenant_logos
  ADD COLUMN IF NOT EXISTS generated_automatically BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS background_warning TEXT;
