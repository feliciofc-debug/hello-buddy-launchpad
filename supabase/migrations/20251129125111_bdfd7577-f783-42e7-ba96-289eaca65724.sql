-- Adicionar coluna to_number que está faltando
ALTER TABLE voice_calls ADD COLUMN IF NOT EXISTS to_number TEXT;