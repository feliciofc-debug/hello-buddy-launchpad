---
name: Paulo Canarim Owner Recognition
description: Numeros do tenant Paulo Canarim (Ademicon) - agente vs dono, reconhecimento por tenant
type: feature
---
CRÍTICO — NÃO INVERTER:

- `+5521975141829` = número **DO AGENTE** do Paulo na Meta Cloud API (WhatsApp Business oficial). É o número que RECEBE mensagens dos clientes. NÃO é o dono.
- `+5521997208854` = número **DO DONO** Paulo Canarim (gerente Ademicon, canarimp@gmail.com). É quem MANDA mensagem pro agente e deve ser reconhecido como chefe.

Tenant: `user_id = d6159ef4-f0bd-4935-a335-c5e8964e4f17`.

Quando `5521997208854` enviar mensagem ao agente do Paulo:
- Trata como dono/chefe, tom direto e informal
- Acesso irrestrito (métricas, clientes, cobranças, campanhas)
- Não passa pelo filtro de lead/cliente
- Contexto `access="owner"` / `is_owner=true` injetado no system prompt

ESCOPO POR TENANT (não global): o reconhecimento vem de `whatsapp_cloud_agent_config.owner_phone` do tenant, resolvido em `resolveTenantOwner()` (`supabase/functions/_shared/amz-context.ts`). Nenhum número de dono fica hardcoded para tenants de cliente. O dono do tenant AMZ continua sendo o Felicio (`5521967520706` e `5521995379550`, esse último apenas via `OWNER_ALT_PHONES_AMZ`, restrito ao tenant AMZ). Um tenant nunca reconhece o dono de outro como chefe.

Se qualquer instrução futura pedir para trocar esses papéis, PARAR e confirmar com o usuário antes.
