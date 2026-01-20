-- Garantir RLS e políticas para que o afiliado consiga ver seus próprios dados no dashboard

-- 1) whatsapp_grupos_afiliado
ALTER TABLE public.whatsapp_grupos_afiliado ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "afiliado_select_own_whatsapp_grupos"
  ON public.whatsapp_grupos_afiliado
  FOR SELECT
  USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "afiliado_insert_own_whatsapp_grupos"
  ON public.whatsapp_grupos_afiliado
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "afiliado_update_own_whatsapp_grupos"
  ON public.whatsapp_grupos_afiliado
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "afiliado_delete_own_whatsapp_grupos"
  ON public.whatsapp_grupos_afiliado
  FOR DELETE
  USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) programacao_envio_afiliado
ALTER TABLE public.programacao_envio_afiliado ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "afiliado_select_own_programacao_envio"
  ON public.programacao_envio_afiliado
  FOR SELECT
  USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "afiliado_insert_own_programacao_envio"
  ON public.programacao_envio_afiliado
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "afiliado_update_own_programacao_envio"
  ON public.programacao_envio_afiliado
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "afiliado_delete_own_programacao_envio"
  ON public.programacao_envio_afiliado
  FOR DELETE
  USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3) historico_envio_programado (tem user_id)
ALTER TABLE public.historico_envio_programado ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "afiliado_select_own_historico_envio_programado"
  ON public.historico_envio_programado
  FOR SELECT
  USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4) historico_envios (não tem user_id). Liberar SELECT apenas se o JID pertence a um grupo do usuário.
ALTER TABLE public.historico_envios ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "afiliado_select_historico_envios_by_group_ownership"
  ON public.historico_envios
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.whatsapp_grupos_afiliado g
      WHERE g.group_jid = historico_envios.whatsapp
        AND g.user_id = auth.uid()
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
