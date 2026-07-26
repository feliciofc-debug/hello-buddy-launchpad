BEGIN;

-- 1) max_envios_dia em campanhas_recorrentes (trava diária de volume)
ALTER TABLE public.campanhas_recorrentes
  ADD COLUMN IF NOT EXISTS max_envios_dia integer;

UPDATE public.campanhas_recorrentes
  SET max_envios_dia = 200
  WHERE max_envios_dia IS NULL;

ALTER TABLE public.campanhas_recorrentes
  ALTER COLUMN max_envios_dia SET DEFAULT 200;

ALTER TABLE public.campanhas_recorrentes
  ALTER COLUMN max_envios_dia SET NOT NULL;

ALTER TABLE public.campanhas_recorrentes
  ADD CONSTRAINT campanhas_recorrentes_max_envios_dia_positivo
  CHECK (max_envios_dia > 0 AND max_envios_dia <= 10000);

-- 2) user_id + campanha_id em historico_envios (necessário pra trava contar por autopilot)
ALTER TABLE public.historico_envios
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS campanha_id uuid;

-- Índice composto pra COUNT rápido da trava (por user_id + campanha_id + dia)
CREATE INDEX IF NOT EXISTS idx_historico_envios_autopilot_dia
  ON public.historico_envios (user_id, campanha_id, "timestamp" DESC)
  WHERE user_id IS NOT NULL AND campanha_id IS NOT NULL;

COMMIT;