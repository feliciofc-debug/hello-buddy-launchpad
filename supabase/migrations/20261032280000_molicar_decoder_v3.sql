-- MOLICAR-1 — credenciais por loja, consultas/cache e snapshots de preço.

CREATE TABLE public.gestao_molicar_conta (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id text NOT NULL,
  client_secret_enc text NOT NULL,
  client_secret_ultimos4 text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  limite_mensal integer NOT NULL DEFAULT 50 CHECK (limite_mensal BETWEEN 1 AND 10000),
  atualizar_preco_dias integer NOT NULL DEFAULT 7 CHECK (atualizar_preco_dias BETWEEN 1 AND 365),
  access_token_enc text NULL,
  token_expires_at timestamptz NULL,
  last_test_ok_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.molicar_quota_mensal (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  competencia date NOT NULL,
  usado integer NOT NULL DEFAULT 0 CHECK (usado >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, competencia),
  CHECK (competencia = date_trunc('month', competencia)::date)
);

CREATE TABLE public.molicar_consulta (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  placa text NULL,
  vin text NULL,
  molicar_id text NULL,
  veiculo_id uuid NULL,
  troca_id uuid NULL,
  origem text NOT NULL CHECK (origem IN (
    'entrada', 'estoque', 'troca', 'refresh', 'manual'
  )),
  http_status integer NOT NULL,
  dados jsonb NOT NULL DEFAULT '{}'::jsonb,
  precos jsonb NOT NULL DEFAULT '{}'::jsonb,
  procedencia jsonb NULL,
  renavam text NULL,
  fipe_codigo text NULL,
  consultado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT molicar_consulta_identifier_check CHECK (
    placa IS NOT NULL OR vin IS NOT NULL
  ),
  CONSTRAINT molicar_consulta_veiculo_fk
    FOREIGN KEY (user_id, veiculo_id)
    REFERENCES public.veiculos_estoque(user_id, id),
  CONSTRAINT molicar_consulta_troca_fk
    FOREIGN KEY (user_id, troca_id)
    REFERENCES public.gestao_troca(user_id, id),
  CONSTRAINT molicar_consulta_sem_pii CHECK (
    dados::text !~* '"(financedname|financeddocumentnumber|proprietarydocumenttype|ownername|ownerdocument|proprietario|cpf|cnpj|nomeproprietario|documento)"[[:space:]]*:'
    AND coalesce(procedencia, '{}'::jsonb)::text !~* '"(financedname|financeddocumentnumber|proprietarydocumenttype|ownername|ownerdocument|proprietario|cpf|cnpj|nomeproprietario|documento)"[[:space:]]*:'
  )
);

CREATE INDEX molicar_consulta_placa_idx
  ON public.molicar_consulta(user_id, placa, consultado_em DESC)
  WHERE placa IS NOT NULL;
CREATE INDEX molicar_consulta_vin_idx
  ON public.molicar_consulta(user_id, vin, consultado_em DESC)
  WHERE vin IS NOT NULL;
CREATE INDEX molicar_consulta_veiculo_idx
  ON public.molicar_consulta(user_id, veiculo_id, consultado_em DESC)
  WHERE veiculo_id IS NOT NULL;
CREATE INDEX molicar_consulta_troca_idx
  ON public.molicar_consulta(user_id, troca_id, consultado_em DESC)
  WHERE troca_id IS NOT NULL;
CREATE UNIQUE INDEX molicar_consulta_identity_snapshot_uidx
  ON public.molicar_consulta (
    user_id,
    coalesce(placa, ''),
    coalesce(vin, ''),
    consultado_em
  );

ALTER TABLE public.gestao_molicar_conta ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.molicar_quota_mensal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.molicar_consulta ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.gestao_molicar_conta FROM anon, authenticated;
GRANT ALL ON public.gestao_molicar_conta TO service_role;

REVOKE ALL ON public.molicar_quota_mensal FROM anon, authenticated;
GRANT ALL ON public.molicar_quota_mensal TO service_role;

REVOKE ALL ON public.molicar_consulta FROM anon, authenticated;
GRANT SELECT ON public.molicar_consulta TO authenticated;
GRANT ALL ON public.molicar_consulta TO service_role;

CREATE POLICY molicar_consulta_owner_select
  ON public.molicar_consulta
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

COMMENT ON TABLE public.gestao_molicar_conta IS
  'Credenciais Molicar cifradas; acesso exclusivo via functions/service_role.';
COMMENT ON COLUMN public.molicar_consulta.renavam IS
  'Dado interno. Nunca expor em vitrine, anúncio ou integração pública.';

CREATE OR REPLACE FUNCTION public.molicar_consumir_quota(p_user_id uuid)
RETURNS TABLE (permitido boolean, usado integer, limite integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_competencia date := date_trunc('month', now() AT TIME ZONE 'UTC')::date;
  v_limite integer;
  v_usado integer;
BEGIN
  SELECT limite_mensal INTO v_limite
  FROM public.gestao_molicar_conta
  WHERE user_id = p_user_id AND status = 'active'
  FOR UPDATE;

  IF v_limite IS NULL THEN
    RETURN QUERY SELECT false, 0, 0;
    RETURN;
  END IF;

  INSERT INTO public.molicar_quota_mensal (user_id, competencia, usado)
  VALUES (p_user_id, v_competencia, 0)
  ON CONFLICT (user_id, competencia) DO NOTHING;

  SELECT q.usado INTO v_usado
  FROM public.molicar_quota_mensal q
  WHERE q.user_id = p_user_id AND q.competencia = v_competencia
  FOR UPDATE;

  IF v_usado >= v_limite THEN
    RETURN QUERY SELECT false, v_usado, v_limite;
    RETURN;
  END IF;

  UPDATE public.molicar_quota_mensal q
  SET usado = q.usado + 1, updated_at = now()
  WHERE q.user_id = p_user_id AND q.competencia = v_competencia
  RETURNING q.usado INTO v_usado;

  RETURN QUERY SELECT true, v_usado, v_limite;
END;
$$;

REVOKE ALL ON FUNCTION public.molicar_consumir_quota(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.molicar_consumir_quota(uuid) TO service_role;

CREATE TRIGGER update_gestao_molicar_conta_updated_at
  BEFORE UPDATE ON public.gestao_molicar_conta
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
