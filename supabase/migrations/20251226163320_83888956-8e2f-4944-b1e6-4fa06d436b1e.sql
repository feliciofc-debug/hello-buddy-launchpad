-- Remover constraint antigo
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_tipo_check;

-- Adicionar novo constraint com b2b incluído
ALTER TABLE profiles ADD CONSTRAINT profiles_tipo_check 
  CHECK (tipo IN ('afiliado', 'empresa', 'b2b'));