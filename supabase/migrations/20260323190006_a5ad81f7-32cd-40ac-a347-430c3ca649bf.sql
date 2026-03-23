DROP FUNCTION IF EXISTS public.inserir_campanha_fila(uuid, jsonb, text, text, uuid, text, integer, jsonb, timestamptz, text);
DROP FUNCTION IF EXISTS public.inserir_campanha_fila(uuid, jsonb, text, text, uuid, text, text, integer, jsonb, timestamptz, text);
DROP FUNCTION IF EXISTS public.inserir_campanha_fila(uuid, jsonb, text, text);
DROP FUNCTION IF EXISTS public.inserir_campanha_fila(uuid, jsonb, text, text, uuid, text, text, integer, jsonb, timestamp with time zone, text);

CREATE OR REPLACE FUNCTION public.inserir_campanha_fila(
  p_user_id uuid,
  p_contatos jsonb,
  p_mensagem text,
  p_imagem_url text DEFAULT NULL,
  p_lead_source text DEFAULT 'campanha_produtos',
  p_campanha_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_contato jsonb;
  v_phone_raw text;
  v_phone text;
  v_name text;
  v_msg text;
  v_count int := 0;
  v_auth_user_id uuid;
  v_jwt_role text;
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
      status,
      scheduled_at,
      tentativas,
      lead_source,
      campanha_id,
      metadata
    ) VALUES (
      p_user_id,
      v_phone,
      NULLIF(v_name, ''),
      v_msg,
      COALESCE(NULLIF(v_contato->>'imagem_url', ''), p_imagem_url),
      'pendente',
      NOW(),
      0,
      COALESCE(NULLIF(v_contato->>'lead_source', ''), p_lead_source),
      COALESCE((v_contato->>'campanha_id')::uuid, p_campanha_id),
      COALESCE(p_metadata, '{}'::jsonb) || COALESCE(v_contato->'metadata', '{}'::jsonb)
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'inseridos', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.inserir_campanha_fila(uuid, jsonb, text, text, text, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.inserir_campanha_fila(uuid, jsonb, text, text, text, uuid, jsonb) TO anon;