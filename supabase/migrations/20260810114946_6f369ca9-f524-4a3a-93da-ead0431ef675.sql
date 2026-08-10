DROP POLICY IF EXISTS "Allow all access to support_tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Allow all access to support_messages" ON public.support_messages;

CREATE POLICY "Service manages support_tickets" ON public.support_tickets FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Admins manage support_tickets" ON public.support_tickets FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Client reads own support_tickets" ON public.support_tickets FOR SELECT TO authenticated
  USING (cliente_email = (auth.jwt() ->> 'email'));
CREATE POLICY "Client creates own support_tickets" ON public.support_tickets FOR INSERT TO authenticated
  WITH CHECK (cliente_email = (auth.jwt() ->> 'email'));

CREATE POLICY "Service manages support_messages" ON public.support_messages FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Admins manage support_messages" ON public.support_messages FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Client reads own support_messages" ON public.support_messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = support_messages.ticket_id AND t.cliente_email = (auth.jwt() ->> 'email')));
CREATE POLICY "Client writes own support_messages" ON public.support_messages FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = support_messages.ticket_id AND t.cliente_email = (auth.jwt() ->> 'email')));

REVOKE ALL ON public.support_tickets FROM anon;
REVOKE ALL ON public.support_messages FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_tickets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_messages TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;
GRANT ALL ON public.support_messages TO service_role;

DROP POLICY IF EXISTS "anon_dispatcher_select" ON public.fila_atendimento_pj;
DROP POLICY IF EXISTS "anon_dispatcher_update" ON public.fila_atendimento_pj;
REVOKE ALL ON public.fila_atendimento_pj FROM anon;