-- ===================================
-- TABELA: fontes_dados
-- ===================================
CREATE TABLE IF NOT EXISTS fontes_dados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(100) NOT NULL,
  tipo VARCHAR(50) NOT NULL,
  url_base TEXT,
  requer_auth BOOLEAN DEFAULT false,
  limite_diario INT,
  custo_por_lead DECIMAL(10,2) DEFAULT 0,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now()
);

INSERT INTO fontes_dados (nome, tipo, url_base, requer_auth, limite_diario, custo_por_lead) VALUES
('CFM', 'scraping', 'https://portal.cfm.org.br', false, 10000, 0),
('OAB', 'scraping', 'https://cna.oab.org.br', false, 5000, 0),
('Facebook', 'api', 'https://graph.facebook.com', true, 5000, 0),
('Instagram', 'scraping', 'https://www.instagram.com', false, 3000, 0),
('Receita Federal', 'api', 'https://brasilapi.com.br/api/cnpj/v1', false, 10000, 0);

-- ===================================
-- ATUALIZAR: icp_configs
-- ===================================
ALTER TABLE icp_configs ADD COLUMN IF NOT EXISTS fontes_habilitadas JSONB DEFAULT '["CFM", "Facebook"]';
ALTER TABLE icp_configs ADD COLUMN IF NOT EXISTS filtros_avancados JSONB DEFAULT '{}';

-- ===================================
-- TABELA: campanhas_multiplas_fontes
-- ===================================
CREATE TABLE IF NOT EXISTS campanhas_multiplas_fontes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campanha_id UUID REFERENCES campanhas_prospeccao(id) ON DELETE CASCADE,
  fonte VARCHAR(50) NOT NULL,
  query_utilizada TEXT,
  leads_descobertos INT DEFAULT 0,
  leads_enriquecidos INT DEFAULT 0,
  custo_total DECIMAL(10,2) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'pendente',
  executada_em TIMESTAMP,
  proxima_execucao TIMESTAMP,
  created_at TIMESTAMP DEFAULT now()
);

-- ===================================
-- ATUALIZAR: leads_b2c
-- ===================================
ALTER TABLE leads_b2c ADD COLUMN IF NOT EXISTS crm VARCHAR(50);
ALTER TABLE leads_b2c ADD COLUMN IF NOT EXISTS oab VARCHAR(50);
ALTER TABLE leads_b2c ADD COLUMN IF NOT EXISTS crea VARCHAR(50);
ALTER TABLE leads_b2c ADD COLUMN IF NOT EXISTS tem_consultorio BOOLEAN DEFAULT false;
ALTER TABLE leads_b2c ADD COLUMN IF NOT EXISTS site_url TEXT;
ALTER TABLE leads_b2c ADD COLUMN IF NOT EXISTS instagram_seguidores INT;
ALTER TABLE leads_b2c ADD COLUMN IF NOT EXISTS facebook_id VARCHAR(100);
ALTER TABLE leads_b2c ADD COLUMN IF NOT EXISTS dados_enriquecidos JSONB DEFAULT '{}';
ALTER TABLE leads_b2c ADD COLUMN IF NOT EXISTS anos_formado INT;

-- ===================================
-- ATUALIZAR: leads_b2b
-- ===================================
ALTER TABLE leads_b2b ADD COLUMN IF NOT EXISTS num_funcionarios INT;
ALTER TABLE leads_b2b ADD COLUMN IF NOT EXISTS faturamento_estimado DECIMAL(15,2);
ALTER TABLE leads_b2b ADD COLUMN IF NOT EXISTS socios JSONB DEFAULT '[]';
ALTER TABLE leads_b2b ADD COLUMN IF NOT EXISTS decisor_nome VARCHAR(255);
ALTER TABLE leads_b2b ADD COLUMN IF NOT EXISTS decisor_cargo VARCHAR(100);
ALTER TABLE leads_b2b ADD COLUMN IF NOT EXISTS site_url TEXT;
ALTER TABLE leads_b2b ADD COLUMN IF NOT EXISTS dados_enriquecidos JSONB DEFAULT '{}';

-- ===================================
-- ÍNDICES
-- ===================================
CREATE INDEX IF NOT EXISTS idx_leads_b2c_score ON leads_b2c(score DESC);
CREATE INDEX IF NOT EXISTS idx_leads_b2c_pipeline ON leads_b2c(pipeline_status);
CREATE INDEX IF NOT EXISTS idx_leads_b2c_campanha ON leads_b2c(campanha_id);
CREATE INDEX IF NOT EXISTS idx_leads_b2b_score ON leads_b2b(score DESC);
CREATE INDEX IF NOT EXISTS idx_campanhas_fonte ON campanhas_multiplas_fontes(campanha_id, fonte);