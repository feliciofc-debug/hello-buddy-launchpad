-- Tabela para biblioteca de campanhas (produtos + fotos + dados da campanha)
CREATE TABLE public.biblioteca_campanhas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  produto_id UUID REFERENCES public.produtos(id) ON DELETE SET NULL,
  campanha_id UUID REFERENCES public.campanhas_recorrentes(id) ON DELETE SET NULL,
  
  -- Dados do produto no momento da campanha
  produto_nome TEXT NOT NULL,
  produto_descricao TEXT,
  produto_preco NUMERIC,
  produto_imagem_url TEXT,
  produto_imagens JSONB DEFAULT '[]'::jsonb,
  produto_categoria TEXT,
  produto_link_marketplace TEXT,
  
  -- Dados da campanha
  campanha_nome TEXT NOT NULL,
  mensagem_template TEXT,
  frequencia TEXT,
  listas_ids TEXT[],
  
  -- Métricas
  total_enviados INTEGER DEFAULT 0,
  total_respostas INTEGER DEFAULT 0,
  total_conversoes INTEGER DEFAULT 0,
  taxa_resposta NUMERIC DEFAULT 0,
  taxa_conversao NUMERIC DEFAULT 0,
  
  -- Status e remarketing
  status TEXT DEFAULT 'ativa',
  disponivel_remarketing BOOLEAN DEFAULT true,
  enviado_google_ads BOOLEAN DEFAULT false,
  google_ads_campaign_id TEXT,
  
  -- Timestamps
  data_campanha TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.biblioteca_campanhas ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can view own biblioteca_campanhas"
ON public.biblioteca_campanhas FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own biblioteca_campanhas"
ON public.biblioteca_campanhas FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own biblioteca_campanhas"
ON public.biblioteca_campanhas FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own biblioteca_campanhas"
ON public.biblioteca_campanhas FOR DELETE
USING (auth.uid() = user_id);

-- Index para performance
CREATE INDEX idx_biblioteca_campanhas_user_id ON public.biblioteca_campanhas(user_id);
CREATE INDEX idx_biblioteca_campanhas_produto_id ON public.biblioteca_campanhas(produto_id);
CREATE INDEX idx_biblioteca_campanhas_status ON public.biblioteca_campanhas(status);