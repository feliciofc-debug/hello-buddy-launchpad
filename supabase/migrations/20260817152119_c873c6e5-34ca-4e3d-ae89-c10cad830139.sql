ALTER TABLE public.video_render_jobs ADD COLUMN IF NOT EXISTS enfileirado_at timestamptz;

UPDATE public.video_render_jobs SET enfileirado_at = COALESCE(enfileirado_at, created_at)
WHERE status IN ('pendente','processando');

CREATE OR REPLACE FUNCTION public.claim_video_render_job(p_stale_minutos int DEFAULT 15)
RETURNS public.video_render_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_row public.video_render_jobs;
BEGIN
  UPDATE public.video_render_jobs
     SET status = 'pendente', claimed_at = NULL
   WHERE status = 'processando'
     AND claimed_at < now() - make_interval(mins => p_stale_minutos);

  SELECT id INTO v_id
    FROM (
      SELECT id,
             COALESCE(enfileirado_at, created_at) AS t,
             row_number() OVER (
               PARTITION BY user_id
               ORDER BY COALESCE(enfileirado_at, created_at)
             ) AS rn
        FROM public.video_render_jobs
       WHERE status = 'pendente'
         AND COALESCE(tentativas, 0) < 3
    ) q
   ORDER BY rn, t
   LIMIT 1;

  IF v_id IS NULL THEN RETURN NULL; END IF;

  UPDATE public.video_render_jobs
     SET status = 'processando', claimed_at = now()
   WHERE id = v_id AND status = 'pendente'
   RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.video_render_fila_posicao(p_job_id uuid)
RETURNS int
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT id,
           COALESCE(enfileirado_at, created_at) AS t,
           row_number() OVER (
             PARTITION BY user_id
             ORDER BY COALESCE(enfileirado_at, created_at)
           ) AS rn
      FROM public.video_render_jobs
     WHERE status IN ('pendente','processando')
       AND COALESCE(tentativas, 0) < 3
  ), ordenada AS (
    SELECT id, row_number() OVER (ORDER BY rn, t) AS pos FROM base
  )
  SELECT COALESCE((SELECT pos::int FROM ordenada WHERE id = p_job_id), 1);
$$;

GRANT EXECUTE ON FUNCTION public.claim_video_render_job(int) TO service_role;
GRANT EXECUTE ON FUNCTION public.video_render_fila_posicao(uuid) TO service_role, authenticated;

CREATE INDEX IF NOT EXISTS idx_video_render_jobs_fila
  ON public.video_render_jobs (status, user_id, enfileirado_at);