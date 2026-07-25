
# Fase 2 — Auditoria + Plano (sem deploy)

## Respostas A–D

**A) Menu lateral.** Confirmado: `src/pages/DashboardMetricas.tsx` linhas 290–303 têm o `menuItemsAll` e NÃO existe item "Clientes e Segmentos". O item deve ser inserido entre `whatsapp` e `contatos-comerciais` (linha 297), com `path: '/pj/listas'`, `id: 'clientes-segmentos'`. A tela que hoje lista `pj_listas_categoria` + membros é `src/components/pj/ContatosListasPJ.tsx`, renderizada por `src/pages/pj/ListasContatosPJ.tsx` na rota `/pj/listas`. `ContatosWhatsApp.tsx` é a tela de importação (grava, não navega/lista de forma consolidada). `ClientesManager` é outra coisa (CRM de clientes, não segmentos).

**B) Surfacing.** `ContatosListasPJ` já busca `pj_listas_categoria` (linha 120), grupos de `pj_grupos_whatsapp` (linha 158) e membros de `pj_lista_membros`. Os espelhos de grupo criados na Fase 1 (nome com prefixo `📱`) já entram automaticamente porque são rows normais de `pj_listas_categoria`. O que falta pra fechar surfacing: **chip de origem visível** (lista/grupo/espelho) e contagem real via `COUNT` (hoje mostra `total_membros` cache, que a Fase 1 já recalcula, mas a tela não diferencia visualmente).

**C) Alvos no modal de campanha.** `CriarCampanhaWhatsAppModal` (linhas 199–290) já carrega TRÊS fontes:
- `pj_listas_categoria` (prefixo `📋`) — inclui os espelhos de grupo `📱` da Fase 1
- `pj_grupos_whatsapp` com `grupo_jid` (prefixo `👥`) — grupo real
- `afiliado_lista_membros` (prefixo `📂`) — legado

Problema conhecido: **um grupo importado pela Fase 1 aparece 2× no seletor** — uma como grupo real (`👥`) e outra como espelho (`📱`). Precisa deduplicar visualmente ou marcar o espelho como "membros individuais" pra o usuário não selecionar os dois e disparar em dobro.

**D) Autopilot.** `AutopilotModal` + `AutopilotConfig` cuidam SÓ de redes sociais (Facebook/Instagram/Reels via `autopilot_config`). NÃO existe autopilot de WhatsApp. Recorrência de WhatsApp existe: tabela `campanhas_recorrentes` + edge function `executar-campanhas-agendadas` (cron via `process_scheduled_campaigns` no banco, já ativo). Hoje é criada manualmente pelo modal (`CriarCampanhaWhatsAppModal` grava em `campanhas_recorrentes` quando frequência ≠ uma-vez).

**⚠️ Achado crítico sobre token.** `executar-campanhas-agendadas` linha 349 dispara via `send-wuzapi-message-pj` (gateway local Baileys, por `userId`) — NÃO usa Meta Cloud, então o token do tenant é o `.exe` local por `user_id`, não o `whatsapp_config.access_token`. Isso é OK e já é multi-tenant por natureza (cada tenant tem seu gateway/porta). A guardrail "token do tenant" da Fase 2 se traduz aqui como: **campanhas do autopilot WhatsApp devem sempre passar por `send-wuzapi-message-pj` com `userId` do dono da campanha, jamais um userId hardcoded ou global**.

Fluxo de resposta: `whatsapp-cloud-inbound-processor` cobre Meta Cloud. Baileys tem seu próprio inbound (não olhei aqui, mas fora do escopo desta feature — respostas seguem o caminho existente).

---

## BLOCO 1 — Surfacing (rápido)

### Diff 1.1 — `src/pages/DashboardMetricas.tsx`

Inserir item no `menuItemsAll` (após `whatsapp`, antes de `contatos-comerciais`, linha 297):

```tsx
{ id: 'whatsapp', icon: MessageCircle, label: t('nav.whatsapp'), path: '/whatsapp-painel' },
{ id: 'clientes-segmentos', icon: Users, label: 'Clientes e Segmentos', path: '/pj/listas' },
{ id: 'contatos-comerciais', icon: Briefcase, label: 'Contatos Comerciais', path: '/pj/contatos-comerciais' },
```

Adicionar `Users` ao import de `lucide-react` (arquivo já usa muitos ícones, checar se já está). Respeita `isMenuAllowed('clientes-segmentos')` automaticamente pelo filtro linha 305 — precisa garantir que `useClientMenus` retorna `true` por default (ou adicionar `'clientes-segmentos'` à whitelist default do hook).

### Diff 1.2 — `src/components/pj/ContatosListasPJ.tsx`

Adicionar coluna/badge de **origem** em cada linha da lista:
- Nome começa com `📱 ` → badge secundário "Espelho de grupo"
- Row veio de `pj_grupos_whatsapp` → badge "Grupo WhatsApp"
- Resto → badge "Lista manual/CSV"

Uma helper `getOrigin(item)` local + `<Badge>` do shadcn. Nenhuma alteração de query.

### Diff 1.3 — `src/hooks/useClientMenus.ts` (se necessário)

Garantir que `'clientes-segmentos'` está na whitelist default. Se o hook já libera tudo por default, este diff é no-op.

---

## BLOCO 2 — Produto → disparo (curto)

### Diff 2.1 — `src/components/CriarCampanhaWhatsAppModal.tsx`

**Deduplicação de alvos.** Quando um grupo real (`pj_grupos_whatsapp`) tem espelho correspondente em `pj_listas_categoria` (nome com `📱 <mesmo nome>`), marcar o espelho na UI com badge "(individual — evitar se já selecionou o grupo)" e adicionar validação client-side: se usuário selecionar grupo `👥 X` **e** espelho `📱 X`, avisar antes de disparar.

Match por: strip prefixos e comparar nome normalizado (`nome.replace(/^📱 /, '').trim()` vs `grupo.nome.trim()`).

Nada muda no dispatch (continua queue-only via `inserir_campanha_fila` + gateway local por `userId`).

### Diff 2.2 — `src/pages/MeusProdutos.tsx`

Já existe botão que abre `CriarCampanhaWhatsAppModal` com `produto_id` (linhas 1271, 2163–2166). Nada a fazer estrutural — apenas confirmar que o `produto_id` está sendo passado no state ao abrir (auditar o handler que seta `isCampanhaWhatsAppOpen` — se não passa `produto_id`, adicionar).

---

## BLOCO 3 — Autopilot WhatsApp (novo, modo CONTROLADO)

Reutiliza 100% da infra existente: `campanhas_recorrentes` + `executar-campanhas-agendadas` + `send-wuzapi-message-pj`. **Sem nova tabela, sem novo cron.**

### Diff 3.1 — Novo componente `src/components/AutopilotWhatsAppConfig.tsx`

Espelho do `AutopilotConfig` (redes sociais), mas grava em `campanhas_recorrentes`. Config:

- **Produtos alvo** (multi-select de `produtos` do user)
- **Segmentos alvo** (multi-select de `pj_listas_categoria` + `pj_grupos_whatsapp`, com dedup do Bloco 2)
- **Cadência**: `frequencia` (`diaria` | `semanal`), `dias_semana[]`, `horarios[]` (usa colunas já existentes de `campanhas_recorrentes`)
- **Trava de volume**: novo campo local `max_envios_dia` — persiste em `campanhas_recorrentes.metadata` (JSONB) ou nova coluna se necessário. **Auditar `campanhas_recorrentes` primeiro** — se já tem `limite_envios_dia`, reusa; senão, migration mínima:
  ```sql
  ALTER TABLE public.campanhas_recorrentes
    ADD COLUMN IF NOT EXISTS max_envios_dia integer;
  ```
- **Toggle ativo/pausado** (usa `campanhas_recorrentes.ativa`).

### Diff 3.2 — Enforcement da trava no `executar-campanhas-agendadas`

Antes do loop de envio (linha ~340), somar quantos envios essa `campanha_recorrente_id` já fez HOJE (via `historico_envios` filtrado por `campanha_id` + `DATE(created_at) = CURRENT_DATE`) e cortar em `max_envios_dia`. Se estourou, `continue` pra próxima campanha, log claro.

### Diff 3.3 — Novo modal `src/components/AutopilotWhatsAppModal.tsx`

Espelho do `AutopilotModal` (rocket → whatsapp icon). Wrapper simples do config.

### Diff 3.4 — `src/pages/MeusProdutos.tsx`

Botão "Autopilot WhatsApp" ao lado do "Autopilot Social" existente. Abre o novo modal.

### Guardrails obrigatórios (todos no diff 3.2)

1. **Token do tenant**: dispatch continua chamando `send-wuzapi-message-pj` com `userId: campanha.user_id`. Nunca hardcode.
2. **Trava real**: `max_envios_dia` verificada por SUM real do histórico do dia (não campo cache).
3. **Anti-duplicação de contato**: quando `listas_ids` inclui grupo real + espelho do mesmo grupo, deduplicar por telefone normalizado ANTES de inserir na fila (o loop atual já usa `todosContatosSet` linha 312 — verificar se dedup por `normalizePhoneNumber` é efetivo). Reforçar com normalização explícita antes do `Set`.
4. **Ativação exige config completa**: UI só deixa marcar `ativa=true` se `produtos ≥ 1` E `segmentos ≥ 1` E `horarios ≥ 1` E `max_envios_dia > 0`.

---

## Ordem de aplicação (após seu OK)

1. **Bloco 1** (surfacing) — isolado, zero risco.
2. **Bloco 2** (dedup no modal) — só UI.
3. **Bloco 3.2** primeiro (enforcement backend) → deploy → depois 3.1/3.3/3.4 (UI) — assim a trava existe antes de qualquer autopilot ser criado.

## Não faço agora

Nada. Aguardo review linha a linha, especialmente:
- Existe `max_envios_dia` (ou similar) em `campanhas_recorrentes`? Se sim, evita migration.
- Confirmar que `useClientMenus` libera `clientes-segmentos` por default (ou aceitar diff 1.3).
- Você quer o Autopilot WhatsApp acessível também no menu lateral, ou só via botão no /meus-produtos?
