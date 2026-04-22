
-- Tabela para Reels e Stories agendados
CREATE TABLE public.videos_agendados (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('reels', 'story')),
  video_url TEXT NOT NULL,
  video_nome TEXT,
  caption TEXT,
  canais TEXT[] NOT NULL DEFAULT '{}',
  produto_id UUID,
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'processando', 'publicado', 'erro', 'cancelado')),
  resultado JSONB,
  erro TEXT,
  tentativas INTEGER NOT NULL DEFAULT 0,
  published_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_videos_agendados_due ON public.videos_agendados(status, scheduled_for) WHERE status = 'pendente';
CREATE INDEX idx_videos_agendados_user ON public.videos_agendados(user_id, created_at DESC);

ALTER TABLE public.videos_agendados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users see own scheduled videos"
ON public.videos_agendados FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "users insert own scheduled videos"
ON public.videos_agendados FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users update own scheduled videos"
ON public.videos_agendados FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "users delete own scheduled videos"
ON public.videos_agendados FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE TRIGGER trg_videos_agendados_updated_at
BEFORE UPDATE ON public.videos_agendados
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
