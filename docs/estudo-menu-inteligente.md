# ESTUDO-MENU — cérebro contextual do Jarvis no WhatsApp

## Escopo, base e método

Este estudo é documental. Não altera comportamento, banco, Edge Function, painel ou deploy.

- Base auditada: `cursor/menu-b1`, commit `0bf58caff551aa2562345bb21f00ebdf366f9528` (B1–B3.1).
- Árvore de referência: `docs/menu-arvore.md`.
- Processor principal: `supabase/functions/whatsapp-cloud-inbound-processor/index.ts`.
- Estado conversacional atual: `whatsapp_cloud_conversations.agent_state`.
- “Existe no WhatsApp” abaixo significa que existe um handler/tool acionável por texto, áudio ou fluxo próprio. Isso **não** significa que o clique do menu B3 já o executa.
- Nomes em crase são nomes encontrados no código. Componentes sugeridos na Parte 3 são marcados como **propostos**; não são apresentados como funções existentes.

Conclusão executiva: o B3 é um navegador e uma ajuda contextual, ainda não um dispatcher. O processor tem bons blocos especializados — sobretudo o portão local de documentos —, porém decide mídia em vários pontos e mantém estados com TTL e escopos diferentes. O resultado é que uma pendência antiga pode vencer uma intenção nova, uma foto pode ser capturada por um fluxo não relacionado e o menu pode ser bloqueado por um `pending_*` genérico. A evolução segura não é criar mais um handler no fim da fila: é manter o portão documental como prioridade absoluta, criar um índice único de contexto ativo sobre os estados atuais e fazer menu, texto, áudio e mídia consultarem a mesma decisão.

---

# Parte 1 — O que existe hoje

## 1.1 Ordem real dos handlers no inbound processor

### 1.1.1 Espinha comum de `processOne`

A ordem abaixo é a ordem observada em `processOne`, em
`supabase/functions/whatsapp-cloud-inbound-processor/index.ts`. Um handler que retorna
`handled` encerra o turno; os itens posteriores não rodam.

1. Reclama a linha da fila, resolve `whatsapp_config`, agente e conversa.
2. Extrai texto/legenda/ID com `extractText` e `replyTextFromInteractiveId`. Um ID
   `jarvis_menu:*` é guardado sem entregar o título aos atalhos antigos.
3. Grava a mensagem inbound e encerra sem resposta automática se a conversa está em `handoff`.
4. Resolve dono e telefones alternativos com `resolveTenantOwner` e `setTenantOwnerForCtx`.
5. Para o dono, `sanitizeDocumentPhotoPending` limpa/cancela foto presa em fluxo documental.
6. Consome ações `cofre_possivel_*` e `cofre_doc_*`.
7. Para gestor não-dono, texto/interativo passa por `tryProcessGestaoLucroShortcut` e
   `tryProcessGestaoTrocaWhatsAppShortcut`.
8. Para não-dono, texto/interativo/button passa por
   `tryProcessOsParceiroCotacaoWhatsAppShortcut`.
9. Para cliente, a captura antecipada da vitrine roda por
   `tryProcessVehicleStockShowcase`.
10. Roda o opt-in/opt-out; depois agrupa textos curtos de lead.
11. No tenant AMZ, `answerOwnerCommercialStatus` pode consumir texto do dono.
12. Texto/interativo do dono passa por Gestão, troca e
    `tryProcessOwnerVehicleStockShortcut`, nessa ordem.
13. Pedido determinístico de local próximo roda antes da quota.
14. Valida janela de 24 horas e quota.
15. Baixa image/audio/video/document por `downloadAllMediaDetailed`; mídia grande ou falha
    de download recebe resposta própria e encerra.
16. Parceiro com cotação aberta recebe prioridade para imagem/documento; o callback local
    informa se é documento protegido.
17. `verificarDocumentoNoPortao` examina imagem e PDF antes de qualquer visão externa.
    Documento certo, possível documento ou falha do detector encerram o turno.
18. Áudio é transcrito por `transcribeAudioMedia`.
19. A transcrição passa por Gestão/estoque do dono, Gestão do gestor, cotação do parceiro e
    formulário da vitrine, nessa ordem.
20. Imagem ou vídeo entra no grande bloco `freshLibraryMedia`; salvo exceção, esse bloco
    sempre responde e retorna antes do LLM genérico.
21. Fora do bloco de mídia, resposta A/B/C/SIM do vídeo legendado passa por
    `tratarRespostaFluxoLegenda`.
22. Para cliente, captura de nome e handoff determinístico podem consumir o texto.
23. Documento ainda não capturado pelo portão entra no fluxo tardio de documento.
24. Monta prompt, memória e histórico; também dispara, quando habilitado, o hook
    `silvester-extract-document`.
25. Migra/escopa `agent_state` com `migrateVerticalState`, resolve escolhas do roteador e
    confirmações de foto.
26. Processa estados/questionário do Meta Ads.
27. Para cliente, roda a vitrine tardia.
28. Roda `tryProcessJarvisServiceMenuShortcut`.
29. Se nada consumiu, chama `callGemini`, aplica guardas, grava e envia a resposta.

### 1.1.2 Diferenças por tipo de mensagem

| Entrada | Caminho efetivo e precedência |
|---|---|
| Texto | Atalhos de gestor/parceiro/vitrine/opt-in/dono rodam antes de qualquer menu. Depois vêm controle vertical, Meta Ads, vitrine tardia, menu e `callGemini`. “bom dia, consulta o Civic” não é saudação pura e segue para o pedido. |
| Áudio | Chega inicialmente sem texto útil. Após download, `transcribeAudioMedia` produz `audioTranscript`; a transcrição passa por Gestão/estoque, parceiro e vitrine. O menu aceita `messageType="audio"` e usa a transcrição apenas se ninguém consumiu. Por fim, o LLM recebe a transcrição. |
| Uma imagem com legenda | A legenda está em `userText/contexto`. Cotação de parceiro e portão documental vêm primeiro. No bloco `freshLibraryMedia`, a legenda pesa no roteador vertical e pode iniciar carrossel, edição, composição, publicação ou outro pedido explícito. |
| Uma imagem sem legenda | Depois do portão, o dono passa por `classifyPhotoVertical`. Em revenda, foto de veículo entra numa espera de 8 s para agregar envios e depois em identificação/ações. Foto geral recebe descrição e confirmação/oferta. |
| Várias imagens | O payload comum do WhatsApp traz uma referência de mídia por mensagem; seis fotos normalmente são seis linhas da fila, não um único turno. `registerVehiclePhotoQueueEvent`, a espera de 8 s e `claimVehiclePhotoQueueBatch` agregam fotos de veículo. Uma coleção explícita usa `pending_carrossel_veiculo` e aceita até oito. Não há um agrupador universal equivalente para qualquer tipo de foto. |
| Vídeo | Não é candidato ao portão documental. É salvo na biblioteca. Para dono, `iniciarFluxoLegendaVideo` transcreve/propõe três copies e abre o fluxo de legenda; para cliente, segue resposta/encaminhamento de mídia. |
| PDF/documento | PDF passa primeiro por extração local e classificação determinística; se necessário, vai ao detector local. CRLV/CNH/RG reconhecido é guardado e encerra. PDF não reconhecido chega ao fluxo tardio: texto extraído do dono é comentado por modelo externo; documento de cliente pode ser enviado em base64 ao Lovable AI, risco detalhado em 1.5. |
| Botão/lista | O ID é incorporado por `extractText`. IDs de cofre, Gestão, parceiro, vitrine, foto, Meta etc. são consumidos pelos respectivos handlers. IDs `jarvis_menu:*` são preservados para o bloco B3, que fica depois da vitrine tardia. |

Observação importante sobre áudio + foto: se chegam como duas mensagens, não formam um “turno
atômico”. Hoje a ligação depende de estado/mídia recente e da ordem da fila; não há envelope
explícito dizendo “este áudio pertence a esta foto”.

## 1.2 Inventário de pendências e estados

### 1.2.1 Onde ficam

`migrateVerticalState` reconhece três locais:

- `vehicle`: estados de veículo;
- `general`: mídia/marketing geral;
- `vertical_router`: decisão e memória de rota.

Há ainda chaves novas no topo de `agent_state` que não pertencem aos conjuntos
`VEHICLE_STATE_KEYS`/`GENERAL_STATE_KEYS`, além de estados em tabelas próprias. O menu procura
qualquer chave que comece por `pending_` no topo, em `vehicle`, `general` e
`vertical_router`; se o timestamp parece ter menos de duas horas, ele bloqueia. Esse TTL do menu
não é necessariamente o TTL real do fluxo.

### 1.2.2 `vertical_router`

| Estado | Quem cria/usa | Validade/limpeza | O que pode bloquear ou capturar |
|---|---|---|---|
| `pending_choice` | Bloco `freshLibraryMedia`; confirmação em `processOne` | Roteamento ativo considera 30 min; `cleanupDocumentPhotoPending` também limpa após 2 h, documento ou cancelamento. Uma resposta textual não interativa pode limpá-lo. | Aguarda “produto”, “veículo” ou correção; menu o vê como pendência. |
| `pending_segment_choice` | `resolveVertical` quando falta ramo | Booleano, sem expiração própria; limpa ao salvar ramo. | Pode fazer qualquer texto seguinte virar nome do ramo. |
| `pending_demo_segment` | `parseDemoSegmentCommand` no tenant admin | Sem TTL próprio; limpa em confirmar/cancelar. | Aguarda confirmação de modo demo. |
| `demo_segment` | Confirmação do demo | Expira em 6 h. Não é `pending_*`. | Altera o segmento efetivo e, portanto, a rota. |
| `media_routes` | `persistOwnerMediaRoutes`/`mergeOwnerMediaRoute` | Persistente; limpeza parcial quando documento remove mídia. | Memória por `media_id`: geral/veículo/incerto, descrição, identificação, confirmação. |
| `last_route`/`updated_at` | Roteador vertical | Sem TTL próprio para `last_route`. | Pode desempatar resposta “essa foto”. |

### 1.2.3 Bucket `vehicle`

| Estado | Criação/consumo | TTL efetivo | Limpeza e bloqueio |
|---|---|---:|---|
| `pending_carrossel_veiculo` | `startVehicleCarouselFlow`, handlers de `vehicle-carousel.ts` | 30 min (`VEHICLE_CAROUSEL_TTL_MS`); captura de foto usa também janela recente de 10 min em `blockingVehiclePhotoFlow` | Limpa ao cancelar/concluir, ao trocar de assunto ou por rotas específicas; enquanto `collecting`, captura novas fotos. |
| `pending_vehicle_photo_batch` | `persistVehiclePhotoBatch` após debounce de fotos sem legenda | 3 min desde `last_photo_at` | Limpa ao escolher carrossel/anúncio/nada, por documento e por novos fluxos; oferece “Carrossel · Anúncio · Nada agora”. |
| `pending_vehicle_identification` | `beginVehicleIdentification` | 30 min (`VEHICLE_IDENTIFICATION_TTL_MS`) | Limpa em confirmação/correção/abandono e em mudança explícita para geral. Pode segurar a foto e o modelo sugerido. |
| `pending_vehicle_photo_edit` | Fluxo `vehicle-photo-edit-wa.ts` | 30 min | Limpa em executar/cancelar/expirar. Faz texto/áudio seguinte virar prompt de edição. |
| `pending_vehicle_brand` | Ação “Incluir minha marca” | Helper valida 30 min; upload da logo no bloco de mídia exige até 10 min | Captura a próxima imagem como logo. |
| `pending_vitrine_estoque` | `runVehicleStockShowcaseTurn` via `savePending` | Formulário: 15 min (`VITRINE_FORM_TTL_MS`); navegação usa janela própria de 30 min no fluxo | Captura texto, áudio e, na troca, fotos do cliente antes da biblioteca. |
| `pending_fipe` | Fluxo de FIPE | Processor/handler considera cerca de 30 min | Faz resposta seguinte completar marca/modelo/ano; limpa na conclusão/cancelamento/expiração. |
| `pending_anuncio_cliente`, `pending_anuncio_styles`, `pending_anuncio_photo`, `pending_anuncio_post` | Tools de anúncio; migram para `vehicle` quando `last_anuncio` parece automotivo | `clearExpiredAnuncioPendingState` limpa após 30 min | Capturam cliente, estilo, foto/tratamento e confirmação do anúncio. |
| `last_vehicle_photo_context`, `last_fipe`, `last_anuncio` | Resultados/contexto | Não são pendências e não têm TTL uniforme | Servem para retomar ações, mas o menu não deveria tratá-los como bloqueio. |

### 1.2.4 Bucket `general`

| Estado | Criação/consumo | TTL efetivo | Limpeza e bloqueio |
|---|---|---:|---|
| `pending_single_photo` | Foto geral sem legenda, confirmação de produto, anúncio/post | Estágio `ad_data` usa 30 min; limpeza documental usa 2 h; os demais estágios não têm uma única validação global | Captura botões, dados, rede e formato; pode repreguntar uma vez por `reprompt_count`. |
| `pending_carousel` | Carrossel social/tool `criar_carrossel` | Confirmações sociais podem viver até 24 h | Limpa ao entregar/cancelar e por `deliveredMediaState`; interfere com publicação recente. |
| `pending_image_edit` | Pedido/ação de edição | 30 min (`pendingImageEditIsActive`) | Texto seguinte pode virar instrução; nova mídia limpa estados antigos em vários caminhos. |
| `pending_image_adjustment` | Falha/retry de edição | 30 min | Botão `image_edit:retry` reutiliza a origem; limpa em sucesso/nova mídia. |
| `pending_image_composition` | Toda foto do dono pode manter até dois IDs | Uso explícito aceita até 15 min; `blockingVehiclePhotoFlow` a considera por 10 min | Pode capturar a próxima foto como segunda imagem, mesmo sem contexto de composição. |
| `pending_brand_generation` | Geração com escolha/upload de marca | Helper geral usa 30 min; captura de upload usa 10 min | A próxima imagem pode ser tomada como logo. |
| `pending_video_setup` | Tool de vídeo animado | Não há TTL global único; captura de logo de cliente usa 10 min | Pode transformar imagem seguinte em logo/identidade do vídeo. |
| `pending_creative_media_ambiguity` | Pedido criativo ambíguo | Não foi encontrada limpeza global consistente | Faz resposta seguinte escolher o tipo de mídia. |
| `pending_client_logo` | Cadastro de logo sem cliente definido | Captura textual/mídia usa em geral 10 min; limpeza inconsistente | Aguarda nome do cliente. |
| `pending_client_logo_intent` | Pedido “logo do cliente X” sem arquivo | Captura de imagem usa 10 min | A próxima imagem vira logo e pode retomar anúncio. |
| `pending_meta_ads_ambiguity` | `processMetaAdsQuestionario` | 15 min no helper do questionário | Escolhe “Jarvis” ou campanha; menu também o bloqueia. |
| `pending_meta_ads_limit` | Proposta/alteração de limite | 15 min | Consome confirmar/cancelar. |
| `pending_meta_ads_limit_value` | Pedido de valor de limite | TTL do módulo Meta, em torno de 15 min | Qualquer valor textual compatível pode ser consumido. |
| `pending_anuncio_cliente`, `pending_anuncio_styles`, `pending_anuncio_photo`, `pending_anuncio_post` | Fluxos de anúncio não automotivo | 30 min via `clearExpiredAnuncioPendingState` | Mesmo papel descrito no bucket `vehicle`; a migração escolhe um bucket com heurística. |
| `brand_image_preference` | Preferência de identidade | Não é pendência | Contexto persistente; não deveria bloquear. |

### 1.2.5 Topo e tabelas externas ao namespace vertical

| Estado | Local/criador | TTL | Efeito |
|---|---|---:|---|
| `pending_vehicle_social_copy` | Topo; fluxo de copy da foto de veículo | 30 min nas leituras observadas | Aguarda km/preço ou campos em texto. Não está em `VEHICLE_STATE_KEYS`. |
| `pending_ready_media_schedule` | Topo; ações `ready_media:*` | Não há validação de idade consistente em todos os consumidores | Aguarda horário customizado; pode ficar pendurado. |
| `pending_video_transcription_theme` | Topo; recuperação de vídeo sem transcrição | Não há validação global consistente | Faz texto seguinte virar tema do vídeo. |
| `pending_gestao_confirm` | Topo; `tryProcessGestaoInbound`/`gestao-inbound.ts` | 10 min, `expires_at` explícito | Confirma compra, venda, despesa, desfazer, NF-e e outras ações mutáveis. |
| `pending_procedencia_confirm` | Topo; `tryProcessVeiculoProcedenciaInbound` | 15 min, `expires_at` | Confirma consulta paga; qualquer resposta enquanto ativa é tratada pelo fluxo. |
| `social_posts_queue.status=aguardando_confirmacao` | Tabela `social_posts_queue` | 24 h; respostas curtas só são aceitas como recentes por 30 min | Aprovação A/B/C, publicação ou agenda; não é `agent_state`. |
| Sessão de cotação de parceiro | `gestao_os_cotacao_wa_sessao` | 2 h desde `updated_at` (`OS_COTACAO_SESSAO_TTL_MS`) | Valor, prazo, observação, confirmação e mídia do parceiro vencem cliente/menu. |
| Documento certo/possível | `gestao_documento` + storage `gestao-cofre` | Não é `pending_*`; depende da ação do cofre/retenção | Bloqueia IA externa e aguarda guardar/liberar/vincular. |

Problema estrutural: `jarvisMenuPriorityPendingName` aplica uma regra de duas horas a todos os
nomes `pending_*`, mesmo quando o fluxo real dura 10, 15 ou 30 minutos, e usa
`lastMessageAt` como fallback quando a pendência não tem timestamp reconhecido. B3.1 deixa uma
pendência velha de bloquear, mas não a remove. Assim, o estado morto continua disponível para
outros handlers.

## 1.3 Todos os caminhos relevantes de foto

### 1.3.1 Portão, armazenamento e privacidade atuais

| Ordem/condição | Caminho real | Resposta estática ou forma da resposta | IA externa? |
|---|---|---|---|
| Parceiro com cotação ativa + image/document | `tryProcessOsParceiroCotacaoWhatsAppShortcut`; callback `verificarDocumentoNoPortao` | A cotação recebe orçamento/NF/boleto; documento de identidade reconhecido fica protegido. | Detector/OCR do portão é local; parser de orçamento depende do tipo, não deve receber identidade protegida. |
| Imagem/PDF candidato | `verificarDocumentoNoPortao` em `_shared/documento-portao.ts` | Não responde sozinho; classifica certo/possível/não documento. | Não. PDF usa `extractDocumentText` + `classificarDocumentoIdentidade`; fallback usa `detectarDocumentoLocal`. |
| Detector local indisponível, dono/gestor | Fecha o fluxo | “Não consegui verificar a imagem agora, tente de novo em instantes.” | Não; fail closed. |
| Detector indisponível, cliente | Guarda como `outro`, mascara log e avisa equipe | “Recebi sua foto, vou passar para a equipe.” ou “Recebi seu arquivo, vou passar para a equipe.” | Não; fail closed. |
| Possível documento, dono/gestor | `gestaoCofreUpload`, botões | “Parece um documento. Quer que eu guarde no cofre e tente ler?” — **Guardar e ler · Não é documento** | Não. Só após “Não é documento” os bytes são decifrados e liberados para rotas comuns. |
| Documento reconhecido de cliente | Cofre | “Recebi seu documento, vou repassar para a equipe com segurança.” | Não. |
| CRLV reconhecido de dono/gestor | `gestaoCofreUpload` + `respostaCrlvWhatsApp` | Resumo mascarado e “O que você quer fazer com este CRLV?” — **Cadastrar veículo · Vincular ao estoque · Só guardar** | Não; leitura de CRLV é local. |
| CNH/RG reconhecido | Cofre | “📄 Documento guardado com segurança no cofre.” (sem botões de CRLV) | Não. |
| PDF não reconhecido de cliente, fluxo tardio | bloco `docMedia` em `processOne` | Resumo natural, extração e dossiê `silvester_*` | **Sim: Lovable AI, `MODEL_DEEP` = `google/gemini-3.1-pro-preview`**. É a principal exceção perigosa. |
| PDF textual não protegido do dono | `extractDocumentText`, depois comentário | Comentário de até ~250 palavras | **Sim**, conteúdo textual vai ao modelo escolhido para documento. |

### 1.3.2 Roteamento de foto depois do portão

1. **Vitrine/troca de cliente ativa.** `processVitrineTrocaInboundPhoto` roda antes de salvar
   na biblioteca. A foto vai ao slot da ficha, e `analyzeTrocaPhotoVision` pode avaliar vista,
   nitidez, km, alertas e avarias. Usa o Lovable gateway com a chave recebida pelo bridge.
2. **Uploads que “roubam” a próxima imagem.** Antes do roteamento genérico, os estados
   `pending_vehicle_brand`, `pending_brand_generation`, `pending_video_setup` com identidade de
   cliente e `pending_client_logo_intent` podem tratar a imagem como logo. Exemplos reais:
   “Recebi esta logo. Quer cadastrá-la ou usar somente nesta imagem?” e
   “Guardei como logo do <cliente>. Vou usar nos vídeos e posts desse cliente.”
3. **Biblioteca.** `salvarItemMidiaBiblioteca` salva foto/vídeo e registra
   `last_media_interaction`. Falha responde explicitamente e encerra.
4. **Classificação vertical.** Para o dono, `classifyPhotoVertical` envia a primeira imagem ao
   Lovable AI com `google/gemini-3.6-flash`. As únicas classes atuais são `veiculo` e `geral`;
   placa, avaria, nota e documento não são classes próprias.
5. **Ramo ausente.** A imagem é guardada e o sistema responde:
   “Antes de continuar, preciso configurar o ramo uma única vez.”, com
   **Revenda de veículos · Outro ramo**.
6. **Baixa confiança.** Guarda `vertical_router.pending_choice`, descreve a imagem e responde
   “Não tenho certeza do que é. Vi <descrição>. É um veículo ou outro produto?”, com
   **Sim, é produto · É um veículo · Corrigir**.
7. **Foto geral, tenant não automotivo, sem legenda.** Cria `pending_single_photo` no estágio
   `actions` e responde “Recebi a foto. Estou vendo: <descrição>”, com
   **Anúncio · Editar imagem · Post nas redes**.
8. **Foto de produto numa revenda, sem legenda.** Cria `pending_single_photo` em
   `confirm_vision` e responde “Vi <descrição>. É isso?”, com os três botões de confirmação.
9. **Foto de veículo sem legenda.** Espera 8 s, agrega eventos recentes. Uma foto segue para
   `beginVehicleIdentification`; duas ou mais recebem “Recebi <N> fotos. O que quer fazer?”,
   com **Carrossel de fotos · Anúncio (1 foto) · Nada agora**.
10. **Identificação de veículo.** `identifyVehiclePhoto` usa Lovable AI,
    `google/gemini-3.1-pro-preview`. Se marca/modelo e confiança forem suficientes, mostra uma
    lista: **Criar arte de anúncio · Postar nas redes · Anúncio pago (Meta) · Consultar FIPE ·
    Vistoria/Troca · Corrigir modelo · Editar foto**. Se não, pergunta:
    “Não consegui identificar o modelo com segurança. Qual é a marca, o modelo e o ano?”
11. **Carrossel explícito na legenda.** `isVehiclePhotoCarouselRequest` inicia coleta e
    responde “Recebi <N> foto(s). Manda mais ou toque em Pronto.” Fotos seguintes são anexadas
    até oito.
12. **Carrossel já coletando.** Toda nova foto de veículo é anexada. Ao atingir oito, usa as
    oito primeiras; mídia que não é foto abandona a coleta e segue o roteamento normal.
13. **Edição/geração com legenda.** `classifyOwnerMediaIntent`,
    `logoImageEditPlan`, `prepareWhatsAppImageGeneration`,
    `toolEditarImagem` e `toolApplyTenantLogoOverlay` podem executar no mesmo turno. A geração
    e a edição usam modelos de imagem via Lovable gateway.
14. **Composição de duas imagens.** `pending_image_composition` mantém até dois IDs. Se o
    pedido é explícito e falta a segunda: “Recebi a foto. Agora me manda também a segunda foto
    para fazer a composição.” Com duas, `composeProductInEnvironment` usa IA de imagem externa.
15. **Cadastro de logo com legenda.** `isClientLogoRegistrationRequest` pode salvar a imagem
    como logo; se falta cliente: “Guardei o arquivo, mas ainda não associei a nenhuma
    identidade. De qual cliente é essa logo?”
16. **Fallback de mídia.** `descreverFotosSalvas` usa `descreverImagemVisao`, que tenta
    `google/gemini-3-flash-preview`, depois `google/gemini-3.6-flash`, depois
    `google/gemini-3.1-pro-preview`. A resposta final vem de `respostaMidiaSalva` ou, para
    cliente que pediu encaminhamento, do fluxo de handoff.
17. **Hook Silvester.** Depois, para cliente e tenant habilitado, fotos recentes podem ser
    enviadas por URL à função `silvester-extract-document`. O portão precisa continuar sendo
    uma condição absoluta para impedir que mídia documental chegue a esse hook.

Lacunas objetivas:

- Foto de placa **não** tem OCR/rota Molicar ou procedência dedicada.
- Foto de avaria/peça **não** tem classe OS/vistoria; pode cair em geral ou veículo.
- Nota/comprovante **não** tem rota financeira determinística.
- Foto de carro **não** cadastra o estoque pelo menu de ações atual; “estoque” existe em
  mapeamentos internos/pós-FIPE, mas não está entre as ações visíveis de
  `vehiclePhotoDirectActionList`.
- “Troca” no menu da foto orienta/abre o fluxo disponível; a nova ficha interna completa por
  WhatsApp não existe nesta base.

## 1.4 Cobertura de cada item de `docs/menu-arvore.md`

Regra atual do B3: `tryProcessJarvisServiceMenu` executa navegação. Para item de painel,
`itemResponse` devolve ajuda + link + caminho. Para item marcado `whatsapp`, o clique devolve
apenas `formatarRespostaJarvisAjuda` (“Você pode pedir assim…”); **não chama** o handler/tool
registrado no catálogo.

Legenda:

- **WA-capacidade**: existe ação por comando/handler, mas falta o dispatcher do clique.
- **Painel**: existe no painel; o clique já pode devolver link/caminho.
- **Ajuda**: existe resposta de ajuda, não execução da capacidade.
- **Não existe**: slot/função ainda não implementado.

| Árvore/item | Situação real | O que falta |
|---|---|---|
| Abertura Marketing / Gestão / Vistoria | Navegação B3 existe; gestor não vê Marketing; vendedor depende de flag desligada | Cérebro deve liberar saudação apesar de pendência velha. |
| Usado recentemente 1/2 (três listas e sublistas de Marketing) | **Não existe**: os slots estão no catálogo/Markdown, mas `renderMenuList` filtra `row.kind === "recent"` | B7: persistir/renderizar recência; usar como sinal, não trava. |
| Marketing → Postar nas redes | Navegação existe | Nenhum efeito de negócio. |
| Criar arte de anúncio | **WA-capacidade** `owner_media:generate` | Clique precisa despachar sem gerar/publicar sem confirmação. |
| Criar carrossel | **WA-capacidade** `criar_carrossel` | Dispatcher e contexto da mídia escolhida. |
| Criar vídeo | **WA-capacidade** `criar_video_animado` | Dispatcher e contexto de mídia/identidade. |
| Campanha Meta Ads | **WA-capacidade** `processMetaAdsQuestionario` | Dispatcher respeitando conexão/limite. |
| Resultado campanhas | **WA-capacidade** `relatorio_anuncios_meta` | Dispatcher e filtro de conexão. |
| Portais de veículos | Navegação existe | Nenhum efeito de negócio. |
| Ajuda de Marketing | **Ajuda** existe | Clique já explica; oferecer cartilha conforme B1. |
| Facebook | **WA-capacidade** de publicação | Dispatcher; nunca publicar no primeiro clique. |
| Instagram feed | **WA-capacidade** | Dispatcher; preservar foto/carrossel correto. |
| Instagram story | **WA-capacidade** | Dispatcher; story agendado continua limitado. |
| TikTok | **WA-capacidade**, somente vídeo + consentimento | Filtrar quando a mídia é foto. |
| LinkedIn | **WA-capacidade** `publicar_linkedin` | Dispatcher e conexão. |
| Agendar publicação | **WA-capacidade** `agendar_post_pendente` | Exigir criativo/texto escolhidos e data. |
| Meus agendamentos | **WA-capacidade** `listar_agendamentos_posts` | Dispatcher. |
| Voltar a Marketing | Navegação existe | Nada. |
| Mercado Livre | **Painel** `/veiculos` | Integração WhatsApp dedicada não existe. |
| OLX | **Painel** `/veiculos` | Integração WhatsApp dedicada não existe. |
| Webmotors | **Painel** `/veiculos` | Integração WhatsApp dedicada não existe. |
| Gestão → ⚡ Urgentes do dia | **WA-capacidade** `buildGestaoFechamentoDia` | Clique hoje só ensina; despachar dados reais e esconder se vazio. |
| Gestão → Estoque / Vendas / Financeiro / Oficina / Documentos / Clientes | Navegação existe conforme papel | Nada além de disponibilidade contextual. |
| Ajuda de Gestão | **Ajuda** existe | Nada além de dispatcher de ajuda/cartilha. |
| Resumo do estoque | **WA-capacidade** `consultar_estoque`/desvio de revenda | Clique precisa usar `veiculos_estoque`, não catálogo legado. |
| Buscar veículo | **WA-capacidade** `consultar_estoque` | Pedir modelo/placa se faltar. |
| Vendidos no mês | **WA-capacidade** `tryProcessOwnerVehicleStockInbound` | Dispatcher. |
| Lucro do veículo | **WA-capacidade** `lucro_veiculo` | Dispatcher; papel e sigilo. |
| Despesas do veículo | **WA-capacidade** `despesas_veiculo` | Dispatcher; papel e sigilo. |
| Giro do estoque | **Painel** `/gestao/lucro?aba=giro` | Comando WA dedicado não existe. |
| Abrir estoque | **Painel** `/veiculos` | Cadastro/gestão WA completa não existe. |
| Registrar compra | **WA-capacidade** `compra` | Dispatcher mantendo `pending_gestao_confirm`. |
| Registrar venda | **WA-capacidade** `venda` | Idem. |
| Lançar despesa | **WA-capacidade** `despesa` | Idem. |
| Desfazer lançamento | **WA-capacidade** `desfazer`, janela 24 h | Idem e mostrar lançamento exato. |
| Analisar uma venda | **WA-capacidade** `venda_raiox` | Dispatcher. |
| Piores negócios | **WA-capacidade** `piores_negocios_mes` | Dispatcher e sigilo. |
| Equipe e comissões | **Ajuda** no item; capacidades de ranking/metas/comissão existem por texto | Dispatcher pode abrir ajuda ou subescolha; não existe lista própria na árvore. |
| DRE do mês | **WA-capacidade** `dre_whatsapp` | Dispatcher e permissão financeira. |
| Lucro da loja | **WA-capacidade** `lucro_loja_mes` | Dispatcher e sigilo. |
| Contas da semana | **WA-capacidade** `contas_semana` | Dispatcher. |
| Valores a receber | **WA-capacidade** `a_receber` | Dispatcher. |
| Falta conciliar | **WA-capacidade** `conciliacao_pendente` | Dispatcher. |
| Relatório contador | **WA-capacidade** `pacote_contador` | Dispatcher e link seguro. |
| Notas e contratos (Financeiro) | **Ajuda**; emissão/status/consulta existem por texto | Dispatcher de ajuda/subação e confirmação para mutações. |
| Abrir operações | **Painel** `/gestao/operacoes` | Operação completa do dono por WA não existe. |
| Cotações recebidas | **Painel** `/gestao/operacoes` | Seleção do dono por WA não existe; resposta do parceiro existe. |
| Parceiros | **Painel** `/gestao/parceiros` | CRUD WA não existe. |
| Guardar CRLV | **WA-capacidade** `verificarDocumentoNoPortao` | Clique deve preparar expectativa; envio continua passando pelo portão. |
| Abrir cofre | **Painel** dentro do veículo | Listagem geral WA não existe. |
| Vincular ao estoque | **Painel**; após upload de CRLV há botão WA para escolher até 10 veículos | Menu geral precisa de documento/veículo selecionado. |
| Notas e contratos (Documentos) | **Painel** `/gestao/lucro?aba=notas` | Gestão documental WA geral não existe. |
| Resumo de leads | **WA-capacidade** `consultar_clientes_leads` | Dispatcher. |
| Contatos comerciais | **WA-capacidade** `enviar_mensagem_contato_comercial` | Dispatcher; confirmação e opt-in. |
| Abrir CRM | **Painel** `/leads-funil` | CRM completo WA não existe. |
| Leads sem retorno | **WA-capacidade** derivada de `buildGestaoFechamentoDia` | Dispatcher e esconder quando vazio. |
| Nova vistoria/troca | **Painel** `/gestao/trocas` | Criação completa por WA não existe nesta base. |
| Trocas e laudos | **WA-capacidade** `tryProcessGestaoTrocaWhatsAppInbound` | Dispatcher. |
| Preço de troca | **Painel**, Molicar na ficha | Consulta de Molicar da troca por foto/WA não existe. |
| Consultar procedência | **WA-capacidade** `tryProcessVeiculoProcedenciaInbound` | Dispatcher e placa; é Consultar Placa, não Molicar. |
| Liberar para estoque | **Painel** | Operação WA não existe; preço/revisão devem continuar no painel. |
| Ajuda de troca | **Ajuda** existe | Nada além de dispatcher de ajuda. |
| Todos os “Voltar” | Navegação existe | Nada. |

## 1.5 Riscos atuais

1. **Bloqueio fantasma do menu.** O menu usa TTL genérico de 2 h para pendências que valem
   10–30 min. Uma saudação pode cair no LLM ou num fluxo antigo.
2. **Estado velho não é apagado.** B3.1 deixa de bloquear após 2 h, mas não saneia o estado;
   um consumidor específico ainda pode capturar a mensagem.
3. **Próxima foto “roubada”.** Logo, vídeo, composição, anúncio, vitrine e carrossel têm
   capturas próprias antes da rota comum.
4. **`pending_segment_choice` sem expiração.** “oi” ou “Corolla” pode virar segmento.
5. **Composição criada para toda foto.** `pending_image_composition` é atualizado mesmo sem
   pedido explícito e pode contaminar a foto seguinte.
6. **Uma pergunta repetida.** Há controles pontuais (`reprompt_count`, idempotência de
   vitrine), mas não há fingerprint universal de pergunta.
7. **Áudio e foto desacoplados.** “vê quanto vale esse aqui” e a foto seguinte dependem de
   timing/histórico, não de um vínculo explícito.
8. **Taxonomia insuficiente.** O classificador externo só distingue veículo/geral; placa,
   avaria e comprovante não têm destino determinístico.
9. **Duas interpretações de TTL.** Menu, roteador e handler podem discordar sobre o mesmo
   estado.
10. **Escopo inconsistente.** Estados novos no topo não entram na migração vertical; o menu
    os encontra, mas `scopedVerticalState` pode não entregá-los como esperado.
11. **Clique B3 promete mais do que executa.** O catálogo diz “WhatsApp”, mas o clique só
    envia exemplos; o usuário precisa repetir o pedido.
12. **Documento tardio externo.** PDF de cliente não reconhecido pode ser enviado ao Lovable
    AI com PII. Isso conflita com a regra pretendida “documento nunca sai”.
13. **Hook secundário.** Fotos recentes de cliente podem seguir para
    `silvester-extract-document`; a marca “documento protegido” precisa sobreviver a toda a
    cadeia, não só ao primeiro retorno.
14. **PII em logs.** Há logs com telefone e, em alguns caminhos, nome/contexto. A proposta
    exige IDs técnicos e códigos de motivo, nunca conteúdo ou telefone bruto.
15. **Custo e latência em cascata.** Uma foto pode chamar classificação vertical, descrição e
    identificação externas em sequência.

---

# Parte 2 — Dia a dia do usuário

Nos cenários, “pergunta” significa no máximo uma pergunta, com até três botões. Se os sinais
forem suficientes, a coluna diz “nenhuma”.

| ID | Sequência realista | Sinais disponíveis | Decisão esperada / pergunta | O que não pode acontecer |
|---|---|---|---|---|
| S01 | Dono 08:10: “bom dia” | Dono, saudação pura, sem contexto ativo válido | Abrir B3 com resumo e três áreas. Pergunta implícita nos botões **Marketing · Gestão · Vistoria/Troca** | Pendência velha bloquear ou LLM inventar números. |
| S02 | Dono: “bom dia, quantos carros vendi?” | Saudação + intenção explícita de estoque | Executar vendidos no mês; nenhuma pergunta | Mostrar menu e ignorar o pedido. |
| S03 | Gestor: “menu” | Papel gestor, sem Marketing | Mostrar **Gestão · Vistoria/Troca** | Exibir Marketing, custo indevido ou tratá-lo como cliente. |
| S04 | Futuro vendedor: “menu” | Papel seller ativo e flag específica | Mostrar Estoque/Clientes/Vistoria conforme política; nenhuma pergunta | Mostrar Financeiro, Marketing, Documentos, margem ou custo. |
| S05 | Dono manda foto de carro com legenda “posta esse” | Legenda explícita, foto não documental, dono, mídia atual | Preparar post com a foto exata. Se falta destino: **Instagram · Facebook · Ambos** | Perguntar estoque/troca ou usar foto antiga. |
| S06 | Dono manda 6 fotos seguidas sem legenda | Mesmo remetente, janela curta, seis carros/ângulos, nenhuma intenção | Agrupar uma vez e perguntar: “Recebi 6 fotos. O que fazemos?” **Carrossel · Anúncio · Estoque/Troca** | Seis respostas, seis classificações pagas desnecessárias ou seis perguntas iguais. |
| S07 | Dono manda uma foto de Corolla sem legenda, sem contexto recente | Veículo inteiro, nenhuma ação anterior | Identificar local/externamente e perguntar uma vez: **Postar · Estoque · Troca/Vistoria** | Assumir “postar” ou iniciar FIPE paga sozinho. |
| S08 | Dono manda áudio “vê quanto vale esse aqui”; 20 s depois foto | Áudio recente explícito + foto do mesmo remetente | Vincular áudio à foto; consultar referência apropriada. Se placa/modelo insuficiente: **FIPE · Molicar troca · Procedência** | Abrir menu de post ou esquecer o áudio. |
| S09 | Vendedor manda foto: “entrou na troca do Gol” | Legenda explícita, papel, troca citada, veículo de referência | Abrir/retomar contexto de troca do Gol e anexar a foto. Se houver duas fichas: até três opções de ficha | Criar post, cadastrar no estoque ou mostrar margem. |
| S10 | Cliente chega com carro; vendedor manda 5 fotos e depois CRLV | Contexto de troca ativo, sequência curta, CRLV detectado localmente | Fotos vão à vistoria; CRLV ao cofre e é ligado/sugerido à mesma ficha. Pergunta no CRLV: **Vincular à troca · Só guardar · Cancelar** | Enviar CRLV a IA externa ou transformar fotos em carrossel. |
| S11 | Carro comprado em leilão/repasse: “entrou no estoque”, fotos + CRLV | Texto explícito de entrada, lote de fotos, documento local | Criar rascunho de entrada e guardar CRLV; no estado atual, oferecer link do painel. **Abrir entrada · Só guardar · Cancelar** | Publicar o carro antes de preço/revisão; inventar cadastro WA inexistente. |
| S12 | Dono: fotos do carro preparado; depois “agora posta” | Último contexto = preparação/Marketing, mídia recente confirmada | Reusar versão tratada, gerar copies e pedir rede/formato se faltar | Publicar a foto original ou abrir troca. |
| S13 | Dono manda foto de para-choque: “manda pro funileiro cotar” | Avaria visível, intenção de cotação e veículo recente | Anexar à OS/cotação existente. Sem OS: **Nova OS no painel · Vistoria · Só guardar** | Classificar como produto para anúncio ou enviar sem veículo/consentimento. |
| S14 | Em vistoria ativa, manda foto de amassado | Fluxo ativo de vistoria + slot/veículo | Anexar como avaria da vistoria; nenhuma pergunta se slot é inequívoco | Abrir OS automaticamente ou postar. |
| S15 | Dono fotografa placa no pátio: “quanto vale?” | OCR local da placa, intenção “valor”, sem ficha | Não confundir preço com procedência. Perguntar **FIPE · Preço de troca · Abrir ficha** | Disparar consulta paga de procedência sem confirmação. |
| S16 | Dono manda foto da placa: “consulta a procedência” | OCR local + intenção explícita | Mostrar placa, custo/saldo e pedir **Confirmar · Cancelar** | Usar Molicar ou cobrar sem confirmação. |
| S17 | Gestor manda comprovante: “paguei a oficina do Civic” | OCR local de comprovante, papel autorizado, Civic e despesa explícitos | Criar rascunho de despesa com valor/data lidos; **Confirmar · Corrigir · Só guardar** | Enviar comprovante a visão externa ou lançar sem confirmação. |
| S18 | Gestor manda nota fiscal sem legenda | Documento/nota local, nenhum contexto | Guardar com segurança e perguntar **Despesa · Vincular veículo/OS · Só guardar** | Tratar como foto para post ou emitir nova NF-e. |
| S19 | Qualquer papel manda foto de CNH | Detector local identifica PII | Cofre, mascaramento e política de acesso; para cliente, confirmação segura sem transcrever PII | **Nunca** enviar bytes/texto a IA externa, logar CPF ou oferecer post. |
| S20 | Dono manda CRLV e escolhe “Só guardar” | Documento reconhecido, ação explícita | Guardar, limpar contexto e confirmar uma vez | Continuar perguntando estoque/troca. |
| S21 | Dono manda CRLV: “é do Onix que já está no estoque” | CRLV + veículo citado | Ler localmente, localizar Onix; se único, pedir **Vincular · Só guardar** | Cadastrar duplicado ou expor proprietário. |
| S22 | Foto de formulário parece documento, dono toca “Não é documento” | Possível documento, decisão explícita | Decifrar e enviar ao classificador não documental uma única vez | Manter cópia provisória no cofre sem política ou perguntar novamente se é documento. |
| S23 | No meio da vistoria do Civic, usuário manda foto de um café | Contexto ativo forte, classificador “outro”, imagem incompatível | Não anexar automaticamente. Perguntar **Fora da vistoria · Anexar mesmo · Encerrar vistoria** | Poluir o laudo ou iniciar post de café sem pedido. |
| S24 | Usuário abandona fluxo; 3 h depois: “oi” | Contexto expirado, saudação pura | Abrir menu; opcionalmente “Há uma vistoria pausada” sem bloquear | Retomar pergunta antiga, consumir “oi” como campo ou segmento. |
| S25 | Parceiro com cotação ativa manda “R$ 1.950, 7 dias” + foto da peça | Sessão DB ativa <2 h, parceiro conhecido | Cotação vence; extrair rascunho e pedir confirmação | Mostrar menu interno ou tratar como lead/Marketing. |
| S26 | Parceiro manda PDF de orçamento | Sessão ativa, PDF não identidade | Portão local primeiro; orçamento segue ao parser da cotação e confirmação | PDF de identidade sair do cofre; menu capturar. |
| S27 | Dono manda vídeo do carro: “faz legenda e posta” | Vídeo, Marketing explícito | Transcrever, criar A/B/C, escolher texto e só então publicar | Abrir foto/estoque, publicar sem copy aprovada. |
| S28 | Dono manda foto: “melhora luz e tira reflexo” | Edição explícita, mídia atual | Editar a foto atual, devolver preview e ações | Perguntar “o que fazer?” ou gerar outro carro. |
| S29 | Fluxo de marca aguarda logo; usuário manda foto do carro por engano | `pending_*` de logo + classificador de veículo + legenda ausente | Detectar incompatibilidade e perguntar **É a logo · É foto do carro · Cancelar logo** | Salvar o carro como logo. |
| S30 | Dono: foto da sala; “coloca esse produto nela”; depois foto do produto | Pedido explícito de composição + duas mídias | Unir as duas e limpar composição | Tratar segunda foto como veículo/estoque ou conservar pendência depois do sucesso. |
| S31 | Cliente da vitrine, troca ativa, manda foto frontal | Formulário da vitrine espera slot frontal | `processVitrineTrocaInboundPhoto`; validar nitidez e avançar | Salvar como mídia de Marketing do dono. |
| S32 | Dono: “quantos vendidos no mês?” | Papel owner, intenção de estoque | `tryProcessOwnerVehicleStockInbound`; nenhuma pergunta | Consultar tabela `produtos` legada. |
| S33 | Cliente: “qual foi a margem do Corolla?” | Papel cliente, dado interno | Recusar dado interno e oferecer informação comercial pública | Executar `lucro_veiculo` ou revelar custo/margem. |
| S34 | Gestor toca/manda “Criar arte” | Papel manager, decisão atual: sem Marketing | Informar indisponibilidade conforme papel e mostrar Gestão/Vistoria | Executar owner media ou vazar conexão social. |
| S35 | Vendedor: “quanto a loja pagou nesse carro?” | Papel seller, custo confidencial | Negar custo; oferecer dados permitidos do veículo | Mostrar compra, margem, despesas ou DRE. |
| S36 | Dono: “publica o Civic na Webmotors” | Portal explícito, capacidade só painel | Enviar link/caminho do veículo no painel | Dizer que publicou pelo WhatsApp. |
| S37 | Foto com legenda “posta esse”; existe vistoria ativa de outro carro | Intenção explícita atual vence contexto antigo não destrutivo | Marketing com a foto atual; pausar vistoria sem perdê-la | Anexar foto na vistoria só porque ela está ativa. |
| S38 | Foto ambígua; usuário ignora botões e manda outra pergunta | Fingerprint da pergunta + nova intenção | Não repetir pergunta. Suspender/expirar ambiguidade e atender o novo pedido | Loop “veículo ou produto?” em toda mensagem. |
| S39 | Detector local indisponível e chega imagem | Segurança > disponibilidade | Fail closed com texto atual; guardar seguro quando aplicável | Liberar para Gemini “para não travar”. |
| S40 | Dono manda PDF de contrato comercial não pessoal: “resume” | PDF, texto local, intenção explícita | Extrair localmente; enviar somente texto minimizado ao modelo se política permitir | Enviar bytes integrais/assinaturas/CPF ou confundir com CRLV. |
| S41 | Dono manda foto do carro: “cadastra no estoque” | Veículo + intenção explícita, mas cadastro WA completo não existe | Extrair sugestão visual e abrir rascunho/link do painel; **Abrir cadastro · Troca · Cancelar** | Afirmar que cadastrou ou inventar ano/versão. |
| S42 | Dono: “faz campanha desse Corolla”; foto anexada | Foto atual, Meta Ads explícito, papel owner | Iniciar questionário com mídia fixa e conexão/limite; nenhuma pergunta de finalidade da foto | Abrir menu genérico ou publicar campanha sem revisão. |

---

# Parte 3 — Proposta de “cérebro” único

## 3.1 Classificador de mídia em camadas

O “cérebro” proposto é uma decisão antes dos fluxos especializados. Ele não substitui o portão
de documentos nem os handlers; escolhe qual handler pode ver a mensagem.

### Camada 0 — segurança documental, 100% local

1. Calcular hash/perceptual hash e metadados técnicos, sem conteúdo em log.
2. Para imagem/PDF, executar o que já existe:
   `verificarDocumentoNoPortao` → `extractDocumentText`/
   `classificarDocumentoIdentidade` → `detectarDocumentoLocal`.
3. Se `documento` ou `possivel_documento`, cifrar/cofre e encerrar a rota de visão.
4. Rodar OCR local permitido para classificar subtipo: CRLV, CNH/RG, nota, comprovante,
   contrato/outro. A extração completa continua no cofre.
5. Marcar a mídia com uma decisão persistente `protected_document=true`; hooks posteriores
   devem rejeitá-la por regra, não por convenção.

Fica 100% local: bytes de CRLV/CNH/RG, OCR, CPF/RG/RENAVAM/chassi, texto de nota/comprovante,
placa lida da imagem, hashes, redatores de PII e decisão de segurança.

### Camada 1 — classe não documental

Classes propostas:

1. `veiculo_inteiro`;
2. `placa`;
3. `avaria_ou_peca`;
4. `nota_ou_comprovante` (segunda barreira caso o portão tenha chamado de não identidade);
5. `outro`.

Tecnologia recomendada:

- serviço local ONNX Runtime, com modelo leve ajustado para as cinco classes;
- encoder visual MobileNet/EfficientNet ou CLIP/SigLIP pequeno quantizado;
- OCR local para padrão de placa e pistas “PIX”, “valor”, “nota fiscal”;
- regras de alta precisão antes do modelo: padrão de placa, densidade de texto e classes do
  detector documental;
- nenhuma inferência de marca/modelo/ano nesta camada.

Somente se a classe continuar ambígua **e** não houver risco documental, pode haver fallback de
visão externa com imagem minimizada, por flag e orçamento. Identificação fina de veículo para
Marketing pode continuar externa no início; placa, comprovante e PII não.

### Custo e tempo

O repositório informa modelos e timeouts, mas não contém tabela de preço do Lovable/provider;
portanto, atribuir um preço por foto seria inventar. O custo deve ser medido no piloto.

| Etapa | Custo marginal | Meta de latência proposta | Observação |
|---|---|---:|---|
| Hash/regras/OCR local | Sem tarifa por chamada; CPU/infra já provisionada | p50 <100 ms, p95 <400 ms para imagem comum | Medir no hardware real. PDF escaneado pode ser mais lento. |
| Classificador ONNX local | Sem tarifa de API; CPU/RAM amortizados | p50 <150 ms, p95 <500 ms | Batch de seis fotos reduz overhead. |
| Visão externa atual | Tarifa variável do gateway/modelo; valor não está no código | Hoje timeouts chegam a 30 s (vertical) e 45 s (identificação) | Medir custo por 1.000 fotos e p50/p95. |
| Fallback externo proposto | Só ambíguos não documentais, com teto por loja | Meta p95 <3 s; timeout de produto menor que os atuais | Kill switch e limite diário. |

Critério econômico sugerido: pelo menos 85% das fotos devem ser roteadas sem visão externa;
nenhum documento deve contar entre os 15% restantes. O valor final do teto é decisão do dono
(Parte 6).

## 3.2 Decisão por contexto, em ordem de prioridade

Ordem proposta, aplicada uma vez por mensagem:

0. **Segurança:** portão documental local e papel/permissão.
1. **Intenção explícita da mensagem atual:** legenda e áudio anexado. Para mensagens separadas,
   um áudio explícito pode ser ligado à próxima mídia do mesmo remetente por até 2 min, uma vez.
2. **Fluxo ativo de alta confiança:** slot de vistoria/troca, OS/cotação, formulário ou
   confirmação mutável recente. A foto precisa ser compatível com o tipo esperado.
3. **Nova intenção explícita versus fluxo anterior:** intenção nova pode pausar contexto
   não destrutivo; nunca confirma gasto, publicação ou lançamento implicitamente.
4. **Última escolha do menu:** sinal útil com janela curta, por exemplo 10 min, não bloqueio.
5. **Histórico recente:** últimas mensagens e mídia confirmada, com vínculo por ID, não apenas
   “última foto da loja”.
6. **Papel:** owner, manager, seller, partner, client. O papel filtra destinos e dados antes da
   pergunta.
7. **Classe visual:** decide entre destinos ainda compatíveis.

Exemplos:

- legenda “entrou na troca do Gol” vence última escolha Marketing;
- cotação ativa de parceiro vence menu;
- foto de café é incompatível com slot “frente do Civic”, então não é anexada automaticamente;
- “oi” após expiração ignora pendência antiga;
- gestor nunca recebe Marketing como opção só porque a foto parece boa para post.

Quando restarem dois ou três destinos plausíveis, fazer **uma** pergunta:

> Vi um Corolla prata. O que fazemos?
>
> **Postar · Estoque · Troca/Vistoria**

Idempotência proposta:

- criar `prompt_fingerprint = hash(tipo_contexto + media_id + opções + versão)`;
- guardar `last_prompt_fingerprint`, `last_prompt_at` e `attempts`;
- não enviar o mesmo fingerprint duas vezes;
- se o usuário ignora, a próxima intenção explícita suspende a pergunta;
- segundo erro não repete: mostra menu seguro ou pede uma frase livre.

## 3.3 Um único contexto ativo

Envelope **proposto**, armazenado inicialmente no próprio `agent_state`:

```text
active_context = {
  type,                 // inspection | trade | os | quote | stock_entry |
                        // marketing | finance | document | ambiguity
  id,                   // id da ficha/OS/cotação/mídia ou UUID local
  scope,                // vehicle | general | management | document
  created_at,
  updated_at,
  expires_at,
  source_message_id,
  role,
  status,               // active | paused | completed | cancelled | expired
  legacy_state_ref,     // chave/bucket atual durante a migração
  last_prompt_fingerprint
}
```

Regras:

- no máximo um contexto “capturador” ativo por conversa;
- contextos pausados podem ser retomados por ID, mas não capturam mensagens;
- `expires_at` é obrigatório;
- saudação pura e `menu` nunca são bloqueados por contexto expirado;
- antes de rotear, expirar/sanear o envelope e a referência legada;
- ação destrutiva sempre exige a confirmação do handler atual;
- documento não é “mais um contexto”: a trava de segurança continua acima do envelope.

TTL inicial sugerido:

| Contexto | Ativo | Retomável |
|---|---:|---:|
| Ambiguidade de foto/menu | 10 min | não |
| Marketing/edição/composição | 30 min | 2 h por ID explícito |
| Vistoria/troca | 30 min desde atividade | 24 h por ficha |
| OS/cotação do dono | 30 min | 24 h por OS |
| Cotação do parceiro | manter 2 h atual | pela cotação aberta |
| Confirmação financeira/gestão | manter 10–15 min atual | não |
| Documento possível | até decisão ou política de retenção | só no cofre |

### Migração gradual sem quebrar fluxos

1. **Sombra:** construir `active_context` a partir dos `pending_*`, sem mudar roteamento.
2. **Índice:** handlers atuais continuam donos dos dados; o envelope aponta para
   `vehicle.pending_*`, `general.pending_*`, topo ou sessão DB.
3. **Leitura comum:** menu e roteador consultam o envelope; em ausência, usam a lógica antiga.
4. **Escrita dupla:** ao criar/limpar uma pendência, atualizar envelope e legado.
5. **Captura central:** antes de um handler capturar mídia, validar tipo, expiração e papel no
   envelope.
6. **Migração por família:** documentos → vistoria/troca → OS/cotação → Marketing → Gestão.
7. **Remoção:** só retirar uma chave legada após métricas, teste de retomada e nenhuma leitura
   em produção. Até lá, `legacy_state_ref` torna o legado autoritativo.

## 3.4 Como menu, cérebro e fluxos conversam

```text
WhatsApp inbound
  |
  +--> identidade do remetente + mensagem/legenda/áudio
  |
  +--> PORTÃO LOCAL DE DOCUMENTOS
  |      +--> certo/possível/falha: cofre + resposta; FIM
  |      `--> não documento
  |
  +--> agregador curto de mídia (mesmo remetente)
  |
  +--> classificador local: veículo | placa | avaria/peça |
  |                       nota/comprovante | outro
  |
  +--> saneador de active_context (expira, pausa, remove legado morto)
  |
  +--> motor de decisão contextual
  |      legenda/áudio > fluxo compatível > menu > histórico > papel > visão
  |      +--> destino único: chama handler EXISTENTE
  |      `--> dúvida real: uma pergunta, até 3 botões, com fingerprint
  |
  +--> menu B3
  |      navega OU solicita uma intenção ao mesmo motor
  |
  +--> handlers existentes
  |      Gestão | estoque | troca/vistoria | OS/cotação |
  |      Marketing | Meta | vitrine | cofre
  |
  `--> LLM genérico somente quando nenhuma rota determinística serve
```

O menu não chama tools diretamente. Ele produz uma intenção tipada com item, papel e contexto;
o mesmo dispatcher usado por texto/áudio valida disponibilidade e chama o handler já existente.

## 3.5 Privacidade e autorização

1. CRLV, CNH, RG e documento pessoal: bytes e OCR somente locais, sempre cofre; remover o envio
   tardio de documentos de cliente ao Lovable AI.
2. Nota/comprovante: OCR e classificação locais. Se houver resumo por LLM, enviar somente campos
   minimizados e redigidos, nunca a imagem.
3. Placa: OCR local. Consulta paga só após confirmar placa/custo.
4. Logs: `tenant_id`, `conversation_id` hash, `message_id`, classe, confiança, rota e reason code;
   sem telefone, nome, placa, CPF, texto OCR, legenda integral ou URL assinada.
5. Custos, compra, margem, lucro, despesas, DRE e recebíveis: somente owner/manager autorizado.
6. Seller: sem custo/margem/financeiro/documentos/Marketing por padrão.
7. Cliente/parceiro: nunca recebe menu interno nem dados gerenciais.
8. Mídia externa não documental: opt-in por loja, lista de modelos permitidos, retenção mínima e
   métrica de volume/custo.
9. URLs do cofre nunca entram em histórico de LLM.
10. Toda rota deve registrar decisão e autorização, não conteúdo sensível.

---

# Parte 4 — Plano em blocos pequenos

Os nomes de flags abaixo são propostas de configuração, não chaves existentes.

## C0 — Observabilidade e fixtures, sem mudar resposta

- **Muda:** registra decisão atual em reason codes e cria fixtures anonimizadas.
- **Arquivos:** `whatsapp-cloud-inbound-processor/index.ts`; novos helpers/testes em `_shared`;
  `evals/` se adotado pelo projeto.
- **Flag:** `jarvis_context_brain_shadow`.
- **Risco:** logar PII; mitigação com sanitizador e IDs hash.
- **Testes:** logger rejeita telefone/CPF/placa/URL/texto; replay dos cenários S01–S42.
- **Pronto:** 100% dos turnos de piloto têm rota atual e rota-sombra comparáveis, sem PII.

## C1 — Fechar todas as saídas documentais

- **Muda:** propaga `protected_document`; remove/bloqueia o fluxo tardio externo de documento de
  cliente e o hook secundário para mídia protegida.
- **Arquivos:** `index.ts`, `_shared/documento-portao.ts`,
  `_shared/document-photo-pending.ts`, `silvester-extract-document` e testes.
- **Flag:** `jarvis_document_local_only`, default ligado e fail closed.
- **Risco:** falso positivo bloquear arquivo legítimo.
- **Desligar:** não se recomenda desligar proteção; flag pode trocar apenas a UX, nunca liberar
  documento para IA externa.
- **Testes:** CNH/CRLV/RG PDF/imagem, comprovante, detector fora, “Não é documento”, hook.
- **Pronto:** zero bytes/texto de documento protegido em chamadas externas.

## C2 — Envelope `active_context` em sombra

- **Muda:** deriva um índice único a partir dos estados atuais; não muda quem é autoritativo.
- **Arquivos:** novo helper `_shared` proposto, `vertical-router.ts`, `jarvis-service-menu.ts`,
  `index.ts`.
- **Flag:** `jarvis_active_context_shadow`.
- **Risco:** divergência entre envelope e legado.
- **Desligar:** ignorar envelope; nenhum dado legado foi removido.
- **Testes:** todos os `pending_*` inventariados, expiração, raiz/buckets/DB, saudação com estado
  morto.
- **Pronto:** divergência explicada <1% e nenhuma saudação bloqueada por estado expirado.

## C3 — Classificação local não documental

- **Muda:** adiciona classes veículo/placa/avaria/nota/outro e batch.
- **Arquivos:** serviço OCR/classificador local, cliente `_shared` proposto, `index.ts`, fixtures.
- **Flag:** `jarvis_media_classifier_local`; fallback separado
  `jarvis_media_external_fallback`.
- **Risco:** baixa acurácia em peça versus carro parcial.
- **Desligar:** voltar ao classificador atual, preservando C1.
- **Testes:** matriz balanceada, seis fotos, noite/reflexo, placa, recibo, avaria, outros.
- **Pronto:** meta de acurácia definida por classe; recall documental 100% no corpus de segurança;
  p95 e custo medidos.

## C4 — Motor de decisão e pergunta idempotente

- **Muda:** aplica prioridade da seção 3.2 e fingerprint universal.
- **Arquivos:** helper proposto, `index.ts`, integrações com
  `vehicle-stock-showcase-bridge.ts`, `os-parceiro-inbound.ts` e roteador.
- **Flag:** `jarvis_context_decision_enabled`.
- **Risco:** intenção explícita pausar fluxo que deveria continuar.
- **Desligar:** volta à ordem atual; envelope continua em sombra.
- **Testes:** S05–S31, nova intenção no meio, foto incompatível, mesma pergunta duas vezes.
- **Pronto:** nenhuma pergunta duplicada e nenhuma captura incompatível no replay.

## C5 — Dispatcher único do menu

- **Muda:** item B3 vira intenção tipada; itens WhatsApp chamam handlers existentes, itens de
  painel continuam link.
- **Arquivos:** `jarvis-service-menu.ts`, `jarvis-ajuda-catalogo.ts`, `index.ts`, testes de
  contrato.
- **Flag:** `jarvis_menu_dispatch_enabled`, além da flag B3 atual.
- **Risco:** clique mutável executar sem dados/confirmação.
- **Desligar:** clique volta ao texto “Você pode pedir assim”.
- **Testes:** cada linha da árvore; papel; conexão; clique duplicado; confirmação obrigatória.
- **Pronto:** cada item WhatsApp chega ao handler registrado; nenhum primeiro clique publica,
  paga ou grava mutação.

## C6 — Adaptadores de placa, avaria e financeiro documental

- **Muda:** placa local alimenta FIPE/Molicar/procedência; avaria escolhe OS/vistoria; nota cria
  rascunho de despesa/vínculo.
- **Arquivos:** adaptadores propostos sobre handlers existentes; Gestão/OS/troca; testes.
- **Flag:** uma por rota: `jarvis_plate_router`, `jarvis_damage_router`,
  `jarvis_receipt_router`.
- **Risco:** vincular ao veículo/OS errado ou iniciar consulta paga.
- **Desligar:** guardar e perguntar sem executar.
- **Testes:** S13–S18; dois veículos homônimos; custo de procedência; papel.
- **Pronto:** toda mutação mostra alvo/valor e exige confirmação.

## C7 — Escrita dupla e limpeza gradual dos `pending_*`

- **Muda:** cada família atualiza/limpa envelope e legado; saneador remove expirados.
- **Arquivos:** helpers de foto, Meta, Gestão, troca, vitrine, OS e processor.
- **Flag:** `jarvis_active_context_write`.
- **Risco:** perder retomada ou limpar confirmação válida.
- **Desligar:** legado permanece autoritativo.
- **Testes:** relógio simulado para cada TTL, retomada, rollback, mensagens concorrentes.
- **Pronto:** nenhuma chave órfã no piloto por sete janelas máximas de expiração.

## C8 — Rollout, custo e privacidade

- **Muda:** shadow → AMZ → coortes; dashboard de confusão, custo, latência e loops.
- **Arquivos:** configuração/runbook/testes; sem necessidade de nova capacidade.
- **Flags:** global, por loja e por rota.
- **Risco:** segmento/conexão/papel incompleto.
- **Desligar:** kill switch do cérebro; C1 documental permanece.
- **Testes:** smoke por coorte, conexões ausentes, carga, auditoria PII, fallback.
- **Pronto:** zero vazamento documental, zero menu a cliente/parceiro, taxa de pergunta repetida
  zero e orçamento dentro do teto aprovado.

## Impacto nos blocos B4–B8 do plano atual

- **B4 Marketing:** não deve criar dispatcher paralelo. Usa C5 e recebe `media_id`/intenção de
  C4. Disponibilidade por mídia impede TikTok com foto; publicação continua após preview.
- **B5 Gestão:** usa o mesmo dispatcher, mas C4/C5 filtram papel antes do handler. Comprovante e
  nota entram por C1/C6; `pending_gestao_confirm` continua autoritativo durante a migração.
- **B6 Vistoria/Troca:** deixa de depender só do clique. Foto/CRLV/placa podem resolver a ficha
  ativa; nova ficha, Molicar e liberação continuam no painel até existir capacidade real.
- **B7 Recentes:** recência passa a ser sinal de contexto e atalho visual, nunca pendência
  bloqueadora. O item só é gravado após handler realmente iniciado.
- **B8 Rollout:** deve vir depois de C0/C1 e usar shadow mode, matriz de confusão, custo por mil
  mídias, auditoria de PII e kill switch por rota. Recomenda-se inserir C0–C4 como fundação
  “B3.2/B4a” antes de expandir os dispatchers.

---

# Parte 5 — Matriz de teste

## 5.1 Cenários de mídia, texto e papel

| Teste | Mensagem/mídia | Contexto | Resposta/efeito obrigatório |
|---|---|---|---|
| T01 (S01) | “bom dia” | owner, estado expirado | Saudação B3 + três áreas; limpa/ignora estado morto. |
| T02 (S02) | “bom dia, quantos carros vendi?” | owner | Resultado de vendidos; sem menu. |
| T03 (S03) | “menu” | manager | Gestão + Vistoria; sem Marketing. |
| T04 (S04) | “menu” | seller flag on | Só itens permitidos; sem financeiro/documento/Marketing. |
| T05 (S05) | carro + “posta esse” | owner | Mídia atual em Marketing; no máximo pergunta de rede. |
| T06 (S06) | seis fotos sem legenda | owner, 8 s | Uma oferta agregada, uma pergunta, seis IDs. |
| T07 (S07) | um Corolla sem legenda | sem contexto | Uma pergunta Postar/Estoque/Troca. |
| T08 (S08) | áudio “vê quanto vale” + foto | vínculo <2 min | Valor/FIPE, não Marketing. |
| T09 (S09) | foto + “troca do Gol” | seller | Anexa à troca; sem custo. |
| T10 (S10) | cinco fotos + CRLV | troca ativa | Fotos na ficha; CRLV local/cofre vinculado. |
| T11 (S11) | fotos + CRLV “entrou no estoque” | owner | Rascunho/link do painel; não afirma cadastro. |
| T12 (S12) | “agora posta” | mídia tratada recente | Publica a tratada após aprovação. |
| T13 (S13) | avaria “manda pro funileiro” | sem OS | Pergunta OS/Vistoria/Guardar. |
| T14 (S14) | avaria | vistoria ativa compatível | Anexa sem pergunta. |
| T15 (S15) | placa + “quanto vale?” | sem ficha | FIPE/Molicar/Abrir ficha; sem consulta paga. |
| T16 (S16) | placa + “procedência” | autorizado | Mostra placa/custo; confirma antes de cobrar. |
| T17 (S17) | comprovante + despesa Civic | manager | OCR local, rascunho, confirmação. |
| T18 (S18) | nota sem legenda | manager | Despesa/Vincular/Guardar. |
| T19 (S19) | CNH | qualquer papel | Zero chamada externa; cofre e log sem PII. |
| T20 (S20) | CRLV + Só guardar | owner | Confirma e encerra contexto. |
| T21 (S21) | CRLV “Onix do estoque” | owner | Vínculo ao único Onix ou escolha segura. |
| T22 (S22) | possível doc + Não é documento | owner | Libera uma vez e remove provisório conforme política. |
| T23 (S23) | café | vistoria ativa | Pergunta incompatibilidade; não anexa sozinho. |
| T24 (S24) | “oi” após 3 h | fluxo abandonado | Menu; sem pergunta antiga. |
| T25 (S25) | valor + peça | parceiro, sessão ativa | Cotação e confirmação; sem menu. |
| T26 (S26) | PDF orçamento | parceiro | Portão local; orçamento segue, identidade não. |
| T27 (S27) | vídeo + postar | owner | A/B/C antes de publicação. |
| T28 (S28) | foto + editar | owner | Edita a própria foto; não reclassifica intenção. |
| T29 (S29) | carro no lugar de logo | pending logo | Pergunta compatibilidade; não salva como logo. |
| T30 (S30) | duas fotos composição | composição explícita | Combina e limpa estado. |
| T31 (S31) | frente do carro | vitrine troca espera frente | Captura no slot e avança. |
| T32 (S32) | vendidos mês | owner | Base `veiculos_estoque`. |
| T33 (S33) | margem do Corolla | client | Não revela dado interno. |
| T34 (S34) | Criar arte | manager | Sem acesso; oferece áreas permitidas. |
| T35 (S35) | custo de compra | seller | Não revela. |
| T36 (S36) | publicar Webmotors | owner | Link/caminho do painel; não afirma publicação. |
| T37 (S37) | “posta esse” + foto | vistoria anterior | Nova intenção explícita pausa vistoria. |
| T38 (S38) | ignora pergunta ambígua | fingerprint já enviado | Não repete; atende intenção nova. |
| T39 (S39) | imagem com detector off | qualquer | Fail closed; zero visão externa. |
| T40 (S40) | contrato PDF “resume” | owner | Texto local minimizado; sem bytes/PII externa. |
| T41 (S41) | carro “cadastra” | owner | Rascunho/link; sem cadastro fictício. |
| T42 (S42) | carro + “campanha” | owner | Meta questionário com mídia fixa e revisão. |

## 5.2 Contrato de cada linha do menu

| Área/linha enviada | Papel/contexto | Resultado esperado |
|---|---|---|
| Raiz Marketing | owner | Abre lista; manager/seller não recebe. |
| Raiz Gestão | owner/manager; seller futuro | Lista filtrada por papel. |
| Raiz Vistoria/Troca | papel autorizado | Abre lista filtrada. |
| Qualquer “Usado recentemente” | ação válida anterior | Aparece somente após sucesso; sem duplicata; inexistente antes de B7/C5. |
| Marketing → Postar nas redes | owner | Abre sublista. |
| Criar arte | owner | Inicia `owner_media:generate`; não gera sem briefing essencial. |
| Criar carrossel | owner + Instagram | Inicia `criar_carrossel`; mantém aprovação. |
| Criar vídeo | owner | Inicia `criar_video_animado`; pede mídia/tema se faltar. |
| Campanha Meta Ads | owner + conexão | Inicia `processMetaAdsQuestionario`; sem publicar. |
| Resultado campanhas | owner + conexão | Executa `relatorio_anuncios_meta`. |
| Portais | owner | Abre sublista; nenhum portal é anunciado como publicado. |
| Ajuda Marketing | owner | Texto real + oferta de cartilha. |
| Facebook | owner + conexão + mídia | Prepara feed/story; preview antes de publicar. |
| Instagram feed | owner + conexão | Foto/vídeo/carrossel correto. |
| Instagram story | owner + conexão | Só formato válido; agenda limitada honestamente. |
| TikTok | owner + vídeo + consentimento | Foto é rejeitada como incompatível. |
| LinkedIn | owner + conexão | `publicar_linkedin`, tom profissional. |
| Agendar publicação | criativo aprovado | `agendar_post_pendente`; pede data se faltar. |
| Meus agendamentos | owner | `listar_agendamentos_posts`; listar/remarcar/cancelar. |
| Mercado Livre / OLX / Webmotors | owner | Link autenticado + caminho; sem tool fictícia. |
| ⚡ Urgentes | owner/manager, ações >0 | Dados de `buildGestaoFechamentoDia`; some se vazio. |
| Gestão → Estoque | papel autorizado | Abre sublista. |
| Resumo estoque | papel autorizado | `consultar_estoque` com desvio para veículos. |
| Buscar veículo | modelo/placa ausente | Uma pergunta curta; depois consulta. |
| Vendidos no mês | papel autorizado | `tryProcessOwnerVehicleStockInbound`. |
| Lucro / Despesas veículo | owner/manager; seller conforme decisão | Autorização antes dos dados; no plano recomendado seller não vê margem/custo. |
| Giro / Abrir estoque | papel autorizado | Link correto do painel. |
| Gestão → Vendas | owner/manager | Abre sublista; seller não. |
| Compra / Venda / Despesa | owner/manager | Rascunho + `pending_gestao_confirm`; nunca salva no clique. |
| Desfazer | lançamento elegível <24 h | Mostra alvo e confirma. |
| Analisar venda / Piores negócios | owner/manager | Dados reais e autorizados. |
| Equipe e comissões | owner/manager | Ajuda/comandos reais; nenhuma lista fictícia. |
| Gestão → Financeiro | owner/manager | Abre sublista. |
| DRE / Lucro loja / Contas / Receber / Conciliação | owner/manager | Intent real; zero acesso cliente/seller. |
| Relatório contador | owner/manager | Pacote/link seguro. |
| Notas e contratos | owner/manager | Ajuda real; emissão exige confirmação. |
| Oficina → Abrir operações / Cotações / Parceiros | owner/manager | Links do painel; fluxo de parceiro não é vendido como operação do dono. |
| Documentos → Guardar CRLV | owner/manager | Instrui envio; portão local continua primeiro. |
| Abrir cofre / Vincular / Notas e contratos | owner/manager | Link/contexto correto; sem listagem WA inventada. |
| Clientes → Resumo leads | papel autorizado | `consultar_clientes_leads`. |
| Contatos comerciais | papel autorizado + opt-in | Localiza e confirma envio. |
| Abrir CRM | papel autorizado | Link `/leads-funil`. |
| Leads sem retorno | dado >0 | Ações do fechamento + CRM; esconder quando vazio. |
| Nova vistoria/troca | papel autorizado | Link do painel; não afirma ficha criada. |
| Trocas e laudos | papel autorizado | `tryProcessGestaoTrocaWhatsAppInbound`. |
| Preço de troca | papel autorizado | Link Molicar na ficha; sem consulta WA fictícia. |
| Consultar procedência | papel autorizado + placa | `tryProcessVeiculoProcedenciaInbound`; custo + confirmação. |
| Liberar para estoque | papel autorizado | Link do painel; preço e revisão obrigatórios. |
| Ajuda de troca | papel autorizado | Exemplos reais. |
| Qualquer Voltar | qualquer papel que vê a lista | Volta ao pai, sem criar contexto de negócio. |
| ID desconhecido/flag off | qualquer | Não executa; fallback seguro e auditado. |

Critério de cobertura automatizada: cada item `whatsapp` precisa de teste que observe o handler
executado, não apenas texto parecido; cada item `panel` precisa validar rota e caminho; cada
linha deve passar por matriz owner/manager/seller/client/partner.

---

# Parte 6 — Perguntas para o dono

1. **Foto de veículo sem legenda:** usar automaticamente o último contexto compatível ou sempre
   perguntar? **Sugestão:** usar contexto ativo inequívoco; fora dele, uma pergunta com três
   botões.
2. **Duração de vistoria/troca/OS:** qual janela ativa? **Sugestão:** 30 min desde atividade,
   retomável por ficha/OS por 24 h.
3. **Marketing para gestor:** continua oculto? **Sugestão:** sim, até existir permissão
   granular e auditoria.
4. **Vendedor futuro:** quais dados pode ver? **Sugestão:** estoque público, clientes e
   vistoria; sem custo, margem, financeiro, documentos e Marketing.
5. **Foto só da placa:** destino padrão é valor ou procedência? **Sugestão:** não presumir;
   usar legenda/contexto e, se faltar, **FIPE · Preço de troca · Procedência**.
6. **Nota/comprovante:** guardar, lançar despesa ou vincular? **Sugestão:** criar rascunho
   local e perguntar **Despesa · Vincular · Só guardar**.
7. **Foto de avaria sem contexto:** OS ou vistoria? **Sugestão:** usar fluxo ativo; sem fluxo,
   perguntar **OS · Vistoria · Só guardar**.
8. **Fallback externo para foto não documental:** pode ser usado e com qual teto?
   **Sugestão:** opt-in por loja, somente ambíguos, medir custo por 1.000 e fixar limite diário
   após piloto.
9. **Retenção de CRLV/CNH/comprovantes:** prazo, quem acessa e como apaga?
   **Sugestão:** política explícita por tipo, trilha de acesso e exclusão verificável.
10. **Entrada no estoque a partir de CRLV/fotos:** deve continuar abrindo rascunho no painel ou
    virar um fluxo futuro completo de WhatsApp? **Sugestão:** primeiro rascunho + painel; só
    depois automatizar cadastro com confirmação campo a campo.

---

## Critério global de pronto

O menu inteligente está pronto quando: documento pessoal jamais sai do ambiente local; saudação
e menu ignoram estado vencido; texto, áudio, foto e clique produzem a mesma intenção tipada;
uma foto incompatível não é capturada por fluxo antigo; nenhuma pergunta idêntica é repetida;
papel filtra dados antes de tool/LLM; cada item do menu executa capacidade real ou declara
honestamente o painel; e todas as linhas das matrizes desta documentação passam com as flags
ligadas e desligadas.
