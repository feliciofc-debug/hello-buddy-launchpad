# Upgrade AMZ Ofertas — Visão de Engenharia + Cronograma Faseado

Documento de planejamento. **Sem código nesta etapa.** Baseado no estado real do repo levantado pelo arquiteto externo.

---

## 1) Sequência recomendada entre as 2 features

**Ordem: WhatsApp Agente Cloud API → Facebook Ads.** Razões:

1. WhatsApp é o vetor de receita mais imediato (atendimento + conversão) e já temos 80% da fundação (Cloud API de saída, cérebro de IA em `atendimento-suporte`, padrão de RLS por `user_id`). O gap real é **inbound webhook + Embedded Signup + loop conversacional na Cloud**.
2. Facebook Ads depende de uma submissão de App Review mais pesada (advertising_management + ads_read + business_management) e exige screencast mostrando o fluxo já funcional. Enquanto a trilha de WhatsApp roda em paralelo no review da Meta, conseguimos amadurecer o desenho do Ads e evitar duas submissões competindo pela mesma janela de atenção do revisor.
3. WhatsApp valida o padrão multi-tenant de OAuth/Embedded Signup que vamos reusar quase idêntico no Facebook Ads (Business Login com escopos diferentes). Ou seja: o que aprendermos na trilha 1 reduz risco e retrabalho na trilha 2.

As duas trilhas **podem se sobrepor parcialmente** a partir da Fase 3 do WhatsApp (quando o agente já está rodando em sandbox e estamos esperando review da Meta).

---

## 2) Feature 1 — WhatsApp Agente na Cloud API Oficial

### Visão de engenharia

**O que já existe e será reaproveitado:**
- `whatsapp-send-message` (Graph v25.0, texto/template/imagem) — vira a saída do agente novo.
- Tabela `whatsapp_config` (phone_number_id, waba_id, access_token, display_phone, RLS) — fundação multi-tenant.
- `atendimento-suporte` (Gemini + guardrails) — vira o cérebro do agente, com adaptador novo de I/O Cloud API.
- Padrão de RLS por `user_id` já consolidado em `meta_connections`, `integrations`, `whatsapp_config`.

**O que precisa nascer:**

| Componente | Tipo | Função |
|---|---|---|
| `whatsapp-cloud-webhook` | Edge function pública | Verify token (GET `hub.challenge`) + receber `entry.changes` (POST). Dedup por `message.id`. Roteia para fila. |
| `whatsapp-cloud-inbound-processor` | Edge function (worker, chamada por pg_net ou trigger) | Lê fila, hidrata contato, chama cérebro de IA, persiste, dispara resposta via `whatsapp-send-message`. |
| `whatsapp-embedded-signup` | Edge function + componente UI | Facebook Login for Business, captura `waba_id` + `phone_number_id`, registra número (`/register`), subscreve webhook do WABA, grava em `whatsapp_config`. |
| `whatsapp_cloud_inbound_queue` | Tabela | Fila durável de mensagens recebidas, com dedup por `wamid` e status (received/processing/done/failed). |
| `whatsapp_cloud_conversations` + `whatsapp_cloud_messages` | Tabelas | Threads e mensagens do agente Cloud (separadas das tabelas WuzAPI atuais — convivência, não migração). |
| `whatsapp_cloud_handoff` | Tabela | Estado de handoff humano por conversa (pausar IA, atribuir operador, retomar). |
| Painel `/atendimento-cloud` | Frontend | Inbox unificada, takeover humano, métricas, templates aprovados. |

**Convivência com WuzAPI (trava obrigatória):**
- Nada do WuzAPI é tocado. `IAConversas` + `send-wuzapi-message` continuam servindo Ademicon.
- O agente novo vive em rotas, tabelas e edge functions com prefixo `whatsapp_cloud_*` / `/atendimento-cloud`. Zero acoplamento.
- Decisão de qual gateway usar é por cliente, gravada em `whatsapp_config.gateway` (`cloud` | `wuzapi`).

**Fluxo inbound (resumo):**

```text
Meta → POST whatsapp-cloud-webhook
        ├─ valida X-Hub-Signature-256
        ├─ dedup por wamid
        └─ INSERT whatsapp_cloud_inbound_queue (status=received)
                  ↓ (pg_net http_post async — padrão já usado em campanhas)
        whatsapp-cloud-inbound-processor
            ├─ resolve user_id pelo phone_number_id (whatsapp_config)
            ├─ checa handoff (se humano ativo → não responde IA)
            ├─ chama atendimento-suporte (cérebro Gemini)
            ├─ persiste em whatsapp_cloud_messages
            └─ whatsapp-send-message (saída já existente)
```

### Cronograma faseado — WhatsApp

**Fase 1.0 — Fundação inbound (3–4 dias)**
- Marco: webhook recebendo mensagens reais em sandbox.
- Tarefas: tabelas (`whatsapp_cloud_inbound_queue` + dedup), `whatsapp-cloud-webhook` (GET verify + POST receive + assinatura HMAC), configuração do webhook no app Meta em modo dev.
- Saída: log de mensagem recebida no número de teste.

**Fase 1.1 — Loop conversacional (3–4 dias)**
- Depende de: 1.0.
- Tarefas: `whatsapp-cloud-inbound-processor`, adaptador do cérebro `atendimento-suporte` para I/O Cloud, `whatsapp_cloud_conversations` + `whatsapp_cloud_messages`, dedup idempotente, janela 24h e fallback para template.
- Saída: conversa bidirecional funcionando ponta a ponta em sandbox com número de teste.

**Fase 1.2 — Multi-tenant via Embedded Signup (4–5 dias)**
- Depende de: 1.1.
- Tarefas: `whatsapp-embedded-signup` (Facebook Login for Business + escopos `whatsapp_business_management`, `whatsapp_business_messaging`, `business_management`), registro do número, subscrição automática do webhook do WABA do cliente, gravação isolada por `user_id`.
- Saída: cliente novo conecta o próprio número sem suporte manual.

**Fase 1.3 — Painel + handoff humano (4–5 dias)**
- Depende de: 1.1 (pode rodar em paralelo com 1.2).
- Tarefas: `/atendimento-cloud` (inbox, thread view, takeover), `whatsapp_cloud_handoff`, biblioteca de templates aprovados, métricas básicas.
- Saída: operador humano consegue assumir conversa e devolver pra IA.

**Fase 1.4 — Hardening + App Review #1 (3–5 dias + janela Meta)**
- Depende de: 1.2 e 1.3.
- Tarefas: rate limiting, retry com backoff, logs estruturados, healthcheck no padrão `edge_functions_health`, screencast do fluxo (Embedded Signup → conversa IA → handoff), submissão dos permissions na Meta.
- **App Review #1 entra aqui.** Permissions: `whatsapp_business_management`, `whatsapp_business_messaging`, `business_management`. Janela típica Meta: 3–10 dias úteis.

**Fase 1.5 — Rollout controlado (2–3 dias)**
- Depende de: aprovação da Meta.
- Tarefas: piloto com 1–2 clientes (ZH3 é candidato natural), monitoramento intensivo, depois liberação geral por feature flag.

**Duração total trilha 1: ~3 semanas de build + janela de review.**

---

## 3) Feature 2 — Facebook Ads (Marketing API)

### Visão de engenharia

**Premissa central:** espelhar o padrão do Google Ads que já está consolidado no projeto (`google-ads-auth/callback/create-campaign/sync-metrics`). Mesma anatomia, trocando Google por Meta Marketing API.

**Componentes novos:**

| Componente | Função |
|---|---|
| `facebook-ads-auth` + `facebook-ads-callback` | OAuth Business Login, captura `ad_account_id`, `business_id`, page tokens de longa duração. |
| `facebook-ads-create-campaign` | Cria Campaign → AdSet → Creative → Ad em cima de um post já publicado (boost) ou criativo novo. |
| `facebook-ads-sync-metrics` | Cron diário (pg_cron + pg_net) puxa insights (`impressions`, `reach`, `clicks`, `spend`, `ctr`, `cpm`, `cpc`, `actions`). |
| `facebook-ads-ai-optimizer` | Camada de IA: sugere budget, audience, criativo vencedor, pausa anúncios ruins. Reusa Lovable AI Gateway. |
| `facebook_ads_connections` | Conta de anúncio conectada por `user_id` (RLS estrita, mesmo padrão de `meta_connections`). |
| `facebook_ads_campaigns` + `facebook_ads_insights` | Espelho local do que está na Meta, para painel rápido e histórico. |
| Painel `/marketing/facebook-ads` | UI: listar campanhas, criar boost de um post existente, ver insights, controlar budget. |

**Decisão central de UX:** "IA gerencia ads" = a IA propõe (público, budget, criativo, lance), o cliente aprova com 1 clique. Não vamos rodar ads totalmente autônomos no MVP — risco financeiro e de bloqueio Meta é alto demais. Modo "piloto automático" fica para Fase 2.x, depois de validar com 3–5 clientes em modo assistido.

**Reaproveitamento:**
- `meta_connections` (token de página) já existe — mas Marketing API exige escopos novos (`ads_management`, `ads_read`, `business_management`). Vamos manter `meta_connections` para publishing e criar `facebook_ads_connections` separado para evitar conflito de escopos e de revogação.
- Padrão de cron+pg_net das campanhas WhatsApp serve para `sync-metrics`.
- Sanitização de conteúdo IA (`ai-content-sanitization-logic`) serve para criativos gerados.

### Cronograma faseado — Facebook Ads

**Fase 2.0 — OAuth Marketing API + leitura (3–4 dias)**
- Tarefas: `facebook-ads-auth/callback`, tabela `facebook_ads_connections`, listagem de contas de anúncio e páginas do cliente, `sync-metrics` rodando manualmente.
- Saída: cliente conecta conta de anúncio e vemos insights no painel.

**Fase 2.1 — Boost de post existente (4–5 dias)**
- Depende de: 2.0 + posts já publicados (Meta Publishing Engine já existe).
- Tarefas: `facebook-ads-create-campaign` no modo "boost" (objetivo `OUTCOME_ENGAGEMENT` ou `OUTCOME_TRAFFIC`), seleção de público salvo, definição de budget e duração, espelho em `facebook_ads_campaigns`.
- Saída: cliente impulsiona um post em 3 cliques.

**Fase 2.2 — Campanha completa + criativo IA (5–7 dias)**
- Depende de: 2.1.
- Tarefas: criação de Campaign/AdSet/Ad full, criativo gerado por IA (texto + imagem reaproveitando pipeline atual), público lookalike e detalhado, A/B básico.
- Saída: campanha completa criada pela IA, aprovada pelo cliente.

**Fase 2.3 — IA otimizadora assistida (4–5 dias)**
- Depende de: 2.2 + 14 dias de dados reais.
- Tarefas: `facebook-ads-ai-optimizer`, sugestões diárias (pausar ad ruim, realocar budget, novo criativo), tudo com aprovação humana.
- Saída: cliente recebe relatório diário com ações de 1 clique.

**Fase 2.4 — Hardening + App Review #2 (3–5 dias + janela Meta)**
- **App Review #2 entra aqui.** Permissions: `ads_management`, `ads_read`, `business_management`. Screencast obrigatório mostrando: conectar conta, criar campanha, ver insights, pausar/editar. Janela típica: 5–15 dias úteis (Marketing API costuma ser mais criterioso que publishing).

**Fase 2.5 — Rollout controlado (2–3 dias)**
- Piloto com clientes que já têm conta de anúncio ativa e budget mensal real.

**Duração total trilha 2: ~3,5 semanas de build + janela de review.**

---

## 4) Cronograma macro consolidado (visão de topo)

```text
Semana 1   │ WA 1.0 Webhook         │
Semana 2   │ WA 1.1 Loop IA         │
Semana 3   │ WA 1.2 Embedded Signup │ WA 1.3 Painel/handoff (paralelo)
Semana 4   │ WA 1.4 Hardening + submete App Review #1 ─┐
           │ ADS 2.0 OAuth + leitura (paralelo, em sandbox)
Semana 5   │ ADS 2.1 Boost          │ (Meta revisando WA)
Semana 6   │ WA 1.5 Rollout (se aprovado)
           │ ADS 2.2 Campanha + criativo IA
Semana 7   │ ADS 2.3 IA otimizadora
Semana 8   │ ADS 2.4 Hardening + submete App Review #2
Semana 9+  │ ADS 2.5 Rollout (após aprovação)
```

Sobreposição segura: a partir da Semana 4, enquanto a Meta revisa a trilha 1, dá pra avançar na 2 em sandbox sem competir por App Review.

---

## 5) Riscos técnicos e pontos de decisão

**Decisões que dependem de você + arquiteto antes de virar build:**

1. **Convivência WuzAPI ↔ Cloud por cliente:** confirmamos `whatsapp_config.gateway` como switch por cliente? Cliente pode rodar os dois ao mesmo tempo em números diferentes ou é exclusivo? *Recomendação: exclusivo por número, livre por cliente.*
2. **Embedded Signup vs. onboarding manual no MVP:** Embedded Signup acelera escala mas adiciona complexidade no review. Alternativa: MVP com onboarding manual (operador cola tokens) e Embedded Signup só na Fase 1.5. *Recomendação: já fazer Embedded Signup, é o que destrava agência (ZH3).*
3. **Janela 24h do WhatsApp:** quando passou 24h sem interação do usuário, só dá pra responder com template aprovado. Política do agente: pausa silenciosa, template de re-engajamento, ou handoff humano? *Recomendação: template de re-engajamento opt-in + handoff se cliente responder fora da janela.*
4. **Facebook Ads — IA autônoma vs. assistida:** confirmado MVP assistido (cliente aprova cada ação)? Autônomo só após validação?
5. **Separar `meta_connections` de `facebook_ads_connections`:** confirmado? Evita revogação cruzada (cliente que tira ads não perde publishing).
6. **Custo de tokens IA no inbound:** cada mensagem recebida pode disparar chamada Gemini. Precisa de orçamento mensal por cliente (`ai_messages_quota`) similar ao `ai-image-generation-quota`? *Recomendação: sim, criar quota.*

**Riscos técnicos principais:**

- **App Review da Meta rejeitar por screencast incompleto** — mitigação: roteiro de screencast já validado na Fase 1.4/2.4 antes de submeter.
- **Race condition no webhook inbound** — mitigação: dedup por `wamid` na fila, processador idempotente.
- **Token de página de 60 dias expirar silenciosamente em ads** — mitigação: reaproveitar estratégia `meta-token-management-strategy` (renovação proativa).
- **Multi-tenant frouxo no callback OAuth** — mitigação: state assinado contendo `user_id`, validação no callback, RLS estrita já é padrão do projeto.
- **WuzAPI quebrar e cliente achar que é a Cloud nova** — mitigação: painel `/atendimento-cloud` separado visualmente, logs separados, healthcheck independente.

**Pontos onde vou pedir decisão do arquiteto durante o build:**
- Formato exato do payload entre `webhook` → `inbound-processor` (fila Postgres vs. pg_net direto).
- Estratégia de retry: backoff exponencial vs. cron de reprocessamento da fila.
- Modelo de IA no agente (Gemini 2.5 Flash vs. modelos do Lovable AI Gateway) — custo vs. latência.

---

## 6) O que NÃO está neste plano (consciente)

- Migração de Ademicon do WuzAPI para Cloud — explicitamente proibido.
- Reescrita do cérebro `atendimento-suporte` — só adaptador novo de I/O.
- Instagram Direct, Messenger e WhatsApp Business App (não-Cloud) — fora de escopo.
- Modo totalmente autônomo de Facebook Ads — só na Fase 2.x pós-MVP.

---

Pronto pra revisar fase a fase. Me devolve onde a ordem está certa, onde precisa inverter, e quais decisões do bloco 5 você e o arquiteto já querem travar antes de a gente começar a Fase 1.0.
