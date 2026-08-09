# Plano — Carrossel com CTA de atendimento + JARVIS avisando leads

Duas features, multi-tenant, sem deploy até aprovação.

## Auditoria (respostas às suas perguntas)

**De onde vem o contato de atendimento do tenant (F1)**
Da tabela `whatsapp_config`, coluna `display_phone` (mesmo campo já usado pelo vCard do ebook em `_shared/tenant-ebook.ts`), junto com `business_name`. O link fica `https://wa.me/<display_phone só dígitos>`. Se o tenant não tiver `display_phone`, o carrossel sai sem CTA de contato (nunca cai em número fixo/AMZ).

**Como o sistema sabe o WhatsApp do dono para notificar (F2)**
Da tabela `whatsapp_cloud_agent_config`, colunas `owner_phone` / `owner_name` — é a mesma fonte que `_shared/amz-context.ts` já usa para reconhecer o dono e que a tool `encaminhar_recado_ao_dono` usa para entregar recado. Sem `owner_phone` configurado, não há notificação (fallback seguro, sem número fixo).

**Reaproveitamento de tools existentes**
- `encaminhar_recado_ao_dono` — já entrega mensagem no WhatsApp do dono do tenant. É o canal que a F2 reaproveita (não vou criar canal novo).
- `criar_lembrete` — é agendamento com escalonamento; não serve para alerta imediato de lead. Não usar.
- `consultar_clientes_leads` — hoje só conta registros de `clientes` / `leads_b2b` / `leads_b2c`. Vou estender para listar os leads novos captados pelo JARVIS.

## Feature 1 — Carrossel com CTA de atendimento

- Em `_shared/business-context.ts`, `getTenantBusinessContext` passa a trazer também `business_name` + `display_phone` do tenant e montar `waLink`.
- `buildCarouselPrompt` recebe o contato e instrui: o slide **cta** deve terminar com convite para o WhatsApp ("Fale com a gente no WhatsApp 👉"), e a **legenda** do post recebe a mesma linha com o link real.
- O link não vai desenhado como URL longa dentro da arte (fica ilegível): no card entra a chamada + o número formatado; o `wa.me` completo vai na legenda do Instagram, onde é clicável.
- Sem `display_phone`: prompt gera CTA genérico ("chama a gente no WhatsApp") sem link, e o processor loga o aviso — nada quebra.

## Feature 2 — Notificação de lead ao dono (JARVIS como SDR)

**Fluxo**
1. Remetente desconhecido (não é dono, não está em `clientes`/contatos do tenant) → JARVIS **atende primeiro**, normalmente.
2. Coleta natural, dentro da conversa (regras no `agent-soul.ts`, reusando o padrão de coleta leve que já existe): pergunta nome, empresa e ramo **uma vez cada**, diluído entre respostas úteis. Proibido: bloco de perguntas, repetir se não responder, travar atendimento.
3. Nova tool `registrar_lead_novo({ nome, empresa, ramo, interesse })`: grava o lead e dispara a notificação ao dono **em paralelo** — a resposta ao cliente não espera nem menciona a notificação.

**Onde registra**
Nova tabela `public.jarvis_leads` (`user_id`, `telefone`, `nome`, `empresa`, `ramo`, `interesse`, `origem`, `created_at`, `notificado_em`), RLS por `user_id`, grants `authenticated` + `service_role`. Upsert único por `(user_id, telefone)` — reabordagem atualiza o registro em vez de duplicar.

**Notificação**
Mensagem ao `owner_phone` via o mesmo caminho de `encaminhar_recado_ao_dono`:
`🔔 Novo lead: João, da XPTO (ramo: logística) — quer saber sobre a plataforma. Telefone: +55...`
Guardrail: **1 notificação por lead** (controlada por `notificado_em`); se o lead voltar dias depois com dados novos, manda um follow-up curto, nunca a cada mensagem.

**Escopo**
Só stranger/lead novo. Dono, clientes conhecidos e conversas já em andamento com lead já notificado não disparam nada.

## Detalhes técnicos

Arquivos tocados: `_shared/business-context.ts` (F1), `_shared/agent-soul.ts` (regras de coleta), `whatsapp-cloud-inbound-processor/index.ts` (tool + notificação), 1 migração (`jarvis_leads`), e extensão de `consultar_clientes_leads`. Sem mexer em checkout/pagamento, campanhas ou templates Meta.

## Ordem de execução (uma fase por vez, diff antes de deploy)

1. F1 — CTA no carrossel (rápida, isolada, testável no próximo carrossel).
2. F2 fase A — migração `jarvis_leads` + tool `registrar_lead_novo` + notificação ao dono.
3. F2 fase B — regras de coleta natural no `agent-soul.ts` + extensão do `consultar_clientes_leads`.
