-- Adicionar coluna para guardar o ID do afiliado
ALTER TABLE integrations ADD COLUMN IF NOT EXISTS lomadee_affiliate_id text;