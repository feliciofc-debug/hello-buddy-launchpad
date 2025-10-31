-- Remove a constraint antiga
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_tipo_check;

-- Adiciona nova constraint permitindo 'afiliado', 'empresa' e 'fabrica'
ALTER TABLE public.profiles ADD CONSTRAINT profiles_tipo_check 
CHECK (tipo IN ('afiliado', 'empresa', 'fabrica'));