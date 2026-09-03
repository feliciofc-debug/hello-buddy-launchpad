ALTER TABLE public.video_motion_jobs
  ADD COLUMN IF NOT EXISTS trilha_id UUID REFERENCES public.trilhas_sonoras(id) ON DELETE SET NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.video_motion_jobs TO authenticated;
GRANT ALL ON public.video_motion_jobs TO service_role;

CREATE INDEX IF NOT EXISTS video_motion_jobs_trilha_idx
  ON public.video_motion_jobs (trilha_id);