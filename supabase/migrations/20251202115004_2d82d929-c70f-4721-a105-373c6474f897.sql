-- Adicionar novos campos detalhados em produtos
ALTER TABLE produtos 
  ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'fisico' CHECK (tipo IN ('fisico', 'servico')),
  ADD COLUMN IF NOT EXISTS ficha_tecnica TEXT,
  ADD COLUMN IF NOT EXISTS informacao_nutricional TEXT,
  ADD COLUMN IF NOT EXISTS ingredientes TEXT,
  ADD COLUMN IF NOT EXISTS modo_uso TEXT,
  ADD COLUMN IF NOT EXISTS beneficios TEXT,
  ADD COLUMN IF NOT EXISTS garantia TEXT,
  ADD COLUMN IF NOT EXISTS dimensoes TEXT,
  ADD COLUMN IF NOT EXISTS peso TEXT,
  ADD COLUMN IF NOT EXISTS cor TEXT,
  ADD COLUMN IF NOT EXISTS tamanhos TEXT;

-- Criar índice para busca por tipo
CREATE INDEX IF NOT EXISTS idx_produtos_tipo ON produtos(tipo);

-- Comentários para documentação
COMMENT ON COLUMN produtos.tipo IS 'Tipo do produto: fisico (produto físico) ou servico (serviço)';
COMMENT ON COLUMN produtos.ficha_tecnica IS 'Especificações técnicas detalhadas do produto';
COMMENT ON COLUMN produtos.informacao_nutricional IS 'Tabela nutricional para alimentos';
COMMENT ON COLUMN produtos.ingredientes IS 'Lista de ingredientes do produto';
COMMENT ON COLUMN produtos.modo_uso IS 'Instruções de uso do produto';
COMMENT ON COLUMN produtos.beneficios IS 'Benefícios e diferenciais do produto';
COMMENT ON COLUMN produtos.garantia IS 'Informações sobre garantia';
COMMENT ON COLUMN produtos.dimensoes IS 'Dimensões do produto (para produtos físicos)';
COMMENT ON COLUMN produtos.peso IS 'Peso do produto (para produtos físicos)';
COMMENT ON COLUMN produtos.cor IS 'Cores disponíveis';
COMMENT ON COLUMN produtos.tamanhos IS 'Tamanhos disponíveis';