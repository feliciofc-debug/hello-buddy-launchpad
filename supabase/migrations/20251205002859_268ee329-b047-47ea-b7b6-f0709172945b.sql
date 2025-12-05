-- Adicionar novos campos na tabela produtos
ALTER TABLE produtos 
  ADD COLUMN IF NOT EXISTS brand TEXT,
  ADD COLUMN IF NOT EXISTS attributes JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS preparation TEXT,
  ADD COLUMN IF NOT EXISTS warranty TEXT;

-- Índices para busca rápida
CREATE INDEX IF NOT EXISTS idx_produtos_categoria ON produtos(categoria);
CREATE INDEX IF NOT EXISTS idx_produtos_attributes ON produtos USING gin(attributes);
CREATE INDEX IF NOT EXISTS idx_produtos_nome ON produtos USING gin(to_tsvector('portuguese', nome));
CREATE INDEX IF NOT EXISTS idx_produtos_descricao ON produtos USING gin(to_tsvector('portuguese', descricao));