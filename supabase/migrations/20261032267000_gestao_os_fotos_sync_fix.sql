-- OS-1.7: ambiguidade ordem + auto-seleção anúncio só na 1ª sincronização

CREATE OR REPLACE FUNCTION public.gestao_os_foto_ref_valida_origem()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_os public.gestao_os%ROWTYPE;
BEGIN
  SELECT * INTO v_os
  FROM public.gestao_os g
  WHERE g.user_id = NEW.user_id AND g.id = NEW.os_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'OS não encontrada para esta loja';
  END IF;

  IF NEW.origem = 'troca' THEN
    IF NEW.troca_id IS NULL THEN
      RAISE EXCEPTION 'Foto de troca exige troca_id';
    END IF;
    IF v_os.troca_id IS DISTINCT FROM NEW.troca_id THEN
      RAISE EXCEPTION 'Troca não pertence a esta OS';
    END IF;
    IF NEW.storage_path NOT LIKE NEW.user_id::text || '/' || NEW.troca_id::text || '/%' THEN
      RAISE EXCEPTION 'Caminho da foto de troca inválido';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.origem = 'anuncio' THEN
    NEW.troca_id := NULL;
    IF NOT public.gestao_os_foto_anuncio_permitida(
      NEW.user_id, v_os.veiculo_id, NEW.storage_path
    ) THEN
      RAISE EXCEPTION 'Foto não pertence ao anúncio deste veículo';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.origem = 'os' THEN
    NEW.troca_id := NULL;
    IF NEW.storage_path NOT LIKE NEW.user_id::text || '/os/' || NEW.os_id::text || '/%' THEN
      RAISE EXCEPTION 'Caminho da foto da OS inválido';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.gestao_os_documento d
      WHERE d.user_id = NEW.user_id
        AND d.os_id = NEW.os_id
        AND d.storage_path = NEW.storage_path
        AND d.deleted_at IS NULL
        AND d.mime_type LIKE 'image/%'
        AND d.tipo IN ('foto_checkin', 'foto_checkout', 'outro')
    ) THEN
      RAISE EXCEPTION 'Documento de imagem da OS não encontrado';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Origem de foto inválida';
END;
$$;

CREATE OR REPLACE FUNCTION public.gestao_os_fotos_sincronizar(p_os_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  v_os public.gestao_os%ROWTYPE;
  v_troca public.gestao_troca%ROWTYPE;
  v_veic public.veiculos_estoque%ROWTYPE;
  v_had_foto_refs boolean;
  inseridas integer := 0;
  n integer;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.gestao_os_foto_ref fr
    WHERE fr.user_id = uid AND fr.os_id = p_os_id
  ) INTO v_had_foto_refs;

  SELECT * INTO v_os FROM public.gestao_os g
   WHERE g.user_id = uid AND g.id = p_os_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'OS não encontrada'; END IF;

  SELECT * INTO v_veic FROM public.veiculos_estoque v
   WHERE v.user_id = uid AND v.id = v_os.veiculo_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Veículo não encontrado'; END IF;

  IF v_os.troca_id IS NOT NULL THEN
    SELECT * INTO v_troca FROM public.gestao_troca t
     WHERE t.user_id = uid AND t.id = v_os.troca_id;
    IF FOUND THEN
      INSERT INTO public.gestao_os_foto_ref (
        user_id, os_id, troca_id, origem, storage_path, troca_ia_item_id, selecionada, ordem
      )
      SELECT
        uid,
        v_os.id,
        v_troca.id,
        'troca',
        item.foto_path,
        item.id,
        true,
        item.ordem
      FROM public.gestao_troca_ia_item item
      WHERE item.user_id = uid
        AND item.troca_id = v_troca.id
        AND item.foto_path IS NOT NULL
        AND item.foto_path LIKE uid::text || '/' || v_troca.id::text || '/%'
        AND NOT public.gestao_os_foto_ref_crlv(
          public.gestao_os_foto_ref_etiqueta_troca(uid, v_troca.id, item.foto_path)
        )
        AND item.analise_id = (
          SELECT a.id FROM public.gestao_troca_analise_ia a
          WHERE a.user_id = uid AND a.troca_id = v_troca.id AND a.status = 'concluida'
          ORDER BY a.created_at DESC LIMIT 1
        )
      ON CONFLICT (os_id, storage_path) DO NOTHING;
      GET DIAGNOSTICS n = ROW_COUNT;
      inseridas := inseridas + n;

      INSERT INTO public.gestao_os_foto_ref (
        user_id, os_id, troca_id, origem, storage_path, selecionada, ordem
      )
      SELECT
        uid,
        v_os.id,
        v_troca.id,
        'troca',
        foto->>'path',
        false,
        (row_number() OVER (ORDER BY foto->>'path'))::integer + 1000
      FROM jsonb_array_elements(coalesce(v_troca.fotos_json, '[]'::jsonb)) AS foto
      WHERE foto ? 'path'
        AND coalesce(foto->>'path', '') <> ''
        AND foto->>'path' LIKE uid::text || '/' || v_troca.id::text || '/%'
        AND NOT public.gestao_os_foto_ref_crlv(foto->>'etiqueta')
        AND NOT EXISTS (
          SELECT 1 FROM public.gestao_os_foto_ref r
          WHERE r.os_id = v_os.id AND r.storage_path = foto->>'path'
        )
      ON CONFLICT (os_id, storage_path) DO NOTHING;
      GET DIAGNOSTICS n = ROW_COUNT;
      inseridas := inseridas + n;
    END IF;
  END IF;

  INSERT INTO public.gestao_os_foto_ref (
    user_id, os_id, troca_id, origem, storage_path, selecionada, ordem
  )
  SELECT
    uid,
    v_os.id,
    NULL,
    'anuncio',
    trim(foto.url),
    false,
    (row_number() OVER (ORDER BY foto.ord))::integer
  FROM unnest(coalesce(v_veic.fotos, ARRAY[]::text[])) WITH ORDINALITY AS foto(url, ord)
  WHERE trim(foto.url) <> ''
    AND NOT EXISTS (
      SELECT 1 FROM public.gestao_os_foto_ref r
      WHERE r.os_id = v_os.id AND r.storage_path = trim(foto.url)
    )
  ON CONFLICT (os_id, storage_path) DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;
  inseridas := inseridas + n;

  INSERT INTO public.gestao_os_foto_ref (
    user_id, os_id, troca_id, origem, storage_path, selecionada, ordem
  )
  SELECT
    uid,
    v_os.id,
    NULL,
    'os',
    d.storage_path,
    false,
    2000 + (row_number() OVER (ORDER BY d.created_at))::integer
  FROM public.gestao_os_documento d
  WHERE d.user_id = uid
    AND d.os_id = v_os.id
    AND d.deleted_at IS NULL
    AND d.mime_type LIKE 'image/%'
    AND d.tipo IN ('foto_checkin', 'foto_checkout', 'outro')
    AND NOT EXISTS (
      SELECT 1 FROM public.gestao_os_foto_ref r
      WHERE r.os_id = v_os.id AND r.storage_path = d.storage_path
    )
  ON CONFLICT (os_id, storage_path) DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;
  inseridas := inseridas + n;

  -- Primeira sincronização: sem fotos de troca → marcar 4 primeiras do anúncio (uma vez).
  IF NOT v_had_foto_refs
     AND NOT EXISTS (
       SELECT 1 FROM public.gestao_os_foto_ref fr
       WHERE fr.os_id = v_os.id AND fr.origem = 'troca'
     )
  THEN
    UPDATE public.gestao_os_foto_ref fr SET selecionada = true
    WHERE fr.id IN (
      SELECT fr2.id FROM public.gestao_os_foto_ref fr2
      WHERE fr2.os_id = v_os.id AND fr2.origem = 'anuncio'
      ORDER BY fr2.ordem ASC
      LIMIT 4
    );
  END IF;

  RETURN inseridas;
END;
$$;
REVOKE ALL ON FUNCTION public.gestao_os_fotos_sincronizar(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gestao_os_fotos_sincronizar(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.gestao_os_excluir(p_os_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
  uid uuid := auth.uid();
  v_os public.gestao_os%ROWTYPE;
  prefix text;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT * INTO v_os
  FROM public.gestao_os g
  WHERE g.id = p_os_id AND g.user_id = uid
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'OS não encontrada';
  END IF;

  IF v_os.status NOT IN ('rascunho', 'orcamento') THEN
    RAISE EXCEPTION 'OS aprovada não pode ser excluída, apenas cancelada';
  END IF;

  IF v_os.despesa_id IS NOT NULL OR v_os.conta_lancamento_id IS NOT NULL THEN
    RAISE EXCEPTION 'OS com lançamento financeiro não pode ser excluída';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.gestao_os_cotacao c
    WHERE c.user_id = uid AND c.os_id = v_os.id AND c.status = 'escolhida'
  ) THEN
    RAISE EXCEPTION 'OS com cotação escolhida não pode ser excluída';
  END IF;

  prefix := uid::text || '/os/' || v_os.id::text || '/';

  DELETE FROM public.gestao_os_cotacao_wa_sessao s
  WHERE s.user_id = uid
    AND s.cotacao_id IN (
      SELECT c.id FROM public.gestao_os_cotacao c
      WHERE c.user_id = uid AND c.os_id = v_os.id
    );

  DELETE FROM storage.objects
  WHERE bucket_id = 'gestao-os-documentos'
    AND name LIKE prefix || '%';

  DELETE FROM public.gestao_os g
  WHERE g.id = v_os.id AND g.user_id = uid;
END;
$$;
REVOKE ALL ON FUNCTION public.gestao_os_excluir(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gestao_os_excluir(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.gestao_os_cotacao_aplicar_resposta_parceiro(
  p_cotacao_id uuid,
  p_status text,
  p_valor numeric DEFAULT NULL,
  p_prazo_dias integer DEFAULT NULL,
  p_observacao text DEFAULT NULL,
  p_transcricao text DEFAULT NULL,
  p_whatsapp_message_id text DEFAULT NULL,
  p_whatsapp_conversation_id uuid DEFAULT NULL
)
RETURNS public.gestao_os_cotacao
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cot public.gestao_os_cotacao%ROWTYPE;
  v_parceiro public.gestao_parceiro%ROWTYPE;
  msg text;
BEGIN
  SELECT * INTO v_cot FROM public.gestao_os_cotacao c WHERE c.id = p_cotacao_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cotação não encontrada'; END IF;
  IF p_status NOT IN ('recebida', 'recusada') THEN
    RAISE EXCEPTION 'Status inválido para resposta de parceiro';
  END IF;

  SELECT * INTO v_parceiro FROM public.gestao_parceiro p WHERE p.id = v_cot.parceiro_id;

  IF p_status = 'recusada' THEN
    UPDATE public.gestao_os_cotacao c SET
      status = 'recusada',
      recusada_em = now(),
      canal = 'whatsapp',
      observacao = coalesce(nullif(trim(p_observacao), ''), c.observacao),
      transcricao_audio = coalesce(p_transcricao, c.transcricao_audio),
      whatsapp_resposta_message_id = coalesce(p_whatsapp_message_id, c.whatsapp_resposta_message_id),
      whatsapp_conversation_id = coalesce(p_whatsapp_conversation_id, c.whatsapp_conversation_id),
      updated_at = now()
    WHERE c.id = v_cot.id RETURNING * INTO v_cot;
    msg := coalesce(v_parceiro.nome, 'Parceiro') || ' recusou a cotação via WhatsApp.';
  ELSE
    IF p_valor IS NULL OR p_valor < 0 THEN
      RAISE EXCEPTION 'Informe o valor da cotação';
    END IF;
    UPDATE public.gestao_os_cotacao c SET
      status = 'recebida',
      valor = p_valor,
      prazo_dias = p_prazo_dias,
      observacao = nullif(trim(p_observacao), ''),
      recebida_em = now(),
      canal = 'whatsapp',
      transcricao_audio = coalesce(p_transcricao, c.transcricao_audio),
      whatsapp_resposta_message_id = coalesce(p_whatsapp_message_id, c.whatsapp_resposta_message_id),
      whatsapp_conversation_id = coalesce(p_whatsapp_conversation_id, c.whatsapp_conversation_id),
      updated_at = now()
    WHERE c.id = v_cot.id RETURNING * INTO v_cot;
    msg := coalesce(v_parceiro.nome, 'Parceiro') || ' respondeu via WhatsApp: R$ ' ||
      to_char(p_valor, 'FM999G999G990D00') ||
      coalesce(' · ' || p_prazo_dias || ' dia(s)', '');
  END IF;

  INSERT INTO public.gestao_os_evento (
    user_id, os_id, tipo, origem, mensagem, metadados_json
  ) VALUES (
    v_cot.user_id, v_cot.os_id, 'cotacao', 'whatsapp_parceiro', msg,
    jsonb_build_object(
      'cotacao_id', v_cot.id,
      'parceiro_id', v_cot.parceiro_id,
      'status', p_status,
      'valor', p_valor,
      'prazo_dias', p_prazo_dias
    )
  );
  RETURN v_cot;
END;
$$;
REVOKE ALL ON FUNCTION public.gestao_os_cotacao_aplicar_resposta_parceiro(
  uuid, text, numeric, integer, text, text, text, uuid
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gestao_os_cotacao_aplicar_resposta_parceiro(
  uuid, text, numeric, integer, text, text, text, uuid
) TO service_role;
