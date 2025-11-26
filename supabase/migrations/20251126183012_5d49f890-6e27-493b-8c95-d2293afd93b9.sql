-- Adicionar campos ao cadastro de produtos
ALTER TABLE produtos 
  ADD COLUMN IF NOT EXISTS estoque INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS especificacoes TEXT,
  ADD COLUMN IF NOT EXISTS link_marketplace TEXT,
  ADD COLUMN IF NOT EXISTS publicar_marketplace BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS imagens JSONB DEFAULT '[]'::jsonb;