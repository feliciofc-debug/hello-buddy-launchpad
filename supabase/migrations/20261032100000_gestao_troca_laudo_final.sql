-- Laudo finalizado: número sequencial, versões e trava de edição

ALTER TABLE public.gestao_troca
  ADD COLUMN IF NOT EXISTS laudo_status text NOT NULL DEFAULT 'rascunho'
    CHECK (laudo_status IN ('rascunho', 'finalizado')),
  ADD COLUMN IF NOT EXISTS laudo_numero text NULL,
  ADD COLUMN IF NOT EXISTS laudo_versao integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS laudo_finalizado_por uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS laudo_finalizado_em timestamptz NULL,
  ADD COLUMN IF NOT EXISTS laudo_reaberto_motivo text NULL;

CREATE TABLE IF NOT EXISTS public.gestao_troca_laudo_numero (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ano integer NOT NULL,
  ultimo integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, ano)
);

CREATE TABLE IF NOT EXISTS public.gestao_troca_laudo_versao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  troca_id uuid NOT NULL REFERENCES public.gestao_troca(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  numero text NOT NULL,
  versao integer NOT NULL,
  snapshot_json jsonb NOT NULL,
  finalizado_por uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  finalizado_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (troca_id, versao)
);

CREATE INDEX IF NOT EXISTS gestao_troca_laudo_versao_troca_idx
  ON public.gestao_troca_laudo_versao (troca_id, versao DESC);

ALTER TABLE public.gestao_troca_laudo_numero ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gestao_troca_laudo_versao ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.gestao_troca_laudo_numero FROM anon;
REVOKE ALL ON public.gestao_troca_laudo_versao FROM anon;

GRANT SELECT ON public.gestao_troca_laudo_versao TO authenticated;
GRANT ALL ON public.gestao_troca_laudo_numero TO service_role;
GRANT ALL ON public.gestao_troca_laudo_versao TO service_role;

DROP POLICY IF EXISTS gestao_troca_laudo_versao_select ON public.gestao_troca_laudo_versao;
CREATE POLICY gestao_troca_laudo_versao_select ON public.gestao_troca_laudo_versao
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );
