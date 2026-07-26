BEGIN;
ALTER TABLE public.campanhas_recorrentes
  ADD COLUMN IF NOT EXISTS autopilot boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_campanhas_recorrentes_autopilot
  ON public.campanhas_recorrentes (user_id, autopilot)
  WHERE autopilot = true;
COMMIT;