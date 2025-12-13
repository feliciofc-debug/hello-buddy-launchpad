
-- Tabela de leads imobiliários enriquecidos
CREATE TABLE leads_imoveis_enriquecidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  projeto_id uuid,
  
  -- Dados básicos (Google Reviews)
  nome text NOT NULL,
  foto_url text,
  google_profile_url text,
  
  -- Atividade imobiliária
  corretoras_visitadas jsonb DEFAULT '[]',
  total_corretoras integer DEFAULT 0,
  ultima_visita_dias integer,
  
  -- Interesse identificado (IA analisa reviews)
  tipo_imovel_desejado text,
  quartos_desejado integer,
  localizacao_desejada text,
  orcamento_min numeric,
  orcamento_max numeric,
  objecoes text[],
  
  -- LinkedIn (Apify)
  linkedin_url text,
  linkedin_foto text,
  cargo text,
  empresa text,
  setor text,
  experiencia_anos integer,
  formacao text,
  linkedin_connections text,
  
  -- Instagram (Apify)
  instagram_username text,
  instagram_url text,
  instagram_foto text,
  instagram_followers integer,
  instagram_posts integer,
  instagram_bio text,
  instagram_interesses text[],
  instagram_ultima_atividade timestamp with time zone,
  
  -- Facebook (Apify)
  facebook_url text,
  facebook_foto text,
  facebook_cidade text,
  facebook_trabalho text,
  facebook_clubes text[],
  
  -- Análise AMZ (consolidado)
  score_total integer DEFAULT 0,
  qualificacao text DEFAULT 'MORNO',
  renda_estimada numeric,
  patrimonio_estimado numeric,
  probabilidade_compra integer DEFAULT 0,
  telefone text,
  
  -- Enriquecimento
  dados_completos boolean DEFAULT false,
  linkedin_encontrado boolean DEFAULT false,
  instagram_encontrado boolean DEFAULT false,
  facebook_encontrado boolean DEFAULT false,
  data_enriquecimento timestamp with time zone,
  
  -- Status
  status text DEFAULT 'novo',
  contatado_por text,
  data_contato timestamp with time zone,
  observacoes text,
  
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Índices
CREATE INDEX idx_leads_imoveis_user ON leads_imoveis_enriquecidos(user_id);
CREATE INDEX idx_leads_imoveis_score ON leads_imoveis_enriquecidos(score_total DESC);
CREATE INDEX idx_leads_imoveis_status ON leads_imoveis_enriquecidos(status);
CREATE INDEX idx_leads_imoveis_qualif ON leads_imoveis_enriquecidos(qualificacao);

-- RLS
ALTER TABLE leads_imoveis_enriquecidos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own leads_imoveis" ON leads_imoveis_enriquecidos
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own leads_imoveis" ON leads_imoveis_enriquecidos
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own leads_imoveis" ON leads_imoveis_enriquecidos
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own leads_imoveis" ON leads_imoveis_enriquecidos
  FOR DELETE USING (auth.uid() = user_id);
