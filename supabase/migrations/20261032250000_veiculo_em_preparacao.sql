-- TROCA-VENDA-1.1: veículos sem anúncio completo ficam em preparação

ALTER TABLE public.veiculos_estoque
  DROP CONSTRAINT IF EXISTS veiculos_estoque_status_check;

ALTER TABLE public.veiculos_estoque
  ADD CONSTRAINT veiculos_estoque_status_check
  CHECK (status IN ('disponivel', 'reservado', 'vendido', 'em_preparacao'));

ALTER FUNCTION public.registrar_venda_com_troca(
  uuid, numeric, date, text, uuid, text, boolean, jsonb, uuid, jsonb, date
) RENAME TO registrar_venda_com_troca_impl_20261032250000;

REVOKE ALL ON FUNCTION public.registrar_venda_com_troca_impl_20261032250000(
  uuid, numeric, date, text, uuid, text, boolean, jsonb, uuid, jsonb, date
) FROM PUBLIC, authenticated;

CREATE OR REPLACE FUNCTION public.registrar_venda_com_troca(
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
  resultado jsonb;
  veiculo_entrada_id uuid;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  IF p_vendedor_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
      FROM public.gestao_vendedores
     WHERE id = p_vendedor_id
       AND user_id = uid
  ) THEN
    RAISE EXCEPTION 'Vendedor não pertence a esta loja';
  END IF;

  SELECT public.registrar_venda_com_troca_impl_20261032250000(
    p_veiculo_id,
    p_valor_venda,
    p_data_venda,
    p_vendedor,
    p_vendedor_id,
    p_forma_pagamento,
    p_marcar_vendido,
    p_pagamento,
    p_troca_id,
    p_troca_rapida,
    p_financeiro_vencimento
  ) INTO resultado;

  veiculo_entrada_id := nullif(resultado->>'veiculo_entrada_id', '')::uuid;
  IF veiculo_entrada_id IS NULL THEN
    RAISE EXCEPTION 'A venda com troca não retornou o veículo recebido';
  END IF;

  UPDATE public.veiculos_estoque
     SET status = 'em_preparacao',
         vendido_at = NULL
   WHERE id = veiculo_entrada_id
     AND user_id = uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Veículo recebido na troca não encontrado';
  END IF;

  RETURN resultado;
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_venda_com_troca(
  uuid, numeric, date, text, uuid, text, boolean, jsonb, uuid, jsonb, date
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registrar_venda_com_troca(
  uuid, numeric, date, text, uuid, text, boolean, jsonb, uuid, jsonb, date
) TO authenticated;

COMMENT ON FUNCTION public.registrar_venda_com_troca(
  uuid, numeric, date, text, uuid, text, boolean, jsonb, uuid, jsonb, date
) IS
  'Registra venda/troca atomicamente; valida vendedor do tenant e mantém o veículo recebido em preparação.';
