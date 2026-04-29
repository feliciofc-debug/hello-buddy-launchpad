ALTER TABLE public.autopilot_config
  ADD COLUMN IF NOT EXISTS modo_geracao text NOT NULL DEFAULT 'padrao';

ALTER TABLE public.autopilot_config
  DROP CONSTRAINT IF EXISTS autopilot_config_modo_geracao_check;

ALTER TABLE public.autopilot_config
  ADD CONSTRAINT autopilot_config_modo_geracao_check
  CHECK (modo_geracao IN ('padrao','engajamento'));