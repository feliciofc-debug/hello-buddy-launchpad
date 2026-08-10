# Dashboard do Cliente — "Veja o que sua IA fez por você"

## Parte 1 — Auditoria dos dados (o que existe DE VERDADE hoje)

### 1) Conversas atendidas pelo agente — ✅ TEM DADO
- `whatsapp_cloud_messages` (1.800 registros): `direction` (inbound/outbound), `sender` (agent / contact / campanha), `message_type`, `created_at`, `user_id`.
- `whatsapp_cloud_conversations` (57): 1 linha por contato, `last_message_at`.
- Dá para medir por dia/semana/mês, e separar atendimento humano/agente de campanha (`sender='campanha'`).

### 2) Leads captados — ⚠️ PARCIAL
- `jarvis_leads`: tabela nova, **0 registros** (acabou de entrar no ar; vai encher conforme o JARVIS atender desconhecidos).
- `tenant_ebook_entregas`: 4 (2 entregues, 2 recusados) — captação via ebook.
- `pj_lista_membros`: 1.095 contatos com `adicionado_em` → serve como "novos contatos no período".
- **Conclusão:** dá para montar o card usando novos contatos + entregas de ebook + leads do JARVIS. Volume ainda baixo — o estado vazio importa.

### 3) Taxa de qualificação — ✅ TEM DADO (volume baixo)
- `pj_lista_membros.opt_in_status`: pendente 1.051 · convite_enviado 40 · confirmado 2 · recusado 2. `convite_enviado_em` em 44 registros.
- Funil real = Convidados (44) → Responderam (4) → Qualificados (2). Números pequenos, mas verdadeiros.

### 4) Campanhas: enviados / entregues / lidos / respondidos — ⚠️ METADE FALTA RASTREAR
- **Enviados:** ✅ `historico_envios` (5.116 registros; 2.387 com `sucesso=true`), com `campanha_id`, `canal`, `template_id`, `message_id`, `erro`.
- **Entregues / Lidos:** ❌ **não são rastreados**. `whatsapp_bulk_sends.delivered_count` / `read_count` / `response_count` estão todos em **0** — o webhook de `statuses` da Meta não é persistido em lugar nenhum.
- **Respondidos:** 🟡 dá para **inferir** (inbound do contato depois de um envio de campanha), não é métrica gravada.
- **Decisão:** no dashboard mostro **Enviados / Falhas / Respostas (inferidas)** e deixo Entregues/Lidos de fora até existir o rastreio. Rastrear entregue/lido = trabalho separado (persistir `statuses` do webhook Meta em `historico_envios`), proposto como fase futura — não entra agora para não virar gráfico falso.

### 5) Posts publicados por rede — ✅ TEM DADO (o melhor volume)
- `social_posts_queue`: 7.991 publicados · 354 erro · 81 pendente · 288 cancelado. Por rede: Instagram 4.357 · Facebook 4.403 · TikTok 1.
- `tiktok_posts` (8) complementa o TikTok. `video_url` distingue reel/vídeo de imagem.

### 6) Conversas por hora/dia (atividade 24/7) — ✅ TEM DADO
- `whatsapp_cloud_messages.created_at` permite série por hora no fuso de São Paulo, com destaque de madrugada e fim de semana (já há atividade real às 23h, por exemplo).

**Resumo:** 4 das 6 métricas estão prontas; leads está pronto mas ainda enchendo; entregue/lido de campanha não existe e fica fora.

## Parte 2 — Proposta do dashboard (só com dado real)

Tela: rota `/dashboard` (arquivo `DashboardMetricas.tsx`), multi-tenant — toda consulta filtrada por `user_id` do usuário logado.

```text
┌──────────────────────────────────────────────────────────────┐
│ Bom dia, Felício! Veja o que sua IA fez por você             │
│                          [ Hoje | 7 dias | 30 dias ]  [ ☀/🌙 ]│
├──────────────┬──────────────┬──────────────┬─────────────────┤
│ Conversas    │ Leads        │ Qualificação │ Posts           │
│    128  ▲12% │    9   ▲3    │   45%  ▲5pp  │   214   ▲18%    │
├──────────────┴──────────────┴──────────────┴─────────────────┤
│ Sua IA trabalhou 24/7        (barras por hora, 0h→23h)       │
│ faixa madrugada destacada + "X% fora do horário comercial"   │
├───────────────────────────────┬──────────────────────────────┤
│ Funil de captação             │ Conteúdo nas redes           │
│ Convidados 44 ▸ Responderam 4 │ Instagram 4.357 · Face 4.403 │
│ ▸ Qualificados 2              │ TikTok 8 · (imagem vs vídeo) │
├───────────────────────────────┴──────────────────────────────┤
│ Campanhas recentes: nome · enviados · falhas · respostas     │
└──────────────────────────────────────────────────────────────┘
```

- **4 cards de destaque:** número grande + variação vs período anterior equivalente. Conversas atendidas · Leads captados · Taxa de qualificação · Posts publicados.
- **"Sua IA trabalhou 24/7":** gráfico de barras de conversas por hora (recharts), com a faixa 00h–06h destacada em laranja e uma frase-prova ("38% das conversas fora do horário comercial"). É o bloco principal da tela.
- **Funil de captação:** Convidados → Responderam → Qualificados, com percentual entre etapas.
- **Campanhas recentes:** últimas campanhas de `historico_envios` agrupadas por `campanha_id` — enviados, falhas e respostas inferidas. Sem colunas de entregue/lido enquanto não houver rastreio.
- **Conteúdo nas redes:** contagem por rede no período + divisão imagem/vídeo, e um aviso discreto se houver erros de publicação.
- **Estado vazio amigável** por bloco: "Sua IA está começando a trabalhar — os primeiros números aparecem aqui" com um atalho para a ação relevante (convidar contatos, criar campanha).
- **Responsivo:** cards 1 coluna no celular, gráficos com altura reduzida e scroll horizontal nas tabelas.

## Design

- **Tema claro como padrão.** Toggle claro/escuro no topo, preferência salva no navegador; o app abre sempre no claro para quem nunca escolheu.
- Fundo claro neutro, cards brancos, cantos arredondados, sombra suave, ícone por card.
- Laranja AMZ `#FF7A1A` como cor de destaque (números, barras, faixa de madrugada), verde para positivo e vermelho apenas para falhas.
- Gráficos recharts limpos: sem grade pesada, sem legenda redundante, tooltip simples.
- Saudação variando por horário (Bom dia / Boa tarde / Boa noite) + primeiro nome do perfil.

## Detalhes técnicos

- Um hook `useDashboardMetrics(period)` faz as consultas em paralelo e devolve tudo já agregado; período aplicado a todos os blocos, mais o período anterior para calcular variação.
- Consultas: `whatsapp_cloud_messages` (conversas/horas), `pj_lista_membros` (funil e novos contatos), `jarvis_leads` + `tenant_ebook_entregas` (leads), `historico_envios` (campanhas), `social_posts_queue` + `tiktok_posts` (redes). Todas com `.eq('user_id', user.id)`.
- Séries por hora convertidas para `America/Sao_Paulo` no cliente.
- Tema: `next-themes` (já instalado) com `defaultTheme="light"` e o `ThemeToggle` que já existe no projeto; tokens claros/escuros no `index.css`.
- Nenhuma mudança de backend, migração ou edge function nesta entrega.

## Fora do escopo (proposta futura)

Persistir os `statuses` do webhook da Meta (`delivered` / `read`) em `historico_envios` para desbloquear as colunas Entregues e Lidos das campanhas.
