-- Verificar se a tabela existe e adicionar colunas faltantes
DO $$ 
BEGIN
  -- Adicionar coluna notes se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'whatsapp_contacts' 
    AND column_name = 'notes'
  ) THEN
    ALTER TABLE public.whatsapp_contacts ADD COLUMN notes TEXT;
  END IF;

  -- Adicionar coluna tags se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'whatsapp_contacts' 
    AND column_name = 'tags'
  ) THEN
    ALTER TABLE public.whatsapp_contacts ADD COLUMN tags TEXT[];
  END IF;

  -- Adicionar coluna updated_at se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'whatsapp_contacts' 
    AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.whatsapp_contacts ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  END IF;
END $$;

-- Criar trigger para atualizar updated_at se não existir
CREATE OR REPLACE FUNCTION update_whatsapp_contacts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_whatsapp_contacts_timestamp ON public.whatsapp_contacts;

CREATE TRIGGER update_whatsapp_contacts_timestamp
BEFORE UPDATE ON public.whatsapp_contacts
FOR EACH ROW
EXECUTE FUNCTION update_whatsapp_contacts_updated_at();

-- Criar índices se não existirem
CREATE INDEX IF NOT EXISTS idx_whatsapp_contacts_name ON public.whatsapp_contacts(nome);
CREATE INDEX IF NOT EXISTS idx_whatsapp_contacts_phone ON public.whatsapp_contacts(phone);