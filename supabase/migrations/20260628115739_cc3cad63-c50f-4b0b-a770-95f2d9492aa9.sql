
-- Remove policy permissiva e duplicatas em integrations
DROP POLICY IF EXISTS "Sistema pode gerenciar integrações" ON public.integrations;
DROP POLICY IF EXISTS "Users can delete own integrations" ON public.integrations;
DROP POLICY IF EXISTS "Users can insert own integrations" ON public.integrations;
DROP POLICY IF EXISTS "Users can update own integrations" ON public.integrations;
DROP POLICY IF EXISTS "Users can view own integrations" ON public.integrations;
DROP POLICY IF EXISTS "Usuários podem atualizar suas próprias integrações" ON public.integrations;
DROP POLICY IF EXISTS "Usuários podem criar suas próprias integrações" ON public.integrations;
DROP POLICY IF EXISTS "Usuários podem ver suas próprias integrações" ON public.integrations;

-- Garante RLS ativa
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;

-- Policies estritas por dono (authenticated)
CREATE POLICY "integrations_owner_select"
  ON public.integrations FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "integrations_owner_insert"
  ON public.integrations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "integrations_owner_update"
  ON public.integrations FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "integrations_owner_delete"
  ON public.integrations FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Service role: acesso total para edge functions
CREATE POLICY "integrations_service_role_all"
  ON public.integrations FOR ALL TO service_role
  USING (true) WITH CHECK (true);
