alter table public.empresa_config
  add column if not exists paleta_marca jsonb,
  add column if not exists tipografia text,
  add column if not exists identidade_site jsonb;