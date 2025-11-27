-- Adicionar colunas para controlar quem está atendendo
ALTER TABLE whatsapp_conversations 
ADD COLUMN IF NOT EXISTS modo_atendimento TEXT DEFAULT 'ia';

ALTER TABLE whatsapp_conversations 
ADD COLUMN IF NOT EXISTS assumido_por UUID;

ALTER TABLE whatsapp_conversations 
ADD COLUMN IF NOT EXISTS assumido_em TIMESTAMP WITH TIME ZONE;

-- Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_modo_atendimento 
ON whatsapp_conversations(modo_atendimento);

-- Adicionar coluna contact_name se não existir
ALTER TABLE whatsapp_conversations 
ADD COLUMN IF NOT EXISTS contact_name TEXT;