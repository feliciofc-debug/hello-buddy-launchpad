-- Corrigir função para usar user_id fixo do admin
CREATE OR REPLACE FUNCTION sync_cadastro_to_whatsapp_contacts()
RETURNS TRIGGER AS $$
DECLARE
  clean_phone TEXT;
  admin_user_id UUID := 'b7af0118-c506-4f87-8ac3-a0a11fd621fe';
BEGIN
  -- Limpar telefone (remover formatação)
  clean_phone := regexp_replace(NEW.whatsapp, '[^0-9]', '', 'g');
  
  -- Se telefone tiver 11 dígitos ou menos, adicionar 55 (Brasil)
  IF length(clean_phone) <= 11 THEN
    clean_phone := '55' || clean_phone;
  END IF;
  
  -- Inserir em whatsapp_contacts para o admin
  INSERT INTO whatsapp_contacts (
    phone,
    nome,
    notes,
    user_id,
    created_at
  ) VALUES (
    clean_phone,
    NEW.nome,
    'Origem: ' || COALESCE(NEW.origem, 'opt-in'),
    COALESCE(NEW.user_id, admin_user_id),
    NEW.created_at
  )
  ON CONFLICT (phone, user_id) DO UPDATE SET
    nome = EXCLUDED.nome,
    updated_at = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;