-- Tabela para mensagens recebidas via webhook
CREATE TABLE IF NOT EXISTS whatsapp_messages_received (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL,
  message TEXT NOT NULL,
  message_id TEXT,
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela para mensagens enviadas (respostas da IA)
CREATE TABLE IF NOT EXISTS whatsapp_messages_sent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL,
  message TEXT NOT NULL,
  in_response_to TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_messages_received_phone ON whatsapp_messages_received(phone_number);
CREATE INDEX IF NOT EXISTS idx_messages_received_created ON whatsapp_messages_received(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sent_phone ON whatsapp_messages_sent(phone_number);
CREATE INDEX IF NOT EXISTS idx_messages_sent_created ON whatsapp_messages_sent(created_at DESC);

-- RLS: permitir acesso público para o webhook (sem JWT)
ALTER TABLE whatsapp_messages_received ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages_sent ENABLE ROW LEVEL SECURITY;

-- Política para permitir inserção via webhook (sem autenticação)
CREATE POLICY "Allow webhook insert on messages_received" 
  ON whatsapp_messages_received 
  FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Allow webhook insert on messages_sent" 
  ON whatsapp_messages_sent 
  FOR INSERT 
  WITH CHECK (true);

-- Política para visualização (apenas usuários autenticados)
CREATE POLICY "Users can view messages_received" 
  ON whatsapp_messages_received 
  FOR SELECT 
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can view messages_sent" 
  ON whatsapp_messages_sent 
  FOR SELECT 
  USING (auth.uid() IS NOT NULL);