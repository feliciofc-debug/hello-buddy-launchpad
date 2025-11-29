-- Adicionar coluna product_id nas tabelas de leads
ALTER TABLE leads_b2c ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES produtos(id);
ALTER TABLE leads_b2b ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES produtos(id);

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_leads_b2c_product ON leads_b2c(product_id);
CREATE INDEX IF NOT EXISTS idx_leads_b2b_product ON leads_b2b(product_id);