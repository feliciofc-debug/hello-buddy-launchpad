-- WEBMOTORS-2: histórico de publicar / tirar do ar / voltar a anunciar.

CREATE TABLE IF NOT EXISTS public.webmotors_portal_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  veiculo_id uuid NOT NULL,
  acao text NOT NULL CHECK (
    acao IN ('publicar', 'sincronizar', 'tirar_do_ar', 'voltar_anunciar')
  ),
  external_id text NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS webmotors_portal_historico_user_veiculo_idx
  ON public.webmotors_portal_historico (user_id, veiculo_id, created_at DESC);

ALTER TABLE public.webmotors_portal_historico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS webmotors_portal_historico_select_own
  ON public.webmotors_portal_historico;
CREATE POLICY webmotors_portal_historico_select_own
  ON public.webmotors_portal_historico
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS webmotors_portal_historico_service_all
  ON public.webmotors_portal_historico;
CREATE POLICY webmotors_portal_historico_service_all
  ON public.webmotors_portal_historico
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
