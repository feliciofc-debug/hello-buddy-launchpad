-- OS-1.1: natureza contábil separa fluxo de caixa de despesa operacional

ALTER TABLE public.gestao_conta_lancamento
  ADD COLUMN IF NOT EXISTS natureza text NOT NULL DEFAULT 'operacional';

ALTER TABLE public.gestao_conta_lancamento
  DROP CONSTRAINT IF EXISTS gestao_conta_lancamento_natureza_check;
ALTER TABLE public.gestao_conta_lancamento
  ADD CONSTRAINT gestao_conta_lancamento_natureza_check CHECK (
    natureza IN (
      'operacional', 'custo_veiculo', 'repasse_terceiro',
      'troco_cliente', 'saldo_cliente'
    )
  );

-- A natureza acompanha séries recorrentes criadas pelo usuário.
ALTER TABLE public.gestao_conta_recorrencia_serie
  ADD COLUMN IF NOT EXISTS natureza text NOT NULL DEFAULT 'operacional';
ALTER TABLE public.gestao_conta_recorrencia_serie
  DROP CONSTRAINT IF EXISTS gestao_conta_recorrencia_serie_natureza_check;
ALTER TABLE public.gestao_conta_recorrencia_serie
  ADD CONSTRAINT gestao_conta_recorrencia_serie_natureza_check CHECK (
    natureza IN (
      'operacional', 'custo_veiculo', 'repasse_terceiro',
      'troco_cliente', 'saldo_cliente'
    )
  );

UPDATE public.gestao_conta_lancamento
   SET natureza = CASE
     WHEN observacao LIKE 'Repasse consignante%' THEN 'repasse_terceiro'
     WHEN observacao LIKE 'Composição venda%' AND tipo = 'pagar' THEN 'troco_cliente'
     WHEN observacao LIKE 'Composição venda%' AND tipo = 'receber' THEN 'saldo_cliente'
     WHEN origem = 'os_auto' THEN 'custo_veiculo'
     ELSE natureza
   END
 WHERE observacao LIKE 'Repasse consignante%'
    OR observacao LIKE 'Composição venda%'
    OR origem = 'os_auto';

CREATE OR REPLACE FUNCTION public.sync_consignacao_venda()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c public.veiculo_consignacao%ROWTYPE;
  parte_loja numeric(14, 2);
  parte_dono numeric(14, 2);
  despesas_dono numeric(14, 2);
  repasse numeric(14, 2);
  marker text;
  conta public.gestao_conta_lancamento%ROWTYPE;
  aviso text;
  abaixo_garantido boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.veiculo_consignacao
       SET status = 'ativo',
           repasse_aviso = NULL
     WHERE user_id = OLD.user_id
       AND veiculo_id = OLD.veiculo_id
       AND status = 'vendido';
    marker := 'Repasse consignante · veículo ' || OLD.veiculo_id::text;
    UPDATE public.gestao_conta_lancamento
       SET deleted_at = now()
     WHERE user_id = OLD.user_id
       AND veiculo_id = OLD.veiculo_id
       AND observacao LIKE marker || '%'
       AND deleted_at IS NULL
       AND pago_em IS NULL
       AND recebido_em IS NULL;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.valor_venda IS NOT DISTINCT FROM OLD.valor_venda
     AND NEW.data_venda IS NOT DISTINCT FROM OLD.data_venda THEN
    RETURN NEW;
  END IF;

  SELECT * INTO c
    FROM public.veiculo_consignacao
   WHERE user_id = NEW.user_id
     AND veiculo_id = NEW.veiculo_id
     AND status <> 'devolvido';
  IF NOT FOUND THEN RETURN NEW; END IF;

  parte_loja := round(greatest(
    (NEW.valor_venda - c.valor_garantido_dono) * c.pct_loja_excedente / 100,
    coalesce(c.piso_loja, 0)
  ), 2);
  parte_dono := round(NEW.valor_venda - parte_loja, 2);
  abaixo_garantido := parte_dono < c.valor_garantido_dono;
  IF abaixo_garantido THEN
    aviso := 'Venda abaixo do garantido — confirme com o dono e ajuste a conta a pagar se ele aceitou menos';
  END IF;

  SELECT coalesce(sum(valor), 0) INTO despesas_dono
    FROM public.veiculo_despesas
   WHERE user_id = NEW.user_id
     AND veiculo_id = NEW.veiculo_id
     AND descontar_do_consignante = true
     AND deleted_at IS NULL;

  repasse := round(greatest(parte_dono, c.valor_garantido_dono) - despesas_dono, 2);
  marker := 'Repasse consignante · veículo ' || NEW.veiculo_id::text;
  SELECT * INTO conta
    FROM public.gestao_conta_lancamento
   WHERE user_id = NEW.user_id
     AND veiculo_id = NEW.veiculo_id
     AND tipo = 'pagar'
     AND observacao LIKE marker || '%'
   ORDER BY created_at DESC
   LIMIT 1;

  IF NOT FOUND THEN
    INSERT INTO public.gestao_conta_lancamento (
      user_id, tipo, categoria_operacional, valor, vencimento,
      observacao, veiculo_id, origem, natureza
    ) VALUES (
      NEW.user_id, 'pagar', 'outros', repasse, NEW.data_venda + 2,
      marker || CASE WHEN aviso IS NULL THEN '' ELSE ' · ' || aviso END,
      NEW.veiculo_id, 'manual', 'repasse_terceiro'
    );
  ELSIF conta.deleted_at IS NOT NULL THEN
    aviso := concat_ws(
      ' · ', aviso,
      'repasse recalculado: R$ ' || to_char(repasse, 'FM999999990D00') ||
        ' — conta a pagar foi apagada manualmente, revise'
    );
  ELSIF conta.pago_em IS NOT NULL OR conta.recebido_em IS NOT NULL THEN
    aviso := concat_ws(
      ' · ', aviso,
      'repasse recalculado: R$ ' || to_char(repasse, 'FM999999990D00') ||
        ' — conta a pagar já foi paga/baixada, revise'
    );
  ELSIF c.repasse_calculado IS NOT NULL
        AND conta.valor IS DISTINCT FROM c.repasse_calculado THEN
    aviso := concat_ws(
      ' · ', aviso,
      'repasse recalculado: R$ ' || to_char(repasse, 'FM999999990D00') ||
        ' — conta a pagar foi editada manualmente, revise'
    );
  ELSE
    UPDATE public.gestao_conta_lancamento
       SET valor = repasse,
           vencimento = NEW.data_venda + 2,
           observacao = marker ||
             CASE WHEN aviso IS NULL THEN '' ELSE ' · ' || aviso END
     WHERE id = conta.id;
  END IF;

  UPDATE public.veiculo_consignacao
     SET status = 'vendido',
         repasse_calculado = repasse,
         repasse_aviso = aviso
   WHERE user_id = NEW.user_id
     AND veiculo_id = NEW.veiculo_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.registrar_venda_com_troca_impl_20261032250000(
  p_veiculo_id uuid,
  p_valor_venda numeric,
  p_data_venda date,
  p_vendedor text DEFAULT NULL,
  p_vendedor_id uuid DEFAULT NULL,
  p_forma_pagamento text DEFAULT NULL,
  p_marcar_vendido boolean DEFAULT true,
  p_pagamento jsonb DEFAULT '{}'::jsonb,
  p_troca_id uuid DEFAULT NULL,
  p_troca_rapida jsonb DEFAULT NULL,
  p_financeiro_vencimento date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  troca public.gestao_troca%ROWTYPE;
  venda_anterior public.veiculo_venda%ROWTYPE;
  conta public.gestao_conta_lancamento%ROWTYPE;
  entrada numeric(14, 2);
  financiamento numeric(14, 2);
  valor_troca numeric(14, 2);
  saldo numeric(14, 2);
  financeiro_valor numeric(14, 2);
  financeiro_tipo text;
  financeiro_categoria text;
  financeiro_anterior numeric(14, 2);
  financeiro_aviso text;
  marker text;
  novo_veiculo_id uuid;
  veiculo_entrada_criado boolean := false;
  pagamento_final jsonb;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF p_valor_venda IS NULL OR p_valor_venda < 0 OR p_data_venda IS NULL THEN
    RAISE EXCEPTION 'Valor e data da venda são obrigatórios';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.veiculos_estoque
     WHERE id = p_veiculo_id AND user_id = uid
  ) THEN RAISE EXCEPTION 'Veículo vendido não encontrado'; END IF;

  SELECT * INTO venda_anterior
    FROM public.veiculo_venda
   WHERE user_id = uid AND veiculo_id = p_veiculo_id
   FOR UPDATE;

  IF venda_anterior.troca_id IS NOT NULL
     AND p_troca_id IS DISTINCT FROM venda_anterior.troca_id THEN
    RAISE EXCEPTION 'A troca de uma venda já registrada não pode ser substituída';
  END IF;
  IF p_troca_id IS NULL AND p_troca_rapida IS NULL THEN
    RAISE EXCEPTION 'Selecione uma avaliação ou informe a troca rápida';
  END IF;

  IF p_troca_id IS NULL THEN
    IF nullif(trim(p_troca_rapida->>'marca'), '') IS NULL
       OR nullif(trim(p_troca_rapida->>'modelo'), '') IS NULL THEN
      RAISE EXCEPTION 'Marca e modelo da troca rápida são obrigatórios';
    END IF;
    INSERT INTO public.gestao_troca (
      user_id, placa, marca, modelo, versao, ano_fabricacao, ano_modelo,
      km, cor, status, destino, valor_proposto, valor_aprovado
    ) VALUES (
      uid,
      upper(nullif(trim(p_troca_rapida->>'placa'), '')),
      trim(p_troca_rapida->>'marca'),
      trim(p_troca_rapida->>'modelo'),
      nullif(trim(p_troca_rapida->>'versao'), ''),
      nullif(p_troca_rapida->>'ano_fabricacao', '')::integer,
      nullif(p_troca_rapida->>'ano_modelo', '')::integer,
      nullif(p_troca_rapida->>'km', '')::integer,
      nullif(trim(p_troca_rapida->>'cor'), ''),
      'em_avaliacao',
      coalesce(nullif(p_troca_rapida->>'destino', ''), 'estoque'),
      nullif(p_troca_rapida->>'valor', '')::numeric,
      nullif(p_troca_rapida->>'valor', '')::numeric
    )
    RETURNING * INTO troca;
    p_troca_id := troca.id;
  ELSE
    SELECT * INTO troca
      FROM public.gestao_troca
     WHERE id = p_troca_id AND user_id = uid
     FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Troca não encontrada'; END IF;
    IF troca.status NOT IN ('aprovada', 'em_avaliacao')
       AND venda_anterior.troca_id IS DISTINCT FROM troca.id THEN
      RAISE EXCEPTION 'A troca não está disponível para esta venda';
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.veiculo_venda
     WHERE troca_id = p_troca_id AND veiculo_id <> p_veiculo_id
  ) THEN RAISE EXCEPTION 'Esta troca já foi usada em outra venda'; END IF;

  entrada := round(greatest(coalesce((p_pagamento->>'entrada')::numeric, 0), 0), 2);
  financiamento := round(greatest(coalesce((p_pagamento#>>'{financiamento,valor}')::numeric, 0), 0), 2);
  valor_troca := round(greatest(coalesce((p_pagamento#>>'{troca,valor}')::numeric, 0), 0), 2);
  IF valor_troca <= 0 THEN RAISE EXCEPTION 'Informe o valor do carro recebido na troca'; END IF;
  saldo := round(p_valor_venda - entrada - financiamento - valor_troca, 2);
  financeiro_valor := abs(saldo);
  financeiro_tipo := CASE WHEN saldo > 0 THEN 'receber' WHEN saldo < 0 THEN 'pagar' ELSE 'quitado' END;
  financeiro_categoria := CASE WHEN saldo > 0 THEN 'venda_prazo' ELSE 'outros' END;

  IF troca.veiculo_id IS NULL THEN
    INSERT INTO public.veiculos_estoque (
      user_id, marca, modelo, versao, ano_fabricacao, ano_modelo,
      km, cor, placa, preco, fotos, status, origem
    ) VALUES (
      uid, troca.marca, troca.modelo, troca.versao, troca.ano_fabricacao,
      troca.ano_modelo, troca.km, troca.cor, upper(troca.placa), NULL,
      '{}'::text[], 'disponivel', 'troca'
    )
    RETURNING id INTO novo_veiculo_id;
    veiculo_entrada_criado := true;

    INSERT INTO public.veiculo_compra (
      user_id, veiculo_id, valor_compra, data_compra, origem, fornecedor_obs
    ) VALUES (
      uid, novo_veiculo_id, valor_troca, p_data_venda, 'troca',
      'Entrada automática pela venda do veículo ' || p_veiculo_id::text
    );
  ELSE
    novo_veiculo_id := troca.veiculo_id;
    IF venda_anterior.troca_id IS NULL THEN
      RAISE EXCEPTION 'A avaliação já foi enviada ao estoque por outro fluxo';
    END IF;
    UPDATE public.veiculo_compra
       SET valor_compra = valor_troca, data_compra = p_data_venda
     WHERE user_id = uid AND veiculo_id = novo_veiculo_id AND origem = 'troca';
  END IF;

  UPDATE public.gestao_troca
     SET status = 'fechada',
         valor_fechado = valor_troca,
         fechado_em = p_data_venda::timestamp,
         veiculo_id = novo_veiculo_id,
         destino = coalesce(destino, 'estoque')
   WHERE id = p_troca_id AND user_id = uid;

  marker := 'Composição venda · veículo ' || p_veiculo_id::text;
  financeiro_anterior := nullif(venda_anterior.pagamento_json->>'financeiro_calculado', '')::numeric;
  SELECT * INTO conta
    FROM public.gestao_conta_lancamento
   WHERE user_id = uid
     AND veiculo_id = p_veiculo_id
     AND observacao LIKE marker || '%'
   ORDER BY created_at DESC
   LIMIT 1
   FOR UPDATE;

  IF financeiro_tipo = 'quitado' THEN
    IF FOUND AND conta.deleted_at IS NULL
       AND conta.pago_em IS NULL AND conta.recebido_em IS NULL
       AND (financeiro_anterior IS NULL OR conta.valor = financeiro_anterior) THEN
      UPDATE public.gestao_conta_lancamento SET deleted_at = now() WHERE id = conta.id;
    ELSIF FOUND AND conta.deleted_at IS NULL THEN
      financeiro_aviso := 'Saldo quitado — lançamento pago ou editado manualmente foi preservado, revise';
    END IF;
  ELSIF NOT FOUND THEN
    INSERT INTO public.gestao_conta_lancamento (
      user_id, tipo, categoria_operacional, valor, vencimento,
      observacao, veiculo_id, origem, natureza
    ) VALUES (
      uid, financeiro_tipo, financeiro_categoria, financeiro_valor,
      coalesce(p_financeiro_vencimento, p_data_venda),
      marker || CASE WHEN financeiro_tipo = 'pagar' THEN ' · Troco ao cliente' ELSE ' · Saldo do cliente' END,
      p_veiculo_id, 'manual',
      CASE WHEN financeiro_tipo = 'pagar' THEN 'troco_cliente' ELSE 'saldo_cliente' END
    );
  ELSIF conta.deleted_at IS NOT NULL THEN
    financeiro_aviso := 'Saldo recalculado — lançamento apagado manualmente não foi recriado, revise';
  ELSIF conta.pago_em IS NOT NULL OR conta.recebido_em IS NOT NULL THEN
    financeiro_aviso := 'Saldo recalculado — lançamento já pago/baixado foi preservado, revise';
  ELSIF financeiro_anterior IS NOT NULL AND conta.valor IS DISTINCT FROM financeiro_anterior THEN
    financeiro_aviso := 'Saldo recalculado — lançamento editado manualmente foi preservado, revise';
  ELSE
    UPDATE public.gestao_conta_lancamento
       SET tipo = financeiro_tipo,
           categoria_operacional = financeiro_categoria,
           valor = financeiro_valor,
           vencimento = coalesce(p_financeiro_vencimento, p_data_venda),
           natureza = CASE
             WHEN financeiro_tipo = 'pagar' THEN 'troco_cliente'
             ELSE 'saldo_cliente'
           END,
           observacao = marker ||
             CASE WHEN financeiro_tipo = 'pagar' THEN ' · Troco ao cliente' ELSE ' · Saldo do cliente' END
     WHERE id = conta.id;
  END IF;

  pagamento_final := p_pagamento || jsonb_build_object(
    'entrada', entrada,
    'financiamento', coalesce(p_pagamento->'financiamento', '{}'::jsonb) || jsonb_build_object('valor', financiamento),
    'troca', coalesce(p_pagamento->'troca', '{}'::jsonb) || jsonb_build_object('troca_id', p_troca_id, 'valor', valor_troca),
    'saldo', saldo,
    'financeiro_tipo', financeiro_tipo,
    'financeiro_calculado', financeiro_valor,
    'financeiro_aviso', financeiro_aviso
  );

  INSERT INTO public.veiculo_venda (
    user_id, veiculo_id, valor_venda, data_venda, vendedor, vendedor_id,
    forma_pagamento, marcou_vendido, pagamento_json, troca_id
  ) VALUES (
    uid, p_veiculo_id, p_valor_venda, p_data_venda, p_vendedor, p_vendedor_id,
    p_forma_pagamento, p_marcar_vendido, pagamento_final, p_troca_id
  )
  ON CONFLICT (user_id, veiculo_id) DO UPDATE SET
    valor_venda = excluded.valor_venda,
    data_venda = excluded.data_venda,
    vendedor = excluded.vendedor,
    vendedor_id = excluded.vendedor_id,
    forma_pagamento = excluded.forma_pagamento,
    marcou_vendido = excluded.marcou_vendido,
    pagamento_json = excluded.pagamento_json,
    troca_id = excluded.troca_id;

  IF p_marcar_vendido THEN
    UPDATE public.veiculos_estoque
       SET status = 'vendido', vendido_at = now()
     WHERE id = p_veiculo_id AND user_id = uid;
  END IF;

  RETURN jsonb_build_object(
    'venda_veiculo_id', p_veiculo_id,
    'troca_id', p_troca_id,
    'veiculo_entrada_id', novo_veiculo_id,
    'veiculo_entrada_criado', veiculo_entrada_criado,
    'saldo', saldo,
    'financeiro_tipo', financeiro_tipo,
    'financeiro_valor', financeiro_valor,
    'financeiro_aviso', financeiro_aviso
  );
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_venda_com_troca_impl_20261032250000(
  uuid, numeric, date, text, uuid, text, boolean, jsonb, uuid, jsonb, date
) FROM PUBLIC, authenticated;
