-- Função para incrementar indicações do afiliado
CREATE OR REPLACE FUNCTION public.increment_afiliado_indicacoes(afiliado_uuid UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.afiliados
  SET 
    total_indicacoes = total_indicacoes + 1,
    updated_at = NOW()
  WHERE id = afiliado_uuid;
END;
$$;