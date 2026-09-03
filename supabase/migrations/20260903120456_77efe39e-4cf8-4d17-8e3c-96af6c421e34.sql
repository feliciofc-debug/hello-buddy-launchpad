-- lovable-cron-fallback-reviewed: 144 runs/day; fila de render single-thread na VPS: se o worker cair no meio de um job, ele fica travado em "processando" e bloqueia todos os tenants. Não há evento no banco quando um processo externo morre, então só uma verificação periódica detecta o travamento. 10 min mantém o atraso máximo em ~25 min.
CREATE TABLE IF NOT EXISTS public.video_motion_rascunhos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  telefone text,
  token text NOT NULL UNIQUE,
  tema text NOT NULL,
  props jsonb NOT NULL,
  legenda_post text,
  formato text NOT NULL DEFAULT 'reels',
  status text NOT NULL DEFAULT 'aguardando_aprovacao',
  expira_em timestamptz NOT NULL DEFAULT (now() + interval '2 hours'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.video_motion_rascunhos TO authenticated;
GRANT ALL ON public.video_motion_rascunhos TO service_role;

ALTER TABLE public.video_motion_rascunhos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "motion rascunho dono ve" ON public.video_motion_rascunhos;
CREATE POLICY "motion rascunho dono ve"
ON public.video_motion_rascunhos FOR SELECT TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "motion rascunho dono cria" ON public.video_motion_rascunhos;
CREATE POLICY "motion rascunho dono cria"
ON public.video_motion_rascunhos FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "motion rascunho dono atualiza" ON public.video_motion_rascunhos;
CREATE POLICY "motion rascunho dono atualiza"
ON public.video_motion_rascunhos FOR UPDATE TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "motion rascunho dono apaga" ON public.video_motion_rascunhos;
CREATE POLICY "motion rascunho dono apaga"
ON public.video_motion_rascunhos FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_video_motion_rascunhos_user
  ON public.video_motion_rascunhos (user_id, created_at DESC);

DROP TRIGGER IF EXISTS update_video_motion_rascunhos_updated_at ON public.video_motion_rascunhos;
CREATE TRIGGER update_video_motion_rascunhos_updated_at
BEFORE UPDATE ON public.video_motion_rascunhos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.video_motion_destravar_fila()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  afetados integer;
BEGIN
  UPDATE public.video_motion_jobs
  SET status = 'pendente',
      claimed_at = NULL,
      erro_mensagem = 'render travado — devolvido para a fila'
  WHERE status = 'processando'
    AND claimed_at IS NOT NULL
    AND claimed_at < now() - interval '15 minutes'
    AND tentativas < 3;
  GET DIAGNOSTICS afetados = ROW_COUNT;

  DELETE FROM public.video_motion_rascunhos WHERE expira_em < now();

  RETURN afetados;
END;
$$;

SELECT cron.schedule(
  'video-motion-destravar-fila',
  '*/10 * * * *',
  $$SELECT public.video_motion_destravar_fila();$$
) WHERE NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'video-motion-destravar-fila');