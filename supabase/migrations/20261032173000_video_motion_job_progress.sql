-- Progresso real do render Remotion (worker → plataforma)
ALTER TABLE public.video_motion_jobs
  ADD COLUMN IF NOT EXISTS progresso_pct smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS etapa text,
  ADD COLUMN IF NOT EXISTS progresso_atualizado_em timestamptz;

COMMENT ON COLUMN public.video_motion_jobs.progresso_pct IS '0–100, atualizado pelo worker VPS durante o render';
COMMENT ON COLUMN public.video_motion_jobs.etapa IS 'na_fila|preparando|renderizando|enviando|concluido|erro';
COMMENT ON COLUMN public.video_motion_jobs.progresso_atualizado_em IS 'Último heartbeat de progresso do worker';

CREATE INDEX IF NOT EXISTS video_motion_jobs_progresso_idx
  ON public.video_motion_jobs (user_id, status, progresso_atualizado_em DESC);
