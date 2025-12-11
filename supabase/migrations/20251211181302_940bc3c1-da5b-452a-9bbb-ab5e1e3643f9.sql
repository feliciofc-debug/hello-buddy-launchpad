-- Alterar função para também inserir em whatsapp_contacts
CREATE OR REPLACE FUNCTION sync_optin_to_cadastro()
RETURNS TRIGGER AS $$
BEGIN
  -- Inserir em cadastros
  INSERT INTO cadastros (
    nome,
    whatsapp,
    email,
    opt_in,
    opt_in_id,
    origem,
    created_at
  ) VALUES (
    NEW.nome,
    NEW.whatsapp,
    NEW.email,
    true,
    NEW.id,
    NEW.origem,
    NEW.created_at
  )
  ON CONFLICT (whatsapp) DO UPDATE SET
    nome = EXCLUDED.nome,
    email = EXCLUDED.email,
    opt_in = true,
    opt_in_id = NEW.id,
    updated_at = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Criar função para sincronizar cadastros existentes para whatsapp_contacts
CREATE OR REPLACE FUNCTION sync_cadastro_to_whatsapp_contacts()
RETURNS TRIGGER AS $$
DECLARE
  clean_phone TEXT;
BEGIN
  -- Limpar telefone (remover formatação)
  clean_phone := regexp_replace(NEW.whatsapp, '[^0-9]', '', 'g');
  
  -- Se telefone tiver menos de 10 dígitos, adicionar 55 (Brasil)
  IF length(clean_phone) < 11 THEN
    clean_phone := '55' || clean_phone;
  ELSIF length(clean_phone) = 11 THEN
    clean_phone := '55' || clean_phone;
  END IF;
  
  -- Inserir em whatsapp_contacts (se não existir)
  INSERT INTO whatsapp_contacts (
    phone,
    nome,
    notes,
    user_id,
    created_at
  ) 
  SELECT 
    clean_phone,
    NEW.nome,
    'Origem: ' || COALESCE(NEW.origem, 'opt-in'),
    u.id,
    NEW.created_at
  FROM auth.users u
  LIMIT 1
  ON CONFLICT (phone, user_id) DO UPDATE SET
    nome = EXCLUDED.nome,
    updated_at = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Criar trigger para sincronizar cadastros → whatsapp_contacts
DROP TRIGGER IF EXISTS trigger_sync_cadastro_to_contacts ON cadastros;
CREATE TRIGGER trigger_sync_cadastro_to_contacts
AFTER INSERT ON cadastros
FOR EACH ROW
EXECUTE FUNCTION sync_cadastro_to_whatsapp_contacts();

-- Sincronizar cadastros existentes para whatsapp_contacts
DO $$
DECLARE
  cadastro RECORD;
  clean_phone TEXT;
  first_user_id UUID;
BEGIN
  -- Pegar o primeiro user_id disponível
  SELECT id INTO first_user_id FROM auth.users LIMIT 1;
  
  IF first_user_id IS NULL THEN
    RAISE NOTICE 'Nenhum usuário encontrado';
    RETURN;
  END IF;

  FOR cadastro IN SELECT * FROM cadastros LOOP
    clean_phone := regexp_replace(cadastro.whatsapp, '[^0-9]', '', 'g');
    
    IF length(clean_phone) <= 11 THEN
      clean_phone := '55' || clean_phone;
    END IF;
    
    INSERT INTO whatsapp_contacts (phone, nome, notes, user_id, created_at)
    VALUES (
      clean_phone,
      cadastro.nome,
      'Origem: ' || COALESCE(cadastro.origem, 'opt-in'),
      first_user_id,
      cadastro.created_at
    )
    ON CONFLICT (phone, user_id) DO UPDATE SET
      nome = EXCLUDED.nome,
      updated_at = now();
  END LOOP;
END $$;