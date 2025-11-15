-- Tabela produtos marketplace
CREATE TABLE IF NOT EXISTS produtos_marketplace (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descricao TEXT,
  preco DECIMAL(10,2) NOT NULL,
  preco_original DECIMAL(10,2),
  imagens JSONB DEFAULT '[]',
  categoria TEXT,
  plataforma TEXT CHECK (plataforma IN ('shopee', 'amazon', 'mercadolivre', 'lomadee', 'outros')),
  link_afiliado TEXT NOT NULL,
  ebook_bonus TEXT,
  slug TEXT UNIQUE,
  ativo BOOLEAN DEFAULT true,
  visualizacoes INT DEFAULT 0,
  cliques_whatsapp INT DEFAULT 0,
  cliques_afiliado INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_produtos_marketplace_user ON produtos_marketplace(user_id);
CREATE INDEX IF NOT EXISTS idx_produtos_marketplace_categoria ON produtos_marketplace(categoria);
CREATE INDEX IF NOT EXISTS idx_produtos_marketplace_slug ON produtos_marketplace(slug);
CREATE INDEX IF NOT EXISTS idx_produtos_marketplace_ativo ON produtos_marketplace(ativo);

-- Função atualizar slug automaticamente
CREATE OR REPLACE FUNCTION generate_slug_marketplace()
RETURNS TRIGGER AS $$
BEGIN
  NEW.slug := lower(regexp_replace(NEW.titulo, '[^a-zA-Z0-9]+', '-', 'g'));
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_slug_marketplace
BEFORE INSERT OR UPDATE ON produtos_marketplace
FOR EACH ROW
EXECUTE FUNCTION generate_slug_marketplace();

-- RLS Policies
ALTER TABLE produtos_marketplace ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Produtos públicos visíveis" ON produtos_marketplace
  FOR SELECT USING (ativo = true);

CREATE POLICY "Usuários gerenciam próprios produtos" ON produtos_marketplace
  FOR ALL USING (auth.uid() = user_id);