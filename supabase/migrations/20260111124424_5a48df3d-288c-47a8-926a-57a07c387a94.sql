
-- Corrigir a função claim para retornar corretamente os registros
DROP FUNCTION IF EXISTS public.claim_prospeccao_pietro_batch(uuid, integer, integer);

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
BEGIN
  -- Selecionar, marcar como "processando" e retornar atomicamente
  RETURN QUERY
  WITH to_claim AS (
    SELECT id
    FROM fila_prospeccao_pietro
    WHERE user_id = p_user_id
      AND lote = p_lote
      AND status = 'pendente'
    ORDER BY created_at
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  ),
  updated AS (
    UPDATE fila_prospeccao_pietro f
    SET status = 'processando',
        updated_at = NOW()
    FROM to_claim
    WHERE f.id = to_claim.id
    RETURNING f.*
  )
  SELECT * FROM updated;
END;
$$;

COMMENT ON FUNCTION public.claim_prospeccao_pietro_batch IS 'Faz claim atômico de um lote de contatos para prospecção, evitando processamento paralelo duplicado';
