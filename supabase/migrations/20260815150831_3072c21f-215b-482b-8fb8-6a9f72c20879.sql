CREATE TABLE public.video_render_jobs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  telefone text,
  origem text NOT NULL DEFAULT 'whatsapp',
  video_bucket text NOT NULL,
  video_path text NOT NULL,
  segmentos jsonb NOT NULL DEFAULT '[]'::jsonb,
  caption text,
  plataformas text[] NOT NULL DEFAULT ARRAY['instagram','facebook']::text[],
  formato text NOT NULL DEFAULT 'reels',
  status text NOT NULL DEFAULT 'pendente',
  tentativas integer NOT NULL DEFAULT 0,
  erro_mensagem text,
  resultado_bucket text,
  resultado_path text,
  duracao_segundos numeric,
  claimed_at timestamptz,
  concluido_at timestamptz,
  avisado_demora_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE ON public.video_render_jobs TO authenticated;
GRANT ALL ON public.video_render_jobs TO service_role;

ALTER TABLE public.video_render_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios veem seus proprios jobs de video"
ON public.video_render_jobs FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Usuarios atualizam seus proprios jobs de video"
ON public.video_render_jobs FOR UPDATE TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_video_render_jobs_fila
  ON public.video_render_jobs (status, created_at);
CREATE INDEX idx_video_render_jobs_user
  ON public.video_render_jobs (user_id, created_at DESC);

CREATE TRIGGER update_video_render_jobs_updated_at
BEFORE UPDATE ON public.video_render_jobs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();