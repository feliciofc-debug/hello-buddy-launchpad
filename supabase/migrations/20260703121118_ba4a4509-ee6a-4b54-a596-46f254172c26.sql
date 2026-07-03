-- Tabela de mídias vindas do WhatsApp (biblioteca de conteúdo para remarketing)
CREATE TABLE public.midias_whatsapp (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Origem
  origem TEXT NOT NULL DEFAULT 'whatsapp', -- whatsapp | upload | ia
  whatsapp_message_id TEXT,
  telefone_origem TEXT,
  
  -- Mídia
  tipo TEXT NOT NULL, -- foto | video | audio
  midia_url TEXT NOT NULL,          -- URL no storage
  thumbnail_url TEXT,
  mime_type TEXT,
  tamanho_bytes BIGINT,
  duracao_segundos INT,
  
  -- Contexto (o que o cliente falou/escreveu)
  contexto_original TEXT,           -- transcrição do áudio ou texto enviado
  contexto_transcricao TEXT,        -- se veio de áudio
  
  -- Conteúdo gerado pela IA
  legenda_gerada TEXT,
  hashtags TEXT[],
  tags_ia TEXT[],                   -- ex: ['cliente_feliz','evento','carro']
  
  -- Publicação
  status TEXT NOT NULL DEFAULT 'pendente', -- pendente | aguardando_confirmacao | publicado | erro | arquivado
  plataformas TEXT[] DEFAULT '{}',         -- ['facebook','instagram','tiktok']
  posted_at TIMESTAMPTZ,
  post_ids JSONB DEFAULT '{}'::jsonb,      -- { facebook: 'xxx', instagram: 'yyy' }
  post_urls JSONB DEFAULT '{}'::jsonb,
  erro_mensagem TEXT,
  
  -- Métricas (sync via Meta Insights)
  views INT DEFAULT 0,
  likes INT DEFAULT 0,
  comments INT DEFAULT 0,
  shares INT DEFAULT 0,
  metricas_atualizadas_em TIMESTAMPTZ,
  
  -- Remarketing
  reusos INT DEFAULT 0,
  ultima_repostagem TIMESTAMPTZ,
  midia_pai_id UUID REFERENCES public.midias_whatsapp(id) ON DELETE SET NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_midias_whatsapp_user ON public.midias_whatsapp(user_id, created_at DESC);
CREATE INDEX idx_midias_whatsapp_status ON public.midias_whatsapp(user_id, status);
CREATE INDEX idx_midias_whatsapp_tipo ON public.midias_whatsapp(user_id, tipo);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.midias_whatsapp TO authenticated;
GRANT ALL ON public.midias_whatsapp TO service_role;

ALTER TABLE public.midias_whatsapp ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own midias"
  ON public.midias_whatsapp
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access midias"
  ON public.midias_whatsapp
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER update_midias_whatsapp_updated_at
  BEFORE UPDATE ON public.midias_whatsapp
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();