CREATE TABLE IF NOT EXISTS public.video_motion_jobs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  telefone text,
  origem text NOT NULL DEFAULT 'plataforma',
  template text NOT NULL DEFAULT 'template-agente',
  titulo text,
  props jsonb NOT NULL,
  legenda_post text,
  plataformas text[] NOT NULL DEFAULT ARRAY[]::text[],
  formato text NOT NULL DEFAULT 'reels',
  status text NOT NULL DEFAULT 'pendente',
  tentativas integer NOT NULL DEFAULT 0,
  erro_mensagem text,
  resultado_bucket text,
  resultado_path text,
  duracao_segundos numeric,
  enfileirado_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz,
  concluido_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.video_motion_jobs TO authenticated;
GRANT ALL ON public.video_motion_jobs TO service_role;

ALTER TABLE public.video_motion_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "motion dono ve seus jobs" ON public.video_motion_jobs;
CREATE POLICY "motion dono ve seus jobs"
ON public.video_motion_jobs FOR SELECT TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "motion dono cria seus jobs" ON public.video_motion_jobs;
CREATE POLICY "motion dono cria seus jobs"
ON public.video_motion_jobs FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "motion dono atualiza seus jobs" ON public.video_motion_jobs;
CREATE POLICY "motion dono atualiza seus jobs"
ON public.video_motion_jobs FOR UPDATE TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "motion dono apaga seus jobs" ON public.video_motion_jobs;
CREATE POLICY "motion dono apaga seus jobs"
ON public.video_motion_jobs FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_video_motion_jobs_fila
  ON public.video_motion_jobs (status, user_id, enfileirado_at);
CREATE INDEX IF NOT EXISTS idx_video_motion_jobs_user
  ON public.video_motion_jobs (user_id, created_at DESC);

DROP TRIGGER IF EXISTS update_video_motion_jobs_updated_at ON public.video_motion_jobs;
CREATE TRIGGER update_video_motion_jobs_updated_at
BEFORE UPDATE ON public.video_motion_jobs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.claim_video_motion_job(p_stale_minutos int DEFAULT 20)
RETURNS public.video_motion_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_row public.video_motion_jobs;
BEGIN
  UPDATE public.video_motion_jobs
     SET status = 'pendente', claimed_at = NULL
   WHERE status = 'processando'
     AND claimed_at < now() - make_interval(mins => p_stale_minutos);

  SELECT id INTO v_id
    FROM (
      SELECT id,
             enfileirado_at AS t,
             row_number() OVER (PARTITION BY user_id ORDER BY enfileirado_at) AS rn
        FROM public.video_motion_jobs
       WHERE status = 'pendente'
         AND COALESCE(tentativas, 0) < 3
    ) q
   ORDER BY rn, t
   LIMIT 1;

  IF v_id IS NULL THEN RETURN NULL; END IF;

  UPDATE public.video_motion_jobs
     SET status = 'processando', claimed_at = now()
   WHERE id = v_id AND status = 'pendente'
   RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.video_motion_fila_posicao(p_job_id uuid)
RETURNS int
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT id, enfileirado_at AS t,
           row_number() OVER (PARTITION BY user_id ORDER BY enfileirado_at) AS rn
      FROM public.video_motion_jobs
     WHERE status IN ('pendente','processando')
       AND COALESCE(tentativas, 0) < 3
  ), ordenada AS (
    SELECT id, row_number() OVER (ORDER BY rn, t) AS pos FROM base
  )
  SELECT COALESCE((SELECT pos::int FROM ordenada WHERE id = p_job_id), 1);
$$;

REVOKE ALL ON FUNCTION public.claim_video_motion_job(int) FROM public;
REVOKE ALL ON FUNCTION public.claim_video_motion_job(int) FROM anon;
REVOKE ALL ON FUNCTION public.claim_video_motion_job(int) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_video_motion_job(int) TO service_role;
GRANT EXECUTE ON FUNCTION public.video_motion_fila_posicao(uuid) TO service_role, authenticated;