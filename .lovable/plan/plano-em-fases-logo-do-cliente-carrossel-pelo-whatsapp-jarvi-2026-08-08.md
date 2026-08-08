# Plano em fases — Logo do cliente + Carrossel pelo WhatsApp (JARVIS)

Nada será codificado ou publicado antes da sua aprovação. Depois de aprovado, executo a Fase 1 e mostro os diffs.

Regras transversais aplicadas em todas as fases: isolamento por `user_id` com RLS, nunca fallback para conta admin, aprovação sempre por botão de 1 toque, toda imagem enviada à Meta passa pelo conversor `media-para-meta`, todo envio registrado no monitor de conversas (`cloud-log.ts`), padrão CREATE TABLE → GRANT → RLS → policies, cor primária `#1a2332`. Reaproveitamos `gerar-carousel-content` e `meta-publish-carousel` sem mudar contrato.

---

## Resposta à pergunta da Fase 2 (decide o caminho)

**Sim — o modelo atual aceita imagem de referência e preserva a marca real.**

- Modelo em uso hoje no `gerar_imagem` do JARVIS: **`google/gemini-3.1-flash-image`** (Nano Banana 2), via gateway de IA no formato de chat.
- Esse mesmo modelo já é usado na tool `editar_imagem`, que **envia a foto do cliente como imagem de referência** junto do texto. Ou seja, a capacidade de entrada de imagem já está em produção e testada neste projeto.
- Portanto a logo pode entrar como **imagem de referência na própria geração** (não colada por cima), com instrução explícita de "reproduzir a marca exatamente como está, sem redesenhar, sem alterar cores, proporções ou tipografia".
- Ressalva honesta: fidelidade por referência é **muito alta, mas não é garantia matemática de pixel-perfect** — modelos generativos podem, em casos raros, suavizar um detalhe fino de tipografia. Se em teste a fidelidade não te satisfizer, o plano B é composição server-side (a logo real sobreposta em canto configurável), que é 100% fiel mas fica "aplicada" e não integrada à cena. Decisão: começamos pela referência (o que você pediu) e só recorremos ao plano B se o teste reprovar.

---

## FEATURE 1 — Logo do cliente nas imagens (fiel, incorporada, sob comando)

### Fase 1 — Infra da logo por tenant · esforço: baixo
O que muda: espelho exato do padrão do ebook, para a logo.
- Tabela `tenant_logos` (uma logo ativa por tenant, `user_id`, caminho no storage, nome do arquivo, ativo, timestamps) com GRANT + RLS + policies por `user_id`.
- Bucket privado `tenant-logos` com policies em `storage.objects` restritas à pasta do próprio `user_id`.
- Helper `supabase/functions/_shared/tenant-logo.ts`: busca a logo ativa do tenant e devolve os bytes/base64 prontos para uso. Sem logo → retorna vazio e nada é aplicado (nunca a logo de outro cliente).
- Tela de upload espelhando `EbookPresentePJ.tsx`: enviar, pré-visualizar, trocar e remover.

### Fase 2 — Incorporar a logo na geração, só quando pedido · esforço: médio
O que muda:
- `gerar_imagem` ganha o parâmetro **`incluir_logo` (padrão: false)**. Por padrão a imagem sai **sem logo**.
- O agente liga `incluir_logo` **apenas** quando o pedido é explícito ("põe a logo", "com a minha marca", "com logo"). Instrução correspondente na alma do agente.
- Quando ligado: busca a logo do tenant pelo helper da Fase 1 e envia a logo como **imagem de referência** na geração, com instrução de fidelidade total à marca.
- Se `incluir_logo` for pedido e o tenant não tiver logo: o JARVIS gera a imagem sem logo e avisa que basta cadastrar a marca na tela de configuração (com o link).
- Arquivos: `whatsapp-cloud-inbound-processor/index.ts` (tool + declaração), `_shared/agent-soul.ts` (regra de quando ligar), `_shared/tenant-logo.ts`.

### Fase 3 — JARVIS reconhece "essa é minha logo" · esforço: baixo/médio
O que muda:
- Quando o cliente manda uma imagem, o agente oferece por botão: **"É a logo da sua empresa?"** → `[Sim, é minha logo]` `[Não, é outra coisa]`.
- "Sim" → salva como logo ativa do tenant (Fase 1) e confirma. "Não" → segue o fluxo normal de análise de imagem já existente.
- Reaproveita o gate de botões/quick-reply e o padrão de tools que já existe no processador de entrada.
- Arquivos: `whatsapp-cloud-inbound-processor/index.ts`, `_shared/tenant-logo.ts`.

---

## FEATURE 2 — Carrossel pelo WhatsApp

### Fase 4 — Conteúdo + publicação via link · esforço: baixo/médio
O que muda:
- Nova tool `criar_carrossel`: "faz um carrossel sobre X" → chama `gerar-carousel-content` (sem mudança de contrato) → JARVIS envia no WhatsApp a legenda e o resumo dos slides + um **link** para o cliente abrir a tela de carrossel do app já preenchida e publicar com 1 clique.
- Tela de carrossel passa a aceitar o conteúdo vindo por parâmetro (pré-preenchida), sem alterar o gerador visual atual.
- **Sem renderizador server-side nesta fase.**
- Arquivos: `whatsapp-cloud-inbound-processor/index.ts`, tela/gerador de carrossel no app.

### Fase 5 — Renderizador server-side (futuro, não priorizar) · esforço: alto
O que muda: renderização dos slides no servidor (sem navegador) no padrão visual dos templates atuais, envio das imagens no WhatsApp para aprovação por botão e publicação no Instagram do tenant via `meta-publish-carousel`. Fica registrado como fase futura, a fazer só se a Fase 4 mostrar que vale.

---

## Riscos e dependências

| Risco | Mitigação |
| --- | --- |
| Fidelidade da logo por referência ficar abaixo do esperado | Teste real na Fase 2 com a sua marca; plano B de composição fiel se reprovar |
| Agente ligar a logo sem o usuário pedir | Padrão `false` + regra explícita na alma do agente + teste dos dois casos |
| Logo de um tenant aparecer em imagem de outro | RLS + bucket por `user_id` + ausência total de fallback |
| Imagem gerada recusada pela Meta por formato | Passagem obrigatória por `media-para-meta`, já em produção |
| Geração com referência estourar o tempo da função | Timeout já usado no fluxo de edição de imagem, com aviso ao usuário em caso de falha |

Dependências: Fase 2 e Fase 3 dependem da Fase 1. Fase 5 depende da Fase 4. Feature 1 e Feature 2 são independentes entre si.
