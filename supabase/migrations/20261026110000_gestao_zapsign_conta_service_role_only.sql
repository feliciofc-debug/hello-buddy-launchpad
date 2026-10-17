-- Repo parity: gestao_zapsign_conta só service_role (produção já aplicado)

ALTER TABLE public.gestao_zapsign_conta ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gestao_zapsign_conta_own ON public.gestao_zapsign_conta;

REVOKE ALL ON public.gestao_zapsign_conta FROM authenticated;
REVOKE ALL ON public.gestao_zapsign_conta FROM anon;

GRANT ALL ON public.gestao_zapsign_conta TO service_role;
