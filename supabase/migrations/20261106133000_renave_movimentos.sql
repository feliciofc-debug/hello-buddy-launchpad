-- RENAVE-3 — histórico operacional sem dados pessoais de terceiros.

CREATE TABLE public.renave_movimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ambiente text NOT NULL CHECK (ambiente IN ('hom', 'prod')),
  tipo text NOT NULL CHECK (
    tipo IN ('entrada', 'saida', 'detran_simulado', 'cancelamento')
  ),
  placa text NOT NULL CHECK (
    placa ~ '^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$'
  ),
  id_estoque bigint NULL CHECK (id_estoque IS NULL OR id_estoque > 0),
  estado_estoque text NULL,
  valor numeric(12, 2) NULL CHECK (valor IS NULL OR valor >= 0),
  data_operacao date NULL,
  solicitado_por text NOT NULL CHECK (solicitado_por ~ '^\*{3}[0-9]{4}$'),
  origem text NOT NULL CHECK (origem IN ('texto', 'audio')),
  mensagem_origem_id text NULL,
  status_http integer NOT NULL CHECK (status_http BETWEEN 0 AND 599),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX renave_movimentos_user_created_idx
  ON public.renave_movimentos(user_id, created_at DESC);
CREATE INDEX renave_movimentos_user_placa_idx
  ON public.renave_movimentos(user_id, placa, created_at DESC);
CREATE UNIQUE INDEX renave_movimentos_message_type_uidx
  ON public.renave_movimentos(user_id, tipo, mensagem_origem_id)
  WHERE mensagem_origem_id IS NOT NULL;

ALTER TABLE public.renave_movimentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY renave_movimentos_owner_select
  ON public.renave_movimentos
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

REVOKE ALL ON public.renave_movimentos FROM anon, authenticated;
GRANT SELECT ON public.renave_movimentos TO authenticated;
GRANT ALL ON public.renave_movimentos TO service_role;

COMMENT ON TABLE public.renave_movimentos IS
  'Histórico RENAVE sem CPF/CNPJ, código CRV ou outros dados pessoais de terceiros.';
