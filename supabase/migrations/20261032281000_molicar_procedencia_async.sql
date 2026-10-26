-- MOLICAR-2 — consultas assíncronas de débitos, gravame e Renajud.

ALTER TABLE public.gestao_molicar_conta
  ADD COLUMN procedencia_automatica_troca boolean NOT NULL DEFAULT false;

CREATE TABLE public.molicar_procedencia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  servicos text[] NOT NULL CHECK (
    cardinality(servicos) = 1
    AND servicos <@ ARRAY['debts', 'gravame', 'renajud']::text[]
  ),
  identidade_tipo text NOT NULL CHECK (identidade_tipo IN ('plate', 'vin')),
  identidade text NOT NULL,
  placa text NULL,
  vin text NULL,
  veiculo_id uuid NULL,
  troca_id uuid NULL,
  protocolo text NULL,
  status text NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'concluida', 'erro', 'expirada')),
  provider_status text NULL,
  resultado jsonb NULL,
  erro text NULL,
  quota_competencia date NOT NULL,
  quota_consumida boolean NOT NULL DEFAULT true,
  quota_devolvida boolean NOT NULL DEFAULT false,
  poll_attempts integer NOT NULL DEFAULT 0 CHECK (poll_attempts >= 0),
  next_poll_at timestamptz NOT NULL DEFAULT now() + interval '30 seconds',
  poll_locked_until timestamptz NULL,
  solicitado_em timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  concluido_em timestamptz NULL,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '24 hours',
  CONSTRAINT molicar_procedencia_identity_check CHECK (
    (identidade_tipo = 'plate' AND placa = identidade AND vin IS NULL)
    OR (identidade_tipo = 'vin' AND vin = identidade AND placa IS NULL)
  ),
  CONSTRAINT molicar_procedencia_renajud_plate_check CHECK (
    NOT ('renajud' = ANY(servicos)) OR identidade_tipo = 'plate'
  ),
  CONSTRAINT molicar_procedencia_veiculo_fk
    FOREIGN KEY (user_id, veiculo_id)
    REFERENCES public.veiculos_estoque(user_id, id),
  CONSTRAINT molicar_procedencia_troca_fk
    FOREIGN KEY (user_id, troca_id)
    REFERENCES public.gestao_troca(user_id, id),
  CONSTRAINT molicar_procedencia_sem_pii CHECK (
    coalesce(resultado, '{}'::jsonb)::text !~*
      '"(financedname|financeddocumentnumber|financedcpf|financedcnpj|proprietaryname|proprietarydocumenttype|proprietarydocumentnumber|ownername|ownerdocument|ownerdocumentnumber|ownercpf|ownercnpj|proprietario|nomeproprietario|cpf|cnpj|documento)"[[:space:]]*:'
  )
);

CREATE UNIQUE INDEX molicar_procedencia_protocolo_uidx
  ON public.molicar_procedencia(protocolo)
  WHERE protocolo IS NOT NULL;
CREATE INDEX molicar_procedencia_owner_created_idx
  ON public.molicar_procedencia(user_id, solicitado_em DESC);
CREATE INDEX molicar_procedencia_poll_idx
  ON public.molicar_procedencia(next_poll_at)
  WHERE status = 'pendente' AND protocolo IS NOT NULL
    AND identidade_tipo = 'plate';

ALTER TABLE public.molicar_procedencia ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.molicar_procedencia FROM anon, authenticated;
GRANT SELECT ON public.molicar_procedencia TO authenticated;
GRANT ALL ON public.molicar_procedencia TO service_role;

CREATE POLICY molicar_procedencia_owner_select
  ON public.molicar_procedencia
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

COMMENT ON TABLE public.molicar_procedencia IS
  'Um protocolo assíncrono Molicar por serviço selecionado; escrita exclusiva do service_role.';
COMMENT ON COLUMN public.molicar_procedencia.resultado IS
  'Resposta sanitizada: PII de proprietário/financiado nunca é persistida.';

CREATE OR REPLACE FUNCTION public.molicar_procedencia_reservar(
  p_user_id uuid,
  p_servicos text[],
  p_identidade_tipo text,
  p_identidade text,
  p_veiculo_id uuid DEFAULT NULL,
  p_troca_id uuid DEFAULT NULL
)
RETURNS SETOF public.molicar_procedencia
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_competencia date := date_trunc('month', now() AT TIME ZONE 'UTC')::date;
  v_usado integer;
  v_limite integer;
  v_permitido boolean;
  v_quantidade integer;
BEGIN
  IF p_identidade_tipo NOT IN ('plate', 'vin') OR nullif(p_identidade, '') IS NULL THEN
    RAISE EXCEPTION 'Identidade inválida';
  END IF;
  IF p_servicos IS NULL OR cardinality(p_servicos) = 0
     OR p_servicos <@ ARRAY['debts', 'gravame', 'renajud']::text[] IS NOT TRUE
     OR cardinality(p_servicos) <> (
       SELECT count(DISTINCT servico) FROM unnest(p_servicos) AS servico
     ) THEN
    RAISE EXCEPTION 'Serviços inválidos';
  END IF;
  IF p_identidade_tipo = 'vin' AND 'renajud' = ANY(p_servicos) THEN
    RAISE EXCEPTION 'Renajud só possui endpoint oficial por placa';
  END IF;

  v_quantidade := cardinality(p_servicos);
  FOR i IN 1..v_quantidade LOOP
    SELECT permitido, usado, limite
      INTO v_permitido, v_usado, v_limite
    FROM public.molicar_consumir_quota(p_user_id);
    IF NOT v_permitido THEN
      IF v_limite = 0 THEN
        RAISE EXCEPTION 'Conecte a Molicar antes de consultar';
      END IF;
      RAISE EXCEPTION 'Teto do mês atingido (%/%)', v_usado, v_limite;
    END IF;
  END LOOP;

  RETURN QUERY
  INSERT INTO public.molicar_procedencia (
    user_id, servicos, identidade_tipo, identidade, placa, vin,
    veiculo_id, troca_id, quota_competencia
  )
  SELECT
    p_user_id, ARRAY[s], p_identidade_tipo, p_identidade,
    CASE WHEN p_identidade_tipo = 'plate' THEN p_identidade END,
    CASE WHEN p_identidade_tipo = 'vin' THEN p_identidade END,
    p_veiculo_id, p_troca_id, v_competencia
  FROM unnest(p_servicos) AS s
  RETURNING *;
END;
$$;

REVOKE ALL ON FUNCTION public.molicar_procedencia_reservar(
  uuid, text[], text, text, uuid, uuid
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.molicar_procedencia_reservar(
  uuid, text[], text, text, uuid, uuid
) TO service_role;

CREATE OR REPLACE FUNCTION public.molicar_devolver_quota(
  p_user_id uuid,
  p_competencia date
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usado integer;
BEGIN
  UPDATE public.molicar_quota_mensal q
  SET usado = greatest(q.usado - 1, 0),
      updated_at = now()
  WHERE q.user_id = p_user_id
    AND q.competencia = p_competencia
  RETURNING q.usado INTO v_usado;

  RETURN coalesce(v_usado, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.molicar_devolver_quota(uuid, date)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.molicar_devolver_quota(uuid, date)
  TO service_role;

CREATE OR REPLACE FUNCTION public.molicar_procedencia_finalizar(
  p_id uuid,
  p_status text,
  p_provider_status text DEFAULT NULL,
  p_resultado jsonb DEFAULT NULL,
  p_erro text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.molicar_procedencia%ROWTYPE;
BEGIN
  IF p_status NOT IN ('concluida', 'erro', 'expirada') THEN
    RAISE EXCEPTION 'Status terminal inválido';
  END IF;
  SELECT * INTO v_row FROM public.molicar_procedencia
  WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR v_row.status <> 'pendente' THEN
    RETURN false;
  END IF;

  IF p_status IN ('erro', 'expirada')
     AND v_row.quota_consumida AND NOT v_row.quota_devolvida THEN
    PERFORM public.molicar_devolver_quota(
      v_row.user_id,
      v_row.quota_competencia
    );
  END IF;

  UPDATE public.molicar_procedencia
  SET status = p_status,
      provider_status = p_provider_status,
      resultado = p_resultado,
      erro = p_erro,
      quota_devolvida = quota_devolvida OR p_status IN ('erro', 'expirada'),
      concluido_em = now(),
      poll_locked_until = NULL,
      updated_at = now()
  WHERE id = p_id;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.molicar_procedencia_finalizar(
  uuid, text, text, jsonb, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.molicar_procedencia_finalizar(
  uuid, text, text, jsonb, text
) TO service_role;

CREATE OR REPLACE FUNCTION public.molicar_procedencia_claim_poll(p_limit integer DEFAULT 20)
RETURNS SETOF public.molicar_procedencia
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expired record;
BEGIN
  FOR v_expired IN
    SELECT id FROM public.molicar_procedencia
    WHERE status = 'pendente' AND expires_at <= now()
    FOR UPDATE SKIP LOCKED
  LOOP
    PERFORM public.molicar_procedencia_finalizar(
      v_expired.id, 'expirada', 'REQUEST_EXPIRED', NULL,
      'Resultado não recebido dentro das 24 horas documentadas.'
    );
  END LOOP;

  RETURN QUERY
  WITH candidates AS (
    SELECT id
    FROM public.molicar_procedencia
    WHERE status = 'pendente'
      AND identidade_tipo = 'plate'
      AND protocolo IS NOT NULL
      AND next_poll_at <= now()
      AND expires_at > now()
      AND (poll_locked_until IS NULL OR poll_locked_until < now())
    ORDER BY next_poll_at
    FOR UPDATE SKIP LOCKED
    LIMIT least(greatest(p_limit, 1), 100)
  )
  UPDATE public.molicar_procedencia p
  SET poll_attempts = p.poll_attempts + 1,
      poll_locked_until = now() + interval '25 seconds',
      next_poll_at = now() + make_interval(secs =>
        least(1800, 30 * power(2, least(p.poll_attempts, 6))::integer)
      ),
      updated_at = now()
  FROM candidates c
  WHERE p.id = c.id
  RETURNING p.*;
END;
$$;

REVOKE ALL ON FUNCTION public.molicar_procedencia_claim_poll(integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.molicar_procedencia_claim_poll(integer)
  TO service_role;
