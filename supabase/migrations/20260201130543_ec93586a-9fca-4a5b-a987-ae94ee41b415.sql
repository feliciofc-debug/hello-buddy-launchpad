-- Remover constraint antiga e adicionar nova incluindo 'parceiro'
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_tipo_check;

ALTER TABLE profiles ADD CONSTRAINT profiles_tipo_check 
CHECK (tipo IS NULL OR tipo IN ('comum', 'empresa', 'mcassab', 'afiliado', 'afiliado_admin', 'b2b', 'parceiro'));