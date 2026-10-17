-- Parity: NF-e listagem só leitura no cliente (emissão via edge functions / service_role)

REVOKE INSERT, UPDATE, DELETE ON public.gestao_nfe FROM authenticated;
GRANT SELECT ON public.gestao_nfe TO authenticated;

DROP POLICY IF EXISTS gestao_nfe_own ON public.gestao_nfe;
CREATE POLICY gestao_nfe_select_own ON public.gestao_nfe
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
