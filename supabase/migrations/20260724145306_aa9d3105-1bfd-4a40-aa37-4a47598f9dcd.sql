
ALTER TABLE public.autopilot_config
  ADD COLUMN IF NOT EXISTS postar_videos boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS videos_por_dia integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS ultimo_video_index integer NOT NULL DEFAULT 0;
