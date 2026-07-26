
# Plano — Migração para Meta Oficial (Templates + Opt-in obrigatório)

Nada será codificado antes da tua aprovação. Abaixo, o mapa do que já existe, o que falta, e a ordem sugerida por valor rápido × baixo consumo de crédito.

---

## 1) O que já existe vs. o que falta

**Já pronto (reaproveitável — não perdemos nada):**
- `whatsapp-send-message` **já sabe mandar template** (`type: 'template'`) via `graph.facebook.com/v25.0/{phone_id}/messages`. Hoje só usa `name` + `language` (sem componentes/variáveis).
- Tabela `whatsapp_config` por tenant (phone_number_id + access_token permanente já rotacionado no AMZ).
- Tabela `opt_ins` + edge functions `registrar-optin` e `sincronizar-optins-retroativo` — infra de consentimento **já existe**.
- Todo o motor visual: modal de campanha, segmentos, espelhos de grupo, múltiplos horários, Autopilot, travas de volume, dedup por telefone. **Continua igual.**

**Falta construir:**
- **A.** Suporte a `components` (variáveis `{{1}}`, `{{2}}`, header com imagem) no `whatsapp-send-message`.
- **B.** Gestão de templates: CRUD + submissão à Meta via Message Template API (`/{WABA_ID}/message_templates`) + consulta de status (APPROVED/PENDING/REJECTED).
- **C.** Campo `opt_in` em `pj_lista_membros` (ou join contra `opt_ins`/`whatsapp_contacts`) + filtro obrigatório no executor.
- **D.** Trocar o "correio" no `executar-campanhas-agendadas`: de `send-wuzapi-message-pj` (Baileys) para `whatsapp-send-message` (Meta template).
- **E.** Aposentar Baileys e fechar `anon` em `fila_atendimento_pj` / `gateway_status` (resolve os 2 fixes de segurança pendentes).

---

## 2) Fases (ordem por valor rápido × custo baixo)

### FASE 1 — Opt-in como fonte de verdade (baixo esforço, valor imediato)
Antes de qualquer envio oficial, garantir que a base está limpa.

- Adicionar coluna `opt_in boolean default false` + `opt_in_origem text` + `opt_in_em timestamptz` em `pj_lista_membros`.
- Backfill via `sincronizar-optins-retroativo` (já existe) para marcar quem já tem opt-in em `opt_ins` ou `whatsapp_contacts`.
- UI em "Clientes e Segmentos": badge verde "✅ Opt-in" / cinza "⚠️ Sem opt-in", filtro "só com opt-in", ação em massa "Registrar opt-in manual (declaro que tenho consentimento)".
- Preview do modal de campanha passa a mostrar: `X destinatários totais → Y com opt-in → serão enviados: Y`.

**Esforço:** pequeno. **Crédito:** baixo. **Valor:** sua base já fica pronta pro dia da virada.

---

### FASE 2 — Gestão de Templates (média, é o coração da migração)
Tela nova: `Configurações → Templates WhatsApp`.

- CRUD local em nova tabela `whatsapp_templates` (nome, categoria MARKETING/UTILITY, idioma, body, header, botões, status Meta, motivo de rejeição).
- Edge function `whatsapp-template-submit` — cria/atualiza template via `POST /{WABA_ID}/message_templates` usando o token do tenant.
- Edge function `whatsapp-template-sync` — puxa status atual via `GET /{WABA_ID}/message_templates` e grava no banco.
- UI: criar → preview com variáveis (`{{1}}=nome`, `{{2}}=produto`, `{{3}}=preço`) → submeter → ver status (Pendente/Aprovado/Rejeitado com motivo) → botão "Sincronizar status".
- Precisamos guardar `waba_id` por tenant em `whatsapp_config` (adicionar coluna se não existir).

**Esforço:** médio. **Crédito:** médio. **Valor:** sem isso não há campanha oficial.

---

### FASE 3 — Adaptar `whatsapp-send-message` para componentes
- Aceitar `template_components: [{ type: 'body', parameters: [{type:'text', text:'...'}] }, { type:'header', parameters:[{type:'image', image:{link:'...'}}] }]`.
- Aceitar `template_id` (do nosso banco) para o executor não precisar montar payload à mão.

**Esforço:** pequeno. **Crédito:** baixo.

---

### FASE 4 — Migrar o executor + modal de campanha (a virada)
- `CriarCampanhaWhatsAppModal` e `AutopilotWhatsAppConfig`: em vez de campo "template livre", passa a ter **seletor de template aprovado** (filtra `status='APPROVED'`) + mapeamento das variáveis (`{{1}} → nome do contato`, `{{2}} → produto`, `{{3}} → preço`) + preview do texto final.
- `executar-campanhas-agendadas`:
  - filtra destinatários **exigindo `opt_in=true`**;
  - troca chamada de `send-wuzapi-message-pj` por `whatsapp-send-message` com `template_id` + `template_components` + `image_url` (do produto);
  - **travas de volume, dedup, jitter, kill-switch de reagendamento — tudo continua igual**;
  - guardrail de "chip offline" some (é oficial), mas mantemos o de erro Meta (24h token, template revogado, etc.).
- Flag `usar_meta_oficial boolean default true` em `campanhas_recorrentes` — permite conviver com Baileys durante a transição (roll-back se algo travar).

**Esforço:** médio. **Crédito:** médio. **Valor:** aqui você já roda campanha 100% oficial.

---

### FASE 5 — Aposentar Baileys + fechar buracos de segurança
Só executar quando Fase 4 estiver rodando estável por alguns dias.

- Remover botão "Gateway WhatsApp" / instâncias WuzAPI do menu (esconder, não deletar código ainda).
- Desativar cron/queue do `fila_atendimento_pj` para autopilot.
- **Migração de segurança final:** revogar `anon` em `fila_atendimento_pj` e `gateway_status` → **fecha os 2 fixes pendentes do scanner** de vez.
- Deletar tabelas WuzAPI num ciclo seguinte, após período de observação.

**Esforço:** pequeno. **Crédito:** baixo. **Valor:** fecha segurança + simplifica manutenção.

---

## 3) O que continua exatamente igual (reaproveitamento)

- ✅ Modal de campanha, seleção de produtos e segmentos, múltiplos horários, modo `uma_vez`/`diário`.
- ✅ Botão "📱 Campanha WhatsApp" e "Autopilot WhatsApp" no card de produto.
- ✅ Segmentos, espelhos de grupo, dedup por telefone normalizado.
- ✅ Travas: `max_envios_dia` por campanha, teto por número (300), kill-switch, reagendamento em SP.
- ✅ `historico_envios`, `campanha_execucoes`, dashboards.
- ✅ JARVIS e Silvester (atendimento) — já são 100% Meta oficial, não muda nada.

**Só troca o "correio" por baixo do capô + adiciona filtro de opt-in + seletor de template.**

---

## 4) Recomendação de execução dentro do crédito apertado

Sugestão para caber num orçamento enxuto sem perder valor:

1. **Fase 1 primeiro** (opt-in) — barato, deixa a base pronta. Se o crédito acabar aqui, a plataforma continua funcionando com Baileys e você já ganhou governança.
2. **Fase 2 + 3 juntas** (templates + suporte a components) — é o investimento principal.
3. **Fase 4** (virada do executor) — com flag para roll-back.
4. **Fase 5** (aposentar Baileys) — só depois de dias de estabilidade.

**Enquanto migra, Baileys fica ligado** — nada de vácuo de campanha.

---

## 5) Perguntas que preciso te confirmar antes de codar a Fase 1

1. **Opt-in retroativo**: posso considerar que **quem já mandou mensagem inbound pro Jarvis/Silvester** (existe em `whatsapp_contacts` ou `pietro_conversations`) tem opt-in implícito? Ou você quer opt-in **explícito** (formulário/link) pra 100% dos contatos, sem retroativo?
2. **WABA ID**: você tem o `waba_id` do AMZ à mão? (é diferente do `phone_number_id`). Precisamos dele pra Fase 2. Se não tiver, te mostro onde pegar no Business Manager.
3. **Roll-back**: mantemos flag `usar_meta_oficial` por campanha (default true) para poder voltar pro Baileys num caso extremo, ou você quer corte seco (sem flag)?

Me confirma esses 3 pontos + qual fase autoriza começar, e eu executo só o autorizado.
