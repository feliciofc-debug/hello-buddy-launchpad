DROP POLICY IF EXISTS "System can manage conversations" ON public.whatsapp_conversations;
CREATE POLICY "Service manages conversations" ON public.whatsapp_conversations FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "System can manage messages" ON public.whatsapp_conversation_messages;
CREATE POLICY "Service manages messages" ON public.whatsapp_conversation_messages FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "System can manage historico_envios" ON public.historico_envios;
CREATE POLICY "Service manages historico_envios" ON public.historico_envios FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Owner reads own historico_envios" ON public.historico_envios FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "System can manage campanhas_ativas" ON public.campanhas_ativas;
CREATE POLICY "Service manages campanhas_ativas" ON public.campanhas_ativas FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "System can manage sessoes" ON public.sessoes_ativas;
CREATE POLICY "Service manages sessoes" ON public.sessoes_ativas FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "pj_conversas_service" ON public.pj_conversas;
CREATE POLICY "Service manages pj_conversas" ON public.pj_conversas FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Owner reads own pj_conversas" ON public.pj_conversas FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "pj_user_states_service" ON public.pj_user_states;
CREATE POLICY "Service manages pj_user_states" ON public.pj_user_states FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Owner reads own pj_user_states" ON public.pj_user_states FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Sistema gerencia user_states" ON public.afiliado_user_states;
CREATE POLICY "Service manages afiliado_user_states" ON public.afiliado_user_states FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Sistema gerencia cashback" ON public.afiliado_cashback;
CREATE POLICY "Service manages afiliado_cashback" ON public.afiliado_cashback FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Sistema gerencia clientes_ebooks" ON public.afiliado_clientes_ebooks;
CREATE POLICY "Service manages afiliado_clientes_ebooks" ON public.afiliado_clientes_ebooks FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Sistema gerencia deliveries" ON public.afiliado_ebook_deliveries;
CREATE POLICY "Service manages afiliado_ebook_deliveries" ON public.afiliado_ebook_deliveries FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access conversas" ON public.afiliado_conversas;
CREATE POLICY "Service manages afiliado_conversas" ON public.afiliado_conversas FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Sistema gerencia analytics" ON public.afiliado_analytics_ebooks;
CREATE POLICY "Service manages afiliado_analytics" ON public.afiliado_analytics_ebooks FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Sistema gerencia ofertas_enviadas" ON public.afiliado_ofertas_enviadas;
CREATE POLICY "Service manages afiliado_ofertas_enviadas" ON public.afiliado_ofertas_enviadas FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Sistema gerencia preferencias" ON public.afiliado_cliente_preferencias;
CREATE POLICY "Service manages afiliado_preferencias" ON public.afiliado_cliente_preferencias FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Sistema gerencia blacklist" ON public.afiliado_blacklist_ebooks;
CREATE POLICY "Service manages afiliado_blacklist" ON public.afiliado_blacklist_ebooks FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role only" ON public.afiliado_webhook_dedup;
CREATE POLICY "Service manages afiliado_webhook_dedup" ON public.afiliado_webhook_dedup FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can read roles" ON public.user_roles;
CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);