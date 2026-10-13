CREATE OR REPLACE FUNCTION public.admin_criar_cliente(
  p_email text,
  p_senha text,
  p_nome text,
  p_tipo text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, extensions
AS $$
DECLARE
  v_email text := lower(trim(p_email));
  v_nome text := trim(p_nome);
  v_tipo text := trim(p_tipo);
  v_user_id uuid := gen_random_uuid();
  v_instance_id uuid;
  v_is_admin boolean;
BEGIN
  v_is_admin :=
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR lower(coalesce(auth.jwt() ->> 'email', '')) =
      'expo@atombrasildigital.com';

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Apenas administradores podem criar clientes.'
      USING ERRCODE = '42501';
  END IF;

  IF v_email = '' OR
    v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  THEN
    RAISE EXCEPTION 'Informe um e-mail válido.'
      USING ERRCODE = '22023';
  END IF;

  IF char_length(coalesce(p_senha, '')) < 8 THEN
    RAISE EXCEPTION 'A senha deve ter pelo menos 8 caracteres.'
      USING ERRCODE = '22023';
  END IF;

  IF v_nome = '' THEN
    RAISE EXCEPTION 'Informe o nome do cliente.'
      USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.client_menu_config
    WHERE tipo_cliente = v_tipo
  ) THEN
    RAISE EXCEPTION 'Tipo de cliente inválido.'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM auth.users
    WHERE lower(email) = v_email
  ) THEN
    RAISE EXCEPTION 'Já existe uma conta com este e-mail.'
      USING ERRCODE = '23505';
  END IF;

  SELECT instance_id
  INTO v_instance_id
  FROM auth.users
  WHERE instance_id IS NOT NULL
  ORDER BY created_at
  LIMIT 1;

  IF v_instance_id IS NULL THEN
    RAISE EXCEPTION 'Não foi possível identificar a instância de autenticação.';
  END IF;

  BEGIN
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      confirmed_at,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      recovery_token,
      email_change,
      email_change_token_new
    ) VALUES (
      v_instance_id,
      v_user_id,
      'authenticated',
      'authenticated',
      v_email,
      extensions.crypt(
        p_senha,
        extensions.gen_salt('bf', 10)
      ),
      now(),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('nome', v_nome, 'tipo', v_tipo),
      now(),
      now(),
      '',
      '',
      '',
      ''
    );
  EXCEPTION
    WHEN unique_violation THEN
      RAISE EXCEPTION 'Já existe uma conta com este e-mail.'
        USING ERRCODE = '23505';
  END;

  INSERT INTO public.profiles (
    id,
    nome,
    whatsapp,
    cpf,
    tipo
  ) VALUES (
    v_user_id,
    v_nome,
    '',
    '',
    v_tipo
  )
  ON CONFLICT (id) DO UPDATE
  SET nome = excluded.nome,
      tipo = excluded.tipo,
      updated_at = now();

  RETURN v_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_criar_cliente(
  text,
  text,
  text,
  text
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.admin_criar_cliente(
  text,
  text,
  text,
  text
) TO authenticated;
