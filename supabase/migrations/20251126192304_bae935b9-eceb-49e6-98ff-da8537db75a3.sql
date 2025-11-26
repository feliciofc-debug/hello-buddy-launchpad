-- Tabela para histórico de conversas WhatsApp
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  direction TEXT NOT NULL, -- 'sent' ou 'received'
  message TEXT,
  timestamp TIMESTAMP DEFAULT NOW()
);

-- RLS para whatsapp_messages
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_messages"
ON whatsapp_messages FOR ALL
USING (auth.uid() = user_id);

-- Índices para performance
CREATE INDEX idx_messages_user_phone ON whatsapp_messages(user_id, phone);
CREATE INDEX idx_messages_timestamp ON whatsapp_messages(timestamp DESC);

-- Tabela para notificar vendedor sobre leads quentes
CREATE TABLE IF NOT EXISTS lead_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  produto_nome TEXT,
  mensagem_cliente TEXT,
  status TEXT DEFAULT 'quente', -- 'quente', 'morno', 'frio'
  visualizado BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- RLS para lead_notifications
ALTER TABLE lead_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_notifications"
ON lead_notifications FOR ALL
USING (auth.uid() = user_id);

-- Índice para performance
CREATE INDEX idx_notifications_user ON lead_notifications(user_id, visualizado);