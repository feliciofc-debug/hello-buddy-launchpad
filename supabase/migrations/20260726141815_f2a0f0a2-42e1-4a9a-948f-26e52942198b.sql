
-- 1) pj_lista_membros: campos de opt-in
ALTER TABLE public.pj_lista_membros
  ADD COLUMN IF NOT EXISTS opt_in_status text NOT NULL DEFAULT 'pendente'
    CHECK (opt_in_status IN ('pendente','convite_enviado','confirmado','recusado','expirado')),
  ADD COLUMN IF NOT EXISTS opt_in_origem text,
  ADD COLUMN IF NOT EXISTS opt_in_em timestamptz,
  ADD COLUMN IF NOT EXISTS convite_enviado_em timestamptz,
  ADD COLUMN IF NOT EXISTS convite_template_id uuid;

CREATE INDEX IF NOT EXISTS idx_pj_lista_membros_opt_in_status
  ON public.pj_lista_membros (opt_in_status);

-- 2) whatsapp_config: waba_id (nullable — user preenche na Fase 2)
ALTER TABLE public.whatsapp_config
  ADD COLUMN IF NOT EXISTS waba_id text;

-- 3) whatsapp_templates
CREATE TABLE IF NOT EXISTS public.whatsapp_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  waba_id text,
  nome_meta text NOT NULL,
  tipo_uso text NOT NULL
    CHECK (tipo_uso IN ('convite_optin','campanha','transacional')),
  categoria_meta text NOT NULL
    CHECK (categoria_meta IN ('UTILITY','MARKETING','AUTHENTICATION')),
  idioma text NOT NULL DEFAULT 'pt_BR',
  body_text text NOT NULL,
  header jsonb,
  botoes jsonb,
  variaveis_map jsonb NOT NULL DEFAULT '{}'::jsonb,
  status_meta text NOT NULL DEFAULT 'rascunho'
    CHECK (status_meta IN ('rascunho','pendente','aprovado','rejeitado','pausado')),
  motivo_rejeicao_meta text,
  meta_template_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, nome_meta, idioma)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_templates TO authenticated;
GRANT ALL ON public.whatsapp_templates TO service_role;

ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wt_owner_all"
  ON public.whatsapp_templates
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_wt_updated_at
  BEFORE UPDATE ON public.whatsapp_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_wt_user_tipo_status
  ON public.whatsapp_templates (user_id, tipo_uso, status_meta);

-- FK do convite_template_id em pj_lista_membros (depois de criar a tabela)
ALTER TABLE public.pj_lista_membros
  ADD CONSTRAINT pj_lista_membros_convite_template_fk
  FOREIGN KEY (convite_template_id)
  REFERENCES public.whatsapp_templates(id)
  ON DELETE SET NULL;

-- 4) opt_in_log (auditoria)
CREATE TABLE IF NOT EXISTS public.opt_in_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  telefone text NOT NULL,
  status_anterior text,
  status_novo text NOT NULL,
  origem text NOT NULL,
  texto_inbound text,
  message_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.opt_in_log TO authenticated;
GRANT ALL ON public.opt_in_log TO service_role;

ALTER TABLE public.opt_in_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "opt_in_log_owner_read"
  ON public.opt_in_log
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_opt_in_log_user_telefone
  ON public.opt_in_log (user_id, telefone, created_at DESC);
