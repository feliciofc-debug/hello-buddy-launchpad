
# Auditoria (respostas 1–5)

## 1) Extração → /contatoswhatsapp
Hoje **não existe uma extensão Chrome escrevendo direto no banco de segmentos**. O que existe:

- **`src/pages/ContatosWhatsApp.tsx`** (linhas 237–302): recebe **CSV/paste/xlsx** com nome+telefone e o usuário escolhe `destino='lista' | 'grupo'`.
  - `destino='lista'`: `INSERT` em `pj_listas_categoria` (nome = o que o usuário digita em `listName`, **não** o nome do grupo) + batch `INSERT` em `pj_lista_membros` (colunas `lista_id`, `nome`, `telefone`).
  - `destino='grupo'`: `INSERT` em `pj_grupos_whatsapp` com `grupo_jid = imported-${Date.now()}@g.us` (fake JID). **Não** grava membros no banco.
- **`src/components/pj/ImportContatosPJ.tsx`** (linhas 200–278): duplicata funcional do fluxo acima.
- **`supabase/functions/list-whatsapp-groups-pj/index.ts`**: sincroniza grupos reais via WuzAPI → `pj_grupos_whatsapp` (mas WuzAPI está deprecated por memória; provavelmente sem uso ativo).
- Extensões existentes (`extensao-importar-produtos`, `insert-produto-afiliado`, etc.) mexem em **produtos**, não em contatos/segmentos.

**Problemas identificados:**
- **Não é idempotente**: cada importação chama `INSERT` cru em `pj_listas_categoria` e `pj_lista_membros`. Reimportar o mesmo grupo cria uma segunda lista com mesmo nome + duplica membros.
- **Grupo importado não vira segmento**: quem escolhe `destino='grupo'` só cria row em `pj_grupos_whatsapp`, sem criar `pj_listas_categoria` correspondente — então o "menu de clientes segmentado" não vê esses contatos.
- **Nome do segmento** hoje é o que o usuário digita em `listName` (com fallback pro nome do arquivo). Não vem "pronto da extensão".

## 2) Menu de clientes (tela de segmentos)
- Rota: `/pj/listas` → `src/pages/pj/ListasContatosPJ.tsx` (9 linhas, wrapper) que renderiza **`src/components/pj/ContatosListasPJ.tsx`** (749 linhas).
- Lista `pj_listas_categoria` do user, expande membros de `pj_lista_membros`, permite CRUD manual. Não separa "listas geradas por extração" de "listas manuais".

## 3) Campanhas por segmento (Campanhas.tsx)
- **Já existe** seletor de segmentos: `src/components/CriarCampanhaWhatsAppModal.tsx` grava `pj_campanhas` com `produto_id` + `listas_ids[]` + `grupos_ids[]`.
- Disparo: chama edge function **`execute-campaign`** que é **queue-only** — expande as listas em `pj_lista_membros` e insere via RPC `inserir_campanha_fila` em `fila_atendimento_pj`. O gateway local (Baileys .exe) faz o envio real. Aqui a lógica de token não é multi-tenant Meta Cloud — é gateway local, então o problema "usar token do row" que a gente matou no `send-message` **não se aplica** a esse caminho.

## 4) Produtos → gerar campanha
- **`src/pages/MeusProdutos.tsx`**: já importa `CriarCampanhaWhatsAppModal` → **tem botão "Gerar campanha"** por produto (com produto_id e recorrência via `campanhas_recorrentes`).
- **`src/pages/AdminProdutos.tsx`**: **NÃO tem** gancho — é a tela admin, não do lojista. Faz sentido que o gancho fique em `MeusProdutos.tsx` (do PJ) e não em Admin.

## 5) Piloto automático
- Tabela `campanhas_recorrentes` existe e tem 0 rows ativas hoje.
- Função DB `process_scheduled_campaigns()` existe (migration `20260305161622`) e dispara a edge function `execute-campaign` via pg_net.
- Cron: `supabase/config.toml` declara `[functions.executar-campanhas-agendadas]` e a health-check monitora essa function. Não consegui confirmar `cron.job` pelo psql (schema privado); pela migration `20260205220617` a entry está em `edge_functions_health` como monitorada — assumindo que o pg_cron está agendado (a memória "Automated Health Monitoring" confirma pg_cron 5min ativo).
- **Como uma campanha vira recorrente hoje**: `MeusProdutos.tsx` linhas 934+ mostra que ao criar campanha pelo modal, o modal já grava em `campanhas_recorrentes` (produto_id, mensagem_template, listas_ids, ativa, status, dias_semana, horario_envio). A infra tá pronta; falta UX consistente e cobertura por segmento.

---

# Plano Fase 1 — Fundação (sem deploy)

Objetivo: garantir que **cada grupo importado vire um segmento (`pj_listas_categoria`) com membros vinculados de forma idempotente**, que **apareça no menu de clientes segmentado**, e que **Produtos consiga disparar por esse segmento** reaproveitando o modal existente.

## Diff 1 — Idempotência na extração/import (ContatosWhatsApp + ImportContatosPJ)

Trocar o `INSERT` cru por **upsert por (`user_id`, `nome`)** em `pj_listas_categoria` e **upsert por (`lista_id`, `telefone`)** em `pj_lista_membros`. Sem migração de tabela — usar `.upsert(..., { onConflict: 'user_id,nome' })` e `{ onConflict: 'lista_id,telefone' }`.

Pré-requisito silencioso: garantir que existem UNIQUE indexes:
- `pj_listas_categoria(user_id, nome)`
- `pj_lista_membros(lista_id, telefone)`

Se **não existirem**, uma migração Fase 1 curta cria os índices (é a única mudança de schema da fase). Antes de propor a migração eu confirmo no banco via `read_query` se os índices já estão lá.

**Efeito colateral**: reimportar o mesmo grupo/lista atualiza a lista existente e adiciona só os telefones novos. Contador `total_membros` recalculado por `count()` após o upsert (não por incremento cego).

## Diff 2 — Grupo importado também vira segmento

Em `ContatosWhatsApp.tsx` e `ImportContatosPJ.tsx`, quando `destino === 'grupo'`:
- Criar/upsert em `pj_grupos_whatsapp` (como hoje).
- **Adicionalmente** criar/upsert em `pj_listas_categoria` com o mesmo `nome` + `icone='👥'` + descrição `"Segmento espelho do grupo <nome>"`, e inserir membros em `pj_lista_membros`.
- Vantagem: qualquer coisa que "grupo real WhatsApp" e "lista importada" tenham em comum passa a viver no mesmo eixo — o segmento — sem duplicar disparo (o modal já separa `grupos_ids[]` de `listas_ids[]`, então o usuário escolhe qual canal).

## Diff 3 — Menu de clientes segmentado (ContatosListasPJ)

Adicionar 3 melhorias visuais/UX **sem mudar schema**:
- Chip "origem" no card: `📱 importado` / `👥 grupo espelho` / `✏️ manual` — inferido pela descrição/icone existentes.
- Filtro por origem no topo da lista.
- Botão "Disparar campanha deste segmento" em cada card → abre `CriarCampanhaWhatsAppModal` já com `listas_ids=[segmento.id]` pré-selecionado (o modal já aceita — só falta o entry point aqui).

## Diff 4 — Produtos (MeusProdutos) → "Disparar para segmento"

O botão "Gerar campanha" já existe. Adicionar:
- Dentro do modal (já é `CriarCampanhaWhatsAppModal`), garantir que o **primeiro passo** liste segmentos com contagem de membros e um filtro por nome/icone.
- Nada de fluxo novo de disparo: reaproveita 100% `execute-campaign` → `inserir_campanha_fila` (queue-only, gateway local). **Não toca em token Meta**, então zero risco do bug que a gente matou.

## Diff 5 — Auditoria de duplicatas em ContatosWhatsApp vs ImportContatosPJ

Os dois arquivos têm código quase idêntico. Fase 1 não consolida (fica pra refactor), só garante que os dois recebem o mesmo tratamento de idempotência pra não ficar um caminho quebrado e outro certo.

## O que NÃO entra na Fase 1
- Recorrência/piloto automático → Fase 2.
- Templates Meta Cloud/janela 24h → Fase 2 (aqui é gateway local, cru).
- Refactor consolidando os dois importadores.
- Extensão Chrome dedicada de contatos (não existe hoje; se o usuário quer que a "extensão" mande direto pro banco, é outra história — Fase 3, fora de escopo).

## Riscos e mitigação
- **UNIQUE index em `pj_lista_membros(lista_id, telefone)`**: se hoje existem duplicatas, o `CREATE UNIQUE INDEX` falha. Antes da migração vou rodar `read_query` pra contar `(lista_id, telefone)` duplicados. Se houver, a migração inclui um `DELETE` das duplicatas mantendo o `MIN(id)` antes do índice.
- **Multi-tenant**: todo `.upsert` continua com `.eq('user_id', user.id)` no filtro subsequente. As policies de `pj_listas_categoria` já escopam por `user_id`.
- **Disparo**: reaproveita `execute-campaign` (queue-only, local gateway) — não passa por Meta Cloud token, então **não regride** o fix do `send-message`/`inbound-processor`.

---

# Próximo passo

Aguardo seu OK explícito nesta Fase 1 antes de escrever qualquer código. Quando aprovar, eu:
1. Rodo `read_query` pra checar índices e duplicatas em `pj_lista_membros`.
2. Te mostro os **diffs prontos** dos 4 arquivos (`ContatosWhatsApp.tsx`, `ImportContatosPJ.tsx`, `ContatosListasPJ.tsx`, e — se necessário — uma migração curta só com os UNIQUE indexes) pra você revisar linha a linha.
3. Só depois do seu segundo OK, aplico. Sem deploy no meio.

Fase 2 (piloto automático de recorrentes + templates Meta) fica pra depois que a Fase 1 tiver rodado ao menos 1 ciclo em produção.
