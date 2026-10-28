# AUDIT-BOTOES — inventário e clique simulado

Base auditada: `70a7eb5`; correções `FIX-BOTOES-1` aplicadas sobre
`01bc6244` (`cursor/menu-b1`).

## Método

- `P1`: o teste chama o `processOne` exportado, com payload Meta real
  (`interactive.button_reply`, `interactive.list_reply` ou `button.payload`),
  banco Supabase em memória e `fetch` falso.
- `U`: existe teste isolado do parser/handler, mas ele não prova a montagem
  feita pelo `processOne`.
- `—`: sem prova automatizada de clique real.
- `🔴`: falha reproduzida pelo `processOne` real.

A única injeção mantida é `setProcessOneSupabaseForTest`; a função usa o mesmo
`processOne` de produção. O `Deno.serve` voltou a ser incondicional porque o
router de produção importa o módulo. O harness substitui `Deno.serve` antes
do import dinâmico e comprova que exatamente um handler foi registrado.

## Inventário

As linhas com alternativas separadas por `|` representam IDs emitidos pelo
mesmo construtor e tratados pelo mesmo bloco. IDs com UUID/token/código são
famílias dinâmicas; o valor dinâmico está entre `<...>`.

| área | texto do botão/lista | ID/prefixo | criado em | trata o clique | lê o ID de | estado necessário | efeito esperado | teste |
|---|---|---|---|---|---|---|---|---|
| Menu raiz | Marketing \| Gestão \| Vistoria e Troca | `jarvis_menu:grupo:marketing\|gestao\|vistoria_troca` | `_shared/jarvis-service-menu.ts:414-426` | `_shared/jarvis-service-menu.ts:529-650`; `processor/index.ts:29915-29960` | `interactiveId` bruto no processor | dono/gestor; menu habilitado | abre grupo | `P1` Marketing |
| Menu listas | filhos e “Voltar” | `jarvis_menu:lista:<id>` | `_shared/jarvis-service-menu.ts:430-465` | `_shared/jarvis-service-menu.ts:619-650` | `interactiveId` bruto | papel com acesso | navega árvore | `U` |
| Menu recentes | slots recentes 1/2 | `jarvis_menu:lista:<lista>:recent:1\|2` | `_shared/jarvis-menu-tree.ts:45-62` | não há handler alcançável | estado recente | nenhum: `renderMenuList` filtra `kind === "recent"` antes do envio | não emitido nesta base | `U` da árvore |
| Menu itens | item do catálogo | `jarvis_menu:item:<id>`; IDs: `estoque-resumo`, `estoque-busca`, `oficina-os`, `cotacoes`, `gerar-arte`, `editar-foto`, `publicar-midia`, `gerar-publicar`, `agendar-post`, `listar-posts-agendados`, `video`, `anuncios-relatorio`, `campanha-status`, `fipe`, `preco-painel`, `lembrete`, `mensagem-contato`, `resumos-config`, `estoque-vendidos`, `estoque-giro`, `estoque-abrir`, `equipe-comissoes-ajuda`, `notas-contratos-ajuda`, `oficina-parceiros`, `documentos-guardar-crlv`, `documentos-cofre`, `documentos-vincular`, `documentos-notas-contratos`, `clientes-resumo`, `clientes-crm`, `clientes-sem-retorno`, `gestao-urgentes`, `gestao-ajuda`, `marketing-carrossel`, `marketing-campanha-meta`, `marketing-ajuda`, `redes-facebook`, `redes-instagram-feed`, `redes-instagram-story`, `redes-tiktok`, `redes-linkedin`, `portal-mercado-livre`, `portal-olx`, `portal-webmotors`, `troca-nova`, `troca-laudos`, `troca-preco-molicar`, `troca-procedencia`, `troca-liberar-estoque`, `troca-ajuda` | `_shared/jarvis-ajuda-catalogo.ts:305-2260`; `_shared/jarvis-service-menu.ts:430-465` | `_shared/jarvis-service-menu.ts:619-650` | `interactiveId` bruto | dono/gestor/vendedor conforme audiência | resposta/rota do catálogo | `U` catálogo |
| Cofre, portão | Guardar e ler \| Não é documento | `cofre_possivel_guardar:<doc>` \| `cofre_possivel_liberar:<doc>` | `processor/index.ts:26350-26365` | `processor/index.ts:25135-25255` | `interactiveId` direto | documento possível no cofre | OCR seguro ou libera foto | `U`; leitura depende de bytes cifrados |
| CRLV lido | Salvar na plataforma \| Vistoria \| Desfazer vínculo | `cofre_doc_salvar:<doc>[:<veículo>]` \| `cofre_doc_vistoria:<doc>` \| `cofre_doc_desvincular:<doc>:<veículo>` | `_shared/crlv-whatsapp.ts:49-77` | `processor/index.ts:25260-25380` | `interactiveId` direto | documento lido; veículo opcional | confirma, abre vistoria ou desfaz vínculo | `P1` |
| Cofre, vínculo | Vincular \| escolher veículo | `cofre_doc_vincular:<doc>` \| `cofre_doc_link:<doc>:<veículo>` | `processor/index.ts:25325-25340` | `processor/index.ts:25260-25380` | `interactiveId` direto | documento e estoque | lista/vincula veículo | `P1` |
| Foto de veículo | Criar arte \| Postar \| Meta Ads \| FIPE \| Vistoria/Troca \| Corrigir modelo \| Editar foto | `vehicle_photo_action:ad\|post\|meta\|fipe\|troca\|correct\|edit:<media>` | `_shared/vehicle-photo-direct-menu.ts:140-200` | `processor/index.ts:18980-19195` | marcador em `userContent` | última foto do usuário; identificação da mesma ID | abre ação na última foto recebida | `P1` J2 |
| Pós-FIPE | Arte \| Postar \| Meta \| Troca \| Corrigir \| Editar | `vehicle_post_fipe:ad\|post\|meta\|troca\|correct\|edit` | `_shared/vehicle-post-fipe-menu.ts:44-88` | `processor/index.ts:19195-19380` | marcador em `userContent` | identificação/foto válida | próximo passo | `U` |
| Identificação | Confirmar \| Corrigir | `vehicle_identification:confirm\|correct` | `_shared/vehicle-identification.ts:220-233` | `processor/index.ts:20045-20120` | marcador em `userContent` | `pending_vehicle_identification` | confirma ou corrige modelo | `U` |
| Correção de modelo | sugestão \| outro \| marca \| modelo | `vehicle_model_fix:alt:<n>` \| `other` \| `brand:<código>` \| `model:<marca>:<modelo\|more>` | `_shared/vehicle-model-correction-wa.ts:45-123` | `processor/index.ts:18070-18240` | marcador em `userContent` | identificação aguardando correção | troca identificação da mesma foto | `U` |
| Foto única | Anúncio \| Editar \| Post nas redes | `single_photo:ad\|edit\|post` | `_shared/single-photo-flow.ts:1-10` | `processor/index.ts:20655-20760` | marcador em `userContent` | `pending_single_photo` | inicia anúncio/edição/post | `P1` J3/J4 |
| Foto única, destino | Feed \| Story \| LinkedIn \| TikTok | `single_photo:destination:photo_feed\|photo_story\|photo_linkedin\|photo_tiktok` | `processor/index.ts:20735-20757` | `processor/index.ts:20759-20808` | marcador em `userContent`; todo `list_reply` o preserva | `pending_single_photo.stage=destination` | publica a mídia explícita | `P1` 4/4 |
| Foto única, formato | Feed \| Story | `single_photo:format:feed\|story` | `_shared/single-photo-flow.ts:13-20` | `processor/index.ts:20810-20835` | marcador em `userContent` | `pending_single_photo.stage=format` | prepara post | `U` |
| Lote de fotos | Carrossel \| Anúncio \| Nada agora | `vehicle_photo_batch:carousel\|ad\|none` | `_shared/vehicle-carousel.ts:170-190,280-288` | `processor/index.ts:20300-20470` | marcador em `userContent` | `pending_vehicle_photo_batch` | inicia fluxo escolhido | `U` |
| Carrossel geral, estilo/cor | estilos dinâmicos/fallback; cor da marca/azul/roxo | `carrossel_estilo_<slug>`; `carrossel_cor_<slug>` | `_shared/carousel-styles.ts:170-198`; `_shared/carousel-colors.ts:145-190` | resolvers do carrossel + `processor/index.ts:17550,23250-23410` | marcador em `userContent` | `pending_carousel` | escolhe template e cor | `U` |
| Carrossel, coleta | Pronto \| Adicionar \| Cancelar | `vehicle_carousel:photos:done\|photos:add\|cancel` | `_shared/vehicle-carousel.ts:200-223` | `processor/index.ts:20838-20945` | marcador em `userContent` | `pending_vehicle_carousel` | avança/coleta/cancela | `U` |
| Carrossel, dados/foto/formato | últimos dados \| novos; original \| melhorada; 4:5 \| 1:1 | `vehicle_carousel:data:last\|new`; `photo:original\|melhorada`; `format:portrait\|square` | `_shared/vehicle-carousel.ts:228-266` | `processor/index.ts:20890-20990` | marcador em `userContent` | etapa correspondente | renderiza carrossel | `U` |
| Carrossel, entrega | Enviar \| Publicar \| Salvar | `vehicle_carousel:deliver\|publish\|save` | `_shared/vehicle-carousel.ts:268-276` | `processor/index.ts:20992-21065` | marcador em `userContent` | `stage=delivered` | entrega/publica/salva | `U` |
| Carrossel, confirmação | Publicar \| Cancelar | `vehicle_carousel:confirm:<token>` \| `cancel:<token>` | `processor/index.ts:21090-21105` | `processor/index.ts:21107-21145` | marcador em `userContent` | token do carrossel | confirma/cancela fila social | `U` |
| Anúncio, agência | Outra loja \| AMZ \| enviar logo | `anuncio_other_store` \| `anuncio_use_amz` \| `anuncio_send_client_logo` | `_shared/anuncio-tenant-brand.ts:10-31` | `processor/index.ts:21694-21885` | marcador em `userContent` | `pending_anuncio_cliente` + `media_id` | retoma anúncio da mesma foto | `U` (teste antigo espelha montagem) |
| Anúncio, estilo | Impacto \| Catálogo \| Destaque \| trocar estilo | `anuncio_style:impacto\|catalogo\|destaque` \| `anuncio_other_styles` | `_shared/anuncio-style.ts:32-47`; `_shared/anuncio-social-flow.ts:150-160` | `processor/index.ts:21340-21515` | marcador em `userContent` | `pending_anuncio_styles` | renderiza estilo escolhido | `U` |
| Anúncio, foto | Melhorar \| Original \| refazer \| preferência | `anuncio_photo:melhorada\|original\|retry_treatment`; `anuncio_photo:redo:<tipo>`; `anuncio_photo_pref:always:<tipo>\|once` | `_shared/anuncio-style.ts:225-259`; `processor/index.ts:17090,17280` | `processor/index.ts:21135-21340` | marcador em `userContent` | `pending_anuncio_photo` | trata/seleciona a foto explícita | `U` |
| Anúncio pronto | Publicar \| Agendar \| trocar estilo | `anuncio_post:action:publish\|schedule` \| `anuncio_other_styles` | `_shared/anuncio-social-flow.ts:147-160` | `processor/index.ts:21520-21565` | marcador em `userContent` | `pending_anuncio_post` | escolhe publicação | `U` |
| Destino/formato/rede | destinos de foto/vídeo; Feed/Story; ambas/IG/FB | `anuncio_post:destination:<destino>`; `anuncio_post:format:feed\|story\|feed_story`; `anuncio_post:networks:both\|instagram\|facebook` | `_shared/anuncio-social-flow.ts:168-275` | `processor/index.ts:21563-21690` | marcador em `userContent` | `pending_anuncio_post` | configura canais/formato | `U` |
| Legenda do anúncio | A/B/C \| outras \| personalizada | `social_variant:A\|B\|C:<token>`; `anuncio_post:caption:regenerate\|custom` | `_shared/social-approval-flow.ts:69-83`; `_shared/anuncio-social-flow.ts:298-310` | `processor/index.ts:19420-19520,22180-22285` | marcador em `userContent` | post pendente/token | escolhe/regenera legenda | `U` |
| Confirmação social | confirmar/publicar/agendar/cancelar | `social_publish_confirm:<token>`; `social_publish\|publish_confirm\|schedule\|cancel:<token>`; `anuncio_post:confirm\|cancel\|schedule_confirm:<token>` | `processor/index.ts:8690-8702`; `_shared/anuncio-social-flow.ts:328-360` | `processor/index.ts:19420-19990,22285-22635` | marcador em `userContent` | token em `social_posts_queue`/estado | publica, agenda ou cancela | `U` |
| Legenda fallback | opção A/B/C sem mídia identificada | `reply_text:<letra>` | `_shared/ready-media-actions.ts:113-123` | `_shared/ready-media-actions.ts:268-275` antes do roteamento | `replyTextFromInteractiveId` | fallback sem `media_id` | transforma ID em texto | sem sender de produção confirmado |
| Mídia pronta, botões | Publicar \| Agendar \| ajustar/trocar legenda | `ready_media:publish\|schedule\|edit\|caption:<foto\|video>:<media>` | `_shared/ready-media-actions.ts:24-47` | `processor/index.ts:18280-20040` | marcador em `userContent` | mídia da biblioteca | abre publicação/agenda/edição | `U` |
| Mídia pronta, lista da foto | Publicar \| Agendar \| Ajustar \| Marca | `ready_media:publish\|schedule\|edit\|brand:foto:<media>` | `_shared/ready-media-actions.ts:50-77` | `processor/index.ts:18280-20040` | marcador em `userContent`; todo `list_reply` o preserva | mídia da biblioteca | ação sobre a foto | `P1` 4/4 |
| Agendamento de vídeo | Hoje 18h \| amanhã 10h/18h \| outro | `ready_media:schedule_at:today_18\|tomorrow_10\|tomorrow_18\|custom:video:<media>` | `_shared/ready-media-actions.ts:146-170` | `processor/index.ts:18280-20040` | marcador em `userContent`; todo `list_reply` o preserva | vídeo e agendamento pendente | escolhe horário | `P1` 4/4 |
| Vídeo pronto | refazer 9:16; legenda A/B/C | `ready_media:rerender_reels:video:<media>`; `ready_media:caption_choice:A\|B\|C:video:<media>` | `_shared/ready-media-actions.ts:80-88,113-123` | `processor/index.ts:18280-20040` | marcador em `userContent` | mídia pronta | rerender/escolhe legenda | `U` |
| Edição de imagem | tentar de novo | `image_edit:retry` | `_shared/ready-media-actions.ts:90-102` | `processor/index.ts:18540-18670` | marcador em `userContent` | `pending_image_edit` | repete edição | `U` |
| Logo na imagem | inferior direita \| superior esquerda \| inferior centro | `vehicle_brand_position:bottom-right\|top-left\|bottom-center:<media>` | `_shared/vehicle-brand-actions.ts:7-24` | `processor/index.ts:18280-20040` | marcador em `userContent`; todo `list_reply` o preserva | foto + pedido de marca | aplica logo na posição | `P1` 3/3 |
| Marca | minha marca \| site \| sem marca | `brand_image_logo\|site\|none` | `processor/index.ts:2080-2093` | `processor/index.ts:18290-18620`; `_shared/whatsapp-image-brand.ts:215-245` | marcador em `userContent` | `pending_brand_generation` | gera arte conforme marca | `U` |
| Logo enviada | salvar \| usar uma vez | `brand_uploaded_logo_save\|once` | `_shared/whatsapp-image-brand.ts:188-199` | `_shared/whatsapp-image-brand.ts:247-254`; processor | `interactiveId`/marcador | logo recebida | salva ou usa uma vez | `U` |
| FIPE | modelo/mais \| ano \| repetir \| FIPE/minha | `fipe_model:<n>\|more:<offset>`; `fipe_year:<n>`; `fipe_price:retry`; `fipe_ad:queried\|supplied` | `_shared/fipe.ts:86-105,150-160`; `processor/index.ts:16735-16750` | `processor/index.ts:16245-16475` | marcador em `userContent` | `pending_fipe` | consulta/seleciona valor | `U` |
| Vídeo Motion | template, fundo, trilha, identidade, paleta, logo/site, continuar/substituir | `video_template_conversa\|institucional\|lista`; `video_background_dark\|light`; `video_track_none\|more\|back\|_<uuid>`; `video_identity_tenant\|client\|send_logo\|manual_colors`; `video_palette_primary_<hex>\|secondary_<hex>\|secondary_none\|retry\|use\|default`; `video_site_logo_use\|reject`; `video_pending_continue\|replace` | `processor/index.ts:11905-12150,12560-12575` | `processor/index.ts:12725-13055,21885-21915` | marcador em `userContent` | `pending_video_setup` | configura/retoma vídeo | `U` |
| Escolha criativa | Vídeo \| Imagem/arte | `creative_media_video\|creative_media_image` | `processor/index.ts:21945-21975` | `processor/index.ts:21910-21945` | marcador em `userContent` | `pending_creative_media_ambiguity` | escolhe o tipo de mídia | `—` |
| Vídeo transcrito | tentar de novo \| escrever tema | `video_transcription:retry\|write:<media>` | `_shared/video-transcription-flow.ts:220-234` | processor + `_shared/video-transcription-flow.ts:238-246` | marcador em `userContent` | transcrição falhou | repete ou pede texto | `U` |
| Vídeo legendado | com logo \| sem logo | `video_legenda_com_logo\|sem_logo` | `_shared/video-legenda-logo.ts:1-13` | `_shared/video-legenda-logo.ts:17-36`; processor | marcador em `userContent` | job de legenda | renderiza opção | `U` |
| TikTok | tipo comercial \| privacidade | `tiktok_disclosure:non_commercial\|brand_organic\|branded_content`; `tiktok_privacy:<opção>` | `_shared/tiktok-whatsapp-consent.ts:68-95` | processor `_shared/tiktok-whatsapp-consent.ts:35-64` | marcador em `userContent` | publicação TikTok pendente | registra consentimento/privacidade | `U` |
| Vertical | veículo \| outro produto | `vertical:vehicle\|general` | `_shared/vertical-router.ts:570-585` | `processor/index.ts:29345-29520` | marcador em `userText` | `pending_choice` | escolhe vertical | `U` |
| Segmento/demo | automotivo \| outro; confirmar \| cancelar | `vertical_segment:automotive\|other`; `vertical_demo:confirm\|cancel` | `_shared/vertical-router.ts:587-633` | `processor/index.ts:29345-29470` | marcador em `userText` | dono/configuração | salva segmento/demo | `U` |
| Confirmação da foto | produto \| veículo \| corrigir | `owner_photo:confirm_product\|confirm_vehicle\|correct` (automotivo não emite “produto”) | `_shared/owner-photo-confirm.ts:34-55` | processor + `_shared/owner-photo-confirm.ts:57-68` | marcador em `userContent` | confirmação visual | define rota/correção | `U` |
| Meta Ads | objetivo, público, cidade, raio, idade, orçamento, duração, texto, mídia, publicar/ajustar/cancelar | `meta_ads_q:<etapa>:<valor>`; `midia:<media>`; `publicar:<hash>`; `ajustar:<etapa>` | `processor/index.ts:5280-6060`; `_shared/meta-ads-questionario.ts:255-290,510-650` | `processor/index.ts:5275-6150,29745-29900` | `interactiveId`/marcador | rascunho/questionário | avança campanha | `U` |
| Limite Meta | Confirmar \| Cancelar | `meta_ads_limit:confirm\|cancel:<token>` | `_shared/meta-ads-questionario.ts:340-352` | `_shared/meta-ads-questionario.ts:360-380`; processor | `interactiveId` | `pending_meta_ads_limit` | altera/cancela limite | `U` |
| Gestão | confirmação financeira SIM/NÃO | não há `gestao_*` emitido neste código; usa texto SIM/NÃO e `pending_gestao_confirm` | `_shared/gestao-inbound.ts:740-805,915-1050` | mesmo arquivo | texto + estado | `pending_gestao_confirm` | confirma/cancela lançamento | `U` |
| Vistoria/troca | ver recentes \| escolher troca | `gestao_troca_wa:list_recent`; `gestao_troca_wa:pick:<troca>` | `_shared/gestao-troca-whatsapp.ts:255-273,475-490` | `_shared/gestao-troca-whatsapp.ts:480-550`; processor early | `interactiveId`/marcador | troca existente | lista ou entrega resumo/laudo | `U` |
| Molicar | Procedência \| Usar na troca \| Cadastrar \| confirmar/cancelar | `molicar_wa:procedencia\|troca\|cadastrar:<placa>`; `procedencia_confirmar\|procedencia_cancelar` | `_shared/veiculo-procedencia-inbound.ts:130-172` | `_shared/veiculo-procedencia-inbound.ts:184-350` via Gestão | `interactiveId` é repassado até procedência | placa/cache/pending | consulta ou encaminha | `P1` 3/3 + confirmação |
| Cotação parceiro | aceitar/sem agenda, enviar, confirmar/corrigir, mídia, assunto, escolher cotação | `os_cot_wa:aceite\|sem_agenda:<cotação>`; `enviar_orcamento`; `confirmar_sim\|confirmar_corrigir`; `midia_sim`; `outro_assunto`; `pick_<cotação>` | `_shared/os-parceiro-whatsapp-envio.ts:275-290`; `_shared/os-parceiro-interactive.ts:35-42`; `_shared/os-parceiro-inbound.ts:850-870` | `_shared/os-parceiro-inbound.ts:350-900` | `interactiveId` direto do payload | parceiro/cotação ativa | aceita e envia/confirma orçamento | `U` |
| Vitrine cliente | segmento, marca, faixa, estilo, paginação, fotos/detalhe/interesse/consultor, visita, troca e financiamento | `veiculo_vitrine:segmento\|marca\|faixa\|faixa_moto\|estilo\|menu_marcas\|menu_estilos\|fotos\|detalhe\|interesse\|consultor\|acao\|visita_dia\|visita_turno\|fin_*\|troca_obs\|troca_foto\|mais\|voltar_marcas:<sufixo>`; `noop:<card>:<botão>` | `_shared/whatsapp-interactive-carousel.ts:50-72`; `_shared/vehicle-stock-showcase-turn.ts`; `_shared/vehicle-stock-whatsapp.ts` | `_shared/vehicle-stock-whatsapp.ts:430-590`; processor early | `interactiveId` separado | cliente + vitrine/pending/formulário | navega, detalha ou abre lead/formulário | `U`; detalhe `P1` |
| Opt-in/out | Sim \| Não/STOP | `OPTIN_SIM`, `OPTIN_NAO`, `OPTIN_STOP` | template Meta externo; comentário em `processor/index.ts:25520-25540` | `processor/index.ts:25535-25880` | `button.payload` direto | convite pendente (STOP é universal) | confirma/recusa consentimento | `P1` |

## IDs definidos sem sender alcançável confirmado

Estes IDs não entram na contagem de vermelhos funcionais porque não foi
encontrado botão/lista de produção que os envie nesta base:

- `social_publish:<token>`, `social_schedule:<token>` e
  `social_cancel:<token>`: o processor contém handlers, mas nenhum construtor
  de saída correspondente.
- `vehicle_photo_edit:studio` e `vehicle_photo_edit:enhance`: parser e testes
  existem; o menu atual pede prompt livre e não envia esses atalhos.
- `video_draft_confirm`: aparece no teste de regressão, sem sender literal.
- `brand_site_previous`: apenas fixture de teste.
- `jarvis_menu:lista:<lista>:recent:1|2`: a árvore cria os slots, mas o
  renderizador os remove.

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
13. Os 15 `list_reply` antes vermelhos.
14. Os 3 `molicar_wa:*:<placa>` e a confirmação de procedência.
15. `vehicle_photo_action:ad:<media>` → foto original → estilo Impacto →
    publicação da arte.
16. `single_photo:destination:photo_feed` → legenda A.
17. `single_photo:edit` → mídia editada → publicação.
18. `vehicle_carousel:publish` → redes → legenda A → confirmar.
19. `ready_media:caption_choice:A` → agendar → `tomorrow_10`.

Os três formatos de payload Meta são aceitos pelo harness. IDs restantes têm
cobertura isolada (`U`) ou estão listados como sem sender alcançável.

### Resultado dos 18 IDs corrigidos

`extractText` agora anexa `<<INTERACTIVE_ID:...>>` para todo
`interactive.list_reply`, sem allowlist. Gestão repassa `interactiveId` para
procedência. O harness executa os **15 IDs de lista** e os **3 IDs Molicar**
pelo `processOne`.

| família antes vermelha | quantidade | resultado |
|---|---:|---|
| `ready_media:publish\|schedule\|edit\|brand:foto:<media>` | 4 | 🟢 |
| `ready_media:schedule_at:*:video:<media>` | 4 | 🟢 |
| `vehicle_brand_position:*:<media>` | 3 | 🟢 |
| `single_photo:destination:*` | 4 | 🟢 |
| `molicar_wa:procedencia\|troca\|cadastrar:<placa>` | 3 | 🟢 |

Total funcional após `FIX-BOTOES-1`: **18 verdes, 0 vermelhos**.

## Regra de última mídia

`resolveUltimaMidia(conversa, tipo)` é a fonte única. Foi aplicado em:

- criação de anúncio/arte e ações de foto de veículo;
- edição de imagem e aplicação/posição de logo;
- composição com o último grupo de fotos;
- publicação de foto/vídeo e mídia pronta;
- agendamento e horários de vídeo.

`foto_usuario` aceita somente foto recebida por WhatsApp; `conversa` e
`foto_conversa` incluem resultados gerados. `video` restringe ao último
vídeo. Reenvio deduplicado vence pelo timestamp de
`last_media_interaction`, mesmo que a linha conserve `created_at` antigo.
Identificação e título são recuperados pela ID dessa foto; se não existirem,
a foto é identificada novamente.

## Jornadas

| jornada | resultado | evidência/causa |
|---|---|---|
| J1 saudação → menu → Marketing → item | 🟢 | saudação e clique Marketing passam no `processOne`; item permanece coberto no teste do catálogo |
| J2 foto → anúncio → preço/marca → estilo → publicar | 🟢 | estado da foto identificada com preço/marca → escolha original → Impacto → `ready_media:publish`, com arte gerada pelo fake e fila apontando para ela |
| J3 foto → Postar → destino/formato → legenda → publicar/agendar | 🟢 | `list_reply` Feed cria legenda/fila e o clique de variante passa no `processOne` |
| J4 editar imagem → resultado → publicar | 🟢 | prompt de edição gera nova mídia e Publicar usa a mídia `ia_edicao`, não a original |
| J5 várias fotos → carrossel → Pronto → publicar | 🟢 | carrossel persistido como pronto percorre rede → legenda A → confirmação pelo `processOne` |
| J6 CRLV → guardar/ler → salvar/vistoria/desvincular | 🟢 parcial | ações pós-leitura passam no `processOne`; OCR cifrado não foi simulado |
| J7 Não é documento → rota normal | 🟡 sem prova completa | teste isolado garante que não cria Gestão; bytes cifrados não foram simulados no harness |
| J8 placa → Molicar → Procedência → confirmar | 🟢 | os três IDs chegam a Gestão; Procedência → Confirmar executa em dois turnos reais |
| J9 Gestão despesa → SIM/NÃO | 🟢 parcial | confirmação SIM foi executada pelo `processOne`; início por linguagem natural não foi encadeado |
| J10 parceiro com cotação → mídia/valor → confirmar | 🟢 parcial | `os_cot_wa:enviar_orcamento` iniciou a sessão no `processOne`; mídia/valor/confirmação não foram encadeados |
| J11 cliente na vitrine | 🟢 parcial | `veiculo_vitrine:detalhe:<veículo>` passou pelo handler early do `processOne`; outros botões continuam só com testes isolados |
| J12 vídeo → legenda A/B/C → agendar | 🟢 | legenda A → Agendar → Amanhã 10h cria `videos_agendados` pelo `processOne` |
| J13 saudação com fluxo pendente → menu | 🟢 | `processOne` real abre menu e limpa pendências |

Contagem: **12 verdes/verdes parciais, 0 vermelhas e 1 sem prova completa
(J7, bytes cifrados)**. As jornadas novas começam do estado persistido
imediatamente anterior ao primeiro clique listado; integrações externas usam
fakes determinísticos.

## OCR de proteção

O comando de rollback não foi executado por este agente: o ambiente de código
não é o servidor e não possui Docker (`docker: command not found`). Não existe
saída válida `OCR no ar: ...` para reportar. O rollback para
`amz-ocr:7db2991e` continua dependente da execução no host que contém
`/root/amz-ocr.env`.

No código atual, `/detectar` voltou a 8 segundos. Timeout interno da primeira
passada retorna `possivel_documento=true`; timeout externo pode retornar 504.
Termos com menos de 6 caracteres exigem igualdade exata, e a tolerância de uma
edição só vale para termos com 6 ou mais caracteres.
