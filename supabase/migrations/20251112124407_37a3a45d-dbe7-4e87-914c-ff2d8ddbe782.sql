-- ============================================
-- MÓDULO: ICP CONFIGURATION
-- ============================================

-- Tabela: icp_configs
CREATE TABLE icp_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  
  nome text NOT NULL,
  descricao text,
  tipo text NOT NULL CHECK (tipo IN ('b2b', 'b2c')),
  ativo boolean DEFAULT true,
  
  -- Configuração B2B (CNPJ)
  b2b_config jsonb DEFAULT '{
    "setores": [],
    "portes": [],
    "estados": [],
    "cidades": [],
    "capital_minimo": 0,
    "capital_maximo": null,
    "idade_empresa_min": null,
    "idade_empresa_max": null,
    "situacao": ["ATIVA"],
    "natureza_juridica": []
  }'::jsonb,
  
  -- Configuração B2C (Profissionais)
  b2c_config jsonb DEFAULT '{
    "profissoes": [],
    "especialidades": [],
    "estados": [],
    "cidades": [],
    "bairros_nobres": [],
    "sinais_poder_aquisitivo": [],
    "idade_minima": 30,
    "idade_maxima": 65,
    "patrimonio_minimo": 0
  }'::jsonb,
  
  -- Critérios de qualificação
  score_minimo integer DEFAULT 70,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================
-- MÓDULO: CAMPANHAS
-- ============================================

-- Tabela: campanhas_prospeccao
CREATE TABLE campanhas_prospeccao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  icp_config_id uuid REFERENCES icp_configs,
  
  nome text NOT NULL,
  descricao text,
  tipo text NOT NULL CHECK (tipo IN ('b2b', 'b2c')),
  
  status text DEFAULT 'rascunho' CHECK (status IN (
    'rascunho', 'ativa', 'pausada', 'concluida', 'cancelada'
  )),
  
  -- Metas
  meta_leads_total integer,
  meta_leads_qualificados integer,
  meta_leads_por_dia integer,
  
  -- Automação
  automatica boolean DEFAULT false,
  frequencia text,
  proxima_execucao timestamptz,
  
  -- Distribuição entre vendedores
  distribuicao jsonb DEFAULT '[]'::jsonb,
  
  -- Estatísticas
  stats jsonb DEFAULT '{
    "descobertos": 0,
    "enriquecidos": 0,
    "qualificados": 0,
    "mensagens_geradas": 0,
    "mensagens_enviadas": 0,
    "respostas": 0,
    "conversoes": 0
  }'::jsonb,
  
  iniciada_em timestamptz,
  concluida_em timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================
-- MÓDULO: LEADS DESCOBERTOS
-- ============================================

-- Tabela: leads_descobertos
CREATE TABLE leads_descobertos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campanha_id uuid REFERENCES campanhas_prospeccao,
  user_id uuid REFERENCES auth.users NOT NULL,
  
  tipo text NOT NULL CHECK (tipo IN ('b2b', 'b2c')),
  
  -- B2B: dados da empresa
  cnpj text,
  razao_social text,
  nome_fantasia text,
  
  -- B2C: dados do profissional
  nome_profissional text,
  profissao text,
  especialidade text,
  
  -- Comum
  cidade text,
  estado text,
  
  -- Fonte da descoberta
  fonte text,
  fonte_url text,
  fonte_snippet text,
  query_usada text,
  
  -- Status do processamento
  status text DEFAULT 'descoberto' CHECK (status IN (
    'descoberto',
    'enriquecendo',
    'enriquecido',
    'qualificando',
    'qualificado',
    'rejeitado',
    'mensagem_gerada',
    'mensagem_enviada',
    'respondeu',
    'convertido'
  )),
  
  -- Enriquecimento
  linkedin_url text,
  instagram_username text,
  facebook_url text,
  telefone text,
  email text,
  enrichment_data jsonb,
  enriched_at timestamptz,
  
  -- Qualificação
  score integer,
  score_breakdown jsonb,
  justificativa text,
  insights text[],
  recomendacao text CHECK (recomendacao IN (
    'contatar_agora', 'aguardar', 'descartar'
  )),
  qualified_at timestamptz,
  
  -- Mensagens
  mensagens_geradas jsonb,
  mensagem_selecionada text,
  messages_generated_at timestamptz,
  
  -- Envio
  enviado_para text,
  enviado_em timestamptz,
  whatsapp_status text,
  
  -- Interação
  respondeu_em timestamptz,
  converteu_em timestamptz,
  
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_leads_campanha ON leads_descobertos(campanha_id);
CREATE INDEX idx_leads_status ON leads_descobertos(status);
CREATE INDEX idx_leads_score ON leads_descobertos(score DESC NULLS LAST);
CREATE INDEX idx_leads_tipo ON leads_descobertos(tipo);
CREATE INDEX idx_leads_user ON leads_descobertos(user_id);

-- ============================================
-- MÓDULO: EXECUÇÕES DE CAMPANHA
-- ============================================

-- Tabela: campanha_execucoes
CREATE TABLE campanha_execucoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campanha_id uuid REFERENCES campanhas_prospeccao,
  
  tipo text NOT NULL,
  status text DEFAULT 'iniciada' CHECK (status IN (
    'iniciada', 'processando', 'concluida', 'erro'
  )),
  
  -- Progresso
  total_items integer DEFAULT 0,
  processados integer DEFAULT 0,
  sucesso integer DEFAULT 0,
  erros integer DEFAULT 0,
  
  -- Logs
  log jsonb DEFAULT '[]'::jsonb,
  erro_mensagem text,
  
  iniciada_em timestamptz DEFAULT now(),
  concluida_em timestamptz
);

-- ============================================
-- RLS POLICIES
-- ============================================

-- icp_configs
ALTER TABLE icp_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own ICP configs"
  ON icp_configs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own ICP configs"
  ON icp_configs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own ICP configs"
  ON icp_configs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own ICP configs"
  ON icp_configs FOR DELETE
  USING (auth.uid() = user_id);

-- campanhas_prospeccao
ALTER TABLE campanhas_prospeccao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own campaigns"
  ON campanhas_prospeccao FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own campaigns"
  ON campanhas_prospeccao FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own campaigns"
  ON campanhas_prospeccao FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own campaigns"
  ON campanhas_prospeccao FOR DELETE
  USING (auth.uid() = user_id);

-- leads_descobertos
ALTER TABLE leads_descobertos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own leads"
  ON leads_descobertos FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own leads"
  ON leads_descobertos FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own leads"
  ON leads_descobertos FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own leads"
  ON leads_descobertos FOR DELETE
  USING (auth.uid() = user_id);

-- campanha_execucoes
ALTER TABLE campanha_execucoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view executions of their campaigns"
  ON campanha_execucoes FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM campanhas_prospeccao
    WHERE campanhas_prospeccao.id = campanha_execucoes.campanha_id
    AND campanhas_prospeccao.user_id = auth.uid()
  ));

CREATE POLICY "System can manage executions"
  ON campanha_execucoes FOR ALL
  USING (true);

-- Triggers para updated_at
CREATE TRIGGER update_icp_configs_updated_at
  BEFORE UPDATE ON icp_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campanhas_prospeccao_updated_at
  BEFORE UPDATE ON campanhas_prospeccao
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();