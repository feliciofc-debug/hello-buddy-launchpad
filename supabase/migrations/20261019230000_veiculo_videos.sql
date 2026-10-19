-- Biblioteca de vídeos do estoque AMZ Auto (separada de produto_videos).
CREATE TABLE IF NOT EXISTS public.veiculo_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  veiculo_id uuid NOT NULL REFERENCES public.veiculos_estoque (id) ON DELETE CASCADE,
  video_url text NOT NULL,
  thumbnail_url text,
  titulo text,
  legenda text,
  descricao_ia text,
  duracao_segundos integer,
  tamanho_bytes bigint,
  status text DEFAULT 'pronto',
  publicado_facebook boolean DEFAULT false,
  publicado_instagram boolean DEFAULT false,
  facebook_post_id text,
  instagram_post_id text,
  postado_story_facebook boolean DEFAULT false,
  postado_story_instagram boolean DEFAULT false,
  story_facebook_id text,
  story_instagram_id text,
  postado_story_em timestamptz,
  publicado_em timestamptz,
  whatsapp_link text,
  tiktok_publish_id text,
  linkedin_post_id text,
  criado_em timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS veiculo_videos_user_id_idx ON public.veiculo_videos (user_id);
CREATE INDEX IF NOT EXISTS veiculo_videos_veiculo_id_idx ON public.veiculo_videos (veiculo_id);

ALTER TABLE public.veiculo_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY veiculo_videos_select_own ON public.veiculo_videos
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY veiculo_videos_insert_own ON public.veiculo_videos
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY veiculo_videos_update_own ON public.veiculo_videos
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY veiculo_videos_delete_own ON public.veiculo_videos
  FOR DELETE USING (auth.uid() = user_id);
