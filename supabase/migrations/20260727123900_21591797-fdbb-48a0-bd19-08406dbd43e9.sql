begin;

-- clientes_afiliados: remove política aberta de sistema; políticas próprias por user_id permanecem.
drop policy if exists "Sistema pode gerenciar clientes" on public.clientes_afiliados;

-- comissoes: remove política aberta de sistema; afiliados continuam vendo suas próprias comissões pela policy existente.
drop policy if exists "Sistema pode gerenciar comissões" on public.comissoes;

-- mensagens_enviadas: remove política aberta; mantém policies de user_id existentes.
drop policy if exists "System can manage messages" on public.mensagens_enviadas;

-- wuzapi_tokens_afiliados: tokens nunca devem ser acessíveis por cliente público; backend/service_role continua bypassando RLS.
drop policy if exists "Sistema pode gerenciar tokens" on public.wuzapi_tokens_afiliados;

-- leads_ebooks: restringe leitura/atualização ao dono do lead.
drop policy if exists "Leads visíveis para usuários autenticados" on public.leads_ebooks;
drop policy if exists "Atualizar leads autenticados" on public.leads_ebooks;
create policy "Usuários podem ver seus próprios leads ebooks"
on public.leads_ebooks
for select
to authenticated
using (auth.uid() = user_id);
create policy "Usuários podem atualizar seus próprios leads ebooks"
on public.leads_ebooks
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- opt_ins: continua permitindo cadastro público, mas leitura apenas para admins.
drop policy if exists "Authenticated users can view opt_ins" on public.opt_ins;
create policy "Admins podem ver opt_ins"
on public.opt_ins
for select
to authenticated
using (public.has_role(auth.uid(), 'admin'::public.app_role));

-- security_reports: continua permitindo submissão pública, mas leitura apenas para admins.
drop policy if exists "Only authenticated users can view security reports" on public.security_reports;
create policy "Admins podem ver security reports"
on public.security_reports
for select
to authenticated
using (public.has_role(auth.uid(), 'admin'::public.app_role));

-- socios: remove exposição pública de CPF e escrita aberta; leitura apenas para admins.
drop policy if exists "Anyone can view socios" on public.socios;
drop policy if exists "System can manage socios" on public.socios;
create policy "Admins podem ver socios"
on public.socios
for select
to authenticated
using (public.has_role(auth.uid(), 'admin'::public.app_role));

-- trial_configs: remove leitura anônima de e-mails; mantém leitura própria existente.
drop policy if exists "Anon can view trial config" on public.trial_configs;

-- whatsapp_notifications: restringe leitura ao dono e escrita ao próprio usuário.
drop policy if exists "Usuários podem ver suas próprias notificações" on public.whatsapp_notifications;
drop policy if exists "Usuários podem criar notificações" on public.whatsapp_notifications;
create policy "Usuários podem ver suas próprias notificações"
on public.whatsapp_notifications
for select
to authenticated
using (auth.uid()::text = user_id);
create policy "Usuários podem criar suas próprias notificações"
on public.whatsapp_notifications
for insert
to authenticated
with check (auth.uid()::text = user_id);

commit;