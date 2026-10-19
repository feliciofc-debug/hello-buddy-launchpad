-- Procedência veicular (Consultar Placa) — credenciais por loja + histórico de consultas

CREATE TABLE IF NOT EXISTS public.veiculo_procedencia_config (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  provedor text NOT NULL DEFAULT 'consultar_placa'
    CHECK (provedor IN ('consultar_placa')),
  email text NOT NULL,
  api_key_enc text NOT NULL,
  api_key_ultimos4 text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  limite_mensal integer NOT NULL DEFAULT 30 CHECK (limite_mensal >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.veiculo_procedencia_consulta (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  placa text NOT NULL,
  veiculo_id uuid NULL REFERENCES public.veiculos_estoque(id) ON DELETE SET NULL,
  solicitado_por text NOT NULL,
  canal text NOT NULL CHECK (canal IN ('painel', 'whatsapp')),
  status text NOT NULL DEFAULT 'processando'
    CHECK (status IN ('processando', 'concluida', 'erro')),
  resumo_json jsonb NULL,
  custo_estimado numeric(12, 2) NULL,
  erro_tipo text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  concluida_em timestamptz NULL
);

CREATE INDEX IF NOT EXISTS veiculo_procedencia_consulta_user_created_idx
  ON public.veiculo_procedencia_consulta (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS veiculo_procedencia_consulta_veiculo_idx
  ON public.veiculo_procedencia_consulta (user_id, veiculo_id, created_at DESC)
  WHERE veiculo_id IS NOT NULL;

ALTER TABLE public.veiculo_procedencia_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.veiculo_procedencia_consulta ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.veiculo_procedencia_config FROM anon;
REVOKE ALL ON public.veiculo_procedencia_consulta FROM anon;

GRANT ALL ON public.veiculo_procedencia_config TO service_role;
GRANT ALL ON public.veiculo_procedencia_consulta TO service_role;

-- Config: somente service_role (chave cifrada nunca no client)
REVOKE ALL ON public.veiculo_procedencia_config FROM authenticated;

-- Consultas: dono ou admin lê/grava resumo (sem credenciais)
DROP POLICY IF EXISTS veiculo_procedencia_consulta_select ON public.veiculo_procedencia_consulta;
CREATE POLICY veiculo_procedencia_consulta_select ON public.veiculo_procedencia_consulta
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS veiculo_procedencia_consulta_insert ON public.veiculo_procedencia_consulta;
CREATE POLICY veiculo_procedencia_consulta_insert ON public.veiculo_procedencia_consulta
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT ON public.veiculo_procedencia_consulta TO authenticated;
