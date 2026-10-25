-- OS-1.3: cotação multi-parceiro, fotos da troca por referência, laudo sem valores

CREATE TABLE IF NOT EXISTS public.gestao_os_cotacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  os_id uuid NOT NULL,
  parceiro_id uuid NOT NULL,
  valor numeric(14, 2) NULL CHECK (valor IS NULL OR valor >= 0),
  prazo_dias integer NULL CHECK (prazo_dias IS NULL OR prazo_dias >= 0),
  observacao text NULL,
  status text NOT NULL DEFAULT 'solicitada' CHECK (
    status IN ('solicitada', 'recebida', 'escolhida', 'descartada')
  ),
  solicitada_em timestamptz NOT NULL DEFAULT now(),
  recebida_em timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gestao_os_cotacao_tenant_fk
    FOREIGN KEY (user_id, os_id)
    REFERENCES public.gestao_os(user_id, id) ON DELETE CASCADE,
  CONSTRAINT gestao_os_cotacao_parceiro_tenant_fk
    FOREIGN KEY (user_id, parceiro_id)
    REFERENCES public.gestao_parceiro(user_id, id) ON DELETE RESTRICT,
  UNIQUE (os_id, parceiro_id),
  UNIQUE (user_id, id)
);

CREATE INDEX IF NOT EXISTS gestao_os_cotacao_os_idx
  ON public.gestao_os_cotacao (os_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.gestao_os_foto_ref (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  os_id uuid NOT NULL,
  troca_id uuid NOT NULL,
  storage_path text NOT NULL,
  troca_ia_item_id uuid NULL REFERENCES public.gestao_troca_ia_item(id) ON DELETE SET NULL,
  selecionada boolean NOT NULL DEFAULT false,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gestao_os_foto_ref_tenant_fk
    FOREIGN KEY (user_id, os_id)
    REFERENCES public.gestao_os(user_id, id) ON DELETE CASCADE,
  CONSTRAINT gestao_os_foto_ref_troca_tenant_fk
    FOREIGN KEY (user_id, troca_id)
    REFERENCES public.gestao_troca(user_id, id) ON DELETE CASCADE,
  CONSTRAINT gestao_os_foto_ref_path_check
    CHECK (storage_path LIKE user_id::text || '/' || troca_id::text || '/%'),
  UNIQUE (os_id, storage_path),
  UNIQUE (user_id, id)
);

CREATE INDEX IF NOT EXISTS gestao_os_foto_ref_os_idx
  ON public.gestao_os_foto_ref (os_id, selecionada DESC, ordem ASC);

ALTER TABLE public.gestao_os_cotacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gestao_os_foto_ref ENABLE ROW LEVEL SECURITY;

CREATE POLICY gestao_os_cotacao_select_owner ON public.gestao_os_cotacao
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY gestao_os_cotacao_update_observacao ON public.gestao_os_cotacao
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY gestao_os_foto_ref_select_owner ON public.gestao_os_foto_ref
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY gestao_os_foto_ref_update_selecao ON public.gestao_os_foto_ref
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

REVOKE ALL ON public.gestao_os_cotacao FROM PUBLIC, authenticated;
GRANT SELECT ON public.gestao_os_cotacao TO authenticated;
GRANT UPDATE (observacao) ON public.gestao_os_cotacao TO authenticated;

REVOKE ALL ON public.gestao_os_foto_ref FROM PUBLIC, authenticated;
GRANT SELECT ON public.gestao_os_foto_ref TO authenticated;
GRANT UPDATE (selecionada, ordem) ON public.gestao_os_foto_ref TO authenticated;

GRANT ALL ON public.gestao_os_cotacao, public.gestao_os_foto_ref TO service_role;

CREATE TRIGGER update_gestao_os_cotacao_updated_at
  BEFORE UPDATE ON public.gestao_os_cotacao
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.gestao_os_documento
  DROP CONSTRAINT IF EXISTS gestao_os_documento_tipo_check;
ALTER TABLE public.gestao_os_documento
  ADD CONSTRAINT gestao_os_documento_tipo_check CHECK (tipo IN (
    'foto_checkin', 'foto_checkout', 'orcamento', 'pedido_cotacao', 'os_aprovada',
    'nota', 'comprovante', 'outro'
  ));

CREATE OR REPLACE FUNCTION public.gestao_os_foto_ref_crlv(p_etiqueta text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(trim(coalesce(p_etiqueta, ''))) IN (
    'documento (crlv)', 'crlv', 'documento crlv'
  );
$$;

CREATE OR REPLACE FUNCTION public.gestao_os_foto_ref_etiqueta_troca(
  p_user_id uuid,
  p_troca_id uuid,
  p_storage_path text
)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT foto->>'etiqueta'
  FROM public.gestao_troca t,
       jsonb_array_elements(coalesce(t.fotos_json, '[]'::jsonb)) AS foto
  WHERE t.user_id = p_user_id
    AND t.id = p_troca_id
    AND foto->>'path' = p_storage_path
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.gestao_os_foto_ref_bloqueia_crlv()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  etiqueta text;
BEGIN
  etiqueta := public.gestao_os_foto_ref_etiqueta_troca(
    NEW.user_id, NEW.troca_id, NEW.storage_path
  );
  IF public.gestao_os_foto_ref_crlv(etiqueta) THEN
    RAISE EXCEPTION 'Documento (CRLV) não pode ser vinculado à OS nem enviado ao parceiro';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER gestao_os_foto_ref_sem_crlv
  BEFORE INSERT ON public.gestao_os_foto_ref
  FOR EACH ROW EXECUTE FUNCTION public.gestao_os_foto_ref_bloqueia_crlv();

CREATE OR REPLACE FUNCTION public.gestao_os_cotacao_bloqueia_update_direto()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND (
    NEW.status IS DISTINCT FROM OLD.status OR
    NEW.valor IS DISTINCT FROM OLD.valor OR
    NEW.prazo_dias IS DISTINCT FROM OLD.prazo_dias OR
    NEW.recebida_em IS DISTINCT FROM OLD.recebida_em OR
    NEW.solicitada_em IS DISTINCT FROM OLD.solicitada_em OR
    NEW.parceiro_id IS DISTINCT FROM OLD.parceiro_id OR
    NEW.os_id IS DISTINCT FROM OLD.os_id
  ) THEN
    RAISE EXCEPTION 'Status e valores da cotação só podem ser alterados pelas ações do sistema';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER gestao_os_cotacao_guard_update
  BEFORE UPDATE ON public.gestao_os_cotacao
  FOR EACH ROW EXECUTE FUNCTION public.gestao_os_cotacao_bloqueia_update_direto();

CREATE OR REPLACE FUNCTION public.gestao_os_fotos_sincronizar_troca(p_os_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  ordem public.gestao_os%ROWTYPE;
  troca public.gestao_troca%ROWTYPE;
  inseridas integer := 0;
  n integer;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  SELECT * INTO ordem FROM public.gestao_os
   WHERE user_id = uid AND id = p_os_id;
  IF NOT FOUND OR ordem.troca_id IS NULL THEN RETURN 0; END IF;

  SELECT * INTO troca FROM public.gestao_troca
   WHERE user_id = uid AND id = ordem.troca_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  INSERT INTO public.gestao_os_foto_ref (
    user_id, os_id, troca_id, storage_path, troca_ia_item_id, selecionada, ordem
  )
  SELECT
    uid,
    ordem.id,
    troca.id,
    item.foto_path,
    item.id,
    true,
    item.ordem
  FROM public.gestao_troca_ia_item item
  WHERE item.user_id = uid
    AND item.troca_id = troca.id
    AND item.foto_path IS NOT NULL
    AND item.foto_path LIKE uid::text || '/' || troca.id::text || '/%'
    AND NOT public.gestao_os_foto_ref_crlv(
      public.gestao_os_foto_ref_etiqueta_troca(uid, troca.id, item.foto_path)
    )
    AND item.analise_id = (
      SELECT a.id FROM public.gestao_troca_analise_ia a
      WHERE a.user_id = uid AND a.troca_id = troca.id AND a.status = 'concluida'
      ORDER BY a.created_at DESC LIMIT 1
    )
  ON CONFLICT (os_id, storage_path) DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;
  inseridas := inseridas + n;

  INSERT INTO public.gestao_os_foto_ref (
    user_id, os_id, troca_id, storage_path, selecionada, ordem
  )
  SELECT
    uid,
    ordem.id,
    troca.id,
    foto->>'path',
    false,
    (row_number() OVER (ORDER BY foto->>'path'))::integer + 1000
  FROM jsonb_array_elements(coalesce(troca.fotos_json, '[]'::jsonb)) AS foto
  WHERE foto ? 'path'
    AND coalesce(foto->>'path', '') <> ''
    AND foto->>'path' LIKE uid::text || '/' || troca.id::text || '/%'
    AND NOT public.gestao_os_foto_ref_crlv(foto->>'etiqueta')
    AND NOT EXISTS (
      SELECT 1 FROM public.gestao_os_foto_ref r
      WHERE r.os_id = ordem.id AND r.storage_path = foto->>'path'
    )
  ON CONFLICT (os_id, storage_path) DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;
  inseridas := inseridas + n;
  RETURN inseridas;
END;
$$;
REVOKE ALL ON FUNCTION public.gestao_os_fotos_sincronizar_troca(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gestao_os_fotos_sincronizar_troca(uuid) TO authenticated;

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
  IF FOUND THEN
    PERFORM public.gestao_os_fotos_sincronizar_troca(nova.id);
    RETURN nova;
  END IF;

  SELECT * INTO nova FROM public.gestao_os_criar(
    troca.veiculo_id, 'preparacao', p_parceiro_id, 'troca', troca.id,
    0, p_data_prevista,
    'Criada a partir do laudo da troca (itens sem valor — aguardando cotação)'
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
    0,
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

  PERFORM public.gestao_os_fotos_sincronizar_troca(nova.id);
  RETURN nova;
END;
$$;

CREATE OR REPLACE FUNCTION public.gestao_os_cotacao_solicitar(
  p_os_id uuid,
  p_parceiro_ids uuid[]
)
RETURNS SETOF public.gestao_os_cotacao
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  ordem public.gestao_os%ROWTYPE;
  pid uuid;
  anterior text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF p_parceiro_ids IS NULL OR cardinality(p_parceiro_ids) = 0 THEN
    RAISE EXCEPTION 'Escolha ao menos um parceiro para cotação';
  END IF;

  SELECT * INTO ordem FROM public.gestao_os
   WHERE user_id = uid AND id = p_os_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'OS não encontrada'; END IF;
  IF ordem.status IN ('concluida', 'cancelada') THEN
    RAISE EXCEPTION 'OS encerrada não aceita cotação';
  END IF;

  FOREACH pid IN ARRAY p_parceiro_ids LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.gestao_parceiro
      WHERE user_id = uid AND id = pid AND ativo
    ) THEN
      RAISE EXCEPTION 'Parceiro inválido ou inativo';
    END IF;

    INSERT INTO public.gestao_os_cotacao (user_id, os_id, parceiro_id, status)
    VALUES (uid, ordem.id, pid, 'solicitada')
    ON CONFLICT (os_id, parceiro_id) DO UPDATE
      SET status = CASE
            WHEN gestao_os_cotacao.status IN ('escolhida', 'descartada')
              THEN gestao_os_cotacao.status
            ELSE 'solicitada'
          END,
          solicitada_em = CASE
            WHEN gestao_os_cotacao.status IN ('escolhida', 'descartada')
              THEN gestao_os_cotacao.solicitada_em
            ELSE now()
          END,
          updated_at = now()
    WHERE gestao_os_cotacao.status NOT IN ('escolhida', 'descartada');
  END LOOP;

  anterior := ordem.status;
  IF ordem.status = 'rascunho' THEN
    UPDATE public.gestao_os SET
      status = 'orcamento',
      ultima_movimentacao_em = now()
    WHERE id = ordem.id
    RETURNING * INTO ordem;

    INSERT INTO public.gestao_os_evento (
      user_id, os_id, status_anterior, status_novo, tipo, autor_id, mensagem
    ) VALUES (
      uid, ordem.id, anterior, 'orcamento', 'status', uid,
      'Cotação solicitada a ' || cardinality(p_parceiro_ids) || ' parceiro(s)'
    );
  END IF;

  RETURN QUERY
  SELECT * FROM public.gestao_os_cotacao
   WHERE user_id = uid AND os_id = ordem.id
   ORDER BY solicitada_em DESC;
END;
$$;
REVOKE ALL ON FUNCTION public.gestao_os_cotacao_solicitar(uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gestao_os_cotacao_solicitar(uuid, uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.gestao_os_cotacao_registrar(
  p_cotacao_id uuid,
  p_valor numeric,
  p_prazo_dias integer DEFAULT NULL,
  p_observacao text DEFAULT NULL
)
RETURNS public.gestao_os_cotacao
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  cot public.gestao_os_cotacao%ROWTYPE;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF p_valor IS NULL OR p_valor < 0 THEN
    RAISE EXCEPTION 'Informe o valor da cotação';
  END IF;

  SELECT * INTO cot FROM public.gestao_os_cotacao
   WHERE user_id = uid AND id = p_cotacao_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cotação não encontrada'; END IF;
  IF cot.status = 'escolhida' THEN
    RAISE EXCEPTION 'Cotação já escolhida';
  END IF;

  UPDATE public.gestao_os_cotacao SET
    valor = p_valor,
    prazo_dias = p_prazo_dias,
    observacao = nullif(trim(p_observacao), ''),
    status = 'recebida',
    recebida_em = now(),
    updated_at = now()
  WHERE id = cot.id
  RETURNING * INTO cot;

  INSERT INTO public.gestao_os_evento (
    user_id, os_id, tipo, autor_id, mensagem
  ) VALUES (
    uid, cot.os_id, 'cotacao', uid,
    'Cotação recebida: R$ ' || to_char(p_valor, 'FM999G999G990D00') ||
      coalesce(' · ' || p_prazo_dias || ' dia(s)', '')
  );
  RETURN cot;
END;
$$;
REVOKE ALL ON FUNCTION public.gestao_os_cotacao_registrar(uuid, numeric, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gestao_os_cotacao_registrar(uuid, numeric, integer, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.gestao_os_cotacao_escolher(p_cotacao_id uuid)
RETURNS public.gestao_os
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  cot public.gestao_os_cotacao%ROWTYPE;
  ordem public.gestao_os%ROWTYPE;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT * INTO cot FROM public.gestao_os_cotacao
   WHERE user_id = uid AND id = p_cotacao_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cotação não encontrada'; END IF;
  IF cot.status <> 'recebida' OR cot.valor IS NULL THEN
    RAISE EXCEPTION 'Registre o valor recebido antes de escolher';
  END IF;

  SELECT * INTO ordem FROM public.gestao_os
   WHERE user_id = uid AND id = cot.os_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'OS não encontrada'; END IF;
  IF ordem.status IN ('concluida', 'cancelada') THEN
    RAISE EXCEPTION 'OS encerrada';
  END IF;
  IF ordem.status NOT IN ('rascunho', 'orcamento', 'aguardando_aprovacao') THEN
    RAISE EXCEPTION
      'A OS já foi aprovada; para trocar de fornecedor, cancele e abra nova OS';
  END IF;

  UPDATE public.gestao_os_cotacao SET
    status = 'descartada',
    updated_at = now()
  WHERE user_id = uid AND os_id = cot.os_id AND id <> cot.id
    AND status IN ('solicitada', 'recebida');

  UPDATE public.gestao_os_cotacao SET
    status = 'escolhida',
    updated_at = now()
  WHERE id = cot.id;

  UPDATE public.gestao_os SET
    parceiro_id = cot.parceiro_id,
    valor_aprovado = cot.valor,
    ultima_movimentacao_em = now()
  WHERE id = ordem.id
  RETURNING * INTO ordem;

  INSERT INTO public.gestao_os_evento (
    user_id, os_id, tipo, autor_id, mensagem, metadados_json
  ) VALUES (
    uid, ordem.id, 'cotacao', uid,
    'Cotação escolhida — fornecedor e valor aprovado definidos',
    jsonb_build_object('cotacao_id', cot.id, 'parceiro_id', cot.parceiro_id, 'valor', cot.valor)
  );
  RETURN ordem;
END;
$$;
REVOKE ALL ON FUNCTION public.gestao_os_cotacao_escolher(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gestao_os_cotacao_escolher(uuid) TO authenticated;

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
  valor_aprovado_efetivo numeric;
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

  IF p_status IN (
    'aguardando_aprovacao', 'aprovada', 'checkin', 'em_execucao',
    'aguardando_retirada', 'checkout', 'concluida'
  ) AND ordem.parceiro_id IS NULL THEN
    RAISE EXCEPTION 'Escolha o fornecedor (cotação) antes de avançar a OS';
  END IF;

  IF p_status = 'orcamento' AND anterior = 'rascunho' THEN
    IF ordem.parceiro_id IS NULL AND NOT EXISTS (
      SELECT 1 FROM public.gestao_os_cotacao c
      WHERE c.user_id = uid AND c.os_id = ordem.id
    ) THEN
      RAISE EXCEPTION 'Solicite cotação ou informe fornecedor direto';
    END IF;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.veiculo_consignacao
    WHERE user_id = uid AND veiculo_id = ordem.veiculo_id AND status = 'ativo'
  ) INTO consignado;

  valor_aprovado_efetivo := coalesce(p_valor_aprovado, ordem.valor_aprovado);
  IF p_status = 'aprovada' THEN
    IF valor_aprovado_efetivo IS NULL OR valor_aprovado_efetivo < 0 THEN
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
    valor_aprovado = CASE
      WHEN p_status = 'aprovada' THEN valor_aprovado_efetivo
      ELSE valor_aprovado
    END,
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
