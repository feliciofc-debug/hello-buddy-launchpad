
-- Tabela para armazenar seguidores de concorrentes
CREATE TABLE public.seguidores_concorrentes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  
  -- Instagram
  instagram_username text NOT NULL,
  instagram_url text,
  nome_completo text,
  foto_url text,
  bio text,
  seguidores integer DEFAULT 0,
  
  -- Localização
  cidade_detectada text,
  estado_detectado text,
  
  -- Qual imobiliária segue
  seguindo_imobiliaria text,
  imobiliaria_url text,
  
  -- LinkedIn (enriquecido)
  linkedin_url text,
  linkedin_encontrado boolean DEFAULT false,
  cargo text,
  empresa text,
  
  -- Score
  score_total integer DEFAULT 0,
  qualificacao text DEFAULT 'MORNO',
  
  -- Status
  status text DEFAULT 'novo',
  contatado boolean DEFAULT false,
  
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.seguidores_concorrentes ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own seguidores"
  ON public.seguidores_concorrentes
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own seguidores"
  ON public.seguidores_concorrentes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own seguidores"
  ON public.seguidores_concorrentes
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own seguidores"
  ON public.seguidores_concorrentes
  FOR DELETE
  USING (auth.uid() = user_id);

-- Index for faster queries
CREATE INDEX idx_seguidores_user_id ON public.seguidores_concorrentes(user_id);
CREATE INDEX idx_seguidores_instagram ON public.seguidores_concorrentes(instagram_username);
