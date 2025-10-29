-- Tabela para histórico de envios em massa
CREATE TABLE IF NOT EXISTS whatsapp_bulk_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_name TEXT,
  message_template TEXT NOT NULL,
  total_contacts INT NOT NULL DEFAULT 0,
  sent_count INT NOT NULL DEFAULT 0,
  delivered_count INT NOT NULL DEFAULT 0,
  read_count INT NOT NULL DEFAULT 0,
  response_count INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, sending, completed, failed
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela para contatos dos envios em massa
CREATE TABLE IF NOT EXISTS whatsapp_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bulk_send_id UUID NOT NULL REFERENCES whatsapp_bulk_sends(id) ON DELETE CASCADE,
  name TEXT,
  phone TEXT NOT NULL,
  custom_fields JSONB, -- para variáveis personalizadas
  status TEXT NOT NULL DEFAULT 'pending', -- pending, sent, delivered, read, responded, failed
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela para grupos do WhatsApp
CREATE TABLE IF NOT EXISTS whatsapp_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id TEXT NOT NULL,
  group_name TEXT NOT NULL,
  member_count INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active', -- active, inactive
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, group_id)
);

-- Tabela para mensagens de grupo
CREATE TABLE IF NOT EXISTS whatsapp_group_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES whatsapp_groups(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'sent' -- sent, delivered, failed
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_bulk_sends_user_id ON whatsapp_bulk_sends(user_id);
CREATE INDEX IF NOT EXISTS idx_bulk_sends_status ON whatsapp_bulk_sends(status);
CREATE INDEX IF NOT EXISTS idx_bulk_sends_scheduled ON whatsapp_bulk_sends(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_contacts_bulk_send ON whatsapp_contacts(bulk_send_id);
CREATE INDEX IF NOT EXISTS idx_contacts_status ON whatsapp_contacts(status);
CREATE INDEX IF NOT EXISTS idx_groups_user_id ON whatsapp_groups(user_id);
CREATE INDEX IF NOT EXISTS idx_group_messages_group ON whatsapp_group_messages(group_id);

-- RLS Policies
ALTER TABLE whatsapp_bulk_sends ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_group_messages ENABLE ROW LEVEL SECURITY;

-- Policies para whatsapp_bulk_sends
CREATE POLICY "Users can view their own bulk sends"
  ON whatsapp_bulk_sends FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own bulk sends"
  ON whatsapp_bulk_sends FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own bulk sends"
  ON whatsapp_bulk_sends FOR UPDATE
  USING (auth.uid() = user_id);

-- Policies para whatsapp_contacts
CREATE POLICY "Users can view contacts from their bulk sends"
  ON whatsapp_contacts FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM whatsapp_bulk_sends
    WHERE whatsapp_bulk_sends.id = whatsapp_contacts.bulk_send_id
    AND whatsapp_bulk_sends.user_id = auth.uid()
  ));

CREATE POLICY "Users can create contacts for their bulk sends"
  ON whatsapp_contacts FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM whatsapp_bulk_sends
    WHERE whatsapp_bulk_sends.id = whatsapp_contacts.bulk_send_id
    AND whatsapp_bulk_sends.user_id = auth.uid()
  ));

CREATE POLICY "Users can update contacts from their bulk sends"
  ON whatsapp_contacts FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM whatsapp_bulk_sends
    WHERE whatsapp_bulk_sends.id = whatsapp_contacts.bulk_send_id
    AND whatsapp_bulk_sends.user_id = auth.uid()
  ));

-- Policies para whatsapp_groups
CREATE POLICY "Users can view their own groups"
  ON whatsapp_groups FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own groups"
  ON whatsapp_groups FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own groups"
  ON whatsapp_groups FOR UPDATE
  USING (auth.uid() = user_id);

-- Policies para whatsapp_group_messages
CREATE POLICY "Users can view messages from their groups"
  ON whatsapp_group_messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM whatsapp_groups
    WHERE whatsapp_groups.id = whatsapp_group_messages.group_id
    AND whatsapp_groups.user_id = auth.uid()
  ));

CREATE POLICY "Users can create messages for their groups"
  ON whatsapp_group_messages FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM whatsapp_groups
    WHERE whatsapp_groups.id = whatsapp_group_messages.group_id
    AND whatsapp_groups.user_id = auth.uid()
  ));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_bulk_sends_updated_at
  BEFORE UPDATE ON whatsapp_bulk_sends
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_groups_updated_at
  BEFORE UPDATE ON whatsapp_groups
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Habilitar realtime
ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_bulk_sends;
ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_contacts;
ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_groups;
ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_group_messages;