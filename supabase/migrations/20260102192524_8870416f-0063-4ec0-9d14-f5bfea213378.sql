
-- ============================================
-- SISTEMA EBOOKS AFILIADOS
-- Database Schema v1.0 - 100% ISOLADO
-- ============================================

-- ============================================
-- TABELA 1: afiliado_user_states
-- Gerencia o estado do usuário no fluxo
-- ============================================

CREATE TABLE IF NOT EXISTS afiliado_user_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(20) UNIQUE NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'idle',
  state JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_afiliado_user_states_phone ON afiliado_user_states(phone);
CREATE INDEX idx_afiliado_user_states_status ON afiliado_user_states(status);
CREATE INDEX idx_afiliado_user_states_updated ON afiliado_user_states(updated_at);

COMMENT ON TABLE afiliado_user_states IS 'Estado temporário do usuário no fluxo de eBooks - Sistema Afiliados';
COMMENT ON COLUMN afiliado_user_states.status IS 'Status: idle, aguardando_comprovante, aguardando_escolha, processando';

-- ============================================
-- TABELA 2: afiliado_ebook_deliveries
-- Histórico completo de entregas
-- ============================================

CREATE TABLE IF NOT EXISTS afiliado_ebook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(20) NOT NULL,
  ebook_id UUID REFERENCES afiliado_ebooks(id),
  ebook_titulo VARCHAR(200) NOT NULL,
  ebook_filename VARCHAR(200) NOT NULL,
  loja VARCHAR(50),
  valor_compra DECIMAL(10,2),
  categoria VARCHAR(50),
  produto TEXT,
  comprovante_url TEXT,
  user_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_afiliado_deliveries_phone ON afiliado_ebook_deliveries(phone);
CREATE INDEX idx_afiliado_deliveries_ebook ON afiliado_ebook_deliveries(ebook_id);
CREATE INDEX idx_afiliado_deliveries_loja ON afiliado_ebook_deliveries(loja);
CREATE INDEX idx_afiliado_deliveries_user ON afiliado_ebook_deliveries(user_id);
CREATE INDEX idx_afiliado_deliveries_created ON afiliado_ebook_deliveries(created_at);

COMMENT ON TABLE afiliado_ebook_deliveries IS 'Registro de todos os eBooks entregues - Sistema Afiliados';

-- ============================================
-- TABELA 3: afiliado_analytics_ebooks
-- Eventos e métricas do sistema
-- ============================================

CREATE TABLE IF NOT EXISTS afiliado_analytics_ebooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evento VARCHAR(50) NOT NULL,
  cliente_phone VARCHAR(20),
  loja VARCHAR(50),
  valor DECIMAL(10,2),
  categoria VARCHAR(50),
  ebook_id UUID,
  produto TEXT,
  motivo TEXT,
  confianca INTEGER,
  user_id UUID,
  metadata JSONB DEFAULT '{}',
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_afiliado_analytics_evento ON afiliado_analytics_ebooks(evento);
CREATE INDEX idx_afiliado_analytics_cliente ON afiliado_analytics_ebooks(cliente_phone);
CREATE INDEX idx_afiliado_analytics_timestamp ON afiliado_analytics_ebooks(timestamp);
CREATE INDEX idx_afiliado_analytics_user ON afiliado_analytics_ebooks(user_id);

COMMENT ON TABLE afiliado_analytics_ebooks IS 'Log de eventos para análise - Sistema Afiliados';
COMMENT ON COLUMN afiliado_analytics_ebooks.evento IS 'comprovante_recebido, validado, rejeitado, ebook_entregue, fraude_detectada';

-- ============================================
-- TABELA 4: afiliado_blacklist_ebooks
-- Clientes bloqueados por fraude
-- ============================================

CREATE TABLE IF NOT EXISTS afiliado_blacklist_ebooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(20) UNIQUE NOT NULL,
  motivo TEXT NOT NULL,
  tentativas_fraude INTEGER DEFAULT 1,
  user_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by VARCHAR(50) DEFAULT 'sistema'
);

CREATE INDEX idx_afiliado_blacklist_phone ON afiliado_blacklist_ebooks(phone);
CREATE INDEX idx_afiliado_blacklist_created ON afiliado_blacklist_ebooks(created_at);

COMMENT ON TABLE afiliado_blacklist_ebooks IS 'Números bloqueados por fraude - Sistema Afiliados';

-- ============================================
-- TABELA 5: afiliado_clientes_ebooks
-- Perfil e histórico dos clientes
-- ============================================

CREATE TABLE IF NOT EXISTS afiliado_clientes_ebooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(20) UNIQUE NOT NULL,
  nome VARCHAR(100),
  primeira_compra_at TIMESTAMPTZ,
  ultima_compra_at TIMESTAMPTZ,
  total_compras INTEGER DEFAULT 0,
  total_ebooks INTEGER DEFAULT 0,
  valor_total_compras DECIMAL(10,2) DEFAULT 0,
  categorias_preferidas JSONB DEFAULT '[]',
  vip BOOLEAN DEFAULT FALSE,
  user_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_afiliado_clientes_ebooks_phone ON afiliado_clientes_ebooks(phone);
CREATE INDEX idx_afiliado_clientes_ebooks_vip ON afiliado_clientes_ebooks(vip);
CREATE INDEX idx_afiliado_clientes_ebooks_user ON afiliado_clientes_ebooks(user_id);

COMMENT ON TABLE afiliado_clientes_ebooks IS 'Perfil completo dos clientes - Sistema Afiliados';

-- ============================================
-- FUNCTION: verificar_rate_limit_afiliado
-- Checa quantos eBooks foram entregues hoje
-- ============================================

CREATE OR REPLACE FUNCTION verificar_rate_limit_afiliado(p_phone VARCHAR)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM afiliado_ebook_deliveries
  WHERE phone = p_phone
    AND DATE(created_at) = CURRENT_DATE;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================
-- FUNCTION: verificar_blacklist_afiliado
-- Checa se número está bloqueado
-- ============================================

CREATE OR REPLACE FUNCTION verificar_blacklist_afiliado(p_phone VARCHAR)
RETURNS BOOLEAN AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM afiliado_blacklist_ebooks WHERE phone = p_phone
  ) INTO v_exists;
  
  RETURN v_exists;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================
-- FUNCTION: adicionar_blacklist_afiliado
-- Adiciona número à blacklist
-- ============================================

CREATE OR REPLACE FUNCTION adicionar_blacklist_afiliado(
  p_phone VARCHAR,
  p_motivo TEXT,
  p_user_id UUID DEFAULT NULL,
  p_created_by VARCHAR DEFAULT 'sistema'
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO afiliado_blacklist_ebooks (phone, motivo, user_id, created_by)
  VALUES (p_phone, p_motivo, p_user_id, p_created_by)
  ON CONFLICT (phone) DO UPDATE SET
    tentativas_fraude = afiliado_blacklist_ebooks.tentativas_fraude + 1,
    motivo = p_motivo || ' (tentativa ' || (afiliado_blacklist_ebooks.tentativas_fraude + 1)::TEXT || ')';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================
-- FUNCTION: atualizar_cliente_ebook_afiliado
-- Atualiza perfil após cada entrega
-- ============================================

CREATE OR REPLACE FUNCTION atualizar_cliente_ebook_afiliado()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO afiliado_clientes_ebooks (
    phone, 
    primeira_compra_at, 
    ultima_compra_at, 
    total_compras, 
    total_ebooks, 
    valor_total_compras,
    user_id
  )
  VALUES (
    NEW.phone,
    NEW.created_at,
    NEW.created_at,
    1,
    1,
    COALESCE(NEW.valor_compra, 0),
    NEW.user_id
  )
  ON CONFLICT (phone) DO UPDATE SET
    ultima_compra_at = NEW.created_at,
    total_compras = afiliado_clientes_ebooks.total_compras + 1,
    total_ebooks = afiliado_clientes_ebooks.total_ebooks + 1,
    valor_total_compras = afiliado_clientes_ebooks.valor_total_compras + COALESCE(NEW.valor_compra, 0),
    updated_at = NOW(),
    vip = CASE 
      WHEN afiliado_clientes_ebooks.total_compras + 1 >= 5 THEN TRUE 
      ELSE FALSE 
    END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================
-- TRIGGER: atualizar_cliente_ebook_trigger
-- ============================================

DROP TRIGGER IF EXISTS atualizar_cliente_ebook_afiliado_trigger ON afiliado_ebook_deliveries;

CREATE TRIGGER atualizar_cliente_ebook_afiliado_trigger
AFTER INSERT ON afiliado_ebook_deliveries
FOR EACH ROW
EXECUTE FUNCTION atualizar_cliente_ebook_afiliado();

-- ============================================
-- FUNCTION: limpar_estados_antigos_afiliado
-- Remove estados com mais de 24h
-- ============================================

CREATE OR REPLACE FUNCTION limpar_estados_antigos_afiliado()
RETURNS INTEGER AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM afiliado_user_states
  WHERE updated_at < NOW() - INTERVAL '24 hours';
  
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  
  INSERT INTO afiliado_analytics_ebooks (evento, metadata)
  VALUES ('limpeza_estados', jsonb_build_object('deletados', v_deleted));
  
  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================
-- STORAGE: Criar bucket 'ebooks'
-- ============================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('ebooks', 'ebooks', true, 10485760, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- STORAGE POLICIES: Acesso público para leitura
-- ============================================

CREATE POLICY "Ebooks são públicos para leitura"
ON storage.objects FOR SELECT
USING (bucket_id = 'ebooks');

CREATE POLICY "Sistema pode fazer upload de ebooks"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'ebooks');

CREATE POLICY "Sistema pode deletar ebooks"
ON storage.objects FOR DELETE
USING (bucket_id = 'ebooks');

-- ============================================
-- RLS: Políticas para as tabelas
-- ============================================

ALTER TABLE afiliado_user_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE afiliado_ebook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE afiliado_analytics_ebooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE afiliado_blacklist_ebooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE afiliado_clientes_ebooks ENABLE ROW LEVEL SECURITY;

-- Políticas permissivas para Edge Functions (via service key)
CREATE POLICY "Sistema gerencia user_states" ON afiliado_user_states FOR ALL USING (true);
CREATE POLICY "Sistema gerencia deliveries" ON afiliado_ebook_deliveries FOR ALL USING (true);
CREATE POLICY "Sistema gerencia analytics" ON afiliado_analytics_ebooks FOR ALL USING (true);
CREATE POLICY "Sistema gerencia blacklist" ON afiliado_blacklist_ebooks FOR ALL USING (true);
CREATE POLICY "Sistema gerencia clientes_ebooks" ON afiliado_clientes_ebooks FOR ALL USING (true);
