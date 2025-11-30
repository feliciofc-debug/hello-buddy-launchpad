-- Adicionar colunas para redes sociais e contatos em leads_b2c
ALTER TABLE leads_b2c 
  ADD COLUMN IF NOT EXISTS twitter_url TEXT,
  ADD COLUMN IF NOT EXISTS site_consultorio TEXT,
  ADD COLUMN IF NOT EXISTS endereco_consultorio TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_business BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_verificado BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS instagram_url TEXT;

-- Adicionar colunas para redes sociais e contatos em leads_b2b
ALTER TABLE leads_b2b 
  ADD COLUMN IF NOT EXISTS twitter_url TEXT,
  ADD COLUMN IF NOT EXISTS site_consultorio TEXT,
  ADD COLUMN IF NOT EXISTS endereco_consultorio TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_business BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_verificado BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS instagram_url TEXT;

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_leads_b2c_telefone ON leads_b2c(telefone);
CREATE INDEX IF NOT EXISTS idx_leads_b2c_whatsapp ON leads_b2c(whatsapp);
CREATE INDEX IF NOT EXISTS idx_leads_b2c_instagram ON leads_b2c(instagram_username);
CREATE INDEX IF NOT EXISTS idx_leads_b2b_telefone ON leads_b2b(telefone);
CREATE INDEX IF NOT EXISTS idx_leads_b2b_email ON leads_b2b(email);