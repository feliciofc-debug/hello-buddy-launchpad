-- ===================================================================
-- SISTEMA DE VOICE AI CALLING - TABELAS COMPLETAS
-- ===================================================================

-- ===================================================================
-- TABELA: voice_calls (histórico de chamadas)
-- ===================================================================
CREATE TABLE IF NOT EXISTS voice_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL,
  lead_type TEXT NOT NULL CHECK (lead_type IN ('b2b', 'b2c')),
  campanha_id UUID NOT NULL REFERENCES campanhas_prospeccao(id) ON DELETE CASCADE,
  call_sid TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'ringing', 'in-progress', 'completed', 'failed', 'no-answer', 'busy')),
  duration INTEGER CHECK (duration >= 0),
  recording_url TEXT,
  transcription TEXT,
  ai_analysis JSONB DEFAULT '{}'::jsonb,
  sentiment_score FLOAT CHECK (sentiment_score BETWEEN -1 AND 1),
  lead_qualified BOOLEAN DEFAULT FALSE,
  meeting_scheduled BOOLEAN DEFAULT FALSE,
  meeting_datetime TIMESTAMP WITH TIME ZONE,
  meeting_google_event_id TEXT,
  objections TEXT[] DEFAULT ARRAY[]::TEXT[],
  next_action TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  user_id UUID NOT NULL
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_voice_calls_campanha ON voice_calls(campanha_id);
CREATE INDEX IF NOT EXISTS idx_voice_calls_lead ON voice_calls(lead_id, lead_type);
CREATE INDEX IF NOT EXISTS idx_voice_calls_status ON voice_calls(status) WHERE status IN ('queued', 'in-progress');
CREATE INDEX IF NOT EXISTS idx_voice_calls_user ON voice_calls(user_id);
CREATE INDEX IF NOT EXISTS idx_voice_calls_created ON voice_calls(created_at DESC);

-- RLS
ALTER TABLE voice_calls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own calls" ON voice_calls;
CREATE POLICY "Users can view their own calls"
  ON voice_calls FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own calls" ON voice_calls;
CREATE POLICY "Users can insert their own calls"
  ON voice_calls FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own calls" ON voice_calls;
CREATE POLICY "Users can update their own calls"
  ON voice_calls FOR UPDATE
  USING (auth.uid() = user_id);

-- ===================================================================
-- TABELA: voice_scripts (templates de conversa)
-- ===================================================================
CREATE TABLE IF NOT EXISTS voice_scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  tipo_icp TEXT NOT NULL CHECK (tipo_icp IN ('b2b', 'b2c', 'medicos', 'advogados', 'empresas', 'concessionarias', 'padarias', 'farmacias', 'supermercados', 'distribuidoras', 'estetica', 'clinicas')),
  script_intro TEXT NOT NULL,
  script_qualificacao TEXT NOT NULL,
  script_agendamento TEXT NOT NULL,
  script_objecoes JSONB DEFAULT '{}'::jsonb,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_voice_scripts_user ON voice_scripts(user_id);
CREATE INDEX IF NOT EXISTS idx_voice_scripts_tipo ON voice_scripts(tipo_icp) WHERE active = TRUE;

-- Trigger para updated_at já existe (update_updated_at_column)
DROP TRIGGER IF EXISTS update_voice_scripts_updated_at ON voice_scripts;
CREATE TRIGGER update_voice_scripts_updated_at
  BEFORE UPDATE ON voice_scripts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE voice_scripts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own scripts" ON voice_scripts;
CREATE POLICY "Users can manage their own scripts"
  ON voice_scripts FOR ALL
  USING (auth.uid() = user_id);

-- ===================================================================
-- TABELA: call_queue (fila de chamadas)
-- ===================================================================
CREATE TABLE IF NOT EXISTS call_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campanha_id UUID NOT NULL REFERENCES campanhas_prospeccao(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL,
  lead_type TEXT NOT NULL CHECK (lead_type IN ('b2b', 'b2c')),
  priority INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'calling', 'completed', 'failed', 'skipped')),
  scheduled_for TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  attempts INTEGER DEFAULT 0,
  last_attempt_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_call_queue_campanha ON call_queue(campanha_id);
CREATE INDEX IF NOT EXISTS idx_call_queue_status ON call_queue(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_call_queue_scheduled ON call_queue(scheduled_for) WHERE status = 'pending';

-- RLS
ALTER TABLE call_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own queue" ON call_queue;
CREATE POLICY "Users can manage their own queue"
  ON call_queue FOR ALL
  USING (auth.uid() = user_id);

-- ===================================================================
-- TABELA: meetings (reuniões agendadas)
-- ===================================================================
CREATE TABLE IF NOT EXISTS meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL,
  lead_type TEXT NOT NULL CHECK (lead_type IN ('b2b', 'b2c')),
  campanha_id UUID NOT NULL REFERENCES campanhas_prospeccao(id) ON DELETE CASCADE,
  scheduled_by TEXT DEFAULT 'voice_ai',
  meeting_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
  duration INTEGER DEFAULT 30,
  google_event_id TEXT,
  google_meet_link TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show')),
  reminder_sent BOOLEAN DEFAULT FALSE,
  confirmation_sent BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_meetings_campanha ON meetings(campanha_id);
CREATE INDEX IF NOT EXISTS idx_meetings_datetime ON meetings(meeting_datetime) WHERE status IN ('scheduled', 'confirmed');
CREATE INDEX IF NOT EXISTS idx_meetings_lead ON meetings(lead_id, lead_type);

-- RLS
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own meetings" ON meetings;
CREATE POLICY "Users can manage their own meetings"
  ON meetings FOR ALL
  USING (auth.uid() = user_id);

-- ===================================================================
-- TABELA: products_stock (estoque de produtos)
-- ===================================================================
CREATE TABLE IF NOT EXISTS products_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  sku TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  price NUMERIC(12,2) NOT NULL CHECK (price >= 0),
  cost NUMERIC(12,2) CHECK (cost >= 0),
  qty INTEGER DEFAULT 0 CHECK (qty >= 0),
  specs JSONB DEFAULT '{}'::jsonb,
  img_url TEXT,
  description_short TEXT,
  description_long TEXT,
  objection_handler JSONB DEFAULT '{}'::jsonb,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_user ON products_stock(user_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products_stock(category) WHERE active = TRUE;
CREATE INDEX IF NOT EXISTS idx_products_sku ON products_stock(sku);

DROP TRIGGER IF EXISTS update_products_stock_updated_at ON products_stock;
CREATE TRIGGER update_products_stock_updated_at
  BEFORE UPDATE ON products_stock
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE products_stock ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own products" ON products_stock;
CREATE POLICY "Users can manage their own products"
  ON products_stock FOR ALL
  USING (auth.uid() = user_id);

-- ===================================================================
-- TABELA: user_market_config (configuração de mercado do usuário)
-- ===================================================================
CREATE TABLE IF NOT EXISTS user_market_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  mercado TEXT NOT NULL,
  descricao TEXT,
  nichos TEXT[] DEFAULT ARRAY[]::TEXT[],
  base_prompt TEXT,
  faixa_preco_min NUMERIC(12,2),
  faixa_preco_max NUMERIC(12,2),
  formas_pagamento TEXT[] DEFAULT ARRAY[]::TEXT[],
  regioes TEXT[] DEFAULT ARRAY[]::TEXT[],
  prazo_entrega_dias INTEGER,
  ia_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DROP TRIGGER IF EXISTS update_user_market_config_updated_at ON user_market_config;
CREATE TRIGGER update_user_market_config_updated_at
  BEFORE UPDATE ON user_market_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE user_market_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own market config" ON user_market_config;
CREATE POLICY "Users can manage their own market config"
  ON user_market_config FOR ALL
  USING (auth.uid() = user_id);