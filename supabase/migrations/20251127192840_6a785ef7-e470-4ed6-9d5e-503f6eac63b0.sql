-- Adicionar campo para separar leads de clientes
ALTER TABLE whatsapp_conversations 
ADD COLUMN IF NOT EXISTS tipo_contato TEXT DEFAULT 'lead';
-- Valores: 'lead' (novo/prospect) ou 'cliente' (base existente)

-- Índice para tipo_contato
CREATE INDEX IF NOT EXISTS idx_tipo_contato 
ON whatsapp_conversations(tipo_contato);