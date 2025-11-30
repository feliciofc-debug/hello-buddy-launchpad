-- Criar tabela de vendedores
CREATE TABLE IF NOT EXISTS vendedores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  foto_url TEXT,
  especialidade TEXT,
  meta_mensal DECIMAL(10,2) DEFAULT 0,
  comissao_percentual DECIMAL(5,2) DEFAULT 5.0,
  ativo BOOLEAN DEFAULT true,
  whatsapp TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Adicionar vendedor_id nas tabelas existentes
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS vendedor_id UUID REFERENCES vendedores(id);
ALTER TABLE leads_b2c ADD COLUMN IF NOT EXISTS vendedor_id UUID REFERENCES vendedores(id);
ALTER TABLE leads_b2b ADD COLUMN IF NOT EXISTS vendedor_id UUID REFERENCES vendedores(id);
ALTER TABLE whatsapp_conversations ADD COLUMN IF NOT EXISTS vendedor_id UUID REFERENCES vendedores(id);
ALTER TABLE campanhas_prospeccao ADD COLUMN IF NOT EXISTS vendedor_id UUID REFERENCES vendedores(id);
ALTER TABLE campanhas_recorrentes ADD COLUMN IF NOT EXISTS vendedor_id UUID REFERENCES vendedores(id);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_produtos_vendedor ON produtos(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_leads_b2c_vendedor ON leads_b2c(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_leads_b2b_vendedor ON leads_b2b(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_conversations_vendedor ON whatsapp_conversations(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_campanhas_prosp_vendedor ON campanhas_prospeccao(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_campanhas_rec_vendedor ON campanhas_recorrentes(vendedor_id);

-- RLS para vendedores
ALTER TABLE vendedores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver vendedores da empresa"
  ON vendedores FOR SELECT
  USING (true);

CREATE POLICY "Usuários autenticados podem inserir vendedores"
  ON vendedores FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Usuários podem atualizar vendedores"
  ON vendedores FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Usuários podem deletar vendedores"
  ON vendedores FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- Tabela de metas e comissões
CREATE TABLE IF NOT EXISTS vendedor_metas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendedor_id UUID REFERENCES vendedores(id) ON DELETE CASCADE,
  mes DATE NOT NULL,
  meta_vendas DECIMAL(10,2) DEFAULT 0,
  vendas_realizadas DECIMAL(10,2) DEFAULT 0,
  comissao_gerada DECIMAL(10,2) DEFAULT 0,
  percentual_atingido DECIMAL(5,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(vendedor_id, mes)
);

ALTER TABLE vendedor_metas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver metas"
  ON vendedor_metas FOR SELECT
  USING (true);

CREATE POLICY "Usuários podem gerenciar metas"
  ON vendedor_metas FOR ALL
  USING (auth.uid() IS NOT NULL);

-- Tabela de atribuições de leads
CREATE TABLE IF NOT EXISTS lead_atribuicoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL,
  lead_tipo TEXT NOT NULL,
  vendedor_id UUID REFERENCES vendedores(id),
  atribuido_por UUID REFERENCES auth.users(id),
  motivo TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_atribuicoes_vendedor ON lead_atribuicoes(vendedor_id);
CREATE INDEX idx_atribuicoes_lead ON lead_atribuicoes(lead_id, lead_tipo);

ALTER TABLE lead_atribuicoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver atribuições"
  ON lead_atribuicoes FOR SELECT
  USING (true);

CREATE POLICY "Usuários podem criar atribuições"
  ON lead_atribuicoes FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);