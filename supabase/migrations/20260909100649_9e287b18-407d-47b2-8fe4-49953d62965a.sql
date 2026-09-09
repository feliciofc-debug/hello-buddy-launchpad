CREATE TABLE IF NOT EXISTS public.site_render_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente',
  identidade_a JSONB NOT NULL DEFAULT '{}'::jsonb,
  identidade JSONB,
  erro TEXT,
  tentativas INT NOT NULL DEFAULT 0,
  claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.site_render_jobs TO authenticated;
GRANT ALL ON public.site_render_jobs TO service_role;

ALTER TABLE public.site_render_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "site_render_jobs_select_own" ON public.site_render_jobs;
CREATE POLICY "site_render_jobs_select_own" ON public.site_render_jobs
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS site_render_jobs_status_idx ON public.site_render_jobs (status, created_at);

CREATE OR REPLACE FUNCTION public.claim_site_render_job(p_stale_minutos INT DEFAULT 5)
RETURNS public.site_render_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job public.site_render_jobs;
BEGIN
  UPDATE public.site_render_jobs SET status = 'pendente', claimed_at = NULL
  WHERE status = 'processando'
    AND claimed_at < now() - (p_stale_minutos || ' minutes')::interval
    AND tentativas < 3;

  UPDATE public.site_render_jobs j
     SET status = 'processando',
         claimed_at = now(),
         tentativas = j.tentativas + 1,
         updated_at = now()
   WHERE j.id = (
     SELECT id FROM public.site_render_jobs
      WHERE status = 'pendente'
      ORDER BY created_at
      LIMIT 1
      FOR UPDATE SKIP LOCKED
   )
   RETURNING j.* INTO v_job;

  RETURN v_job;
END;
$$;