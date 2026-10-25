-- OS-1: domínio transacional owner-only

CREATE OR REPLACE FUNCTION public.gestao_os_proximo_numero(p_user_id uuid)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n bigint;
BEGIN
  INSERT INTO public.gestao_os_sequencia (user_id, ultimo_numero)
  VALUES (p_user_id, 1)
  ON CONFLICT (user_id) DO UPDATE
    SET ultimo_numero = gestao_os_sequencia.ultimo_numero + 1
  RETURNING ultimo_numero INTO n;
  RETURN n;
END;
$$;
REVOKE ALL ON FUNCTION public.gestao_os_proximo_numero(uuid) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.gestao_os_proximo_numero(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.gestao_os_criar(
  p_veiculo_id uuid,
  p_tipo text,
  p_parceiro_id uuid DEFAULT NULL,
  p_origem text DEFAULT 'manual',
  p_troca_id uuid DEFAULT NULL,
  p_valor_estimado numeric DEFAULT 0,
  p_data_prevista date DEFAULT NULL,
  p_observacao text DEFAULT NULL
)
RETURNS public.gestao_os
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  nova public.gestao_os%ROWTYPE;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF p_tipo NOT IN ('preparacao', 'garantia', 'revisao', 'avulsa') THEN
    RAISE EXCEPTION 'Tipo de OS inválido';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.veiculos_estoque
    WHERE user_id = uid AND id = p_veiculo_id
  ) THEN RAISE EXCEPTION 'Veículo não pertence a esta loja'; END IF;
  IF p_parceiro_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.gestao_parceiro
    WHERE user_id = uid AND id = p_parceiro_id AND ativo
  ) THEN RAISE EXCEPTION 'Parceiro não pertence a esta loja ou está inativo'; END IF;

  INSERT INTO public.gestao_os (
    user_id, numero, veiculo_id, parceiro_id, tipo, origem, troca_id,
    valor_estimado, data_prevista, observacao
  ) VALUES (
    uid, public.gestao_os_proximo_numero(uid), p_veiculo_id, p_parceiro_id,
    p_tipo, p_origem, p_troca_id, greatest(coalesce(p_valor_estimado, 0), 0),
    p_data_prevista, p_observacao
  )
  RETURNING * INTO nova;

  IF p_tipo = 'preparacao' THEN
    UPDATE public.veiculos_estoque
       SET pronto_anunciar_em = NULL
     WHERE user_id = uid AND id = p_veiculo_id;
  END IF;

  INSERT INTO public.gestao_os_evento (
    user_id, os_id, status_novo, tipo, autor_id, mensagem
  ) VALUES (uid, nova.id, 'rascunho', 'criada', uid, 'Ordem de serviço criada');
  RETURN nova;
END;
$$;
REVOKE ALL ON FUNCTION public.gestao_os_criar(
  uuid, text, uuid, text, uuid, numeric, date, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gestao_os_criar(
  uuid, text, uuid, text, uuid, numeric, date, text
) TO authenticated;

CREATE OR REPLACE FUNCTION public.gestao_os_criar_da_troca(
  p_troca_id uuid,
  p_parceiro_id uuid DEFAULT NULL,
  p_data_prevista date DEFAULT NULL
)
RETURNS public.gestao_os
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  troca public.gestao_troca%ROWTYPE;
  nova public.gestao_os%ROWTYPE;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  SELECT * INTO troca FROM public.gestao_troca
   WHERE user_id = uid AND id = p_troca_id
   FOR UPDATE;
  IF NOT FOUND OR troca.veiculo_id IS NULL THEN
    RAISE EXCEPTION 'Troca sem veículo de estoque nesta loja';
  END IF;

  SELECT * INTO nova FROM public.gestao_os
   WHERE user_id = uid AND troca_id = p_troca_id
     AND tipo = 'preparacao' AND origem = 'troca';
  IF FOUND THEN RETURN nova; END IF;

  SELECT * INTO nova FROM public.gestao_os_criar(
    troca.veiculo_id, 'preparacao', p_parceiro_id, 'troca', troca.id,
    troca.preparacao_estimada, p_data_prevista,
    'Criada a partir do laudo da troca'
  );

  INSERT INTO public.gestao_os_item (
    user_id, os_id, descricao, categoria_despesa, valor_estimado,
    status, origem, troca_ia_item_id, checklist_key
  )
  SELECT
    uid,
    nova.id,
    item.descricao,
    CASE
      WHEN item.servico IN ('funilaria', 'pintura', 'martelinho') THEN 'funilaria_pintura'
      WHEN item.servico = 'higienizacao' THEN 'estetica'
      WHEN item.categoria_custo = 'pneu' THEN 'pneus'
      WHEN item.servico = 'mecanica' THEN 'mecanica'
      ELSE 'outros'
    END,
    coalesce(item.valor_estimado, 0),
    'sugerido',
    'laudo',
    item.id,
    item.checklist_key
  FROM public.gestao_troca_ia_item item
  WHERE item.user_id = uid
    AND item.troca_id = troca.id
    AND item.decisao <> 'descartado'
    AND item.servico IS DISTINCT FROM 'nenhum'
    AND item.analise_id = (
      SELECT a.id FROM public.gestao_troca_analise_ia a
      WHERE a.user_id = uid AND a.troca_id = troca.id AND a.status = 'concluida'
      ORDER BY a.created_at DESC LIMIT 1
    )
  ON CONFLICT DO NOTHING;

  IF NOT EXISTS (SELECT 1 FROM public.gestao_os_item WHERE os_id = nova.id)
     AND troca.preparacao_estimada > 0 THEN
    INSERT INTO public.gestao_os_item (
      user_id, os_id, descricao, categoria_despesa, valor_estimado, origem, checklist_key
    ) VALUES (
      uid, nova.id, 'Preparação estimada no laudo', 'outros',
      troca.preparacao_estimada, 'laudo', 'preparacao_estimada'
    );
  END IF;

  RETURN nova;
END;
$$;
REVOKE ALL ON FUNCTION public.gestao_os_criar_da_troca(uuid, uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gestao_os_criar_da_troca(uuid, uuid, date) TO authenticated;

CREATE OR REPLACE FUNCTION public.gestao_os_sincronizar_financeiro(
  p_os_id uuid
)
RETURNS public.gestao_os
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  ordem public.gestao_os%ROWTYPE;
  despesa public.veiculo_despesas%ROWTYPE;
  conta public.gestao_conta_lancamento%ROWTYPE;
  config public.gestao_os_config%ROWTYPE;
  categoria text;
  origem_op text;
  aviso text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  SELECT * INTO ordem FROM public.gestao_os
   WHERE user_id = uid AND id = p_os_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'OS não encontrada'; END IF;
  IF ordem.status <> 'concluida' OR ordem.valor_real IS NULL THEN
    RAISE EXCEPTION 'Somente OS concluída e com valor real pode sincronizar';
  END IF;

  SELECT CASE WHEN count(DISTINCT categoria_despesa) = 1
              THEN min(categoria_despesa) ELSE 'outros' END
    INTO categoria
    FROM public.gestao_os_item
   WHERE os_id = ordem.id AND status NOT IN ('recusado', 'cancelado');
  categoria := coalesce(categoria, 'outros');
  origem_op := 'os_' || ordem.tipo;

  IF ordem.despesa_id IS NULL THEN
    INSERT INTO public.veiculo_despesas (
      user_id, veiculo_id, data, categoria, valor, descricao,
      origem_lancamento, lancado_por, descontar_do_consignante,
      origem_operacional, origem_operacional_id
    ) VALUES (
      uid, ordem.veiculo_id, current_date, categoria, ordem.valor_real,
      'OS ' || ordem.numero::text, 'automatica', 'OS',
      coalesce(ordem.descontar_do_consignante, false), origem_op, ordem.id
    )
    RETURNING * INTO despesa;
    ordem.despesa_id := despesa.id;
  ELSE
    SELECT * INTO despesa FROM public.veiculo_despesas
     WHERE user_id = uid AND id = ordem.despesa_id FOR UPDATE;
    IF despesa.deleted_at IS NOT NULL THEN
      aviso := 'Despesa apagada manualmente não foi recriada';
    ELSIF ordem.valor_sincronizado IS NOT NULL AND (
      despesa.valor IS DISTINCT FROM ordem.valor_sincronizado OR
      despesa.categoria IS DISTINCT FROM ordem.despesa_categoria_sincronizada
    ) THEN
      aviso := 'Despesa editada manualmente foi preservada';
    ELSE
      UPDATE public.veiculo_despesas
         SET valor = ordem.valor_real,
             categoria = categoria,
             descontar_do_consignante = coalesce(ordem.descontar_do_consignante, false)
       WHERE id = despesa.id;
    END IF;
  END IF;

  IF ordem.conta_lancamento_id IS NULL THEN
    INSERT INTO public.gestao_os_config (user_id) VALUES (uid)
      ON CONFLICT (user_id) DO NOTHING;
    SELECT * INTO config FROM public.gestao_os_config WHERE user_id = uid;
    INSERT INTO public.gestao_conta_lancamento (
      user_id, tipo, categoria_operacional, valor, vencimento, observacao,
      veiculo_id, parceiro_id, origem, natureza
    ) VALUES (
      uid, 'pagar', 'manutencao_loja', ordem.valor_real,
      coalesce(ordem.conta_vencimento, current_date + config.conta_pagar_vencimento_dias),
      'OS ' || ordem.numero::text || ' · fornecedor ' || coalesce(ordem.parceiro_id::text, 'não informado'),
      ordem.veiculo_id, ordem.parceiro_id, 'os_auto', 'custo_veiculo'
    )
    RETURNING * INTO conta;
    ordem.conta_lancamento_id := conta.id;
  ELSE
    SELECT * INTO conta FROM public.gestao_conta_lancamento
     WHERE user_id = uid AND id = ordem.conta_lancamento_id FOR UPDATE;
    IF conta.deleted_at IS NOT NULL THEN
      aviso := concat_ws(' · ', aviso, 'Conta apagada manualmente não foi recriada');
    ELSIF conta.pago_em IS NOT NULL OR conta.recebido_em IS NOT NULL THEN
      aviso := concat_ws(' · ', aviso, 'Conta paga/baixada foi preservada');
    ELSIF ordem.valor_sincronizado IS NOT NULL AND (
      conta.valor IS DISTINCT FROM ordem.valor_sincronizado OR
      conta.vencimento IS DISTINCT FROM ordem.conta_vencimento_sincronizado OR
      conta.parceiro_id IS DISTINCT FROM ordem.parceiro_sincronizado_id OR
      conta.tipo IS DISTINCT FROM 'pagar' OR
      conta.categoria_operacional IS DISTINCT FROM 'manutencao_loja'
    ) THEN
      aviso := concat_ws(' · ', aviso, 'Conta editada manualmente foi preservada');
    ELSE
      UPDATE public.gestao_conta_lancamento
         SET valor = ordem.valor_real,
             vencimento = coalesce(ordem.conta_vencimento, conta.vencimento),
             parceiro_id = ordem.parceiro_id
       WHERE id = conta.id;
    END IF;
  END IF;

  UPDATE public.gestao_os SET
    despesa_id = ordem.despesa_id,
    conta_lancamento_id = ordem.conta_lancamento_id,
    valor_sincronizado = ordem.valor_real,
    despesa_categoria_sincronizada = categoria,
    conta_vencimento_sincronizado = coalesce(
      ordem.conta_vencimento,
      conta.vencimento
    ),
    parceiro_sincronizado_id = ordem.parceiro_id,
    sync_aviso = aviso
  WHERE id = ordem.id
  RETURNING * INTO ordem;
  RETURN ordem;
END;
$$;
REVOKE ALL ON FUNCTION public.gestao_os_sincronizar_financeiro(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gestao_os_sincronizar_financeiro(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.gestao_os_transicionar(
  p_os_id uuid,
  p_status text,
  p_valor_aprovado numeric DEFAULT NULL,
  p_valor_real numeric DEFAULT NULL,
  p_descontar_do_consignante boolean DEFAULT NULL,
  p_conta_vencimento date DEFAULT NULL,
  p_mensagem text DEFAULT NULL
)
RETURNS public.gestao_os
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  ordem public.gestao_os%ROWTYPE;
  anterior text;
  consignado boolean;
  abertas integer;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  SELECT * INTO ordem FROM public.gestao_os
   WHERE user_id = uid AND id = p_os_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'OS não encontrada'; END IF;
  anterior := ordem.status;

  IF p_status = 'cancelada' THEN
    IF anterior IN ('concluida', 'cancelada') THEN RAISE EXCEPTION 'OS não pode ser cancelada'; END IF;
  ELSIF NOT (
    (anterior = 'rascunho' AND p_status = 'orcamento') OR
    (anterior = 'orcamento' AND p_status = 'aguardando_aprovacao') OR
    (anterior = 'aguardando_aprovacao' AND p_status = 'aprovada') OR
    (anterior = 'aprovada' AND p_status = 'checkin') OR
    (anterior = 'checkin' AND p_status = 'em_execucao') OR
    (anterior = 'em_execucao' AND p_status IN ('aguardando_retirada', 'aguardando_aprovacao')) OR
    (anterior = 'aguardando_retirada' AND p_status = 'checkout') OR
    (anterior = 'checkout' AND p_status = 'concluida')
  ) THEN RAISE EXCEPTION 'Transição inválida: % → %', anterior, p_status;
  END IF;

  IF p_status <> 'cancelada' AND ordem.parceiro_id IS NULL THEN
    RAISE EXCEPTION 'Informe o fornecedor antes de avançar a OS';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.veiculo_consignacao
    WHERE user_id = uid AND veiculo_id = ordem.veiculo_id AND status = 'ativo'
  ) INTO consignado;
  IF p_status = 'aprovada' THEN
    IF p_valor_aprovado IS NULL OR p_valor_aprovado < 0 THEN
      RAISE EXCEPTION 'Informe o valor aprovado';
    END IF;
    IF consignado AND p_descontar_do_consignante IS NULL THEN
      RAISE EXCEPTION 'Escolha explicitamente se desconta do dono';
    END IF;
  END IF;

  IF p_status = 'checkin' AND NOT EXISTS (
    SELECT 1 FROM public.gestao_os_vistoria WHERE os_id = ordem.id AND tipo = 'checkin'
  ) THEN RAISE EXCEPTION 'Registre o check-in com km e checklist'; END IF;

  IF p_status = 'concluida' THEN
    IF p_valor_real IS NULL OR p_valor_real < 0 THEN RAISE EXCEPTION 'Informe o valor real'; END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.gestao_os_vistoria WHERE os_id = ordem.id AND tipo = 'checkout'
    ) THEN RAISE EXCEPTION 'Registre o check-out com km e checklist'; END IF;
  END IF;

  UPDATE public.gestao_os SET
    status = p_status,
    valor_aprovado = CASE WHEN p_status = 'aprovada' THEN p_valor_aprovado ELSE valor_aprovado END,
    valor_real = CASE WHEN p_status = 'concluida' THEN p_valor_real ELSE valor_real END,
    descontar_do_consignante = CASE
      WHEN p_status = 'aprovada' THEN coalesce(p_descontar_do_consignante, false)
      ELSE descontar_do_consignante END,
    aprovado_por = CASE WHEN p_status = 'aprovada' THEN uid ELSE aprovado_por END,
    aprovado_em = CASE WHEN p_status = 'aprovada' THEN now() ELSE aprovado_em END,
    iniciada_em = CASE WHEN p_status = 'em_execucao' THEN coalesce(iniciada_em, now()) ELSE iniciada_em END,
    concluida_em = CASE WHEN p_status = 'concluida' THEN now() ELSE concluida_em END,
    conta_vencimento = coalesce(p_conta_vencimento, conta_vencimento),
    ultima_movimentacao_em = now()
  WHERE id = ordem.id
  RETURNING * INTO ordem;

  INSERT INTO public.gestao_os_evento (
    user_id, os_id, status_anterior, status_novo, tipo, autor_id, mensagem
  ) VALUES (
    uid, ordem.id, anterior, p_status, 'status', uid,
    coalesce(nullif(trim(p_mensagem), ''), anterior || ' → ' || p_status)
  );

  IF p_status = 'concluida' THEN
    SELECT * INTO ordem FROM public.gestao_os_sincronizar_financeiro(ordem.id);
  END IF;

  IF ordem.tipo = 'preparacao' AND p_status IN ('concluida', 'cancelada') THEN
    SELECT count(*) INTO abertas FROM public.gestao_os
     WHERE user_id = uid AND veiculo_id = ordem.veiculo_id
       AND tipo = 'preparacao' AND status NOT IN ('concluida', 'cancelada');
    IF abertas = 0 THEN
      UPDATE public.veiculos_estoque
         SET pronto_anunciar_em = now()
       WHERE user_id = uid AND id = ordem.veiculo_id AND status = 'em_preparacao';
    END IF;
  END IF;
  RETURN ordem;
END;
$$;
REVOKE ALL ON FUNCTION public.gestao_os_transicionar(
  uuid, text, numeric, numeric, boolean, date, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gestao_os_transicionar(
  uuid, text, numeric, numeric, boolean, date, text
) TO authenticated;

CREATE OR REPLACE FUNCTION public.gestao_garantia_ativar(p_veiculo_id uuid)
RETURNS public.gestao_garantia
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  venda public.veiculo_venda%ROWTYPE;
  config public.gestao_os_config%ROWTYPE;
  garantia public.gestao_garantia%ROWTYPE;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  SELECT * INTO venda FROM public.veiculo_venda
   WHERE user_id = uid AND veiculo_id = p_veiculo_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Venda não encontrada'; END IF;
  INSERT INTO public.gestao_os_config (user_id) VALUES (uid)
    ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO config FROM public.gestao_os_config WHERE user_id = uid;
  INSERT INTO public.gestao_garantia (
    user_id, veiculo_id, venda_veiculo_id, inicio,
    prazo_legal_dias, prazo_contratual_dias
  ) VALUES (
    uid, p_veiculo_id, p_veiculo_id, venda.data_venda,
    config.garantia_legal_dias, config.garantia_contratual_dias
  )
  ON CONFLICT (user_id, veiculo_id) DO UPDATE SET updated_at = now()
  RETURNING * INTO garantia;
  RETURN garantia;
END;
$$;
REVOKE ALL ON FUNCTION public.gestao_garantia_ativar(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gestao_garantia_ativar(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.gestao_garantia_criar_na_venda()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  config public.gestao_os_config%ROWTYPE;
BEGIN
  INSERT INTO public.gestao_os_config (user_id) VALUES (NEW.user_id)
    ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO config FROM public.gestao_os_config WHERE user_id = NEW.user_id;
  INSERT INTO public.gestao_garantia (
    user_id, veiculo_id, venda_veiculo_id, inicio,
    prazo_legal_dias, prazo_contratual_dias
  ) VALUES (
    NEW.user_id, NEW.veiculo_id, NEW.veiculo_id, NEW.data_venda,
    config.garantia_legal_dias, config.garantia_contratual_dias
  )
  ON CONFLICT (user_id, veiculo_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER gestao_garantia_criar_na_venda_trigger
  AFTER INSERT ON public.veiculo_venda
  FOR EACH ROW EXECUTE FUNCTION public.gestao_garantia_criar_na_venda();

CREATE OR REPLACE FUNCTION public.gestao_garantia_abrir_ocorrencia(
  p_veiculo_id uuid,
  p_relato text,
  p_parceiro_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  garantia public.gestao_garantia%ROWTYPE;
  ocorrencia public.gestao_garantia_ocorrencia%ROWTYPE;
  ordem public.gestao_os%ROWTYPE;
BEGIN
  IF nullif(trim(p_relato), '') IS NULL THEN RAISE EXCEPTION 'Informe o relato'; END IF;
  SELECT * INTO garantia FROM public.gestao_garantia_ativar(p_veiculo_id);
  INSERT INTO public.gestao_garantia_ocorrencia (user_id, garantia_id, relato)
  VALUES (uid, garantia.id, trim(p_relato))
  RETURNING * INTO ocorrencia;
  SELECT * INTO ordem FROM public.gestao_os_criar(
    p_veiculo_id, 'garantia', p_parceiro_id, 'venda_garantia', NULL,
    0, NULL, 'Ocorrência de garantia: ' || ocorrencia.id::text
  );
  UPDATE public.gestao_os
     SET garantia_id = garantia.id, ocorrencia_garantia_id = ocorrencia.id
   WHERE id = ordem.id RETURNING * INTO ordem;
  UPDATE public.gestao_garantia_ocorrencia SET os_id = ordem.id WHERE id = ocorrencia.id;
  RETURN jsonb_build_object(
    'garantia_id', garantia.id, 'ocorrencia_id', ocorrencia.id, 'os_id', ordem.id
  );
END;
$$;
REVOKE ALL ON FUNCTION public.gestao_garantia_abrir_ocorrencia(uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gestao_garantia_abrir_ocorrencia(uuid, text, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.gestao_validar_liberacao_vitrine()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'em_preparacao' AND NEW.status = 'disponivel' THEN
    IF NEW.preco IS NULL OR NEW.preco <= 0 THEN
      RAISE EXCEPTION 'Informe o preço antes de liberar na vitrine';
    END IF;
    IF coalesce(array_length(NEW.fotos, 1), 0) = 0 THEN
      RAISE EXCEPTION 'Adicione pelo menos uma foto antes de liberar na vitrine';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.gestao_os
      WHERE user_id = NEW.user_id AND veiculo_id = NEW.id
        AND tipo = 'preparacao' AND status NOT IN ('concluida', 'cancelada')
    ) THEN RAISE EXCEPTION 'Conclua ou cancele todas as OS de preparação'; END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER gestao_validar_liberacao_vitrine_trigger
  BEFORE UPDATE OF status ON public.veiculos_estoque
  FOR EACH ROW EXECUTE FUNCTION public.gestao_validar_liberacao_vitrine();
