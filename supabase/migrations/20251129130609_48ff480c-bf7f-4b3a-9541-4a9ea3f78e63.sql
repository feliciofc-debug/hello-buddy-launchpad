-- Tabela para rastrear mensagens enviadas na prospecção ativa
CREATE TABLE mensagens_enviadas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID,
  lead_tipo TEXT NOT NULL DEFAULT 'b2c',
  phone TEXT NOT NULL,
  message TEXT NOT NULL,
  strategy JSONB,
  wuzapi_response JSONB,
  respondeu BOOLEAN DEFAULT false,
  resposta_texto TEXT,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID
);

-- Índices para performance
CREATE INDEX idx_mensagens_lead ON mensagens_enviadas(lead_id);
CREATE INDEX idx_mensagens_phone ON mensagens_enviadas(phone);
CREATE INDEX idx_mensagens_user ON mensagens_enviadas(user_id);

-- RLS
ALTER TABLE mensagens_enviadas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own messages"
ON mensagens_enviadas FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own messages"
ON mensagens_enviadas FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own messages"
ON mensagens_enviadas FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "System can manage messages"
ON mensagens_enviadas FOR ALL
USING (true);