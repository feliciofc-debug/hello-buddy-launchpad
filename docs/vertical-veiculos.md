# Vertical de veículos

Este documento é a referência obrigatória para qualquer mudança relacionada a
veículos. Automóveis não são produtos do catálogo geral.

## Limites da arquitetura

- A conta usa `profiles.tipo = empresa`, como os demais tenants empresariais.
- `empresa_config.segmento` define o tom e troca somente o menu `produtos` por
  `veiculos` quando o negócio é uma revenda de automóveis.
- O tipo legado `revenda_veiculos` continua aceito apenas por compatibilidade e
  recebe o mesmo menu de veículos.
- `public.veiculos_estoque` é o único estoque de veículos.
- A tabela `public.produtos` nunca recebe automóveis.
- O especialista de veículos do Jarvis, em
  `supabase/functions/_shared/vertical-vehicle`, lê somente
  `veiculos_estoque` e nunca lê produtos.
- O especialista geral lê somente produtos e nunca lê `veiculos_estoque`.
- A memória e os estados de conversa das duas verticais permanecem separados.
- FIPE, anúncio, carrossel, identificação por foto e repasse continuam na
  vertical de veículos existente.

## Convenção de nomes

- Banco, rotas e telas em português começam com `veiculos_`.
- Módulos de código em inglês começam com `vehicle-`.
- Não criar nomes genéricos que possam misturar veículos e produtos.

## Tipo, menu e segmento

| Conceito | Responsabilidade |
| --- | --- |
| `profiles.tipo = empresa` | Identifica a conta como tenant empresarial |
| `client_menu_config` | Define os menus-base da plataforma |
| `empresa_config.segmento` | Define voz e troca Produtos por Veículos para revendas |
| `profiles.tipo = revenda_veiculos` | Compatibilidade com contas legadas |
| `veiculos_estoque` | Guarda a ficha e as fotos dos veículos do tenant |

## Build de produção do front

Versão validada: Node.js `22.14.0` e npm `10.9.7`.

Na raiz do projeto:

```bash
npm ci
npm run build
install -d /opt/amz-front/dist
rsync -a --delete dist/ /opt/amz-front/dist/
```

O Supabase e o armazenamento são configurados em `public/config.json` em tempo
de execução. As variáveis `VITE_*` lidas pelo front são opcionais e têm estes
nomes (nunca registrar seus valores neste documento):

- `VITE_TIKTOK_ENV`
- `VITE_WUZAPI_URL`
- `VITE_WUZAPI_TOKEN`
- `VITE_WUZAPI_INSTANCE_ID`

## Vitrine WhatsApp (cliente final — estoque)

Fluxo tipo Magalu para quem **pergunta explicitamente** por carros no WhatsApp.
Dados **somente** de `veiculos_estoque`; nunca `produtos`.

### Quem pode usar a vitrine

| Modo | Condição |
| --- | --- |
| Revenda (produção) | `empresa_config.segmento` = revenda de automóveis (ou equivalente já usado no front) |
| Demonstração | `empresa_config.vitrine_veiculos_demo = true` em **uma conta específica** (ativada por SQL; sem tela no painel) |

Migration idempotente (no LOTE da vitrine):  
`ALTER TABLE public.empresa_config ADD COLUMN IF NOT EXISTS vitrine_veiculos_demo BOOLEAN NOT NULL DEFAULT false;`

Ativação manual (exemplo):

```sql
UPDATE public.empresa_config
SET vitrine_veiculos_demo = true
WHERE user_id = '<uuid-do-tenant>';
```

### Chave de demonstração (comportamento)

Com `vitrine_veiculos_demo = true`:

1. **Só** mensagens com **intenção explícita de ver estoque** entram na vitrine
   (lista de marcas → carrossel por marca). Exemplos de gatilho (normalizar acento/caixa):
   - “ver carros”, “quero ver os carros”, “estoque de veículos”, “carros disponíveis”,
     “o que tem na loja”, “mostrar veículos”.
2. **Qualquer outra mensagem** (FIPE, anúncio, foto, produto, saudação, dúvida geral)
   segue o **fluxo atual do Jarvis**, sem roteamento para vitrine, sem mudar prompts
   ou tools existentes.

Com `vitrine_veiculos_demo = false` (default): contas fora do segmento revenda
**nunca** entram na vitrine.

Implementação sugerida: função pura `isExplicitVehicleShowcaseRequest(text)` +
`shouldOfferVehicleShowcase(tenant)` → `(segmento revenda OR vitrine_veiculos_demo)`.
Checar **antes** de desviar o processor; se falso, `return` cedo e não alterar estado.

### Fluxo da vitrine (sem etapa de modelos)

1. Lista de **marcas** (só marcas com veículos `disponivel` no tenant).
2. Cliente escolhe a marca → enviar **todos** os carros da marca em **carrossel
   interativo** Cloud API (`interactive` carousel): card = foto principal + texto
   (marca/modelo/versão, ano, km, câmbio, cor, preço) + 2 quick_reply:
   `[📋 Ver detalhes]` · `[💬 Tenho interesse]`.
3. Se houver mais carros que o limite de cards por mensagem, blocos + botão
   **Ver mais carros**.
4. **Ver detalhes** → galeria de fotos + lista “Detalhes do veículo”; rótulo
   **Voltar às marcas** (não “Voltar aos modelos”).
5. **Tenho interesse** → handoff/consultor (fluxo de lead já existente).

Limites e fallback: validar na [documentação oficial Meta](https://developers.facebook.com/docs/whatsapp/cloud-api/messages/interactive-media-carousel-messages)
(2–10 cards, corpo da mensagem até 1024 chars, corpo do card até 160 chars,
janela de 24h para mensagens de sessão). **Implementação:** tentar carrossel com
2× `quick_reply` por card; se a Graph API responder **4xx**, cair **no mesmo turno**
para card individual (imagem + 3 botões) **sem** depender de teste manual em sandbox;
registrar `[vehicle-vitrine][carousel_rejected]` com status/código/subcódigo Meta.

---

## Plano de implementação (LOTE vitrine — sem código ainda)

Referência de linhas no commit atual da branch (`whatsapp-cloud-inbound-processor/index.ts`);
podem variar algumas linhas após outros merges — usar busca por símbolos abaixo.

### a) Onde o desvio entra no processor e isolamento de tenants

| Item | Detalhe |
| --- | --- |
| **Função** | `processOne(queueId)` — handler principal de cada item da fila (`~22371`). |
| **Ponto de encaixe** | **Depois** do bloco Meta Ads (`processMetaAdsQuestionario` / `~25919–26051`) e **antes** de montar o prompt gigante do Gemini (`systemPromptWithDate`, `~26079`) e **antes** de `callGemini` (`~26124`). Mesmo padrão do `metaAdsQuestionarioResult.handled`: se a vitrine resolver o turno, **não** chama IA (economiza quota e evita prompt drift). |
| **Chamada planejada** | `processVehicleStockShowcaseTurn({ sb, userId, conv, convStateIdentity, row, userText, audioTranscript, media, agentState, tenantFlags })` em módulo novo `_shared/vehicle-stock-whatsapp.ts`. Retorno `{ handled, text?, interactiveButtons?, interactiveList?, imageUrl?, ... }`. |
| **Pré-condições (todas)** | `fromIsOwner === false`; conversa não em `handoff`; inbound dentro da janela 24h (já validado em `~23018–23025`); `shouldOfferVehicleShowcase(tenantFlags) === true`. |
| **Entrada na vitrine** | (1) `<<INTERACTIVE_ID:veiculo_vitrine:...>>` / toque em botão **ou** (2) `isExplicitVehicleShowcaseRequest(texto, flags)`. `pending_vitrine_estoque` **não** captura texto livre (Jarvis responde follow-ups como “posso ir amanhã?”). Demo não automotiva: sem gatilhos genéricos (“o que tem na loja”, “ver o estoque”). |
| **Onde NÃO entra** | Ramo `fromIsOwner` (`~23180+` mídia/FIPE/anúncio/carrossel de marketing), opt-in gate (`~22534+`), atalhos determinísticos já existentes (nearby `~22958`, status AMZ `~22922`), agrupamento de texto de lead (`~22892`). |

**Por que contas sem segmento automotivo e sem `vitrine_veiculos_demo` ficam 100% idênticas**

1. `shouldOfferVehicleShowcase` é a **primeira** linha dentro do handler de vitrine: consulta `empresa_config.segmento` + `vitrine_veiculos_demo` (via helper dedicado, ex.: `loadVehicleShowcaseTenantFlags`, estendendo a leitura que hoje só existe em `tenantVerticalSegment` `~3474` para o **dono**).
2. Se `(NOT isAutomotiveTenant(segmento)) AND (NOT vitrine_veiculos_demo)` → `return { handled: false }` **sem** `saveAgentState`, **sem** envio WhatsApp, **sem** alterar `resolveVertical` / tools / prompts.
3. Nenhum import novo executa lógica no top-level do processor; só a chamada condicional após as flags.
4. IDs interativos `veiculo_vitrine:*` só são interpretados quando já há pending ou o tenant passou no gate — evita efeito colateral em outros fluxos.

### b) Estado da navegação (marca, offset, veículo atual)

| Item | Detalhe |
| --- | --- |
| **Persistência** | Coluna **existente** `whatsapp_cloud_conversations.agent_state` (JSONB), via `loadAgentState` / `saveAgentState` (`~3349–3388`). **Sem** tabela nova de sessão. |
| **Chave** | `agent_state.vehicle.pending_vitrine_estoque` (namespace `vehicle`, alinhado a `AgentConvState.vehicle` `~3179` e `VEHICLE_STATE_KEYS` em `vertical-router.ts`). |
| **Formato (contrato)** | `{ stage: "marcas" \| "carrossel" \| "detalhe" \| "handoff"; marca?: string; offset: number; veiculo_id?: string; updated_at: string }`. TTL de continuação: reutilizar janela de pending vertical (`PENDING_VERTICAL_TTL_MS`, 30 min) ou limpar pending ao expirar. |
| **Migration** | **Apenas** `empresa_config.vitrine_veiculos_demo BOOLEAN NOT NULL DEFAULT false` (idempotente, no mesmo arquivo de migration do LOTE). **Não** migration para estado de conversa. |
| **Limpeza** | Comando explícito do cliente (“sair”, “voltar pro atendimento”) ou conclusão de handoff → `pending_vitrine_estoque: null`. |

### c) Colunas reais de `veiculos_estoque` por superfície

Fonte: migration `20261014135000_vehicle_inventory_vertical.sql` (+ colunas de marketing Fase 2 **fora** do escopo da vitrine).

| Superfície | Colunas usadas |
| --- | --- |
| **Card do carrossel / listagem** | `fotos[0]` (imagem; fallback texto se vazio), `marca`, `modelo`, `versao`, `ano_fabricacao`, `ano_modelo`, `km`, `cambio`, `cor`, `preco`, `id` (só em IDs interativos, não no texto). |
| **Ficha “Detalhes do veículo”** | Tudo do card, mais: `combustivel`, `portas`, `blindado`, `nivel_blindagem`, `opcionais`, `caracteristicas`, `descricao`, `status` (mostrar só se ≠ `disponivel` quando relevante). |
| **Procedência** | **Somente campos existentes:** `origem` (texto livre cadastrado na importação/manual) e `url_origem` (link da fonte). Se ambos vazios, **omitir** bloco de procedência — não inventar coluna. |
| **Filtro de estoque** | `user_id` = tenant, `status = 'disponivel'`. Ordenação sugerida: `destaque DESC`, `updated_at DESC`, `preco ASC`. |

### d) Handoff “Tenho interesse” e “Falar com consultor”

Reutilizar o mecanismo **já usado** quando o Jarvis encaminha recado ao dono (não FIPE, não `registrar_lead_novo` genérico AMZ, não campanha).

| Ação do cliente | Mecanismo | Persistência / aviso |
| --- | --- | --- |
| **Tenho interesse** (carrossel ou detalhe) | Montar recado estruturado (≥15 chars) com nome do contato (`whatsapp_cloud_conversations.contact_name` se houver), telefone, **marca/modelo/versão**, ano, km, preço, `veiculo_id`, trecho “Cliente pediu contato sobre este veículo (vitrine estoque)”. Chamar **`toolEncaminharRecadoAoDono`** (`~13514`) — envia WhatsApp ao `owner_phone` via **`sendWhatsApp`** e grava **`registrarLeadEncaminhamento`** (`~3667`) em **`lead_encaminhamentos`**. | Comprovante em `agent_state.forward` (fluxo existente `~26052+`). Resposta ao cliente com protocolo no turno (mesma regra `enforceForwardTruth`). |
| **Falar com consultor** (botão extra no fallback de card individual ou rodapé da ficha) | **Mesmo pipeline** com texto de recado diferenciado (“Cliente pediu falar com consultor humano” + contexto do veículo/marca se houver). | Idem `lead_encaminhamentos` + `forward`. |
| **Lead CRM opcional** | Se já existir `nome` no contato, **opcional** upsert em `cadastros` / notas — **não** bloquear handoff por falta de `ramo` (diferente de `toolRegistrarLeadNovo` `~13614`, que exige nome+ramo). | Preferir encaminhamento imediato ao dono. |

Após handoff bem-sucedido: `stage: "handoff"`, limpar ou manter pending conforme UX (“Voltar às marcas” só se o cliente pedir nova navegação).

### e) Carrossel Meta: 2 quick_reply + fallback automático

1. **Envio primário:** payload `interactive.type = "carousel"` (Cloud API v25, alinhado a `whatsapp-send-message`) com até N cards (`fotos[0]` + body ≤160 chars) e **2 botões reply/card**: `veiculo_vitrine:detalhe:<uuid>`, `veiculo_vitrine:interesse:<uuid>`.
2. **Paginação:** corpo da mensagem + botão/lista **Ver mais carros** (`veiculo_vitrine:mais:<marca>:<offset>`).
3. **Fallback (obrigatório no código):** se `fetch` Graph retornar **HTTP 4xx** (ou corpo Meta `error` em resposta 200 inválida), log estruturado e **reenviar no mesmo turno** para o veículo (ou lote) via **`interactive_buttons`** já suportado (`whatsapp-send-message` `~124`) — imagem + 3 botões: **Fotos** / **Detalhes** / **Tenho interesse** (+ **Falar com consultor** só se couber no limite de 3; senão “Tenho interesse” cobre consultor).
4. **Extensão de envio:** adicionar ramo carousel em `whatsapp-send-message/index.ts` (hoje só `button`, `list`, mídia — `~124–183`) **ou** helper interno `sendWhatsappCarouselWithFallback` chamado pela edge existente.

### f) Arquivos, testes estáticos e riscos

**Arquivos (lista exata prevista)**

| Arquivo | Ação |
| --- | --- |
| `supabase/migrations/*_vitrine_veiculos_demo.sql` | Nova coluna `empresa_config.vitrine_veiculos_demo` |
| `supabase/functions/_shared/vehicle-stock-whatsapp.ts` | Lógica pura: flags tenant, intents, queries, payloads, máquina de estados, montagem de recado |
| `supabase/functions/_shared/vehicle-stock-whatsapp.test.ts` | Intents, formatação de card/ficha, IDs, fallback decision (mock), gate demo vs revenda |
| `supabase/functions/_shared/vertical-router.ts` | Incluir `pending_vitrine_estoque` em `VEHICLE_STATE_KEYS`; regex de botão `veiculo_vitrine` se necessário |
| `supabase/functions/whatsapp-send-message/index.ts` | Suporte envio carousel + hook de fallback |
| `supabase/functions/whatsapp-cloud-inbound-processor/index.ts` | Import + chamada `~26051`; branch `handled` junto a `metaAdsQuestionarioResult` `~26114–26122`; helper `loadVehicleShowcaseTenantFlags` |
| `docs/vertical-veiculos.md` | Este plano (mantido atualizado) |

**Testes (raiz do repositório)**

```bash
deno test --no-check -A supabase/functions/_shared/
```

Suítes novas: `vehicle-stock-whatsapp.test.ts`. Regressão esperada: `vertical-router.test.ts`, `whatsapp-text-interactive.test.ts`, `whatsapp-media-buttons.test.ts`, `vehicle-inventory-migration.test.ts`.

**Riscos para o atendimento atual**

| Risco | Mitigação |
| --- | --- |
| Cliente automotivo recebe vitrine quando queria FIPE/anúncio | Vitrine só com intent explícito de **estoque** (`isExplicitVehicleShowcaseRequest`); não reutilizar regex de `explicitVerticalIntent` “carrossel+ carro” (`vertical-router.ts` `~125`) para **clientes** — lista de gatilhos separada. |
| Conta demo ativa desvia conversas indevidas | Demo exige intent explícita; default `vitrine_veiculos_demo = false`. |
| Carrossel Meta rejeitado | Fallback automático 4xx → card+botões; log para monitoramento. |
| Quota IA | Turnos `handled` pela vitrine não chamam `callGemini`. |
| Colisão de IDs interativos | Prefixo fixo `veiculo_vitrine:` distinto de `vehicle_*` (dono) e `meta_ads_q:`. |
| Dono / produtos / FIPE | Gate `fromIsOwner`; zero mudança no ramo dono. |
| Performance | Queries indexadas (`idx_veiculos_estoque_user_status`, `user_marca_modelo`); paginar carrossel. |

### Demonstração (como testar)

O processor trata mensagens do **dono** (`owner_phone`) com fluxos de FIPE, anúncio,
carrossel de marketing etc. A vitrine WhatsApp de estoque é **somente para clientes**
(`fromIsOwner === false`). Para validar a demo (`vitrine_veiculos_demo` ou segmento
revenda), use **outro celular** (não cadastrado como dono) e envie intent explícita
(ex.: “ver carros”) ou toque nos botões `veiculo_vitrine:*`.

### Áreas travadas

FIPE, anúncio/captions, edição de imagem, vídeo e Autopilot de produtos permanecem
como hoje; a vitrine não substitui esses fluxos.
