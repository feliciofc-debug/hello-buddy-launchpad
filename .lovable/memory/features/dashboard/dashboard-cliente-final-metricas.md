---
name: Dashboard cliente final — métricas e fase futura
description: Fontes de dados do dashboard /dashboard e fase pendente de persistir delivered/read do webhook Meta em historico_envios
type: feature
---
## Dashboard do cliente final (/dashboard, DashboardMetricas.tsx)
- Tema CLARO é o padrão, com toggle claro/escuro persistido (next-themes). Destaques em laranja AMZ via token `--brand` (`bg-brand`, `text-brand`).
- Hook: `src/hooks/useDashboardMetrics.ts`; UI: `src/components/dashboard/DashboardOverview.tsx`.
- Fontes: conversas = `whatsapp_cloud_messages` (sender agent/contact, ignora `campanha`); leads = `jarvis_leads` + `tenant_ebook_entregas` + novos `pj_lista_membros`; qualificação = `pj_lista_membros.opt_in_status`; campanhas = `historico_envios` (agrupado por `campanha_id`, nomes em `campanhas_recorrentes`); redes = `social_posts_queue` (status `publicado`/`erro`) + `tiktok_posts`.
- Respostas de campanha são INFERIDAS: inbound em `whatsapp_cloud_messages` após o timestamp do envio, casando telefone via `whatsapp_cloud_conversations.contact_number`.

## Fase futura registrada (pendente)
Persistir os statuses `delivered` e `read` do webhook da Meta em `historico_envios` (novas colunas + update por `message_id`/wamid), para o dashboard mostrar Entregues e Lidos reais das campanhas em vez de apenas Enviados/Falhas/Respostas inferidas.
