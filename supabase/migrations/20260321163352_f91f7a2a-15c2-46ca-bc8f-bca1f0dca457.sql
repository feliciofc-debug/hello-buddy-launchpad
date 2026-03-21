CREATE OR REPLACE FUNCTION public.inserir_campanha_fila(
  p_user_id UUID,
  p_contatos JSONB,
  p_mensagem TEXT,
  p_lead_source TEXT DEFAULT 'campanha_produtos',
  p_campanha_id UUID DEFAULT NULL,
  p_imagem_url TEXT DEFAULT NULL,
  p_tipo_mensagem TEXT DEFAULT 'campanha',
  p_prioridade INT DEFAULT 5,
  p_metadata JSONB DEFAULT NULL,
  p_scheduled_at TIMESTAMPTZ DEFAULT NOW(),
  p_opt_in_status TEXT DEFAULT 'novo'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_contato JSONB;
  v_phone_raw TEXT;
  v_phone TEXT;
  v_name TEXT;
  v_msg TEXT;
  v_count INT := 0;
  v_auth_user_id UUID;
  v_jwt_role TEXT;
BEGIN
  IF p_contatos IS NULL OR jsonb_typeof(p_contatos) <> 'array' THEN
    RAISE EXCEPTION 'p_contatos deve ser um JSON array de objetos';
  END IF;

  v_auth_user_id := auth.uid();
  v_jwt_role := current_setting('request.jwt.claim.role', true);

  IF COALESCE(v_jwt_role, '') IN ('authenticated', 'anon') THEN
    IF v_auth_user_id IS NULL THEN
      RAISE EXCEPTION 'Usuário não autenticado para inserir campanha na fila';
    END IF;

    IF p_user_id IS NULL OR p_user_id IS DISTINCT FROM v_auth_user_id THEN
      RAISE EXCEPTION 'p_user_id inválido para o usuário autenticado';
    END IF;
  END IF;

  FOR v_contato IN SELECT * FROM jsonb_array_elements(p_contatos)
  LOOP
    v_phone_raw := trim(COALESCE(v_contato->>'phone', ''));
    IF v_phone_raw = '' THEN
      CONTINUE;
    END IF;

    IF v_phone_raw LIKE '%@g.us' THEN
      v_phone := v_phone_raw;
    ELSE
      v_phone := regexp_replace(v_phone_raw, '\D', '', 'g');
    END IF;

    IF v_phone = '' THEN
      CONTINUE;
    END IF;

    v_name := COALESCE(v_contato->>'name', '');
    v_msg := REPLACE(COALESCE(v_contato->>'mensagem', p_mensagem, ''), '{{nome}}', v_name);

    INSERT INTO public.fila_atendimento_pj (
      user_id,
      lead_phone,
      lead_name,
      mensagem,
      imagem_url,
      tipo_mensagem,
      prioridade,
      status,
      scheduled_at,
      tentativas,
      lead_source,
      campanha_id,
      metadata,
      opt_in_status
    ) VALUES (
      p_user_id,
      v_phone,
      NULLIF(v_name, ''),
      v_msg,
      COALESCE(NULLIF(v_contato->>'imagem_url', ''), p_imagem_url),
      COALESCE(NULLIF(v_contato->>'tipo_mensagem', ''), p_tipo_mensagem),
      COALESCE((v_contato->>'prioridade')::INT, p_prioridade, 5),
      'pendente',
      COALESCE((v_contato->>'scheduled_at')::TIMESTAMPTZ, p_scheduled_at, NOW()),
      0,
      COALESCE(NULLIF(v_contato->>'lead_source', ''), p_lead_source),
      COALESCE((v_contato->>'campanha_id')::UUID, p_campanha_id),
      COALESCE(p_metadata, '{}'::jsonb) || COALESCE(v_contato->'metadata', '{}'::jsonb),
      COALESCE(NULLIF(v_contato->>'opt_in_status', ''), p_opt_in_status)
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'inseridos', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.inserir_campanha_fila TO authenticated;
GRANT EXECUTE ON FUNCTION public.inserir_campanha_fila TO anon;