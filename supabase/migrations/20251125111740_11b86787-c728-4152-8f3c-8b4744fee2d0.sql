-- Drop existing table if it exists
DROP TABLE IF EXISTS whatsapp_contacts CASCADE;

-- Tabela para gerenciar lista de distribuição WhatsApp
CREATE TABLE whatsapp_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  phone TEXT NOT NULL,
  nome TEXT,
  email TEXT,
  tags TEXT[],
  aceita_marketing BOOLEAN DEFAULT TRUE,
  aceita_lancamentos BOOLEAN DEFAULT TRUE,
  aceita_promocoes BOOLEAN DEFAULT TRUE,
  origem TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_interaction TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_whatsapp_contacts_user ON whatsapp_contacts(user_id);
CREATE INDEX idx_whatsapp_contacts_phone ON whatsapp_contacts(phone);

ALTER TABLE whatsapp_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own contacts"
  ON whatsapp_contacts FOR ALL
  USING (auth.uid() = user_id);