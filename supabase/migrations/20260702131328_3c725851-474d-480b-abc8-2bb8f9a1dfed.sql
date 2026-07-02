
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS acesso_bloqueado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS motivo_bloqueio text,
  ADD COLUMN IF NOT EXISTS bloqueado_em timestamptz;

CREATE INDEX IF NOT EXISTS idx_profiles_acesso_bloqueado
  ON public.profiles (acesso_bloqueado) WHERE acesso_bloqueado = true;
