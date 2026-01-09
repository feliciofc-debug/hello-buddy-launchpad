-- ============================================
-- SISTEMA ANTI-BLOQUEIO WHATSAPP - TABELAS DE TESTE
-- AMZ Ofertas - Fila de Atendimento Inteligente
-- ============================================

-- 1. TABELA: FILA DE ATENDIMENTO
CREATE TABLE IF NOT EXISTS fila_atendimento_afiliado (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  
  -- Dados do lead
  lead_phone TEXT NOT NULL,
  lead_name TEXT,
  
  -- Mensagem recebida e resposta
  mensagem_recebida TEXT NOT NULL,
  resposta_ia TEXT,
  imagem_url TEXT,
  
  -- Dados do afiliado (para envio)
  wuzapi_token TEXT,
  instance_name TEXT,
  
  -- Controle de status
  status TEXT DEFAULT 'pendente',
  prioridade INT DEFAULT 5,
  tentativas INT DEFAULT 0,
  max_tentativas INT DEFAULT 3,
  erro TEXT,
  
  -- Tipo de mensagem
  tipo_mensagem TEXT DEFAULT 'ia',
  origem TEXT DEFAULT 'webhook',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  scheduled_at TIMESTAMPTZ DEFAULT now(),
  processing_started_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  
  -- Metadata adicional
  conversa_id UUID,
  metadata JSONB DEFAULT '{}'
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_fila_afiliado_status ON fila_atendimento_afiliado(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_fila_afiliado_user ON fila_atendimento_afiliado(user_id, status);
CREATE INDEX IF NOT EXISTS idx_fila_afiliado_phone ON fila_atendimento_afiliado(lead_phone);
CREATE INDEX IF NOT EXISTS idx_fila_afiliado_created ON fila_atendimento_afiliado(created_at DESC);

-- 2. TABELA: CONTROLE DE RATE LIMIT
CREATE TABLE IF NOT EXISTS rate_limit_afiliado (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  
  minuto_atual TEXT NOT NULL,
  msgs_no_minuto INT DEFAULT 0,
  hora_atual TEXT NOT NULL,
  msgs_na_hora INT DEFAULT 0,
  dia_atual TEXT,
  msgs_no_dia INT DEFAULT 0,
  
  pausado BOOLEAN DEFAULT false,
  pausado_ate TIMESTAMPTZ,
  motivo_pausa TEXT,
  
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(user_id, minuto_atual)
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_user ON rate_limit_afiliado(user_id);

-- 3. FUNÇÃO: PEGAR PRÓXIMO DA FILA
CREATE OR REPLACE FUNCTION pegar_proximo_fila_afiliado(
  p_user_id UUID DEFAULT NULL,
  p_limit INT DEFAULT 1
) RETURNS SETOF fila_atendimento_afiliado AS $$
BEGIN
  RETURN QUERY
  UPDATE fila_atendimento_afiliado
  SET 
    status = 'processando',
    processing_started_at = now(),
    tentativas = tentativas + 1
  WHERE id IN (
    SELECT id 
    FROM fila_atendimento_afiliado
    WHERE status = 'pendente'
      AND scheduled_at <= now()
      AND (p_user_id IS NULL OR user_id = p_user_id)
    ORDER BY prioridade ASC, created_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
END;
$$ LANGUAGE plpgsql;

-- 4. RLS - Row Level Security
ALTER TABLE fila_atendimento_afiliado ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limit_afiliado ENABLE ROW LEVEL SECURITY;

-- Políticas para fila_atendimento_afiliado
CREATE POLICY "Users can view own queue" ON fila_atendimento_afiliado
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role full access fila" ON fila_atendimento_afiliado
  FOR ALL USING (true) WITH CHECK (true);

-- Políticas para rate_limit_afiliado
CREATE POLICY "Users can view own rate limit" ON rate_limit_afiliado
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role full access rate" ON rate_limit_afiliado
  FOR ALL USING (true) WITH CHECK (true);

-- GRANT para service role
GRANT ALL ON fila_atendimento_afiliado TO service_role;
GRANT ALL ON rate_limit_afiliado TO service_role;
GRANT EXECUTE ON FUNCTION pegar_proximo_fila_afiliado TO service_role;