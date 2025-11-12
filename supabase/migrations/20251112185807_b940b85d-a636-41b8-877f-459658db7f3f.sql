-- ========================================
-- MIGRATION: Refatoração completa do sistema de leads
-- Amzofertas - Sistema de Prospecção BDR/SDR
-- ========================================

-- ========================================
-- TABELA: leads_b2c (Pessoas Físicas - Profissionais)
-- ========================================
CREATE TABLE IF NOT EXISTS leads_b2c (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campanha_id UUID NOT NULL REFERENCES campanhas_prospeccao(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  
  -- Dados do profissional
  nome_completo TEXT NOT NULL,
  profissao TEXT NOT NULL,
  especialidade TEXT,
  
  -- Validação de tipo
  tipo_validado BOOLEAN DEFAULT false,
  validacao_resultado JSONB,
  
  -- Localização
  cidade TEXT NOT NULL,
  estado TEXT NOT NULL,
  bairro TEXT,
  endereco TEXT,
  
  -- Contatos
  email TEXT,
  telefone TEXT,
  whatsapp TEXT,
  
  -- Redes sociais
  linkedin_url TEXT,
  linkedin_id TEXT,
  instagram_username TEXT,
  facebook_url TEXT,
  
  -- Metadados de descoberta
  fonte TEXT NOT NULL,
  fonte_url TEXT,
  fonte_snippet TEXT,
  query_usada TEXT,
  
  -- Pipeline BDR/SDR
  pipeline_status TEXT NOT NULL DEFAULT 'descoberto',
  
  -- Enriquecimento
  enrichment_data JSONB,
  enriched_at TIMESTAMP WITH TIME ZONE,
  
  -- Qualificação
  score INTEGER,
  score_breakdown JSONB,
  qualificacao_motivo TEXT,
  insights TEXT[],
  recomendacao TEXT,
  qualified_at TIMESTAMP WITH TIME ZONE,
  
  -- Sinais de poder aquisitivo
  sinais_poder_aquisitivo TEXT[],
  
  -- Mensagens
  mensagens_geradas JSONB,
  mensagem_selecionada TEXT,
  
  -- Envio e conversão
  enviado_em TIMESTAMP WITH TIME ZONE,
  enviado_para TEXT,
  whatsapp_status TEXT,
  respondeu_em TIMESTAMP WITH TIME ZONE,
  converteu_em TIMESTAMP WITH TIME ZONE,
  
  -- Histórico
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leads_b2c_campanha ON leads_b2c(campanha_id);
CREATE INDEX IF NOT EXISTS idx_leads_b2c_user ON leads_b2c(user_id);
CREATE INDEX IF NOT EXISTS idx_leads_b2c_status ON leads_b2c(pipeline_status);
CREATE INDEX IF NOT EXISTS idx_leads_b2c_score ON leads_b2c(score);
CREATE INDEX IF NOT EXISTS idx_leads_b2c_email ON leads_b2c(email);

-- ========================================
-- TABELA: leads_b2b (Empresas)
-- ========================================
CREATE TABLE IF NOT EXISTS leads_b2b (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campanha_id UUID NOT NULL REFERENCES campanhas_prospeccao(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  
  -- Dados da empresa
  cnpj TEXT NOT NULL UNIQUE,
  razao_social TEXT NOT NULL,
  nome_fantasia TEXT,
  
  -- Validação ICP
  icp_validado BOOLEAN DEFAULT false,
  validacao_icp JSONB,
  
  -- Informações
  setor TEXT,
  porte TEXT,
  situacao TEXT DEFAULT 'ATIVA',
  natureza_juridica TEXT,
  capital_social NUMERIC,
  data_constituicao DATE,
  
  -- Contato empresa
  email TEXT,
  telefone TEXT,
  website TEXT,
  
  -- Contato decisor
  contato_nome TEXT,
  contato_cargo TEXT,
  contato_email TEXT,
  contato_linkedin TEXT,
  
  -- Localização
  cidade TEXT NOT NULL,
  estado TEXT NOT NULL,
  endereco TEXT,
  
  -- Redes sociais
  linkedin_url TEXT,
  instagram_username TEXT,
  facebook_url TEXT,
  
  -- Metadados
  fonte TEXT NOT NULL,
  fonte_url TEXT,
  fonte_snippet TEXT,
  query_usada TEXT,
  
  -- Pipeline
  pipeline_status TEXT NOT NULL DEFAULT 'descoberto',
  
  -- Enriquecimento
  enrichment_data JSONB,
  enriched_at TIMESTAMP WITH TIME ZONE,
  
  -- Qualificação
  score INTEGER,
  score_breakdown JSONB,
  qualificacao_motivo TEXT,
  insights TEXT[],
  recomendacao TEXT,
  qualified_at TIMESTAMP WITH TIME ZONE,
  
  -- Mensagens
  mensagens_geradas JSONB,
  mensagem_selecionada TEXT,
  
  -- Envio
  enviado_em TIMESTAMP WITH TIME ZONE,
  enviado_para TEXT,
  respondeu_em TIMESTAMP WITH TIME ZONE,
  converteu_em TIMESTAMP WITH TIME ZONE,
  
  -- Histórico
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leads_b2b_campanha ON leads_b2b(campanha_id);
CREATE INDEX IF NOT EXISTS idx_leads_b2b_user ON leads_b2b(user_id);
CREATE INDEX IF NOT EXISTS idx_leads_b2b_cnpj ON leads_b2b(cnpj);
CREATE INDEX IF NOT EXISTS idx_leads_b2b_status ON leads_b2b(pipeline_status);
CREATE INDEX IF NOT EXISTS idx_leads_b2b_score ON leads_b2b(score);
CREATE INDEX IF NOT EXISTS idx_leads_b2b_setor ON leads_b2b(setor);

-- ========================================
-- TABELA: pipeline_stages
-- ========================================
CREATE TABLE IF NOT EXISTS pipeline_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  descricao TEXT,
  ordem INTEGER NOT NULL UNIQUE,
  fase TEXT NOT NULL,
  requer_enriquecimento BOOLEAN DEFAULT false,
  requer_score BOOLEAN DEFAULT false,
  score_minimo INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

INSERT INTO pipeline_stages (nome, descricao, ordem, fase, requer_enriquecimento, requer_score) VALUES
('descoberto', 'Lead acabou de ser descoberto', 1, 'bdr', false, false),
('enriquecido', 'Dados enriquecidos (redes sociais)', 2, 'bdr', true, false),
('qualificado', 'Lead foi qualificado', 3, 'sdr', true, true),
('quente', 'Lead pronto para contato', 4, 'sdr', true, true),
('enviado', 'Mensagem enviada', 5, 'depois', true, true),
('respondeu', 'Lead respondeu', 6, 'depois', true, true),
('convertido', 'Lead convertido em cliente', 7, 'depois', true, true)
ON CONFLICT (nome) DO NOTHING;

-- ========================================
-- TABELA: lead_history (Auditoria)
-- ========================================
CREATE TABLE IF NOT EXISTS lead_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL,
  lead_tipo TEXT NOT NULL,
  user_id UUID NOT NULL,
  
  status_anterior TEXT,
  status_novo TEXT,
  motivo TEXT,
  dados_atualizados JSONB,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_history_lead ON lead_history(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_history_user ON lead_history(user_id);

-- ========================================
-- ATUALIZAR: campanhas_prospeccao
-- ========================================
ALTER TABLE campanhas_prospeccao 
ADD COLUMN IF NOT EXISTS pipeline_config JSONB DEFAULT '{}';

-- ========================================
-- ATUALIZAR: icp_configs
-- ========================================
ALTER TABLE icp_configs 
ADD COLUMN IF NOT EXISTS lead_count_b2c INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS lead_count_b2b INTEGER DEFAULT 0;

-- ========================================
-- RLS POLICIES: leads_b2c
-- ========================================
ALTER TABLE leads_b2c ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own leads_b2c"
ON leads_b2c FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own leads_b2c"
ON leads_b2c FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own leads_b2c"
ON leads_b2c FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own leads_b2c"
ON leads_b2c FOR DELETE
USING (auth.uid() = user_id);

-- ========================================
-- RLS POLICIES: leads_b2b
-- ========================================
ALTER TABLE leads_b2b ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own leads_b2b"
ON leads_b2b FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own leads_b2b"
ON leads_b2b FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own leads_b2b"
ON leads_b2b FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own leads_b2b"
ON leads_b2b FOR DELETE
USING (auth.uid() = user_id);

-- ========================================
-- RLS POLICIES: pipeline_stages (público para leitura)
-- ========================================
ALTER TABLE pipeline_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view pipeline stages"
ON pipeline_stages FOR SELECT
USING (true);

-- ========================================
-- RLS POLICIES: lead_history
-- ========================================
ALTER TABLE lead_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own lead history"
ON lead_history FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "System can insert lead history"
ON lead_history FOR INSERT
WITH CHECK (true);

-- ========================================
-- TRIGGERS: updated_at
-- ========================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_leads_b2c_updated_at
BEFORE UPDATE ON leads_b2c
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leads_b2b_updated_at
BEFORE UPDATE ON leads_b2b
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();