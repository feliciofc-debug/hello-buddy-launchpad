
-- Allowlist de emails que entram automaticamente como parceiro PJ ao logar via Google
CREATE OR REPLACE FUNCTION public.auto_assign_parceiro_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  parceiro_emails TEXT[] := ARRAY['nelson.ribeiro.jr@gmail.com'];
BEGIN
  IF NEW.email = ANY(parceiro_emails) AND NEW.email_confirmed_at IS NOT NULL THEN
    UPDATE public.profiles
      SET tipo = 'parceiro',
          nome = COALESCE(NULLIF(nome, ''), split_part(NEW.email, '@', 1)),
          nome_fantasia = COALESCE(nome_fantasia, 'Parceiro Curitiba')
      WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_assign_parceiro ON auth.users;
CREATE TRIGGER on_auth_user_created_assign_parceiro
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.auto_assign_parceiro_role();

DROP TRIGGER IF EXISTS on_auth_user_confirmed_assign_parceiro ON auth.users;
CREATE TRIGGER on_auth_user_confirmed_assign_parceiro
AFTER UPDATE OF email_confirmed_at ON auth.users
FOR EACH ROW
WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
EXECUTE FUNCTION public.auto_assign_parceiro_role();

-- Se o Nelson já existir na base, promover agora
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'nelson.ribeiro.jr@gmail.com' LIMIT 1;
  IF v_user_id IS NOT NULL THEN
    UPDATE public.profiles
      SET tipo = 'parceiro',
          nome_fantasia = COALESCE(nome_fantasia, 'Parceiro Curitiba')
      WHERE id = v_user_id;
  END IF;
END $$;
