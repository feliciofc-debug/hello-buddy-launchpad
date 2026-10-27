# PLANO-MENU — menu de serviços do Jarvis no WhatsApp

## 0. Escopo, base e regras que não podem mudar

- Base auditada: `cursor/doc-1-5618` no commit de produção
  `7db2991e72c16f6d97345a1d30579fa02dbb17bf`.
- Fonte do AJUDA-1: commit `9dafe190a9f31bd17b0aa9045cceb8b0715aeb7b`,
  cujo pai é `ed1dc8e5181a0b15a177e33fae6bc66337a79903`.
- O AJUDA-1 não deve ser mesclado inteiro: ele divergiu antes de 31 commits de
  produção, entre eles documentos/cofre, Molicar, procedência e Webmotors. Só o
  diff lógico do catálogo/cartilha deve ser reaplicado sobre a produção.
- Este documento não propõe acesso à VPS. Implementação, testes e desligamento
  ficam no app, Edge Functions e banco já usados pelo produto.
- Clientes e parceiros nunca recebem este menu. Dono é reconhecido pelos
  telefones do tenant; gestor, por `loadGestaoAuthContext` e
  `isGestaoAuthorizedPhone`. Vendedor fica excluído por padrão e só entra com
  uma flag própria, ainda desligada.
- Nenhum clique pode pular um fluxo pendente. Cotação de parceiro, cofre de
  documentos, mídia/foto, Gestão, Meta Ads e vitrine continuam tendo
  precedência.
- A flag proposta é por loja: `jarvis_menu_whatsapp_enabled`. Ela nasce
  desligada. No piloto, somente o `user_id` da AMZ fica ligado. A flag separada
  `jarvis_menu_vendedor_enabled` nasce e permanece desligada.

## 1. Mapa real do processor e ponto de entrada

Arquivo central:
`supabase/functions/whatsapp-cloud-inbound-processor/index.ts`.

### 1.1 Como a saudação é tratada hoje

Não existe hoje um handler determinístico de saudação do dono/gestor.
`oi`, `bom dia`, `oi jarvis` e `menu`:

1. são gravados como inbound em `processOne`;
2. passam pelos atalhos determinísticos;
3. alimentam `buildSystemPrompt` (inclusive `agent.greeting`);
4. se nenhum atalho consumir o turno, chegam a `callGemini` no PASSO 9.

Logo, a resposta atual é texto livre do LLM. `agent.greeting` é contexto do
prompt, não uma rota de menu. Em erro, cai no fallback genérico próximo de
`[processor][ai_fallback]`.

### 1.2 Ordem atual relevante

| Ordem | Fluxo atual | Ponto/caminho |
|---|---|---|
| 1 | Resolve tenant, dono e gestores | `processOne`, `resolveTenantOwner`, `setTenantOwnerForCtx`, `loadGestaoAuthContext` |
| 2 | Limpa pendência de foto-documento do dono | `sanitizeDocumentPhotoPending`, antes dos atalhos |
| 3 | Ações pendentes do cofre | IDs `cofre_possivel_*` e `cofre_doc_*` |
| 4 | Gestão do gestor, texto/interativo | `tryProcessGestaoLucroShortcut` e `tryProcessGestaoTrocaWhatsAppShortcut` |
| 5 | Cotação do parceiro, texto/interativo | `tryProcessOsParceiroCotacaoWhatsAppShortcut` |
| 6 | Vitrine do cliente, interativo/formulário pendente | `tryProcessVehicleStockShowcase` (early) |
| 7 | Opt-in, agrupamento de lead e status comercial | gate de opt-in e `answerOwnerCommercialStatus` |
| 8 | Gestão/troca/estoque do dono, texto | `tryProcessGestaoLucroShortcut`, `tryProcessGestaoTrocaWhatsAppShortcut`, `tryProcessOwnerVehicleStockShortcut` |
| 9 | Download da mídia | PASSO 6.7 |
| 10 | Cotação do parceiro com mídia | `tryProcessOsParceiroCotacaoWhatsAppShortcut` com `isProtectedDocument` |
| 11 | Portão de documentos | `verificarDocumentoNoPortao`, `gestaoCofreUpload`; falha fecha o fluxo |
| 12 | Gestão/estoque por áudio transcrito | os mesmos shortcuts, agora com `audioTranscript` |
| 13 | Cotação do parceiro por áudio | shortcut de parceiro após STT |
| 14 | Vitrine pendente por áudio | `tryProcessVehicleStockShowcase` (post-audio) |
| 15 | Foto/vídeo novo, inclusive foto do dono | bloco `freshLibraryMedia`; roteador vertical e fluxos de foto retornam antes do LLM |
| 16 | Fluxos pendentes e documentos não capturados antes | vídeo legendado, handoff, leitura/comentário de documento |
| 17 | Estado vertical e questionário Meta Ads | `verticalChoiceResolution` e `processMetaAdsQuestionario` |
| 18 | Vitrine cliente por texto livre | `tryProcessVehicleStockShowcase` (late) |
| 19 | IA genérica | `callGemini` |

### 1.3 Ponto exato proposto para o menu

Inserir uma chamada pequena, por exemplo `tryProcessJarvisServiceMenu`, **depois
da vitrine late** e **antes da montagem final de estado/prompt e de
`callGemini`**. A chamada só pode rodar se:

- não há mídia nova;
- a mensagem é texto, botão/lista do próprio menu ou áudio já transcrito;
- nenhum fluxo anterior consumiu o turno;
- não existe pendência prioritária ativa (documento, cotação, Gestão, foto,
  publicação, campanha, FIPE, troca ou vitrine);
- o remetente é dono, ou está em `gestores`; vendedor exige sua flag;
- a flag da loja está ligada;
- a entrada é saudação pura/comando de menu ou um ID `jarvis_menu:*`.

Esse ponto preserva explicitamente a precedência pedida:

```text
cotação/parceiro
  → portão de documentos
  → foto/mídia do dono
  → gestão-intent
  → vitrine cliente
  → menu (somente dono/gestor autorizado)
  → LLM genérico
```

O menu não deve ser colocado perto de `extractText` nem antes dos shortcuts:
isso faria `bom dia` de parceiro, resposta de formulário ou botão antigo virar
menu. O guard de audiência precisa ser positivo (`owner || gestor`), nunca
apenas `!cliente`.

## 2. Inventário real do que existe hoje

Legenda: **WhatsApp** = há rota executável hoje; **painel** = existe no produto,
mas não há comando WhatsApp seguro equivalente; **parcial** = há apenas parte
do fluxo.

### 2.1 Marketing

| Serviço | Canal real | Caminho no código |
|---|---|---|
| Facebook feed/story | WhatsApp | `toolPostarMidiaBiblioteca`, `toolPostarRedesSociais`, `publicarEmRede` no processor |
| Instagram feed/story/reels | WhatsApp | mesmas funções; Edge Functions `meta-publish-instagram`, `meta-publish-story-image`, `meta-publish-video` |
| TikTok | WhatsApp, somente vídeo | `toolPostarMidiaBiblioteca`, `tiktok-whatsapp-consent.ts`, Edge `tiktok-post-content` |
| LinkedIn | WhatsApp | `toolPrepararLinkedin`, `publicarEmRede`, Edge `linkedin-publish` |
| Agendar e listar posts | WhatsApp | `toolAgendarPostPendente`, `toolListarAgendamentosPosts`; cancelar/remarcar no mesmo processor |
| Criar arte de anúncio | WhatsApp | `toolCriarAnuncio`; templates em `_shared/anuncio-templates/` |
| Criar/editar imagem livre | WhatsApp | `toolGerarImagem`, `toolEditarImagem` |
| Criar carrossel | WhatsApp, publicação só Instagram | `toolCriarCarrossel`; render e estado no processor e `_shared/carousel-*.ts` |
| Criar vídeo animado | WhatsApp | tool `criar_video_animado`; `_shared/video-motion*.ts` |
| Criar campanha Meta Ads | WhatsApp | `meta-ads-questionario.ts`, `toolRascunhoAnuncioMeta`, `toolPublicarAnuncioMeta` |
| Resultado/status Meta Ads | WhatsApp | `toolRelatorioAnunciosMeta`, `toolAlterarStatusCampanhaMeta` |
| Mercado Livre | painel | `ml-vehicle-*-run.ts` e telas de integrações; não há tool no processor |
| OLX | painel | `olx-vehicle-*-run.ts`, `olx-*` Edge Functions; não há tool WhatsApp |
| Webmotors | painel | `webmotors-vehicle-*-run.ts`, Edge Functions e componentes Webmotors; não há tool WhatsApp |

Restrições que o catálogo deve dizer: TikTok não aceita foto; story ainda não
é agendável pelo WhatsApp; carrossel WhatsApp publica só no Instagram; ações de
publicação atuais usam `isOwner` e não devem ser abertas a gestor por acidente.

### 2.2 Gestão

| Grupo/serviço | Canal real | Caminho no código |
|---|---|---|
| Fechamento e urgentes | parcial/WhatsApp automático | `_shared/gestao-fechamento-dia.ts`, `_shared/giro-resumo-diario-run.ts`, `gestao-fechamento-dia/index.ts`; o pedido manual completo só chega com AJUDA-1 |
| Resumo/busca/vendidos do estoque | WhatsApp | `_shared/vehicle-stock-owner-handler.ts`, `_shared/vehicle-stock-owner-inbound.ts` |
| Lucro/despesas por veículo; giro | WhatsApp | `_shared/gestao-inbound.ts`, `gestao-intent-pt.ts`, `estoque-giro-*.ts` |
| Registrar compra, venda e despesa; desfazer | WhatsApp com confirmação | `_shared/gestao-inbound.ts` |
| Raio-X e piores negócios | WhatsApp | `_shared/gestao-inbound.ts`, `gestao-venda-raio-x.ts` |
| DRE, lucro, contas, recebíveis e conciliação | WhatsApp | `_shared/gestao-inbound.ts`, `gestao-financeiro-inbound.ts`, `gestao-dre-whatsapp.ts` |
| Ranking, vendedor e comissões | WhatsApp | `_shared/gestao-inbound.ts`, `gestao-equipe-inbound.ts` |
| NF-e e contratos | WhatsApp | `_shared/gestao-inbound.ts`, `gestao-nfe-inbound.ts`, `gestao-contrato-inbound.ts` |
| OS e cotações para o dono | painel | Gestão/Operações; `_shared/os-parceiro-*.ts` cobre a resposta do parceiro, não a operação completa do dono por WhatsApp |
| Cofre/documentos recebidos | WhatsApp para guardar/ler CRLV | portão no processor, `_shared/documento-portao.ts`, `gestao-cofre-upload.ts` |
| Consultar/organizar documentos | painel | Gestão/Cofre/Pasta digital; sem listagem geral segura no WhatsApp |
| Contatos comerciais | WhatsApp | `toolListarContatosComerciais`, `toolEnviarMensagemContatoComercial` |
| Contagens de clientes/leads | WhatsApp | `toolConsultarClientesLeads` |
| CRM detalhado e follow-up | painel | páginas de contatos/leads; WhatsApp não oferece a mesma gestão completa |

### 2.3 Vistoria e troca

| Serviço | Canal real | Caminho no código |
|---|---|---|
| Nova vistoria/troca do dono | painel | `vehicle-post-fipe-menu.ts` orienta Gestão › Trocas; `GestaoTrocasPage.tsx` e `GestaoTrocaFichaPage.tsx` |
| Troca iniciada por cliente da vitrine | WhatsApp cliente, não menu interno | `vehicle-stock-showcase-turn.ts`, `vehicle-stock-troca.ts` |
| Trocas avaliadas, resumo, fotos e laudo PDF | WhatsApp | `_shared/gestao-troca-whatsapp.ts` |
| Preço de troca Molicar | painel | `MolicarPriceCard.tsx`, `useMolicarConsulta.ts`, `molicar-*` Edge/shared |
| Procedência veicular | WhatsApp | `_shared/veiculo-procedencia-inbound.ts`, chamado antes dos intents de Gestão |
| Procedência anexada à troca | painel | componentes `GestaoTrocaProcedencia*` e serviços Molicar/procedência |
| Liberar troca para estoque | painel | `_shared/gestao-troca-ops.ts::liberarTrocaParaEstoque`, chamado por `gestao-troca/index.ts` |

Conclusão de inventário: o menu pode expor tudo, mas itens sem rota WhatsApp
devem abrir/informar o **painel**. Não se deve cadastrar uma tool fictícia para
fazer o catálogo parecer completo.

## 3. Fonte única: evolução segura do catálogo AJUDA-1

O arquivo novo do AJUDA-1,
`supabase/functions/_shared/jarvis-ajuda-catalogo.ts`, deve virar a única fonte
de menu e ajuda. Além dos campos já existentes, cada item terá:

```text
menu.parentId
menu.title
menu.description
menu.order
menu.audiences[]          owner | manager | seller
menu.channel              whatsapp | panel
menu.recentEligible
menu.availability         conexão/segmento/flag necessários
route                     handler/tool existente ou rota autenticada do painel
```

Não haverá arrays paralelos no processor. O renderer recebe itens filtrados do
catálogo e gera botões/listas. IDs interativos levam somente o `item.id`
(`jarvis_menu:item:<id>`); a resolução volta ao catálogo antes de executar.

Teste de contrato obrigatório para cada item:

1. título tem no máximo 24 caracteres e descrição, 72;
2. pai existe, ID é único e cada lista tem no máximo 10 linhas após recentes;
3. item `whatsapp` aponta para um handler/tool registrado e autorizado;
4. fixture executa esse handler e verifica efeito/resposta, não só presença de
   texto;
5. item `panel` aponta para uma rota existente e nunca é anunciado como ação
   feita no WhatsApp;
6. catálogo, ajuda textual/PDF e menu renderizam os mesmos IDs.

O AJUDA-1 atual precisa de correções na portabilidade: em revenda,
`consultar_estoque` deve respeitar o desvio para
`toolConsultarEstoqueVeiculos`; fechamento deve usar a versão de produção do
builder; Molicar/Webmotors/documentos não podem ser substituídos pelos arquivos
antigos da base do AJUDA-1.

## 4. Árvore final

Todos os títulos abaixo respeitam 24 caracteres e todas as descrições, 72. As
duas linhas “Usado recentemente” são slots dinâmicos adicionados no B7 e contam
no limite de 10.

### 4.1 Abertura

Texto:

```text
Bom dia, <primeiro nome>.
Hoje: <resumo de uma linha derivado do fechamento>.
⚠️ <n> urgente(s) para decidir hoje.       [somente se n > 0]

Ou me diga (ou mande um áudio) o que precisa.
```

Botões:

1. `📣 Marketing`
2. `📊 Gestão`
3. `🔍 Vistoria e Troca`

Saudação: bom dia antes de 12h, boa tarde antes de 18h e boa noite a partir de
18h, sempre em `America/Sao_Paulo`. O resumo usa `dados` de
`buildGestaoFechamentoDia`, não texto gerado por IA. O ⚠️ usa `dados.acoes`; sem
ações, a linha inteira some.

### 4.2 Lista Marketing

| Título | Descrição |
|---|---|
| Usado recentemente 1 | Última ação de Marketing usada neste WhatsApp. |
| Usado recentemente 2 | Segunda ação recente de Marketing. |
| Postar nas redes › | Facebook, Instagram, TikTok e LinkedIn. |
| Criar arte de anúncio | Monte uma arte com foto, dados e identidade da loja. |
| Criar carrossel | Gere cards e aprove antes de publicar no Instagram. |
| Criar vídeo | Crie um vídeo animado com roteiro aprovado. |
| Campanha Meta Ads | Monte, revise e confirme uma campanha patrocinada. |
| Resultado campanhas | Veja gasto, alcance e situação dos anúncios Meta. |
| Portais de veículos › | Mercado Livre, OLX e Webmotors pelo painel. |
| Ajuda de Marketing | Veja exemplos de pedidos e limites de cada serviço. |

#### Postar nas redes

| Título | Descrição |
|---|---|
| Usado recentemente 1 | Atalho recente desta lista. |
| Usado recentemente 2 | Segundo atalho recente desta lista. |
| Facebook | Publique foto ou vídeo no feed ou story. |
| Instagram feed | Publique foto, vídeo ou carrossel no feed. |
| Instagram story | Publique foto ou vídeo vertical no story. |
| TikTok | Publique vídeo após privacidade e consentimento. |
| LinkedIn | Prepare texto, foto ou vídeo em tom profissional. |
| Agendar publicação | Agende um criativo aprovado; story fica no painel. |
| Meus agendamentos | Liste, remarque ou cancele posts futuros. |
| Voltar a Marketing | Retorne à lista principal de Marketing. |

#### Portais de veículos

| Título | Descrição |
|---|---|
| Usado recentemente 1 | Atalho recente desta lista. |
| Usado recentemente 2 | Segundo atalho recente desta lista. |
| Mercado Livre | Abra a publicação e sincronização no painel. |
| OLX | Abra a publicação e sincronização no painel. |
| Webmotors | Abra a publicação, estoque e histórico no painel. |
| Voltar a Marketing | Retorne à lista principal de Marketing. |

### 4.3 Lista Gestão

| Título | Descrição |
|---|---|
| Usado recentemente 1 | Última ação de Gestão usada neste WhatsApp. |
| Usado recentemente 2 | Segunda ação recente de Gestão. |
| ⚡ Urgentes do dia | Veja só o que pede decisão hoje. Some quando estiver vazio. |
| Estoque › | Consulte carros, giro, custos, lucro e despesas. |
| Vendas › | Registre e analise compras, vendas e equipe. |
| Financeiro › | Veja DRE, contas, recebíveis e conciliação. |
| Oficina e cotações › | Acompanhe OS e cotações no painel. |
| Documentos › | Guarde CRLV no WhatsApp e organize no painel. |
| Clientes e leads › | Consulte números, contatos e abra o CRM. |
| Ajuda de Gestão | Veja exemplos de comandos de gestão. |

#### Estoque

| Título | Descrição |
|---|---|
| Resumo do estoque | Quantidade, valor investido e situação dos carros. |
| Buscar veículo | Procure por modelo, placa ou situação. |
| Vendidos no mês | Veja quantos veículos foram vendidos no período. |
| Lucro do veículo | Consulte lucro e margem de um carro. |
| Despesas do veículo | Liste os gastos lançados em um carro. |
| Giro do estoque | Veja carros parados e custo de esperar. |
| Abrir estoque | Gerencie cadastros, preços e status no painel. |
| Voltar a Gestão | Retorne à lista principal de Gestão. |

#### Vendas

| Título | Descrição |
|---|---|
| Registrar compra | Prepare a compra e confirme antes de salvar. |
| Registrar venda | Prepare a venda e confirme antes de salvar. |
| Lançar despesa | Classifique o gasto e confirme antes de salvar. |
| Desfazer lançamento | Desfaça o último lançamento elegível em até 24h. |
| Analisar uma venda | Veja o raio-X financeiro de uma venda. |
| Piores negócios | Veja os piores resultados do mês. |
| Equipe e comissões | Consulte ranking, metas, vendas e comissões. |
| Voltar a Gestão | Retorne à lista principal de Gestão. |

#### Financeiro

| Título | Descrição |
|---|---|
| DRE do mês | Receba o demonstrativo do resultado no WhatsApp. |
| Lucro da loja | Consulte o resultado líquido do mês. |
| Contas da semana | Veja contas a pagar e receber nos próximos dias. |
| Valores a receber | Consulte recebimentos que seguem em aberto. |
| Falta conciliar | Veja quantidade e valor ainda não conciliados. |
| Relatório contador | Gere um link seguro do pacote mensal. |
| Notas e contratos | Consulte NF-e e contratos; emita com confirmação. |
| Voltar a Gestão | Retorne à lista principal de Gestão. |

#### Oficina e cotações

| Título | Descrição |
|---|---|
| Abrir operações | Veja ordens de serviço no painel. |
| Cotações recebidas | Escolha propostas recebidas na OS pelo painel. |
| Parceiros | Cadastre e gerencie oficinas parceiras no painel. |
| Voltar a Gestão | Retorne à lista principal de Gestão. |

#### Documentos

| Título | Descrição |
|---|---|
| Guardar CRLV | Envie o documento; o portão local protege e lê. |
| Abrir cofre | Consulte documentos guardados no painel. |
| Vincular ao estoque | Vincule um CRLV guardado a um veículo. |
| Notas e contratos | Consulte documentos fiscais e comerciais. |
| Voltar a Gestão | Retorne à lista principal de Gestão. |

#### Clientes e leads

| Título | Descrição |
|---|---|
| Resumo de leads | Veja clientes ativos, novos e total de leads. |
| Contatos comerciais | Liste contatos e envie uma mensagem autorizada. |
| Abrir CRM | Acompanhe clientes, etapas e retornos no painel. |
| Leads sem retorno | Veja prioridades no fechamento e abra o CRM. |
| Voltar a Gestão | Retorne à lista principal de Gestão. |

### 4.4 Lista Vistoria e Troca

| Título | Descrição |
|---|---|
| Usado recentemente 1 | Última ação de Vistoria e Troca usada. |
| Usado recentemente 2 | Segunda ação recente desta lista. |
| Nova vistoria/troca | Abra uma nova ficha de avaliação no painel. |
| Trocas e laudos | Veja avaliadas, resumo, fotos e laudo em PDF. |
| Preço de troca | Consulte a referência Molicar no painel. |
| Consultar procedência | Informe a placa, revise o preço e confirme a consulta. |
| Liberar para estoque | Revise a troca e informe o preço no painel. |
| Ajuda de troca | Veja como avaliar, consultar e liberar uma troca. |

## 5. Plano em blocos deployáveis

### B1 — Portar AJUDA-1 para a produção

- **Arquivos:** reaplicar, sobre `7db2991e`, apenas
  `jarvis-ajuda-catalogo*`, `jarvis-cartilha-pdf*`,
  `jarvis-cartilha-pdf/index.ts`, integrações mínimas em
  `gestao-intent-pt*`, `gestao-inbound*`, `GestaoActionBar.tsx` e
  `supabase/config.toml`.
- **Não fazer:** cherry-pick bruto de `9dafe190`; ele removeria recursos atuais.
- **Riscos:** colisão com fechamento atual; catálogo afirmar rota errada;
  envio duplicado do PDF; regressão nos intents.
- **Testes:** testes AJUDA-1 portados; `gestao-inbound.test.ts`;
  `gestao-intent-pt.test.ts`; `gestao-fechamento-dia.test.ts`;
  `intent-golden.test.ts`; `os-parceiro-cotacao.test.ts`.
- **Desligar:** ainda não há menu. Se a ajuda precisar de kill switch, usar
  `jarvis_ajuda_enabled` por loja.
- **Reverter:** reverter somente o commit B1; nenhum schema destrutivo.

### B2 — Catálogo de menu e contratos, sem mudar comportamento

- **Arquivos:** ampliar `jarvis-ajuda-catalogo.ts`; novo
  `jarvis-menu-catalog.test.ts`; testes das rotas do painel.
- **Entrega:** hierarquia, textos, audiência, canal, disponibilidade e rota de
  cada item. Ajuda, PDF e futuro menu leem os mesmos objetos.
- **Riscos:** ultrapassar limites Meta; item órfão; rotular painel como
  WhatsApp; expor ação de dono ao gestor.
- **Testes:** unicidade, pais, ciclos, 24/72 caracteres, máximo de 10 linhas,
  rota de painel existente e contrato executável de cada item WhatsApp.
  Golden exige evidência do handler: por exemplo, troca chama
  `tryProcessGestaoTrocaWhatsAppInbound`, e não apenas retorna texto parecido.
- **Desligar:** sem mudança de runtime.
- **Reverter:** reverter B2 sem tocar no AJUDA-1.

### B3 — Saudação e três botões, piloto AMZ

- **Arquivos:** novo `_shared/jarvis-service-menu.ts` e testes; chamada pequena
  no processor; migration aditiva das duas flags por loja.
- **Entrega:** detector estrito de saudação pura, resumo de uma linha,
  urgência condicional, rodapé e três botões.
- **Riscos:** interceptar parceiro/cliente, resposta de fluxo pendente ou
  áudio com pedido real; custo/latência do fechamento; vazar financeiro a
  vendedor.
- **Testes:** matriz dono/gestor/vendedor/cliente/parceiro; flag on/off;
  saudação pura versus “bom dia, orçamento 1950”; pending flows; horário SP;
  sem urgente; erro do fechamento com fallback sem inventar números.
  Rodar golden e cotação/parceiro obrigatoriamente.
- **Desligar:** pôr `jarvis_menu_whatsapp_enabled=false` na AMZ; a próxima
  mensagem volta imediatamente ao fluxo atual do LLM.
- **Reverter:** reverter B3; migration aditiva pode ficar com default `false`.

### B4 — Listas Marketing

- **Arquivos:** catálogo; renderer/dispatcher do menu; testes de ferramentas
  sociais e Meta já existentes, mais teste de clique por ID.
- **Entrega:** listas Marketing, redes e portais. Rotas de painel apenas abrem
  link autenticado; as demais iniciam o fluxo real existente.
- **Riscos:** publicar sem A/B/C, perder mídia exata, oferecer TikTok com foto,
  agendar story, liberar publicação a gestor.
- **Testes:** nenhum clique publica diretamente; A/B/C e preview continuam
  obrigatórios; TikTok vídeo/consentimento; carrossel só Instagram; links dos
  três portais; `intent-golden.test.ts`.
- **Desligar:** mesma flag da loja oculta raiz e IDs; IDs recebidos com flag
  off respondem pelo fluxo antigo, sem executar.
- **Reverter:** reverter B4; B3 continua útil com botões cujas listas ainda
  disponíveis devem ser filtradas pelo catálogo/versionamento.

### B5 — Listas Gestão

- **Arquivos:** catálogo; dispatcher; adaptador de resumo/urgentes do
  fechamento; testes de Gestão e estoque.
- **Entrega:** listas e sublistas da seção 4.3. Toda ação mutável mantém a
  confirmação existente; OS/documentos/CRM sem handler ficam no painel.
- **Riscos:** duplicar lançamento, mostrar financeiro sem permissão, confundir
  produtos legados com `veiculos_estoque`, furar cofre.
- **Testes:** owner/manager e permissões financeiras; compra/venda/despesa com
  confirmação e idempotência; documento passa pelo portão antes do menu;
  estoque de revenda usa `toolConsultarEstoqueVeiculos`; cotação/parceiro e
  golden completos.
- **Desligar:** flag da loja; opcionalmente disponibilidade por seção no
  catálogo para ocultar apenas Gestão.
- **Reverter:** reverter B5; handlers atuais permanecem intactos.

### B6 — Listas Vistoria e Troca

- **Arquivos:** catálogo; dispatcher; testes de
  `gestao-troca-whatsapp.ts` e `veiculo-procedencia-inbound.ts`.
- **Entrega:** avaliadas/laudos e procedência pelo WhatsApp; nova ficha,
  Molicar e liberação continuam no painel.
- **Riscos:** liberar carro sem preço/confirmação, misturar troca de outro
  tenant, iniciar consulta paga de procedência sem SIM, expor CRLV.
- **Testes:** isolamento por `user_id`; autorização; procedência exige placa e
  confirmação; PDF/fotos omitem CRLV; “liberar” só gera link de painel;
  testes Molicar/procedência existentes; golden e portão documental.
- **Desligar:** flag da loja ou disponibilidade da seção.
- **Reverter:** reverter B6; nenhum estado de troca é migrado.

### B7 — Usados recentemente e saudação por horário

- **Arquivos:** helper de recência; persistência no `agent_state` da conversa
  ou tabela aditiva dedicada; catálogo/renderer; testes.
- **Entrega:** dois primeiros slots de cada lista, sem duplicar o item já
  visível, só após uma ação realmente iniciada. Horário usa São Paulo.
- **Riscos:** recência entre lojas/telefones, gravar clique falho, exceder 10
  linhas, mostrar ação que perdeu disponibilidade.
- **Testes:** isolamento tenant+telefone+papel; dedupe; ordem; expiração;
  disponibilidade atual; falha não grava; 10 linhas; virada 11:59/12:00 e
  17:59/18:00.
- **Desligar:** subflag `jarvis_menu_recent_enabled=false`; menu fixo continua.
- **Reverter:** reverter B7 e ignorar dados aditivos já gravados.

### B8 — Liberação gradual para todas as lojas

- **Arquivos:** sem código funcional novo; configuração/migration de rollout e
  runbook de observabilidade.
- **Pré-condições:** AMZ validada bloco a bloco; zero regressão nos goldens,
  documentos e cotação; métricas por rota e papel; botão/ID desconhecido
  seguro.
- **Ordem:** lojas internas → pequena coorte de revendas → todas as revendas
  elegíveis. Não ligar em tenants não automotivos até o catálogo filtrar seus
  itens corretamente.
- **Riscos:** configuração de segmento incompleta, conexões sociais ausentes,
  volume no builder de fechamento.
- **Testes:** smoke por coorte; flag off/on; conexões ausentes; carga do resumo;
  auditoria de que cliente/parceiro recebeu zero menus.
- **Desligar:** update da flag por loja ou global kill switch; efeito imediato,
  sem deploy.
- **Reverter:** desligar flags primeiro; depois reverter apenas o último bloco
  com problema.

## 6. Matriz mínima de regressão em todos os blocos com runtime

| Caso | Resultado obrigatório |
|---|---|
| Dono manda “oi” com flag AMZ on | saudação, resumo, ⚠️ condicional e 3 botões |
| Dono manda pedido real após “bom dia” | pedido real vence; não abre menu |
| Gestor autorizado manda “menu” | menu filtrado às permissões do gestor |
| Vendedor manda “menu” com flag off | comportamento atual, sem menu |
| Cliente manda “oi/menu” | vitrine/atendimento atual, nunca menu interno |
| Parceiro com cotação ativa manda valor/áudio/PDF | cotação vence |
| Parceiro manda “bom dia” sem sessão | nunca é confundido com gestor |
| Qualquer pessoa manda documento | portão/cofre vence |
| Dono manda foto sem legenda | fluxo de foto vence |
| Gestão tem confirmação pendente e recebe “sim” | confirmação vence |
| Vitrine tem formulário pendente | vitrine vence |
| Flag é desligada | IDs não executam e comportamento volta ao atual |

## 7. Dúvidas para decisão antes da implementação

1. Gestor deve ver Marketing, mesmo com as tools atuais restritas ao dono, ou
   o catálogo deve ocultar Marketing para gestor?
2. Qual é o `user_id` exato da loja AMZ a ligar no piloto? Não deve ser
   inferido apenas pelo nome da empresa.
3. O resumo de uma linha deve priorizar vendas de hoje, estoque, financeiro ou
   sempre usar o formato “vendas hoje · estoque · contas vencidas”?
4. Qual evento conta como “urgente”? Recomenda-se usar somente
   `buildGestaoFechamentoDia().dados.acoes`, sem criar outro conceito.
5. Ao tocar item de painel, prefere link direto autenticado ou texto com o
   caminho (“Gestão › Trocas”)? Link exige validar sessão no celular.
6. “Nova vistoria/troca” deve continuar no painel ou haverá um bloco futuro
   para criar a ficha inteira no WhatsApp do dono?
7. “Preço de troca (Molicar)” e “liberar para estoque” devem permanecer no
   painel no primeiro ciclo, como exige a capacidade real atual?
8. Usados recentemente são por pessoa, por loja ou compartilhados entre
   gestores? Recomenda-se por loja + telefone.
9. Qual janela de recência: 7, 30 ou 90 dias? Recomenda-se 30 dias.
10. Um item recente deve substituir sua linha fixa duplicada ou aparecer nos
    dois lugares? Recomenda-se remover a duplicata fixa naquele render.
11. O vendedor, quando a flag futura for ligada, verá apenas Estoque/Vendas e
    Vistoria, sem financeiro, documentos e Marketing?
12. Lojas não automotivas recebem uma árvore própria ou ficam fora do rollout
    B8 até existir catálogo por segmento?
13. O botão “Ajuda” deve mandar só texto curto ou também a cartilha PDF do
    AJUDA-1?
14. Em falha do fechamento, o menu deve abrir sem resumo (“Não consegui
    carregar o resumo agora”) ou cair integralmente no Jarvis atual?

## 8. Decisões

1. **Marketing para gestor:** gestor não vê Marketing por enquanto.
2. **Piloto:** a primeira loja é a AMZ. O `user_id` exato será resolvido no
   deploy, nunca inferido nem gravado no código.
3. **Resumo da saudação:** até 12h, mostrar
   `Ontem: X vendas · parado R$ Y · N contas vencidas`; depois de 12h, mostrar
   o mesmo formato iniciado por `Hoje:`.
4. **Urgente:** usar somente `buildGestaoFechamentoDia().dados.acoes`.
5. **Item de painel:** enviar o link direto e também escrever o caminho, por
   exemplo `Gestão › Trocas`.
6. **Nova troca pelo WhatsApp:** fica para o bloco futuro `TROCA-WPP-1`.
7. **Primeiro ciclo:** Molicar e liberar troca permanecem no painel.
8. **Recentes:** ficam isolados por loja e telefone.
9. **Janela de recência:** 30 dias.
10. **Sem duplicata:** o item recente substitui sua linha fixa no mesmo render.
11. **Vendedor futuro:** verá Estoque, Vistoria/Troca e Clientes, sem
    financeiro, Marketing ou Documentos.
12. **Lojas não automotivas:** ficam fora do rollout até existir catálogo
    adequado ao segmento.
13. **Ajuda:** responder com texto curto e oferecer a cartilha em PDF.
14. **Falha do resumo:** abrir o menu com
    `Não consegui carregar o resumo agora`.

No B3, o resumo da saudação usa cache de 10 minutos por loja.

## 9. Critério de pronto

O menu só está pronto para expansão quando: cada linha vem do catálogo; cada
item WhatsApp tem teste executável da capacidade; itens de painel estão
honestamente marcados; nenhuma saudação de cliente/parceiro gera menu; todos os
fluxos prioritários mantêm a ordem; e desligar a flag devolve o comportamento
de `7db2991e` sem deploy e sem limpeza de estado.
