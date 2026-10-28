# AUDIT-BOTOES — inventário e clique simulado

Base auditada: `70a7eb5` (`cursor/menu-b1`).

## Método

- `P1`: o teste chama o `processOne` exportado, com payload Meta real
  (`interactive.button_reply`, `interactive.list_reply` ou `button.payload`),
  banco Supabase em memória e `fetch` falso.
- `U`: existe teste isolado do parser/handler, mas ele não prova a montagem
  feita pelo `processOne`.
- `—`: sem prova automatizada de clique real.
- `🔴`: falha reproduzida pelo `processOne` real.

A única injeção adicionada foi `setProcessOneSupabaseForTest`; a função usa o
mesmo `processOne` de produção. O `Deno.serve` passou a iniciar somente quando
o módulo é o entrypoint (`import.meta.main`), permitindo importá-lo no teste.
Não houve mudança de regra ou handler.

## Inventário

As linhas com alternativas separadas por `|` representam IDs emitidos pelo
mesmo construtor e tratados pelo mesmo bloco. IDs com UUID/token/código são
famílias dinâmicas; o valor dinâmico está entre `<...>`.

| área | texto do botão/lista | ID/prefixo | criado em | trata o clique | lê o ID de | estado necessário | efeito esperado | teste |
|---|---|---|---|---|---|---|---|---|
| Menu raiz | Marketing \| Gestão \| Vistoria e Troca | `jarvis_menu:grupo:marketing\|gestao\|vistoria_troca` | `_shared/jarvis-service-menu.ts:414-426` | `_shared/jarvis-service-menu.ts:529-650`; `processor/index.ts:29915-29960` | `interactiveId` bruto no processor | dono/gestor; menu habilitado | abre grupo | `P1` Marketing |
| Menu listas | filhos e “Voltar” | `jarvis_menu:lista:<id>` | `_shared/jarvis-service-menu.ts:430-465` | `_shared/jarvis-service-menu.ts:619-650` | `interactiveId` bruto | papel com acesso | navega árvore | `U` |
| Menu itens | item do catálogo | `jarvis_menu:item:<id>`; IDs: `estoque-resumo`, `estoque-busca`, `oficina-os`, `cotacoes`, `gerar-arte`, `editar-foto`, `publicar-midia`, `gerar-publicar`, `agendar-post`, `listar-posts-agendados`, `video`, `anuncios-relatorio`, `campanha-status`, `fipe`, `preco-painel`, `lembrete`, `mensagem-contato`, `resumos-config`, `estoque-vendidos`, `estoque-giro`, `estoque-abrir`, `equipe-comissoes-ajuda`, `notas-contratos-ajuda`, `oficina-parceiros`, `documentos-guardar-crlv`, `documentos-cofre`, `documentos-vincular`, `documentos-notas-contratos`, `clientes-resumo`, `clientes-crm`, `clientes-sem-retorno`, `gestao-urgentes`, `gestao-ajuda`, `marketing-carrossel`, `marketing-campanha-meta`, `marketing-ajuda`, `redes-facebook`, `redes-instagram-feed`, `redes-instagram-story`, `redes-tiktok`, `redes-linkedin`, `portal-mercado-livre`, `portal-olx`, `portal-webmotors`, `troca-nova`, `troca-laudos`, `troca-preco-molicar`, `troca-procedencia`, `troca-liberar-estoque`, `troca-ajuda` | `_shared/jarvis-ajuda-catalogo.ts:305-2260`; `_shared/jarvis-service-menu.ts:430-465` | `_shared/jarvis-service-menu.ts:619-650` | `interactiveId` bruto | dono/gestor/vendedor conforme audiência | resposta/rota do catálogo | `U` catálogo |
| Cofre, portão | Guardar e ler \| Não é documento | `cofre_possivel_guardar:<doc>` \| `cofre_possivel_liberar:<doc>` | `processor/index.ts:26350-26365` | `processor/index.ts:25135-25255` | `interactiveId` direto | documento possível no cofre | OCR seguro ou libera foto | `U`; leitura depende de bytes cifrados |
| CRLV lido | Salvar na plataforma \| Vistoria \| Desfazer vínculo | `cofre_doc_salvar:<doc>[:<veículo>]` \| `cofre_doc_vistoria:<doc>` \| `cofre_doc_desvincular:<doc>:<veículo>` | `_shared/crlv-whatsapp.ts:49-77` | `processor/index.ts:25260-25380` | `interactiveId` direto | documento lido; veículo opcional | confirma, abre vistoria ou desfaz vínculo | `P1` |
| Cofre, vínculo | Vincular \| escolher veículo | `cofre_doc_vincular:<doc>` \| `cofre_doc_link:<doc>:<veículo>` | `processor/index.ts:25325-25340` | `processor/index.ts:25260-25380` | `interactiveId` direto | documento e estoque | lista/vincula veículo | `P1` |
| Foto de veículo | Criar arte \| Postar \| Meta Ads \| FIPE \| Vistoria/Troca \| Corrigir modelo \| Editar foto | `vehicle_photo_action:ad\|post\|meta\|fipe\|troca\|correct\|edit:<media>` | `_shared/vehicle-photo-direct-menu.ts:140-200` | `processor/index.ts:18980-19195` | marcador em `userContent`; prefixo está na allowlist de listas | `pending_vehicle_identification` da mesma mídia, ≤30 min | abre ação usando a mídia explícita | `U` |
| Pós-FIPE | Arte \| Postar \| Meta \| Troca \| Corrigir \| Editar | `vehicle_post_fipe:ad\|post\|meta\|troca\|correct\|edit` | `_shared/vehicle-post-fipe-menu.ts:44-88` | `processor/index.ts:19195-19380` | marcador em `userContent`; allowlist | identificação/foto válida | próximo passo | `U` |
| Identificação | Confirmar \| Corrigir | `vehicle_identification:confirm\|correct` | `_shared/vehicle-identification.ts:220-233` | `processor/index.ts:20045-20120` | marcador em `userContent` | `pending_vehicle_identification` | confirma ou corrige modelo | `U` |
| Correção de modelo | sugestão \| outro \| marca \| modelo | `vehicle_model_fix:alt:<n>` \| `other` \| `brand:<código>` \| `model:<marca>:<modelo\|more>` | `_shared/vehicle-model-correction-wa.ts:45-123` | `processor/index.ts:18070-18240` | marcador em `userContent`; allowlist para listas | identificação aguardando correção | troca identificação da mesma foto | `U` |
| Foto única | Anúncio \| Editar \| Post nas redes | `single_photo:ad\|edit\|post` | `_shared/single-photo-flow.ts:1-10` | `processor/index.ts:20655-20760` | marcador em `userContent` | `pending_single_photo` ≤30 min | inicia anúncio/edição/post | `U` |
| Foto única, destino | Feed \| Story \| LinkedIn \| TikTok | `single_photo:destination:photo_feed\|photo_story\|photo_linkedin\|photo_tiktok` | `processor/index.ts:20735-20757` | `processor/index.ts:20759-20808` | deveria ler marcador em `userContent` | `pending_single_photo.stage=destination` | publica a mídia explícita | `P1 🔴` marcador removido |
| Foto única, formato | Feed \| Story | `single_photo:format:feed\|story` | `_shared/single-photo-flow.ts:13-20` | `processor/index.ts:20810-20835` | marcador em `userContent` | `pending_single_photo.stage=format` | prepara post | `U` |
| Lote de fotos | Carrossel \| Anúncio \| Nada agora | `vehicle_photo_batch:carousel\|ad\|none` | `_shared/vehicle-carousel.ts:170-190,280-288` | `processor/index.ts:20300-20470` | marcador em `userContent` | `pending_vehicle_photo_batch` | inicia fluxo escolhido | `U` |
| Carrossel, coleta | Pronto \| Adicionar \| Cancelar | `vehicle_carousel:photos:done\|photos:add\|cancel` | `_shared/vehicle-carousel.ts:200-223` | `processor/index.ts:20838-20945` | marcador em `userContent` | `pending_vehicle_carousel` | avança/coleta/cancela | `U` |
| Carrossel, dados/foto/formato | últimos dados \| novos; original \| melhorada; 4:5 \| 1:1 | `vehicle_carousel:data:last\|new`; `photo:original\|melhorada`; `format:portrait\|square` | `_shared/vehicle-carousel.ts:228-266` | `processor/index.ts:20890-20990` | marcador em `userContent` | etapa correspondente | renderiza carrossel | `U` |
| Carrossel, entrega | Enviar \| Publicar \| Salvar | `vehicle_carousel:deliver\|publish\|save` | `_shared/vehicle-carousel.ts:268-276` | `processor/index.ts:20992-21065` | marcador em `userContent` | `stage=delivered` | entrega/publica/salva | `U` |
| Carrossel, confirmação | Publicar \| Cancelar | `vehicle_carousel:confirm:<token>` \| `cancel:<token>` | `processor/index.ts:21090-21105` | `processor/index.ts:21107-21145` | marcador em `userContent` | token do carrossel | confirma/cancela fila social | `U` |
| Anúncio, agência | Outra loja \| AMZ \| enviar logo | `anuncio_other_store` \| `anuncio_use_amz` \| `anuncio_send_client_logo` | `_shared/anuncio-tenant-brand.ts:10-31` | `processor/index.ts:21694-21885` | marcador em `userContent` | `pending_anuncio_cliente` + `media_id` | retoma anúncio da mesma foto | `U` (teste antigo espelha montagem) |
| Anúncio, estilo | Impacto \| Catálogo \| Destaque \| trocar estilo | `anuncio_style:impacto\|catalogo\|destaque` \| `anuncio_other_styles` | `_shared/anuncio-style.ts:32-47`; `_shared/anuncio-social-flow.ts:150-160` | `processor/index.ts:21340-21515` | marcador em `userContent` | `pending_anuncio_styles` | renderiza estilo escolhido | `U` |
| Anúncio, foto | Melhorar \| Original \| refazer \| preferência | `anuncio_photo:melhorada\|original\|retry_treatment`; `anuncio_photo:redo:<tipo>`; `anuncio_photo_pref:always:<tipo>\|once` | `_shared/anuncio-style.ts:225-259`; `processor/index.ts:17090,17280` | `processor/index.ts:21135-21340` | marcador em `userContent` | `pending_anuncio_photo` | trata/seleciona a foto explícita | `U` |
| Anúncio pronto | Publicar \| Agendar \| trocar estilo | `anuncio_post:action:publish\|schedule` \| `anuncio_other_styles` | `_shared/anuncio-social-flow.ts:147-160` | `processor/index.ts:21520-21565` | marcador em `userContent` | `pending_anuncio_post` | escolhe publicação | `U` |
| Destino/formato/rede | destinos de foto/vídeo; Feed/Story; ambas/IG/FB | `anuncio_post:destination:<destino>`; `anuncio_post:format:feed\|story\|feed_story`; `anuncio_post:networks:both\|instagram\|facebook` | `_shared/anuncio-social-flow.ts:168-275` | `processor/index.ts:21563-21690` | marcador em `userContent`; `anuncio_post:` está na allowlist | `pending_anuncio_post` | configura canais/formato | `U` |
| Legenda do anúncio | A/B/C \| outras \| personalizada | `social_variant:A\|B\|C:<token>`; `anuncio_post:caption:regenerate\|custom` | `_shared/social-approval-flow.ts:69-83`; `_shared/anuncio-social-flow.ts:298-310` | `processor/index.ts:19420-19520,22180-22285` | marcador em `userContent` | post pendente/token | escolhe/regenera legenda | `U` |
| Confirmação social | confirmar/publicar/agendar/cancelar | `social_publish_confirm:<token>`; `social_publish\|publish_confirm\|schedule\|cancel:<token>`; `anuncio_post:confirm\|cancel\|schedule_confirm:<token>` | `processor/index.ts:8690-8702`; `_shared/anuncio-social-flow.ts:328-360` | `processor/index.ts:19420-19990,22285-22635` | marcador em `userContent` | token em `social_posts_queue`/estado | publica, agenda ou cancela | `U` |
| Mídia pronta, botões | Publicar \| Agendar \| ajustar/trocar legenda | `ready_media:publish\|schedule\|edit\|caption:<foto\|video>:<media>` | `_shared/ready-media-actions.ts:24-47` | `processor/index.ts:18280-20040` | marcador em `userContent` | mídia da biblioteca | abre publicação/agenda/edição | `U` |
| Mídia pronta, lista da foto | Publicar \| Agendar \| Ajustar \| Marca | `ready_media:publish\|schedule\|edit\|brand:foto:<media>` | `_shared/ready-media-actions.ts:50-77` | `processor/index.ts:18280-20040` | deveria ler marcador em `userContent` | mídia da biblioteca | ação sobre a foto | `P1 🔴` 4 IDs sem marcador |
| Agendamento de vídeo | Hoje 18h \| amanhã 10h/18h \| outro | `ready_media:schedule_at:today_18\|tomorrow_10\|tomorrow_18\|custom:video:<media>` | `_shared/ready-media-actions.ts:146-170` | `processor/index.ts:18280-20040` | deveria ler marcador em `userContent` | vídeo e agendamento pendente | escolhe horário | `P1 🔴` 4 IDs sem marcador |
| Vídeo pronto | refazer 9:16; legenda A/B/C | `ready_media:rerender_reels:video:<media>`; `ready_media:caption_choice:A\|B\|C:video:<media>` | `_shared/ready-media-actions.ts:80-88,113-123` | `processor/index.ts:18280-20040` | marcador em `userContent` | mídia pronta | rerender/escolhe legenda | `U` |
| Edição de imagem | tentar de novo | `image_edit:retry` | `_shared/ready-media-actions.ts:90-102` | `processor/index.ts:18540-18670` | marcador em `userContent` | `pending_image_edit` | repete edição | `U` |
| Logo na imagem | inferior direita \| superior esquerda \| inferior centro | `vehicle_brand_position:bottom-right\|top-left\|bottom-center:<media>` | `_shared/vehicle-brand-actions.ts:7-24` | `processor/index.ts:18280-20040` | deveria ler marcador em `userContent` | foto + pedido de marca | aplica logo na posição | `P1 🔴` 3 IDs sem marcador |
| Marca | minha marca \| site \| sem marca | `brand_image_logo\|site\|none` | `processor/index.ts:2080-2093` | `processor/index.ts:18290-18620`; `_shared/whatsapp-image-brand.ts:215-245` | marcador em `userContent` | `pending_brand_generation` | gera arte conforme marca | `U` |
| Logo enviada | salvar \| usar uma vez | `brand_uploaded_logo_save\|once` | `_shared/whatsapp-image-brand.ts:188-199` | `_shared/whatsapp-image-brand.ts:247-254`; processor | `interactiveId`/marcador | logo recebida | salva ou usa uma vez | `U` |
| FIPE | modelo/mais \| ano \| repetir \| FIPE/minha | `fipe_model:<n>\|more:<offset>`; `fipe_year:<n>`; `fipe_price:retry`; `fipe_ad:queried\|supplied` | `_shared/fipe.ts:86-105,150-160`; `processor/index.ts:16735-16750` | `processor/index.ts:16245-16475` | marcador em `userContent`; `fipe_` está na allowlist | `pending_fipe` | consulta/seleciona valor | `U` |
| Vídeo Motion | template, fundo, trilha, identidade, paleta, logo/site, continuar/substituir | `video_template_conversa\|institucional\|lista`; `video_background_dark\|light`; `video_track_none\|more\|back\|_<uuid>`; `video_identity_tenant\|client\|send_logo\|manual_colors`; `video_palette_primary_<hex>\|secondary_<hex>\|secondary_none\|retry\|use\|default`; `video_site_logo_use\|reject`; `video_pending_continue\|replace` | `processor/index.ts:11905-12150,12560-12575` | `processor/index.ts:12725-13055,21885-21915` | marcador em `userContent`; `video_` está na allowlist | `pending_video_setup` | configura/retoma vídeo | `U` |
| Vídeo transcrito | tentar de novo \| escrever tema | `video_transcription:retry\|write:<media>` | `_shared/video-transcription-flow.ts:220-234` | processor + `_shared/video-transcription-flow.ts:238-246` | marcador em `userContent` | transcrição falhou | repete ou pede texto | `U` |
| Vídeo legendado | com logo \| sem logo | `video_legenda_com_logo\|sem_logo` | `_shared/video-legenda-logo.ts:1-13` | `_shared/video-legenda-logo.ts:17-36`; processor | marcador em `userContent` | job de legenda | renderiza opção | `U` |
| TikTok | tipo comercial \| privacidade | `tiktok_disclosure:non_commercial\|brand_organic\|branded_content`; `tiktok_privacy:<opção>` | `_shared/tiktok-whatsapp-consent.ts:68-95` | processor `_shared/tiktok-whatsapp-consent.ts:35-64` | marcador em `userContent`; prefixo está na allowlist | publicação TikTok pendente | registra consentimento/privacidade | `U` |
| Vertical | veículo \| outro produto | `vertical:vehicle\|general` | `_shared/vertical-router.ts:570-585` | `processor/index.ts:29345-29520` | marcador em `userText` | `pending_choice` | escolhe vertical | `U` |
| Segmento/demo | automotivo \| outro; confirmar \| cancelar | `vertical_segment:automotive\|other`; `vertical_demo:confirm\|cancel` | `_shared/vertical-router.ts:587-633` | `processor/index.ts:29345-29470` | marcador em `userText` | dono/configuração | salva segmento/demo | `U` |
| Confirmação da foto | produto \| veículo \| corrigir | `owner_photo:confirm_product\|confirm_vehicle\|correct` (automotivo não emite “produto”) | `_shared/owner-photo-confirm.ts:34-55` | processor + `_shared/owner-photo-confirm.ts:57-68` | marcador em `userContent` | confirmação visual | define rota/correção | `U` |
| Meta Ads | objetivo, público, cidade, raio, idade, orçamento, duração, texto, mídia, publicar/ajustar/cancelar | `meta_ads_q:<etapa>:<valor>`; `midia:<media>`; `publicar:<hash>`; `ajustar:<etapa>` | `processor/index.ts:5280-6060`; `_shared/meta-ads-questionario.ts:255-290,510-650` | `processor/index.ts:5275-6150,29745-29900` | `interactiveId`/marcador; prefixo allowlist | rascunho/questionário | avança campanha | `U` |
| Limite Meta | Confirmar \| Cancelar | `meta_ads_limit:confirm\|cancel:<token>` | `_shared/meta-ads-questionario.ts:340-352` | `_shared/meta-ads-questionario.ts:360-380`; processor | `interactiveId` | `pending_meta_ads_limit` | altera/cancela limite | `U` |
| Gestão | confirmação financeira SIM/NÃO | não há `gestao_*` emitido neste código; usa texto SIM/NÃO e `pending_gestao_confirm` | `_shared/gestao-inbound.ts:740-805,915-1050` | mesmo arquivo | texto + estado | `pending_gestao_confirm` | confirma/cancela lançamento | `U` |
| Vistoria/troca | escolher troca | `gestao_troca_wa:pick:<troca>` | `_shared/gestao-troca-whatsapp.ts:255-273` | `_shared/gestao-troca-whatsapp.ts:480-550`; processor early | `interactiveId`/marcador | troca existente | entrega resumo/laudo | `U` |
| Molicar | Procedência \| Usar na troca \| Cadastrar \| confirmar/cancelar | `molicar_wa:procedencia\|troca\|cadastrar:<placa>`; `procedencia_confirmar\|procedencia_cancelar` | `_shared/veiculo-procedencia-inbound.ts:130-172` | `_shared/veiculo-procedencia-inbound.ts:184-350` via Gestão | o atalho recebe `interactiveId`, mas não o repassa ao handler de procedência | placa/cache/pending | consulta ou encaminha | `P1 🔴` nas 3 ações com placa; confirmar/cancelar por texto funciona |
| Cotação parceiro | aceitar/sem agenda, enviar, confirmar/corrigir, mídia, assunto, escolher cotação | `os_cot_wa:aceite\|sem_agenda:<cotação>`; `enviar_orcamento`; `confirmar_sim\|confirmar_corrigir`; `midia_sim`; `outro_assunto`; `pick_<cotação>` | `_shared/os-parceiro-whatsapp-envio.ts:275-290`; `_shared/os-parceiro-interactive.ts:35-42`; `_shared/os-parceiro-inbound.ts:850-870` | `_shared/os-parceiro-inbound.ts:350-900` | `interactiveId` direto do payload | parceiro/cotação ativa | aceita e envia/confirma orçamento | `U` |
| Vitrine cliente | fotos/detalhe/interesse/consultor; marca; troca/financiamento; noop | `veiculo_vitrine:fotos\|detalhe\|interesse:<veículo>`; `consultor[:<veículo>]`; `marca:<slug>`; `acao:troca\|financiamento:<veículo>`; `noop:<card>:<botão>` | `_shared/whatsapp-interactive-carousel.ts:50-72`; construtores da vitrine | `_shared/vehicle-stock-whatsapp.ts:430-590`; processor early | `interactiveId` separado | cliente + vitrine/pending | detalhe, lead ou formulário | `U` |
| Opt-in/out | Sim \| Não/STOP | `OPTIN_SIM`, `OPTIN_NAO`, `OPTIN_STOP` | template Meta externo; comentário em `processor/index.ts:25520-25540` | `processor/index.ts:25535-25880` | `button.payload` direto | convite pendente (STOP é universal) | confirma/recusa consentimento | `—` |

## Resultado por ID

### Verdes com clique real do `processOne`

1. `jarvis_menu:grupo:marketing`.
2. `cofre_doc_salvar:<doc>:<veículo>`.
3. `cofre_doc_vistoria:<doc>`.
4. `cofre_doc_desvincular:<doc>:<veículo>`.
5. `cofre_doc_vincular:<doc>`.
6. `cofre_doc_link:<doc>:<veículo>`.
7. Saudação pura (sem ID) com estado pendente — abre menu e limpa o estado.
8. `OPTIN_SIM`.
9. `OPTIN_NAO`/`OPTIN_STOP`.
10. Confirmação textual de `pending_gestao_confirm` (J9).
11. `os_cot_wa:enviar_orcamento`.
12. `veiculo_vitrine:detalhe:<veículo>`.

Além desses, os três formatos de payload Meta são aceitos pelo harness. Os
demais IDs têm cobertura isolada (`U`) ou ainda não têm prova de ponta a ponta.

### Vermelhos funcionais reproduzidos

O `extractText` de `interactive.list_reply` em
`processor/index.ts:1050-1070` usa uma allowlist. As três famílias abaixo não
estão nela, portanto o título chega ao `callGemini` sem
`<<INTERACTIVE_ID:...>>`; seus parsers só leem o marcador de `userContent`.

| IDs vermelhos | quantidade | causa | correção sugerida (não aplicada) |
|---|---:|---|---|
| `ready_media:publish\|schedule\|edit\|brand:foto:<media>` | 4 | lista `readyVehiclePhotoActionList` perde ID | anexar marcador para todo `list_reply`, ou passar `interactiveId` ao `callGemini` |
| `ready_media:schedule_at:today_18\|tomorrow_10\|tomorrow_18\|custom:video:<media>` | 4 | lista de horário perde ID | mesma correção |
| `vehicle_brand_position:bottom-right\|top-left\|bottom-center:<media>` | 3 | lista de posição perde ID | mesma correção |
| `single_photo:destination:photo_feed\|photo_story\|photo_linkedin\|photo_tiktok` | 4 | lista de destino perde ID | mesma correção |
| `molicar_wa:procedencia\|troca\|cadastrar:<placa>` | 3 | `tryProcessGestaoLucroShortcut` remove o marcador e `tryProcessGestaoLucroInbound` não repassa `interactiveId` para `tryProcessVeiculoProcedenciaInbound` | repassar `interactiveId` ou reconstruir o texto de controle |

Total funcional: **18 IDs vermelhos** em **5 famílias**. Nenhuma correção foi
aplicada nesta auditoria.

## Jornadas

| jornada | resultado | evidência/causa |
|---|---|---|
| J1 saudação → menu → Marketing → item | 🟢 parcial | saudação e clique Marketing passam no `processOne`; item tem teste isolado, não sequência completa |
| J2 foto → anúncio → preço → marca → estilo → publicar | 🟡 sem prova completa | parsers/estados têm testes isolados; geração externa não foi encadeada no harness |
| J3 foto → Postar → destino/formato → legenda → publicar/agendar | 🔴 | `single_photo:destination:*` perde o ID no `list_reply` |
| J4 editar imagem → resultado → publicar | 🔴 | a lista de ações de foto pronta (`ready_media:*`) perde o ID |
| J5 várias fotos → carrossel → Pronto → publicar | 🟡 sem prova completa | etapas têm testes isolados; não há sequência `processOne` completa |
| J6 CRLV → guardar/ler → salvar/vistoria/desvincular | 🟢 parcial | ações pós-leitura passam no `processOne`; OCR cifrado não foi simulado |
| J7 Não é documento → rota normal | 🟡 sem prova completa | teste isolado garante que não cria Gestão; bytes cifrados não foram simulados no harness |
| J8 placa → Molicar → Procedência → confirmar | 🔴 | os três botões com placa (`procedencia`, `troca`, `cadastrar`) perdem o ID antes do handler |
| J9 Gestão despesa → SIM/NÃO | 🟢 parcial | confirmação SIM foi executada pelo `processOne`; início por linguagem natural não foi encadeado |
| J10 parceiro com cotação → mídia/valor → confirmar | 🟢 parcial | `os_cot_wa:enviar_orcamento` iniciou a sessão no `processOne`; mídia/valor/confirmação não foram encadeados |
| J11 cliente na vitrine | 🟢 parcial | `veiculo_vitrine:detalhe:<veículo>` passou pelo handler early do `processOne`; outros botões continuam só com testes isolados |
| J12 vídeo → legenda A/B/C → publicar | 🔴 | publicação direta por botão funciona isoladamente, mas agendamento cai na lista `ready_media:schedule_at:*`, que perde o ID |
| J13 saudação com fluxo pendente → menu | 🟢 | `processOne` real abre menu e limpa pendências |

Contagem estrita de jornadas: **6 verdes/parciais, 4 vermelhas funcionais e 3
sem prova completa**. “Parcial” não deve ser interpretado como certificação
de toda a jornada.

## OCR de proteção

O comando de rollback não foi executado por este agente: o ambiente de código
não é o servidor e não possui Docker (`docker: command not found`). Não existe
saída válida `OCR no ar: ...` para reportar. O rollback para
`amz-ocr:7db2991e` continua dependente da execução no host que contém
`/root/amz-ocr.env`.
