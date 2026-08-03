BEGIN;

-- 1) Revoga TODO acesso anônimo nas 10 tabelas
REVOKE ALL ON public.socios FROM anon;
REVOKE ALL ON public.trial_configs FROM anon;
REVOKE ALL ON public.clientes_afiliados FROM anon;
REVOKE ALL ON public.wuzapi_tokens_afiliados FROM anon;
REVOKE ALL ON public.whatsapp_notifications FROM anon;
REVOKE ALL ON public.leads_ebooks FROM anon;
REVOKE ALL ON public.opt_ins FROM anon;
REVOKE ALL ON public.comissoes FROM anon;
REVOKE ALL ON public.mensagens_enviadas FROM anon;
REVOKE ALL ON public.security_reports FROM anon;

-- 2) Garante acesso dos papéis legítimos
GRANT SELECT, INSERT, UPDATE, DELETE ON public.socios TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trial_configs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clientes_afiliados TO authenticated;
GRANT SELECT ON public.wuzapi_tokens_afiliados TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads_ebooks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.opt_ins TO authenticated;
GRANT SELECT ON public.comissoes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mensagens_enviadas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.security_reports TO authenticated;

GRANT ALL ON public.socios TO service_role;
GRANT ALL ON public.trial_configs TO service_role;
GRANT ALL ON public.clientes_afiliados TO service_role;
GRANT ALL ON public.wuzapi_tokens_afiliados TO service_role;
GRANT ALL ON public.whatsapp_notifications TO service_role;
GRANT ALL ON public.leads_ebooks TO service_role;
GRANT ALL ON public.opt_ins TO service_role;
GRANT ALL ON public.comissoes TO service_role;
GRANT ALL ON public.mensagens_enviadas TO service_role;
GRANT ALL ON public.security_reports TO service_role;

-- 3) Exceção única: formulário público de relato de vulnerabilidade (só escreve, não lê)
GRANT INSERT ON public.security_reports TO anon;
DROP POLICY IF EXISTS "Anyone can submit security reports" ON public.security_reports;
CREATE POLICY "Qualquer um pode enviar relato de seguranca"
  ON public.security_reports FOR INSERT TO anon, authenticated WITH CHECK (true);

-- 4) Reescreve policies do papel 'public' para 'authenticated' (escopadas por dono)
DROP POLICY IF EXISTS "Clientes podem ver seus próprios dados" ON public.clientes_afiliados;
DROP POLICY IF EXISTS "Clientes podem atualizar seus dados" ON public.clientes_afiliados;
DROP POLICY IF EXISTS "Clientes podem criar seu perfil" ON public.clientes_afiliados;
CREATE POLICY "clientes_afiliados_select_own" ON public.clientes_afiliados FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "clientes_afiliados_update_own" ON public.clientes_afiliados FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "clientes_afiliados_insert_own" ON public.clientes_afiliados FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Afiliados podem ver suas comissões" ON public.comissoes;
CREATE POLICY "comissoes_select_own" ON public.comissoes FOR SELECT TO authenticated
  USING (afiliado_id IN (SELECT a.id FROM public.afiliados a WHERE a.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can view own messages" ON public.mensagens_enviadas;
DROP POLICY IF EXISTS "Users can insert own messages" ON public.mensagens_enviadas;
DROP POLICY IF EXISTS "Users can update own messages" ON public.mensagens_enviadas;
CREATE POLICY "mensagens_enviadas_select_own" ON public.mensagens_enviadas FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "mensagens_enviadas_insert_own" ON public.mensagens_enviadas FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "mensagens_enviadas_update_own" ON public.mensagens_enviadas FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Inserir leads sem autenticação" ON public.leads_ebooks;
CREATE POLICY "leads_ebooks_insert_own" ON public.leads_ebooks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone can insert opt_ins" ON public.opt_ins;
CREATE POLICY "opt_ins_insert_authenticated" ON public.opt_ins FOR INSERT TO authenticated WITH CHECK (true);

COMMIT;