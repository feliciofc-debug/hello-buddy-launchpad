DROP POLICY "Service role full access pj fila" ON public.fila_atendimento_pj;
CREATE POLICY "Service role full access pj fila" ON public.fila_atendimento_pj FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY "Sistema pode atualizar assinaturas" ON public.subscriptions;
CREATE POLICY "Sistema pode atualizar assinaturas" ON public.subscriptions FOR UPDATE TO service_role USING (true) WITH CHECK (true);

DROP POLICY "Sistema pode criar assinaturas" ON public.subscriptions;
CREATE POLICY "Sistema pode criar assinaturas" ON public.subscriptions FOR INSERT TO service_role WITH CHECK (true);