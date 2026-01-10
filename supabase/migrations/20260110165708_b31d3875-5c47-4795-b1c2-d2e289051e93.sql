-- Claim/queue helper for Pietro prospecting to avoid parallel sends
-- Uses row locking to ensure each execution processes only a small batch.

CREATE OR REPLACE FUNCTION public.claim_prospeccao_pietro_batch(
  p_user_id uuid,
  p_lote int,
  p_limit int DEFAULT 20
)
RETURNS SETOF public.fila_prospeccao_pietro
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH cte AS (
    SELECT id
    FROM public.fila_prospeccao_pietro
    WHERE user_id = p_user_id
      AND status = 'pendente'
      AND lote = p_lote
    ORDER BY created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
  )
  UPDATE public.fila_prospeccao_pietro f
  SET status = 'processando',
      updated_at = now()
  WHERE f.id IN (SELECT id FROM cte)
  RETURNING f.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_prospeccao_pietro_batch(uuid,int,int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_prospeccao_pietro_batch(uuid,int,int) TO service_role;

-- Allow existing rows to keep working; no schema changes required.