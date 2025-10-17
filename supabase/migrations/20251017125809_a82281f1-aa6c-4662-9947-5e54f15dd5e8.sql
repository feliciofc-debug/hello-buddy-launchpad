-- Adicionar campos de IDs de afiliado na tabela profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS amazon_id TEXT,
ADD COLUMN IF NOT EXISTS hotmart_email TEXT,
ADD COLUMN IF NOT EXISTS shopee_id TEXT,
ADD COLUMN IF NOT EXISTS lomadee_id TEXT;

-- Atualizar a função handle_new_user para incluir os novos campos
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (
    id, 
    nome, 
    whatsapp, 
    cpf,
    amazon_id,
    hotmart_email,
    shopee_id,
    lomadee_id
  )
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'nome', ''),
    COALESCE(new.raw_user_meta_data->>'whatsapp', ''),
    COALESCE(new.raw_user_meta_data->>'cpf', ''),
    COALESCE(new.raw_user_meta_data->>'amazon_id', ''),
    COALESCE(new.raw_user_meta_data->>'hotmart_email', ''),
    COALESCE(new.raw_user_meta_data->>'shopee_id', ''),
    COALESCE(new.raw_user_meta_data->>'lomadee_id', '')
  );
  RETURN new;
END;
$$;