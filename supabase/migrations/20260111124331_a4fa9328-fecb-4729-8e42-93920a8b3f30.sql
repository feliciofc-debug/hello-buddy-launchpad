
-- Criar função para claim de batch de prospecção (evita envios duplicados paralelos)
CREATE OR REPLACE FUNCTION public.claim_prospeccao_pietro_batch(
  p_user_id uuid,
  p_lote integer,
  p_limit integer DEFAULT 20
)
RETURNS SETOF fila_prospeccao_pietro
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claimed_ids uuid[];
BEGIN
  -- Selecionar e marcar como "processando" atomicamente
  WITH to_claim AS (
    SELECT id
    FROM fila_prospeccao_pietro
    WHERE user_id = p_user_id
      AND lote = p_lote
      AND status = 'pendente'
    ORDER BY created_at
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE fila_prospeccao_pietro
  SET status = 'processando',
      updated_at = NOW()
  WHERE id IN (SELECT id FROM to_claim)
  RETURNING id INTO claimed_ids;
  
  -- Retornar os registros que foram claimed
  RETURN QUERY
  SELECT *
  FROM fila_prospeccao_pietro
  WHERE id = ANY(claimed_ids);
END;
$$;

-- Garantir que a função existe e funciona corretamente
COMMENT ON FUNCTION public.claim_prospeccao_pietro_batch IS 'Faz claim atômico de um lote de contatos para prospecção, evitando processamento paralelo duplicado';
