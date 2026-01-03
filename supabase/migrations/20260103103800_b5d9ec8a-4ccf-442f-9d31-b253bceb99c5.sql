-- ============================================
-- FASE 2: TABELAS CASHBACK + OFERTAS + PREFERÊNCIAS
-- ============================================

-- 1. CASHBACK (saldos dos clientes)
CREATE TABLE IF NOT EXISTS afiliado_cashback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone VARCHAR(20) NOT NULL UNIQUE,
  saldo_atual DECIMAL(10,2) DEFAULT 0.00,
  total_acumulado DECIMAL(10,2) DEFAULT 0.00,
  total_resgatado DECIMAL(10,2) DEFAULT 0.00,
  compras_total INTEGER DEFAULT 0,
  valor_compras_total DECIMAL(10,2) DEFAULT 0.00,
  ultimo_resgate_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_afiliado_cashback_phone ON afiliado_cashback(phone);
CREATE INDEX IF NOT EXISTS idx_afiliado_cashback_saldo ON afiliado_cashback(saldo_atual);

-- Enable RLS
ALTER TABLE afiliado_cashback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sistema gerencia cashback" ON afiliado_cashback FOR ALL USING (true);

-- 2. CASHBACK HISTÓRICO (transações)
CREATE TABLE IF NOT EXISTS afiliado_cashback_historico (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone VARCHAR(20) NOT NULL,
  tipo VARCHAR(20) NOT NULL,
  valor DECIMAL(10,2) NOT NULL,
  saldo_anterior DECIMAL(10,2) DEFAULT 0.00,
  saldo_novo DECIMAL(10,2) DEFAULT 0.00,
  descricao TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_afiliado_cashback_hist_phone ON afiliado_cashback_historico(phone);
CREATE INDEX IF NOT EXISTS idx_afiliado_cashback_hist_tipo ON afiliado_cashback_historico(tipo);
CREATE INDEX IF NOT EXISTS idx_afiliado_cashback_hist_created ON afiliado_cashback_historico(created_at);

ALTER TABLE afiliado_cashback_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sistema gerencia cashback_historico" ON afiliado_cashback_historico FOR ALL USING (true);

-- 3. OFERTAS (produtos para enviar)
CREATE TABLE IF NOT EXISTS afiliado_ofertas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo VARCHAR(255) NOT NULL,
  descricao TEXT,
  categoria VARCHAR(50) NOT NULL,
  produto VARCHAR(255),
  marca VARCHAR(100),
  preco_original DECIMAL(10,2) NOT NULL,
  preco_oferta DECIMAL(10,2) NOT NULL,
  desconto_percent INTEGER,
  url_afiliado TEXT NOT NULL,
  loja VARCHAR(50) NOT NULL,
  imagem_url TEXT,
  ativa BOOLEAN DEFAULT true,
  validade_inicio TIMESTAMPTZ,
  validade_fim TIMESTAMPTZ,
  total_enviados INTEGER DEFAULT 0,
  total_cliques INTEGER DEFAULT 0,
  total_vendas INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_afiliado_ofertas_categoria ON afiliado_ofertas(categoria);
CREATE INDEX IF NOT EXISTS idx_afiliado_ofertas_ativa ON afiliado_ofertas(ativa);
CREATE INDEX IF NOT EXISTS idx_afiliado_ofertas_loja ON afiliado_ofertas(loja);

ALTER TABLE afiliado_ofertas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sistema gerencia ofertas" ON afiliado_ofertas FOR ALL USING (true);

-- 4. OFERTAS ENVIADAS (histórico de envios)
CREATE TABLE IF NOT EXISTS afiliado_ofertas_enviadas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  oferta_id UUID REFERENCES afiliado_ofertas(id),
  phone VARCHAR(20) NOT NULL,
  enviado_at TIMESTAMPTZ DEFAULT NOW(),
  clicou BOOLEAN DEFAULT false,
  clicou_at TIMESTAMPTZ,
  comprou BOOLEAN DEFAULT false,
  comprou_at TIMESTAMPTZ,
  valor_compra DECIMAL(10,2),
  feedback VARCHAR(50)
);

CREATE INDEX IF NOT EXISTS idx_afiliado_ofertas_env_oferta ON afiliado_ofertas_enviadas(oferta_id);
CREATE INDEX IF NOT EXISTS idx_afiliado_ofertas_env_phone ON afiliado_ofertas_enviadas(phone);
CREATE INDEX IF NOT EXISTS idx_afiliado_ofertas_env_enviado ON afiliado_ofertas_enviadas(enviado_at);

ALTER TABLE afiliado_ofertas_enviadas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sistema gerencia ofertas_enviadas" ON afiliado_ofertas_enviadas FOR ALL USING (true);

-- 5. PREFERÊNCIAS DO CLIENTE (categorias de interesse)
CREATE TABLE IF NOT EXISTS afiliado_cliente_preferencias (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone VARCHAR(20) NOT NULL UNIQUE,
  categorias_ativas JSONB DEFAULT '[]',
  categorias_bloqueadas JSONB DEFAULT '[]',
  freq_ofertas VARCHAR(20) DEFAULT 'semanal',
  ultima_oferta_enviada_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_afiliado_prefs_phone ON afiliado_cliente_preferencias(phone);

ALTER TABLE afiliado_cliente_preferencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sistema gerencia preferencias" ON afiliado_cliente_preferencias FOR ALL USING (true);

-- ============================================
-- COMENTÁRIOS
-- ============================================
COMMENT ON TABLE afiliado_cashback IS 'Saldos de cashback dos clientes (2% por compra)';
COMMENT ON TABLE afiliado_cashback_historico IS 'Histórico de transações de cashback';
COMMENT ON TABLE afiliado_ofertas IS 'Ofertas disponíveis para envio personalizado';
COMMENT ON TABLE afiliado_ofertas_enviadas IS 'Log de ofertas enviadas aos clientes';
COMMENT ON TABLE afiliado_cliente_preferencias IS 'Preferências de categorias dos clientes';