begin;

-- Vendedores: registros antigos sem dono pertencem ao tenant AMZ atual.
update public.vendedores
set user_id = 'b7af0118-c506-4f87-8ac3-a0a11fd621fe'::uuid
where user_id is null;

-- Vendedores: restringe gerenciamento ao dono do tenant ou admin.
drop policy if exists "Authenticated gerencia vendedores" on public.vendedores;
create policy "Usuários gerenciam seus vendedores"
on public.vendedores
for all
to authenticated
using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'::public.app_role))
with check (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'::public.app_role));

-- Tabelas antigas de diagnóstico WhatsApp não têm user_id; leitura fica só para admins.
drop policy if exists "Users can view messages_received" on public.whatsapp_messages_received;
create policy "Admins podem ver mensagens recebidas antigas"
on public.whatsapp_messages_received
for select
to authenticated
using (public.has_role(auth.uid(), 'admin'::public.app_role));

drop policy if exists "Users can view messages_sent" on public.whatsapp_messages_sent;
create policy "Admins podem ver mensagens enviadas antigas"
on public.whatsapp_messages_sent
for select
to authenticated
using (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Logs de webhook: manter inserção por webhook legado, mas leitura/limpeza só por admin.
drop policy if exists "Authenticated users can view debug logs" on public.webhook_debug_logs;
drop policy if exists "System can delete debug logs" on public.webhook_debug_logs;
create policy "Admins podem ver debug logs"
on public.webhook_debug_logs
for select
to authenticated
using (public.has_role(auth.uid(), 'admin'::public.app_role));
create policy "Admins podem limpar debug logs"
on public.webhook_debug_logs
for delete
to authenticated
using (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Pietro: o site público/backend ainda cria conversas; painel autenticado lê/edita só como admin.
drop policy if exists "Authenticated can view all conversations" on public.pietro_conversations;
drop policy if exists "pietro_conversations_select_authenticated" on public.pietro_conversations;
drop policy if exists "pietro_conversations_update_authenticated" on public.pietro_conversations;
create policy "Admins podem ver conversas Pietro"
on public.pietro_conversations
for select
to authenticated
using (public.has_role(auth.uid(), 'admin'::public.app_role));
create policy "Admins podem atualizar conversas Pietro"
on public.pietro_conversations
for update
to authenticated
using (public.has_role(auth.uid(), 'admin'::public.app_role))
with check (public.has_role(auth.uid(), 'admin'::public.app_role));

drop policy if exists "Authenticated can view all messages" on public.pietro_messages;
drop policy if exists "pietro_messages_select_authenticated" on public.pietro_messages;
drop policy if exists "pietro_messages_update_authenticated" on public.pietro_messages;
create policy "Admins podem ver mensagens Pietro"
on public.pietro_messages
for select
to authenticated
using (public.has_role(auth.uid(), 'admin'::public.app_role));
create policy "Admins podem atualizar mensagens Pietro"
on public.pietro_messages
for update
to authenticated
using (public.has_role(auth.uid(), 'admin'::public.app_role))
with check (public.has_role(auth.uid(), 'admin'::public.app_role));

commit;