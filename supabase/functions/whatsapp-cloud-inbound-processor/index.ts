// WhatsApp Cloud — Inbound Processor (Fase 1.2 — Pietro Multimodal)
// Modo AMZ: reconhece Felicio (dono), filtra clientes AMZ, lê imagens e áudios.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  decode as base64Decode,
  encode as base64Encode,
} from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { buildSystemPrompt, AMZ_KNOWLEDGE } from "../_shared/agent-soul.ts";
import { AMZ_TENANT_ID as ADMIN_AMZ_USER_ID } from "../_shared/amz-tenant.ts";
import {
  buildAmzContext,
  isAmzOwnerAltPhone,
  OWNER_PHONE,
  resolveTenantOwner,
  tenantOwnerMatchesPhone,
} from "../_shared/amz-context.ts";
import {
  brazilianPhoneLookupVariants,
  ownerPhoneVariants,
  ownerPhonesEquivalent,
} from "../_shared/owner-phone.ts";
import {
  isLikelyBusinessAutoReply,
  isWhatsAppOptOutRequest,
} from "../_shared/whatsapp-opt-in-gate.ts";
import {
  buildCarouselPrompt,
  buildProspectDemoCarouselPrompt,
  getTenantBusinessContext,
} from "../_shared/business-context.ts";
import {
  requestedCarouselSlideCount,
  sanitizeCarouselSlides,
  sanitizeProspectDemoCaption,
  sanitizeProspectDemoSlides,
  sendCarouselCardsInOrder,
} from "../_shared/carousel-content.ts";
import {
  addVehicleCarouselPhotos,
  blockingVehiclePhotoFlow,
  buildVehicleCarouselContentPrompt,
  buildVehicleCarouselSlides,
  expiredAnuncioPendingPatch,
  hasEnoughVehicleCarouselPhotos,
  hasVehicleCarouselData,
  isVehiclePhotoCarouselRequest,
  isVehiclePhotoCarouselTextRequest,
  isGeneratedVehicleCopySafe,
  parseVehicleCarouselData,
  planVehiclePhotoBatch,
  validPendingVehicleCarousel,
  validPendingVehiclePhotoBatch,
  vehicleCarouselAdStateReset,
  vehicleCarouselCollectionButtons,
  vehicleCarouselDataButtons,
  vehicleCarouselDeliveryButtons,
  vehicleCarouselFormatButtons,
  vehicleCarouselNeedMoreButtons,
  vehicleCarouselPhotoButtons,
  vehicleCarouselStartState,
  vehiclePhotoBatchOfferMessage,
  vehiclePhotoBatchButtons,
  vehiclePhotoBatchNewTopicReset,
  vehiclePhotoCountLabel,
  vehicleSingleRepeatedPhotoButtons,
  vehiclePhotosFromQueueEvents,
  VEHICLE_CAROUSEL_MAX_PHOTOS,
  VEHICLE_CAROUSEL_MIN_PHOTOS,
  SINGLE_REPEATED_VEHICLE_PHOTO_MESSAGE,
  type PendingVehicleCarousel,
  type PendingVehiclePhotoBatch,
  type VehicleCarouselData,
  type VehicleCarouselPhoto,
  type VehiclePhotoView,
} from "../_shared/vehicle-carousel.ts";

// ---------------------------------------------------------------------------
// Multi-tenant owner registry (populado no início de cada processMessage).
// isOwner(ctx) usa este mapa em vez da constante global OWNER_PHONE, para que
// o dono de UM tenant jamais seja reconhecido como dono de OUTRO.
// Guarda uma LISTA: no tenant AMZ o Felicio tem mais de um número (pessoal +
// comercial da Comex IA) e todos valem como dono.
// ---------------------------------------------------------------------------
const _tenantOwners = new Map<string, string[]>();
function setTenantOwnerForCtx(userId: string, ownerPhones: (string | null)[]) {
  _tenantOwners.set(
    userId,
    Array.from(
      new Set(
        ownerPhones.flatMap((phone) => ownerPhoneVariants(phone)),
      ),
    ),
  );
}
function getTenantOwnerForCtx(userId: string): string | null {
  return _tenantOwners.get(userId)?.[0] ?? null;
}
function getTenantOwnersForCtx(userId: string): string[] {
  return _tenantOwners.get(userId) ?? [];
}

import { downloadAllMediaDetailed, type MediaExtract, type MediaRejection } from "../_shared/whatsapp-media.ts";
import { extractDocumentText } from "../_shared/document-extract.ts";
import {
  getTenantLogoDataUrl,
  getTenantLogoStorageLocation,
} from "../_shared/tenant-logo.ts";
import {
  applyBrandLogo,
  buildBrandGenerationGuidance,
} from "../_shared/brand-image-engine.ts";
import {
  loadTenantBrandAssets,
} from "../_shared/brand-assets.ts";
import {
  fetchBrandSiteIdentity,
  SITE_IDENTITY_READ_FAILURE_MESSAGE,
} from "../_shared/brand-site-identity.ts";
import { generateMarketingImage } from "../_shared/marketing-image-generator.ts";
import { setTenantLogo } from "../_shared/tenant-logo.ts";
import { carouselColorRows, resolveCarouselColor } from "../_shared/carousel-colors.ts";
import { processorSkipOutboundLog } from "../_shared/cloud-log.ts";
import { gerarVarianteFacebookFeed } from "../_shared/varianteFacebookFeed.ts";
import { idCurto, linhaCodigoMidia } from "../_shared/publicacao-por-id.ts";
import { syncProdutoVideoFromMidia } from "../_shared/sync-produto-video.ts";
import {
  fetchMp4DurationSeconds,
  integerMediaDurationSeconds,
  parseMp4DurationSeconds,
  whatsAppMediaSaveFailureMessage,
} from "../_shared/mp4-duration.ts";
import { splitWhatsAppText } from "../_shared/whatsapp-text.ts";
import {
  betweenPartsDelayForSenderMs,
  firstReplyDelayForSenderMs,
  hasNewerProcessableInbound,
  prepareLeadReplyParts,
} from "../_shared/whatsapp-humanized-delivery.ts";
import {
  asksForLeadName,
  extractLeadName,
  findLeadNameInConversation,
} from "../_shared/lead-name.ts";
import {
  appendAmzSiteLinkAfterHandoff,
  containsUnsupportedCreativeClaim,
  decideWhatsAppCreativeTool,
  deterministicDemoBlockedResponse,
  demoLimitReplay,
  DEMO_LIMIT_MESSAGE,
  finalizeAmzInboundReply,
  guardProspectCreativeClaims,
  isCreativeDemoTool,
  isDemoTestPhone,
  nonOwnerCapabilityGuidance,
  ownerForwardClientConfirmation,
  requiredProspectCreativeTool,
  TENANT_CREATION_BLOCK_MESSAGE,
  type DemoToolDecision,
} from "../_shared/whatsapp-demo-policy.ts";
import {
  amzProspectHandoffInstruction,
  buildAmzLeadOwnerSummary,
  prospectDemoBrandPlan,
  resolveInviteConfirmation,
} from "../_shared/amz-consultive-prospect.ts";
import {
  AMZ_GLOBAL_TOOL_NAMES,
  canUseAmzGlobalTools,
  filterToolsForTenant,
  OWNER_ONLY_TOOL_NAMES,
  resolveTenantToolScope,
} from "../_shared/whatsapp-tenant-tool-access.ts";
import {
  getMetaAdsReport,
  isMetaAdsReportRequest,
} from "../_shared/meta-ads-report.ts";
import {
  calculateMetaAdsMonthlyAvailability,
  checkMetaAdsReactivationAvailability,
  hasCompleteMetaAdsEntityIds,
  isMetaAdsCampaignEnded,
  metaAdsMaximumSpend,
  metaGraphRequest,
  publishMetaAdsCampaign,
  publicMetaAdsError,
  rollbackMetaAdsCampaign,
  validateMetaAdsDraft,
} from "../_shared/meta-ads-create.ts";
import {
  buildMetodoAmzReviewPrompt,
  revisarComMetodoAmz,
} from "../_shared/metodo-amz.ts";
import {
  isLiteralMetaAdsApproval,
  latestMetaAdsWhatsappApproval,
} from "../_shared/meta-ads-whatsapp-approval.ts";
import {
  avancarMetaAdsQuestionario,
  avaliarMetaAdsOrcamentoMinimo,
  filtrarInteressesValidados,
  interactiveId as metaAdsQuestionarioInteractiveId,
  isMetaAdsQuestionarioAmbiguousRequest,
  isMetaAdsQuestionarioCancel,
  isMetaAdsQuestionarioResume,
  isMetaAdsQuestionarioTrigger,
  isMetaAdsLimitChangeRequest,
  metaAdsBudgetRecoveryButtons,
  metaAdsDraftDoQuestionario,
  metaAdsLimitProposalButtons,
  metaAdsMaximoDiarioParaSeteDias,
  metaAdsQuestionarioAmbiguityButtons,
  metaAdsQuestionarioBudget,
  metaAdsQuestionarioContinuarButtons,
  metaAdsQuestionarioExpirado,
  metaAdsQuestionarioResumo,
  metaAdsQuestionarioResumoHash,
  novoMetaAdsQuestionario,
  questionarioAtivo,
  questionarioButtons,
  questionarioList,
  resolveMetaAdsLimitAction,
  resolveMetaAdsLimitValueInput,
  resolveMetaAdsQuestionarioAmbiguity,
  respostaPertenceAoQuestionario,
  type MetaAdsQuestionario,
  type MetaAdsQuestionarioAmbiguidade,
  type MetaAdsLimitProposal,
  type MetaAdsLimitValueRequest,
  type MetaAdsQuestionarioMidia,
  validarNovoLimiteMensalAnuncios,
  voltarMetaAdsQuestionarioParaOrcamento,
} from "../_shared/meta-ads-questionario.ts";
import { dedupeConsecutiveReplyText } from "../_shared/reply-dedupe.ts";
import {
  formatScheduledDate,
  formatSocialNetworks,
  parseSaoPauloDateTime,
} from "../_shared/social-schedule.ts";
import {
  allRowsAreFuturePending,
  chooseSocialSchedule,
  hasMinimumScheduleLead,
  type ScheduledSocialGroup,
} from "../_shared/social-reschedule.ts";
import {
  parseTikTokDisclosure,
  privacyChoiceText,
  tiktokInteractiveId,
  tiktokInteractiveListFromToolResult,
} from "../_shared/tiktok-whatsapp-consent.ts";
import {
  classifyOwnerMediaIntent,
  extractSocialPostBriefing,
  hasImageGenerationRequest,
  hasSocialPostRequest,
  selectLatestImplicitMediaId,
  selectPublicationMediaId,
} from "../_shared/owner-media-intent.ts";
import {
  classifyPendingBrandReply,
  decideWhatsAppImageBrand,
  detectWhatsAppBrandDirective,
  extractExplicitWhatsAppBrandSiteUrl,
  extractWhatsAppBrandSiteUrl,
  resolveWhatsAppGeneratorBrand,
  whatsAppDemoResponseWithBrand,
  whatsAppImageBrandResultMessage,
  whatsAppImageFailureMessage,
  whatsAppSiteBrandGenerationOptions,
  whatsAppUploadedLogoConfirmationButtons,
  type WhatsAppBrandPreference,
} from "../_shared/whatsapp-image-brand.ts";
import {
  canRunSocialPostAction,
  selectSocialVariantScripts,
  socialInteractiveButtonsFromResult,
} from "../_shared/social-approval-flow.ts";
import {
  canUseAmbiguousPendingReply,
  classifyExplicitPendingPostCommand,
  isPendingInteractionRecent,
  PENDING_LOOKBACK_MS,
  requiresOldPendingPublishConfirmation,
} from "../_shared/social-pending-window.ts";
import {
  canonicalSocialNetwork,
  detectRequestedSocialNetworks,
  SUPPORTED_SOCIAL_NETWORKS,
} from "../_shared/social-networks.ts";
import {
  isConfirmedLinkedInPublishResult,
  publicationMediaReference,
  sanitizeLinkedInApprovalCopy,
  shouldPrepareLinkedInTextOnly,
} from "../_shared/linkedin-approval.ts";
import { buildSocialQueueNetworkRows } from "../_shared/social-queue.ts";
import {
  catalogImageUrl,
  environmentLikelihood,
  IMAGE_COMPOSITION_ESTIMATED_COST_USD,
  IMAGE_COMPOSITION_MODEL,
  isImageCompositionIntent,
  isProductAdCreativeRequest,
  requestedCompositionResolution,
  selectCatalogProduct,
  type ImageCompositionResolution,
} from "../_shared/image-composition.ts";
import {
  iniciarFluxoLegendaVideo,
  resolverVideoLegendado,
  tratarRespostaFluxoLegenda,
} from "../_shared/video-legenda-flow.ts";
import { botoesLegendaParaLogo } from "../_shared/video-legenda-logo.ts";
import {
  aplicarAjusteRoteiroMotion,
  buscarBaseRefazerVideoMotion,
  enfileirarVideoMotion,
  minutosRenderEstimado,
  montarRoteiroMotion,
} from "../_shared/video-motion-enfileirar.ts";
import {
  duracaoEstimada,
  duracaoPedidaNoTexto,
  cenasPedidasNoTexto,
  estiloPedidoNoTexto,
  fundoPedidoNoTexto,
  normalizarSiteMotion,
  PALETA_PADRAO,
  ROTULO_DURACAO,
  ROTULO_ESTILO,
  type DuracaoMotion,
  type CenaMotion,
  type EstiloMotion,
  type FundoMotion,
  type MotionProps,
} from "../_shared/video-motion.ts";
import {
  extrairCoresDoTexto,
  paletaAPartirDe,
} from "../_shared/video-cores.ts";
import {
  extractClientNameFromLogoRequest,
  findClientBrandIdentity,
  listClientBrandIdentityMatches,
  saveClientBrandIdentity,
  clientLogoPath,
  type ClientBrandIdentity,
} from "../_shared/client-brand-identity.ts";
import {
  anuncioClientColors,
  buildAnuncioBrandPlan,
} from "../_shared/anuncio-client-brand.ts";
import {
  anuncioSuccessMessage,
  amzAnuncioClientButtons,
  amzMissingClientLogoButtons,
  shouldAskAmzAnuncioClient,
} from "../_shared/anuncio-tenant-brand.ts";
import {
  ANUNCIO_STYLES,
  type AnuncioStyle,
  type AnuncioPhotoPreference,
  anuncioPhotoChoiceButtons,
  anuncioPhotoDirectiveFromText,
  anuncioPhotoPreferenceConfirmationButtons,
  anuncioPhotoRedoButtons,
  anuncioStyleButtons,
  anuncioStyleFromText,
  getTenantAnuncioPhotoPreference,
  getTenantAnuncioStyle,
  otherAnuncioStyles,
  resolveAnuncioPhotoPreference,
  saveTenantAnuncioPhotoPreference,
  savedClientAnuncioStyle,
  saveTenantAnuncioStyle,
  shouldImproveAnuncioPhoto,
} from "../_shared/anuncio-style.ts";
import {
  anuncioCaptionExtraList,
  anuncioFinalApprovalButtons,
  anuncioPostActionButtons,
  anuncioPostFormatButtons,
  anuncioPostNetworkButtons,
  anuncioScheduleApprovalButtons,
  anuncioScheduleTimeButtons,
  generateVehicleAdCaptions,
  parseAnuncioPostRequest,
  shouldBindPostToLastAnuncio,
  validLastAnuncio,
  type AnuncioPostNetwork,
  type LastAnuncio,
  type LastAnuncioImage,
  type PendingAnuncioPost,
} from "../_shared/anuncio-social-flow.ts";
import {
  selectRecentOriginalPhoto,
} from "../_shared/anuncio-source-media.ts";
import {
  parseFotoBoxFromVisionResponse,
  type FotoBox,
} from "../_shared/anuncio-photo-framing.ts";
import { productAdPhotoImprovementPrompt } from "../_shared/anuncio-photo-prompt.ts";
import { buildVehicleAdContent } from "../_shared/anuncio-vehicle-details.ts";
import {
  classifyStoreReply,
  storeNameFromSite,
} from "../_shared/anuncio-store-flow.ts";
import {
  buscarMarca,
  consultarPreco,
  fipeListRows,
  fipePhotoSuggestionMessage,
  listarAnos,
  listarModelos,
  type FipeListItem,
  type FipePrice,
} from "../_shared/fipe.ts";
import {
  filterFipeModelCandidates,
  normalizeFipeLookupInput,
  parseFipeRequestText,
  type FipeLookupInput,
} from "../_shared/fipe-input.ts";
import {
  decideFipeForAd,
  type LastFipeResult,
} from "../_shared/fipe-ad.ts";
import {
  cleanReceivedMediaDescription,
  createRecentAutomaticMessageGuard,
  recognizedMediaReply,
} from "../_shared/media-received-copy.ts";
import { imageUploadMetadata } from "../_shared/image-file-format.ts";
import { detectLogoVariantRequest } from "../_shared/logo-variant.ts";
import {
  canRunClientLogoRegistrationShortcut,
  classifyCreativeMediaRequest,
  clientLogoUploadFollowUp,
  extractVideoClientName,
  hasUsableVideoTopic,
  isClearlyDifferentFromPendingVideo,
  isVideoMotionRedoRequest,
  isVideoMotionRequest,
  isSameVideoBrandName,
  resolveAutomaticVideoSiteIdentity,
  selectVideoClientLogo,
  shouldStartVideoSetup,
  videoSiteDomain,
} from "../_shared/video-client-identity.ts";
import { completeSiteIdentityWithRenderedPage } from "../_shared/video-site-identity.ts";
import { removeSolidLogoBackground } from "../_shared/logo-background.ts";

import {
  entregarEbookTenant,
  getEntregaEbook,
  getTenantEbook,
  registrarOfertaEbook,
} from "../_shared/tenant-ebook.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

// ============================================================
// FEATURE 2 — Roteamento de modelo por tipo de tarefa
// ============================================================
// FAST = conversa normal (rápido/barato). DEEP = raciocínio pesado
// (documento, código, multimodal). Decisão é pelo TIPO de fluxo,
// nunca por heurística de palavra-chave no conteúdo.
const MODEL_FAST = "google/gemini-3.6-flash";
const MODEL_DEEP = "google/gemini-3.1-pro-preview";

type TaskContext = {
  kind: "conversation" | "document" | "multimodal";
};

function escolherModelo(ctx: TaskContext): string {
  const model = (ctx.kind === "document" || ctx.kind === "multimodal") ? MODEL_DEEP : MODEL_FAST;
  console.log(`[model-router] kind=${ctx.kind} → ${model}`);
  return model;
}

// ============================================================
// 🛡️ BLINDAGEM DE IMAGEM (apresentação à prova de falha)
// ------------------------------------------------------------
// Toda chamada de geração/edição de imagem passa por aqui:
//  - fila de modelos (se um estiver fora/lotado, cai pro próximo)
//  - retry com backoff em 429/5xx (respeita Retry-After)
//  - timeout duro por tentativa (nunca pendura)
//  - erros terminais (400/401/402/403) não são reenviados
// ============================================================
const IMAGE_MODELS = [
  "google/gemini-3.1-flash-image",
  "google/gemini-3-pro-image",
  "google/gemini-3.1-flash-lite-image",
];

type ImagemGatewayOk = { ok: true; dataUrl: string; model: string };
type ImagemGatewayErr = { ok: false; erro: string; detalhe?: string; motivo?: string };

async function chamarGatewayImagem(
  body: Record<string, unknown>,
  tag: string,
  timeoutMs = 100000,
  models: readonly string[] = IMAGE_MODELS,
): Promise<ImagemGatewayOk | ImagemGatewayErr> {
  let ultimoErro: ImagemGatewayErr = { ok: false, erro: "image_gateway_indisponivel" };

  for (const model of models) {
    for (let tentativa = 1; tentativa <= 2; tentativa++) {
      const t0 = Date.now();
      try {
        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
          body: JSON.stringify({ ...body, model }),
          signal: AbortSignal.timeout(timeoutMs),
        });

        if (res.ok) {
          const data = await res.json();
          const dataUrl = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
          if (dataUrl) {
            console.log(`[${tag}] ok model=${model} tentativa=${tentativa} em ${Date.now() - t0}ms`);
            return { ok: true, dataUrl, model };
          }
          console.warn(`[${tag}] resposta sem imagem model=${model}`, JSON.stringify(data).slice(0, 300));
          ultimoErro = { ok: false, erro: "sem_imagem_retornada" };
          continue; // tenta de novo / próximo modelo
        }

        const texto = (await res.text()).slice(0, 300);
        console.error(`[${tag}] gateway ${res.status} model=${model}`, texto);

        // Créditos/política/config: reenviar não resolve.
        if (res.status === 401 || res.status === 402 || res.status === 403) {
          return {
            ok: false,
            erro: `image_gateway ${res.status}`,
            detalhe: texto,
            motivo: res.status === 401 ? "chave_invalida" : "creditos_ou_politica",
          };
        }

        ultimoErro = { ok: false, erro: `image_gateway ${res.status}`, detalhe: texto };

        // 400 = modelo/campo não aceito por ESTE modelo → tenta o próximo da fila.
        if (res.status === 400) break;

        if (res.status === 429 || res.status >= 500) {
          const ra = Number(res.headers.get("retry-after"));
          const esperaMs = Number.isFinite(ra) && ra > 0
            ? Math.min(ra * 1000, 8000)
            : 1200 * tentativa + Math.floor(Math.random() * 400);
          await new Promise((r) => setTimeout(r, esperaMs));
          continue;
        }
        break;
      } catch (e) {
        const msg = (e as Error).message || String(e);
        console.error(`[${tag}] falha de rede/timeout model=${model} tentativa=${tentativa}: ${msg}`);
        ultimoErro = { ok: false, erro: "image_gateway_timeout", detalhe: msg.slice(0, 200) };
        await new Promise((r) => setTimeout(r, 800 * tentativa));
      }
    }
  }
  return ultimoErro;
}

const WHATSAPP_TEST_ACCESS_TOKEN = Deno.env.get("WHATSAPP_TEST_ACCESS_TOKEN");

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

type QueueRow = {
  id: string;
  wamid: string;
  user_id: string | null;
  phone_number_id: string;
  from_number: string;
  message_type: string | null;
  payload: any;
  status: string;
  attempts: number;
  created_at: string;
};

async function failQueue(id: string, error: string) {
  await sb
    .from("whatsapp_cloud_inbound_queue")
    .update({ status: "failed", error, processed_at: new Date().toISOString() })
    .eq("id", id);
}

async function doneQueue(id: string) {
  await sb
    .from("whatsapp_cloud_inbound_queue")
    .update({ status: "done", processed_at: new Date().toISOString(), error: null })
    .eq("id", id);
}

async function sendTypingIndicator(
  phoneNumberId: string,
  accessToken: string | null,
  inboundWamid: string,
): Promise<void> {
  if (!phoneNumberId || !accessToken || !inboundWamid) return;
  try {
    const response = await fetch(`https://graph.facebook.com/v25.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        status: "read",
        message_id: inboundWamid,
        typing_indicator: { type: "text" },
      }),
    });
    if (!response.ok) {
      const detail = await response.text();
      console.warn(`[processor][typing_indicator_failed] status=${response.status} detail=${detail.slice(0, 160)}`);
    }
  } catch (error) {
    console.warn("[processor][typing_indicator_failed]", (error as Error).message);
  }
}

async function wait(ms: number): Promise<void> {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function groupIfNewerLeadTextExists(row: QueueRow): Promise<boolean> {
  await wait(6000);
  const { data: newer, error } = await sb
    .from("whatsapp_cloud_inbound_queue")
    .select("id, created_at, status")
    .eq("phone_number_id", row.phone_number_id)
    .eq("from_number", row.from_number)
    .eq("message_type", "text")
    .gt("created_at", row.created_at)
    .order("created_at", { ascending: false })
    .limit(10);
  if (error || !hasNewerProcessableInbound(row.created_at, newer ?? [])) return false;
  const { data: grouped } = await sb.from("whatsapp_cloud_inbound_queue")
    .update({
      status: "grouped",
      error: null,
      processed_at: new Date().toISOString(),
    })
    .eq("id", row.id)
    .eq("status", "processing")
    .select("id");
  if (!grouped?.length) return false;
  console.log(`[processor][lead_batch] grouped=${row.id} newer=${newer[0].id}`);
  return true;
}

function extractText(payload: any): string {
  if (!payload) return "";
  if (payload.text?.body) return payload.text.body;
  if (payload.button?.text) return payload.button.text;
  if (payload.interactive?.button_reply?.title) {
    const title = String(payload.interactive.button_reply.title);
    const id = String(payload.interactive.button_reply.id || "");
    return id ? `${title}\n<<INTERACTIVE_ID:${id}>>` : title;
  }
  if (payload.interactive?.list_reply?.title) {
    const title = String(payload.interactive.list_reply.title);
    const id = String(payload.interactive.list_reply.id || "");
    return /^(?:video_|fipe_|anuncio_post:|tiktok_(?:privacy|disclosure):|meta_ads_q:)/i.test(id)
      ? `${title}\n<<INTERACTIVE_ID:${id}>>`
      : title;
  }
  if (payload.image?.caption) return payload.image.caption;
  if (payload.video?.caption) return payload.video.caption;
  if (payload.document?.caption) return payload.document.caption;
  return "";
}

function buildUserContent(userText: string, media: MediaExtract[]): any {
  if (media.length === 0) return userText || "(mensagem sem texto)";
  const hasAudio = media.some((m) => m.kind === "audio");
  const hasImage = media.some((m) => m.kind === "image");
  let preface = userText;
  if (!preface) {
    if (hasAudio && hasImage) preface = "O usuário mandou um áudio e uma imagem. ESCUTE o áudio, VEJA a imagem e responda ao que ele pede — não cumprimente sem responder.";
    else if (hasAudio) preface = "O usuário mandou um ÁUDIO de voz. ESCUTE o áudio, entenda o que ele está pedindo e RESPONDA à pergunta dele. Não responda só 'oi' — responda o conteúdo do áudio.";
    else if (hasImage) preface = "O usuário mandou uma imagem/print. ANALISE a imagem e comente/responda baseado no que você vê.";
    else preface = `[o usuário mandou ${media.length} mídia(s)]`;
  } else if (hasAudio) {
    preface = `${userText}\n\n(o usuário também mandou um áudio — ESCUTE e responda ao conteúdo dele)`;
  }
  const parts: any[] = [{ type: "text", text: preface }];
  for (const m of media) {
    if (m.kind === "image") {
      parts.push({ type: "image_url", image_url: { url: `data:${m.mime};base64,${m.base64}` } });
    } else if (m.kind === "audio") {
      const format = m.mime.includes("ogg") ? "ogg"
        : m.mime.includes("mpeg") || m.mime.includes("mp3") ? "mp3"
        : m.mime.includes("wav") ? "wav"
        : m.mime.includes("m4a") || m.mime.includes("mp4") ? "m4a" : "ogg";
      parts.push({ type: "input_audio", input_audio: { data: m.base64, format } });
    }
  }
  return parts;
}

// ============ TOOLS DO PIETRO ============

const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY");
const GOOGLE_CX = Deno.env.get("GOOGLE_CX");
const SERPAPI_KEY = Deno.env.get("SERPAPI_KEY");
const GOOGLE_REFERER = (Deno.env.get("APP_URL") || "https://hello-buddy-launchpad.lovable.app/").replace(/\/?$/, "/");

type SearchItem = {
  titulo?: string;
  link?: string;
  resumo?: string;
  fonte?: string;
  data?: string | null;
  consulta?: string;
  score?: number;
  conteudo_extraido?: string;
};

const SEARCH_STOPWORDS = new Set([
  "para", "pra", "por", "com", "sem", "uma", "um", "uns", "umas", "dos", "das", "que", "qual", "quais", "como",
  "onde", "quando", "agora", "hoje", "amanha", "sobre", "depois", "encontre", "encontrar", "pesquisa", "pesquisar",
  "busca", "buscar", "google", "internet", "jarvis", "felicio", "instrucoes", "instrucao", "enquanto", "daqui",
]);

function currentMonthYearPt(): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", month: "long", year: "numeric" }).format(new Date());
}

function compactSpaces(text: string): string {
  return (text || "").replace(/\s+/g, " ").trim();
}

function cleanSearchQuery(query: string): string {
  return compactSpaces((query || "")
    .replace(/^jarvis[,\s]*/i, "")
    .replace(/\b(depois\s+te\s+dou\s+mais\s+instru[cç][oõ]es|por\s+enquanto|aguarde\s+um\s+instante)\b/gi, " ")
    .replace(/\b(procura|procurar|busca|buscar|pesquisa|pesquisar|consulta|consulte)\s+(no\s+google\s+|na\s+internet\s+|na\s+web\s+)?/gi, " "))
    .slice(0, 320);
}

function searchTokens(text: string): string[] {
  return normalizePt(text)
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !SEARCH_STOPWORDS.has(w))
    .slice(0, 24);
}

function isLodgingQuery(query: string): boolean {
  const t = normalizePt(query);
  return /\b(pousada|pousadas|hotel|hoteis|hostel|resort|hospedagem|hospedar|diaria|diarias|booking|tripadvisor|luxo|alto padrao|5 estrelas|cinco estrelas)\b/.test(t);
}

function isLiveTrafficQuery(query: string): boolean {
  const t = normalizePt(query);
  return /\b(transito|trafego|engarrafamento|rota|waze|acidente|interdicao|bloqueio)\b/.test(t);
}

function extractDestinationFromQuery(query: string): string | null {
  const cleaned = compactSpaces(query.replace(/[?!.,;]+/g, " "));
  const matches = [...cleaned.matchAll(/\b(?:em|para|pra|no|na|nos|nas)\s+([\p{L}][\p{L}'-]+(?:\s+(?:de|do|da|dos|das|d'|[\p{L}][\p{L}'-]+)){0,4})/giu)];
  const bad = /^(daqui|hoje|amanha|depois|enquanto|adultos?|criancas?|pessoas?|dias?|semana|mes|ano|google|internet|web)\b/i;
  const picked = matches
    .map((m) => compactSpaces(m[1]))
    .filter((v) => v.length >= 4 && !bad.test(normalizePt(v)))
    .sort((a, b) => b.length - a.length)[0];
  return picked || null;
}

function extractTravelParty(query: string): string {
  const t = normalizePt(query);
  const parts: string[] = [];
  const adults = t.match(/(\d+)\s*adultos?/);
  const kids = t.match(/(\d+)\s*(crianca|criancas|filho|filhos)/);
  if (adults) parts.push(`${adults[1]} adultos`);
  if (kids) parts.push(`${kids[1]} criança${kids[1] === "1" ? "" : "s"}`);
  return parts.join(" ");
}

function extractRelativeDateHint(query: string): string {
  const t = normalizePt(query);
  const m = t.match(/daqui\s+(\d{1,2})\s+dias?/);
  if (!m) return "";
  const d = new Date();
  d.setDate(d.getDate() + Number(m[1]));
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "long", year: "numeric" }).format(d);
}

function buildSearchVariants(query: string, recencia?: string): string[] {
  const base = cleanSearchQuery(query);
  const variants = new Set<string>();
  const monthYear = currentMonthYearPt();
  const dateHint = extractRelativeDateHint(base);
  const party = extractTravelParty(base);
  const destination = extractDestinationFromQuery(base);

  if (isLodgingQuery(base)) {
    const dest = destination || base;
    const tail = compactSpaces([party, dateHint || monthYear].filter(Boolean).join(" "));
    variants.add(compactSpaces(`${dest} pousada hotel boutique luxo alto padrão piscina ${tail}`));
    variants.add(compactSpaces(`site:booking.com ${dest} pousada hotel ${tail}`));
    variants.add(compactSpaces(`site:tripadvisor.com.br ${dest} pousadas hotéis luxo`));
    variants.add(compactSpaces(`${dest} melhores pousadas luxo hospedagem alto padrão`));
  } else if (isLiveTrafficQuery(base)) {
    variants.add(compactSpaces(`${base} trânsito agora ${monthYear}`));
    variants.add(compactSpaces(`${base} situação do trânsito ao vivo hoje`));
    variants.add(compactSpaces(`${base} acidente interdição congestionamento hoje`));
  } else {
    variants.add(base);
    if (recencia === "d" || /\b(hoje|agora|atual|recente|ultimas|noticias)\b/.test(normalizePt(base))) {
      variants.add(compactSpaces(`${base} ${monthYear}`));
      variants.add(compactSpaces(`${base} últimas notícias hoje`));
    }
  }

  return Array.from(variants).filter(Boolean).slice(0, 4);
}

function scoreSearchItem(item: SearchItem, query: string): number {
  const hayTitle = normalizePt(item.titulo || "");
  const haySnippet = normalizePt(`${item.resumo || ""} ${item.fonte || ""}`);
  const tokens = searchTokens(query);
  let score = 0;
  for (const token of tokens) {
    if (hayTitle.includes(token)) score += 3;
    if (haySnippet.includes(token)) score += 1.2;
  }
  const source = normalizePt(item.fonte || item.link || "");
  if (/booking|tripadvisor|google|hoteis|expedia|kayak|trivago|melhoresdestinos|guiaviajarmelhor/.test(source)) score += 2;
  if (item.data) score += 0.8;
  if (isLodgingQuery(query)) {
    const all = `${hayTitle} ${haySnippet}`;
    if (/\b(pousada|hotel|hoteis|hospedagem|resort|suite|chale|boutique|luxo|piscina|diaria|booking|tripadvisor)\b/.test(all)) score += 4;
    if (/\b(papelaria|papelarias|imobiliaria|concurso|edital|prefeitura|camara municipal)\b/.test(all)) score -= 8;
  }
  return Number(score.toFixed(2));
}

function dedupeAndRankSearchItems(items: SearchItem[], query: string): SearchItem[] {
  const seen = new Set<string>();
  const filtered: SearchItem[] = [];
  for (const item of items) {
    const link = item.link || "";
    const key = link.replace(/[#?].*$/, "").replace(/\/$/, "").toLowerCase() || normalizePt(`${item.titulo} ${item.fonte}`);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const score = scoreSearchItem(item, query);
    if (isLodgingQuery(query) && score < 2) continue;
    filtered.push({ ...item, score });
  }
  return filtered.sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 12);
}

async function googleCustomSearchItems(query: string, recencia?: string): Promise<SearchItem[]> {
  if (!GOOGLE_API_KEY || !GOOGLE_CX) return [];
  const params = new URLSearchParams({
    key: GOOGLE_API_KEY,
    cx: GOOGLE_CX,
    q: query,
    num: "10",
    hl: "pt-BR",
    gl: "br",
    lr: "lang_pt",
    safe: "off",
  });
  const r2 = (recencia || "").toLowerCase().trim();
  if (["d", "w", "m", "y"].includes(r2)) params.set("dateRestrict", `${r2}1`);
  const url = `https://www.googleapis.com/customsearch/v1?${params.toString()}`;
  const r = await fetch(url, { headers: googleApiHeaders(), signal: AbortSignal.timeout(12000) });
  if (!r.ok) {
    const detalhe = await r.text().catch(() => "");
    console.error("[pietro][pesquisar_web] falhou", r.status, detalhe.slice(0, 300));
    return [];
  }
  const d = await r.json();
  return (d.items ?? []).map((it: any) => ({
    titulo: it.title,
    link: it.link,
    resumo: it.snippet,
    fonte: it.displayLink,
    data: it.pagemap?.metatags?.[0]?.["article:published_time"] || it.pagemap?.metatags?.[0]?.["og:updated_time"] || null,
    consulta: query,
  }));
}

function googleApiHeaders(): HeadersInit {
  return {
    "Referer": GOOGLE_REFERER,
    "Origin": GOOGLE_REFERER.replace(/\/$/, ""),
    "User-Agent": "amz-jarvis/1.0",
  };
}

async function toolPesquisarWebSerpApi(query: string, recencia?: string): Promise<string | null> {
  if (!SERPAPI_KEY) return null;
  const params = new URLSearchParams({
    engine: "google",
    q: query,
    google_domain: "google.com.br",
    gl: "br",
    hl: "pt-br",
    num: "8",
    api_key: SERPAPI_KEY,
  });
  const r2 = (recencia || "").toLowerCase().trim();
  if (["d", "w", "m", "y"].includes(r2)) params.set("tbs", `qdr:${r2}`);

  const r = await fetch(`https://serpapi.com/search.json?${params.toString()}`, { signal: AbortSignal.timeout(12000) });
  if (!r.ok) {
    const detalhe = await r.text().catch(() => "");
    console.error("[pietro][pesquisar_web][serpapi] falhou", r.status, detalhe.slice(0, 400));
    return JSON.stringify({ erro: `busca fallback falhou (${r.status})`, detalhe: detalhe.slice(0, 400) });
  }
  const d = await r.json();
  const items = (d.organic_results ?? []).slice(0, 8).map((it: any) => ({
    titulo: it.title,
    link: it.link,
    resumo: it.snippet,
    fonte: it.displayed_link || it.source,
    data: it.date || null,
    consulta: query,
  }));
  return JSON.stringify({ query, recencia: recencia || "qualquer", fonte_busca: "Google via SerpAPI", total: items.length, resultados: items });
}

async function serpApiSearchItems(query: string, recencia?: string): Promise<SearchItem[]> {
  const raw = await toolPesquisarWebSerpApi(query, recencia);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed?.resultados)) return [];
    return parsed.resultados.map((it: SearchItem) => ({ ...it, consulta: it.consulta || query }));
  } catch {
    return [];
  }
}

async function toolConsultarCnpj(cnpj: string): Promise<string> {
  const clean = (cnpj || "").replace(/\D/g, "");
  if (clean.length !== 14) return JSON.stringify({ erro: "CNPJ inválido — precisa ter 14 dígitos" });
  try {
    const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${clean}`);
    if (!r.ok) return JSON.stringify({ erro: `CNPJ não encontrado (${r.status})` });
    const d = await r.json();
    return JSON.stringify({
      cnpj: d.cnpj,
      razao_social: d.razao_social,
      nome_fantasia: d.nome_fantasia,
      situacao: d.descricao_situacao_cadastral,
      data_abertura: d.data_inicio_atividade,
      capital_social: d.capital_social,
      porte: d.porte,
      natureza_juridica: d.natureza_juridica,
      cnae_principal: `${d.cnae_fiscal} - ${d.cnae_fiscal_descricao}`,
      endereco: `${d.logradouro}, ${d.numero} ${d.complemento ?? ""} - ${d.bairro}, ${d.municipio}/${d.uf} - CEP ${d.cep}`,
      telefone: d.ddd_telefone_1,
      email: d.email,
      socios: (d.qsa ?? []).map((s: any) => ({ nome: s.nome_socio, qualificacao: s.qualificacao_socio, entrada: s.data_entrada_sociedade })),
    });
  } catch (e) {
    return JSON.stringify({ erro: String((e as Error).message) });
  }
}

// Extrai texto legível de uma página (strip HTML) — timeout curto, retorna vazio em erro.
async function fetchPageText(url: string, maxChars = 1800): Promise<string> {
  try {
    const r = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; JarvisBot/1.0)",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.6",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) return "";
    const ct = r.headers.get("content-type") || "";
    if (!ct.includes("html") && !ct.includes("text")) return "";
    let html = await r.text();
    // Corta scripts/styles/nav/footer
    html = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
      .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
      .replace(/<header[\s\S]*?<\/header>/gi, " ")
      .replace(/<aside[\s\S]*?<\/aside>/gi, " ");
    // Preserva um pouco de estrutura em parágrafos
    html = html.replace(/<\/(p|h[1-6]|li|br|div)>/gi, "\n");
    const text = html
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{2,}/g, "\n")
      .trim();
    return text.slice(0, maxChars);
  } catch {
    return "";
  }
}

async function toolPesquisarWeb(query: string, recencia?: string): Promise<string> {
  const originalQuery = cleanSearchQuery(query);
  const variants = buildSearchVariants(originalQuery, recencia);
  let fonteBusca = "";
  let gathered: SearchItem[] = [];

  if (GOOGLE_API_KEY && GOOGLE_CX) {
    try {
      const batches = await Promise.all(variants.map((q) => googleCustomSearchItems(q, recencia)));
      gathered = batches.flat();
      if (gathered.length > 0) fonteBusca = `Google Custom Search (${variants.length} consultas otimizadas)`;
    } catch (e) {
      console.error("[pietro][pesquisar_web] erro", (e as Error).message);
    }
  }

  if (gathered.length < 4) {
    const serpBatches = await Promise.all(variants.slice(0, 3).map((q) => serpApiSearchItems(q, recencia)));
    const serpItems = serpBatches.flat();
    if (serpItems.length > 0) {
      gathered = [...gathered, ...serpItems];
      fonteBusca = fonteBusca ? `${fonteBusca} + SerpAPI` : "Google via SerpAPI";
    }
  }

  const ranked = dedupeAndRankSearchItems(gathered, originalQuery);
  if (ranked.length === 0) {
    return JSON.stringify({
      query: originalQuery,
      consultas_tentadas: variants,
      erro: "sem_resultados_relevantes",
      instrucao: "A busca retornou resultados fracos ou fora do tema. Peça 1 detalhe a mais (cidade, bairro, data, marca, evento) antes de afirmar algo.",
    });
  }

  // Enriquecimento: baixa conteúdo textual das top 5 páginas em paralelo.
  const topN = Math.min(5, ranked.length);
  const enriched = await Promise.all(
    ranked.slice(0, topN).map(async (it: SearchItem) => ({
      ...it,
      conteudo_extraido: await fetchPageText(it.link || "", 2600),
    })),
  );
  const finalItems = [...enriched, ...ranked.slice(topN)];
  const withReadableContent = finalItems.filter((it) => (it.conteudo_extraido || "").length > 180).length;

  return JSON.stringify({
    query: originalQuery,
    consultas_tentadas: variants,
    recencia: recencia || "qualquer",
    fonte_busca: fonteBusca || "Google",
    qualidade: {
      total_bruto: gathered.length,
      total_relevante: finalItems.length,
      paginas_lidas: withReadableContent,
    },
    instrucao: "Responda SOMENTE com base nos resultados relevantes e no conteudo_extraido. Se paginas_lidas=0 ou os resultados não responderem exatamente, diga que a busca não trouxe confirmação suficiente e sugira uma consulta mais específica. Para hospedagem, priorize links de Booking/Tripadvisor/hotéis/pousadas e descarte resultados genéricos fora da cidade.",
    resultados: finalItems,
  });
}

function detectWebSearchIntent(text: string, opts: { hasMedia?: boolean } = {}): { query: string; recencia?: string } | null {
  // Turno com mídia (áudio/imagem/vídeo) NUNCA dispara busca: é conteúdo do próprio
  // usuário, não pergunta ao mundo.
  if (opts.hasMedia) return null;
  const raw = typeof text === "string" ? text.trim() : "";
  if (!raw) return null;
  const t = normalizePt(raw);

  // Conversa operacional / instrução: nunca pesquisa.
  const isOperacional = /\b(vou (te )?(enviar|mandar|passar|gravar)|te envio|te mando|segue|segura|aguarda|aguarde|espera|espere|olha (isso|aqui|esse|essa)|ve (isso|aqui)|escuta|ouve|transcreve|transcrever|transcricao|resume|resumir|resumo disso|traduz|traduzir|corrige|corrigir|posta|postar|publica|publicar|salva|salvar|edita|editar|manda pro|encaminha|repassa)\b/.test(t);
  if (isOperacional) return null;

  const pedidoExplicito = /\b(procura|procurar|busca|buscar|pesquisa|pesquisar|pesquise|busque|procure|google|na internet|na web|acha ai|ve pra mim|consulte|consulta ai)\b/.test(t);

  // Fato externo: precisa de pergunta (interrogação ou pronome interrogativo)
  // combinada com um assunto de mundo externo.
  const temPergunta = /\?/.test(raw)
    || /\b(quanto|quantos|quantas|qual|quais|quando|onde|quem|por que|porque|como esta|como ta|o que (esta|ta|aconteceu|houve|rolou))\b/.test(t);
  const assuntoExterno = /\b(cotacao|dolar|euro|bitcoin|btc|bolsa|ibovespa|selic|juros|inflacao|ipca|noticia|noticias|manchete|placar|jogo|jogos|campeonato|eleicao|clima|tempo|previsao|transito|trafego|greve|mercado|acao|acoes|preco medio|passagem|voo|hotel|pousada|receita|ingredientes|modo de preparo)\b/.test(t);
  const fatoAtual = temPergunta && assuntoExterno;

  if (!pedidoExplicito && !fatoAtual) return null;

  let query = cleanSearchQuery(raw);

  if (!query) query = raw;
  if (/\btransito\b/.test(t)) query = `${query} trânsito agora ${currentMonthYearPt()}`;
  if (/\b(notícias|noticias|recente|hoje|agora|atual|transito|trafego|greve)\b/i.test(raw)) return { query, recencia: "d" };
  if (isLodgingQuery(query)) return { query, recencia: "m" };
  return { query };
}


// Detecta pedidos de cotação e retorna pares a consultar (AwesomeAPI é tempo real).
function detectQuoteIntent(text: string): string[] {
  const t = normalizePt(text);
  if (!/\b(cotacao|cotacoes|preco|valor|fechamento|quanto (esta|ta|custa)|hoje|agora|atual)\b/.test(t)
      && !/\b(dolar|euro|libra|iene|peso|bitcoin|btc|ethereum|eth|solana|sol|bnb|xrp|doge|cardano|ada)\b/.test(t)) {
    return [];
  }
  const map: Record<string, string> = {
    "dolar": "USD-BRL",
    "usd": "USD-BRL",
    "euro": "EUR-BRL",
    "eur": "EUR-BRL",
    "libra": "GBP-BRL",
    "gbp": "GBP-BRL",
    "iene": "JPY-BRL",
    "jpy": "JPY-BRL",
    "peso argentino": "ARS-BRL",
    "peso": "ARS-BRL",
    "bitcoin": "BTC-BRL",
    "btc": "BTC-BRL",
    "ethereum": "ETH-BRL",
    "eth": "ETH-BRL",
    "solana": "SOL-BRL",
    "\\bsol\\b": "SOL-BRL",
    "bnb": "BNB-BRL",
    "xrp": "XRP-BRL",
    "ripple": "XRP-BRL",
    "doge": "DOGE-BRL",
    "cardano": "ADA-BRL",
    "\\bada\\b": "ADA-BRL",
  };
  const pairs = new Set<string>();
  for (const [k, v] of Object.entries(map)) {
    const re = new RegExp(k.includes("\\b") ? k : `\\b${k}\\b`);
    if (re.test(t)) pairs.add(v);
  }
  return Array.from(pairs);
}

function isStaleToolFailureMessage(content: string): boolean {
  const t = normalizePt(content);
  return (
    /\b(nao consigo acessar a internet|ferramenta de pesquisa|erro de permissao|pesquisa esta bloqueada|acesso ao google|buscar diretamente no google)\b/.test(t) ||
    /\b(problema|erro|bloquead|permissao)\b/.test(t) && /\b(google|internet|web|pesquisa|ferramenta)\b/.test(t)
  );
}

function normalizePt(text: string): string {
  return (text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function detectNearbySearch(text: string): { query: string; radiusMeters: number } | null {
  const raw = text ?? "";
  const t = normalizePt(raw);
  if (!t.trim()) return null;

  // Guard 1: mensagens longas são conteúdo pra comentar, não pedido de lugar.
  if (raw.length > 400) return null;

  // Guard 2: cara de documento/código colado (markdown, blocos, várias linhas, chaves, ;).
  const newlineCount = (raw.match(/\n/g) ?? []).length;
  const looksLikeDoc =
    newlineCount >= 3 ||
    /^\s*#{1,6}\s/m.test(raw) ||
    /```/.test(raw) ||
    /[{};]\s*$/m.test(raw) ||
    /\*\*[^*]+\*\*/.test(raw);
  if (looksLikeDoc) return null;

  const placePatterns: Array<{ re: RegExp; query: string; radiusMeters?: number }> = [
    { re: /\b(supermercado|hortifruti|mercearia|grocery)\b/, query: "supermercado", radiusMeters: 2500 },
    { re: /\b(farmacia|drogaria)\b/, query: "farmácia", radiusMeters: 2500 },
    { re: /\b(cafeteria)\b/, query: "cafeteria", radiusMeters: 2000 },
    { re: /\b(restaurante)\b/, query: "restaurante", radiusMeters: 2500 },
    { re: /\b(posto de gasolina|posto gasolina)\b/, query: "posto de gasolina", radiusMeters: 3000 },
    { re: /\b(hospital|upa|pronto socorro)\b/, query: "hospital", radiusMeters: 5000 },
    { re: /\b(padaria)\b/, query: "padaria", radiusMeters: 2000 },
    { re: /\b(caixa eletronico|atm)\b/, query: "banco", radiusMeters: 2500 },
    { re: /\b(shopping)\b/, query: "shopping", radiusMeters: 5000 },
  ];

  // Guard 3: exigir intenção EXPLÍCITA de lugar físico. Palavra solta ("banco",
  // "loja", "mercado", "comida") NÃO dispara — quase sempre é contexto técnico.
  const explicitIntent =
    /\bperto de (mim|aqui|voce)\b/.test(t) ||
    /\b(mais )?(proximo|proxima|perto)\b.*\b(de|da|do)\b/.test(t) ||
    /\b(onde (tem|fica|acho|encontro|posso)|onde ha)\b/.test(t) ||
    /\b(endereco|endereço) (de|do|da)\b/.test(t) ||
    /\bcomo (chego|chegar)\b/.test(t) ||
    /\b(me (indica|mostra|acha|ache)|indica|mostra|ache|acha) (um|uma|o|a) /.test(t) ||
    /\b(ao redor|nas redondezas|na regiao|aqui perto)\b/.test(t);

  if (!explicitIntent) return null;

  const found = placePatterns.find((p) => p.re.test(t));
  if (!found) return null;

  return { query: found.query, radiusMeters: found.radiusMeters ?? 2500 };
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function overpassFilterForQuery(query: string): string {
  const q = normalizePt(query);
  if (/supermercado|mercado|grocery/.test(q)) return `["shop"~"supermarket|convenience|grocery|greengrocer"]`;
  if (/farmacia|drogaria/.test(q)) return `["amenity"="pharmacy"]`;
  if (/cafe|cafeteria/.test(q)) return `["amenity"="cafe"]`;
  if (/restaurante|comida/.test(q)) return `["amenity"="restaurant"]`;
  if (/posto|gasolina|combustivel/.test(q)) return `["amenity"="fuel"]`;
  if (/hospital|emergencia|upa/.test(q)) return `["amenity"~"hospital|clinic|doctors"]`;
  if (/padaria|pao/.test(q)) return `["shop"="bakery"]`;
  if (/banco|caixa|atm/.test(q)) return `["amenity"~"bank|atm"]`;
  if (/shopping|loja/.test(q)) return `["shop"]`;
  return `["name"~"${query.replace(/[^\p{L}\p{N}\s-]/gu, "").slice(0, 40)}",i]`;
}

async function toolBuscarLugaresOpenStreetMap(locRow: any, query: string, radiusMeters?: number, googleError?: string): Promise<string> {
  const radius = Math.min(Math.max(radiusMeters ?? 2500, 200), 20000);
  const lat = Number(locRow.latitude);
  const lng = Number(locRow.longitude);
  const filter = overpassFilterForQuery(query);
  const overpassQuery = `
[out:json][timeout:12];
(
  node${filter}(around:${radius},${lat},${lng});
  way${filter}(around:${radius},${lat},${lng});
  relation${filter}(around:${radius},${lat},${lng});
);
out center tags 25;`.trim();

  const ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    "https://overpass.osm.jp/api/interpreter",
  ];
  let d: any = null;
  let lastErr = "";
  for (const ep of ENDPOINTS) {
    try {
      console.log(`[osm][try] endpoint=${ep} lat=${lat} lng=${lng} r=${radius} q="${query}"`);
      const r = await fetch(ep, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8", "User-Agent": "amz-jarvis/1.0" },
        body: new URLSearchParams({ data: overpassQuery }),
        signal: AbortSignal.timeout(8000),
      });
      if (!r.ok) {
        lastErr = `overpass ${r.status}: ${(await r.text().catch(() => "")).slice(0, 200)}`;
        console.log(`[osm][fail] ${ep} -> ${lastErr}`);
        continue;
      }
      d = await r.json();
      console.log(`[osm][ok] ${ep} elements=${(d.elements ?? []).length}`);
      break;
    } catch (e) {
      lastErr = String((e as Error).message);
      console.log(`[osm][exception] ${ep} -> ${lastErr}`);
    }
  }
  if (!d) {
    return JSON.stringify({ erro: `openstreetmap indisponivel: ${lastErr}`, detalhe_google: googleError });
  }
  try {
    const seen = new Set<string>();
    const lugares = (d.elements ?? [])
      .map((el: any) => {
        const pLat = Number(el.lat ?? el.center?.lat);
        const pLng = Number(el.lon ?? el.center?.lon);
        if (!Number.isFinite(pLat) || !Number.isFinite(pLng)) return null;
        const tags = el.tags ?? {};
        const nome = tags.name || tags.brand || tags.operator || query;
        const key = `${normalizePt(nome)}:${pLat.toFixed(5)}:${pLng.toFixed(5)}`;
        if (seen.has(key)) return null;
        seen.add(key);
        const endereco = [
          tags["addr:street"],
          tags["addr:housenumber"],
          tags["addr:suburb"] || tags["addr:neighbourhood"],
          tags["addr:city"],
        ].filter(Boolean).join(", ") || null;
        return {
          nome,
          tipo: tags.shop || tags.amenity || tags.healthcare || query,
          endereco,
          distancia_km: Number(haversineKm(lat, lng, pLat, pLng).toFixed(2)),
          aberto_agora: tags.opening_hours ? undefined : undefined,
          horario: tags.opening_hours || null,
          telefone: tags.phone || tags["contact:phone"] || null,
          mapa: `https://www.google.com/maps/search/?api=1&query=${pLat},${pLng}`,
          fonte: "OpenStreetMap",
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => a.distancia_km - b.distancia_km)
      .slice(0, 8);

    return JSON.stringify({
      query,
      origem: { lat, lng, endereco: locRow.address, idade_minutos: Math.round((Date.now() - new Date(locRow.updated_at).getTime()) / 60000) },
      fonte: "OpenStreetMap",
      fallback_usado: Boolean(googleError),
      detalhe_google: googleError ? googleError.slice(0, 180) : undefined,
      lugares,
    });
  } catch (e) {
    return JSON.stringify({ erro: String((e as Error).message), detalhe_google: googleError });
  }
}

function formatNearbyReply(raw: string, query: string): string {
  let data: any;
  try { data = JSON.parse(raw); } catch { data = { erro: raw }; }

  if (data?.erro === "sem_localizacao") {
    return "Ainda não recebi sua localização atual. Me envie pelo WhatsApp em 📎 → Localização → Enviar localização atual, que eu busco os lugares mais próximos na sequência.";
  }

  const lugares = Array.isArray(data?.lugares) ? data.lugares : [];
  if (!lugares.length) {
    if (data?.erro) {
      console.log(`[nearby][empty] erro=${String(data.erro).slice(0, 300)} google=${String(data?.detalhe_google ?? "").slice(0, 300)}`);
    }
    return `Recebi sua localização, mas não encontrei ${query} próximo num raio seguro agora. Quer que eu tente ampliar a busca para alguns quilômetros a mais?`;
  }


  const first = lugares[0];
  const lines = lugares.slice(0, 4).map((l: any, i: number) => {
    const dist = Number.isFinite(Number(l.distancia_km)) ? `${Number(l.distancia_km).toFixed(2)} km` : "distância não informada";
    const nota = l.nota ? ` • nota ${l.nota}${l.avaliacoes ? ` (${l.avaliacoes})` : ""}` : "";
    const aberto = l.aberto_agora === true ? " • aberto agora" : l.aberto_agora === false ? " • pode estar fechado" : "";
    const endereco = l.endereco ? `\n   ${l.endereco}` : "";
    const mapa = l.mapa ? `\n   Mapa: ${l.mapa}` : "";
    return `${i + 1}. ${l.nome || query} — ${dist}${nota}${aberto}${endereco}${mapa}`;
  });

  return `Localização recebida. O ${query} mais próximo que encontrei é **${first.nome || query}**, a cerca de **${Number(first.distancia_km).toFixed(2)} km**.\n\n${lines.join("\n\n")}\n\nQuer que eu trace a rota para o primeiro?`;
}

async function toolBuscarLugaresProximos(
  ctx: { userId: string; fromNumber: string },
  query: string,
  radiusMeters?: number,
): Promise<string> {
  const { data: locRow } = await sb
    .from("whatsapp_user_locations")
    .select("latitude, longitude, address, updated_at")
    .eq("user_id", ctx.userId)
    .eq("contact_number", ctx.fromNumber)
    .maybeSingle();
  if (!locRow) {
    return JSON.stringify({
      erro: "sem_localizacao",
      instrucao: "Peça ao usuário para compartilhar a localização no WhatsApp (📎 → Localização → Enviar localização atual) e tentar de novo.",
    });
  }
  // OSM (Overpass) como fonte primária — gratuito, sem chave.
  const overpassResult = await toolBuscarLugaresOpenStreetMap(locRow, query, radiusMeters, null);
  try {
    const parsed = JSON.parse(overpassResult);
    if (Array.isArray(parsed?.lugares) && parsed.lugares.length > 0) return overpassResult;
    console.log(`[nearby] overpass vazio/falhou, tentando Nominatim. erro=${parsed?.erro ?? "vazio"}`);
  } catch (_) {}
  // Fallback: Nominatim (busca textual em torno do ponto)
  return await toolBuscarLugaresNominatim(locRow, query, radiusMeters);
}

async function toolBuscarLugaresNominatim(locRow: any, query: string, radiusMeters?: number): Promise<string> {
  const lat = Number(locRow.latitude);
  const lng = Number(locRow.longitude);
  const radius = Math.min(Math.max(radiusMeters ?? 2500, 500), 20000);
  // ~1 grau lat = 111km. Aproxima uma bounding box.
  const dLat = radius / 111000;
  const dLng = radius / (111000 * Math.max(0.1, Math.cos(lat * Math.PI / 180)));
  const viewbox = `${lng - dLng},${lat + dLat},${lng + dLng},${lat - dLat}`;
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=20&addressdetails=1&bounded=1&viewbox=${viewbox}&q=${encodeURIComponent(query)}`;
  try {
    console.log(`[nominatim][try] ${url}`);
    const r = await fetch(url, {
      headers: { "User-Agent": "amz-jarvis/1.0 (contato@amzofertas.com.br)", "Accept-Language": "pt-BR" },
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      return JSON.stringify({ erro: `nominatim ${r.status}`, detalhe: t.slice(0, 200) });
    }
    const arr = await r.json();
    const lugares = (Array.isArray(arr) ? arr : [])
      .map((el: any) => {
        const pLat = Number(el.lat);
        const pLng = Number(el.lon);
        if (!Number.isFinite(pLat) || !Number.isFinite(pLng)) return null;
        const a = el.address ?? {};
        const endereco = [a.road, a.house_number, a.suburb || a.neighbourhood, a.city || a.town || a.village].filter(Boolean).join(", ") || el.display_name || null;
        return {
          nome: el.name || (el.display_name || query).split(",")[0],
          tipo: el.type || query,
          endereco,
          distancia_km: Number(haversineKm(lat, lng, pLat, pLng).toFixed(2)),
          mapa: `https://www.google.com/maps/search/?api=1&query=${pLat},${pLng}`,
          fonte: "Nominatim",
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => a.distancia_km - b.distancia_km)
      .slice(0, 8);
    return JSON.stringify({
      query,
      origem: { lat, lng, endereco: locRow.address, idade_minutos: Math.round((Date.now() - new Date(locRow.updated_at).getTime()) / 60000) },
      fonte: "Nominatim",
      fallback_usado: true,
      lugares,
    });
  } catch (e) {
    return JSON.stringify({ erro: `nominatim_exception: ${String((e as Error).message)}` });
  }
}

// 📐 FORMATO SOCIAL OBRIGATÓRIO — toda imagem do Jarvis já sai pronta pra Instagram
// (e por consequência serve pro Facebook, que é menos exigente).
// Padrão: 1:1 quadrado 1080x1080. Só vira 9:16 vertical quando o pedido fala de story/reels.
function blocoFormatoSocial(pedido?: string): string {
  const vertical = /\bstor(y|ies)\b|\breels?\b|\bvertical\b|9:16|tela cheia/i.test(pedido || "");
  return vertical
    ? `\n\n📐 FORMATO OBRIGATÓRIO — STORY/REELS:
- Proporção EXATA 9:16 (vertical, 1080x1920 px). Não entregue quadrado nem paisagem.
- Composição pensada para tela de celular: produto/assunto centralizado, respiro no topo e na base (áreas seguras), nada essencial nos 15% superiores e inferiores.
- Preencha todo o quadro: sem bordas brancas, sem barras laterais, sem moldura, sem letterbox.`
    : `\n\n📐 FORMATO OBRIGATÓRIO — FEED INSTAGRAM/FACEBOOK:
- Proporção EXATA 1:1 (quadrado, 1080x1080 px). Não entregue 16:9, 4:3, panorâmica nem vertical.
- Enquadre o assunto de forma que nada importante fique cortado no quadrado.
- Preencha todo o quadro: sem bordas brancas, sem barras laterais, sem moldura, sem letterbox, sem fundo transparente.
- Qualidade alta, pronta para publicação direta no Instagram e Facebook.`;
}

// ---- gerar_imagem: cria imagem por IA (Nano Banana), sobe pro storage e salva em /midias ----
// Padrão IA Marketing: fotorealista, sem texto/letras/marca d'água, iluminação profissional.
async function toolGerarImagem(
  prompt: string,
  ctx: {
    userId: string;
    fromNumber?: string;
    incluirLogo?: boolean;
    demonstracao?: boolean;
    references?: string[];
    brandColors?: string[];
    logoDataUrl?: string | null;
    brandName?: string | null;
    brandSource?: "site";
  },
): Promise<string> {
  if (!isOwner({ userId: ctx.userId, fromNumber: ctx.fromNumber || "" }) && !ctx.demonstracao) {
    return JSON.stringify({ ok: false, erro: "acao_restrita_ao_responsavel" });
  }
  const clean = (prompt || "").trim();
  if (!clean) return JSON.stringify({ erro: "prompt vazio" });
  try {
    // Demonstração nunca carrega ativos do tenant. A única marca permitida
    // nela é a identidade temporária de um site enviada explicitamente.
    const temporarySiteDemo = ctx.demonstracao === true && ctx.brandSource === "site";
    const shouldUseLogo = (!ctx.demonstracao || temporarySiteDemo) && ctx.incluirLogo !== false;
    const shouldResolveBrand = shouldUseLogo
      || (ctx.demonstracao === true && (ctx.brandColors?.length ?? 0) > 0);
    let logoDataUrl: string | null = null;
    let logoForLightBackgroundDataUrl: string | null = null;
    let logoForDarkBackgroundDataUrl: string | null = null;
    let brandColors: string[] = ctx.brandColors ?? [];
    let brandName: string | null = null;
    if (shouldResolveBrand) {
      const assets = ctx.demonstracao || ctx.brandSource === "site"
        ? null
        : await loadTenantBrandAssets(sb, ctx.userId);
      const resolvedBrand = resolveWhatsAppGeneratorBrand(ctx, assets);
      logoDataUrl = resolvedBrand.logoDataUrl;
      logoForLightBackgroundDataUrl =
        resolvedBrand.logoForLightBackgroundDataUrl;
      logoForDarkBackgroundDataUrl =
        resolvedBrand.logoForDarkBackgroundDataUrl;
      brandColors = resolvedBrand.brandColors;
      brandName = resolvedBrand.brandName;
      console.log("[gerar_imagem] marca padrão, logo encontrada:", !!logoDataUrl);
    }
    console.log(
      "[gerar_imagem] motor compartilhado, promptLen=",
      clean.length,
      "logoDisponivel=",
      !!logoDataUrl,
    );
    const generated = await generateMarketingImage({
      prompt: clean,
      references: ctx.references,
      logoDataUrl,
      logoForLightBackgroundDataUrl,
      logoForDarkBackgroundDataUrl,
      brandColors,
      brandName,
      apiKey: LOVABLE_API_KEY,
    });
    const bytes = generated.bytes;
    const imageFormat = imageUploadMetadata(bytes, generated.mimeType);
    if (!imageFormat) return JSON.stringify({ erro: "imagem_gerada_invalida" });
    const mime = imageFormat.mime;
    const logoAplicada = generated.logoApplied;
    const fileName = `midias/${ctx.userId}/ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${imageFormat.extension}`;
    const { error: upErr } = await sb.storage.from("produtos").upload(fileName, bytes, { contentType: mime, upsert: true });
    if (upErr) return JSON.stringify({ erro: `upload_falhou: ${upErr.message}` });
    const { data: pub } = sb.storage.from("produtos").getPublicUrl(fileName);
    if (!pub?.publicUrl) return JSON.stringify({ erro: "sem_url_publica" });

    // Salva automaticamente na biblioteca /midias para o usuário poder publicar
    let midiaId: string | null = null;
    try {
      const { data: novo, error: insErr } = await sb
        .from("midias_whatsapp")
        .insert({
          user_id: ctx.userId,
          origem: "ia_whatsapp",
          telefone_origem: ctx.fromNumber ?? null,
          tipo: "foto",
          midia_url: pub.publicUrl,
          mime_type: mime,
          tamanho_bytes: bytes.length,
          contexto_original: clean,
          status: "pendente",
        })
        .select("id")
        .single();
      if (insErr || !novo?.id) {
        throw new Error(`db_falhou: ${insErr?.message || "insert sem retorno"}`);
      }
      midiaId = novo?.id ?? null;
    } catch (e) {
      console.warn("[gerar_imagem] falhou ao salvar em midias_whatsapp:", (e as Error).message);
    }

    return JSON.stringify({
      ok: true,
      image_url: pub.publicUrl,
      prompt: clean,
      midia_id: midiaId,
      salvo_em_midias: !!midiaId,
      logo_aplicada: logoAplicada,
      brand_application_mode: generated.brandApplicationMode,
      logo_solicitada_sem_cadastro: shouldUseLogo && !logoDataUrl,
      logo_aplicacao_falhou: generated.logoApplicationFailed,
      brand_source: ctx.brandSource ?? null,
      site_logo_requested: ctx.brandSource === "site" && Boolean(logoDataUrl),
      demonstracao: ctx.demonstracao === true,
      exemplo_legenda_solicitado: ctx.demonstracao === true,
      instrucao: ctx.demonstracao
        ? ctx.brandSource === "site"
          ? "DEMONSTRAÇÃO: escreva SOMENTE uma legenda curta para a imagem. NÃO afirme nada sobre logo, marca, cores ou identidade visual; o código anexará a informação exata. Nada foi salvo no cadastro nem publicado. Depois da demo, registre o lead e avise que um consultor da AMZ vai entrar em contato."
          : "DEMONSTRAÇÃO: envie a imagem somente nesta conversa e escreva junto um exemplo curto de legenda pronta baseado no pedido. Informe honestamente que foi feita sem logo de cadastro e que nada foi publicado. Depois da demo, registre o lead e avise que um consultor da AMZ vai entrar em contato."
        : ctx.brandSource === "site"
        ? (logoAplicada
          ? "A imagem usou a logo encontrada no site somente nesta geração. Informe honestamente que ela foi aplicada na cena ou pelo fallback."
          : logoDataUrl
          ? "A logo encontrada no site não pôde ser aplicada; informe que foram usadas somente as cores."
          : "A imagem foi criada somente com as cores encontradas no site.")
        : ctx.incluirLogo === false
        ? "A imagem foi criada sem logo, como o usuário pediu. Informe isso com clareza."
        : shouldUseLogo && !logoDataUrl
        ? (brandColors.length
          ? "A imagem foi criada usando as cores da marca, mas sem logo. Informe isso com clareza."
          : "A imagem foi criada sem logo porque não há uma logo cadastrada. Informe isso com clareza.")
        : (logoAplicada
          ? generated.brandApplicationMode === "in_scene_verified"
              || generated.brandApplicationMode === "in_scene_retry_verified"
            ? "A imagem foi criada com a logo verificada em uma superfície real da cena. Diga: “Apliquei sua logo na cena.”"
            : "A imagem foi criada com a logo original aplicada pelo fallback seguro. Diga: “Apliquei sua logo sobre a imagem.”"
          : logoDataUrl
          ? "A imagem foi criada, mas diga: “Não consegui aplicar a logo desta vez.” Nunca afirme que a marca foi aplicada."
          : "A imagem foi criada sem logo e salva na biblioteca /midias. Informe honestamente que foi gerada sem logo."),
    });
  } catch (e) {
    return JSON.stringify({ erro: String((e as Error).message) });
  }
}

type PreparedWhatsAppImage =
  | { deferred: true; text: string; imageUrl?: string; interactiveButtons?: WhatsAppInteractiveButtons }
  | { deferred: false; raw: string };

async function prepareWhatsAppImageGeneration(input: {
  prompt: string;
  ctx: { userId: string; fromNumber: string; convId?: string; agentState?: AgentConvState };
  demonstracao?: boolean;
  prospectSiteUrl?: string;
  prospectBrandColors?: unknown;
  references?: string[];
  chainedPost?: boolean;
  chainedRequest?: string;
}): Promise<PreparedWhatsAppImage> {
  if (input.demonstracao) {
    const plan = prospectDemoBrandPlan({
      isAmzProspect: input.ctx.userId === ADMIN_AMZ_USER_ID,
      siteUrl: extractWhatsAppBrandSiteUrl(input.prospectSiteUrl || ""),
      brandColors: input.prospectBrandColors,
    });
    if (plan.useTemporarySiteIdentity && plan.siteUrl) {
      try {
        const identity = await fetchBrandSiteIdentity(plan.siteUrl);
        return {
          deferred: false,
          raw: await toolGerarImagem(input.prompt, {
            userId: input.ctx.userId,
            fromNumber: input.ctx.fromNumber,
            demonstracao: true,
            references: input.references,
            ...whatsAppSiteBrandGenerationOptions(identity),
          }),
        };
      } catch (error) {
        console.warn("[demo-prospect][site_identity_failed]", error);
        return {
          deferred: true,
          text: SITE_IDENTITY_READ_FAILURE_MESSAGE,
        };
      }
    }
    return {
      deferred: false,
      raw: await toolGerarImagem(input.prompt, {
        userId: input.ctx.userId,
        fromNumber: input.ctx.fromNumber,
        demonstracao: true,
        incluirLogo: false,
        brandColors: plan.brandColors,
        references: input.references,
      }),
    };
  }
  const assets = await loadTenantBrandAssets(sb, input.ctx.userId);
  const directive = detectWhatsAppBrandDirective(input.prompt);
  const siteUrl = extractExplicitWhatsAppBrandSiteUrl(input.prompt);
  const preference = input.ctx.agentState?.brand_image_preference ?? null;
  const decision = decideWhatsAppImageBrand({
    demonstration: false,
    hasSavedLogo: Boolean(assets.logoDataUrl),
    directive,
    preference,
  });
  const conversation = input.ctx.convId
    ? { id: input.ctx.convId, userId: input.ctx.userId, contactNumber: input.ctx.fromNumber }
    : null;
  const basePending = {
    prompt: input.prompt,
    created_at: new Date().toISOString(),
    chained_post: input.chainedPost,
    original_request: input.chainedRequest,
    reference_urls: input.references,
  };
  if (siteUrl && !directive && conversation) {
    try {
      const identity = await fetchBrandSiteIdentity(siteUrl);
      await saveAgentState(sb, conversation, {
        pending_brand_generation: null,
      }, input.ctx.agentState ?? {});
      const siteBrand = whatsAppSiteBrandGenerationOptions(identity);
      return {
        deferred: false,
        raw: await toolGerarImagem(input.prompt, {
          userId: input.ctx.userId,
          fromNumber: input.ctx.fromNumber,
          references: input.references,
          ...siteBrand,
        }),
      };
    } catch (error) {
      console.error("[whatsapp-brand-site] link no pedido falhou:", error instanceof Error ? error.message : String(error));
      return {
        deferred: true,
        text: SITE_IDENTITY_READ_FAILURE_MESSAGE,
      };
    }
  }
  if (decision.reason === "missing_logo" && conversation) {
    const pending: PendingBrandGeneration = {
      ...basePending,
      stage: "awaiting_logo_upload",
    };
    await saveAgentState(sb, conversation, { pending_brand_generation: pending }, input.ctx.agentState ?? {});
    if (input.ctx.agentState) input.ctx.agentState.pending_brand_generation = pending;
    return {
      deferred: true,
      text: "Envie a imagem da sua logo (PNG, de preferência com fundo transparente).",
    };
  }
  if (decision.askChoice && conversation) {
    const pending: PendingBrandGeneration = {
      ...basePending,
      stage: "awaiting_choice",
    };
    await saveAgentState(sb, conversation, { pending_brand_generation: pending }, input.ctx.agentState ?? {});
    if (input.ctx.agentState) input.ctx.agentState.pending_brand_generation = pending;
    return {
      deferred: true,
      text: "Como quer a marca nesta imagem?",
      interactiveButtons: {
        header: "Identidade da imagem",
        body: "Escolha uma opção para este pedido.",
        buttons: [
          { id: "brand_image_logo", title: "Com minha marca" },
          { id: "brand_image_site", title: "Cores do meu site" },
          { id: "brand_image_none", title: "Sem marca" },
        ],
      },
    };
  }
  return {
    deferred: false,
    raw: await toolGerarImagem(input.prompt, {
      userId: input.ctx.userId,
      fromNumber: input.ctx.fromNumber,
      incluirLogo: decision.useLogo,
      references: input.references,
      brandColors: decision.colors,
    }),
  };
}

async function temporaryBrandLogoDataUrl(
  path: string,
  mime = "image/png",
): Promise<string | null> {
  const { data, error } = await sb.storage.from("tenant-logos").download(path);
  if (error || !data) return null;
  const bytes = new Uint8Array(await data.arrayBuffer());
  if (!bytes.length || bytes.length > 5 * 1024 * 1024) return null;
  return `data:${mime};base64,${base64Encode(bytes.buffer)}`;
}

async function completePendingBrandGeneration(
  raw: string,
  pending: PendingBrandGeneration,
  toolCtx: any,
  explicitlyUnbranded = false,
): Promise<{ text: string; imageUrl?: string; interactiveButtons?: WhatsAppInteractiveButtons }> {
  if (!pending.chained_post) {
    return completedWhatsAppImageResponse(raw, explicitlyUnbranded);
  }
  let generated: any = {};
  try { generated = JSON.parse(raw); } catch { /* erro honesto abaixo */ }
  if (generated?.ok !== true || !generated?.image_url) {
    return {
      text: whatsAppImageFailureMessage(generated),
    };
  }
  if (generated?.midia_id) await rememberLastMediaInteraction(toolCtx, generated.midia_id);
  if (!generated?.midia_id) {
    return {
      text: "Gerei a imagem, mas não consegui salvá-la na biblioteca para montar a prévia do post.",
      imageUrl: generated.image_url,
    };
  }
  const chainedRequest = pending.original_request || pending.prompt;
  const social = detectSocialPostIntent(chainedRequest, { allowGenerationChain: true }) ?? {
    produto: "",
    tom: "urgencia",
    redes: ["facebook", "instagram"],
    temProduto: false,
    formato: detectSocialPostFormat(chainedRequest) ?? "feed",
  };
  const briefing = extractSocialPostBriefing(chainedRequest);
  const postResult = await toolPostarMidiaBiblioteca({
    midia_id: generated.midia_id,
    legenda: briefing || cleanMediaPostLegenda(chainedRequest),
    briefing,
    tom: social.tom,
    redes: social.redes.length ? social.redes : ["facebook", "instagram"],
    formato: social.formato ?? "feed",
    incluir_cta_whatsapp: detectWantsWhatsappCta(chainedRequest),
  }, toolCtx);
  const brandResult = whatsAppImageBrandResultMessage(generated, explicitlyUnbranded);
  return {
    text: `${brandResult}\n\n${formatSocialPostToolResult(postResult)}`,
    interactiveButtons: interactiveButtonsFromSocialResult(postResult),
  };
}

function completedWhatsAppImageResponse(raw: string, explicitlyUnbranded = false): {
  text: string;
  imageUrl?: string;
} {
  let result: any = {};
  try { result = JSON.parse(raw); } catch { /* erro honesto abaixo */ }
  if (result?.ok !== true || !result?.image_url) {
    return {
      text: whatsAppImageFailureMessage(result),
    };
  }
  const brandMessage = whatsAppImageBrandResultMessage(result, explicitlyUnbranded);
  const code = result.midia_id ? `<<SPLIT>>${linhaCodigoMidia(result.midia_id, "foto")}` : "";
  return {
    text: `Pronto — criei a imagem e salvei na biblioteca. ${brandMessage}${code}`,
    imageUrl: result.image_url,
  };
}

// ---- editar_imagem: edita/melhora foto enviada (turno atual ou última foto recente da biblioteca) ----
async function toolEditarImagem(
  prompt: string,
  ctx: {
    userId: string;
    fromNumber?: string;
    media?: MediaExtract[];
    textos?: string[];
    modo?: string;
    preservarAmbiente?: boolean;
    registrarNaBiblioteca?: boolean;
    imageInputUrl?: string;
  },
): Promise<string> {
  if (!isOwner({ userId: ctx.userId, fromNumber: ctx.fromNumber || "" })) {
    return JSON.stringify({ ok: false, erro: "acao_restrita_ao_responsavel" });
  }
  const clean = (prompt || "").trim();
  if (!clean) return JSON.stringify({ erro: "prompt vazio" });

  // 1) imagem do turno atual; 2) fallback: última foto recente da biblioteca (30 min)
  let imageInput: string | null = null;
  const img = (ctx.media || []).slice().reverse().find((m) => m.kind === "image");
  if (img) {
    imageInput = `data:${img.mime};base64,${img.base64}`;
  } else if (/^https?:\/\//i.test(String(ctx.imageInputUrl || ""))) {
    imageInput = String(ctx.imageInputUrl);
  } else {
    try {
      const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const { data: rec } = await sb
        .from("midias_whatsapp")
        .select("midia_url, created_at")
        .eq("user_id", ctx.userId)
        .eq("telefone_origem", ctx.fromNumber)
        .eq("tipo", "foto")
        .gte("created_at", cutoff)
        .order("created_at", { ascending: false })
        .limit(1);
      if (rec?.[0]?.midia_url) imageInput = rec[0].midia_url as string;
    } catch (e) {
      console.warn("[editar_imagem] fallback midias falhou:", (e as Error).message);
    }
  }
  if (!imageInput) {
    return JSON.stringify({
      erro: "sem_imagem",
      instrucao: "Peça ao usuário para enviar a foto no mesmo momento do pedido de edição.",
    });
  }

  const textos = (ctx.textos || []).map((t) => String(t || "").trim()).filter(Boolean).slice(0, 6);
  const modo = (ctx.modo || "").trim().toLowerCase();
  // 🔒 Pedido de LOGO/MARCA nunca troca a foto: a imagem original é mantida
  // pixel a pixel e a marca é apenas aplicada sobre ela.
  const isLogo = modo === "aplicar_logo" || modo === "logo" || modo === "marca" ||
    /\b(logo|logotipo|marca|logomarca)\b/i.test(clean);
  const isAnuncio = !isLogo &&
    (modo === "ficha_tecnica" || modo === "anuncio" || modo === "estudio" || modo === "trocar_ambiente");
  // Em modo anúncio/ficha técnica o ambiente ORIGINAL deve ser descartado por padrão
  // (fios, TV, móveis, bagunça de casa nunca podem aparecer numa arte comercial).
  const preservar = isLogo ? true : isAnuncio ? ctx.preservarAmbiente === true : ctx.preservarAmbiente !== false;


  const blocoTexto = textos.length
    ? `\n\n📝 TEXTOS QUE DEVEM APARECER NA IMAGEM (obrigatório, escreva EXATAMENTE assim, sem inventar nem traduzir):\n${textos.map((t) => `- "${t}"`).join("\n")}\nRegras da tipografia:\n- Posicione as informações AO LADO (ou em faixa lateral/inferior) do objeto principal, em área limpa, NUNCA cobrindo o produto, rostos ou placa.\n- Fonte sans-serif moderna, legível, alinhada, hierarquia clara (destaque no dado mais forte).\n- Fundo sutil atrás do texto (faixa translúcida ou bloco sólido) para garantir contraste.\n- Sem erros de ortografia, sem letras cortadas, sem repetir o mesmo texto duas vezes.\n- Não adicione NENHUM outro texto além dos listados acima.`
    : `\n\nRegras: NÃO inclua texto, palavras, letras, números ou marcas d'água na imagem.`;

  // 🔒 A logo NUNCA é desenhada pela IA: usamos o arquivo real do tenant como
  // imagem de referência. Sem logo cadastrada, o pedido não é executado.
  let logoDataUrl: string | null = null;
  if (isLogo) {
    try {
      logoDataUrl = await getTenantLogoDataUrl(sb, ctx.userId);
    } catch (e) {
      console.warn("[editar_imagem] logo do tenant indisponível:", (e as Error).message);
    }
    if (!logoDataUrl) {
      return JSON.stringify({
        erro: "sem_logo_cadastrada",
        instrucao: "Avise que a logo da empresa ainda não está cadastrada em Minha Marca e peça o arquivo da logo (PNG com fundo transparente) para aplicar na foto. NÃO desenhe/invente nenhuma marca na imagem.",
      });
    }
  }

  const blocoModo = isLogo
    ? `\n\n🎯 MODO APLICAR LOGO/MARCA — A FOTO ORIGINAL NÃO PODE MUDAR:
- Você recebeu DUAS imagens: a PRIMEIRA é a FOTO BASE (resultado final) e a SEGUNDA é o ARQUIVO OFICIAL DA LOGO (apenas referência gráfica, nunca entra como cena).
- Esta é uma EDIÇÃO LOCAL. Devolva EXATAMENTE a MESMA foto recebida, pixel a pixel: mesmo enquadramento, mesmo objeto, mesmo cenário, mesma luz, mesmas sombras, mesmas cores, mesma resolução e mesma proporção.
- É PROIBIDO gerar uma foto nova, trocar o objeto/xícara/produto por outro modelo, mudar de ângulo, mudar o fundo, recriar a cena, mudar a mesa/superfície, criar letreiro/neon/placa com o nome da marca ou "melhorar" a composição.
- A ÚNICA alteração permitida é APLICAR A LOGO DA SEGUNDA IMAGEM no local pedido, respeitando a curvatura, a perspectiva, o brilho e as sombras da superfície, como se estivesse impressa ali.
- Reproduza a logo EXATAMENTE como está no arquivo de referência: mesmas cores, mesma tipografia, mesmo símbolo, mesmas proporções. É PROIBIDO redesenhar, estilizar, traduzir, reescrever o nome ou inventar variação.
- Nada mais na imagem pode ser alterado.`
    : isAnuncio
    ? `\n\n🎯 MODO ANÚNCIO/FICHA TÉCNICA — TROCA TOTAL DE AMBIENTE (obrigatório):
- RECORTE o produto principal da foto e DESCARTE COMPLETAMENTE o cenário original.
- É PROIBIDO deixar qualquer resquício do local original: fios, tomadas, televisão, monitor, móveis, mesa, sofá, cortina, parede de casa, chão de casa, rodapé, roupa, pessoas ao fundo, papel, embalagens soltas, objetos de fundo, reflexo do ambiente antigo.
- SUBSTITUA por um set comercial limpo: fundo de estúdio sólido/gradiente sofisticado (ou showroom, quando for veículo), piso levemente reflexivo, iluminação de estúdio com sombra suave sob o produto, profundidade de campo rasa.
- O RESULTADO deve parecer foto de catálogo/e-commerce profissional: fundo totalmente controlado, zero bagunça, zero distração.
- Preserve 100% o PRODUTO em si: mesma marca, mesmo rótulo, mesmas cores, mesmo formato, mesmos textos da embalagem, mesma unidade (não troque por outro modelo, não redesenhe o rótulo).`
    : modo === "figurino" || modo === "fantasia" || modo === "roupa"
    ? `\n\n🎯 MODO FIGURINO: troque APENAS a roupa/fantasia da pessoa conforme o pedido. É OBRIGATÓRIO manter o MESMO rosto, mesma idade, mesmo corte de cabelo, mesma pele, mesma pose e o MESMO AMBIENTE/fundo (mesmos móveis, mesma luz, mesmo enquadramento). Não troque o cenário, não deixe a pessoa parecida com outra criança/adulto, não gere desenho — fotorealista.`
    : `\n\n🎯 MODO MELHORIA: eleve a qualidade (nitidez, cor, luz, composição) mantendo a cena reconhecível.`;

  const blocoPreservar = isLogo
    ? `\n\n🔒 PRESERVAÇÃO TOTAL: a foto de entrada é a base final. Só a marca/logo é adicionada; todo o resto permanece idêntico.`
    : preservar
    ? `\n\n🔒 PRESERVAÇÃO OBRIGATÓRIA: mantenha o mesmo ambiente/cenário, o mesmo enquadramento e as mesmas pessoas (rosto, feições, tom de pele, cabelo) e o mesmo objeto/produto principal identificáveis. Não substitua por outra pessoa/objeto.`
    : `\n\n🔒 PRESERVE SÓ O PRODUTO: o objeto/produto principal (e rostos, se houver pessoa) deve continuar idêntico e reconhecível. O CENÁRIO pode e DEVE ser recriado do zero.`;


  try {
    const dataUrlInput = imageInput;
    const r = await chamarGatewayImagem(
      {
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Edite esta foto conforme o pedido abaixo.\n\nPedido: ${clean}${blocoModo}${blocoPreservar}${blocoTexto}${isLogo ? "\n\n📐 FORMATO: mantenha EXATAMENTE a mesma proporção e resolução da foto original — não recorte, não expanda, não reenquadre." : blocoFormatoSocial(clean + " " + modo)}\n\nResultado fotorealista de alta qualidade, pronto para publicação.`,
              },
              { type: "image_url", image_url: { url: dataUrlInput } },
              ...(logoDataUrl ? [{ type: "image_url", image_url: { url: logoDataUrl } }] : []),
            ],
          },
        ],
        modalities: ["image", "text"],
      },
      "editar_imagem",
    );
    if (!r.ok) return JSON.stringify({ erro: r.erro, detalhe: r.detalhe, motivo: r.motivo });
    const dataUrl = r.dataUrl;

    let b64 = dataUrl;
    let mime = "image/png";
    if (b64.startsWith("data:")) {
      const m = b64.match(/^data:(image\/\w+);base64,(.+)$/);
      if (m) { mime = m[1]; b64 = m[2]; }
    }
    const bytes = base64Decode(b64);
    const imageFormat = imageUploadMetadata(bytes, mime);
    if (!imageFormat) return JSON.stringify({ erro: "imagem_editada_invalida" });
    mime = imageFormat.mime;
    const fileName = `whatsapp-ai/${ctx.userId}/edit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${imageFormat.extension}`;
    const { error: upErr } = await sb.storage.from("produtos").upload(fileName, bytes, { contentType: mime, upsert: true });
    if (upErr) return JSON.stringify({ erro: `upload_falhou: ${upErr.message}` });
    const { data: pub } = sb.storage.from("produtos").getPublicUrl(fileName);
    if (!pub?.publicUrl) return JSON.stringify({ erro: "sem_url_publica" });

    // 🔒 BLINDAGEM: a imagem MELHORADA precisa entrar na biblioteca /midias como a
    // mídia MAIS RECENTE. Sem isso, "posta essa imagem" pegava a FOTO ORIGINAL
    // (salva por salvar_midia_biblioteca) em vez da versão tratada.
    let midiaId: string | null = null;
    if (ctx.registrarNaBiblioteca !== false) {
      try {
        const { data: novo, error: insErr } = await sb
          .from("midias_whatsapp")
          .insert({
            user_id: ctx.userId,
            origem: "ia_edicao",
            telefone_origem: ctx.fromNumber ?? null,
            tipo: "foto",
            midia_url: pub.publicUrl,
            mime_type: mime,
            tamanho_bytes: bytes.length,
            contexto_original: [clean, textos.length ? `Dados: ${textos.join(" | ")}` : ""].filter(Boolean).join("\n").slice(0, 1500),
            status: "pendente",
          })
          .select("id")
          .maybeSingle();
        if (insErr || !novo?.id) {
          throw new Error(`db_falhou: ${insErr?.message || "insert sem retorno"}`);
        }
        midiaId = novo?.id ?? null;
      } catch (e) {
        console.warn("[editar_imagem] falhou ao salvar em midias_whatsapp:", (e as Error).message);
      }
    }

    return JSON.stringify({
      ok: true,
      image_url: pub.publicUrl,
      prompt: clean,
      midia_id: midiaId,
      salvo_em_midias: !!midiaId,
      instrucao: midiaId
        ? `A imagem TRATADA foi enviada ao usuário e salva na biblioteca /midias com midia_id="${midiaId}". Se ele pedir pra publicar, chame postar_midia_biblioteca SEMPRE passando midia_id="${midiaId}" — é PROIBIDO publicar a foto original.`
        : "A imagem tratada foi enviada ao usuário. Se ele pedir pra publicar, use a versão tratada (não a foto original).",
    });
  } catch (e) {
    return JSON.stringify({ erro: String((e as Error).message) });
  }
}

type CompositionSource = {
  id: string | null;
  url: string;
  context?: string | null;
  productId?: string | null;
};

type CompositionResult =
  | { ok: true; imageUrl: string; mediaId: string; resolution: ImageCompositionResolution }
  | { ok: false; message: string; reason: string };

async function resolveCompositionSources(
  userId: string,
  fromNumber: string,
  requestText: string,
  explicitPhotos?: CompositionSource[],
  preferredMediaIds: string[] = [],
): Promise<{ environment: CompositionSource; product: CompositionSource } | null> {
  type CompositionMediaRow = { id: string; midia_url: string; contexto_original?: string | null };
  let photos = (explicitPhotos ?? []).filter((photo) => !!photo.url);
  const preferredIds = preferredMediaIds.filter(Boolean).slice(-2);
  if (photos.length < 2 && preferredIds.length > 0) {
    const { data: preferred, error: preferredError } = await sb
      .from("midias_whatsapp")
      .select("id, midia_url, contexto_original")
      .eq("user_id", userId)
      .eq("telefone_origem", fromNumber)
      .eq("tipo", "foto")
      .in("id", preferredIds);
    if (preferredError) {
      throw new Error(`composition_preferred_media_lookup_failed: ${preferredError.message}`);
    }
    const preferredRows = (preferred ?? []) as CompositionMediaRow[];
    const byId = new Map(preferredRows.map((row) => [row.id, row]));
    const ordered = preferredIds
      .map((id) => byId.get(id))
      .filter((row): row is CompositionMediaRow => !!row)
      .map((row) => ({
        id: row.id,
        url: row.midia_url,
        context: row.contexto_original,
      }));
    photos = [...ordered, ...photos].filter(
      (photo, index, all) => all.findIndex((candidate) => candidate.id === photo.id) === index,
    ).slice(-2);
  }
  if (photos.length < 2) {
    const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { data, error } = await sb
      .from("midias_whatsapp")
      .select("id, midia_url, contexto_original, created_at")
      .eq("user_id", userId)
      .eq("telefone_origem", fromNumber)
      .eq("tipo", "foto")
      .eq("origem", "whatsapp")
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(2);
    if (error) throw new Error(`composition_media_lookup_failed: ${error.message}`);
    const recent = (data ?? []).reverse().map((row: any) => ({
      id: row.id,
      url: row.midia_url,
      context: row.contexto_original,
    }));
    photos = [...recent, ...photos].filter(
      (photo, index, all) => all.findIndex((candidate) => candidate.id === photo.id) === index,
    ).slice(-2);
  }

  const { data: products, error: productError } = await sb
    .from("produtos")
    .select("id, nome, imagem_url, imagens")
    .eq("user_id", userId)
    .eq("ativo", true)
    .limit(500);
  if (productError) {
    console.warn("[image_composition][catalog_lookup_failed]", productError.message);
  }
  const catalogProduct = selectCatalogProduct(requestText, products ?? []);
  const catalogUrl = catalogProduct ? catalogImageUrl(catalogProduct) : null;

  if (catalogProduct && catalogUrl && photos.length >= 1) {
    const environment = [...photos].sort(
      (a, b) => environmentLikelihood(b.context || "") - environmentLikelihood(a.context || ""),
    )[0];
    return {
      environment,
      product: { id: null, url: catalogUrl, context: catalogProduct.nome, productId: catalogProduct.id },
    };
  }

  if (photos.length < 2) return null;
  const [first, second] = photos.slice(-2);
  const firstScore = environmentLikelihood(first.context || "");
  const secondScore = environmentLikelihood(second.context || "");
  return firstScore >= secondScore
    ? { environment: first, product: second }
    : { environment: second, product: first };
}

async function composeProductInEnvironment(params: {
  userId: string;
  fromNumber: string;
  conversationId: string | null;
  requestText: string;
  environment: CompositionSource;
  product: CompositionSource;
}): Promise<CompositionResult> {
  const resolution = requestedCompositionResolution(params.requestText);
  const estimatedCost = IMAGE_COMPOSITION_ESTIMATED_COST_USD[resolution];
  const { data: reservationData, error: reservationError } = await sb.rpc(
    "reserve_image_composition",
    {
      p_user_id: params.userId,
      p_phone: params.fromNumber,
      p_conversation_id: params.conversationId,
      p_environment_midia_id: params.environment.id,
      p_product_midia_id: params.product.id,
      p_product_id: params.product.productId ?? null,
      p_model: IMAGE_COMPOSITION_MODEL,
      p_resolution: resolution,
      p_estimated_cost_usd: estimatedCost,
    },
  );
  if (reservationError) {
    console.error("[image_composition][reservation_failed]", reservationError.message);
    return {
      ok: false,
      reason: "reservation_failed",
      message: "Não consegui iniciar a simulação agora. As duas fotos continuam salvas; tenta novamente daqui a pouco.",
    };
  }

  const reservation = Array.isArray(reservationData) ? reservationData[0] : reservationData;
  if (!reservation?.allowed) {
    const daily = reservation?.denial_reason === "daily";
    return {
      ok: false,
      reason: daily ? "daily_limit" : "monthly_limit",
      message: daily
        ? "Hoje já fiz algumas simulações pra você. Posso deixar a próxima ideia para amanhã?"
        : "As simulações deste mês já foram usadas por aqui. Posso avisar a equipe para liberar mais?",
    };
  }
  const compositionId = reservation.composition_id as string;

  const prompt = [
    "Crie uma SIMULAÇÃO FOTOREALISTA usando exatamente as duas imagens de referência.",
    "IMAGEM 1 = AMBIENTE BASE DO CLIENTE. Preserve a mesma sala, arquitetura, móveis, objetos, cores, enquadramento e iluminação. Não redesenhe nem substitua o ambiente.",
    "IMAGEM 2 = PRODUTO EXATO. Recorte mentalmente o produto e insira-o no ambiente conforme o pedido. Preserve fielmente desenho, cor, material, acabamento e proporções do produto; não invente um modelo parecido.",
    `PEDIDO DO CLIENTE: ${params.requestText}`,
    "Ajuste somente escala, perspectiva, oclusão, sombras e reflexos necessários para a instalação parecer real e coerente com a luz do ambiente.",
    "Não adicione texto, marca d'água, pessoas ou outros produtos. Mantenha a proporção e o enquadramento da IMAGEM 1.",
  ].join("\n\n");

  try {
    const generated = await chamarGatewayImagem(
      {
        messages: [{
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: params.environment.url } },
            { type: "image_url", image_url: { url: params.product.url } },
          ],
        }],
        modalities: ["image", "text"],
        ...(resolution === "2K"
          ? {
              extra_body: {
                google: {
                  image_config: { image_size: "2K" },
                },
              },
            }
          : {}),
      },
      "compor_produto_ambiente",
      120000,
      [IMAGE_COMPOSITION_MODEL],
    );
    if (!generated.ok) {
      await sb.from("image_compositions").update({
        status: "failed",
        error_message: [generated.erro, generated.detalhe, generated.motivo].filter(Boolean).join(" | ").slice(0, 1000),
        completed_at: new Date().toISOString(),
      }).eq("id", compositionId).eq("user_id", params.userId);
      return {
        ok: false,
        reason: generated.erro,
        message: "Não consegui combinar as duas fotos desta vez. Mantive as originais sem fazer uma edição diferente.",
      };
    }

    const match = generated.dataUrl.match(/^data:(image\/[\w.+-]+);base64,(.+)$/);
    if (!match) throw new Error("imagem_gerada_em_formato_invalido");
    let mime = match[1];
    const bytes = base64Decode(match[2]);
    const imageFormat = imageUploadMetadata(bytes, mime);
    if (!imageFormat) throw new Error("imagem_gerada_em_formato_invalido");
    mime = imageFormat.mime;
    const fileName = `whatsapp-ai/${params.userId}/composition-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${imageFormat.extension}`;
    const { error: uploadError } = await sb.storage
      .from("produtos")
      .upload(fileName, bytes, { contentType: mime, upsert: false });
    if (uploadError) throw new Error(`upload_falhou: ${uploadError.message}`);
    const { data: publicData } = sb.storage.from("produtos").getPublicUrl(fileName);
    if (!publicData?.publicUrl) throw new Error("sem_url_publica");

    const { data: mediaRow, error: mediaError } = await sb
      .from("midias_whatsapp")
      .insert({
        user_id: params.userId,
        origem: "ia_composicao",
        telefone_origem: params.fromNumber,
        tipo: "foto",
        midia_url: publicData.publicUrl,
        mime_type: mime,
        tamanho_bytes: bytes.length,
        contexto_original: `Simulação ilustrativa: ${params.requestText}`.slice(0, 1500),
        status: "pendente",
      })
      .select("id")
      .single();
    if (mediaError || !mediaRow?.id) {
      throw new Error(`registro_midia_falhou: ${mediaError?.message || "id ausente"}`);
    }

    await sb.from("image_compositions").update({
      result_midia_id: mediaRow.id,
      model: generated.model,
      resolution,
      estimated_cost_usd: estimatedCost,
      status: "completed",
      completed_at: new Date().toISOString(),
    }).eq("id", compositionId).eq("user_id", params.userId);
    console.log(
      `[image_composition] completed id=${compositionId} model=${generated.model} resolution=${resolution} estimated_usd=${estimatedCost}`,
    );
    return { ok: true, imageUrl: publicData.publicUrl, mediaId: mediaRow.id, resolution };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await sb.from("image_compositions").update({
      status: "failed",
      error_message: message.slice(0, 1000),
      completed_at: new Date().toISOString(),
    }).eq("id", compositionId).eq("user_id", params.userId);
    console.error("[image_composition][failed]", message);
    return {
      ok: false,
      reason: "composition_failed",
      message: "Não consegui combinar as duas fotos desta vez. Mantive as originais sem fazer uma edição diferente.",
    };
  }
}

// ---- consultar_clima: Open-Meteo (grátis, sem chave), com geocoding opcional ----
async function toolConsultarClima(cidadeOuLatLng: string, ctx: { userId: string; fromNumber: string }): Promise<string> {
  try {
    let lat: number | null = null, lng: number | null = null, nome = cidadeOuLatLng?.trim() || "";
    const latlng = nome.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (latlng) { lat = Number(latlng[1]); lng = Number(latlng[2]); nome = `${lat},${lng}`; }
    if (lat == null && nome) {
      const g = await fetch(`https://geocoding-api.open-meteo.com/v1/search?count=1&language=pt&name=${encodeURIComponent(nome)}`, { signal: AbortSignal.timeout(8000) });
      if (g.ok) {
        const gd = await g.json();
        const r0 = gd?.results?.[0];
        if (r0) { lat = r0.latitude; lng = r0.longitude; nome = `${r0.name}${r0.admin1 ? " - " + r0.admin1 : ""}${r0.country ? ", " + r0.country : ""}`; }
      }
    }
    if (lat == null && ctx.userId) {
      const { data: loc } = await sb.from("whatsapp_user_locations").select("latitude, longitude, address").eq("user_id", ctx.userId).eq("contact_number", ctx.fromNumber).maybeSingle();
      if (loc) { lat = Number(loc.latitude); lng = Number(loc.longitude); nome = loc.address || `${lat},${lng}`; }
    }
    if (lat == null || lng == null) return JSON.stringify({ erro: "cidade_nao_encontrada", instrucao: "Peça pra especificar a cidade (ex: 'clima em São Paulo')." });
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code&timezone=America/Sao_Paulo&forecast_days=3`;
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return JSON.stringify({ erro: `clima_api ${r.status}` });
    const d = await r.json();
    const codeMap: Record<number, string> = {0:"céu limpo",1:"predominante claro",2:"parcialmente nublado",3:"nublado",45:"neblina",48:"neblina com geada",51:"garoa leve",53:"garoa",55:"garoa forte",61:"chuva leve",63:"chuva",65:"chuva forte",71:"neve leve",73:"neve",75:"neve forte",80:"pancadas leves",81:"pancadas de chuva",82:"pancadas fortes",95:"trovoadas",96:"trovoadas com granizo",99:"trovoadas fortes com granizo"};
    return JSON.stringify({
      local: nome,
      agora: {
        temperatura_c: d.current?.temperature_2m,
        sensacao_c: d.current?.apparent_temperature,
        umidade_pct: d.current?.relative_humidity_2m,
        vento_kmh: d.current?.wind_speed_10m,
        condicao: codeMap[d.current?.weather_code] || `código ${d.current?.weather_code}`,
      },
      previsao: (d.daily?.time ?? []).map((t: string, i: number) => ({
        data: t,
        min_c: d.daily.temperature_2m_min[i],
        max_c: d.daily.temperature_2m_max[i],
        chuva_prob_pct: d.daily.precipitation_probability_max[i],
        condicao: codeMap[d.daily.weather_code[i]] || `código ${d.daily.weather_code[i]}`,
      })),
    });
  } catch (e) {
    return JSON.stringify({ erro: String((e as Error).message) });
  }
}

// ---- cotacao_moeda: AwesomeAPI + fallbacks (CoinGecko p/ cripto, open.er-api p/ fiat) ----
const CRYPTO_IDS: Record<string, string> = {
  BTC: "bitcoin", ETH: "ethereum", SOL: "solana", BNB: "binancecoin",
  XRP: "ripple", DOGE: "dogecoin", ADA: "cardano", LTC: "litecoin",
  MATIC: "polygon-ecosystem-token", AVAX: "avalanche-2", LINK: "chainlink",
  DOT: "polkadot", TRX: "tron", USDT: "tether", USDC: "usd-coin",
};

async function fetchAwesome(clean: string): Promise<any | null> {
  try {
    const r = await fetch(`https://economia.awesomeapi.com.br/last/${clean}`, {
      signal: AbortSignal.timeout(5000),
      headers: { "User-Agent": "JarvisBot/1.0" },
    });
    if (!r.ok) return null;
    const d = await r.json();
    const c = d[clean.replace("-", "")];
    if (!c) return null;
    return {
      par: clean,
      compra: Number(c.bid),
      venda: Number(c.ask),
      variacao_pct: Number(c.pctChange),
      maxima_dia: Number(c.high),
      minima_dia: Number(c.low),
      atualizado_em: c.create_date,
      nome: c.name,
      fonte: "AwesomeAPI",
    };
  } catch { return null; }
}

async function fetchCoinGecko(from: string, to: string): Promise<any | null> {
  const id = CRYPTO_IDS[from];
  if (!id) return null;
  const vs = to.toLowerCase();
  try {
    const r = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=${vs}&include_24hr_change=true&include_last_updated_at=true`,
      { signal: AbortSignal.timeout(6000), headers: { "User-Agent": "JarvisBot/1.0", "Accept": "application/json" } },
    );
    if (!r.ok) return null;
    const d = await r.json();
    const c = d[id];
    if (!c || c[vs] == null) return null;
    const price = Number(c[vs]);
    const ts = c.last_updated_at ? new Date(c.last_updated_at * 1000).toISOString() : new Date().toISOString();
    return {
      par: `${from}-${to}`,
      compra: price,
      venda: price,
      variacao_pct: Number(c[`${vs}_24h_change`] ?? 0),
      atualizado_em: ts,
      nome: `${from}/${to}`,
      fonte: "CoinGecko",
    };
  } catch { return null; }
}

// cache em memória para taxas fiat (1h)
const FIAT_CACHE: Record<string, { rates: Record<string, number>; ts: number }> = {};

async function fetchFiat(from: string, to: string): Promise<any | null> {
  try {
    const cached = FIAT_CACHE[from];
    let rates: Record<string, number> | null = null;
    let updated = "";
    if (cached && Date.now() - cached.ts < 3600_000) {
      rates = cached.rates;
      updated = new Date(cached.ts).toISOString();
    } else {
      const r = await fetch(`https://open.er-api.com/v6/latest/${from}`, {
        signal: AbortSignal.timeout(6000),
        headers: { "User-Agent": "JarvisBot/1.0" },
      });
      if (!r.ok) return null;
      const d = await r.json();
      if (d.result !== "success" || !d.rates) return null;
      rates = d.rates;
      updated = d.time_last_update_utc || new Date().toISOString();
      FIAT_CACHE[from] = { rates: rates!, ts: Date.now() };
    }
    const price = rates![to];
    if (price == null) return null;
    return {
      par: `${from}-${to}`,
      compra: Number(price),
      venda: Number(price),
      variacao_pct: null,
      atualizado_em: updated,
      nome: `${from}/${to}`,
      fonte: "ExchangeRate-API",
    };
  } catch { return null; }
}

async function toolCotacaoMoeda(par: string): Promise<string> {
  const clean = (par || "").toUpperCase().replace(/\s+/g, "").replace(/\//g, "-");
  if (!/^[A-Z]{3,5}-[A-Z]{3,5}$/.test(clean)) {
    return JSON.stringify({ erro: "par_invalido", exemplo: "USD-BRL, EUR-BRL, BTC-BRL" });
  }
  const [from, to] = clean.split("-");
  const isCrypto = !!CRYPTO_IDS[from];

  // 1) AwesomeAPI (tempo real, primária)
  const awesome = await fetchAwesome(clean);
  if (awesome) return JSON.stringify(awesome);

  // 2) fallback por tipo
  const fb = isCrypto ? await fetchCoinGecko(from, to) : await fetchFiat(from, to);
  if (fb) return JSON.stringify(fb);

  // 3) para cripto, tentar via USD e converter p/ BRL
  if (isCrypto && to === "BRL") {
    const usd = await fetchCoinGecko(from, "USD");
    const usdBrl = await fetchFiat("USD", "BRL");
    if (usd && usdBrl) {
      return JSON.stringify({
        par: clean,
        compra: usd.compra * usdBrl.compra,
        venda: usd.venda * usdBrl.venda,
        variacao_pct: usd.variacao_pct,
        atualizado_em: usd.atualizado_em,
        nome: `${from}/${to}`,
        fonte: "CoinGecko+ExchangeRate (cross)",
      });
    }
  }

  return JSON.stringify({ erro: "cotacao_indisponivel", par: clean, detalhe: "AwesomeAPI 429/limite; fallback tambem falhou" });
}

// ---- criar_lembrete: agenda notificação com escalonamento (30min antes, a cada 10min) ----
async function toolCriarLembrete(
  args: { titulo?: string; data_hora_sp?: string; minutos_a_partir_de_agora?: number },
  ctx: { userId: string; fromNumber: string },
): Promise<string> {
  const titulo = (args?.titulo || "").trim();
  if (!titulo) return JSON.stringify({ erro: "titulo_obrigatorio" });
  let meetingMs: number | null = null;
  if (args?.minutos_a_partir_de_agora && Number(args.minutos_a_partir_de_agora) > 0) {
    meetingMs = Date.now() + Number(args.minutos_a_partir_de_agora) * 60000;
  } else if (args?.data_hora_sp) {
    // "YYYY-MM-DD HH:MM" em horário de São Paulo (UTC-3, sem DST)
    const m = String(args.data_hora_sp).trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
    if (!m) return JSON.stringify({ erro: "formato_data_invalido", esperado: "YYYY-MM-DD HH:MM" });
    const [, y, mo, d, h, mi] = m;
    // SP = UTC-3 → adiciona 3h para converter para UTC
    meetingMs = Date.UTC(+y, +mo - 1, +d, +h + 3, +mi, 0);
  } else {
    return JSON.stringify({ erro: "informe data_hora_sp ou minutos_a_partir_de_agora" });
  }
  if (meetingMs <= Date.now()) return JSON.stringify({ erro: "data_no_passado" });

  const nowMs = Date.now();
  const diffMin = Math.round((meetingMs - nowMs) / 60000);
  // Primeiro aviso: 30min antes; se falta menos que isso, dispara já
  const firstNotifyMs = diffMin > 30 ? meetingMs - 30 * 60000 : nowMs;

  const { data, error } = await sb.from("whatsapp_reminders").insert({
    user_id: ctx.userId,
    contact_number: ctx.fromNumber,
    titulo,
    meeting_at: new Date(meetingMs).toISOString(),
    next_notify_at: new Date(firstNotifyMs).toISOString(),
    status: "active",
  }).select("id").single();
  if (error) return JSON.stringify({ erro: error.message });

  const quandoSP = new Date(meetingMs).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
  return JSON.stringify({
    ok: true,
    id: data.id,
    titulo,
    quando: quandoSP,
    primeiro_aviso_em_min: Math.max(0, Math.round((firstNotifyMs - nowMs) / 60000)),
    politica: "aviso 30min antes e a cada 10min até a hora",
  });
}

// ---- NOTAS (segunda memória) ----
async function toolSalvarNota(conteudo: string, tags: string[] | undefined, ctx: { userId: string; fromNumber: string }): Promise<string> {
  const c = (conteudo || "").trim();
  if (!c) return JSON.stringify({ erro: "conteudo_vazio" });
  const { data, error } = await sb.from("jarvis_notes").insert({
    user_id: ctx.userId, contact_number: ctx.fromNumber, content: c, tags: Array.isArray(tags) ? tags.slice(0, 10) : [],
  }).select("id, created_at").single();
  if (error) return JSON.stringify({ erro: error.message });
  return JSON.stringify({ ok: true, id: data.id, salva_em: data.created_at });
}

async function toolBuscarNotas(query: string, ctx: { userId: string; fromNumber: string }): Promise<string> {
  const q = (query || "").trim();
  let sel = sb.from("jarvis_notes").select("id, content, tags, created_at")
    .eq("user_id", ctx.userId).eq("contact_number", ctx.fromNumber)
    .order("created_at", { ascending: false }).limit(10);
  if (q) sel = sel.ilike("content", `%${q}%`);
  const { data, error } = await sel;
  if (error) return JSON.stringify({ erro: error.message });
  return JSON.stringify({ query: q, total: (data ?? []).length, notas: data ?? [] });
}

// ---- TAREFAS (to-do conversacional) ----
async function toolAdicionarTarefa(args: { titulo?: string; prazo_sp?: string }, ctx: { userId: string; fromNumber: string }): Promise<string> {
  const t = (args?.titulo || "").trim();
  if (!t) return JSON.stringify({ erro: "titulo_obrigatorio" });
  let dueIso: string | null = null;
  if (args?.prazo_sp) {
    const m = String(args.prazo_sp).match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
    if (m) dueIso = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4] + 3, +m[5])).toISOString();
  }
  const { data, error } = await sb.from("jarvis_tasks").insert({
    user_id: ctx.userId, contact_number: ctx.fromNumber, title: t, due_at: dueIso, status: "open",
  }).select("id").single();
  if (error) return JSON.stringify({ erro: error.message });
  return JSON.stringify({ ok: true, id: data.id, titulo: t, prazo: dueIso });
}

async function toolListarTarefas(status: string | undefined, ctx: { userId: string; fromNumber: string }): Promise<string> {
  const st = status || "open";
  const { data, error } = await sb.from("jarvis_tasks").select("id, title, status, due_at, created_at")
    .eq("user_id", ctx.userId).eq("contact_number", ctx.fromNumber)
    .eq("status", st).order("created_at", { ascending: false }).limit(30);
  if (error) return JSON.stringify({ erro: error.message });
  return JSON.stringify({ status: st, total: (data ?? []).length, tarefas: data ?? [] });
}

async function toolConcluirTarefa(id_ou_titulo: string, ctx: { userId: string; fromNumber: string }): Promise<string> {
  const q = (id_ou_titulo || "").trim();
  if (!q) return JSON.stringify({ erro: "id_ou_titulo_obrigatorio" });
  const uuid = /^[0-9a-f-]{36}$/i.test(q);
  let query = sb.from("jarvis_tasks").update({ status: "done", completed_at: new Date().toISOString() })
    .eq("user_id", ctx.userId).eq("contact_number", ctx.fromNumber).eq("status", "open");
  query = uuid ? query.eq("id", q) : query.ilike("title", `%${q}%`);
  const { data, error } = await query.select("id, title");
  if (error) return JSON.stringify({ erro: error.message });
  return JSON.stringify({ ok: true, concluidas: data ?? [] });
}

// ---- CONTATOS COMERCIAIS (Jarvis dispara WhatsApp humanizado sob ordem do dono) ----

function normalizePhoneBR(raw: string): string {
  let c = (raw || "").replace(/\D/g, "");
  if (!c) return "";
  if (c.startsWith("0")) c = c.substring(1);
  if (c.length === 10 || c.length === 11) c = "55" + c;
  return c;
}

function normalizeContactLookupText(raw: string): string {
  return (raw || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function ownerFirstName(ownerName?: string | null): string {
  const first = String(ownerName || "").trim().split(/\s+/)[0];
  return first || "responsável";
}

function buildForwardProof(wamid?: string | null): string {
  if (!wamid) throw new Error("forward_delivery_receipt_missing");
  const now = new Date();
  // Horário São Paulo (UTC-3)
  const sp = new Date(now.getTime() - 3 * 3600 * 1000);
  const hh = String(sp.getUTCHours()).padStart(2, "0");
  const mm = String(sp.getUTCMinutes()).padStart(2, "0");
  const clean = String(wamid).replace(/[^A-Za-z0-9]/g, "");
  const proto = clean.slice(-6).toUpperCase();
  if (!proto) throw new Error("forward_delivery_receipt_invalid");
  return `(protocolo #${proto} · ${hh}:${mm})`;
}

// ---- Estado persistente da conversa (comprovantes + decisões) -------------
type PendingCarouselState = {
  stage: "awaiting_color" | "awaiting_confirmation";
  tema: string;
  num_slides?: number;
  cor?: string;
  slides?: any[];
  caption?: string;
  media_id?: string;
  image_urls?: string[];
  token?: string;
  facebook_requested?: boolean;
  created_at: string;
};

type PendingBrandGeneration = {
  stage:
    | "awaiting_choice"
    | "awaiting_site_choice"
    | "awaiting_site_url"
    | "awaiting_logo_upload"
    | "awaiting_uploaded_logo_confirmation";
  prompt: string;
  created_at: string;
  chained_post?: boolean;
  original_request?: string;
  reference_urls?: string[];
  logo_candidate_path?: string;
  logo_candidate_mime?: string;
};

type PendingFipeState =
  | {
    stage: "model";
    brand: FipeListItem;
    models: FipeListItem[];
    requestedYear?: string;
    requestedFuel?: string;
    queryModel: string;
    created_at: string;
  }
  | {
    stage: "year";
    brand: FipeListItem;
    model: FipeListItem;
    years: FipeListItem[];
    queryModel: string;
    created_at: string;
  }
  | {
    stage: "photo_confirmation";
    brand: string;
    model: string;
    earliestYear?: number;
    created_at: string;
  }
  | {
    stage: "ad_difference";
    args: Record<string, unknown>;
    queriedValue: string;
    suppliedValue: string;
    referenceMonth: string;
    created_at: string;
  };

type AgentConvState = {
  forward?: { protocolo?: string; destinatario?: string; wamid?: string | null; at?: string };
  decisao?: { valor?: string; at?: string };
  site_link_enviado?: boolean;
  last_media_interaction?: { media_id: string; at: string };
  pending_image_composition?: { media_ids: string[]; at: string } | null;
  pending_carousel?: PendingCarouselState | null;
  pending_carrossel_veiculo?: PendingVehicleCarousel | null;
  pending_vehicle_photo_batch?: PendingVehiclePhotoBatch | null;
  pending_video_setup?: PendingVideoSetupState | null;
  pending_creative_media_ambiguity?: { original_request: string; created_at: string } | null;
  pending_anuncio_cliente?: {
    args: Record<string, unknown>;
    created_at: string;
    awaiting_store_details?: boolean;
    store_name?: string;
    asked_site?: boolean;
  } | null;
  pending_anuncio_styles?: {
    render_payload: Record<string, unknown>;
    source_args?: Record<string, unknown>;
    client_name?: string | null;
    shown_styles: AnuncioStyle[];
    images?: LastAnuncioImage[];
    data?: Record<string, unknown>;
    photo_preference_used?: AnuncioPhotoPreference;
    created_at: string;
  } | null;
  pending_anuncio_photo?: {
    stage: "choice" | "preference_confirmation";
    args?: Record<string, unknown>;
    preference?: AnuncioPhotoPreference;
    created_at: string;
  } | null;
  last_anuncio?: LastAnuncio | null;
  pending_anuncio_post?: PendingAnuncioPost | null;
  pending_client_logo?: {
    logo_path: string;
    created_at: string;
    variant?: "default" | "light_background" | "dark_background";
  } | null;
  pending_client_logo_intent?: {
    client_name: string;
    created_at: string;
    variant?: "default" | "light_background" | "dark_background";
    anuncio_args?: Record<string, unknown>;
  } | null;
  pending_brand_generation?: PendingBrandGeneration | null;
  pending_fipe?: PendingFipeState | null;
  last_fipe?: LastFipeResult | null;
  pending_meta_ads_ambiguity?: MetaAdsQuestionarioAmbiguidade | null;
  pending_meta_ads_limit?: MetaAdsLimitProposal | null;
  pending_meta_ads_limit_value?: MetaAdsLimitValueRequest | null;
  brand_image_preference?: WhatsAppBrandPreference | null;
  [k: string]: unknown;
};

type PendingVideoSetupStage =
  | "awaiting_tema"
  | "awaiting_template"
  | "awaiting_background"
  | "awaiting_track"
  | "awaiting_track_more"
  | "awaiting_identity"
  | "awaiting_site_url"
  | "awaiting_site_logo_confirmation"
  | "awaiting_palette_primary"
  | "awaiting_palette_secondary"
  | "awaiting_palette_confirmation";

type VideoPaletteOption = {
  hex: string;
  role: "Principal" | "Secundária" | "Fundo" | "Texto";
  origem?: string;
};

type PendingVideoSetupState = {
  stage: PendingVideoSetupStage;
  tema: string;
  pedido_original: string;
  estilo?: EstiloMotion;
  fundo?: FundoMotion;
  trilha_id?: string | null;
  trilha_nome?: string;
  sem_trilha?: boolean;
  track_page?: number;
  identidade?: "tenant" | "client";
  cores?: MotionProps["cores"];
  marca?: string;
  site?: string;
  tom_de_voz?: string;
  logo_path?: string;
  logo_light_background_path?: string;
  logo_dark_background_path?: string;
  site_logo_candidate_path?: string;
  identity_summary?: string;
  palette_options?: VideoPaletteOption[];
  palette_candidates?: string[];
  palette_primary?: string;
  formato?: "reels" | "feed" | "story";
  duracao?: DuracaoMotion;
  duracao_alvo_segundos?: number;
  frases_literais?: string[];
  roteiro_cenas?: CenaMotion[];
  interrupted_request?: string;
  created_at: string;
};

type ConversationStateIdentity = {
  id: string;
  userId: string;
  contactNumber: string;
};

async function loadAgentState(sb: any, conversation: ConversationStateIdentity): Promise<AgentConvState> {
  try {
    const { data, error } = await sb
      .from("whatsapp_cloud_conversations")
      .select("agent_state")
      .eq("id", conversation.id)
      .eq("user_id", conversation.userId)
      .eq("contact_number", conversation.contactNumber)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("conversation_not_found");
    const st = (data?.agent_state ?? {}) as AgentConvState;
    return st && typeof st === "object" ? st : {};
  } catch (e) {
    console.error("[processor][agent_state][load_failed]", {
      convId: conversation.id,
      userId: conversation.userId,
      contactNumber: conversation.contactNumber,
      error: (e as Error).message,
    });
    return {};
  }
}

async function saveAgentState(
  sb: any,
  conversation: ConversationStateIdentity,
  patch: AgentConvState,
  current: AgentConvState = {},
): Promise<boolean> {
  try {
    const nextState = { ...current, ...patch };
    const { error } = await sb
      .from("whatsapp_cloud_conversations")
      .update({ agent_state: nextState })
      .eq("id", conversation.id)
      .eq("user_id", conversation.userId)
      .eq("contact_number", conversation.contactNumber);
    if (error) throw error;

    const { data: verified, error: verifyError } = await sb
      .from("whatsapp_cloud_conversations")
      .select("agent_state")
      .eq("id", conversation.id)
      .eq("user_id", conversation.userId)
      .eq("contact_number", conversation.contactNumber)
      .maybeSingle();
    if (verifyError) throw verifyError;
    const saved = (verified?.agent_state ?? {}) as AgentConvState;
    for (const key of Object.keys(patch)) {
      if (!Object.prototype.hasOwnProperty.call(saved, key)) {
        throw new Error(`state_key_not_persisted:${key}`);
      }

      const expected = patch[key];
      const actual = saved[key];
      const discriminators = ["token", "created_at", "at", "protocolo", "media_id"]
        .filter((field) =>
          expected !== null
          && typeof expected === "object"
          && Object.prototype.hasOwnProperty.call(expected, field)
        );
      const mismatches = discriminators.filter((field) =>
        (actual as Record<string, unknown> | null)?.[field] !== (expected as Record<string, unknown>)[field]
      );
      const primitiveMismatch =
        (expected === null || typeof expected !== "object")
        && !Object.is(actual, expected);
      if (mismatches.length > 0 || primitiveMismatch) {
        console.warn("[processor][agent_state][verify_normalized]", {
          convId: conversation.id,
          userId: conversation.userId,
          contactNumber: conversation.contactNumber,
          key,
          discriminators: mismatches,
          expected,
          actual,
        });
      }
    }
    return true;
  } catch (e) {
    console.error("[processor][agent_state][save_failed]", {
      convId: conversation.id,
      userId: conversation.userId,
      contactNumber: conversation.contactNumber,
      patchKeys: Object.keys(patch),
      error: (e as Error).message,
    });
    return false;
  }
}

async function rememberLastMediaInteraction(
  ctx: { convId?: string; userId: string; fromNumber: string; agentState?: AgentConvState },
  mediaId: string,
): Promise<boolean> {
  if (!ctx.convId || !mediaId) return false;
  const conversation = { id: ctx.convId, userId: ctx.userId, contactNumber: ctx.fromNumber };
  const current = ctx.agentState ?? await loadAgentState(sb, conversation);
  const interaction = { media_id: mediaId, at: new Date().toISOString() };
  const saved = await saveAgentState(sb, conversation, { last_media_interaction: interaction }, current);
  if (saved) {
    current.last_media_interaction = interaction;
    ctx.agentState = current;
  }
  return saved;
}

// ---- Registro de lead encaminhado (não depende do WhatsApp do dono) -------
async function registrarLeadEncaminhamento(params: {
  userId: string;
  telefone: string;
  nome?: string | null;
  mensagem?: string | null;
  protocolo?: string | null;
  wamid?: string | null;
  destinoDono?: string | null;
}): Promise<string | null> {
  try {
    const { data, error } = await sb
      .from("lead_encaminhamentos")
      .insert({
        user_id: params.userId,
        telefone: params.telefone,
        nome: (params.nome || "").trim() || null,
        mensagem: (params.mensagem || "").slice(0, 2000) || null,
        protocolo: extractProtocolCode(params.protocolo) || null,
        wamid_dono: params.wamid ?? null,
        destino_dono: params.destinoDono ?? null,
        status_entrega: "aceita",
        status_atualizado_em: new Date().toISOString(),
        enviado_em: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error) throw error;
    console.log(`[processor][lead_encaminhado][registrado] id=${data?.id} tel=${params.telefone} nome=${params.nome ?? "-"}`);
    return data?.id ?? null;
  } catch (e) {
    console.warn("[processor][lead_encaminhado][falhou]", (e as Error).message);
    return null;
  }
}

// Fonte secundária de verdade: recupera o último encaminhamento realmente registrado.
// Evita falso negativo se o JSON de estado da conversa falhar ou for sobrescrito.
async function recoverForwardProof(userId: string, telefone: string): Promise<AgentConvState["forward"] | null> {
  try {
    const { data, error } = await sb
      .from("lead_encaminhamentos")
      .select("protocolo, wamid_dono, enviado_em")
      .eq("user_id", userId)
      .eq("telefone", telefone)
      .not("wamid_dono", "is", null)
      .gte("enviado_em", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order("enviado_em", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data?.protocolo) return null;
    return {
      protocolo: `(protocolo #${data.protocolo})`,
      wamid: data.wamid_dono,
      at: data.enviado_em,
    };
  } catch (e) {
    console.warn("[processor][handoff][proof_recovery_failed]", (e as Error).message);
    return null;
  }
}

// Segunda mensagem curta ao dono, referenciando o protocolo do encaminhamento.
async function enviarComplementoNomeAoDono(params: {
  userId: string;
  ownerPhone: string;
  protocolo: string;
  nome: string;
}): Promise<boolean> {
  const code = extractProtocolCode(params.protocolo);
  const texto = code
    ? `Complemento do #${code}: o cliente é ${params.nome}.`
    : `Complemento: o cliente é ${params.nome}.`;
  try {
    const wamid = await sendWhatsApp(params.userId, params.ownerPhone, texto);
    await logOwnerHeadsup(params.userId, texto, wamid);
    console.log(`[processor][lead_encaminhado][complemento_enviado] proto=${code} nome=${params.nome}`);
    return true;
  } catch (e) {
    console.warn("[processor][lead_encaminhado][complemento_falhou]", (e as Error).message);
    return false;
  }
}

// ---- Voz: a resposta termina no raciocínio, sem convite no fim -------------
const CONVITE_FINAL_RE =
  /^(?:(?:e\s+)?(?:é|eh)\s+só\s+me\s+chamar|qualquer\s+(?:coisa|d[úu]vida)[^.!?]*|fico\s+(?:à|a)\s+disposi[çc][ãa]o[^.!?]*|estou\s+(?:à|a)\s+disposi[çc][ãa]o[^.!?]*|me\s+chama[^.!?]*|se\s+precisar[^.!?]*|posso\s+(?:te\s+)?ajudar\s+(?:em\s+)?mais[^.!?]*|precisa\s+de\s+mais\s+alguma\s+coisa[^.!?]*|estou\s+(?:aqui|por\s+aqui)[^.!?]*|(?:quer|deseja)\s+que\s+eu\s+(?:te\s+)?(?:ajude|adiante|explique)[^.!?]*|conte\s+comigo[^.!?]*)[.!?…]*$/i;

function removerConviteFinal(text: string): { text: string; removed: boolean } {
  const blocos = String(text || "").split("<<SPLIT>>");
  let removed = false;
  const out = blocos.map((bloco) => {
    let frases = splitSentences(bloco);
    while (frases.length > 1) {
      const ultima = frases[frases.length - 1].trim();
      if (CONVITE_FINAL_RE.test(ultima.replace(/^[\s,;·-]+/, ""))) {
        frases = frases.slice(0, -1);
        removed = true;
      } else break;
    }
    return frases.join(" ").replace(/\s+([.,!?])/g, "$1").trim();
  });
  const joined = out.filter((b) => b.length > 0).join("<<SPLIT>>");
  return { text: joined || String(text || ""), removed };
}

const PERGUNTA_NOME = "Só pra eu completar o recado: qual seu nome?";

async function persistKnownLeadName(params: {
  userId: string;
  telefone: string;
  conversationId: string;
  nome: string;
}): Promise<void> {
  await Promise.all([
    sb.from("whatsapp_cloud_conversations")
      .update({ contact_name: params.nome })
      .eq("id", params.conversationId)
      .eq("user_id", params.userId),
    sb.from("lead_encaminhamentos")
      .update({ nome: params.nome })
      .eq("user_id", params.userId)
      .eq("telefone", params.telefone)
      .is("nome", null),
  ]);
}

async function findKnownLeadName(params: {
  userId: string;
  telefone: string;
  conversationId: string;
}): Promise<string | null> {
  const { data: registeredLead } = await sb.from("jarvis_leads")
    .select("nome")
    .eq("user_id", params.userId)
    .eq("telefone", params.telefone)
    .maybeSingle();
  const registeredName = extractLeadName(String(registeredLead?.nome || ""), true);
  if (registeredName) return registeredName;

  const { data: recentRows } = await sb.from("whatsapp_cloud_messages")
    .select("direction, content")
    .eq("conversation_id", params.conversationId)
    .order("created_at", { ascending: false })
    .limit(40);
  return findLeadNameInConversation([...(recentRows ?? [])].reverse());
}

// Extrai o código do protocolo de um comprovante "(protocolo #ABC123 · 17:03)"
function extractProtocolCode(proof?: string | null): string {
  const m = String(proof || "").match(/#([A-Za-z0-9]{4,10})/);
  return m ? m[1].toUpperCase() : "";
}

// O protocolo só pode aparecer UMA vez, no fim da linha, no turno em que foi gerado.
// Remove qualquer protocolo copiado do histórico (inclusive solto no início da frase).
function sanitizeProtocolLeaks(text: string, currentProof?: string): { text: string; cleaned: boolean } {
  let out = String(text || "");
  const before = out;
  void extractProtocolCode;
  const placeholder = "\u0000PROOF\u0000";
  if (currentProof && out.includes(currentProof)) {
    out = out.split(currentProof).join(placeholder);
  }
  // Remove comprovantes completos e protocolos soltos que não sejam o do turno atual
  out = out.replace(/\(\s*protocolo\s*#[A-Za-z0-9]{4,10}[^)]*\)/gi, "");
  out = out.replace(/protocolo\s*#[A-Za-z0-9]{4,10}/gi, "");
  // Qualquer código solto (mesmo igual ao do turno) sai: só o comprovante do turno,
  // preservado no placeholder, pode permanecer — e ele fica no fim da linha.
  out = out.replace(/(^|[\s\n>*_—-])#[A-Za-z0-9]{4,10}\b/g, (_m, p1) => p1);
  out = out.split(placeholder).join(currentProof ?? "");
  out = out
    .split("<<SPLIT>>")
    .map((b) => b.replace(/[ \t]{2,}/g, " ").replace(/\s+([.,!?])/g, "$1").replace(/^[\s·,-]+/, "").trim())
    .filter((b) => b.length > 0)
    .join("<<SPLIT>>");
  return { text: out, cleaned: out !== before };
}

// ---- Anti "encaminhamento fantasma" -------------------------------------
// A confirmação de encaminhamento SÓ pode existir se a tool retornou ok:true
// (ou seja, se houver comprovante gerado por buildForwardProof) OU se já existe
// comprovante registrado no estado da conversa (turno anterior).
const FORWARD_CLAIM_RE = /(encaminhei|encaminhando|avisei|avisando|aviso (o|ao|a)|vou avisar|já (mandei|enviei|passei|repassei|avisei)|acabei de (mandar|enviar|passar|avisar)|vou (já )?(mandar|enviar|passar|encaminhar|repassar|avisar)|estou (mandando|enviando|passando|encaminhando|avisando)|passei (o|seu) (recado|contato)|te retorna|vai te retornar|entra em contato com você|ele (te )?(liga|retorna|responde))/i;

function splitSentences(text: string): string[] {
  return String(text || "").split(/(?<=[.!?…\n])\s+/);
}

// Remove qualquer frase que afirme encaminhamento quando NÃO existe comprovante
// (nem neste turno, nem registrado na conversa).
function enforceForwardTruth(
  text: string,
  forwardProof: string | undefined,
  ownerFirst: string,
  persistedProof?: { protocolo?: string; at?: string } | null,
): { text: string; scrubbed: boolean } {
  const raw = String(text || "");
  if (forwardProof) {
    if (raw.includes(forwardProof)) return { text: raw, scrubbed: false };
    const parts = raw.split("<<SPLIT>>");
    parts[0] = `${parts[0].trimEnd()} ${forwardProof}`;
    return { text: parts.join("<<SPLIT>>"), scrubbed: false };
  }

  // Já existe encaminhamento confirmado nesta conversa (turno anterior):
  // a afirmação do agente é VERDADEIRA — não apaga nada e não injeta aviso.
  if (persistedProof?.protocolo) {
    return { text: raw, scrubbed: false };
  }

  const blocks = raw.split("<<SPLIT>>");
  let scrubbed = false;
  const cleanedBlocks = blocks.map((block) => {
    const kept = splitSentences(block).filter((s) => {
      if (FORWARD_CLAIM_RE.test(s)) { scrubbed = true; return false; }
      return true;
    });
    return kept.join(" ").replace(/\s{2,}/g, " ").trim();
  }).filter((b) => b.length > 0);

  if (!scrubbed) return { text: raw, scrubbed: false };

  const aviso = `Só pra ser transparente: ainda não consegui entregar seu recado pro ${ownerFirst} agora — deu um problema no envio. Me confirma seu nome e o melhor telefone que eu garanto o retorno dele.`;
  const finalText = cleanedBlocks.length > 0 ? `${cleanedBlocks.join("<<SPLIT>>")}<<SPLIT>>${aviso}` : aviso;
  return { text: finalText, scrubbed: true };
}

// Cliente pediu algo que exige o dono (orçamento/simulação/valores/negociação)?
function pedeAtencaoDoDono(text: string): boolean {
  const low = normalizeContactLookupText(text);
  if (!low) return false;
  return /(orcamento|simulacao|simular|simule|proposta|valores|valor da|quanto custa|quanto fica|preco|desconto|negociar|negociacao|parcela|financiamento|carta de credito)/.test(low);
}

// Cliente encerrou o atendimento / optou por esperar o dono?
// Inclui variações de 1ª pessoa ("aguardo ele", "fico no aguardo", "prefiro esperar").
function clienteEncerrouAtendimento(text: string): boolean {
  const low = normalizeContactLookupText(text);
  if (!low) return false;
  if (low.length > 120) return false;
  if (/\b(aguardo|espero|aguardarei|esperarei)\b/.test(low)) return true;
  if (/\b(fico|ficarei)\s+(no\s+)?aguard(o|ando)\b/.test(low)) return true;
  if (/\b(prefiro|vou|melhor)\s+(aguardar|esperar)\b/.test(low)) return true;
  return /(^|\b)(aguardar( ele| o| dele| entao)?|aguardando|vou aguardar|prefiro aguardar|espero ele|vou esperar|prefiro esperar|prefiro falar com ele|falo com ele|so com ele|valeu|obrigad[oa]|ta bom|tudo bem entao|depois eu vejo|vou pensar|qualquer coisa te falo|ok|blz|beleza)(\b|$)/.test(low);
}

// Sentenças que re-oferecem a mesma escolha (adiantar x aguardar) após o cliente decidir.
const REOFERTA_RE = /(prefere\s+(assim|aguardar|esperar|adiantar)|quer\s+que\s+eu\s+(v[áa]|vou)?\s*(te\s+)?adiantar|posso\s+(ir\s+)?te\s+adiantando|prefere\s+assim\s+ou|ou\s+prefere\s+aguardar)/i;

function removerReoferta(text: string): { text: string; removed: boolean } {
  let removed = false;
  const out = String(text || "")
    .split("<<SPLIT>>")
    .map((block) => {
      const kept = splitSentences(block).filter((s) => {
        if (REOFERTA_RE.test(s)) { removed = true; return false; }
        return true;
      });
      return kept.join(" ").replace(/\s{2,}/g, " ").trim();
    })
    .filter((b) => b.length > 0)
    .join("<<SPLIT>>");
  return { text: out, removed };
}



function isExplicitOwnerForwardIntent(raw: string, ownerName?: string | null): boolean {
  const low = normalizeContactLookupText(raw);
  if (!low) return false;
  const ownerFirst = normalizeContactLookupText(ownerFirstName(ownerName));
  const hasRecipient = new RegExp(`\\b(${[
    "responsavel",
    "dono",
    "chefe",
    "gerente",
    "equipe",
    "consultor",
    "atendente",
    "humano",
    "pessoa",
    ownerFirst,
  ].filter(Boolean).join("|")})\\b`, "i").test(low);
  const hasForwardVerb = /\b(manda|mandar|mande|mandei|envia|enviar|envie|encaminha|encaminhar|encaminhe|passa|passe|repassa|repassar|avisa|avisar|avise|pede|pedir|peca|solicita|solicitar|chama|chamar|falar|contato|retorno|retornar)\b/i.test(low);
  const hasBusinessAsk = /\b(foto|imagem|recado|mensagem|duvida|plano|orcamento|proposta|simulacao|consorcio|carta|credito|parcela|prazo)\b/i.test(low);
  const teamShouldReply = /\b(equipe|consultor|gerente|responsavel|atendente)\b.*\b(me\s+(enviar|enviarem|mandar|mandarem|retornar|retornarem|chamar|chamarem)|entrar em contato|falar comigo)\b/i.test(low);
  return (hasRecipient && (hasForwardVerb || hasBusinessAsk)) || teamShouldReply;
}

function isOwnerHandoffQuestion(raw: string): boolean {
  const low = normalizeContactLookupText(raw);
  if (!low) return false;
  const commercialTopic = /\b(consorcio|plano|carta|credito|parcela|parcelamento|prazo|meses|taxa|simulacao|proposta|orcamento|contemplacao|ademicon)\b/i.test(low);
  const asksForDecision = /\b(consigo|consegue|pode|posso|tem|existe|quanto|qual|como|fazer|faz|da pra|da para|quero|preciso|me passa|me envia|me manda)\b/i.test(low) || /\?/.test(raw);
  const needsHuman = /\b(\d+\s*meses|100\s*meses|plano|proposta|orcamento|simulacao|equipe|consultor|responsavel)\b/i.test(low);
  return commercialTopic && asksForDecision && needsHuman;
}

function buildOwnerForwardMessage(params: {
  ownerName?: string | null;
  contactName?: string | null;
  fromNumber: string;
  pedido?: string | null;
  descricaoVisual?: string | null;
  messageType?: string | null;
  urgent?: boolean;
}): string {
  const dono = ownerFirstName(params.ownerName);
  const cliente = params.contactName?.trim() || "cliente";
  const pedido = (params.pedido || "").trim();
  const descricao = (params.descricaoVisual || "").trim();
  const partes = [
    params.urgent
      ? `URGENTE — ${dono}, o ${cliente} (${params.fromNumber}) pediu para falar com uma pessoa e precisa de retorno no WhatsApp.`
      : `${dono}, o ${cliente} (${params.fromNumber}) precisa de retorno no WhatsApp.`,
    pedido ? `Mensagem do cliente: "${pedido.slice(0, 700)}".` : null,
    descricao ? `A foto enviada mostra: ${descricao.slice(0, 900)}.` : null,
    !pedido && !descricao ? `Tipo recebido: ${params.messageType || "mensagem"}.` : null,
  ].filter(Boolean);
  return partes.join("\n\n");
}

async function recentForwardRequestFromConversation(
  conversationId: string,
  ownerName?: string | null,
): Promise<string | null> {
  const cutoff = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  const { data } = await sb
    .from("whatsapp_cloud_messages")
    .select("content, created_at")
    .eq("conversation_id", conversationId)
    .eq("direction", "inbound")
    .eq("message_type", "text")
    .gte("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(5);
  const found = (data ?? []).find((m: any) => isExplicitOwnerForwardIntent(String(m.content || ""), ownerName));
  return found?.content ?? null;
}

async function inferContatoComercialFromText(text: string, userId: string): Promise<any | null> {
  const haystack = ` ${normalizeContactLookupText(text)} `;
  if (!haystack.trim()) return null;

  const { data } = await sb.from("contatos_comerciais")
    .select("*")
    .eq("user_id", userId)
    .eq("ativo", true)
    .order("nome", { ascending: true })
    .limit(1000);

  const compactHaystack = haystack.trim();
  const intro = compactHaystack.slice(0, 120);

  const matches = (data ?? []).map((c: any) => {
    const nome = normalizeContactLookupText(c.nome || "");
    if (!nome) return null;
    const firstName = nome.split(" ")[0];
    let score = 0;
    if (haystack.includes(` ${nome} `)) score += 30;
    if (firstName.length >= 4 && haystack.includes(` ${firstName} `)) score += 10;

    // Mensagens compostas pelo Jarvis costumam começar com "Oi Marcelo..." e também
    // citar "assistente do Felício". O alvo é o nome saudado no começo, não Felício.
    if (firstName.length >= 4) {
      const greeting = new RegExp(`^(oi|ola|olá|bom dia|boa tarde|boa noite)\\s+${firstName}\\b`, "i");
      if (greeting.test(intro) || intro.includes(`${firstName},`)) score += 120;
      if (new RegExp(`\\b(do|da|de|para o|pro)\\s+${firstName}\\b`, "i").test(compactHaystack)) score -= 80;
    }

    return score > 0 ? { contato: c, score } : null;
  }).filter(Boolean) as Array<{ contato: any; score: number }>;

  matches.sort((a, b) => b.score - a.score);
  if (matches.length === 1) return matches[0].contato;
  if (matches.length > 1 && matches[0].score >= matches[1].score + 40) return matches[0].contato;
  return null;
}

async function toolListarContatosComerciais(
  args: { busca?: string },
  ctx: { userId: string },
): Promise<string> {
  let q = sb.from("contatos_comerciais")
    .select("id, nome, empresa, cargo, whatsapp, tipo_relacionamento, contexto, proximos_passos, permite_jarvis_contatar, ultima_interacao")
    .eq("user_id", ctx.userId)
    .eq("ativo", true)
    .order("nome", { ascending: true })
    .limit(50);
  const busca = (args?.busca || "").trim();
  if (busca) q = q.or(`nome.ilike.%${busca}%,empresa.ilike.%${busca}%`);
  const { data, error } = await q;
  if (error) return JSON.stringify({ erro: error.message });
  return JSON.stringify({ total: (data ?? []).length, contatos: data ?? [] });
}

async function toolEnviarMensagemContatoComercial(
  args: {
    contato_id?: string;
    nome_busca?: string;
    whatsapp?: string;
    mensagem?: string;
    data_hora_sp?: string;
    minutos_a_partir_de_agora?: number;
    tipo_acao?: string;
  },
  ctx: { userId: string },
): Promise<string> {
  const mensagem = (args?.mensagem || "").trim();
  if (!mensagem) return JSON.stringify({ erro: "mensagem_obrigatoria", detalhe: "Componha o texto humanizado como o Jarvis falaria — gentil, se apresentando como 'Jarvis, assistente do Felício'." });
  if (mensagem.length < 20) return JSON.stringify({ erro: "mensagem_muito_curta", detalhe: "Texto humanizado mínimo 20 chars." });

  // 1) Localizar o contato. Prioriza telefone/nome informado pelo dono; UUID só vem depois,
  // porque modelo pode inventar ou reutilizar ID antigo de conversa.
  let contato: any = null;

  // Telefone fornecido pelo dono (match pelos últimos 8-10 dígitos)
  if (args?.whatsapp) {
    const digits = String(args.whatsapp).replace(/\D/g, "");
    if (digits.length >= 8) {
      const tail10 = digits.slice(-10);
      const tail8 = digits.slice(-8);
      const { data: todos } = await sb.from("contatos_comerciais")
        .select("*").eq("user_id", ctx.userId).eq("ativo", true);
      const match = (todos ?? []).find((c: any) => {
        const cd = String(c.whatsapp || "").replace(/\D/g, "");
        if (!cd) return false;
        return cd === digits || cd.slice(-10) === tail10 || cd.slice(-8) === tail8;
      });
      if (match) contato = match;
    }
  }

  // Nome informado pelo dono ou pelo próprio modelo no fallback
  if (!contato && args?.nome_busca) {
    const { data } = await sb.from("contatos_comerciais")
      .select("*").eq("user_id", ctx.userId).eq("ativo", true)
      .ilike("nome", `%${args.nome_busca.trim()}%`).limit(5);
    if (data && data.length === 1) contato = data[0];
    else if (data && data.length > 1) {
      return JSON.stringify({
        erro: "ambiguidade",
        detalhe: "Vários contatos batem com esse nome. Confirme qual e chame de novo com contato_id.",
        candidatos: data.map((c: any) => ({ id: c.id, nome: c.nome, empresa: c.empresa })),
      });
    }
  }

  if (!contato && args?.contato_id && /^[0-9a-f-]{36}$/i.test(args.contato_id)) {
    const { data } = await sb.from("contatos_comerciais")
      .select("*").eq("id", args.contato_id).eq("user_id", ctx.userId).maybeSingle();
    contato = data;
  }

  // Fallback extra: se o modelo ainda inventar UUID e não mandar nome_busca,
  // tenta inferir pelo nome-alvo no texto composto (ex: "Oi Marcelo...").
  if (!contato) {
    contato = await inferContatoComercialFromText(mensagem, ctx.userId);
  }

  if (!contato) {
    // Último fallback: devolve a lista pro AI escolher o UUID real (nunca inventar)
    const { data: todos } = await sb.from("contatos_comerciais")
      .select("id, nome, empresa, whatsapp")
      .eq("user_id", ctx.userId).eq("ativo", true).order("nome").limit(20);
    return JSON.stringify({
      erro: "contato_nao_encontrado",
      detalhe: "NUNCA invente contato_id. Escolha o UUID exato da lista abaixo e chame de novo.",
      contatos_disponiveis: todos ?? [],
    });
  }
  if (!contato.ativo) return JSON.stringify({ erro: "contato_inativo", nome: contato.nome });
  if (!contato.permite_jarvis_contatar) {
    return JSON.stringify({
      erro: "contato_bloqueado_para_jarvis",
      nome: contato.nome,
      detalhe: "Esse contato está com a permissão do Jarvis desligada. O dono precisa ativar em /pj/contatos-comerciais.",
    });
  }

  const phone = normalizePhoneBR(contato.whatsapp);
  if (!phone) return JSON.stringify({ erro: "whatsapp_invalido", nome: contato.nome, whatsapp: contato.whatsapp });

  // 2) Calcular scheduled_at
  let scheduledMs = Date.now();
  if (args?.minutos_a_partir_de_agora && Number(args.minutos_a_partir_de_agora) > 0) {
    scheduledMs = Date.now() + Number(args.minutos_a_partir_de_agora) * 60000;
  } else if (args?.data_hora_sp) {
    const m = String(args.data_hora_sp).trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
    if (!m) return JSON.stringify({ erro: "formato_data_invalido", esperado: "YYYY-MM-DD HH:MM" });
    const [, y, mo, d, h, mi] = m;
    scheduledMs = Date.UTC(+y, +mo - 1, +d, +h + 3, +mi, 0);
    if (scheduledMs <= Date.now() - 60000) return JSON.stringify({ erro: "data_no_passado" });
  }

  // 3) Enfileirar via RPC oficial (regra Core: só via inserir_campanha_fila)
  const { error: rpcErr } = await sb.rpc("inserir_campanha_fila", {
    p_user_id: ctx.userId,
    p_contatos: [{
      phone,
      name: contato.nome,
      mensagem,
      scheduled_at: new Date(scheduledMs).toISOString(),
      lead_source: "jarvis_contato_comercial",
      metadata: {
        contato_comercial_id: contato.id,
        tipo_acao: args?.tipo_acao || "mensagem_livre",
        via: "jarvis_command",
      },
    }],
    p_mensagem: mensagem,
    p_lead_source: "jarvis_contato_comercial",
    p_metadata: {
      contato_comercial_id: contato.id,
      tipo_acao: args?.tipo_acao || "mensagem_livre",
    },
  });
  if (rpcErr) return JSON.stringify({ erro: "falha_ao_enfileirar", detalhe: rpcErr.message });

  // 4) Atualizar última interação
  await sb.from("contatos_comerciais")
    .update({ ultima_interacao: new Date().toISOString() })
    .eq("id", contato.id)
    .eq("user_id", ctx.userId);

  const quandoSP = new Date(scheduledMs).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
  const agora = Math.abs(scheduledMs - Date.now()) < 60000;

  return JSON.stringify({
    ok: true,
    contato: { nome: contato.nome, empresa: contato.empresa, whatsapp: phone },
    tipo_acao: args?.tipo_acao || "mensagem_livre",
    agendado_para: quandoSP,
    envio_imediato: agora,
    preview_mensagem: mensagem.slice(0, 200),
  });
}

// ---- NOTÍCIAS (Google News RSS, grátis) ----
async function toolConsultarNoticias(tema: string): Promise<string> {

  const t = (tema || "").trim();
  if (!t) return JSON.stringify({ erro: "tema_obrigatorio" });
  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(t)}&hl=pt-BR&gl=BR&ceid=BR:pt-419`;
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return JSON.stringify({ erro: `rss ${r.status}` });
    const xml = await r.text();
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 8).map((m) => {
      const b = m[1];
      const pick = (tag: string) => {
        const rx = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`);
        return b.match(rx)?.[1]?.trim() ?? "";
      };
      return { titulo: pick("title"), link: pick("link"), data: pick("pubDate"), fonte: pick("source") };
    });
    return JSON.stringify({ tema: t, total: items.length, noticias: items });
  } catch (e) { return JSON.stringify({ erro: String((e as Error).message) }); }
}

// ---- RASTREIO CORREIOS (LinkAndTrack, grátis) ----
async function toolRastrearCorreios(codigo: string): Promise<string> {
  const c = (codigo || "").toUpperCase().replace(/\s+/g, "");
  if (!/^[A-Z]{2}\d{9}[A-Z]{2}$/.test(c)) return JSON.stringify({ erro: "codigo_invalido", esperado: "13 chars ex AA123456789BR" });
  try {
    const r = await fetch(`https://api.linketrack.com/track/json?user=teste&token=1abcd00b2731640e886fb41a8a9671ad1434c599dbaa0a0de9a5aa619f29a83f&codigo=${c}`, { signal: AbortSignal.timeout(10000) });
    if (!r.ok) return JSON.stringify({ erro: `rastreio ${r.status}` });
    const d = await r.json();
    return JSON.stringify({
      codigo: c, servico: d.servico, quantidade: d.quantidade,
      eventos: (d.eventos ?? []).slice(0, 6).map((e: any) => ({ data: `${e.data} ${e.hora}`, status: e.status, local: e.local, subStatus: e.subStatus })),
    });
  } catch (e) { return JSON.stringify({ erro: String((e as Error).message) }); }
}

// ---- ROTA/TRÂNSITO (OSRM público, grátis) ----
async function toolCalcularRota(origem: string, destino: string, ctx: { userId: string; fromNumber: string }): Promise<string> {
  async function geocode(q: string): Promise<{ lat: number; lng: number; nome: string } | null> {
    if (!q) return null;
    const ll = q.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (ll) return { lat: +ll[1], lng: +ll[2], nome: q };
    if (q.toLowerCase().includes("aqui") || q.toLowerCase().includes("minha loc")) {
      const { data } = await sb.from("whatsapp_user_locations").select("latitude,longitude,address").eq("user_id", ctx.userId).eq("contact_number", ctx.fromNumber).maybeSingle();
      if (data) return { lat: +data.latitude, lng: +data.longitude, nome: data.address || "sua localização" };
    }
    const g = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`, {
      headers: { "User-Agent": "amz-jarvis/1.0" }, signal: AbortSignal.timeout(8000),
    });
    if (!g.ok) return null;
    const arr = await g.json();
    if (!arr?.[0]) return null;
    return { lat: +arr[0].lat, lng: +arr[0].lon, nome: arr[0].display_name };
  }
  try {
    const o = await geocode(origem); const d = await geocode(destino);
    if (!o || !d) return JSON.stringify({ erro: "endereco_nao_encontrado" });
    const url = `https://router.project-osrm.org/route/v1/driving/${o.lng},${o.lat};${d.lng},${d.lat}?overview=false&steps=false`;
    const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!r.ok) return JSON.stringify({ erro: `osrm ${r.status}` });
    const j = await r.json();
    const rt = j?.routes?.[0];
    if (!rt) return JSON.stringify({ erro: "rota_nao_encontrada" });
    return JSON.stringify({
      origem: o.nome, destino: d.nome,
      distancia_km: +(rt.distance / 1000).toFixed(1),
      duracao_min: Math.round(rt.duration / 60),
      mapa: `https://www.google.com/maps/dir/?api=1&origin=${o.lat},${o.lng}&destination=${d.lat},${d.lng}`,
    });
  } catch (e) { return JSON.stringify({ erro: String((e as Error).message) }); }
}

// ---- ADMIN (só Felicio) ----
// isOwner é POR TENANT: compara fromNumber com o owner_phone do userId em contexto.
// Fallback seguro: sem owner registrado, ninguém é dono.
function isOwner(ctx: { userId?: string; fromNumber: string }): boolean {
  if (!ctx.fromNumber) return false;
  const owners = ctx.userId ? getTenantOwnersForCtx(ctx.userId) : [];
  return owners.some((owner) => ownerPhonesEquivalent(owner, ctx.fromNumber));
}

function hasAmzGlobalToolAccess(ctx: { userId: string; fromNumber: string }): boolean {
  return canUseAmzGlobalTools({
    userId: ctx.userId,
    isOwner: isOwner(ctx),
    adminAmzUserId: ADMIN_AMZ_USER_ID,
  });
}

async function toolRelatorioAnunciosMeta(
  periodo: unknown,
  ctx: { userId: string; fromNumber: string },
): Promise<string> {
  if (!isOwner(ctx)) {
    return "Esse relatório é restrito ao responsável da conta.";
  }
  return await getMetaAdsReport({
    userId: ctx.userId,
    period: periodo,
    loadIntegration: async (userId) => {
      const { data, error } = await sb
        .from("integrations")
        .select("access_token, token_expires_at, ad_account_id, ad_account_name, ad_account_currency, is_active")
        .eq("user_id", userId)
        .eq("platform", "meta_ads")
        .eq("is_active", true)
        .maybeSingle();
      if (error) return null;
      return data;
    },
  });
}

type MetaAdsToolContext = {
  userId: string;
  fromNumber: string;
  convId?: string;
  agentState?: AgentConvState;
};

type MetaAdsIntegrationRow = {
  access_token: string;
  token_expires_at?: string | null;
  ad_account_id?: string | null;
  ad_account_name?: string | null;
  ad_account_currency?: string | null;
  limite_mensal_anuncios?: number | string | null;
  is_active?: boolean | null;
};

const META_ADS_CONNECT_URL = "https://www.amzofertas.com.br/configuracoes";
const META_ADS_DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function metaAdsBrl(value: unknown): string {
  const amount = Number(value);
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number.isFinite(amount) ? amount : 0);
}

async function loadMetaAdsIntegration(
  userId: string,
): Promise<MetaAdsIntegrationRow | null> {
  const { data, error } = await sb
    .from("integrations")
    .select("access_token, token_expires_at, ad_account_id, ad_account_name, ad_account_currency, limite_mensal_anuncios, is_active")
    .eq("user_id", userId)
    .eq("platform", "meta_ads")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data as MetaAdsIntegrationRow;
}

function metaAdsIntegrationProblem(
  integration: MetaAdsIntegrationRow | null,
): string | null {
  if (!integration?.access_token) {
    return `O Meta Ads ainda não está conectado. Conecte em ${META_ADS_CONNECT_URL}`;
  }
  const expiresAt = Date.parse(String(integration.token_expires_at ?? ""));
  if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) {
    return `A conexão do Meta Ads venceu. Reconecte em ${META_ADS_CONNECT_URL}`;
  }
  if (!integration.ad_account_id) {
    return `Escolha uma conta de anúncios em ${META_ADS_CONNECT_URL}`;
  }
  return null;
}

async function metaAdsGraph(
  integration: MetaAdsIntegrationRow,
  path: string,
  init?: { method?: "GET" | "POST"; params?: Record<string, string> },
): Promise<any> {
  return await metaGraphRequest(path, {
    accessToken: integration.access_token,
    method: init?.method,
    params: init?.params,
  });
}

async function loadMetaAdsMonthlyAvailability(
  integration: MetaAdsIntegrationRow,
  userId: string,
): Promise<
  ReturnType<typeof calculateMetaAdsMonthlyAvailability> & {
    observedCampaignIds: string[];
  }
> {
  const { data: platformRows, error } = await sb
    .from("meta_ads_campanhas")
    .select("id,campaign_id,gasto_maximo,status")
    .eq("user_id", userId)
    .in("status", ["publicando", "publicado", "pausado"]);
  if (error) throw new Error("META_REQUEST");

  const accountInsights = await metaAdsGraph(
    integration,
    `${integration.ad_account_id}/insights`,
    {
      params: {
        fields: "spend",
        level: "account",
        date_preset: "this_month",
        limit: "1",
      },
    },
  );
  const actualSpent = Number(accountInsights?.data?.[0]?.spend ?? 0);
  const activeCampaigns: Array<{
    maximumSpend: number;
    lifetimeSpent: number;
  }> = [];
  await Promise.all((platformRows ?? [])
    .filter((platform: any) =>
      platform.status !== "publicando" && platform.campaign_id
    )
    .map(async (platform: any) => {
      const campaign = await metaAdsGraph(
        integration,
        String(platform.campaign_id),
        { params: { fields: "effective_status" } },
      );
      if (campaign?.effective_status !== "ACTIVE") return;
      const insights = await metaAdsGraph(
        integration,
        `${platform.campaign_id}/insights`,
        {
          params: {
            fields: "spend",
            date_preset: "maximum",
            limit: "1",
          },
        },
      );
      activeCampaigns.push({
        maximumSpend: Number(platform.gasto_maximo ?? 0),
        lifetimeSpent: Number(insights?.data?.[0]?.spend ?? 0),
      });
    }));
  const now = new Date();
  const daysInMonth = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth() + 1,
    0,
  )).getUTCDate();
  return {
    ...calculateMetaAdsMonthlyAvailability({
      monthlyCap: integration.limite_mensal_anuncios,
      actualSpent,
      activeCampaigns,
      inFlightReservations: (platformRows ?? [])
        .filter((platform: any) => platform.status === "publicando")
        .map((platform: any) => platform.gasto_maximo),
      daysRemaining: daysInMonth - now.getUTCDate() + 1,
    }),
    observedCampaignIds: (platformRows ?? [])
      .filter((platform: any) => platform.status !== "publicando")
      .map((platform: any) => String(platform.id)),
  };
}

function metaAdsSafeError(error: unknown): string {
  return publicMetaAdsError(error).message;
}

async function toolProporLimiteMensalMetaAds(
  value: unknown,
  ctx: MetaAdsToolContext,
): Promise<{
  result: string;
  interactiveButtons?: WhatsAppInteractiveButtons;
}> {
  if (!isOwner(ctx)) {
    return { result: "Essa ferramenta é restrita ao responsável da conta." };
  }
  const novoLimite = validarNovoLimiteMensalAnuncios(value);
  if (novoLimite === null) {
    return {
      result:
        "O limite mensal de anúncios deve ficar entre R$ 50,00 e R$ 10.000,00. Nenhuma alteração foi feita.",
    };
  }
  if (!ctx.convId) {
    return {
      result:
        "Não consegui vincular a confirmação a esta conversa. Nenhuma alteração foi feita.",
    };
  }
  const integration = await loadMetaAdsIntegration(ctx.userId);
  const integrationProblem = metaAdsIntegrationProblem(integration);
  if (integrationProblem || !integration) {
    return { result: integrationProblem! };
  }
  let availability: Awaited<
    ReturnType<typeof loadMetaAdsMonthlyAvailability>
  >;
  try {
    availability = await loadMetaAdsMonthlyAvailability(
      integration,
      ctx.userId,
    );
  } catch (error) {
    return { result: metaAdsSafeError(error) };
  }
  const proposal: MetaAdsLimitProposal = {
    token: crypto.randomUUID().replace(/-/g, "").slice(0, 12),
    limite_atual: Number(integration.limite_mensal_anuncios ?? 200),
    novo_limite: novoLimite,
    gasto_mes: availability.spent,
    criado_em: new Date().toISOString(),
  };
  const conversation: ConversationStateIdentity = {
    id: ctx.convId,
    userId: ctx.userId,
    contactNumber: ctx.fromNumber,
  };
  const current = ctx.agentState ?? await loadAgentState(sb, conversation);
  const saved = await saveAgentState(
    sb,
    conversation,
    { pending_meta_ads_limit: proposal },
    current,
  );
  if (!saved) {
    return {
      result:
        "Não consegui guardar a proposta com segurança. Nenhuma alteração foi feita.",
    };
  }
  if (ctx.agentState) ctx.agentState.pending_meta_ads_limit = proposal;
  const mensagem = [
    "Proposta de alteração do limite mensal de anúncios:",
    `Limite atual: ${metaAdsBrl(proposal.limite_atual)}`,
    `Gasto neste mês: ${metaAdsBrl(proposal.gasto_mes)}`,
    `Novo limite: ${metaAdsBrl(proposal.novo_limite)}`,
    "",
    "O limite só será alterado após sua confirmação.",
  ].join("\n");
  return {
    result: JSON.stringify({ ok: true, mensagem }),
    interactiveButtons: metaAdsLimitProposalButtons(proposal.token),
  };
}

async function findLatestMetaAdsDraft(
  ctx: MetaAdsToolContext,
  message: unknown,
): Promise<any | null> {
  if (!ctx.convId) return null;
  const { data: latestOutbound, error: outboundError } = await sb
    .from("whatsapp_cloud_messages")
    .select("id")
    .eq("user_id", ctx.userId)
    .eq("conversation_id", ctx.convId)
    .eq("direction", "outbound")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (outboundError || !latestOutbound?.id) return null;

  let query = sb
    .from("meta_ads_campanhas")
    .select("id, user_id, rascunho, status, orcamento_diario, duracao_dias, gasto_maximo, aprovado_em, criado_em")
    .eq("user_id", ctx.userId)
    .eq("status", "rascunho")
    .is("aprovado_em", null)
    .gte("criado_em", new Date(Date.now() - META_ADS_DRAFT_MAX_AGE_MS).toISOString())
    .order("criado_em", { ascending: false });
  if (ctx.convId) query = query.eq("rascunho->>conversation_id", ctx.convId);
  const { data, error } = await query;
  if (error || !data) return null;
  return latestMetaAdsWhatsappApproval({
    message,
    isOwner: isOwner(ctx),
    ownerPhone: ctx.fromNumber,
    conversationId: ctx.convId,
    latestOutboundMessageId: latestOutbound.id,
    drafts: data,
    phonesEquivalent: ownerPhonesEquivalent,
  });
}

async function toolRascunhoAnuncioMeta(
  args: Record<string, unknown>,
  ctx: MetaAdsToolContext,
): Promise<string> {
  if (!isOwner(ctx)) return "Essa ferramenta é restrita ao responsável da conta.";
  const nome = String(args?.nome ?? "").trim();
  const orcamentoDiario = Number(args?.orcamento_diario);
  const duracaoDias = Math.trunc(Number(args?.duracao_dias));
  const validated = validateMetaAdsDraft({
    name: nome,
    objective: args?.objective,
    primary_text: args?.texto_principal,
    headline: args?.titulo,
    description: args?.descricao,
    media_url: args?.midia_url,
    media_type: args?.tipo_midia,
    daily_budget: orcamentoDiario,
    duration_days: duracaoDias,
    cities: args?.cidades,
    interests: args?.interesses,
    destination_url: args?.destination_url,
    radius_km: args?.radius_km,
    age_min: args?.age_min,
    age_max: args?.age_max,
    gender: args?.gender,
    whatsapp_message: args?.whatsapp_message,
    special_ad_categories: args?.special_ad_categories,
  });
  if (!validated.ok) {
    return `O rascunho está incompleto. Revise: ${validated.errors.join(", ")}. Nenhum anúncio foi publicado.`;
  }

  const integration = await loadMetaAdsIntegration(ctx.userId);
  const integrationProblem = metaAdsIntegrationProblem(integration);
  if (integrationProblem || !integration) return integrationProblem!;

  let availability: Awaited<
    ReturnType<typeof loadMetaAdsMonthlyAvailability>
  >;
  try {
    availability = await loadMetaAdsMonthlyAvailability(
      integration,
      ctx.userId,
    );
  } catch (error) {
    return metaAdsSafeError(error);
  }
  const tetoMensal = Number(integration.limite_mensal_anuncios ?? 200);
  const gastoMaximo = metaAdsMaximumSpend(validated.draft);
  const rascunho = {
    ...validated.draft,
    solicitante_telefone: ctx.fromNumber,
    conversation_id: ctx.convId ?? null,
    gasto_mes_no_rascunho: availability.spent,
    limite_mensal_no_rascunho: tetoMensal,
  };
  const { data, error } = await sb
    .from("meta_ads_campanhas")
    .insert({
      user_id: ctx.userId,
      rascunho,
      status: "rascunho",
      orcamento_diario: validated.draft.daily_budget,
      duracao_dias: validated.draft.duration_days,
      gasto_maximo: gastoMaximo,
    })
    .select("id")
    .single();
  if (error || !data) {
    return "Não consegui salvar o rascunho do anúncio. Nenhum anúncio foi publicado.";
  }
  const objectiveSummary = validated.draft.objective === "site"
    ? `Site (${validated.draft.destination_url})`
    : "WhatsApp";
  return [
    `Rascunho salvo: ${validated.draft.name}`,
    `Objetivo: ${objectiveSummary}`,
    `Orçamento: ${metaAdsBrl(validated.draft.daily_budget)}/dia por ${validated.draft.duration_days} dia(s)`,
    `Gasto neste mês: ${metaAdsBrl(availability.spent)}`,
    `Teto mensal: ${metaAdsBrl(tetoMensal)}`,
    `Gasto máximo deste anúncio: ${metaAdsBrl(gastoMaximo)}`,
    gastoMaximo > availability.available
      ? "Atenção: este anúncio ultrapassaria o teto mensal e não poderá ser publicado assim."
      : null,
    `Código do rascunho: ${data.id}`,
    "",
    "Responda SIM para publicar ou me diga o que mudar",
  ].filter((line): line is string => line !== null).join("\n");
}

async function toolPublicarAnuncioMeta(
  args: Record<string, unknown>,
  ctx: MetaAdsToolContext,
): Promise<string> {
  if (!isOwner(ctx)) return "Essa ferramenta é restrita ao responsável da conta.";
  if (!isLiteralMetaAdsApproval(args?.confirmacao)) {
    return "Para publicar o último rascunho, responda exatamente SIM.";
  }
  const draft = await findLatestMetaAdsDraft(ctx, args?.confirmacao);
  if (!draft) {
    return "Não encontrei um rascunho desta conversa aguardando um SIM explícito nas últimas 24 horas.";
  }
  if (args?.rascunho_id && String(args.rascunho_id) !== String(draft.id)) {
    return "Esse SIM não corresponde ao rascunho mais recente desta conversa.";
  }

  const integration = await loadMetaAdsIntegration(ctx.userId);
  const integrationProblem = metaAdsIntegrationProblem(integration);
  if (integrationProblem || !integration) return integrationProblem!;
  const validated = validateMetaAdsDraft(draft.rascunho);
  if (!validated.ok) {
    return `Não publiquei: o rascunho precisa ser corrigido (${validated.errors.join(", ")}).`;
  }

  let availability: Awaited<
    ReturnType<typeof loadMetaAdsMonthlyAvailability>
  >;
  try {
    const account = await metaAdsGraph(
      integration,
      integration.ad_account_id!,
      {
        params: {
          fields:
            "account_status,disable_reason,funding_source_details,is_prepay_account,balance",
        },
      },
    );
    if (Number(account?.account_status) !== 1) {
      return "Não publiquei: a conta de anúncios não está ativa.";
    }
    if (!account?.funding_source_details) {
      const accountId = String(integration.ad_account_id).replace(/^act_/, "");
      return `Não publiquei: configure uma forma de pagamento em https://adsmanager.facebook.com/billing_hub/payment_settings/?asset_id=${accountId}`;
    }
    availability = await loadMetaAdsMonthlyAvailability(
      integration,
      ctx.userId,
    );
  } catch (error) {
    return metaAdsSafeError(error);
  }
  const gastoMaximo = metaAdsMaximumSpend(validated.draft);
  if (gastoMaximo > availability.available) {
    return `Não publiquei: o gasto do mês (${metaAdsBrl(availability.spent)}) e a reserva das campanhas ativas (${metaAdsBrl(availability.reservedRemaining)}) deixam ${metaAdsBrl(availability.available)} disponíveis no teto de ${metaAdsBrl(availability.cap)}; este anúncio pode gastar até ${metaAdsBrl(gastoMaximo)}.`;
  }
  const [{ data: page }, { data: whatsapp }] = await Promise.all([
    sb.from("meta_connections").select("page_id,is_active")
      .eq("user_id", ctx.userId).eq("is_active", true).limit(1).maybeSingle(),
    sb.from("whatsapp_config")
      .select("display_phone,phone_number_id,is_active,is_verified")
      .eq("user_id", ctx.userId).eq("is_active", true).limit(1).maybeSingle(),
  ]);
  if (!page?.page_id) {
    return "Não publiquei: conecte uma Página do Facebook antes de continuar.";
  }
  if (
    validated.draft.objective !== "site" &&
    (!whatsapp?.display_phone || !whatsapp?.phone_number_id ||
      whatsapp.is_active !== true)
  ) {
    return "Não publiquei: a configuração do WhatsApp da conta está incompleta.";
  }

  const committedWithoutInflight = Math.round(
    (availability.spent + availability.activeReservedRemaining) * 100,
  ) / 100;
  const { data: reservation, error: reservationError } = await sb.rpc(
    "reserve_meta_ads_publish",
    {
      p_user_id: ctx.userId,
      p_campaign_id: draft.id,
      p_committed_without_inflight: committedWithoutInflight,
      p_observed_campaign_ids: availability.observedCampaignIds,
    },
  );
  if (reservationError) {
    return "Não consegui reservar o orçamento com segurança. Nenhum anúncio foi publicado.";
  }
  if (!reservation?.ok) {
    if (reservation?.reason === "monthly_cap_exceeded") {
      return "Não publiquei: outra publicação em andamento reservou o saldo disponível do teto mensal.";
    }
    return "Esse rascunho já foi confirmado ou não está mais disponível.";
  }

  const releaseReservation = async (errorCode: string): Promise<boolean> => {
    const { data, error } = await sb.from("meta_ads_campanhas").update({
      status: "rascunho",
      aprovado_em: null,
      erro: errorCode,
      atualizado_em: new Date().toISOString(),
    }).eq("id", draft.id).eq("user_id", ctx.userId)
      .eq("status", "publicando").select("id").maybeSingle();
    return !error && Boolean(data);
  };

  try {
    const ids = await publishMetaAdsCampaign({
      accessToken: integration.access_token,
      adAccountId: integration.ad_account_id!,
      pageId: page.page_id,
      whatsappPhoneNumber: whatsapp?.display_phone,
      draft: validated.draft,
    });
    if (!hasCompleteMetaAdsEntityIds(ids)) {
      const rolledBack = await rollbackMetaAdsCampaign(
        ids,
        integration.access_token,
      );
      const safeToRelease = !String(ids?.campaign_id ?? "") || rolledBack;
      const released = safeToRelease
        ? await releaseReservation("incomplete_graph_ids")
        : false;
      return released
        ? "A Meta não confirmou todos os IDs da campanha. A publicação foi desfeita e o rascunho foi preservado."
        : "A publicação falhou e a reserva exige verificação manual.";
    }
    const { data: saved, error: saveError } = await sb.from(
      "meta_ads_campanhas",
    ).update({
      status: "publicado",
      ...ids,
      erro: null,
      atualizado_em: new Date().toISOString(),
    }).eq("id", draft.id).eq("user_id", ctx.userId)
      .eq("status", "publicando").select("id").maybeSingle();
    if (saveError || !saved) {
      const rolledBack = await rollbackMetaAdsCampaign(
        ids,
        integration.access_token,
      );
      const released = rolledBack
        ? await releaseReservation("publish_state_save_failed")
        : false;
      return rolledBack && released
        ? "Não consegui salvar a publicação com segurança. A campanha na Meta foi desfeita e o rascunho foi preservado."
        : "Não consegui confirmar a publicação; a campanha e a reserva exigem verificação manual.";
    }
    return `✅ Anúncio publicado. Campanha: ${ids.campaign_id}.`;
  } catch (error) {
    const released = await releaseReservation(publicMetaAdsError(error).code);
    if (!released) {
      return "A publicação falhou e a reserva exige verificação manual.";
    }
    return `${publicMetaAdsError(error).message} O rascunho foi preservado.`;
  }
}

type MetaAdsQuestionarioProcessorResult = {
  handled: boolean;
  text?: string;
  interactiveList?: WhatsAppInteractiveList;
  interactiveButtons?: WhatsAppInteractiveButtons;
  summaryDraftId?: string;
  offerResume?: boolean;
  ambiguityOriginal?: string;
  requestLimitValue?: boolean;
};

async function applyMetaAdsLimitAction(input: {
  action: "confirm" | "cancel";
  proposal: MetaAdsLimitProposal;
  ctx: MetaAdsToolContext;
  conversation: ConversationStateIdentity;
  agentState: AgentConvState;
}): Promise<MetaAdsQuestionarioProcessorResult> {
  const clearPending = async () => {
    input.agentState.pending_meta_ads_limit = null;
    await saveAgentState(
      sb,
      input.conversation,
      { pending_meta_ads_limit: null },
      input.agentState,
    );
  };
  if (!isOwner(input.ctx)) {
    return {
      handled: true,
      text: "Essa alteração é restrita ao responsável da conta.",
    };
  }
  if (input.action === "cancel") {
    await clearPending();
    return {
      handled: true,
      text: "Alteração cancelada. O limite mensal não foi modificado.",
    };
  }
  const integration = await loadMetaAdsIntegration(input.ctx.userId);
  const integrationProblem = metaAdsIntegrationProblem(integration);
  if (integrationProblem || !integration) {
    return { handled: true, text: integrationProblem! };
  }
  const { data, error } = await sb.from("integrations")
    .update({
      limite_mensal_anuncios: input.proposal.novo_limite,
    })
    .eq("user_id", input.ctx.userId)
    .eq("platform", "meta_ads")
    .eq("is_active", true)
    .select("id")
    .maybeSingle();
  if (error || !data) {
    return {
      handled: true,
      text: "Não consegui alterar o limite mensal. Tente confirmar novamente.",
    };
  }
  await clearPending();

  const { data: draftRows } = await sb.from("meta_ads_campanhas")
    .select("id,status,rascunho,criado_em")
    .eq("user_id", input.ctx.userId)
    .eq("status", "rascunho")
    .order("criado_em", { ascending: false })
    .limit(20);
  const hasActiveQuestionnaire = Boolean(questionarioAtivo(draftRows ?? []));
  return {
    handled: true,
    text: [
      `Limite mensal de anúncios alterado para ${metaAdsBrl(input.proposal.novo_limite)}.`,
      "Confira também o limite de gastos da conta no Faturamento da Meta, que é aplicado pela própria Meta.",
    ].join("\n\n"),
    interactiveButtons: hasActiveQuestionnaire
      ? metaAdsQuestionarioContinuarButtons()
      : undefined,
  };
}

function metaAdsQuestionarioOption(text: string): string {
  const id = metaAdsQuestionarioInteractiveId(text);
  return id?.startsWith("meta_ads_q:") ? id.slice("meta_ads_q:".length) : "";
}

function metaAdsQuestionarioPrompt(
  questionario: MetaAdsQuestionario,
  available?: number,
): Omit<MetaAdsQuestionarioProcessorResult, "handled"> {
  const prefix = "meta_ads_q:";
  switch (questionario.etapa) {
    case "objetivo":
      return {
        text: "Vamos lá! O que você quer com esse anúncio?",
        interactiveList: questionarioList({
          body: "Escolha o objetivo da campanha:",
          rows: [
            { id: `${prefix}objetivo:whatsapp`, title: "Conversas no WhatsApp" },
            { id: `${prefix}objetivo:site`, title: "Visitas ao site" },
          ],
        }),
      };
    case "url_site":
      return { text: "Qual é a URL completa do site? Envie começando com https://." };
    case "publico":
      return {
        text: "Sugeri públicos com interesses que encontrei na Meta. Qual você prefere?",
        interactiveList: questionarioList({
          body: "Escolha um público:",
          rows: [
            ...(questionario.publicos_sugeridos ?? []).slice(0, 3).map((
              pacote,
              index,
            ) => ({
              id: `${prefix}publico:${index}`,
              title: pacote.nome,
              description: pacote.interesses.map((item) => item.name).join(", "),
            })),
            {
              id: `${prefix}publico:amplo`,
              title: "Público amplo",
              description: "A Meta escolhe o público",
            },
          ],
        }),
      };
    case "cidade":
      return { text: "Qual cidade você quer alcançar?" };
    case "confirmar_cidade":
      return {
        text: "Qual destas cidades é a certa?",
        interactiveList: questionarioList({
          body: "Confirme a cidade:",
          rows: (questionario.cidades_encontradas ?? []).slice(0, 3).map((
            city,
            index,
          ) => ({
            id: `${prefix}cidade:${index}`,
            title: city.name,
          })),
        }),
      };
    case "raio":
      return {
        text: `Qual raio ao redor de ${questionario.cidade?.name ?? "essa cidade"}?`,
        interactiveButtons: questionarioButtons({
          body: "Escolha o raio:",
          buttons: [10, 25, 40].map((radius) => ({
            id: `${prefix}raio:${radius}`,
            title: `${radius} km`,
          })),
        }),
      };
    case "idade":
      return {
        text: "Qual faixa de idade?",
        interactiveList: questionarioList({
          body: "Escolha a faixa etária:",
          rows: [
            ["18-65", "18–65"],
            ["25-55", "25–55"],
            ["28-60", "28–60"],
            ["35-65", "35–65"],
            ["outra", "Outra"],
          ].map(([value, title]) => ({
            id: `${prefix}idade:${value}`,
            title,
          })),
        }),
      };
    case "idade_personalizada":
      return { text: "Digite a faixa de idade, por exemplo: 30-55." };
    case "orcamento":
      return {
        text: "Quanto você quer investir por dia? Escolha ou digite outro valor.",
        interactiveButtons: questionarioButtons({
          body: "Orçamento diário:",
          buttons: [10, 20, 30].map((amount) => ({
            id: `${prefix}orcamento:${amount}`,
            title: `R$ ${amount}`,
          })),
        }),
      };
    case "duracao":
      return {
        text: `Por quantos dias?${Number.isFinite(available) ? ` Você tem ${metaAdsBrl(available)} disponíveis no teto mensal.` : ""}`,
        interactiveList: questionarioList({
          body: "Escolha a duração:",
          rows: [7, 15, 30].map((days) => ({
            id: `${prefix}duracao:${days}`,
            title: `${days} dias`,
          })),
        }),
      };
    case "midia":
      return { text: "Escolha uma das suas mídias recentes. Se a lista estiver vazia, envie uma imagem ou um vídeo aqui." };
    case "texto":
      return {
        text: `Escrevi este anúncio:\n\n*${questionario.titulo}*\n${questionario.texto_principal}`,
        interactiveButtons: questionarioButtons({
          body: "O que deseja fazer com o texto?",
          buttons: [
            { id: `${prefix}texto:aprovar`, title: "Aprovar" },
            { id: `${prefix}texto:reescrever`, title: "Reescrever" },
            { id: `${prefix}texto:manual`, title: "Eu escrevo" },
          ],
        }),
      };
    case "texto_manual":
      return {
        text: "Envie o título na primeira linha e o texto principal nas linhas seguintes.",
      };
    case "resumo":
      return {
        text: metaAdsQuestionarioResumo(questionario),
        interactiveButtons: questionarioButtons({
          body: "Confira o resumo. Nada será publicado sem sua confirmação.",
          buttons: [
            { id: `${prefix}publicar:${questionario.resumo_hash}`, title: "Publicar" },
            { id: `${prefix}ajustar`, title: "Ajustar" },
            { id: `${prefix}cancelar`, title: "Cancelar" },
          ],
        }),
      };
  }
}

async function metaAdsQuestionarioInteresses(
  integration: MetaAdsIntegrationRow,
  userId: string,
): Promise<Array<{ nome: string; interesses: Array<{ id: string; name: string }> }>> {
  const context = await getTenantBusinessContext(sb as any, userId, {
    incluirProdutos: true,
  });
  const terms = [
    context.segmento,
    ...(context.publicoAlvo ?? "").split(/[,;/]|\be\b/),
    ...context.produtos.slice(0, 2),
  ].map((term) => String(term ?? "").trim()).filter((term) => term.length >= 3)
    .slice(0, 3);
  const packages: Array<{
    nome: string;
    interesses: Array<{ id: string; name: string }>;
  }> = [];
  for (const term of terms) {
    try {
      const result = await metaAdsGraph(integration, "search", {
        params: {
          type: "adinterest",
          q: term,
          locale: "pt_BR",
          limit: "5",
        },
      });
      const found = (Array.isArray(result?.data) ? result.data : []).map((
        item: any,
      ) => ({
        id: String(item.id ?? item.key ?? ""),
        name: String(item.name ?? ""),
      })).filter((item: any) => item.id && item.name);
      const validated = filtrarInteressesValidados(
        found.map((item: any) => item.name),
        found,
      ).slice(0, 3);
      if (validated.length) {
        packages.push({
          nome: validated[0].name.slice(0, 24),
          interesses: validated,
        });
      }
    } catch (error) {
      console.warn("[meta-ads-questionario][interest_search]", metaAdsSafeError(error));
    }
  }
  return packages.slice(0, 3);
}

async function metaAdsQuestionarioMidias(
  userId: string,
): Promise<MetaAdsQuestionarioMidia[]> {
  const { data, error } = await sb.from("midias_whatsapp")
    .select("id,tipo,midia_url,contexto_original,legenda_gerada,created_at")
    .eq("user_id", userId)
    .in("tipo", ["foto", "video"])
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) return [];
  return (data ?? []).map((item: any, index: number): MetaAdsQuestionarioMidia => ({
    id: String(item.id),
    url: String(item.midia_url),
    tipo: item.tipo === "video" ? "video" : "image",
    titulo: String(
      item.contexto_original || item.legenda_gerada ||
        `${item.tipo === "video" ? "Vídeo" : "Imagem"} ${index + 1}`,
    ).replace(/\s+/g, " ").slice(0, 24),
  })).filter((item) => Boolean(item.id) && /^https:\/\//i.test(item.url));
}

async function metaAdsQuestionarioGerarTexto(
  userId: string,
  questionario: MetaAdsQuestionario,
): Promise<{ titulo: string; texto: string } | null> {
  const context = await getTenantBusinessContext(sb as any, userId, {
    incluirProdutos: true,
    tipoCriativo: "anuncio",
  });
  if (
    !context.nome && !context.segmento && !context.sobre &&
    !context.diferenciais && !context.publicoAlvo && !context.produtos.length
  ) return null;
  try {
    const gerarCopy = async (
      system: string,
      user: string,
    ): Promise<{ titulo: string; texto: string }> => {
      const response = await fetch(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${LOVABLE_API_KEY}`,
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            temperature: 0.4,
            messages: [
              { role: "system", content: system },
              { role: "user", content: user },
            ],
          }),
        },
      );
      if (!response.ok) throw new Error(`copy_http_${response.status}`);
      const payload = await response.json();
      const raw = String(payload?.choices?.[0]?.message?.content ?? "")
        .replace(/^```json\s*|\s*```$/g, "").trim();
      const parsed = JSON.parse(raw);
      const titulo = String(parsed?.titulo ?? "").trim().slice(0, 255);
      const texto = String(parsed?.texto ?? "").trim().slice(0, 2_000);
      if (!titulo || !texto) throw new Error("copy_invalida");
      return { titulo, texto };
    };
    const objetivo = questionario.objetivo === "site"
      ? "visitas ao site"
      : "conversas no WhatsApp";
    const primeiraVersao = await gerarCopy(
      "Crie copy curta para Meta Ads. Use SOMENTE os fatos fornecidos. Não invente preço, promoção, avaliação, depoimento, prazo, resultado ou promessa. Responda só JSON válido: {\"titulo\":\"...\",\"texto\":\"...\"}.",
      `${context.promptBlock}\nObjetivo: ${objetivo}.`,
    );
    return await revisarComMetodoAmz({
      tipo: "anuncio",
      primeiraVersao,
      revisar: async (draft) =>
        await gerarCopy(
          "Revise uma copy de Meta Ads. Preserve os fatos e devolva somente JSON válido com titulo e texto.",
          `${context.promptBlock}\nObjetivo: ${objetivo}.\n\n${
            buildMetodoAmzReviewPrompt({
              tipo: "anuncio",
              primeiraVersao: draft,
            })
          }`,
        ),
    });
  } catch (error) {
    console.warn("[meta-ads-questionario][copy]", (error as Error).message);
    return null;
  }
}

async function processMetaAdsQuestionario(input: {
  userId: string;
  fromNumber: string;
  conversationId: string;
  text: string;
  owner: boolean;
}): Promise<MetaAdsQuestionarioProcessorResult> {
  const ctx: MetaAdsToolContext = {
    userId: input.userId,
    fromNumber: input.fromNumber,
    convId: input.conversationId,
  };
  const { data: rows } = await sb.from("meta_ads_campanhas")
    .select("id,status,rascunho,criado_em")
    .eq("user_id", input.userId)
    .eq("status", "rascunho")
    .order("criado_em", { ascending: false })
    .limit(20);
  let row = questionarioAtivo(rows ?? []);
  const trigger = isMetaAdsQuestionarioTrigger(input.text);
  const ambiguous = isMetaAdsQuestionarioAmbiguousRequest(input.text);
  if (!row && !trigger && !ambiguous) return { handled: false };
  if (!input.owner) {
    return trigger
      ? { handled: true, text: "A criação de anúncios é restrita ao responsável da conta." }
      : { handled: false };
  }
  if (!row && ambiguous) {
    return {
      handled: true,
      text: "Só para confirmar:",
      interactiveButtons: metaAdsQuestionarioAmbiguityButtons(),
      ambiguityOriginal: input.text,
    };
  }

  const integration = await loadMetaAdsIntegration(input.userId);
  const integrationProblem = metaAdsIntegrationProblem(integration);
  if (trigger && (!integration || integrationProblem)) {
    return { handled: true, text: integrationProblem! };
  }

  if (!row) {
    const questionario = novoMetaAdsQuestionario();
    const { data: created, error } = await sb.from("meta_ads_campanhas").insert({
      user_id: input.userId,
      status: "rascunho",
      rascunho: {
        questionario,
        conversation_id: input.conversationId,
        solicitante_telefone: input.fromNumber,
      },
    }).select("id,status,rascunho,criado_em").single();
    if (error || !created) {
      return { handled: true, text: "Não consegui iniciar a campanha agora. Tente novamente." };
    }
    row = created;
    return { handled: true, ...metaAdsQuestionarioPrompt(questionario) };
  }

  let questionario = row.rascunho?.questionario as MetaAdsQuestionario;
  if (metaAdsQuestionarioExpirado(questionario)) {
    await sb.from("meta_ads_campanhas").delete().eq("id", row.id)
      .eq("user_id", input.userId).eq("status", "rascunho");
    return {
      handled: true,
      text: "Esse questionário expirou após 24 horas. Peça para criar um anúncio e começamos de novo.",
    };
  }
  if (isMetaAdsQuestionarioCancel(input.text)) {
    await sb.from("meta_ads_campanhas").delete().eq("id", row.id)
      .eq("user_id", input.userId).eq("status", "rascunho");
    return { handled: true, text: "Campanha cancelada. Nada foi publicado." };
  }
  if (isMetaAdsLimitChangeRequest(input.text)) {
    return { handled: false };
  }
  if (!integration || integrationProblem) {
    return { handled: true, text: integrationProblem! };
  }
  if (isMetaAdsQuestionarioResume(input.text) || trigger) {
    if (questionario.etapa === "midia") {
      const midias = await metaAdsQuestionarioMidias(input.userId);
      return {
        handled: true,
        ...metaAdsQuestionarioPrompt(questionario),
        interactiveList: midias.length
          ? questionarioList({
            body: "Escolha uma mídia:",
            rows: midias.map((media) => ({
              id: `meta_ads_q:midia:${media.id}`,
              title: media.titulo,
              description: media.tipo === "video" ? "Vídeo" : "Imagem",
            })),
          })
          : undefined,
      };
    }
    return {
      handled: true,
      ...metaAdsQuestionarioPrompt(questionario),
      summaryDraftId: questionario.etapa === "resumo" ? row.id : undefined,
    };
  }
  if (!respostaPertenceAoQuestionario(input.text, questionario.etapa)) {
    return { handled: false, offerResume: true };
  }

  const option = metaAdsQuestionarioOption(input.text);
  const now = new Date().toISOString();
  const update = async (
    patch: Partial<MetaAdsQuestionario>,
    draftPatch: Record<string, unknown> = {},
  ) => {
    questionario = avancarMetaAdsQuestionario(
      questionario,
      patch.etapa ?? questionario.etapa,
      patch,
      new Date(now),
    );
    const rascunho = {
      ...(row!.rascunho ?? {}),
      ...draftPatch,
      questionario,
      conversation_id: input.conversationId,
      solicitante_telefone: input.fromNumber,
    };
    await sb.from("meta_ads_campanhas").update({
      rascunho,
      atualizado_em: now,
      ...(questionario.orcamento_diario
        ? { orcamento_diario: questionario.orcamento_diario }
        : {}),
      ...(questionario.duracao_dias
        ? {
          duracao_dias: questionario.duracao_dias,
          gasto_maximo: questionario.orcamento_diario! *
            questionario.duracao_dias,
        }
        : {}),
    }).eq("id", row!.id).eq("user_id", input.userId).eq("status", "rascunho");
  };

  if (questionario.etapa === "objetivo") {
    const typedObjective = normalizePt(input.text);
    const objective = option === "objetivo:site" ||
        /^(?:site|visitas?)$/.test(typedObjective)
      ? "site"
      : option === "objetivo:whatsapp" ||
          /^(?:whatsapp|conversas?)$/.test(typedObjective)
      ? "whatsapp"
      : null;
    if (!objective) return { handled: true, ...metaAdsQuestionarioPrompt(questionario) };
    if (objective === "site") {
      await update({ objetivo: objective, etapa: "url_site" });
    } else {
      const packages = await metaAdsQuestionarioInteresses(integration!, input.userId);
      await update({
        objetivo: objective,
        publicos_sugeridos: packages,
        etapa: "publico",
      });
    }
  } else if (questionario.etapa === "url_site") {
    let url = "";
    try {
      const parsed = new URL(input.text.trim());
      if (parsed.protocol === "https:") url = parsed.toString();
    } catch { /* mensagem abaixo */ }
    if (!url) return { handled: true, text: "Envie uma URL pública completa começando com https://." };
    const packages = await metaAdsQuestionarioInteresses(integration!, input.userId);
    await update({
      destination_url: url,
      publicos_sugeridos: packages,
      etapa: "publico",
    });
  } else if (questionario.etapa === "publico") {
    const key = option.replace("publico:", "");
    if (key === "amplo" || normalizePt(input.text) === "publico amplo") {
      await update({ pacote_publico: "Público amplo", interesses: [], etapa: "cidade" });
    } else {
      const index = Number(key);
      const pacote = questionario.publicos_sugeridos?.[index];
      if (!pacote) return { handled: true, ...metaAdsQuestionarioPrompt(questionario) };
      await update({
        pacote_publico: pacote.nome,
        interesses: pacote.interesses,
        etapa: "cidade",
      });
    }
  } else if (questionario.etapa === "cidade") {
    try {
      const result = await metaAdsGraph(integration!, "search", {
        params: {
          type: "adgeolocation",
          location_types: JSON.stringify(["city"]),
          q: input.text.trim(),
          country_code: "BR",
          locale: "pt_BR",
          limit: "3",
        },
      });
      const cities = (result?.data ?? []).map((item: any) => ({
        id: String(item.key ?? item.id ?? ""),
        name: [item.name, item.region].filter(Boolean).join(" - "),
      })).filter((city: any) => city.id && city.name).slice(0, 3);
      if (!cities.length) {
        return { handled: true, text: "Não encontrei essa cidade na Meta. Digite o nome e o estado, por exemplo: Niterói, RJ." };
      }
      await update({ cidades_encontradas: cities, etapa: "confirmar_cidade" });
    } catch (error) {
      return { handled: true, text: metaAdsSafeError(error) };
    }
  } else if (questionario.etapa === "confirmar_cidade") {
    const index = Number(option.replace("cidade:", ""));
    const city = questionario.cidades_encontradas?.[index];
    if (!city) return { handled: true, ...metaAdsQuestionarioPrompt(questionario) };
    await update({ cidade: city, etapa: "raio" });
  } else if (questionario.etapa === "raio") {
    const radius = Number(
      option.replace("raio:", "") ||
        input.text.replace(/\D/g, ""),
    );
    if (![10, 25, 40].includes(radius)) {
      return { handled: true, ...metaAdsQuestionarioPrompt(questionario) };
    }
    await update({ raio_km: radius, etapa: "idade" });
  } else if (questionario.etapa === "idade") {
    const value = option.replace("idade:", "") ||
      normalizePt(input.text).replace(/\s*(?:–|\ba\b)\s*/g, "-");
    if (value === "outra") {
      await update({ etapa: "idade_personalizada" });
    } else {
      const match = value.match(/^(\d{2})-(\d{2})$/);
      if (!match) return { handled: true, ...metaAdsQuestionarioPrompt(questionario) };
      await update({
        age_min: Number(match[1]),
        age_max: Number(match[2]),
        etapa: "orcamento",
      });
    }
  } else if (questionario.etapa === "idade_personalizada") {
    const match = input.text.match(/\b(\d{2})\s*[-–a]\s*(\d{2})\b/i);
    const minimum = Number(match?.[1]);
    const maximum = Number(match?.[2]);
    if (!match || minimum < 18 || maximum > 65 || minimum > maximum) {
      return { handled: true, text: "Digite uma faixa válida entre 18 e 65 anos, por exemplo: 30-55." };
    }
    await update({ age_min: minimum, age_max: maximum, etapa: "orcamento" });
  } else if (questionario.etapa === "orcamento") {
    if (option === "budget:mudar") {
      return {
        handled: true,
        text: "Digite o novo orçamento diário em reais.",
      };
    }
    if (option === "budget:aumentar_limite") {
      return {
        handled: true,
        text:
          "Qual deve ser o novo limite mensal de anúncios? Digite um valor entre R$ 50 e R$ 10.000.",
        requestLimitValue: true,
      };
    }
    const amount = Number(
      (option.replace("orcamento:", "") || input.text).replace(/[^\d,.-]/g, "")
        .replace(",", "."),
    );
    if (!Number.isFinite(amount) || amount < 1) {
      return { handled: true, text: "Digite um orçamento diário válido, por exemplo: 20." };
    }
    let availability;
    try {
      availability = await loadMetaAdsMonthlyAvailability(integration!, input.userId);
    } catch (error) {
      return { handled: true, text: metaAdsSafeError(error) };
    }
    const minimumBudget = avaliarMetaAdsOrcamentoMinimo({
      daily: amount,
      available: availability.available,
    });
    const available = minimumBudget.available;
    if (minimumBudget.exhausted) {
      return {
        handled: true,
        text: `O limite mensal está esgotado: há apenas ${metaAdsBrl(available)} disponíveis, menos que o mínimo de R$ 1,00 por dia durante 7 dias. Nenhum anúncio foi publicado.`,
        interactiveButtons: metaAdsBudgetRecoveryButtons(true),
      };
    }
    const maxDaily = minimumBudget.maximumDaily;
    if (!minimumBudget.ok) {
      return {
        handled: true,
        text: `Com ${metaAdsBrl(available)} disponíveis, o orçamento diário máximo que cabe em 7 dias é ${metaAdsBrl(maxDaily)}. Digite um valor de até ${metaAdsBrl(maxDaily)}.`,
        interactiveButtons: metaAdsBudgetRecoveryButtons(false),
      };
    }
    await update({ orcamento_diario: amount, etapa: "duracao" });
    return {
      handled: true,
      ...metaAdsQuestionarioPrompt(questionario, available),
    };
  } else if (questionario.etapa === "duracao") {
    if (option === "budget:mudar") {
      await update(voltarMetaAdsQuestionarioParaOrcamento(questionario));
      return {
        handled: true,
        text: "Digite o novo orçamento diário em reais.",
      };
    }
    if (option === "budget:aumentar_limite") {
      return {
        handled: true,
        text:
          "Qual deve ser o novo limite mensal de anúncios? Digite um valor entre R$ 50 e R$ 10.000.",
        requestLimitValue: true,
      };
    }
    const duration = Number(
      option.replace("duracao:", "") ||
        input.text.replace(/\D/g, ""),
    );
    if (![7, 15, 30].includes(duration)) {
      return { handled: true, ...metaAdsQuestionarioPrompt(questionario) };
    }
    let availability;
    try {
      availability = await loadMetaAdsMonthlyAvailability(integration!, input.userId);
    } catch (error) {
      return { handled: true, text: metaAdsSafeError(error) };
    }
    const budget = metaAdsQuestionarioBudget({
      daily: questionario.orcamento_diario,
      duration,
      available: availability.available,
    });
    if (!budget.ok) {
      const available = availability.available;
      const exhausted = available < 7;
      const maxDaily = metaAdsMaximoDiarioParaSeteDias(available);
      return {
        handled: true,
        text: exhausted
          ? `O limite mensal está esgotado: há apenas ${metaAdsBrl(available)} disponíveis, menos que o mínimo de R$ 1,00 por dia durante 7 dias. Nenhum anúncio foi publicado.`
          : `Esse anúncio pode gastar ${metaAdsBrl(budget.maximumSpend)}, mas há ${metaAdsBrl(available)} disponíveis no teto mensal. O orçamento diário máximo que cabe em 7 dias é ${metaAdsBrl(maxDaily)}.`,
        interactiveButtons: metaAdsBudgetRecoveryButtons(exhausted),
      };
    }
    await update({ duracao_dias: duration, etapa: "midia" });
    const midias = await metaAdsQuestionarioMidias(input.userId);
    return {
      handled: true,
      ...metaAdsQuestionarioPrompt(questionario),
      interactiveList: midias.length
        ? questionarioList({
          body: "Escolha uma mídia:",
          rows: midias.map((media) => ({
            id: `meta_ads_q:midia:${media.id}`,
            title: media.titulo,
            description: media.tipo === "video" ? "Vídeo" : "Imagem",
          })),
        })
        : undefined,
    };
  } else if (questionario.etapa === "midia") {
    const midias = await metaAdsQuestionarioMidias(input.userId);
    const mediaId = option.replace("midia:", "");
    const selected = midias.find((media) => media.id === mediaId);
    if (!selected) {
      return {
        handled: true,
        ...metaAdsQuestionarioPrompt(questionario),
        interactiveList: midias.length
          ? questionarioList({
            body: "Escolha uma mídia:",
            rows: midias.map((media) => ({
              id: `meta_ads_q:midia:${media.id}`,
              title: media.titulo,
              description: media.tipo === "video" ? "Vídeo" : "Imagem",
            })),
          })
          : undefined,
      };
    }
    const copy = await metaAdsQuestionarioGerarTexto(input.userId, questionario);
    if (!copy) {
      await update({ midia: selected, etapa: "texto_manual" });
      return {
        handled: true,
        text: "Não há informações suficientes da empresa para criar um texto sem inventar. Envie o título na primeira linha e o texto principal nas linhas seguintes.",
      };
    }
    await update({
      midia: selected,
      titulo: copy.titulo,
      texto_principal: copy.texto,
      etapa: "texto",
    });
  } else if (questionario.etapa === "texto") {
    const action = option.replace("texto:", "") || normalizePt(input.text)
      .replace("eu escrevo", "manual");
    if (action === "manual") {
      await update({ etapa: "texto_manual" });
    } else if (action === "reescrever") {
      const copy = await metaAdsQuestionarioGerarTexto(input.userId, questionario);
      if (!copy) return { handled: true, text: "Não consegui reescrever agora. Você pode escolher “Eu escrevo”." };
      await update({ titulo: copy.titulo, texto_principal: copy.texto });
    } else if (action === "aprovar") {
      const resumoHash = metaAdsQuestionarioResumoHash(questionario);
      await update({ etapa: "resumo", resumo_hash: resumoHash });
      const fullDraft = metaAdsDraftDoQuestionario(questionario, {
        conversationId: input.conversationId,
        ownerPhone: input.fromNumber,
      });
      await sb.from("meta_ads_campanhas").update({
        rascunho: fullDraft,
        orcamento_diario: fullDraft.daily_budget,
        duracao_dias: fullDraft.duration_days,
        gasto_maximo: metaAdsMaximumSpend(fullDraft),
        atualizado_em: now,
      }).eq("id", row.id).eq("user_id", input.userId).eq("status", "rascunho");
      return {
        handled: true,
        ...metaAdsQuestionarioPrompt(questionario),
        summaryDraftId: row.id,
      };
    } else return { handled: true, ...metaAdsQuestionarioPrompt(questionario) };
  } else if (questionario.etapa === "texto_manual") {
    const lines = input.text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
    if (lines.length < 2) {
      return { handled: true, text: "Envie o título na primeira linha e o texto principal a partir da segunda linha." };
    }
    await update({
      titulo: lines[0].slice(0, 255),
      texto_principal: lines.slice(1).join("\n").slice(0, 2_000),
      etapa: "texto",
    });
  } else if (questionario.etapa === "resumo") {
    if (option === "ajustar") {
      return {
        handled: true,
        text: "O que você quer ajustar?",
        interactiveList: questionarioList({
          body: "Escolha uma etapa:",
          rows: [
            ["publico", "Público"],
            ["cidade", "Cidade e raio"],
            ["idade", "Idade"],
            ["orcamento", "Orçamento e duração"],
            ["midia", "Mídia"],
            ["texto", "Texto"],
          ].map(([stage, title]) => ({
            id: `meta_ads_q:ajustar:${stage}`,
            title,
          })),
        }),
      };
    }
    if (option.startsWith("ajustar:")) {
      const selected = option.slice("ajustar:".length);
      const stage = selected === "publico" || selected === "cidade" ||
          selected === "idade" || selected === "orcamento" ||
          selected === "midia" || selected === "texto"
        ? selected
        : null;
      if (!stage) return { handled: true, ...metaAdsQuestionarioPrompt(questionario) };
      await update({ etapa: stage });
    } else if (option.startsWith("publicar:")) {
      const hash = option.slice("publicar:".length);
      if (!hash || hash !== questionario.resumo_hash ||
        hash !== metaAdsQuestionarioResumoHash(questionario)) {
        return { handled: true, text: "O resumo mudou ou expirou. Revise a campanha antes de publicar." };
      }
      const publishResult = await toolPublicarAnuncioMeta({
        confirmacao: "SIM",
        rascunho_id: row.id,
      }, ctx);
      if (publishResult.startsWith("✅")) {
        return { handled: true, text: publishResult };
      }
      const retryPrompt = metaAdsQuestionarioPrompt(questionario);
      return {
        handled: true,
        ...retryPrompt,
        text: `${publishResult}\n\n${retryPrompt.text}`,
        summaryDraftId: row.id,
      };
    } else return { handled: true, ...metaAdsQuestionarioPrompt(questionario) };
  }
  return { handled: true, ...metaAdsQuestionarioPrompt(questionario) };
}

async function findMetaAdsCampaign(
  reference: unknown,
  ctx: MetaAdsToolContext,
): Promise<any | null> {
  let query = sb
    .from("meta_ads_campanhas")
    .select("id, campaign_id, adset_id, ad_id, rascunho, status, gasto_maximo, aprovado_em, duracao_dias, criado_em")
    .eq("user_id", ctx.userId)
    .not("campaign_id", "is", null);
  const value = String(reference ?? "").trim();
  if (value) {
    query = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value)
      ? query.eq("id", value)
      : query.eq("campaign_id", value);
  } else {
    query = query.order("criado_em", { ascending: false }).limit(1);
  }
  const { data, error } = await query.maybeSingle();
  return error ? null : data;
}

async function toolAlterarStatusCampanhaMeta(
  status: "ACTIVE" | "PAUSED" | null,
  args: Record<string, unknown>,
  ctx: MetaAdsToolContext,
): Promise<string> {
  if (!isOwner(ctx)) return "Essa ferramenta é restrita ao responsável da conta.";
  const campaign = await findMetaAdsCampaign(args?.campanha_id, ctx);
  if (!campaign?.campaign_id) {
    return "Não encontrei essa campanha Meta Ads nesta conta.";
  }
  if (
    status === "ACTIVE" &&
    isMetaAdsCampaignEnded({
      approvedAt: campaign.aprovado_em,
      durationDays: campaign.duracao_dias,
    })
  ) {
    return "Campanha encerrada. Crie uma nova campanha.";
  }
  const integration = await loadMetaAdsIntegration(ctx.userId);
  const integrationProblem = metaAdsIntegrationProblem(integration);
  if (integrationProblem || !integration) return integrationProblem!;
  try {
    if (status === "ACTIVE") {
      const availability = await loadMetaAdsMonthlyAvailability(
        integration,
        ctx.userId,
      );
      const insights = await metaAdsGraph(
        integration,
        `${campaign.campaign_id}/insights`,
        { params: { fields: "spend", date_preset: "maximum", limit: "1" } },
      );
      const reactivation = checkMetaAdsReactivationAvailability({
        maximumSpend: campaign.gasto_maximo,
        lifetimeSpent: insights?.data?.[0]?.spend,
        available: availability.available,
      });
      if (!reactivation.ok) {
        return `Não reativei: esta campanha ainda pode gastar até ${metaAdsBrl(reactivation.requested)}, mas restam ${metaAdsBrl(reactivation.available)} no teto mensal de ${metaAdsBrl(availability.cap)}.`;
      }
    }
    let result: any;
    if (status) {
      const ids = status === "ACTIVE"
        ? [campaign.ad_id, campaign.adset_id, campaign.campaign_id]
        : [campaign.campaign_id];
      for (const graphId of ids.filter(Boolean)) {
        result = await metaAdsGraph(integration, String(graphId), {
          method: "POST",
          params: { status },
        });
      }
    } else {
      result = await metaAdsGraph(integration, campaign.campaign_id, {
        params: { fields: "id,name,status,effective_status" },
      });
    }
    if (status) {
      const { data: saved, error: saveError } = await sb.from(
        "meta_ads_campanhas",
      ).update({
        status: status === "PAUSED" ? "pausado" : "publicado",
        atualizado_em: new Date().toISOString(),
      }).eq("id", campaign.id).eq("user_id", ctx.userId)
        .select("id").maybeSingle();
      if (saveError || !saved) {
        return "A Meta alterou a campanha, mas não consegui salvar o novo status local. Verifique antes de tentar novamente.";
      }
      return status === "PAUSED"
        ? `⏸️ Campanha ${campaign.campaign_id} pausada.`
        : `▶️ Campanha ${campaign.campaign_id} ativada.`;
    }
    return [
      `Campanha: ${result?.name || campaign.rascunho?.name || campaign.campaign_id}`,
      `ID: ${campaign.campaign_id}`,
      `Status configurado: ${result?.status || campaign.status}`,
      `Status efetivo: ${result?.effective_status || "não informado"}`,
    ].join("\n");
  } catch (error) {
    return metaAdsSafeError(error);
  }
}

async function toolMetricasAmz(ctx: { userId: string; fromNumber: string }): Promise<string> {
  if (!hasAmzGlobalToolAccess(ctx)) return JSON.stringify({ erro: "ferramenta_restrita" });
  try {
    const { count: totalClientes } = await sb.from("billing_customers").select("*", { count: "exact", head: true });
    const { count: ativas } = await sb.from("billing_subscriptions").select("*", { count: "exact", head: true }).eq("status", "authorized");
    const { count: pausadas } = await sb.from("billing_subscriptions").select("*", { count: "exact", head: true }).in("status", ["paused", "cancelled"]);
    const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
    const { data: txs } = await sb.from("billing_transactions").select("amount").eq("status", "approved").gte("payment_date", monthStart.toISOString());
    const faturamentoMes = (txs ?? []).reduce((s, t: any) => s + Number(t.amount || 0), 0);
    const yStart = new Date(Date.now() - 86400000); yStart.setUTCHours(0, 0, 0, 0);
    const yEnd = new Date(yStart.getTime() + 86400000);
    const { data: txsY } = await sb.from("billing_transactions").select("amount").eq("status", "approved").gte("payment_date", yStart.toISOString()).lt("payment_date", yEnd.toISOString());
    const faturamentoOntem = (txsY ?? []).reduce((s, t: any) => s + Number(t.amount || 0), 0);
    return JSON.stringify({ clientes_total: totalClientes, assinaturas_ativas: ativas, pausadas_ou_canceladas: pausadas, faturamento_mes_atual: faturamentoMes, faturamento_ontem: faturamentoOntem });
  } catch (e) { return JSON.stringify({ erro: String((e as Error).message) }); }
}

async function toolInadimplentesAmz(ctx: { userId: string; fromNumber: string }): Promise<string> {
  if (!hasAmzGlobalToolAccess(ctx)) return JSON.stringify({ erro: "ferramenta_restrita" });
  try {
    const { data } = await sb.from("billing_subscriptions")
      .select("id, status, amount, next_billing_date, payment_fail_count, customer_id, billing_customers(name, trade_name, phone, email)")
      .or("status.eq.overdue,payment_fail_count.gte.1")
      .order("payment_fail_count", { ascending: false }).limit(20);
    return JSON.stringify({ total: (data ?? []).length, inadimplentes: (data ?? []).map((s: any) => ({
      nome: s.billing_customers?.trade_name || s.billing_customers?.name, telefone: s.billing_customers?.phone, email: s.billing_customers?.email,
      valor: s.amount, vencimento: s.next_billing_date, falhas: s.payment_fail_count, status: s.status,
    })) });
  } catch (e) { return JSON.stringify({ erro: String((e as Error).message) }); }
}

async function toolStatusPlataforma(ctx: { userId: string; fromNumber: string }): Promise<string> {
  if (!hasAmzGlobalToolAccess(ctx)) return JSON.stringify({ erro: "ferramenta_restrita" });
  try {
    const { data } = await sb.from("edge_functions_health").select("function_name, status, last_check, last_error, consecutive_failures, is_critical")
      .order("consecutive_failures", { ascending: false }).limit(50);
    const problemas = (data ?? []).filter((f: any) => f.status !== "healthy" && f.status !== "online");
    return JSON.stringify({ total_monitoradas: (data ?? []).length, com_problema: problemas.length, criticas_offline: problemas.filter((p: any) => p.is_critical), avisos: problemas.slice(0, 15) });
  } catch (e) { return JSON.stringify({ erro: String((e as Error).message) }); }
}

async function toolCriarCobrancaAmz(args: { cliente: string; valor?: number }, ctx: { userId: string; fromNumber: string }): Promise<string> {
  if (!hasAmzGlobalToolAccess(ctx)) return JSON.stringify({ erro: "ferramenta_restrita" });
  const nome = (args?.cliente || "").trim();
  if (!nome) return JSON.stringify({ erro: "cliente_obrigatorio" });
  try {
    const { data: customers } = await sb.from("billing_customers")
      .select("id, name, trade_name, email, phone")
      .or(`name.ilike.%${nome}%,trade_name.ilike.%${nome}%,email.ilike.%${nome}%`).limit(3);
    if (!customers?.length) return JSON.stringify({ erro: "cliente_nao_encontrado", busca: nome });
    if (customers.length > 1) return JSON.stringify({ erro: "multiplos_clientes", candidatos: customers.map((c: any) => c.trade_name || c.name) });
    const c = customers[0];
    const r = await fetch(`${SUPABASE_URL}/functions/v1/pietro-criar-cobranca`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SERVICE_KEY}`, "apikey": SERVICE_KEY },
      body: JSON.stringify({
        nome: c.trade_name || c.name,
        whatsapp: c.phone || undefined,
        email: c.email || undefined,
        valor: args?.valor ?? 597,
      }),
    });
    const txt = await r.text();
    if (!r.ok) return JSON.stringify({ erro: `cobranca_falhou ${r.status}`, detalhe: txt.slice(0, 200) });
    let payload: any = null;
    try { payload = JSON.parse(txt); } catch { /* tratado abaixo */ }
    if (payload?.success !== true || !payload?.subscription_id || !payload?.payment_link) {
      return JSON.stringify({
        erro: "cobranca_sem_confirmacao",
        detalhe: String(payload?.error || txt || "resposta sem subscription_id/payment_link").slice(0, 300),
      });
    }
    return JSON.stringify({
      ok: true,
      cliente: c.trade_name || c.name,
      valor: args?.valor ?? 597,
      subscription_id: payload.subscription_id,
      payment_link: payload.payment_link,
    });
  } catch (e) { return JSON.stringify({ erro: String((e as Error).message) }); }
}


// ---- CONSCIÊNCIA DA PLATAFORMA (dono vê tudo, cliente só o próprio) ----
async function resolveScope(ctx: { userId: string; fromNumber: string }): Promise<{ scopeUserId: string | null; isAdmin: boolean }> {
  return resolveTenantToolScope({
    userId: ctx.userId,
    isOwner: isOwner(ctx),
    adminAmzUserId: ADMIN_AMZ_USER_ID,
  });
}

async function toolConsultarEstoque(query: string, ctx: { userId: string; fromNumber: string }): Promise<string> {
  const q = (query || "").trim();
  const { isAdmin } = await resolveScope(ctx);
  try {
    // SEMPRE filtra pelo user_id do próprio dono da conta.
    // Mesmo sendo admin, o Jarvis só enxerga o catálogo do Felicio — nunca mistura com clientes.
    let p = sb.from("produtos").select("id, nome, categoria, preco, estoque, ativo, link, descricao, imagem_url, imagens, descricao_visual").eq("user_id", ctx.userId).limit(20);
    if (q) p = p.or(`nome.ilike.%${q}%,descricao.ilike.%${q}%,categoria.ilike.%${q}%,tags.ilike.%${q}%`);
    const { data: prods } = await p;

    let s = sb.from("products_stock").select("name, category, price, qty, active").eq("user_id", ctx.userId).limit(20);
    if (q) s = s.or(`name.ilike.%${q}%,category.ilike.%${q}%,sku.ilike.%${q}%`);
    const { data: stock } = await s;

    const { count: totalOwn } = await sb.from("produtos").select("*", { count: "exact", head: true }).eq("user_id", ctx.userId);
    const { count: ativosOwn } = await sb.from("produtos").select("*", { count: "exact", head: true }).eq("user_id", ctx.userId).eq("ativo", true);

    return JSON.stringify({
      escopo: "somente_meu_catalogo",
      busca: q || "(sem filtro)",
      meu_catalogo_total: totalOwn ?? 0,
      meu_catalogo_ativos: ativosOwn ?? 0,
      observacao: "Estes números refletem APENAS o catálogo do dono da conta (expo@atombrasildigital.com). Nunca inclua produtos de outros clientes da plataforma. Se o usuário perguntar 'quantos produtos temos', responda com meu_catalogo_total.",
      observacao_estoque: "Produtos afiliados não têm estoque físico rastreado. Não reporte 'estoque zerado' a menos que o usuário pergunte especificamente sobre um SKU físico em products_stock.",
      encontrados_produtos: (prods ?? []).map((r: any) => ({
        nome: r.nome,
        categoria: r.categoria,
        preco: r.preco,
        ativo: r.ativo,
        link: r.link,
        descricao: (r.descricao || "").slice(0, 300) || null,
        tem_foto: !!(r.imagem_url || primeiraImagemProduto(r)),
      })),
      dica_visao: "Se o cliente demonstrar interesse REAL em um produto (pediu detalhes, perguntou preço/cor, ou você vai enviar a oferta), chame ver_produto(produto) UMA vez pra ENXERGAR a foto dele antes de descrever. Não chame ver_produto pra produtos que ninguém pediu.",
      encontrados_stock_fisico: (stock ?? []).map((r: any) => ({ nome: r.name, categoria: r.category, preco: r.price, qtd: r.qty, ativo: r.active })),
    });
  } catch (e) { return JSON.stringify({ erro: String((e as Error).message) }); }
}



async function toolConsultarCampanhas(ctx: { userId: string; fromNumber: string }): Promise<string> {
  const { scopeUserId, isAdmin } = await resolveScope(ctx);
  try {
    let c = sb.from("campanhas_recorrentes").select("id, nome, ativa, frequencia, proxima_execucao, ultima_execucao, total_enviados, status").order("proxima_execucao", { ascending: true }).limit(15);
    if (scopeUserId) c = c.eq("user_id", scopeUserId);
    const { data: camps } = await c;

    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    let h = sb.from("historico_envios").select("*", { count: "exact", head: true }).gte("created_at", since);
    if (scopeUserId) h = h.eq("user_id", scopeUserId);
    const { count: envios24h } = await h;

    let f = sb.from("fila_atendimento_pj").select("status", { count: "exact", head: false }).limit(1000);
    if (scopeUserId) f = f.eq("user_id", scopeUserId);
    const { data: fila } = await f;
    const filaStats = { pendente: 0, processando: 0, enviado: 0, falhou: 0 };
    (fila ?? []).forEach((r: any) => { if (filaStats[r.status as keyof typeof filaStats] !== undefined) filaStats[r.status as keyof typeof filaStats]++; });

    return JSON.stringify({
      escopo: isAdmin ? "admin_global" : "usuario",
      total_campanhas: (camps ?? []).length,
      campanhas_ativas: (camps ?? []).filter((c: any) => c.ativa).length,
      envios_ultimas_24h: envios24h ?? 0,
      fila_whatsapp: filaStats,
      campanhas: camps ?? [],
    });
  } catch (e) { return JSON.stringify({ erro: String((e as Error).message) }); }
}

async function toolConsultarAutopilot(ctx: { userId: string; fromNumber: string }): Promise<string> {
  const { scopeUserId, isAdmin } = await resolveScope(ctx);
  try {
    let a = sb.from("autopilot_config").select("id, nome, ativo, posts_por_dia, postar_facebook, postar_instagram, horario_inicio, horario_fim, total_publicados, ultima_execucao, proxima_execucao");
    if (scopeUserId) a = a.eq("user_id", scopeUserId);
    const { data: cfgs } = await a;

    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    let q = sb.from("social_posts_queue").select("platform, status", { count: "exact", head: false }).gte("created_at", since).limit(1000);
    if (scopeUserId) q = q.eq("user_id", scopeUserId);
    const { data: posts } = await q;
    const stats: Record<string, { total: number; published: number; failed: number; pending: number }> = {};
    (posts ?? []).forEach((r: any) => {
      const p = r.platform || "unknown";
      if (!stats[p]) stats[p] = { total: 0, published: 0, failed: 0, pending: 0 };
      stats[p].total++;
      if (r.status === "published") stats[p].published++;
      else if (r.status === "failed") stats[p].failed++;
      else if (r.status === "pending" || r.status === "scheduled") stats[p].pending++;
    });

    return JSON.stringify({
      escopo: isAdmin ? "admin_global" : "usuario",
      total_configs: (cfgs ?? []).length,
      configs_ativas: (cfgs ?? []).filter((c: any) => c.ativo).length,
      posts_ultimas_24h_por_rede: stats,
      configuracoes: cfgs ?? [],
    });
  } catch (e) { return JSON.stringify({ erro: String((e as Error).message) }); }
}

async function toolConsultarClientesLeads(ctx: { userId: string; fromNumber: string }): Promise<string> {
  const { scopeUserId, isAdmin } = await resolveScope(ctx);
  try {
    let c = sb.from("clientes").select("*", { count: "exact", head: true }).eq("ativo", true);
    if (scopeUserId) c = c.eq("user_id", scopeUserId);
    const { count: clientesAtivos } = await c;

    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    let cn = sb.from("clientes").select("*", { count: "exact", head: true }).gte("created_at", since);
    if (scopeUserId) cn = cn.eq("user_id", scopeUserId);
    const { count: novos7d } = await cn;

    let lb = sb.from("leads_b2b").select("*", { count: "exact", head: true });
    if (scopeUserId) lb = lb.eq("user_id", scopeUserId);
    const { count: leadsB2b } = await lb;

    let lc = sb.from("leads_b2c").select("*", { count: "exact", head: true });
    if (scopeUserId) lc = lc.eq("user_id", scopeUserId);
    const { count: leadsB2c } = await lc;

    // Leads captados pelo próprio JARVIS no WhatsApp (SDR)
    let jarvisLeads: any[] = [];
    try {
      let jl = sb
        .from("jarvis_leads")
        .select("nome, empresa, ramo, interesse, telefone, created_at")
        .order("created_at", { ascending: false })
        .limit(15);
      if (scopeUserId) jl = jl.eq("user_id", scopeUserId);
      const { data } = await jl;
      jarvisLeads = data ?? [];
    } catch (e) {
      console.warn("[consultar_clientes_leads] jarvis_leads falhou:", (e as Error).message);
    }

    return JSON.stringify({
      escopo: isAdmin ? "admin_global" : "usuario",
      clientes_ativos: clientesAtivos ?? 0,
      novos_clientes_7d: novos7d ?? 0,
      leads_b2b: leadsB2b ?? 0,
      leads_b2c: leadsB2c ?? 0,
      leads_captados_pelo_assistente: jarvisLeads,
    });

  } catch (e) { return JSON.stringify({ erro: String((e as Error).message) }); }
}

async function toolResumoPlataforma(ctx: { userId: string; fromNumber: string }): Promise<string> {
  try {
    const [estoque, campanhas, autopilot, leads] = await Promise.all([
      toolConsultarEstoque("", ctx),
      toolConsultarCampanhas(ctx),
      toolConsultarAutopilot(ctx),
      toolConsultarClientesLeads(ctx),
    ]);
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      estoque: JSON.parse(estoque),
      campanhas: JSON.parse(campanhas),
      autopilot: JSON.parse(autopilot),
      clientes_leads: JSON.parse(leads),
    });
  } catch (e) { return JSON.stringify({ erro: String((e as Error).message) }); }
}


// ---- Visão: descreve o que aparece em uma imagem (produto, cena, cores, texto visível) ----
// Usado antes de gerar copy pra redes sociais, pra que a legenda case com a foto do dono.
async function descreverImagemVisao(imageUrl: string): Promise<string> {
  const prompt = "Você é um leitor de imagens PRECISO. Descreva EXATAMENTE o que aparece nesta imagem em 2-4 frases, como se estivesse instruindo um copywriter que NÃO vai ver a foto. OBRIGATÓRIO: 1) Se houver QUALQUER texto/palavra/número na imagem (títulos, marcas, preços, slogans, logos, cards, banners, prints de tela), TRANSCREVA literalmente as palavras principais entre aspas. 2) Diga o tipo de imagem (foto real de produto / print de tela / arte gráfica / banner / card promocional / meme / captura de app etc.). 3) Cite objeto/pessoa principal, cor dominante e cena. NUNCA invente detalhes. Se não tiver certeza, diga 'não identificado'. Português, sem markdown, sem introdução tipo 'A imagem mostra'.";
  const tryCall = async (model: string) => {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": LOVABLE_API_KEY },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          },
        ],
      }),
    });
    if (!res.ok) {
      console.warn("[visao] falhou model=", model, "status=", res.status, (await res.text()).slice(0, 200));
      return "";
    }
    const data = await res.json();
    return (data?.choices?.[0]?.message?.content || "").trim().slice(0, 800);
  };
  try {
    // Modelo novo primeiro (mais preciso em OCR/leitura de arte). Fallback pro 2.5-pro.
    let out = await tryCall("google/gemini-3-flash-preview");
    if (!out) out = await tryCall("google/gemini-3.6-flash");
    if (!out) out = await tryCall("google/gemini-3.1-pro-preview");
    console.log("[visao] descricao=", out.slice(0, 200));
    return out;
  } catch (e) {
    console.warn("[visao] erro:", (e as Error).message);
    return "";
  }
}

async function detectarCaixaProdutoVisao(
  imageUrl: string,
): Promise<FotoBox | null> {
  const prompt =
    'Localize o objeto ou veículo principal desta foto. Responda SOMENTE JSON no formato {"box_2d":[ymin,xmin,ymax,xmax]}, com coordenadas normalizadas de 0 a 1000. A caixa deve incluir o objeto inteiro, inclusive rodas, retrovisores e sombra visível. Se não houver um único objeto principal identificável, responda {"box_2d":null}.';
  for (
    const model of [
      "google/gemini-3-flash-preview",
      "google/gemini-3.6-flash",
    ]
  ) {
    try {
      const response = await fetch(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Lovable-API-Key": LOVABLE_API_KEY,
          },
          body: JSON.stringify({
            model,
            temperature: 0,
            messages: [{
              role: "user",
              content: [
                { type: "text", text: prompt },
                { type: "image_url", image_url: { url: imageUrl } },
              ],
            }],
          }),
          signal: AbortSignal.timeout(20_000),
        },
      );
      if (!response.ok) continue;
      const data = await response.json();
      const raw = String(data?.choices?.[0]?.message?.content || "");
      const box = parseFotoBoxFromVisionResponse(raw);
      if (box) return box;
    } catch (error) {
      console.warn(
        "[criar_anuncio][foto-box]",
        model,
        (error as Error).message,
      );
    }
  }
  return null;
}



// ---- VISÃO DO CATÁLOGO (sob demanda) ----
// Retorna a 1ª imagem utilizável de um produto (imagem_url ou array imagens).
function primeiraImagemProduto(r: any): string | null {
  if (r?.imagem_url && String(r.imagem_url).startsWith("http")) return String(r.imagem_url);
  let arr = r?.imagens;
  if (typeof arr === "string") { try { arr = JSON.parse(arr); } catch { arr = [arr]; } }
  if (Array.isArray(arr)) {
    const u = arr.find((x: any) => typeof x === "string" && x.startsWith("http"));
    if (u) return u as string;
  }
  return null;
}

// Cache de descrições visuais por URL (vive no isolate). Evita pagar visão 2x pelo mesmo produto.
const visaoProdutoCache = new Map<string, string>();
async function descreverProdutoCacheado(url: string): Promise<string> {
  const hit = visaoProdutoCache.get(url);
  if (hit) { console.log("[visao-produto] cache hit"); return hit; }
  const desc = await descreverImagemVisao(url);
  if (desc) visaoProdutoCache.set(url, desc);
  return desc;
}

// ver_produto: SOB DEMANDA. Só roda quando o agente vai realmente falar/oferecer aquele produto.
// entregar_ebook_presente: entrega o ebook DO TENANT + confirma o opt-in.
// Guardrail: 1x por contato (tenant_ebook_entregas tem UNIQUE user_id+telefone).
async function toolEntregarEbook(ctx: { userId: string; fromNumber: string }): Promise<string> {
  try {
    const ebook = await getTenantEbook(sb, ctx.userId);
    if (!ebook) return JSON.stringify({ ok: false, motivo: "este negócio não tem ebook de presente configurado" });

    const entrega = await getEntregaEbook(sb, ctx.userId, ctx.fromNumber);
    if (entrega?.status === "entregue") {
      return JSON.stringify({ ok: false, motivo: "esse contato já recebeu o ebook — não ofereça de novo" });
    }
    if (entrega?.status === "recusado") {
      return JSON.stringify({ ok: false, motivo: "esse contato já recusou — nunca ofereça de novo" });
    }

    const r = await entregarEbookTenant({
      sb,
      userId: ctx.userId,
      telefone: ctx.fromNumber,
      origem: "agente_janela_24h",
      supabaseUrl: SUPABASE_URL,
      serviceKey: SERVICE_KEY,
    });

    if (r.enviado) {
      // Confirma a autorização de receber ofertas (opt-in) junto da entrega.
      const nowIso = new Date().toISOString();
      const { data: membros } = await sb
        .from("pj_lista_membros")
        .select("id, opt_in_status")
        .eq("user_id", ctx.userId)
        .eq("telefone", ctx.fromNumber);

      const jaRecusado = (membros || []).some((m: any) => m.opt_in_status === "recusado");
      if (!jaRecusado) {
        if (membros && membros.length > 0) {
          await sb
            .from("pj_lista_membros")
            .update({ opt_in_status: "confirmado", opt_in_origem: "ebook_janela_24h", opt_in_em: nowIso })
            .eq("user_id", ctx.userId)
            .eq("telefone", ctx.fromNumber)
            .neq("opt_in_status", "recusado");
        } else {
          await sb.from("pj_lista_membros").insert({
            user_id: ctx.userId,
            telefone: ctx.fromNumber,
            opt_in_status: "confirmado",
            opt_in_origem: "ebook_janela_24h",
            opt_in_em: nowIso,
          });
        }
        await sb.from("opt_in_log").insert({
          user_id: ctx.userId,
          telefone: ctx.fromNumber,
          status_novo: "confirmado",
          origem: "ebook_janela_24h",
          canal: "whatsapp_cloud",
        }).then(() => {}, () => {});
        await notificarDonoOptinAceito(ctx.userId, ctx.fromNumber, null, "ebook_janela_24h");
      }


      return JSON.stringify({
        ok: true,
        ebook: ebook.nome,
        aviso: "O PDF já foi enviado por você. Só comente naturalmente que chegou, sem repetir a oferta.",
      });
    }

    return JSON.stringify({ ok: false, motivo: r.motivo ?? "não foi possível enviar agora" });
  } catch (e) {
    return JSON.stringify({ ok: false, motivo: (e as Error).message });
  }
}

async function toolVerProduto(

  args: { produto?: string; enviar_foto?: boolean },
  ctx: { userId: string; fromNumber: string },
): Promise<string> {
  const q = (args?.produto || "").trim();
  if (!q) return JSON.stringify({ erro: "informe o nome do produto" });
  try {
    const { data: prods } = await sb
      .from("produtos")
      .select("id, nome, categoria, preco, estoque, ativo, link, descricao, imagem_url, imagens, descricao_visual")
      .eq("user_id", ctx.userId)
      .or(`nome.ilike.%${q}%,descricao.ilike.%${q}%,categoria.ilike.%${q}%,tags.ilike.%${q}%`)
      .limit(3);

    const p = (prods ?? [])[0];
    if (!p) return JSON.stringify({ erro: "produto_nao_encontrado", busca: q });

    const foto = primeiraImagemProduto(p);
    // CACHE PERSISTENTE: roda a visão 1x por produto e reusa pra sempre (corta custo bruto).
    let visao = (p.descricao_visual || "").trim();
    if (!visao && foto) {
      visao = await descreverProdutoCacheado(foto);
      if (visao) {
        await sb.from("produtos")
          .update({ descricao_visual: visao })
          .eq("id", p.id)
          .eq("user_id", ctx.userId);
        console.log("[visao-produto] descricao_visual salva para", p.nome);
      }
    } else if (visao) {
      console.log("[visao-produto] cache DB hit para", p.nome);
    }

    let foto_enviada = false;
    if (args?.enviar_foto && foto) {
      const legenda = `*${p.nome}*${p.preco ? `\n💰 R$ ${Number(p.preco).toFixed(2)}` : ""}`;
      try {
        await sendWhatsApp(
          ctx.userId,
          ctx.fromNumber,
          legenda,
          foto,
          undefined,
          undefined,
          { alreadyLogged: false },
        );
        foto_enviada = true;
      } catch (e) {
        console.warn("[ver_produto] envio de foto falhou:", (e as Error).message);
      }
    }

    return JSON.stringify({
      produto: {
        nome: p.nome,
        categoria: p.categoria,
        preco: p.preco,
        descricao: (p.descricao || "").slice(0, 600) || null,
        link: p.link,
        ativo: p.ativo,
      },
      o_que_eu_vejo_na_foto: visao || "sem foto disponível — não invente detalhes visuais",
      foto_enviada,
      instrucao: "Use 'o_que_eu_vejo_na_foto' pra descrever o produto com detalhes REAIS (cor, material, acabamento, texto da embalagem). Fale como quem está com o produto na mão, conectando ao que o cliente precisa. NUNCA invente o que não está na descrição visual.",
      outros_parecidos: (prods ?? []).slice(1).map((r: any) => r.nome),
    });
  } catch (e) { return JSON.stringify({ erro: String((e as Error).message) }); }
}


// Pitch fixo da AMZ pra usar quando o post é sobre a MARCA (logo, institucional, arte da empresa).
// Evita alucinação de "produto físico" e força a copy a falar das tecnologias reais da plataforma.
const AMZ_BRAND_PITCH = AMZ_KNOWLEDGE;

// ---- CTA de WhatsApp opt-in (Feature A) ----
// Busca o número do agente DO TENANT (multi-tenant) — nunca hardcodar.
async function buscarTelefoneAgenteTenant(userId: string): Promise<string | null> {
  try {
    const { data } = await sb
      .from("whatsapp_config")
      .select("display_phone, phone_number_id")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const raw = (data?.display_phone || "").toString().replace(/\D/g, "");
    if (raw && raw.length >= 10) return raw;
    return null;
  } catch (e) {
    console.warn("[cta_whatsapp] falha buscando display_phone:", (e as Error).message);
    return null;
  }
}

function appendWhatsappCta(script: string, phoneDigits: string): string {
  if (!script || !phoneDigits) return script;
  // Sanduíche idempotente: remove QUALQUER CTA "📱 Fale comigo no WhatsApp: wa.me/..."
  // já presente (topo, meio ou fim, com qualquer número), e reaplica exatamente
  // um CTA no início e um no fim. Evita triplicação em regenerações/revisões.
  const ctaRegex = /\s*📱\s*Fale comigo no WhatsApp:\s*wa\.me\/\d+\s*/gi;
  const clean = script.replace(ctaRegex, "\n").replace(/\n{3,}/g, "\n\n").trim();
  const cta = `📱 Fale comigo no WhatsApp: wa.me/${phoneDigits}`;
  return `${cta}\n\n${clean}\n\n${cta}`;
}

// Detecta pedido explícito do dono pra incluir CTA de WhatsApp no post.
function detectWantsWhatsappCta(text: string): boolean {
  const n = normalizePt(text || "");
  if (!n) return false;
  if (/\b(com|inclui|incluir|coloca|colocar|poe|por|adiciona|adicionar)\b.*\b(meu\s+)?whats(app)?\b/.test(n)) return true;
  if (/\bcta\b.*\bwhats(app)?\b/.test(n)) return true;
  if (/\bchama\s+(no|pelo)\s+whats(app)?\b/.test(n)) return true;
  return false;
}

// =========================================================
// Postagem em redes sociais (Facebook + Instagram) via Jarvis
// =========================================================

// Gera 3 OPÇÕES (A/B/C) de post curto e engajador — mesmo estilo da plataforma /gerar-posts.
// A = direto/CTA claro | B = storytelling | C = educativo/interativo
async function gerarTresOpcoesRedeSocial(
  produto: { nome: string; descricao?: string | null; preco?: number | null; link?: string | null; categoria?: string | null; source?: string | null },
  tom: string,
  rede: "facebook" | "instagram" | "linkedin",
  ajuste?: string,
  brandContext?: string,
  briefing?: string,
): Promise<{ A: string; B: string; C: string }> {
  const tomLabel = (tom || "beneficio").toLowerCase();
  const guia: Record<string, string> = {
    urgencia: "Tom com senso de oportunidade (SEM inventar escassez de estoque, contagem regressiva ou 'acaba hoje'). Foco no valor.",
    escassez: "Tom de oportunidade real (SEM inventar 'últimas unidades' ou 'só hoje' se não estiver no briefing).",
    "black-friday": "Tom promocional festivo (só cite desconto se o preço/oferta estiver informado).",
    "prova-social": "Prova social real, sem números inventados. Se briefing citar depoimento/pessoa, use.",
    beneficio: "Foque em benefícios reais e transformação. Tom leve, conversacional.",
    institucional: "Tom institucional/agradecimento/indicação — sem pitch forçado.",
  };
  const guiaTom = guia[tomLabel] ?? guia["beneficio"];
  const preco = produto.preco ? `R$ ${Number(produto.preco).toFixed(2).replace(".", ",")}` : "";
  const limite = 600; // ← curto e engajador, como a plataforma
  const temLink = !!(produto.link && /^https?:\/\//i.test(produto.link));
  const ctaBase = rede === "linkedin"
    ? temLink
      ? `Coloque o link "${produto.link}" no fim, imediatamente antes das hashtags.`
      : "Conclua o raciocínio de forma profissional, sem inventar link nem pedir comentário artificial."
    : temLink
    ? (rede === "instagram" ? `CTA no fim: "👉 Link na bio"` : `CTA no fim: "👉 Compre aqui: ${produto.link}"`)
    : `CTA de engajamento (chama no direct/WhatsApp, "comenta EU QUERO"). NÃO invente link nem "link na bio".`;
  const networkStyle = rede === "linkedin"
    ? `- Tom profissional, claro e natural. Sem emojis, sem gírias e sem chamadas apelativas.
- Estrutura obrigatória: observação inicial → argumento útil/técnico → conclusão.
- Use exatamente 2 ou 3 hashtags relevantes no fim.
- Se houver link, ele fica no fim do texto, imediatamente antes das hashtags.`
    : `- 1ª linha impactante com emoji.
- 1-3 bullets curtos ou frases curtas de benefício (nada de parágrafo longo).
- 5-8 hashtags no fim, relevantes, separadas por espaço.`;
  const angleRules = rede === "linkedin"
    ? `- Opção A — ANÁLISE DIRETA: observação concreta, argumento e conclusão prática.
- Opção B — EXPERIÊNCIA/CONTEXTO: situação profissional ou aprendizado, argumento e conclusão.
- Opção C — PONTO DE VISTA: pergunta ou tese profissional, argumento e conclusão.`
    : `- Opção A — DIRETA/CTA: apresenta e chama pra ação (o que é + benefício-chave + CTA).
- Opção B — STORYTELLING: começa com uma cena, dor, curiosidade ou história real do contexto; termina no CTA suave.
- Opção C — INTERATIVA/EDUCATIVA: pergunta que engaja OU mini-ensinamento sobre o tema (dica, mito x verdade, "sabia que…"), com CTA leve no fim.`;

  const descLower = `${produto.nome} ${produto.descricao || ""} ${produto.categoria || ""}`.toLowerCase();
  const ehConsorcio = /consorci|consórci|carta\s+de\s+cr[eé]dito/.test(descLower);
  const regraConsorcio = ehConsorcio
    ? `\n⚠️ ESTE PRODUTO É CONSÓRCIO. PROIBIDO: "estoque limitado", "últimas unidades", "peças", "pronta-entrega". PERMITIDO: carta de crédito, contemplação, parcelas, planejamento, sonho realizado.`
    : "";

  const ehVeiculo = !ehConsorcio && /(ve[ií]culo|carro|autom[oó]vel|seminovo|semi-novo|0km|zero\s*km|hatch|sedan|suv|picape|caminhonete|moto(cicleta)?|c[aâ]mbio|automat[ií]co|flex|turbo|km\s*rodados?|[0-9]{2}\s*mil\s*km|honda|toyota|hyundai|chevrolet|volkswagen|fiat|ford|renault|nissan|jeep|bmw|mercedes|audi|peugeot|citro[eë]n|kia|mitsubishi|civic|corolla|creta|onix|hb20|gol|polo|compass|tracker|t-cross|argo|strada|hilux|ranger|s10)/i.test(descLower)
    ? `
========================================
🚗 ESTE POST É DE VEÍCULO — REGRAS ESPECIAIS (PRIORIDADE ALTA):
- O PROTAGONISTA É O CARRO. Nunca o dono da loja, nunca o cliente, nunca a AMZ.
- PROIBIDO citar nome de pessoa (ex: "Felicio", "João"), tratar o leitor pelo nome ou escrever "seu Honda Civic", "seu carro" como se ele já fosse dele. O carro está À VENDA para um novo dono.
- GLAMOUR: descreva o veículo com desejo e sofisticação — design, presença, conservação, procedência, conforto, performance, detalhes (rodas, iluminação, acabamento, interior impecável).
- PERSUASÃO: crie desejo real e sensação de oportunidade honesta ("carro assim não fica parado", "raridade nesse estado") — sem inventar estoque ou prazo.
- Use os dados técnicos informados (ano/modelo, km, câmbio, único dono, chaves, revisões, preço se houver) como PROVA de qualidade, em bullets curtos.
- CTA OBRIGATÓRIO EM CONVITE PRESENCIAL: convide para conhecer de perto — test-drive, visita à loja, "vem tomar um café com a gente e conhecer esse carro de perto", agendar horário pelo WhatsApp/direct.
- Linguagem de vitrine automotiva premium, frases curtas, sem clichê batido ("imperdível!!!").
========================================\n`
    : "";


  const brief = (briefing || "").toString().trim().slice(0, 2500);
  const blocoBriefing = brief
    ? `\n========================================
📝 TEXTO/CONTEXTO ESCRITO PELO DONO (PRIORIDADE MÁXIMA — é a MENSAGEM que ele quer comunicar):
"${brief}"

COMO USAR:
- Esta é a MENSAGEM CENTRAL do post. As 3 opções DEVEM comunicar ESTA ideia, com as palavras/argumentos dele reescritos com qualidade publicitária.
- ⚠️ REGRA SOBERANA: o ASSUNTO do post é SEMPRE o item mostrado na imagem / descrito em "Nome/tema". Se este texto do dono falar de OUTRO produto (ex: texto de um carro, mas a imagem é uma garrafa d'água), IGNORE o assunto do texto por completo e escreva sobre o item da imagem. Nunca troque o produto.
- A imagem é o VISUAL de apoio: NÃO descreva a imagem, mas o post TEM que ser coerente com o item mostrado nela (o texto do dono só define o ângulo/tom).
- Respeite o TOM e a TEMÁTICA do texto do dono (institucional, técnico, comemorativo, provocativo...). NÃO invente oferta, preço ou urgência que não esteja nele.
- Se o texto citar tecnologia, diferencial ou frase de efeito (ex: "é uma gota no oceano"), aproveite isso.
========================================\n`
    : "";

  const prompt = `Você é copywriter sênior de redes sociais. Crie 3 VARIAÇÕES CURTAS de post para ${rede.toUpperCase()} sobre o produto/tema abaixo.
${guiaTom}${regraConsorcio}${ehVeiculo}
${blocoBriefing}
DADOS:
- Nome/tema: ${produto.nome}
${produto.descricao ? `- ${brief ? "Visual de apoio (NÃO descreva, só não contrarie)" : "Contexto/imagem"}: ${produto.descricao}` : ""}
${preco ? `- Preço: ${preco}` : "- Preço: não citar valor"}
${produto.categoria ? `- Categoria: ${produto.categoria}` : ""}
${temLink ? `- Link: ${produto.link}` : "- SEM link (post de engajamento/institucional)"}

REGRAS DURAS (valem pra TODAS as 3 opções):
- Máximo ${limite} caracteres por opção (curto, direto, engajador — nada de textão).
${networkStyle}
- ${ctaBase}
- NUNCA invente: preço, desconto, "%", "só hoje", "estoque", "últimas unidades", "vagas limitadas", depoimentos, números de clientes.
- NUNCA escreva "Conteúdo da imagem", "Nesta imagem", "A arte mostra" ou qualquer descrição do visual.
- NUNCA cite o nome do dono/anunciante nem trate o leitor pelo nome próprio (nada de "Felicio, ...") — o post é público, para desconhecidos. O protagonista é o PRODUTO.
- Se briefing cita PESSOA nomeada (consultor/atleta/cliente), use essa pessoa nas 3 opções.
- Sem markdown, sem "Aqui está:", sem aspas envolvendo o post.

ÂNGULOS OBRIGATÓRIOS (uma opção por ângulo):
${angleRules}

${ajuste ? `\n🎯 AJUSTE OBRIGATÓRIO DO DONO (aplique nas 3 opções, mantendo os ângulos): "${ajuste}"` : ""}
${brandContext ? `\n🏢 CONTEXTO DA MARCA (BASE — não é produto físico):\n${brandContext}\n\nFale das tecnologias/benefícios reais. NÃO use "maleta/kit/unidades/estoque". CTA: agendar demo, falar no WhatsApp, testar a plataforma.` : ""}

Responda APENAS com JSON válido nesta forma exata:
{"A":"texto da opção A","B":"texto da opção B","C":"texto da opção C"}`;

  // Fallback só entra se a IA falhar 2x. Quando existe briefing do dono, o fallback
  // usa o TEXTO DELE (nunca a descrição da imagem) — era isso que gerava as 3 opções
  // idênticas com "Conteúdo da imagem: ...".
  const fallback = (): { A: string; B: string; C: string } => {
    const corpo = (brief || produto.descricao || "").toString().replace(/^Conteúdo da imagem:\s*/i, "").trim();
    const cta = rede === "linkedin"
      ? temLink ? String(produto.link) : ""
      : temLink ? `👉 ${produto.link}` : "👉 Chama no direct pra saber mais!";
    const cabeca = brief ? "" : rede === "linkedin"
      ? `${produto.nome}${preco ? ` — ${preco}` : ""}\n\n`
      : `🔥 ${produto.nome}${preco ? ` — ${preco}` : ""}\n\n`;
    const base = `${cabeca}${corpo.slice(0, 380)}\n\n${cta}`.slice(0, limite);
    const cleanBase = rede === "linkedin" ? sanitizeLinkedInApprovalCopy(base) : base;
    return { A: cleanBase, B: cleanBase, C: cleanBase };
  };


  const tentativa = async (): Promise<{ A: string; B: string; C: string } | null> => {
    // Timeout duro: sem isso o fetch pode pendurar e a resposta NUNCA chega no WhatsApp.
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 20000);
    let res: Response;
    try {
      res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        signal: ac.signal,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
        body: JSON.stringify({
          model: MODEL_FAST,
          messages: [
            { role: "system", content: "Você retorna APENAS JSON válido, sem markdown, sem texto extra." },
            { role: "user", content: prompt },
          ],
          temperature: 0.9,
          max_tokens: 3500,
          response_format: { type: "json_object" },
        }),
      });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) {
      console.error("[postar_redes] gemini !ok:", res.status, await res.text());
      return null;
    }
    const data = await res.json();

    let txt = (data?.choices?.[0]?.message?.content || "").trim();
    txt = txt.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    const m = txt.match(/\{[\s\S]*\}/);
    if (!m) return null;
    const parsed = JSON.parse(m[0].replace(/,(\s*[}\]])/g, "$1"));
    const clean = (s: unknown) => {
      if (typeof s !== "string") return "";
      const value = rede === "linkedin" ? sanitizeLinkedInApprovalCopy(s) : s.trim();
      return value.slice(0, limite);
    };
    const A = clean(parsed.A) || clean(parsed.opcaoA);
    const B = clean(parsed.B) || clean(parsed.opcaoB);
    const C = clean(parsed.C) || clean(parsed.opcaoC);
    if (!A || !B || !C) return null;
    return { A, B, C };
  };

  // 2 tentativas: uma falha de rede/timeout não pode mais derrubar a copy pro fallback pobre.
  for (let i = 0; i < 2; i++) {
    try {
      const r = await tentativa();
      if (r) return r;
      console.warn(`[postar_redes] tentativa ${i + 1} sem copy válida`);
    } catch (e) {
      console.error(`[postar_redes] tentativa ${i + 1} falhou:`, e);
    }
  }
  return fallback();
}


// Wrapper compat: devolve UMA string (a opção A) — mantém API antiga viva pra qualquer chamador residual.
async function gerarScriptRedesSociais(
  produto: { nome: string; descricao?: string | null; preco?: number | null; link?: string | null; categoria?: string | null; source?: string | null },
  tom: string,
  rede: "facebook" | "instagram",
  ajuste?: string,
  brandContext?: string,
): Promise<string> {
  const { A } = await gerarTresOpcoesRedeSocial(produto, tom, rede, ajuste, brandContext);
  return A;
}

// Cache em memória + persistência no banco para posts pendentes.
// Edge Functions podem trocar de instância entre o preview e a confirmação; só Map em memória perde o token.
const SOCIAL_CONFIRMATION_TTL_MS = PENDING_LOOKBACK_MS;
type PostVariantes = { A: string; B: string; C: string };
type PendingSocialPost = {
  produto: any;
  tom: string;
  redes: string[];
  scripts: Record<string, string>; // cópia persistida por rede; A é só preview até escolha explícita
  variantes?: Record<string, PostVariantes>; // 3 opções por rede
  variantSelecionada?: "A" | "B" | "C"; // ausente até o dono escolher explicitamente
  userId: string;
  requesterPhone?: string;
  createdAt: number;
  lastInteractionAt?: number;
  formato?: "feed" | "story" | "reels";
  midiaTipo?: "foto" | "video" | "carrossel";
  queueRows?: Array<{ id: string; platform: string }>;
  incluirCtaWhatsapp?: boolean;
  briefing?: string; // texto escrito pelo dono que é a MENSAGEM do post (prioridade sobre o visual)
  instagramCreationId?: string;
  tiktokPrivacyLevel?: string;
  tiktokPrivacyOptions?: string[];
  tiktokCreatorNickname?: string;
  tiktokMaxDurationSec?: number;
  tiktokVideoDurationSec?: number;
  tiktokIsCommercialContent?: boolean;
  tiktokBrandOrganic?: boolean;
  tiktokBrandedContent?: boolean;
  tiktokConsentedAt?: string;
  pendingTikTokScheduledAt?: string;
};
const PENDING_POSTS = new Map<string, PendingSocialPost>();
function pendingCleanup() {
  const now = Date.now();
  for (const [k, v] of PENDING_POSTS) if (now - v.createdAt > SOCIAL_CONFIRMATION_TTL_MS) PENDING_POSTS.delete(k);
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

type PendingPostMarkerState = {
  variantes?: Record<string, PostVariantes>;
  variantSelecionada?: "A" | "B" | "C";
  incluirCtaWhatsapp?: boolean;
  tom?: string;
  briefing?: string;
  tiktokPrivacyLevel?: string;
  tiktokPrivacyOptions?: string[];
  tiktokCreatorNickname?: string;
  tiktokMaxDurationSec?: number;
  tiktokVideoDurationSec?: number;
  tiktokIsCommercialContent?: boolean;
  tiktokBrandOrganic?: boolean;
  tiktokBrandedContent?: boolean;
  tiktokConsentedAt?: string;
  pendingTikTokScheduledAt?: string;
};

function encodePendingPostState(state?: PendingPostMarkerState): string {
  if (!state || (!state.variantes && !state.variantSelecionada && state.incluirCtaWhatsapp === undefined && !state.tom && !state.briefing && !state.tiktokPrivacyLevel && !state.tiktokPrivacyOptions?.length && !state.pendingTikTokScheduledAt)) return "";
  try {
    const json = JSON.stringify(state);
    const bytes = new TextEncoder().encode(json);
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  } catch (e) {
    console.warn("[social_pending][state_encode_error]", (e as Error).message);
    return "";
  }
}

function decodePendingPostState(marker?: string | null): PendingPostMarkerState | null {
  const encoded = marker?.match(/;state:([^;]+)/)?.[1];
  if (!encoded) return null;
  try {
    const padded = encoded.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(encoded.length / 4) * 4, "=");
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch (e) {
    console.warn("[social_pending][state_decode_error]", (e as Error).message);
    return null;
  }
}

function pendingPostMarker(
  token: string,
  productName?: string,
  formato: "feed" | "story" | "reels" = "feed",
  midiaTipo: "foto" | "video" | "carrossel" = "foto",
  state?: PendingPostMarkerState,
): string {
  const encodedState = encodePendingPostState(state);
  const statePart = encodedState ? `;state:${encodedState}` : "";
  return `jarvis_token:${token};formato:${formato};midia:${midiaTipo}${statePart};produto:${(productName || "produto").replace(/[\n\r]+/g, " ").slice(0, 160)}`;
}

function productNameFromPendingMarker(marker?: string | null): string {
  return marker?.match(/;produto:(.*)$/)?.[1]?.trim() || "produto";
}

function formatoFromPendingMarker(marker?: string | null): "feed" | "story" | "reels" {
  const m = marker?.match(/;formato:(feed|story|reels)/i);
  return (m?.[1]?.toLowerCase() as "feed" | "story" | "reels") || "feed";
}

function midiaTipoFromPendingMarker(marker?: string | null): "foto" | "video" | "carrossel" {
  const m = marker?.match(/;midia:(foto|video|carrossel)/i);
  return (m?.[1]?.toLowerCase() as "foto" | "video" | "carrossel") || "foto";
}

async function persistPendingSocialPost(token: string, pending: PendingSocialPost): Promise<Array<{ id: string; platform: string }>> {
  const mediaType = pending.midiaTipo || (pending.produto as any)?.midia_tipo || "foto";
  const mediaUrl = pending.produto?.imagem_url || null;
  const imageUrls = Array.isArray(pending.produto?.image_urls)
    ? pending.produto.image_urls.filter((url: unknown): url is string => typeof url === "string" && !!url.trim())
    : [];
  const rows = buildSocialQueueNetworkRows(pending.redes, pending.scripts).map((networkRow) => ({
    user_id: pending.userId,
    produto_id: isUuid(pending.produto?.id) ? pending.produto.id : null,
    produto_source: pending.produto?.source || "produtos",
    platform: networkRow.platform,
    post_text: networkRow.post_text,
    image_url: mediaType === "video" ? null : mediaUrl,
    video_url: mediaType === "video" ? mediaUrl : null,
    image_urls: imageUrls.length >= 2 ? imageUrls : null,
    link_url: pending.produto?.link || null,
    approval_token: token,
    solicitante_telefone: pending.requesterPhone || null,
    status: "aguardando_confirmacao",
    scheduled_at: null,
    error_message: pendingPostMarker(token, pending.produto?.nome, pending.formato || "feed", mediaType, {
      variantes: pending.variantes,
      variantSelecionada: pending.variantSelecionada,
      incluirCtaWhatsapp: pending.incluirCtaWhatsapp,
      tom: pending.tom,
      briefing: pending.briefing ? pending.briefing.slice(0, 1200) : undefined,
      tiktokPrivacyLevel: pending.tiktokPrivacyLevel,
      tiktokPrivacyOptions: pending.tiktokPrivacyOptions,
      tiktokCreatorNickname: pending.tiktokCreatorNickname,
      tiktokMaxDurationSec: pending.tiktokMaxDurationSec,
      tiktokVideoDurationSec: pending.tiktokVideoDurationSec,
      tiktokIsCommercialContent: pending.tiktokIsCommercialContent,
      tiktokBrandOrganic: pending.tiktokBrandOrganic,
      tiktokBrandedContent: pending.tiktokBrandedContent,
      tiktokConsentedAt: pending.tiktokConsentedAt,
      pendingTikTokScheduledAt: pending.pendingTikTokScheduledAt,
    }),
    updated_at: new Date().toISOString(),
  }));

  const { data, error } = await sb
    .from("social_posts_queue")
    .insert(rows)
    .select("id, platform");

  if (error) throw new Error(`não consegui salvar o token de confirmação: ${error.message}`);
  return (data ?? []).map((r: any) => ({ id: r.id, platform: r.platform }));
}

async function persistAnuncioFlowState(
  ctx: { userId: string; fromNumber: string; convId?: string; agentState?: AgentConvState },
  patch: Pick<AgentConvState, "last_anuncio" | "pending_anuncio_post">,
): Promise<void> {
  if (!ctx.convId) return;
  const conversation = {
    id: ctx.convId,
    userId: ctx.userId,
    contactNumber: ctx.fromNumber,
  };
  const current = ctx.agentState ?? await loadAgentState(sb, conversation);
  const saved = await saveAgentState(sb, conversation, patch, current);
  if (!saved) {
    throw new Error("não consegui salvar o estado do anúncio");
  }
  Object.assign(current, patch);
  ctx.agentState = current;
}

async function connectedAnuncioNetworks(
  userId: string,
): Promise<AnuncioPostNetwork[]> {
  const { data, error } = await sb.from("meta_connections")
    .select("page_id, ig_account_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw new Error(`não consegui consultar as redes conectadas: ${error.message}`);
  const networks: AnuncioPostNetwork[] = [];
  if (data?.page_id) networks.push("facebook");
  if (data?.ig_account_id) networks.push("instagram");
  return networks;
}

async function ensureLastAnuncioImage(
  last: LastAnuncio,
  style: AnuncioStyle,
  formato: "feed" | "story",
  ctx: { userId: string; fromNumber: string },
): Promise<LastAnuncioImage> {
  const existing = last.images.find((image) =>
    image.style === style && image.formato === formato
  );
  if (existing) return existing;
  if (!last.render_payload) {
    throw new Error(`não tenho os dados necessários para gerar a versão ${formato}`);
  }
  const client = last.client_name
    ? await findClientBrandIdentity(sb, ctx.userId, { name: last.client_name })
    : null;
  const logoPath = client
    ? clientLogoPath(client, style === "catalogo" ? "light" : "dark", true)
    : null;
  const render = await callEdge("render-anuncio-produto", {
    ...last.render_payload,
    formato,
    estilo: style,
    logo_path: logoPath,
  }, 120000);
  if (!render?.success || !render?.image_url) {
    throw new Error(String(render?.error || `falha ao gerar ${formato}`));
  }
  const { data: media, error } = await sb.from("midias_whatsapp").insert({
    user_id: ctx.userId,
    telefone_origem: ctx.fromNumber,
    tipo: "foto",
    midia_url: render.image_url,
    contexto_original: `Anúncio ${style} ${formato}: ${String(last.data.titulo || "")}`,
    origem: "anuncio_produto",
    status: "pendente",
  }).select("id").maybeSingle();
  if (error) throw new Error(`não consegui salvar a versão ${formato}: ${error.message}`);
  const image = {
    style,
    formato,
    id: String(media?.id || ""),
    url: String(render.image_url),
  } satisfies LastAnuncioImage;
  last.images.push(image);
  return image;
}

async function prepareAnuncioSocialPosts(input: {
  last: LastAnuncio;
  action: "publish" | "schedule";
  format: "feed" | "story" | "feed_story";
  networks: AnuncioPostNetwork[];
  ctx: { userId: string; fromNumber: string; convId?: string; agentState?: AgentConvState };
}): Promise<{ raw: string; pending: PendingAnuncioPost }> {
  const { last, action, format, networks, ctx } = input;
  const style = last.selected_style;
  if (!style) throw new Error("escolha primeiro um dos estilos do anúncio");
  if (!networks.length) throw new Error("nenhuma das redes pedidas está conectada");
  if (action === "schedule" && format !== "feed") {
    throw new Error(
      "agendamento pelo WhatsApp está disponível apenas para Feed",
    );
  }

  const captions = generateVehicleAdCaptions(last.data);
  const variantes = Object.fromEntries(networks.map((network) => [
    network,
    { ...captions },
  ])) as Record<string, PostVariantes>;
  const formats: Array<"feed" | "story"> = format === "feed_story"
    ? ["feed", "story"]
    : [format];
  const tokens: string[] = [];

  try {
    for (const postFormat of formats) {
      const image = await ensureLastAnuncioImage(last, style, postFormat, ctx);
      const token = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
      const scripts = Object.fromEntries(
        networks.map((network) => [network, captions.A]),
      );
      const pending: PendingSocialPost = {
        produto: {
          id: image.id || null,
          source: "anuncio_produto",
          nome: String(last.data.titulo || "Anúncio"),
          descricao: JSON.stringify(last.data),
          imagem_url: image.url,
          ativo: true,
          midia_tipo: "foto",
        },
        tom: "beneficio",
        redes: networks,
        scripts,
        variantes,
        userId: ctx.userId,
        requesterPhone: ctx.fromNumber,
        createdAt: Date.now(),
        formato: postFormat,
        midiaTipo: "foto",
        briefing: JSON.stringify(last.data).slice(0, 1200),
      };
      const queueRows = await persistPendingSocialPost(token, pending);
      PENDING_POSTS.set(token, { ...pending, queueRows });
      tokens.push(token);
    }

    const flow: PendingAnuncioPost = {
      stage: "captions",
      action,
      format,
      networks,
      token: tokens[0],
      extra_tokens: tokens.slice(1),
      created_at: new Date().toISOString(),
    };
    await persistAnuncioFlowState(ctx, {
      last_anuncio: last,
      pending_anuncio_post: flow,
    });
    return {
      pending: flow,
      raw: JSON.stringify({
        status: "aguardando_escolha_variante",
        fonte: "last_anuncio",
        token: tokens[0],
        formato: formats[0],
        produto: {
          nome: String(last.data.titulo || "Anúncio"),
          imagem_url: last.images.find((image) =>
            image.style === style && image.formato === formats[0]
          )?.url,
        },
        redes: networks,
        variantes,
      }),
    };
  } catch (error) {
    if (tokens.length) {
      await sb.from("social_posts_queue").update({
        status: "cancelado",
        error_message: "preparo_anuncio_incompleto",
        updated_at: new Date().toISOString(),
      }).eq("user_id", ctx.userId).in("approval_token", tokens)
        .eq("status", "aguardando_confirmacao");
      for (const token of tokens) PENDING_POSTS.delete(token);
    }
    throw error;
  }
}

function anuncioPostSummary(
  last: LastAnuncio,
  pending: PendingAnuncioPost,
  option: string,
): string {
  const style = last.selected_style || "anúncio";
  const format = pending.format === "feed_story"
    ? "Feed + Story"
    : pending.format === "story"
    ? "Story"
    : "Feed";
  const networks = (pending.networks ?? []).map((network) =>
    network === "facebook" ? "Facebook" : "Instagram"
  ).join(" + ");
  const scheduled = pending.scheduled_at
    ? `, agendado para *${pending.scheduled_at}*`
    : "";
  return `Resumo: *${String(last.data.titulo || "Anúncio")}* — estilo *${style}*, ${format}, ${networks}, legenda *Opção ${option}*${scheduled}. Nada foi publicado nem agendado ainda.`;
}

async function deliverAnuncioCaptionChoices(
  raw: string,
  ctx: { userId: string; fromNumber: string },
): Promise<{
  text: string;
  interactiveButtons?: WhatsAppInteractiveButtons;
  interactiveList?: WhatsAppInteractiveList;
}> {
  const text = formatSocialPostToolResult(raw);
  const buttons = interactiveButtonsFromSocialResult(raw);
  try {
    await sendWhatsApp(
      ctx.userId,
      ctx.fromNumber,
      text,
      undefined,
      undefined,
      buttons,
      { alreadyLogged: false },
    );
    return {
      text: "Se quiser, posso gerar outras opções ou você pode escrever a sua.",
      interactiveList: anuncioCaptionExtraList(),
    };
  } catch (error) {
    console.warn("[anuncio_post][caption_buttons_send_failed]", (error as Error).message);
    return { text, interactiveButtons: buttons };
  }
}

async function replaceAnuncioPendingCaptions(
  tokens: string[],
  captions: PostVariantes,
  ctx: { userId: string; fromNumber: string },
  selected?: "A" | "B" | "C",
): Promise<void> {
  for (const token of tokens) {
    const current = PENDING_POSTS.get(token) ??
      await loadPendingSocialPost(token, ctx.userId);
    if (!current) throw new Error("preview de publicação expirado");
    const variantes = Object.fromEntries(
      current.redes.map((network) => [network, { ...captions }]),
    );
    const option = selected ?? "A";
    const scripts = Object.fromEntries(
      current.redes.map((network) => [network, captions[option]]),
    );
    const updated: PendingSocialPost = {
      ...current,
      variantes,
      scripts,
      variantSelecionada: selected,
    };
    const updateErrors = await Promise.all((current.queueRows ?? []).map(
      async (row) => {
        const { error } = await sb.from("social_posts_queue").update({
          post_text: scripts[row.platform],
          updated_at: new Date().toISOString(),
        }).eq("id", row.id).eq("user_id", ctx.userId)
          .eq("status", "aguardando_confirmacao");
        return error?.message;
      },
    ));
    const error = updateErrors.find(Boolean);
    if (error) throw new Error(error);
    PENDING_POSTS.set(token, updated);
    await updatePendingSocialPostMarker(token, updated);
  }
}

function carouselCardIndex(row: any): number {
  const match = String(row?.contexto_original || "").match(/\[carrossel_card:(\d+)\]/i);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

async function loadCarouselImageUrls(userId: string, parentId: string): Promise<string[]> {
  if (!isUuid(parentId)) return [];
  const [{ data: parent, error: parentError }, { data: children, error: childrenError }] = await Promise.all([
    sb.from("midias_whatsapp")
      .select("id, midia_url, contexto_original")
      .eq("id", parentId)
      .eq("user_id", userId)
      .maybeSingle(),
    sb.from("midias_whatsapp")
      .select("id, midia_url, contexto_original, created_at")
      .eq("user_id", userId)
      .eq("midia_pai_id", parentId)
      .order("created_at", { ascending: true }),
  ]);
  if (parentError || childrenError) {
    console.error("[carrossel][load_cards_failed]", {
      parentId,
      error: parentError?.message || childrenError?.message,
    });
    return [];
  }
  const orderedChildren = [...(children ?? [])].sort((a: any, b: any) => carouselCardIndex(a) - carouselCardIndex(b));
  return [parent?.midia_url, ...orderedChildren.map((row: any) => row.midia_url)].filter(Boolean);
}

async function loadPendingSocialPost(token: string, userId: string): Promise<PendingSocialPost | null> {
  const { data, error } = await sb
    .from("social_posts_queue")
    .select("id, user_id, produto_id, produto_source, platform, post_text, image_url, image_urls, video_url, link_url, status, error_message, instagram_creation_id, instagram_container_status, approval_token, solicitante_telefone, created_at, updated_at")
    .eq("user_id", userId)
    .eq("status", "aguardando_confirmacao")
    .like("error_message", `jarvis_token:${token}%`)
    .order("created_at", { ascending: true })
    .limit(10);

  if (error) {
    console.warn("[social_confirm][load_error]", error.message);
    return null;
  }
  const rows = data ?? [];
  if (rows.length === 0) return null;

  const createdAt = new Date(rows[0].created_at).getTime();
  if (Number.isFinite(createdAt) && Date.now() - createdAt > SOCIAL_CONFIRMATION_TTL_MS) {
    return null;
  }

  const scripts: Record<string, string> = {};
  for (const row of rows as any[]) scripts[row.platform] = row.post_text || "";

  const marker = (rows[0] as any).error_message;
  const state = decodePendingPostState(marker);
  const midiaTipoReidratado = midiaTipoFromPendingMarker(marker);
  const produtoId = (rows[0] as any).produto_id;

  return {
    produto: {
      id: produtoId,
      source: (rows[0] as any).produto_source,
      nome: productNameFromPendingMarker(marker),
      imagem_url: (rows[0] as any).video_url || (rows[0] as any).image_url,
      image_urls: Array.isArray((rows[0] as any).image_urls) ? (rows[0] as any).image_urls : undefined,
      link: (rows[0] as any).link_url,
      midia_tipo: midiaTipoReidratado,
    } as any,
    tom: state?.tom || "urgencia",
    redes: (rows as any[]).map((r) => r.platform),
    scripts,
    userId,
    requesterPhone: (rows[0] as any).solicitante_telefone || undefined,
    createdAt: Number.isFinite(createdAt) ? createdAt : Date.now(),
    lastInteractionAt: Math.max(
      Number.isFinite(createdAt) ? createdAt : Date.now(),
      ...(rows as any[]).map((row) => new Date(row.updated_at || row.created_at).getTime()).filter(Number.isFinite),
    ),
    formato: formatoFromPendingMarker(marker),
    midiaTipo: midiaTipoReidratado,
    queueRows: (rows as any[]).map((r) => ({ id: r.id, platform: r.platform })),
    variantes: state?.variantes,
    variantSelecionada: state?.variantSelecionada,
    incluirCtaWhatsapp: state?.incluirCtaWhatsapp,
    briefing: (state as any)?.briefing,
    instagramCreationId: (rows as any[]).find((r) => r.platform === "instagram")?.instagram_creation_id || undefined,
    tiktokPrivacyLevel: state?.tiktokPrivacyLevel,
    tiktokPrivacyOptions: state?.tiktokPrivacyOptions,
    tiktokCreatorNickname: state?.tiktokCreatorNickname,
    tiktokMaxDurationSec: state?.tiktokMaxDurationSec,
    tiktokVideoDurationSec: state?.tiktokVideoDurationSec,
    tiktokIsCommercialContent: state?.tiktokIsCommercialContent,
    tiktokBrandOrganic: state?.tiktokBrandOrganic,
    tiktokBrandedContent: state?.tiktokBrandedContent,
    tiktokConsentedAt: state?.tiktokConsentedAt,
    pendingTikTokScheduledAt: state?.pendingTikTokScheduledAt,
  };
}

async function updatePersistedSocialPostRows(
  pending: PendingSocialPost,
  resultados: Array<{ rede: string; ok: boolean; status: number; resposta: any }>,
  token: string,
) {
  const rows = pending.queueRows ?? [];
  const errors = await Promise.all(resultados.map(async (result) => {
    const row = rows.find((r) => r.platform === result.rede);
    if (!row?.id) return null;
    const retryableInstagram = result.rede === "instagram"
      && result.resposta?.retryable === true
      && typeof result.resposta?.creation_id === "string";
    const { error } = await sb.from("social_posts_queue")
      .update({
        status: result.ok ? "publicado" : retryableInstagram ? "aguardando_confirmacao" : "erro",
        fb_post_id: result.ok ? (result.resposta?.post_id || result.resposta?.id || null) : null,
        linkedin_post_urn: result.ok && result.rede === "linkedin"
          ? (result.resposta?.post_urn || null)
          : null,
        published_at: result.ok ? new Date().toISOString() : null,
        error_message: result.ok
          ? null
          : retryableInstagram
            ? pendingPostMarker(
              token,
              pending.produto?.nome,
              pending.formato || "feed",
              pending.midiaTipo || "foto",
              {
                variantes: pending.variantes,
                variantSelecionada: pending.variantSelecionada,
                incluirCtaWhatsapp: pending.incluirCtaWhatsapp,
                tom: pending.tom,
                briefing: pending.briefing,
                tiktokPrivacyLevel: pending.tiktokPrivacyLevel,
                tiktokPrivacyOptions: pending.tiktokPrivacyOptions,
                tiktokCreatorNickname: pending.tiktokCreatorNickname,
                tiktokMaxDurationSec: pending.tiktokMaxDurationSec,
                tiktokVideoDurationSec: pending.tiktokVideoDurationSec,
                tiktokIsCommercialContent: pending.tiktokIsCommercialContent,
                tiktokBrandOrganic: pending.tiktokBrandOrganic,
                tiktokBrandedContent: pending.tiktokBrandedContent,
                tiktokConsentedAt: pending.tiktokConsentedAt,
                pendingTikTokScheduledAt: pending.pendingTikTokScheduledAt,
              },
            )
            : (result.resposta?.error || result.resposta?.message || `falha_${result.status || "sem_status"}`),
        instagram_creation_id: retryableInstagram ? result.resposta.creation_id : null,
        instagram_container_status: retryableInstagram ? (result.resposta.container_status || "UNKNOWN") : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id)
      .eq("user_id", pending.userId);
    return error?.message ?? null;
  }));
  const failures = errors.filter(Boolean);
  if (failures.length > 0) throw new Error(`social_queue_final_update_failed: ${failures.join(" | ")}`);
}

const TIKTOK_PRIVACY_LABELS: Record<string, string> = {
  PUBLIC_TO_EVERYONE: "Todos",
  MUTUAL_FOLLOW_FRIENDS: "Amigos",
  FOLLOWER_OF_CREATOR: "Seguidores",
  SELF_ONLY: "Somente eu",
};

async function fetchTikTokPrivacyOptions(userId: string): Promise<{
  options: string[];
  creatorNickname?: string;
  maxDurationSec?: number;
  error?: string;
}> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/tiktok-creator-info`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_KEY}`,
        apikey: SERVICE_KEY,
      },
      body: JSON.stringify({ user_id: userId }),
    });
    const txt = await res.text();
    let data: any = {};
    try { data = JSON.parse(txt); } catch { /* handled below */ }
    if (!res.ok || data?.success !== true) {
      return {
        options: [],
        error: data?.message
          || (data?.error === "tiktok_reconnect_required"
            ? "A conexão com o seu TikTok expirou. Reconecte o TikTok na plataforma para continuar."
            : data?.error)
          || `Não foi possível consultar a conta TikTok agora.`,
      };
    }
    const options: string[] = Array.isArray(data.privacy_level_options)
      ? data.privacy_level_options
        .filter((v: unknown): v is string => typeof v === "string" && !!v.trim())
        .map((v: string) => v)
      : [];
    if (options.length === 0) return { options: [], error: "TikTok não retornou opções de privacidade para esta conta." };
    return {
      options: [...new Set(options)],
      creatorNickname: typeof data.creator_nickname === "string" ? data.creator_nickname : undefined,
      maxDurationSec: Number.isFinite(Number(data.max_video_post_duration_sec))
        ? Number(data.max_video_post_duration_sec)
        : undefined,
    };
  } catch (e) {
    return { options: [], error: String((e as Error).message || e) };
  }
}

function matchTikTokPrivacyChoice(text: string, options: string[]): string | null {
  const normalized = normalizePt(compactSpaces(text || ""));
  for (const option of options) {
    if (normalizePt(option) === normalized || normalizePt(TIKTOK_PRIVACY_LABELS[option] || option) === normalized) {
      return option;
    }
  }
  return null;
}

async function loadPendingTikTokVideoDuration(pending: PendingSocialPost): Promise<number | undefined> {
  const known = Number(
    pending.tiktokVideoDurationSec
      ?? pending.produto?.duracao_segundos,
  );
  if (Number.isFinite(known) && known > 0) return known;
  if (!isUuid(pending.produto?.id)) return undefined;
  const source = String(pending.produto?.source || "");
  if (source === "midias_whatsapp") {
    const { data } = await sb.from("midias_whatsapp")
      .select("duracao_segundos, midia_url")
      .eq("id", pending.produto.id)
      .eq("user_id", pending.userId)
      .maybeSingle();
    const duration = Number(data?.duracao_segundos);
    if (Number.isFinite(duration) && duration > 0) return duration;
    const videoUrl = String(data?.midia_url || pending.produto?.imagem_url || "");
    if (!videoUrl) return undefined;
    try {
      const detected = await fetchMp4DurationSeconds(videoUrl);
      if (!detected) return undefined;
      const { error } = await sb.from("midias_whatsapp")
        .update({
          duracao_segundos: integerMediaDurationSeconds(detected),
        })
        .eq("id", pending.produto.id)
        .eq("user_id", pending.userId);
      if (error) console.warn("[tiktok][duration_persist_failed]", error.message);
      return detected;
    } catch (error) {
      console.warn("[tiktok][duration_detect_failed]", (error as Error).message);
      return undefined;
    }
  }
  if (source === "videos_produtos") {
    const { data } = await sb.from("videos_produtos")
      .select("duracao_segundos")
      .eq("id", pending.produto.id)
      .eq("user_id", pending.userId)
      .maybeSingle();
    const duration = Number(data?.duracao_segundos);
    return Number.isFinite(duration) && duration > 0 ? duration : undefined;
  }
  return undefined;
}

async function publicarEmRede(
  rede: string,
  script: string,
  produto: { nome: string; imagem_url: string; image_urls?: string[]; link?: string | null; descricao?: string | null; midia_tipo?: "foto" | "video" | "carrossel" },
  userId: string,
  formato: "feed" | "story" | "reels" = "feed",
  instagramCreationId?: string,
  tiktokPrivacyLevel?: string,
  queueRowId?: string,
): Promise<{ rede: string; ok: boolean; status: number; resposta: any; nota?: string }> {
  try {
    const commonHeaders = { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY } as const;
    if (produto.midia_tipo === "carrossel") {
      const imageUrls = Array.isArray(produto.image_urls) ? produto.image_urls.filter(Boolean) : [];
      if (imageUrls.length < 2) {
        return { rede, ok: false, status: 0, resposta: { error: "Não encontrei todos os cards do carrossel aprovado." } };
      }
      if (rede !== "instagram" && rede !== "facebook") {
        return { rede, ok: false, status: 0, resposta: { error: "Carrossel disponível apenas no Instagram e Facebook." } };
      }
      const endpoint = rede === "instagram"
        ? "meta-publish-carousel"
        : "meta-publish-post";
      const body = rede === "instagram"
        ? { user_id: userId, image_urls: imageUrls, caption: script }
        : { user_id: userId, image_urls: imageUrls, message: script };
      const res = await fetch(`${SUPABASE_URL}/functions/v1/${endpoint}`, {
        method: "POST",
        headers: commonHeaders,
        body: JSON.stringify(body),
      });
      const txt = await res.text();
      let j: any = {};
      try { j = JSON.parse(txt); } catch {}
      return {
        rede,
        ok: res.ok && j?.success !== false &&
          (rede === "facebook" || !!(j?.id || j?.post_id)),
        status: res.status,
        resposta: j,
      };
    }

    const isVideo = produto.midia_tipo === "video";
    let mediaUrl = produto.imagem_url; // pode ser URL de vídeo quando isVideo
    // Se esse vídeo já passou pelo encode de legenda, publica SEMPRE a versão legendada.
    if (isVideo) {
      const legendado = await resolverVideoLegendado(userId, mediaUrl);
      if (legendado) {
        console.log("[social-router] usando vídeo LEGENDADO em vez do original");
        mediaUrl = legendado;
      }
    }
    // === REELS (vídeo em IG/FB) ===
    if (formato === "reels") {
      if (!isVideo) return { rede, ok: false, status: 0, resposta: { error: "reels exige vídeo — envia um vídeo, não imagem" } };
      if (rede === "tiktok") {
        // TikTok trata vídeo direto — cai no branch tiktok abaixo
      } else if (rede === "facebook" || rede === "instagram") {
        console.log(`[social-router] rede=${rede} formato=reels → meta-publish-reels`);
        const res = await fetch(`${SUPABASE_URL}/functions/v1/meta-publish-reels`, {
          method: "POST", headers: commonHeaders,
          body: JSON.stringify({ platform: rede, video_url: mediaUrl, caption: script, user_id: userId, creation_id: rede === "instagram" ? instagramCreationId : undefined, queue_row_id: rede === "instagram" ? queueRowId : undefined }),
        });
        const txt = await res.text(); let j: any = {}; try { j = JSON.parse(txt); } catch {}
        return { rede, ok: res.ok && j?.success !== false, status: res.status, resposta: j };
      }
    }

    // === STORY ===
    if (formato === "story") {
      if (isVideo) {
        if (rede === "tiktok") return { rede, ok: false, status: 0, resposta: { error: "TikTok não tem formato story — ignorado" } };
        console.log(`[social-router] rede=${rede} formato=story tipo=video → meta-publish-story`);
        const res = await fetch(`${SUPABASE_URL}/functions/v1/meta-publish-story`, {
          method: "POST", headers: commonHeaders,
          body: JSON.stringify({ user_id: userId, video_url: mediaUrl, canais: [rede], creation_id: rede === "instagram" ? instagramCreationId : undefined, queue_row_id: rede === "instagram" ? queueRowId : undefined }),
        });
        const txt = await res.text(); let j: any = {}; try { j = JSON.parse(txt); } catch {}
        const chanResult = j?.[rede];
        const chanOk = chanResult?.ok === true;
        return { rede, ok: res.ok && chanOk, status: res.status, resposta: chanOk ? chanResult : { ...chanResult, error: chanResult?.error || j?.error || `falha_${res.status}` } };
      }
      // Foto — comportamento anterior
      if (rede === "instagram") {
        console.log(`[social-router] rede=instagram formato=story tipo=foto → meta-publish-story-image`);
        const res = await fetch(`${SUPABASE_URL}/functions/v1/meta-publish-story-image`, {
          method: "POST", headers: commonHeaders,
          body: JSON.stringify({ user_id: userId, image_url: mediaUrl, creation_id: instagramCreationId, queue_row_id: queueRowId }),
        });
        const txt = await res.text(); let j: any = {}; try { j = JSON.parse(txt); } catch {}
        if (!res.ok || j?.success === false) {
          const raw = String(j?.error || j?.message || `falha_${res.status}`);
          const amigavel = /9:16|aspect|proporç|vertical|format/i.test(raw) ? "a imagem precisa ser vertical 9:16 pra story do Instagram" : raw;
          return { rede, ok: false, status: res.status, resposta: { ...j, error: amigavel } };
        }
        return { rede, ok: true, status: res.status, resposta: j };
      }
      if (rede === "facebook") {
        console.log(`[social-router] rede=facebook formato=story tipo=foto → meta-publish-story-photo-fb`);
        const res = await fetch(`${SUPABASE_URL}/functions/v1/meta-publish-story-photo-fb`, {
          method: "POST", headers: commonHeaders,
          body: JSON.stringify({ user_id: userId, image_url: mediaUrl }),
        });
        const txt = await res.text(); let j: any = {}; try { j = JSON.parse(txt); } catch {}
        if (!res.ok || j?.success === false) {
          const raw = String(j?.error || j?.message || `falha_${res.status}`);
          const amigavel = /9:16|aspect|proporç|vertical|format/i.test(raw) ? "a imagem precisa ser vertical 9:16 pra story do Facebook" : raw;
          return { rede, ok: false, status: res.status, resposta: { ...j, error: amigavel } };
        }
        return { rede, ok: true, status: res.status, resposta: j };
      }
      if (rede === "tiktok") return { rede, ok: false, status: 0, resposta: { error: "TikTok não tem formato story — ignorado" } };
    }

    // === FEED ===
    if (rede === "facebook") {
      // FB aceita vídeo direto no feed via meta-publish-post (video_url).
      const body: any = { user_id: userId, message: script };
      if (isVideo) body.video_url = mediaUrl;
      else {
        // 📐 O feed do Facebook é otimizado para PAISAGEM 1.91:1. Como o Jarvis gera tudo
        // em 1:1 (ideal do Instagram), aqui geramos a VARIANTE paisagem por outpainting.
        // Falha => segue com a quadrada (FB aceita, só fica menos bonita).
        const variante = await gerarVarianteFacebookFeed(sb, mediaUrl, userId, LOVABLE_API_KEY);
        console.log(`[social-router] rede=facebook formato=feed variante_paisagem=${variante.convertida} motivo=${variante.motivo ?? "ok"}`);
        body.image_url = variante.url;
        body.link_url = produto.link;
      }
      const res = await fetch(`${SUPABASE_URL}/functions/v1/meta-publish-post`, {
        method: "POST", headers: commonHeaders, body: JSON.stringify(body),
      });
      const txt = await res.text(); let j: any = {}; try { j = JSON.parse(txt); } catch {}
      return { rede, ok: res.ok && j?.success !== false, status: res.status, resposta: j };
    }

    if (rede === "instagram") {
      if (isVideo) {
        // ⚠️ IG feed de vídeo ≡ Reels na Graph API desde 2022. Redirecionamos internamente pra Reels com aviso.
        console.log(`[social-router] rede=instagram formato=feed tipo=video → redirecionado pra REELS (padrão Meta)`);
        const res = await fetch(`${SUPABASE_URL}/functions/v1/meta-publish-reels`, {
          method: "POST", headers: commonHeaders,
          body: JSON.stringify({ platform: "instagram", video_url: mediaUrl, caption: script, user_id: userId, creation_id: instagramCreationId, queue_row_id: queueRowId }),
        });
        const txt = await res.text(); let j: any = {}; try { j = JSON.parse(txt); } catch {}
        return {
          rede, ok: res.ok && j?.success !== false, status: res.status, resposta: j,
          nota: "No Instagram, vídeo no feed vira Reels (padrão da Meta) — publiquei como Reels.",
        };
      }
      const res = await fetch(`${SUPABASE_URL}/functions/v1/meta-publish-instagram`, {
        method: "POST", headers: commonHeaders,
        body: JSON.stringify({ user_id: userId, caption: script, image_url: mediaUrl, creation_id: instagramCreationId, queue_row_id: queueRowId }),
      });
      const txt = await res.text(); let j: any = {}; try { j = JSON.parse(txt); } catch {}
      return { rede, ok: res.ok && j?.success !== false, status: res.status, resposta: j };
    }
    if (rede === "linkedin") {
      if (isVideo && !String(mediaUrl || "").trim()) {
        return {
          rede,
          ok: false,
          status: 0,
          resposta: {
            error: "Upload do vídeo não pôde ser iniciado porque o arquivo está ausente. O texto não foi publicado sozinho.",
          },
        };
      }
      const body: Record<string, unknown> = {
        user_id: userId,
        queue_id: queueRowId,
        texto: sanitizeLinkedInApprovalCopy(script),
        link_url: produto.link || undefined,
      };
      if (isVideo) body.video_url = mediaUrl;
      else if (mediaUrl) body.image_url = mediaUrl;
      const res = await fetch(`${SUPABASE_URL}/functions/v1/linkedin-publish`, {
        method: "POST",
        headers: commonHeaders,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(120000),
      });
      const txt = await res.text();
      let j: any = {};
      try { j = JSON.parse(txt); } catch {}
      const postUrn = typeof j?.post_urn === "string" ? j.post_urn.trim() : "";
      return {
        rede,
        ok: isConfirmedLinkedInPublishResult(res.ok, j),
        status: res.status,
        resposta: j,
        nota: /^urn:li:/i.test(postUrn) ? `LinkedIn confirmou a publicação com URN ${postUrn}.` : undefined,
      };
    }
    if (rede === "tiktok") {
      if (!isVideo) {
        return { rede, ok: false, status: 0, resposta: { error: "TikTok aceita apenas vídeo neste fluxo. Envie um vídeo para publicar." } };
      }
      const res = await fetch(`${SUPABASE_URL}/functions/v1/tiktok-post-content`, {
        method: "POST", headers: commonHeaders,
        body: JSON.stringify({
          user_id: userId,
          content_type: "video",
          content_url: mediaUrl,
          title: script.slice(0, 2200),
          post_mode: "direct",
          privacy_level: tiktokPrivacyLevel,
        }),
      });
      const txt = await res.text(); let j: any = {}; try { j = JSON.parse(txt); } catch {}
      return { rede, ok: res.ok && j?.success !== false, status: res.status, resposta: j };
    }
    return { rede, ok: false, status: 0, resposta: { error: "rede desconhecida" } };
  } catch (e) {
    return { rede, ok: false, status: 0, resposta: { error: String((e as Error).message) } };
  }
}

const SOCIAL_POST_STOPWORDS = new Set(["de", "da", "do", "das", "dos", "para", "pra", "pro", "por", "com", "sem", "e", "a", "o", "os", "as", "um", "uma", "no", "na", "nos", "nas", "em"]);

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))];
}

function buildSocialProductTokens(query: string): { dbTokens: string[]; scoreTokens: string[] } {
  const rawTokens = (query || "")
    .toLowerCase()
    .split(/[^a-z0-9\u00c0-\u017f]+/i)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && !SOCIAL_POST_STOPWORDS.has(normalizePt(t)));

  const expansions: Record<string, string[]> = {
    xicara: ["xicara", "xícara", "caneca", "copo", "cup"],
    tabua: ["tabua", "tábua"],
    cortar: ["cortar", "corte"],
    corte: ["corte", "cortar"],
  };

  const expanded = rawTokens.flatMap((t) => {
    const n = normalizePt(t);
    return [t, n, ...(expansions[n] ?? [])];
  });

  return {
    dbTokens: uniqueStrings(expanded).slice(0, 16),
    scoreTokens: uniqueStrings(expanded.map(normalizePt)).slice(0, 20),
  };
}

function firstProductImage(row: any): string | null {
  if (typeof row?.imagem_url === "string" && row.imagem_url.trim()) return row.imagem_url.trim();
  if (typeof row?.img_url === "string" && row.img_url.trim()) return row.img_url.trim();
  if (Array.isArray(row?.imagens)) return row.imagens.find((img: any) => typeof img === "string" && img.trim()) ?? null;
  return null;
}

function toSocialProduct(row: any, source: "produtos" | "products_stock") {
  if (source === "products_stock") {
    return {
      source,
      id: row.id,
      nome: row.name,
      descricao: row.description_short || row.description_long || null,
      preco: row.price ?? null,
      imagem_url: firstProductImage(row),
      link: null,
      categoria: row.category ?? null,
      ativo: row.active !== false,
      tags: row.sku ? [row.sku] : [],
      sku: row.sku ?? null,
    };
  }

  return {
    source,
    id: row.id,
    nome: row.nome,
    descricao: row.descricao ?? null,
    preco: row.preco ?? null,
    imagem_url: firstProductImage(row),
    link: row.link || row.link_marketplace || null,
    categoria: row.categoria ?? null,
    ativo: row.ativo !== false,
    tags: row.tags ?? [],
    sku: row.sku ?? null,
  };
}

function scoreSocialProduct(row: any, query: string, scoreTokens: string[]): number {
  const hay = normalizePt(`${row.nome ?? ""} ${row.descricao ?? ""} ${row.categoria ?? ""} ${Array.isArray(row.tags) ? row.tags.join(" ") : row.tags ?? ""} ${row.sku ?? ""}`);
  const queryNorm = normalizePt(query);
  let score = hay.includes(queryNorm) ? 8 : 0;
  for (const token of scoreTokens) {
    if (!token) continue;
    if (hay.includes(token)) score += 3;
    else if (token.length > 4 && hay.includes(token.slice(0, -1))) score += 1;
  }
  if (normalizePt(row.nome ?? "").includes(scoreTokens[0] ?? "__never__")) score += 2;
  if (row.ativo) score += 1;
  if (row.imagem_url) score += 1;
  return score;
}

function sanitizeSocialProductText(text: string): string {
  let product = compactSpaces(text || "");
  product = product.replace(/\bcom\s+(?:um\s+)?script\b.*$/i, "");
  product = product.replace(/\b(?:script|copy|legenda)\s+(?:de\s+)?(?:urg[eê]ncia|escassez|benef[ií]cio|prova social|black\s*friday)\b.*$/i, "");
  product = product.replace(/\b(?:posta|poste|postar|publica|publique|publicar)\b/gi, " ");
  product = product.replace(/\b(?:no|na|nos|nas|em|para|pra|pro)\s+(?:o\s+|a\s+)?(?:face|facebook|fb|insta|instagram|ig|tiktok|tik\s*tok|linkedin|linked\s*in|lkd|redes sociais|stor(?:y|ies|ie)|reels?|feed)\b/gi, " ");
  product = product.replace(/\b(?:face|facebook|fb|insta|instagram|ig|tiktok|tik\s*tok|linkedin|linked\s*in|lkd|redes sociais|stor(?:y|ies|ie)|reels?|feed)\b/gi, " ");
  product = product.replace(/\b(?:e|de|do|da|dos|das|no|na|nos|nas|em|para|pra|pro|o|a|os|as|um|uma)\b/gi, " ");
  product = product.replace(/^\s*produtos?\s+/i, "");
  return compactSpaces(product.replace(/^[,.;:!\s-]+|[,.;:!\s-]+$/g, ""));
}

async function buscarProdutoParaPostagem(query: string, userId: string): Promise<{ produto: any | null; sugestoes: string[]; candidatos: any[] }> {
  const { dbTokens, scoreTokens } = buildSocialProductTokens(query);
  const produtoFilter = dbTokens
    .map((t) => `nome.ilike.%${t}%,descricao.ilike.%${t}%,categoria.ilike.%${t}%,tags.cs.{${t}},sku.ilike.%${t}%`)
    .join(",");
  const stockFilter = dbTokens
    .map((t) => `name.ilike.%${t}%,description_short.ilike.%${t}%,description_long.ilike.%${t}%,category.ilike.%${t}%,sku.ilike.%${t}%`)
    .join(",");

  const [produtosRes, stockRes] = await Promise.all([
    produtoFilter
      ? sb.from("produtos")
        .select("id, nome, descricao, preco, imagem_url, imagens, link, link_marketplace, categoria, ativo, tags, sku")
        .eq("user_id", userId)
        .or(produtoFilter)
        .limit(80)
      : sb.from("produtos")
        .select("id, nome, descricao, preco, imagem_url, imagens, link, link_marketplace, categoria, ativo, tags, sku")
        .eq("user_id", userId)
        .limit(80),
    stockFilter
      ? sb.from("products_stock")
        .select("id, name, description_short, description_long, price, img_url, category, active, sku")
        .eq("user_id", userId)
        .or(stockFilter)
        .limit(80)
      : sb.from("products_stock")
        .select("id, name, description_short, description_long, price, img_url, category, active, sku")
        .eq("user_id", userId)
        .limit(80),
  ]);

  if (produtosRes.error) console.warn("[social_post_search][produtos_error]", produtosRes.error.message);
  if (stockRes.error) console.warn("[social_post_search][stock_error]", stockRes.error.message);

  let candidatos = [
    ...(produtosRes.data ?? []).map((r: any) => toSocialProduct(r, "produtos")),
    ...(stockRes.data ?? []).map((r: any) => toSocialProduct(r, "products_stock")),
  ];

  // Fallback local: cobre acentos, singular/plural e pequenas diferenças como "cortar" vs "corte".
  if (candidatos.length === 0 || !candidatos.some((c) => scoreSocialProduct(c, query, scoreTokens) > 0)) {
    const [allProdutos, allStock] = await Promise.all([
      sb.from("produtos")
        .select("id, nome, descricao, preco, imagem_url, imagens, link, link_marketplace, categoria, ativo, tags, sku")
        .eq("user_id", userId)
        .limit(500),
      sb.from("products_stock")
        .select("id, name, description_short, description_long, price, img_url, category, active, sku")
        .eq("user_id", userId)
        .limit(500),
    ]);
    candidatos = [
      ...(allProdutos.data ?? []).map((r: any) => toSocialProduct(r, "produtos")),
      ...(allStock.data ?? []).map((r: any) => toSocialProduct(r, "products_stock")),
    ];
  }

  const ranked = candidatos
    .map((r) => ({ r, s: scoreSocialProduct(r, query, scoreTokens) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || Number(b.r.ativo) - Number(a.r.ativo) || Number(Boolean(b.r.imagem_url)) - Number(Boolean(a.r.imagem_url)) || (a.r.nome?.length ?? 999) - (b.r.nome?.length ?? 999));

  console.log("[social_post_search]", JSON.stringify({ query, dbTokens, total: candidatos.length, ranked: ranked.slice(0, 5).map((x) => ({ nome: x.r.nome, score: x.s, source: x.r.source })) }));

  return {
    produto: ranked[0]?.r ?? null,
    sugestoes: ranked.slice(0, 7).map((x) => x.r.nome),
    candidatos,
  };
}

function detectSocialPostFormat(text: string): "feed" | "story" | "reels" | undefined {
  const normalized = normalizePt(text || "");
  if (/\bstor(y|ies|ie)\b/.test(normalized)) return "story";
  if (/\breels?\b/.test(normalized)) return "reels";
  if (/\bfeed\b/.test(normalized)) return "feed";
  return undefined;
}

function cleanMediaPostLegenda(text: string): string | undefined {
  let legenda = compactSpaces(text || "").replace(/^jarvis[,.!\s-]*/i, "");
  legenda = sanitizeSocialProductText(legenda);
  const genericOnly = /^(?:isso|essa|esse|esta|este|foto|imagem|video|vídeo|midia|mídia|produto|ai|aí|la|lá|agora|hoje)$/i;
  if (!legenda || legenda.length < 3 || genericOnly.test(normalizePt(legenda))) return undefined;
  return legenda;
}

function extrairIdentificadorMidia(texto: string): string | null {
  const textoLimpo = String(texto || "").trim();
  const uuid = textoLimpo.match(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i)?.[0];
  if (uuid) return uuid;

  const codigoRotulado = textoLimpo.match(
    /\b(?:id|c[oó]digo)(?:\s+da)?\s+m[ií]dia\s*[:#-]?\s*([0-9a-f]{8,32})\b/i,
  )?.[1];
  if (codigoRotulado) return codigoRotulado;

  return textoLimpo.match(/\b[0-9a-f]{8}\b/i)?.[0] ?? null;
}

function pedidoReferenciaMidiaGenerica(texto: string, produtoDetectado = ""): boolean {
  const alvo = normalizePt(`${produtoDetectado} ${texto}`);
  if (/^(esse|essa|este|esta|isso|desse|dessa|aquele|aquela)$/i.test(normalizePt(produtoDetectado).trim())) return true;
  return /\b(esse|essa|este|esta|isso|dessa|desse|aquele|aquela|o|a)?\s*(video|foto|imagem|midia)\b/.test(alvo);
}

function nomeCurtoMidia(row: any): string {
  const limpar = (value: unknown) => compactSpaces(String(value || "")).trim();
  const candidatos = [
    limpar(row?.contexto_original),
    limpar(row?.contexto_transcricao),
    limpar(row?.legenda_gerada),
  ];
  const base = candidatos.find((value) => value && !/^sem contexto$/i.test(value));
  if (base) return cleanReceivedMediaDescription(base);

  const tags = Array.isArray(row?.tags_ia)
    ? row.tags_ia.map(limpar).filter(Boolean).slice(0, 3).join(", ")
    : "";
  if (tags) return tags;

  const data = row?.created_at
    ? new Date(row.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
    : "";
  return `${row?.tipo === "video" ? "Vídeo" : "Imagem"}${data ? ` de ${data}` : ""}`;
}

function tempoRelativoMidia(createdAt: string): string {
  const diffMs = Math.max(0, Date.now() - new Date(createdAt).getTime());
  const minutos = Math.floor(diffMs / 60000);
  if (minutos < 1) return "agora";
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `há ${horas}h`;
  if (horas < 48) return "ontem";
  return `há ${Math.floor(horas / 24)} dias`;
}

async function buscarUltimaMidiaDaConversa(
  ctx: { userId: string; fromNumber: string; agentState?: AgentConvState },
): Promise<{ midia: any | null; erro?: string }> {
  const { data, error } = await sb
    .from("midias_whatsapp")
    .select("id, tipo, origem, midia_pai_id, midia_url, contexto_original, contexto_transcricao, legenda_gerada, tags_ia, telefone_origem, created_at")
    .eq("user_id", ctx.userId)
    .eq("telefone_origem", ctx.fromNumber)
    .in("tipo", ["foto", "video"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return { midia: null, erro: error.message };

  const selectedId = selectLatestImplicitMediaId(data, ctx.agentState?.last_media_interaction ?? null);
  if (!selectedId || selectedId === data?.id) return { midia: data ?? null };

  // Uma mídia reencaminhada pode ser deduplicada e conservar o created_at
  // antigo. Nesse caso, last_media_interaction.at representa o evento mais
  // recente da conversa e o ID deduplicado deve vencer.
  const { data: interacted, error: interactedError } = await sb
    .from("midias_whatsapp")
    .select("id, tipo, origem, midia_pai_id, midia_url, contexto_original, contexto_transcricao, legenda_gerada, tags_ia, telefone_origem, created_at")
    .eq("id", selectedId)
    .eq("user_id", ctx.userId)
    .in("tipo", ["foto", "video"])
    .maybeSingle();
  if (interactedError) return { midia: null, erro: interactedError.message };
  return { midia: interacted ?? data ?? null };
}

// Detecta resposta curta só com o formato: "feed", "story", "reels", "no story", "nos stories" etc.
function detectSocialPostIntent(
  text: string,
  options: { allowGenerationChain?: boolean } = {},
): { produto: string; tom: string; redes: string[]; temProduto: boolean; formato?: "feed" | "story" | "reels" } | null {
  const original = compactSpaces(text || "");
  const normalized = normalizePt(original);
  // Pedido de CARROSSEL nunca é post único — quem trata é o roteador de carrossel.
  if (/\bcarrosse(l|is)\b|\bcarousel\b/.test(normalized)) return null;
  if (hasImageGenerationRequest(original) && !options.allowGenerationChain) return null;
  if (!hasSocialPostRequest(original)) return null;


  const redes: string[] = detectRequestedSocialNetworks(original);
  const formatoPedido = detectSocialPostFormat(original);
  if (redes.length === 0 && !formatoPedido) return null;

  const tom = /black\s*friday/i.test(original) ? "black-friday"
    : /prova social/i.test(normalized) ? "prova-social"
    : /benef/i.test(normalized) ? "beneficio"
    : /escassez/i.test(normalized) ? "escassez"
    : "urgencia";

  const withoutJarvis = original.replace(/^jarvis[,.!\s-]*/i, "");
  let produto = "";
  const direct = withoutJarvis.match(/\b(?:posta|poste|postar|publica|publique|publicar)\s+(?:o|a|os|as)?\s*(.+?)(?:\s+(?:no|na|nos|nas|em|para|pra|pro)\s+(?:o\s+|a\s+)?(?:face|facebook|fb|insta|instagram|ig|tiktok|tik\s*tok|linkedin|linked\s*in|lkd|redes sociais|stor(?:y|ies|ie)|reels?|feed)\b|\s+com\s+(?:um\s+)?script\b|$)/i);
  if (direct?.[1]) produto = direct[1];

  const afterNetworks = withoutJarvis.match(/\b(?:face|facebook|fb|insta|instagram|ig|tiktok|tik\s*tok|linkedin|linked\s*in|lkd|redes sociais|stor(?:y|ies|ie)|reels?|feed)\b(?:\s*(?:e|,|\/|\+|no|na|nos|nas|em|para|pra|pro)?\s*(?:face|facebook|fb|insta|instagram|ig|tiktok|tik\s*tok|linkedin|linked\s*in|lkd|redes sociais|stor(?:y|ies|ie)|reels?|feed)\b)*\s+(?:o|a|os|as)?\s*(.+?)(?:\s+com\s+(?:um\s+)?script\b|$)/i);
  if ((!produto || /^(nas?|nos?|em|para|pra|pro|face|facebook|insta|instagram|ig|fb|linkedin|linked\s*in|lkd|stor(y|ies|ie)|reels?|feed)\b/i.test(produto)) && afterNetworks?.[1]) produto = afterNetworks[1];

  const explicitProduct = withoutJarvis.match(/\bproduto\s+(.+?)(?:\s+com\s+(?:um\s+)?script\b|$)/i);
  if ((!produto || /^(nas?|nos?|em|para|pra|pro)\b/i.test(produto)) && explicitProduct?.[1]) produto = explicitProduct[1];

  produto = sanitizeSocialProductText(produto);
  const temProduto = !!produto && produto.length >= 3;
  return { produto: temProduto ? produto : "", tom, redes: uniqueStrings(redes), temProduto, formato: formatoPedido };
}

function invalidSocialVariantsReason(
  redes: string[],
  variantes: Record<string, PostVariantes> | null | undefined,
): string | null {
  if (!Array.isArray(redes) || redes.length === 0) return "lista_de_redes_vazia";
  if (!variantes || typeof variantes !== "object") return "variantes_ausentes";
  for (const rede of redes) {
    const opcoes = variantes[rede];
    if (!opcoes || typeof opcoes !== "object") return `rede_sem_variantes:${rede}`;
    for (const opcao of ["A", "B", "C"] as const) {
      if (typeof opcoes[opcao] !== "string" || !opcoes[opcao].trim()) {
        return `opcao_vazia:${rede}:${opcao}`;
      }
    }
  }
  return null;
}

function formatSocialPostToolResult(raw: string): string {
  let data: any = null;
  try { data = JSON.parse(raw); } catch { return raw; }

  // Novo fluxo: 3 opções A/B/C
  if (data?.status === "aguardando_escolha_variante") {
    const redes: string[] = Array.isArray(data.redes) ? data.redes : [];
    const variantes: Record<string, PostVariantes> = data.variantes || {};
    const invalidReason = invalidSocialVariantsReason(redes, variantes);
    if (invalidReason) {
      console.error("[social_copy][empty_options_blocked]", {
        reason: invalidReason,
        token: typeof data?.token === "string" ? data.token : undefined,
        revisado: data?.revisado === true,
        redes,
        variantKeys: Object.keys(variantes),
      });
      return "Não consegui gerar as opções de copy desta vez. Nenhuma opção foi enviada nem selecionada. Tente pedir o ajuste novamente.";
    }

    // Se todas redes têm o mesmo texto por variante, mostra 1 vez só. Senão mostra por rede.
    const primeira = redes[0];
    const v0 = variantes[primeira];
    const allEqual = redes.every((r) => {
      const v = variantes[r];
      return v.A === v0.A && v.B === v0.B && v.C === v0.C;
    });
    const bloco = (v: PostVariantes) => `*Opção A — Direta*\n${v.A}\n\n*Opção B — História*\n${v.B}\n\n*Opção C — Interativa*\n${v.C}`;
    const blocosPreview = allEqual
      ? [bloco(v0)]
      : redes.map((r) => `━━━ *${r.toUpperCase()}* ━━━\n${bloco(variantes[r])}`);
    const avisoMidia = data?.midia_usada && !data?.midia_usada_enviada ? `${data.midia_usada}<<SPLIT>>` : "";
    const aviso = data?.aviso_formato ? `\n\n_${data.aviso_formato}_` : "";
    const avisoReels = data?.aviso_reels ? `\n_ℹ️ ${data.aviso_reels}_` : "";
    if (data?.carrossel) {
      const avisoFacebook = data?.aviso_facebook ? `<<SPLIT>>⚠️ ${data.aviso_facebook}` : "";
      const resumo = `Carrossel pronto: ${data.cards} cards. ID da mídia: ${data.media_code}. Enviei todos em ordem e ainda não publiquei.`;
      const pergunta = "Antes de publicar ou agendar, escolha o texto: *A*, *B* ou *C*.";
      blocosPreview[blocosPreview.length - 1] += `\n\n${pergunta}`;
      return `${resumo}${avisoFacebook}<<SPLIT>>Preparei 3 opções de legenda 👇<<SPLIT>>${blocosPreview.join("<<SPLIT>>")}`;
    }
    const pergunta = "Qual texto você prefere? Escolha *A*, *B* ou *C*.";
    const cabecalho = `Preparei 3 opções 👇${aviso}${avisoReels}`;

    // A pergunta viaja no MESMO balão que contém opções. Assim, uma falha no
    // envio do preview nunca deixa uma pergunta A/B/C órfã no WhatsApp.
    blocosPreview[blocosPreview.length - 1] += `\n\n${pergunta}`;
    return `${avisoMidia}${cabecalho}<<SPLIT>>${blocosPreview.join("<<SPLIT>>")}`;
  }

  if (data?.status === "variante_selecionada") {
    const opcao = data?.opcao_ativa || "A";
    const preview = Object.entries(data.preview ?? {})
      .map(([rede, script]) => `*${String(rede).toUpperCase()}*\n${script}`)
      .join("\n\n");
    const action = data?.formato === "story"
      ? "Story pelo WhatsApp só pode ser publicado agora."
      : "Agora escolha *Publicar agora* ou *Agendar*.";
    return `✅ Opção *${opcao}* selecionada.<<SPLIT>>${preview}<<SPLIT>>${action}`;
  }

  if (data?.status === "escolha_variante_necessaria") {
    return data.mensagem || "Antes, escolha o texto: A, B ou C.";
  }

  if (data?.status === "aguardando_confirmacao") {
    const scripts = Object.entries(data.preview ?? {})
      .map(([rede, script]) => `*${rede.toUpperCase()}*\n${script}`)
      .join("\n\n");
    const avisoReels = data?.aviso_reels ? `\n\n_ℹ️ ${data.aviso_reels}_` : "";
    // 3 balões separados no WhatsApp: (1) preview, (2) convite de edição, (3) comando de confirmação isolado.
    const convite = `Quer ajustar algo antes de postar? Me diga o que mudar (ex: "mais curto", "foca nas tecnologias da AMZ", "tira o ACABA HOJE", "muda o tom pra profissional"). Se estiver bom, responde:`;
    return `Perfeito, Felicio. Encontrei: *${data.produto?.nome ?? "produto"}*\n\n${scripts}${avisoReels}<<SPLIT>>${convite}<<SPLIT>>pode postar ${data.token}`;
  }

  if (data?.status === "aguardando_retry_instagram") {
    const publicadas = Array.isArray(data.redes_publicadas) && data.redes_publicadas.length
      ? `\n\nJá publicado em: ${data.redes_publicadas.map((r: string) => String(r).toUpperCase()).join(", ")}.`
      : "";
    return `${data.mensagem || "O Instagram ainda está processando a mídia; o container foi preservado para retry."}${publicadas}`;
  }

  if (
    ["agendado", "agendamentos_listados", "sem_agendamentos", "agendamento_cancelado"].includes(String(data?.status))
    && data?.mensagem
  ) {
    return String(data.mensagem);
  }

  if (
    data?.status === "aguardando_privacidade_tiktok"
    || data?.status === "aguardando_declaracao_tiktok"
  ) {
    return data.mensagem || "Antes de publicar no TikTok, escolha quem poderá ver o vídeo.";
  }

  if (data?.status === "publicado") {
    const redesArr = Array.isArray(data.redes_publicadas) ? data.redes_publicadas : [];
    const redesFmt = redesArr.length
      ? redesArr.map((r: string) => `✅ *${String(r).toUpperCase()}*`).join("\n")
      : "⚠️ *nenhuma rede publicou*";
    const falhas = Array.isArray(data.redes_falharam) && data.redes_falharam.length
      ? `\n\n❌ *Falhas:*\n${data.redes_falharam.map((f: any) => `• ${f.rede}${f.erro ? ` — ${f.erro}` : ""}`).join("\n")}`
      : "";
    const notas = Array.isArray(data.notas) && data.notas.length
      ? `\n\n${data.notas.map((n: string) => `ℹ️ ${n}`).join("\n")}`
      : "";
    const header = redesArr.length ? "🎉 *POSTAGEM REALIZADA COM SUCESSO!* 🎉" : "⚠️ *POSTAGEM NÃO CONCLUÍDA*";
    return `${header}\n\n📢 *${data.produto?.nome ?? "produto"}*\n\n${redesFmt}${notas}${falhas}`;
  }

  if (data?.status === "cancelado") return "Preview cancelado. Não publiquei nada.";

  if (data?.erro) {
    if (data?.mensagem) return data.mensagem;
    const sugestoes = Array.isArray(data.sugestoes_do_catalogo) && data.sugestoes_do_catalogo.length
      ? `\n\nSugestões mais próximas:\n${data.sugestoes_do_catalogo.map((s: string) => `• ${s}`).join("\n")}`
      : "";
    return `Não consegui preparar o post: ${data.erro}.${sugestoes}`;
  }

  return raw;
}

type WhatsAppInteractiveList = {
  body: string;
  button: string;
  header?: string;
  footer?: string;
  section_title?: string;
  rows: Array<{ id: string; title: string; description?: string }>;
};

type WhatsAppInteractiveButtons = {
  body: string;
  header?: string;
  footer?: string;
  buttons: Array<{ id: string; title: string }>;
};

function interactiveButtonsFromSocialResult(raw: string): WhatsAppInteractiveButtons | undefined {
  return socialInteractiveButtonsFromResult(raw);
}

function oldPendingPublishConfirmationButtons(
  token: string,
  description: string,
): WhatsAppInteractiveButtons {
  return {
    header: "Confirmar publicação",
    body: `Vou usar ${description}. Como essa aprovação não é recente, confirme antes de publicar.`,
    buttons: [
      { id: `social_publish_confirm:${token}`, title: "Confirmar agora" },
    ],
  };
}

function variantSelectionRequiredResult(
  token: string,
  pending: PendingSocialPost,
): string {
  return JSON.stringify({
    ok: false,
    status: "escolha_variante_necessaria",
    erro: "variante_nao_selecionada",
    mensagem: "Antes, escolha o texto: A, B ou C.",
    token,
    formato: pending.formato || "feed",
    redes: pending.redes,
    variantes: pending.variantes,
  });
}

function interactiveListFromSocialResult(raw: string): WhatsAppInteractiveList | undefined {
  return tiktokInteractiveListFromToolResult(raw);
}

function detectSocialPostConfirmation(text: string): { token: string; cancelar?: boolean } | null {
  const normalized = normalizePt(text || "");
  const token = (text || "").match(/\b[a-f0-9]{8}\b/i)?.[0];
  if (!token) return null;
  if (/\b(cancela|cancelar|nao posta|nao publicar|descarta)\b/.test(normalized)) return { token, cancelar: true };
  if (/\b(pode postar|confirma|confirmar|manda ver|publica|publique|sim|aprovado)\b/.test(normalized)) return { token };
  return null;
}

// Detecta se o briefing escrito/recuperado fala de uma CATEGORIA de produto
// diferente da que aparece na imagem (causa clássica de "post de veículo em foto
// de garrafa d'água" quando um assunto antigo da conversa vaza pro briefing).
const CATEGORIAS_ASSUNTO: Array<{ nome: string; re: RegExp }> = [
  { nome: "veiculo", re: /\b(ve[ií]culo|carro|autom[oó]vel|seminovo|semi-novo|0km|zero\s*km|hatch|sedan|sed[aã]|suv|picape|caminhonete|moto(cicleta)?|c[aâ]mbio|flex|turbo|km\s*rodados?|honda|toyota|hyundai|chevrolet|volkswagen|fiat|ford|renault|nissan|jeep|bmw|mercedes|audi|peugeot|citro[eë]n|civic|corolla|creta|onix|hb20|compass|tracker|hilux|ranger)\b/i },
  { nome: "imovel", re: /\b(im[oó]vel|apartamento|casa\s+(?:à|a)\s+venda|terreno|lote|condom[ií]nio|metros\s+quadrados|m²|quartos?|su[ií]tes?)\b/i },
  { nome: "consorcio", re: /\b(cons[oó]rcio|carta\s+de\s+cr[eé]dito|ademicon|parcelas?\s+mensais|lance)\b/i },
];

function categoriaAssunto(texto: string): string | null {
  for (const c of CATEGORIAS_ASSUNTO) if (c.re.test(texto || "")) return c.nome;
  return null;
}

function categoriaConflitante(descricaoVisual: string, briefing: string): boolean {
  const catBrief = categoriaAssunto(briefing);
  if (!catBrief) return false;
  const catVisual = categoriaAssunto(descricaoVisual);
  // Briefing fala de veículo/imóvel/consórcio e a imagem NÃO é disso → conflito.
  return catVisual !== catBrief;
}

function copyConflitaComImagem(descricaoVisual: string, opcoes: { A: string; B: string; C: string }): boolean {
  const catVisual = categoriaAssunto(descricaoVisual);
  const categoriasCopy = [opcoes.A, opcoes.B, opcoes.C]
    .map((texto) => categoriaAssunto(texto))
    .filter((categoria): categoria is string => !!categoria);

  // Uma copy não pode introduzir categoria especializada ausente da foto.
  return categoriasCopy.some((categoria) => categoria !== catVisual);
}

function detectSocialVariantChoice(text: string): "A" | "B" | "C" | null {
  const normalized = normalizePt(text || "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  const compact = normalized.replace(/\s+/g, "");
  if (/^(a|opcaoa|opcao1|primeira|aprimeira|queroa|gosteidaa|ficaa|vaidea)$/.test(compact)) return "A";
  if (/^(b|opcaob|opcao2|segunda|asegunda|querob|gosteidab|ficab|vaideb)$/.test(compact)) return "B";
  if (/^(c|opcaoc|opcao3|terceira|aterceira|queroc|gosteidac|ficac|vaidec)$/.test(compact)) return "C";
  const m = normalized.match(/\b(?:opcao|opção|quero|gostei da|fica com|vai de|seleciona|escolhe)\s*([abc])\b/i);
  return (m?.[1]?.toUpperCase() as "A" | "B" | "C" | undefined) || null;
}

function detectPlainSocialPostConfirmation(text: string): { cancelar?: boolean } | null {
  const normalized = normalizePt(text || "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  if (/^(cancela|cancelar|nao posta|nao publicar|descarta|deixa pra la)$/.test(normalized)) return { cancelar: true };
  if (/^(sim|ok|ta bom|tudo certo|pode|pode postar|posta|postar|publica|publique|publicar agora|confirmo|confirma|manda|manda ver|vai|aprovado|pode publicar agora)$/.test(normalized)) return {};
  return null;
}

// Reconhece pedidos explícitos de edição de uma copy pendente. O texto original,
// sem normalização nem resumo por IA, é encaminhado integralmente ao gerador.
function detectPlainSocialCopyAdjustment(text: string): string | null {
  const original = compactSpaces(text || "").trim();
  if (original.length < 2 || original.length > 2500) return null;
  const normalized = normalizePt(original);
  const mencionaCopy = /\b(copy|copys|copies|texto|legenda|opcao|post)\b/.test(normalized);
  const pedeMudanca = /\b(ajusta|ajustar|altera|alterar|muda|mudar|troca|trocar|refaz|refazer|reescreve|reescrever|corrige|corrigir|tira|tirar|remove|remover|inclui|incluir|adiciona|adicionar|coloca|colocar|poe|deixa|foca|falar|falando|menciona|mencionar)\b/.test(normalized);
  const criticaCopy = /\b(copy|texto|legenda|opcao|post)\b[\s\S]{0,100}\b(nao|sem|pouco|confus|clar|errad|ruim|generi|long|curt|formal|informal)\b/.test(normalized);
  const instrucaoCurta = /^(mais|menos|sem|com|tira|remove|inclui|adiciona|coloca|poe|deixa|foca|muda|troca|refaz)\b/.test(normalized);
  return ((mencionaCopy && (pedeMudanca || criticaCopy)) || instrucaoCurta) ? original : null;
}

type LatestPendingSocial = {
  token: string;
  count: number;
  description: string;
  isRecent: boolean;
};

function describePendingSocialPost(marker: string | null | undefined, createdAt: string): string {
  const media = midiaTipoFromPendingMarker(marker);
  const mediaLabel = media === "video" ? "vídeo" : media === "carrossel" ? "carrossel" : "post";
  const product = productNameFromPendingMarker(marker);
  const created = new Date(createdAt);
  const nowParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const createdParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(created);
  const time = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  }).format(created);
  const when = nowParts === createdParts
    ? `de hoje às ${time}`
    : `de ${new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
    }).format(created)} às ${time}`;
  return `o ${mediaLabel} de ${product} ${when}`;
}

function describeLoadedPendingSocialPost(pending: PendingSocialPost): string {
  return describePendingSocialPost(
    pendingPostMarker(
      "00000000",
      pending.produto?.nome,
      pending.formato || "feed",
      pending.midiaTipo || pending.produto?.midia_tipo || "foto",
    ),
    new Date(pending.createdAt).toISOString(),
  );
}

async function findLatestPendingSocialToken(
  userId: string,
  fromNumber?: string,
): Promise<LatestPendingSocial | null> {
  const cutoff = new Date(Date.now() - SOCIAL_CONFIRMATION_TTL_MS).toISOString();
  let query = sb
    .from("social_posts_queue")
    .select("error_message, updated_at, created_at, solicitante_telefone")
    .eq("user_id", userId)
    .eq("status", "aguardando_confirmacao")
    .like("error_message", "jarvis_token:%")
    .gte("created_at", cutoff)
    .order("updated_at", { ascending: false })
    .limit(50);
  if (fromNumber) {
    query = query.or(`solicitante_telefone.eq.${fromNumber},solicitante_telefone.is.null`);
  }
  const { data, error } = await query;

  if (error) {
    console.warn("[social_pending][latest_token_error]", error.message);
    return null;
  }
  const grouped = new Map<string, any>();
  for (const row of data ?? []) {
    const token = row.error_message?.match(/jarvis_token:([a-f0-9]{8})/i)?.[1]?.toLowerCase();
    if (token && !grouped.has(token)) grouped.set(token, row);
  }
  const latest = grouped.entries().next().value as [string, any] | undefined;
  if (!latest) return null;
  return {
    token: latest[0],
    count: grouped.size,
    description: describePendingSocialPost(latest[1].error_message, latest[1].created_at),
    isRecent: isPendingInteractionRecent(latest[1].created_at, latest[1].updated_at),
  };
}

async function updatePendingSocialPostMarker(token: string, pending: PendingSocialPost): Promise<void> {
  const interactionAt = new Date();
  const marker = pendingPostMarker(token, pending.produto?.nome, pending.formato || "feed", pending.midiaTipo || (pending.produto as any)?.midia_tipo || "foto", {
    variantes: pending.variantes,
    variantSelecionada: pending.variantSelecionada,
    incluirCtaWhatsapp: pending.incluirCtaWhatsapp,
    tom: pending.tom,
    briefing: pending.briefing ? pending.briefing.slice(0, 1200) : undefined,
    tiktokPrivacyLevel: pending.tiktokPrivacyLevel,
    tiktokPrivacyOptions: pending.tiktokPrivacyOptions,
    tiktokCreatorNickname: pending.tiktokCreatorNickname,
    tiktokMaxDurationSec: pending.tiktokMaxDurationSec,
    tiktokVideoDurationSec: pending.tiktokVideoDurationSec,
    tiktokIsCommercialContent: pending.tiktokIsCommercialContent,
    tiktokBrandOrganic: pending.tiktokBrandOrganic,
    tiktokBrandedContent: pending.tiktokBrandedContent,
    tiktokConsentedAt: pending.tiktokConsentedAt,
    pendingTikTokScheduledAt: pending.pendingTikTokScheduledAt,
  });
  const rowIds = pending.queueRows?.map((r) => r.id).filter(Boolean) ?? [];
  if (rowIds.length > 0) {
    const { error } = await sb.from("social_posts_queue")
      .update({ error_message: marker, updated_at: interactionAt.toISOString() })
      .in("id", rowIds)
      .eq("user_id", pending.userId);
    if (error) throw new Error(`pending_marker_update_failed: ${error.message}`);
  } else {
    const { error } = await sb.from("social_posts_queue")
      .update({ error_message: marker, updated_at: interactionAt.toISOString() })
      .eq("user_id", pending.userId)
      .eq("status", "aguardando_confirmacao")
      .like("error_message", `jarvis_token:${token}%`);
    if (error) throw new Error(`pending_marker_update_failed: ${error.message}`);
  }
  pending.lastInteractionAt = interactionAt.getTime();
}

// LinkedIn (perfil pessoal): tom profissional e link no 1º comentário.
async function publishLinkedInImmediately(
  args: { texto?: string; link?: string; comentario?: string; image_url?: string; midia_id?: string; pedido_original?: string },
  ctx: { userId: string; fromNumber: string; agentState?: AgentConvState },
): Promise<string> {
  let queueId: string | null = null;
  let attemptText = "";
  const fail = async (erro: string, detalhe?: string): Promise<string> => {
    const message = detalhe ? `${erro}: ${detalhe}` : erro;
    if (!queueId && attemptText) {
      const { data: failedRow, error: insertError } = await sb.from("social_posts_queue").insert({
        user_id: ctx.userId,
        produto_id: null,
        produto_source: "linkedin_jarvis",
        platform: "linkedin",
        post_text: attemptText,
        link_url: args?.link || null,
        status: "erro",
        scheduled_at: new Date().toISOString(),
        error_message: message.slice(0, 1000),
      }).select("id").single();
      if (failedRow?.id) queueId = String(failedRow.id);
      if (insertError) console.error("[linkedin-tool][failed-attempt-insert]", insertError.message);
    }
    console.error("[linkedin-tool][failed]", { userId: ctx.userId, queueId, error: message });
    if (queueId) {
      const { error } = await sb.from("social_posts_queue").update({
        status: "erro",
        error_message: message.slice(0, 1000),
        updated_at: new Date().toISOString(),
      }).eq("id", queueId).eq("user_id", ctx.userId);
      if (error) console.error("[linkedin-tool][queue-failure-update]", error.message);
    }
    return JSON.stringify({ ok: false, erro, mensagem: detalhe || erro, queue_id: queueId });
  };

  try {
    if (!isOwner(ctx)) {
      return await fail("acao_restrita_ao_responsavel", "Publicar no LinkedIn é restrito ao responsável da conta.");
    }
    const texto = (args?.texto || "").trim();
    if (!texto) return await fail("texto_obrigatorio", "Não publiquei: faltou o texto do post.");
    attemptText = texto;

    const pedidoOriginal = String(args?.pedido_original || "");
    const pedidoNormalizado = normalizePt(pedidoOriginal);
    const pediuVideo = /\bvideo\b/.test(pedidoNormalizado);
    const pediuImagem = /\b(foto|imagem)\b/.test(pedidoNormalizado);
    const explicitamenteTexto = /\b(texto|copy|artigo|somente texto|apenas texto)\b/.test(pedidoNormalizado);
    let imageUrl = String(args?.image_url || "").trim() || null;
    let videoUrl: string | null = null;
    let mediaId = String(args?.midia_id || "").trim() || null;
    let selectedMedia: any | null = null;
    if (!mediaId && !explicitamenteTexto) {
      const latest = await buscarUltimaMidiaDaConversa(ctx);
      if (latest.erro) {
        return await fail("consulta_midia_conversa_falhou", `Não publiquei: ${latest.erro}`);
      }
      if (!latest.midia) {
        return await fail(
          "midia_conversa_nao_encontrada",
          "Não publiquei: não encontrei imagem ou vídeo nesta conversa. Reenvie a mídia desejada.",
        );
      }
      selectedMedia = latest.midia;
      mediaId = String(latest.midia.id);
    }

    if (mediaId) {
      const resolved: { midia: any | null; erro?: string } = selectedMedia
        ? { midia: selectedMedia }
        : await resolverMidiaBibliotecaPorId(ctx.userId, mediaId);
      if (resolved.erro || !resolved.midia) {
        return await fail("midia_nao_encontrada", `Não publiquei: ${resolved.erro || "mídia ausente"}`);
      }
      mediaId = String(resolved.midia.id);
      const mediaTipo = resolved.midia.tipo === "video" ? "vídeo" : "imagem";
      if (pediuVideo && resolved.midia.tipo !== "video") {
        return await fail(
          "ultima_midia_nao_e_video",
          `Não publiquei: você pediu um vídeo, mas a última produção desta conversa é ${mediaTipo}. Reenvie o vídeo ou informe o código dele.`,
        );
      }
      if (pediuImagem && resolved.midia.tipo !== "foto") {
        return await fail(
          "ultima_midia_nao_e_imagem",
          `Não publiquei: você pediu uma imagem, mas a última produção desta conversa é ${mediaTipo}. Reenvie a imagem ou informe o código dela.`,
        );
      }
      if (
        resolved.midia.origem === "carrossel_whatsapp"
        || resolved.midia.origem === "carrossel_whatsapp_card"
        || resolved.midia.midia_pai_id
      ) {
        return await fail("carrossel_linkedin_nao_suportado", "Não publiquei: carrossel pelo LinkedIn ainda não está habilitado.");
      }
      if (resolved.midia.tipo === "video") {
        videoUrl = String(resolved.midia.midia_url || "") || null;
        imageUrl = null;
      } else if (resolved.midia.tipo === "foto") {
        imageUrl = String(resolved.midia.midia_url || "") || null;
      } else {
        return await fail("midia_incompativel", "Não publiquei: esse tipo de mídia ainda não é aceito no LinkedIn.");
      }

      const midiaUsada = `Usando: ${nomeCurtoMidia(resolved.midia)} - ${resolved.midia.tipo === "video" ? "Vídeo" : "Imagem"} - ${tempoRelativoMidia(resolved.midia.created_at)}`;
      try {
        await sendWhatsApp(
          ctx.userId,
          ctx.fromNumber,
          midiaUsada,
          undefined,
          undefined,
          undefined,
          { alreadyLogged: false },
        );
      } catch (e) {
        return await fail(
          "aviso_midia_falhou",
          `Não publiquei porque não consegui confirmar qual mídia seria usada: ${(e as Error).message}`,
        );
      }
    }

    const corpo = texto
      .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
      .replace(/\b(deixo o )?link (nos coment[áa]rios|no primeiro coment[áa]rio|abaixo)\b\.?/gi, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    // Toda tentativa real nasce na fila antes de consultar conexão ou chamar API.
    const { data: queued, error: queueError } = await sb.from("social_posts_queue").insert({
      user_id: ctx.userId,
      produto_id: null,
      produto_source: "linkedin_jarvis",
      platform: "linkedin",
      post_text: corpo,
      image_url: imageUrl,
      video_url: videoUrl,
      link_url: args?.link || null,
      status: "publicando",
      scheduled_at: new Date().toISOString(),
      error_message: mediaId ? `midia_id:${mediaId}` : null,
    }).select("id").single();
    if (queueError || !queued?.id) {
      console.error("[linkedin-tool][queue-create-failed]", queueError?.message || "id ausente");
      return JSON.stringify({
        ok: false,
        erro: "fila_linkedin_nao_criada",
        mensagem: `Não publiquei porque não consegui registrar a tentativa: ${queueError?.message || "id ausente"}`,
      });
    }
    queueId = String(queued.id);

    const { data: conn, error: connError } = await sb
      .from("linkedin_connections")
      .select("id, is_active")
      .eq("user_id", ctx.userId)
      .maybeSingle();
    if (connError) return await fail("consulta_conexao_falhou", connError.message);
    if (!conn || !(conn as any).is_active) {
      return await fail("linkedin_nao_conectado", "Não publiquei. Conecte o LinkedIn em Configurações → LinkedIn.");
    }

    console.log("[linkedin-tool][request]", {
      userId: ctx.userId,
      queueId,
      mediaId,
      mediaType: videoUrl ? "video" : imageUrl ? "foto" : "texto",
    });
    const res = await fetch(`${SUPABASE_URL}/functions/v1/linkedin-publish`, {
      method: "POST",
      headers: { Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: ctx.userId,
        queue_id: queueId,
        texto: corpo,
        link_url: args?.link || undefined,
        comentario: args?.comentario || undefined,
        image_url: imageUrl || undefined,
        video_url: videoUrl || undefined,
        link_no_primeiro_comentario: true,
      }),
      signal: AbortSignal.timeout(120000),
    });
    const responseText = await res.text();
    console.log("[linkedin-tool][response]", {
      queueId,
      httpStatus: res.status,
      body: responseText.slice(0, 1000),
    });
    let out: any = null;
    try {
      out = JSON.parse(responseText);
    } catch {
      return await fail("resposta_linkedin_invalida", `HTTP ${res.status}: ${responseText.slice(0, 300)}`);
    }
    const postUrn = typeof out?.post_urn === "string" ? out.post_urn.trim() : "";
    if (!res.ok || out?.success !== true || !/^urn:li:/i.test(postUrn)) {
      return await fail("linkedin_nao_confirmou_publicacao", String(out?.error || `HTTP ${res.status}; URN ausente`));
    }

    const { error: successUpdateError } = await sb.from("social_posts_queue").update({
      status: "publicado",
      linkedin_post_urn: postUrn,
      published_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      error_message: null,
    }).eq("id", queueId).eq("user_id", ctx.userId);
    if (successUpdateError) {
      console.error("[linkedin-tool][queue-success-update]", { queueId, error: successUpdateError.message });
    }

    return JSON.stringify({
      ok: true,
      status: "publicado",
      post_urn: postUrn,
      queue_id: queueId,
      media_type: videoUrl ? "video" : imageUrl ? "foto" : "texto",
      link_no_primeiro_comentario: !!out.comentario_publicado,
      link_no_corpo: !!out.link_no_corpo,
    });
  } catch (e) {
    return await fail("falha_publicacao_linkedin", (e as Error).message);
  }
}

async function toolPrepararLinkedin(
  args: { texto?: string; link?: string; image_url?: string; midia_id?: string; pedido_original?: string },
  ctx: { userId: string; fromNumber: string; convId?: string; agentState?: AgentConvState },
): Promise<string> {
  if (!isOwner(ctx)) {
    return JSON.stringify({
      erro: "acao_restrita_ao_responsavel",
      mensagem: "Preparar publicação no LinkedIn é restrito ao responsável da conta.",
    });
  }
  const original = String(args?.pedido_original || "");
  if (isCarrosselRequest(original)) {
    return JSON.stringify({
      erro: "carrossel_linkedin_nao_suportado",
      mensagem: "Carrossel pelo LinkedIn ainda não está habilitado. Não publiquei nada.",
    });
  }
  const textOnly = shouldPrepareLinkedInTextOnly({
    requestText: original,
    mediaId: args?.midia_id,
    imageUrl: args?.image_url,
  });
  if (!textOnly) {
    const resolved = await resolverMidiaParaPublicacao({
      midiaId: args?.midia_id,
      pedidoOriginal: original,
    }, ctx);
    if (resolved.erro) {
      return JSON.stringify({
        erro: "consulta_midia_conversa_falhou",
        mensagem: `Não consegui consultar as mídias desta conversa agora: ${resolved.erro}. Não publiquei nada.`,
      });
    }
    if (!resolved.midia?.id) {
      return JSON.stringify({
        erro: "midia_nao_encontrada",
        mensagem: "Qual mídia você quer publicar? Me mande o código (ID da mídia) ou diga 'o último vídeo'.",
      });
    }
    return await toolPostarMidiaBiblioteca({
      midia_id: resolved.midia.id,
      pedido_original: original,
      legenda: args?.texto,
      briefing: args?.texto,
      link: args?.link,
      redes: ["linkedin"],
      formato: "feed",
      tom: "beneficio",
    }, ctx);
  }

  const texto = String(args?.texto || "").trim();
  if (!texto) {
    return JSON.stringify({ erro: "texto_obrigatorio", mensagem: "Diga o tema do post para eu preparar as opções." });
  }
  const produto = {
    id: null,
    source: "linkedin_text",
    nome: texto.slice(0, 100),
    descricao: texto,
    imagem_url: null,
    link: args?.link || null,
    midia_tipo: "foto" as const,
  };
  const variantesLinkedIn = await gerarTresOpcoesRedeSocial(
    produto,
    "beneficio",
    "linkedin",
    undefined,
    undefined,
    texto,
  );
  const token = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const pending: PendingSocialPost = {
    produto,
    tom: "beneficio",
    redes: ["linkedin"],
    scripts: { linkedin: variantesLinkedIn.A },
    variantes: { linkedin: variantesLinkedIn },
    userId: ctx.userId,
    requesterPhone: ctx.fromNumber,
    createdAt: Date.now(),
    formato: "feed",
    midiaTipo: "foto",
    briefing: texto,
  };
  const queueRows = await persistPendingSocialPost(token, pending);
  PENDING_POSTS.set(token, { ...pending, queueRows });
  return JSON.stringify({
    status: "aguardando_escolha_variante",
    token,
    formato: "feed",
    produto: { nome: produto.nome, imagem_url: null, link: produto.link },
    tom: "beneficio",
    redes: ["linkedin"],
    variantes: { linkedin: variantesLinkedIn },
  });
}

async function toolPostarRedesSociais(
  args: { produto: string; tom?: string; redes?: string[]; incluir_cta_whatsapp?: boolean; midia_id?: string; pedido_original?: string },
  ctx: { userId: string; fromNumber: string; convId?: string; agentState?: AgentConvState },
): Promise<string> {
  try {
    if (!isOwner(ctx)) return JSON.stringify({ erro: "acao_restrita_ao_responsavel", mensagem: "Essa ação é restrita ao responsável da conta. Posso encaminhar o pedido para ele, se quiser." });
    pendingCleanup();
    const pedidoOriginal = String(args?.pedido_original || "");
    if (
      publicationMediaReference(pedidoOriginal) ||
      extrairIdentificadorMidia(pedidoOriginal) ||
      String(args?.midia_id || "").trim()
    ) {
      return await toolPostarMidiaBiblioteca({
        midia_id: args?.midia_id,
        pedido_original: pedidoOriginal,
        legenda: args?.produto,
        briefing: args?.produto,
        tom: args?.tom,
        redes: args?.redes,
        incluir_cta_whatsapp: args?.incluir_cta_whatsapp,
      }, ctx);
    }
    const q = (args?.produto || "").trim();
    if (!q) return JSON.stringify({ erro: "informe qual produto postar" });

    const redes = (args?.redes && args.redes.length > 0 ? args.redes : ["facebook", "instagram", "tiktok"])
      .map(canonicalSocialNetwork)
      .filter((network): network is NonNullable<typeof network> =>
        !!network && SUPPORTED_SOCIAL_NETWORKS.includes(network)
      );
    const tom = args?.tom || "urgencia";
    const incluirCta = !!args?.incluir_cta_whatsapp;

    if (redes.includes("tiktok")) {
      return JSON.stringify({
        erro: "tiktok_exige_video",
        mensagem: "Produtos do catálogo usam foto neste fluxo, e o TikTok aceita apenas vídeo. Retire o TikTok ou envie um vídeo pela biblioteca de mídias.",
      });
    }

    const { produto: prod, sugestoes, candidatos } = await buscarProdutoParaPostagem(q, ctx.userId);

    if (!prod) {
      return JSON.stringify({
        erro: `produto "${q}" não encontrado`,
        dica: "Tente uma palavra-chave do nome real ou escolha uma das sugestões abaixo.",
        sugestoes_do_catalogo: sugestoes.length ? sugestoes : (candidatos ?? []).slice(0, 7).map((r: any) => r.nome),
      });
    }

    if (prod.ativo === false) return JSON.stringify({ erro: `produto "${prod.nome}" foi encontrado, mas está inativo no catálogo`, sugestoes_do_catalogo: sugestoes });
    if (!prod.imagem_url && redes.some((r) => r === "instagram" || r === "tiktok")) {
      return JSON.stringify({ erro: `produto "${prod.nome}" não tem imagem cadastrada — Instagram/TikTok exigem imagem`, sugestoes_do_catalogo: sugestoes });
    }

    // Gera 3 OPÇÕES (A/B/C) por rede em paralelo — estilo plataforma /gerar-posts
    const variantesEntries = await Promise.all(
      redes.map(async (r) => {
        const redeGen = r === "tiktok"
          ? "instagram"
          : (r as "facebook" | "instagram" | "linkedin");
        return [r, await gerarTresOpcoesRedeSocial(prod, tom, redeGen)] as const;
      }),
    );
    let variantes: Record<string, PostVariantes> = Object.fromEntries(variantesEntries);
    let scripts: Record<string, string> = Object.fromEntries(variantesEntries.map(([r, v]) => [r, v.A]));
    const invalidReason = invalidSocialVariantsReason(redes, variantes);
    if (invalidReason) {
      console.error("[postar_redes][empty_options]", { reason: invalidReason, userId: ctx.userId, redes });
      return JSON.stringify({
        erro: "falha_ao_gerar_opcoes",
        mensagem: "Não consegui gerar as três opções de copy. Tente novamente; não vou pedir A/B/C sem antes mostrar as opções.",
      });
    }

    // Feature A: CTA de WhatsApp (opt-in) — número dinâmico do tenant. Aplica em TODAS as variantes.
    let ctaNota: string | undefined;
    if (incluirCta) {
      const telAgente = await buscarTelefoneAgenteTenant(ctx.userId);
      if (telAgente) {
        variantes = Object.fromEntries(Object.entries(variantes).map(([r, v]) => [r, r === "linkedin"
          ? {
            A: sanitizeLinkedInApprovalCopy(`${v.A}\n\nhttps://wa.me/${telAgente}`),
            B: sanitizeLinkedInApprovalCopy(`${v.B}\n\nhttps://wa.me/${telAgente}`),
            C: sanitizeLinkedInApprovalCopy(`${v.C}\n\nhttps://wa.me/${telAgente}`),
          }
          : {
            A: appendWhatsappCta(v.A, telAgente),
            B: appendWhatsappCta(v.B, telAgente),
            C: appendWhatsappCta(v.C, telAgente),
          }]));
        scripts = Object.fromEntries(Object.entries(variantes).map(([r, v]) => [r, v.A]));
        ctaNota = `CTA de WhatsApp incluído (wa.me/${telAgente}).`;
      } else {
        ctaNota = "Não achei o número do agente pra montar o CTA — post sai sem CTA.";
      }
    }

    const token = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
    const pending: PendingSocialPost = { produto: prod, tom, redes, scripts, variantes, userId: ctx.userId, requesterPhone: ctx.fromNumber, createdAt: Date.now(), incluirCtaWhatsapp: incluirCta };
    const queueRows = await persistPendingSocialPost(token, pending);
    PENDING_POSTS.set(token, { ...pending, queueRows });

    return JSON.stringify({
      status: "aguardando_escolha_variante",
      token,
      produto: { nome: prod.nome, preco: prod.preco, imagem_url: prod.imagem_url, link: prod.link },
      tom,
      redes,
      variantes, // { facebook: {A,B,C}, instagram: {A,B,C}, ... }
      cta_whatsapp: incluirCta,
      cta_nota: ctaNota,
      instrucoes: `FASE 1: mostre as 3 OPÇÕES (A, B, C) e peça uma escolha. Não ofereça publicar nem agendar antes disso. ${incluirCta ? "" : "Se ainda não incluiu CTA de WhatsApp, pergunte também se quer incluir. "}Ao escolher A/B/C, chame escolher_variante_post com token="${token}". Se pedir ajuste, chame revisar_post_pendente; as novas opções voltam à FASE 1.`,
    });
  } catch (e) {
    return JSON.stringify({ erro: String((e as Error).message) });
  }
}


async function toolConfirmarPostagemRedes(
  args: { token: string; cancelar?: boolean },
  ctx: { userId: string; fromNumber: string; convId?: string; agentState?: AgentConvState },
): Promise<string> {
  if (!isOwner(ctx)) return JSON.stringify({ erro: "acao_restrita_ao_responsavel", mensagem: "Essa ação é restrita ao responsável da conta." });
  pendingCleanup();
  const token = (args?.token || "").trim().toLowerCase();
  if (!/^[a-f0-9]{8}$/.test(token)) return JSON.stringify({ erro: "token inválido" });
  const p = PENDING_POSTS.get(token) ?? (await loadPendingSocialPost(token, ctx.userId));
  if (!p) return JSON.stringify({ erro: "token não encontrado ou expirado. Refaça o pedido de postagem." });
  if (p.userId !== ctx.userId) return JSON.stringify({ erro: "token pertence a outro usuário" });
  if (args?.cancelar) {
    PENDING_POSTS.delete(token);
    if (p.queueRows?.length) {
      await sb.from("social_posts_queue")
        .update({ status: "cancelado", error_message: "cancelado_pelo_whatsapp", updated_at: new Date().toISOString() })
        .in("id", p.queueRows.map((r) => r.id))
        .eq("user_id", ctx.userId);
    }
    if (ctx.convId && p.midiaTipo === "carrossel") {
      const conversation = { id: ctx.convId, userId: ctx.userId, contactNumber: ctx.fromNumber };
      const current = ctx.agentState ?? await loadAgentState(sb, conversation);
      await saveAgentState(sb, conversation, { pending_carousel: null }, current);
      current.pending_carousel = null;
      ctx.agentState = current;
    }
    return JSON.stringify({ status: "cancelado" });
  }

  if (!canRunSocialPostAction(p.variantSelecionada)) {
    return variantSelectionRequiredResult(token, p);
  }

  if (p.midiaTipo === "carrossel") {
    const carouselState = ctx.agentState?.pending_carousel;
    if (
      carouselState?.token !== token
      || carouselState.media_id !== p.produto?.id
      || !Array.isArray(carouselState.image_urls)
      || carouselState.image_urls.length < 2
    ) {
      return JSON.stringify({
        erro: "snapshot_carrossel_indisponivel",
        mensagem: "Não encontrei o snapshot exato dos cards que você aprovou. Não publiquei nada; gere a prévia novamente.",
      });
    }
    p.produto.image_urls = [...carouselState.image_urls];
  }

  if (p.redes.includes("tiktok")) {
    if (p.produto?.midia_tipo !== "video" && p.midiaTipo !== "video") {
      return JSON.stringify({
        erro: "tiktok_exige_video",
        mensagem: "O TikTok aceita apenas vídeo neste fluxo. Envie um vídeo antes de publicar no TikTok.",
      });
    }
    if (!p.tiktokPrivacyLevel) {
      // A API do TikTok exige creator_info atualizado antes de cada escolha.
      const creatorInfo = await fetchTikTokPrivacyOptions(p.userId);
      if (creatorInfo.error || creatorInfo.options.length === 0) {
        console.error("[tiktok][privacy_preflight_failed]", { userId: p.userId, error: creatorInfo.error });
        return JSON.stringify({
          erro: "tiktok_privacy_indisponivel",
          mensagem: `Não consegui consultar as opções de privacidade do TikTok: ${creatorInfo.error || "nenhuma opção disponível"}. Nada foi publicado.`,
        });
      }
      const atualizado = { ...p, tiktokPrivacyOptions: creatorInfo.options };
      PENDING_POSTS.set(token, atualizado);
      await updatePendingSocialPostMarker(token, atualizado);
      return JSON.stringify({
        status: "aguardando_privacidade_tiktok",
        token,
        privacy_options: creatorInfo.options,
        mensagem: "Antes de publicar no TikTok, escolha quem poderá ver o vídeo.",
      });
    }
  }

  if (p.midiaTipo === "carrossel") {
    const queueIds = p.queueRows?.map((row) => row.id).filter(Boolean) ?? [];
    if (queueIds.length !== p.redes.length || queueIds.length === 0) {
      return JSON.stringify({
        erro: "fila_confirmacao_ausente",
        mensagem:
          "Não encontrei a fila completa deste preview. Não publiquei nada.",
      });
    }
    const { data: claimed, error: claimError } = await sb.from("social_posts_queue")
      .update({ status: "publicando", updated_at: new Date().toISOString() })
      .in("id", queueIds)
      .eq("user_id", ctx.userId)
      .eq("status", "aguardando_confirmacao")
      .select("id");
    if (claimError) return JSON.stringify({ erro: "falha_ao_reservar_publicacao", mensagem: `Não publiquei porque não consegui reservar este preview: ${claimError.message}` });
    if ((claimed?.length ?? 0) !== queueIds.length) {
      return JSON.stringify({ erro: "confirmacao_ja_processada", mensagem: "Este preview já foi confirmado ou está sendo publicado. Não enviei de novo." });
    }
  }

  if (
    p.redes.includes("linkedin") &&
    (p.midiaTipo === "video" || p.produto?.midia_tipo === "video") &&
    !String(p.produto?.imagem_url || "").trim()
  ) {
    return JSON.stringify({
      erro: "video_linkedin_sem_arquivo",
      mensagem: "Não publiquei no LinkedIn porque o arquivo do vídeo não está disponível. Envie o vídeo novamente ou informe outro ID de mídia.",
    });
  }

  const resultados = await Promise.all(p.redes.map((r) => publicarEmRede(
    r,
    p.scripts[r],
    p.produto,
    p.userId,
    p.formato || "feed",
    r === "instagram" ? p.instagramCreationId : undefined,
    r === "tiktok" ? p.tiktokPrivacyLevel : undefined,
    p.queueRows?.find((row) => row.platform === r)?.id,
  )));
  try {
    await updatePersistedSocialPostRows(p, resultados, token);
  } catch (e) {
    console.error("[social_confirm][final_persistence_failed]", { token, error: (e as Error).message });
    PENDING_POSTS.delete(token);
    return JSON.stringify({
      erro: "resultado_publicacao_nao_persistido",
      mensagem: "A rede respondeu, mas não consegui gravar o resultado final. Não confirme novamente para evitar duplicidade; confira o Instagram.",
      detalhes: resultados,
    });
  }

  const retryInstagram = resultados.find((r) =>
    r.rede === "instagram"
    && !r.ok
    && r.resposta?.retryable === true
    && typeof r.resposta?.creation_id === "string"
  );
  if (retryInstagram) {
    const atualizado = { ...p, redes: ["instagram"], instagramCreationId: retryInstagram.resposta.creation_id };
    PENDING_POSTS.set(token, atualizado);
    return JSON.stringify({
      status: "aguardando_retry_instagram",
      token,
      creation_id: retryInstagram.resposta.creation_id,
      container_status: retryInstagram.resposta.container_status,
      redes_publicadas: resultados.filter((r) => r.ok).map((r) => r.rede),
      mensagem: `O Instagram ainda está processando a mídia. Guardei o container ${retryInstagram.resposta.creation_id}; responda "pode postar" para tentar publicar o mesmo container, sem criar outro.`,
    });
  }
  PENDING_POSTS.delete(token);
  if (ctx.convId && p.midiaTipo === "carrossel" && resultados.some((result) => result.ok)) {
    const conversation = { id: ctx.convId, userId: ctx.userId, contactNumber: ctx.fromNumber };
    const current = ctx.agentState ?? await loadAgentState(sb, conversation);
    await saveAgentState(sb, conversation, { pending_carousel: null }, current);
    current.pending_carousel = null;
    ctx.agentState = current;
  }
  return JSON.stringify({
    status: "publicado",
    produto: { nome: p.produto.nome },
    redes_publicadas: resultados.filter((r) => r.ok).map((r) => r.rede),
    redes_falharam: resultados.filter((r) => !r.ok).map((r) => ({ rede: r.rede, status: r.status, erro: r.resposta?.error || r.resposta?.message })),
    notas: resultados.filter((r) => r.ok && (r as any).nota).map((r) => (r as any).nota),
    detalhes: resultados,
  });
}

async function toolAgendarPostPendente(
  args: { token?: string; data_hora_sp?: string },
  ctx: { userId: string; fromNumber: string; convId?: string; agentState?: AgentConvState },
): Promise<string> {
  if (!isOwner(ctx)) return JSON.stringify({ ok: false, erro: "acao_restrita_ao_responsavel" });
  pendingCleanup();
  const token = String(args?.token || "").trim().toLowerCase();
  if (!/^[a-f0-9]{8}$/.test(token)) return JSON.stringify({ ok: false, erro: "token_invalido", mensagem: "Não encontrei o criativo que deve ser agendado." });
  const pending = PENDING_POSTS.get(token) ?? await loadPendingSocialPost(token, ctx.userId);
  if (!pending || pending.userId !== ctx.userId) {
    return JSON.stringify({ ok: false, erro: "token_nao_encontrado", mensagem: "Não encontrei esse criativo aguardando confirmação." });
  }
  if (!canRunSocialPostAction(pending.variantSelecionada)) {
    return variantSelectionRequiredResult(token, pending);
  }
  if (pending.formato === "story") {
    return JSON.stringify({
      ok: false,
      erro: "story_nao_agendavel",
      mensagem: "Story ainda não pode ser agendado pelo WhatsApp. Posso publicar agora, ou você agenda pelo site em Story Foto (Agendar).",
    });
  }
  const scheduledDate = parseSaoPauloDateTime(args?.data_hora_sp);
  if (!scheduledDate) {
    return JSON.stringify({ ok: false, erro: "data_invalida", mensagem: "Informe a data no formato YYYY-MM-DD HH:MM, em horário de São Paulo." });
  }
  if (scheduledDate.getTime() < Date.now() + 10 * 60 * 1000) {
    return JSON.stringify({ ok: false, erro: "data_muito_proxima", mensagem: "Escolha um horário com pelo menos 10 minutos de antecedência." });
  }

  const hasTikTok = pending.redes.includes("tiktok");
  const isVideo = pending.midiaTipo === "video" || pending.produto?.midia_tipo === "video";
  const scheduledNetworks = hasTikTok && !isVideo
    ? pending.redes.filter((network) => network !== "tiktok")
    : [...pending.redes];

  if (hasTikTok && isVideo && (!pending.tiktokPrivacyLevel || !pending.tiktokConsentedAt)) {
    const creatorInfo = await fetchTikTokPrivacyOptions(pending.userId);
    if (creatorInfo.error || creatorInfo.options.length === 0) {
      return JSON.stringify({
        ok: false,
        erro: "tiktok_privacy_indisponivel",
        mensagem: `Não consegui validar a conta TikTok: ${creatorInfo.error || "nenhuma privacidade disponível"}. Nada foi agendado.`,
      });
    }
    const videoDuration = await loadPendingTikTokVideoDuration(pending);
    if (videoDuration == null) {
      return JSON.stringify({
        ok: false,
        erro: "tiktok_duracao_indisponivel",
        mensagem: "Não consegui verificar a duração deste vídeo para o limite da conta TikTok. Nada foi agendado no TikTok.",
      });
    }
    if (
      creatorInfo.maxDurationSec != null
      && videoDuration > creatorInfo.maxDurationSec
    ) {
      return JSON.stringify({
        ok: false,
        erro: "tiktok_video_muito_longo",
        mensagem: `Este vídeo tem ${Math.ceil(videoDuration)}s, mas a conta TikTok aceita no máximo ${creatorInfo.maxDurationSec}s. Nada foi agendado.`,
      });
    }
    const atualizado = {
      ...pending,
      tiktokPrivacyOptions: creatorInfo.options,
      tiktokCreatorNickname: creatorInfo.creatorNickname,
      tiktokMaxDurationSec: creatorInfo.maxDurationSec,
      tiktokVideoDurationSec: videoDuration,
      // A escolha de um fluxo anterior de "Publicar agora" não vale como
      // consentimento do novo agendamento.
      tiktokPrivacyLevel: undefined,
      tiktokConsentedAt: undefined,
      pendingTikTokScheduledAt: scheduledDate.toISOString(),
    };
    PENDING_POSTS.set(token, atualizado);
    await updatePendingSocialPostMarker(token, atualizado);
    return JSON.stringify({
      ok: false,
      status: "aguardando_privacidade_tiktok",
      token,
      privacy_options: creatorInfo.options,
      creator_nickname: creatorInfo.creatorNickname,
      mensagem: `Antes de agendar no TikTok${creatorInfo.creatorNickname ? ` da conta ${creatorInfo.creatorNickname}` : ""}, escolha quem poderá ver o vídeo. Nenhuma opção vem marcada.`,
    });
  }
  if (scheduledNetworks.length === 0) {
    return JSON.stringify({
      ok: false,
      erro: "tiktok_exige_video",
      mensagem: "O TikTok aceita só vídeo. Envie um vídeo para agendar nessa rede.",
    });
  }

  let imageUrls = Array.isArray(pending.produto?.image_urls)
    ? pending.produto.image_urls.filter((url: unknown): url is string => typeof url === "string" && !!url.trim())
    : [];
  if (pending.midiaTipo === "carrossel" && imageUrls.length < 2 && pending.produto?.id) {
    imageUrls = await loadCarouselImageUrls(ctx.userId, pending.produto.id);
  }
  if (pending.midiaTipo === "carrossel" && imageUrls.length < 2) {
    return JSON.stringify({ ok: false, erro: "carrossel_incompleto", mensagem: "Não encontrei todos os cards do carrossel; gere a prévia novamente." });
  }

  const rowIds = (pending.queueRows ?? [])
    .filter((row) => scheduledNetworks.includes(row.platform))
    .map((row) => row.id);
  if (rowIds.length !== scheduledNetworks.length) {
    return JSON.stringify({ ok: false, erro: "fila_incompleta", mensagem: "Não encontrei todas as linhas deste criativo; nada foi agendado." });
  }
  const mediaUrl = pending.produto?.imagem_url || null;
  const { data: updatedRows, error } = await sb.from("social_posts_queue")
    .update({
      status: "pendente",
      scheduled_at: scheduledDate.toISOString(),
      approval_token: token,
      error_message: null,
      image_url: isVideo ? null : mediaUrl,
      video_url: isVideo ? mediaUrl : null,
      image_urls: imageUrls.length >= 2 ? imageUrls : null,
      solicitante_telefone: ctx.fromNumber,
      notificado_em: null,
      instagram_creation_id: null,
      instagram_container_status: null,
      tiktok_privacy_level: pending.tiktokPrivacyLevel || null,
      tiktok_is_commercial_content: !!pending.tiktokIsCommercialContent,
      tiktok_brand_organic: !!pending.tiktokBrandOrganic,
      tiktok_branded_content: !!pending.tiktokBrandedContent,
      tiktok_consented_at: pending.tiktokConsentedAt || null,
      tiktok_creator_nickname: pending.tiktokCreatorNickname || null,
      tiktok_video_duration_sec: pending.tiktokVideoDurationSec || null,
      tiktok_publish_id: null,
      tiktok_post_row_id: null,
      tiktok_publish_status: null,
      tiktok_processing_started_at: null,
      tiktok_fail_reason: null,
      tiktok_retry_count: 0,
      tiktok_next_retry_at: null,
      updated_at: new Date().toISOString(),
    })
    .in("id", rowIds)
    .eq("user_id", ctx.userId)
    .eq("status", "aguardando_confirmacao")
    .select("id");
  if (error || (updatedRows?.length ?? 0) !== rowIds.length) {
    return JSON.stringify({
      ok: false,
      erro: "agendamento_nao_persistido",
      mensagem: `Não consegui guardar o agendamento; nada deve ser considerado confirmado.${error?.message ? ` ${error.message}` : ""}`,
    });
  }

  PENDING_POSTS.delete(token);
  if (hasTikTok && !isVideo) {
    const tiktokRows = (pending.queueRows ?? [])
      .filter((row) => row.platform === "tiktok")
      .map((row) => row.id);
    if (tiktokRows.length > 0) {
      await sb.from("social_posts_queue")
        .update({
          status: "cancelado",
          approval_token: null,
          error_message: "tiktok_exige_video",
          updated_at: new Date().toISOString(),
        })
        .in("id", tiktokRows)
        .eq("user_id", ctx.userId)
        .eq("status", "aguardando_confirmacao");
    }
  }
  if (ctx.convId && pending.midiaTipo === "carrossel") {
    const conversation = { id: ctx.convId, userId: ctx.userId, contactNumber: ctx.fromNumber };
    const current = ctx.agentState ?? await loadAgentState(sb, conversation);
    await saveAgentState(sb, conversation, { pending_carousel: null }, current);
    current.pending_carousel = null;
    ctx.agentState = current;
  }

  const when = formatScheduledDate(scheduledDate);
  const networks = formatSocialNetworks(scheduledNetworks);
  const warning = hasTikTok && !isVideo
    ? " O TikTok aceita só vídeo, então segui com as outras redes."
    : "";
  return JSON.stringify({
    ok: true,
    status: "agendado",
    token,
    scheduled_at: scheduledDate.toISOString(),
    data_extenso: when,
    redes: scheduledNetworks,
    mensagem: `Agendado para ${when} no ${networks}. Para desfazer, responda: cancelar agendamento.${warning}`,
    aviso_tiktok: hasTikTok && !isVideo,
  });
}

async function loadScheduledSocialGroups(userId: string): Promise<ScheduledSocialGroup[]> {
  const { data, error } = await sb.from("social_posts_queue")
    .select("id, platform, scheduled_at, approval_token")
    .eq("user_id", userId)
    .eq("status", "pendente")
    .gt("scheduled_at", new Date().toISOString())
    .not("approval_token", "is", null)
    .order("scheduled_at", { ascending: true })
    .limit(100);
  if (error) throw new Error(error.message);
  const grouped = new Map<string, ScheduledSocialGroup>();
  for (const row of data ?? []) {
    const token = String(row.approval_token || "");
    if (!token || !row.scheduled_at) continue;
    const group = grouped.get(token) ?? {
      token,
      scheduledAt: row.scheduled_at,
      networks: [] as string[],
      rowIds: [] as string[],
    };
    group.networks.push(row.platform);
    group.rowIds.push(row.id);
    grouped.set(token, group);
  }
  return [...grouped.values()].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
}

async function toolListarAgendamentosPosts(
  ctx: { userId: string; fromNumber: string },
): Promise<string> {
  if (!isOwner(ctx)) return JSON.stringify({ ok: false, erro: "acao_restrita_ao_responsavel" });
  try {
    const groups = await loadScheduledSocialGroups(ctx.userId);
    if (!groups.length) return JSON.stringify({ ok: true, status: "sem_agendamentos", mensagem: "Você não tem posts agendados pelo WhatsApp." });
    const lines = groups.map((group, index) =>
      `${index + 1}. ${formatScheduledDate(new Date(group.scheduledAt))} — ${formatSocialNetworks(group.networks)} — código ${group.token.toUpperCase()}`
    );
    return JSON.stringify({ ok: true, status: "agendamentos_listados", agendamentos: groups, mensagem: `Próximos agendamentos:\n${lines.join("\n")}` });
  } catch (error) {
    return JSON.stringify({ ok: false, erro: "falha_ao_listar", mensagem: (error as Error).message });
  }
}

async function toolCancelarAgendamentoPost(
  args: { token?: string },
  ctx: { userId: string; fromNumber: string },
): Promise<string> {
  if (!isOwner(ctx)) return JSON.stringify({ ok: false, erro: "acao_restrita_ao_responsavel" });
  try {
    const groups = await loadScheduledSocialGroups(ctx.userId);
    if (!groups.length) return JSON.stringify({ ok: false, erro: "sem_agendamentos", mensagem: "Você não tem posts agendados pelo WhatsApp para cancelar." });
    const requested = String(args?.token || "").trim().toLowerCase();
    let selected = requested ? groups.find((group) => group.token.toLowerCase() === requested) : undefined;
    if (requested && !selected) {
      return JSON.stringify({ ok: false, erro: "agendamento_nao_encontrado", mensagem: "Não encontrei um agendamento futuro com esse código." });
    }
    if (!selected && groups.length > 1) {
      const lines = groups.map((group, index) =>
        `${index + 1}. ${formatScheduledDate(new Date(group.scheduledAt))} — ${formatSocialNetworks(group.networks)} — código ${group.token.toUpperCase()}`
      );
      return JSON.stringify({
        ok: false,
        erro: "selecao_necessaria",
        mensagem: `Você tem mais de um agendamento. Qual deseja cancelar?\n${lines.join("\n")}\nResponda com o código.`,
      });
    }
    selected ??= groups[0];
    const { data, error } = await sb.from("social_posts_queue")
      .update({
        status: "cancelado",
        error_message: "cancelado_pelo_whatsapp",
        updated_at: new Date().toISOString(),
      })
      .in("id", selected.rowIds)
      .eq("user_id", ctx.userId)
      .eq("status", "pendente")
      .select("id");
    if (error || (data?.length ?? 0) !== selected.rowIds.length) throw new Error(error?.message || "nem todas as linhas foram canceladas");
    return JSON.stringify({
      ok: true,
      status: "agendamento_cancelado",
      token: selected.token,
      mensagem: `Agendamento de ${formatScheduledDate(new Date(selected.scheduledAt))} no ${formatSocialNetworks(selected.networks)} cancelado.`,
    });
  } catch (error) {
    return JSON.stringify({ ok: false, erro: "falha_ao_cancelar", mensagem: (error as Error).message });
  }
}

async function toolRemarcarAgendamentoPost(
  args: { token?: string; data_hora_sp?: string },
  ctx: { userId: string; fromNumber: string },
): Promise<string> {
  if (!isOwner(ctx)) return JSON.stringify({ ok: false, erro: "acao_restrita_ao_responsavel" });
  const scheduledDate = parseSaoPauloDateTime(args?.data_hora_sp);
  if (!scheduledDate) {
    return JSON.stringify({
      ok: false,
      erro: "data_invalida",
      mensagem: "Informe o novo dia e horário. Ex.: 30/09 às 10h.",
    });
  }
  if (!hasMinimumScheduleLead(scheduledDate)) {
    return JSON.stringify({
      ok: false,
      erro: "data_muito_proxima",
      mensagem: "Escolha um horário com pelo menos 10 minutos de antecedência.",
    });
  }

  try {
    const groups = await loadScheduledSocialGroups(ctx.userId);
    const requested = String(args?.token || "").trim().toLowerCase();
    const choice = chooseSocialSchedule(groups, requested);
    let selected = choice.selected;
    if (choice.reason === "selection_required") {
      const lines = groups.map((group, index) =>
        `${index + 1}. ${formatScheduledDate(new Date(group.scheduledAt))} — ${formatSocialNetworks(group.networks)} — código ${group.token.toUpperCase()}`
      );
      return JSON.stringify({
        ok: false,
        erro: "selecao_necessaria",
        mensagem: `Você tem mais de um agendamento. Qual deseja remarcar?\n${lines.join("\n")}\nResponda com o código e o novo horário.`,
      });
    }
    if (!selected) {
      if (requested) {
        const { data: tokenRows } = await sb.from("social_posts_queue")
          .select("status, scheduled_at")
          .eq("user_id", ctx.userId)
          .eq("approval_token", requested)
          .limit(20);
        if ((tokenRows?.length ?? 0) > 0) {
          return JSON.stringify({
            ok: false,
            erro: "agendamento_nao_remarcavel",
            mensagem: "Esse post já está sendo publicado, foi publicado, falhou ou foi cancelado e não pode mais ser remarcado.",
          });
        }
      }
      return JSON.stringify({
        ok: false,
        erro: "sem_agendamentos",
        mensagem: "Você não tem posts futuros pendentes para remarcar.",
      });
    }

    const nowIso = new Date().toISOString();
    const { data: allTokenRows, error: stateError } = await sb.from("social_posts_queue")
      .select("id, status, scheduled_at")
      .eq("user_id", ctx.userId)
      .eq("approval_token", selected.token)
      .limit(100);
    const everyRowIsFuturePending = !stateError
      && allRowsAreFuturePending(allTokenRows ?? []);
    if (!everyRowIsFuturePending) {
      return JSON.stringify({
        ok: false,
        erro: "agendamento_nao_remarcavel",
        mensagem: "Esse post já está sendo publicado, foi publicado, falhou ou foi cancelado e não pode mais ser remarcado.",
      });
    }
    const rowIds = allTokenRows!.map((row) => row.id);
    const { data, error } = await sb.from("social_posts_queue")
      .update({
        scheduled_at: scheduledDate.toISOString(),
        solicitante_telefone: ctx.fromNumber,
        notificado_em: null,
        updated_at: nowIso,
      })
      .in("id", rowIds)
      .eq("user_id", ctx.userId)
      .eq("status", "pendente")
      .gt("scheduled_at", nowIso)
      .select("id");
    if (error || (data?.length ?? 0) !== rowIds.length) {
      return JSON.stringify({
        ok: false,
        erro: "agendamento_nao_remarcavel",
        mensagem: "O post começou a ser processado ou mudou de estado e não pode mais ser remarcado.",
      });
    }
    return JSON.stringify({
      ok: true,
      status: "agendamento_remarcado",
      token: selected.token,
      scheduled_at: scheduledDate.toISOString(),
      mensagem: `Remarcado para ${formatScheduledDate(scheduledDate)} no ${formatSocialNetworks(selected.networks)}. Para desfazer, responda: cancelar agendamento.`,
    });
  } catch (error) {
    return JSON.stringify({
      ok: false,
      erro: "falha_ao_remarcar",
      mensagem: `Não consegui remarcar o post: ${(error as Error).message}`,
    });
  }
}

async function applyPendingTikTokPrivacyChoice(
  token: string,
  text: string,
  ctx: { userId: string; fromNumber: string },
): Promise<string | null> {
  const p = PENDING_POSTS.get(token) ?? (await loadPendingSocialPost(token, ctx.userId));
  if (!p || p.userId !== ctx.userId || !p.redes.includes("tiktok") || !p.tiktokPrivacyOptions?.length) return null;
  if (p.pendingTikTokScheduledAt && p.tiktokPrivacyLevel && !p.tiktokConsentedAt) {
    const disclosure = parseTikTokDisclosure(text);
    if (!disclosure) return null;
    if (disclosure === "branded_content" && p.tiktokPrivacyLevel === "SELF_ONLY") {
      const atualizado = { ...p, tiktokPrivacyLevel: undefined };
      PENDING_POSTS.set(token, atualizado);
      await updatePendingSocialPostMarker(token, atualizado);
      return JSON.stringify({
        status: "aguardando_privacidade_tiktok",
        token,
        privacy_options: p.tiktokPrivacyOptions,
        mensagem: "Conteúdo de outra marca não pode usar “Somente eu”. Escolha outra privacidade para continuar.",
      });
    }
    const atualizado = {
      ...p,
      tiktokIsCommercialContent: disclosure !== "non_commercial",
      tiktokBrandOrganic: disclosure === "brand_organic",
      tiktokBrandedContent: disclosure === "branded_content",
      tiktokConsentedAt: new Date().toISOString(),
    };
    PENDING_POSTS.set(token, atualizado);
    await updatePendingSocialPostMarker(token, atualizado);
    const scheduled = new Date(atualizado.pendingTikTokScheduledAt!);
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(scheduled).map((part) => [part.type, part.value]));
    const scheduleResult = await toolAgendarPostPendente(
      { token, data_hora_sp: `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}` },
      ctx,
    );
    try {
      const parsed = JSON.parse(scheduleResult);
      if (parsed?.erro === "data_muito_proxima") {
        return JSON.stringify({
          ok: false,
          status: "aguardando_novo_horario_tiktok",
          erro: "data_muito_proxima",
          token,
          mensagem: "O horário ficou muito próximo. Informe só um novo dia e horário, com pelo menos 10 minutos de antecedência.",
        });
      }
    } catch { /* devolve a resposta original */ }
    return scheduleResult;
  }

  const choice = matchTikTokPrivacyChoice(
    privacyChoiceText(text),
    p.tiktokPrivacyOptions,
  );
  if (!choice) return null;
  console.log("[tiktok][privacy_selected]", { token, userId: ctx.userId, privacy_level: choice });
  const atualizado = { ...p, tiktokPrivacyLevel: choice };
  PENDING_POSTS.set(token, atualizado);
  await updatePendingSocialPostMarker(token, atualizado);
  if (atualizado.pendingTikTokScheduledAt) {
    return JSON.stringify({
      status: "aguardando_declaracao_tiktok",
      token,
      mensagem: "Este vídeo é conteúdo comercial? Escolha uma opção. Ao escolher, você confirma que tem os direitos da música e aceita o Music Usage Confirmation do TikTok. Comentários, dueto e stitch ficarão desligados.",
    });
  }
  return await toolConfirmarPostagemRedes({ token }, ctx);
}

// ---- revisar_post_pendente: regenera o script com um ajuste solicitado pelo dono, MANTENDO token/mídia/formato ----
async function toolRevisarPostPendente(
  args: { token: string; ajuste?: string; incluir_cta_whatsapp?: boolean },
  ctx: { userId: string; fromNumber: string },
): Promise<string> {
  if (!isOwner(ctx)) return JSON.stringify({ erro: "acao_restrita_ao_responsavel", mensagem: "Essa ação é restrita ao responsável da conta." });
  pendingCleanup();
  const token = (args?.token || "").trim().toLowerCase();
  const ajuste = (args?.ajuste || "").toString().trim();
  const toggleCta = typeof args?.incluir_cta_whatsapp === "boolean";
  if (!/^[a-f0-9]{8}$/.test(token)) return JSON.stringify({ erro: "token inválido" });
  if (ajuste.length < 2 && !toggleCta) return JSON.stringify({ erro: "ajuste vazio — descreva o que mudar" });
  if (ajuste.length >= 2) {
    console.log("[revisar_post][adjustment_received]", { token, chars: ajuste.length });
  }

  const p = PENDING_POSTS.get(token) ?? (await loadPendingSocialPost(token, ctx.userId));
  if (!p) return JSON.stringify({ erro: "token não encontrado ou expirado. Refaça o pedido de postagem." });
  if (p.userId !== ctx.userId) return JSON.stringify({ erro: "token pertence a outro usuário" });

  // Reconstroi produtoLike com descrição/contexto atual — não repergunta contexto.
  let produtoLike: any = { ...p.produto };
  const source = p.produto?.source;
  try {
    if (source === "midias_whatsapp" && p.produto?.id) {
      const { data: midia } = await sb.from("midias_whatsapp")
        .select("id, tipo, midia_url, contexto_original")
        .eq("id", p.produto.id)
        .eq("user_id", ctx.userId)
        .single();
      if (midia) {
        const contextoRaw = (midia.contexto_original || "").toString();
        const mVisao = contextoRaw.match(/\[visão\]\s*([\s\S]+)/i);
        const descricaoVisual = mVisao ? mVisao[1].trim() : "";
        const contextoUsuario = contextoRaw.replace(/\n?\[visão\][\s\S]*/i, "").trim();
        const isVideo = midia.tipo === "video";
        const descricaoFinal = isVideo
          ? contextoUsuario
          : [contextoUsuario, descricaoVisual ? `Conteúdo da imagem: ${descricaoVisual}` : ""].filter(Boolean).join("\n").trim();
        produtoLike = {
          ...produtoLike,
          nome: p.produto.nome,
          descricao: descricaoFinal || null,
          imagem_url: midia.midia_url,
          midia_tipo: isVideo ? "video" : "foto",
        };
      }
    } else if (source === "produtos" && p.produto?.id) {
      const { data: prod } = await sb.from("produtos")
        .select("*")
        .eq("id", p.produto.id)
        .eq("user_id", ctx.userId)
        .single();
      if (prod) produtoLike = { ...prod, source: "produtos" };
    }
  } catch (e) {
    console.warn("[revisar_post] reload produto falhou:", (e as Error).message);
  }

  const tom = p.tom || "urgencia";
  // Mantém o brand context nas revisões quando é conteúdo da marca AMZ.
  const ctxLower = `${produtoLike?.nome || ""} ${produtoLike?.descricao || ""}`.toLowerCase();
  const isBrandContent = /\bamz\s*ofertas\b|\bamz\b|amzofertas|\blogo\s*(da|do)?\s*(amz|empresa|marca)?\b|institucional|nossa\s+plataforma/i.test(ctxLower)
    || produtoLike?.source === "midias_whatsapp";
  const brandCtx = isBrandContent ? AMZ_BRAND_PITCH : undefined;

  // Se ajuste vazio (apenas toggle de CTA), reaproveita variantes atuais sem regerar.
  let variantes: Record<string, PostVariantes>;
  if (ajuste.length < 2 && toggleCta) {
    // Remove CTA anterior de todas as variantes; será reaplicado abaixo se incluirCta.
    const stripCta = (s: string) => (s || "")
      .replace(/\n{1,2}📱 Fale comigo no WhatsApp:.*$/i, "")
      .replace(/\n{1,2}https:\/\/wa\.me\/\d+\s*/gi, "\n")
      .trimEnd();
    if (p.variantes) {
      variantes = Object.fromEntries(Object.entries(p.variantes).map(([r, v]) => [r, {
        A: stripCta(v.A), B: stripCta(v.B), C: stripCta(v.C),
      }]));
    } else {
      // Compat: sem variantes antigas, usa scripts atuais como A/B/C iguais.
      variantes = Object.fromEntries(Object.entries(p.scripts).map(([r, s]) => [r, { A: stripCta(s), B: stripCta(s), C: stripCta(s) }]));
    }
  } else {
    // Regenera 3 NOVAS opções aplicando o ajuste.
    const varEntries = await Promise.all(
      p.redes.map(async (r) => {
        const redeGen = r === "tiktok"
          ? "instagram"
          : (r as "facebook" | "instagram" | "linkedin");
        return [r, await gerarTresOpcoesRedeSocial(produtoLike, tom, redeGen, ajuste, brandCtx, p.briefing)] as const;
      }),
    );
    variantes = Object.fromEntries(varEntries);
  }

  const invalidReason = invalidSocialVariantsReason(p.redes, variantes);
  if (invalidReason) {
    console.error("[revisar_post][empty_options]", {
      reason: invalidReason,
      token,
      userId: ctx.userId,
      redes: p.redes,
      adjustmentChars: ajuste.length,
    });
    return JSON.stringify({
      erro: "falha_ao_regenerar_opcoes",
      mensagem: "Não consegui regenerar as três opções com esse ajuste. O post anterior foi mantido; tente novamente.",
    });
  }

  // Feature A: CTA de WhatsApp (opt-in) — aplica em TODAS as variantes.
  const incluirCta = toggleCta ? !!args?.incluir_cta_whatsapp : !!p.incluirCtaWhatsapp;
  let ctaNota: string | undefined;
  if (incluirCta) {
    const telAgente = await buscarTelefoneAgenteTenant(ctx.userId);
    if (telAgente) {
      variantes = Object.fromEntries(Object.entries(variantes).map(([r, v]) => [r, r === "linkedin"
        ? {
          A: sanitizeLinkedInApprovalCopy(`${v.A}\n\nhttps://wa.me/${telAgente}`),
          B: sanitizeLinkedInApprovalCopy(`${v.B}\n\nhttps://wa.me/${telAgente}`),
          C: sanitizeLinkedInApprovalCopy(`${v.C}\n\nhttps://wa.me/${telAgente}`),
        }
        : {
          A: appendWhatsappCta(v.A, telAgente),
          B: appendWhatsappCta(v.B, telAgente),
          C: appendWhatsappCta(v.C, telAgente),
        }]));
      ctaNota = `CTA de WhatsApp incluído (wa.me/${telAgente}).`;
    } else {
      ctaNota = "Não achei o número do agente pra montar o CTA — post sai sem CTA.";
    }
  }

  const scripts: Record<string, string> = Object.fromEntries(
    Object.entries(variantes).map(([r, v]) => [r, v.A])
  );

  // Atualiza social_posts_queue.
  if (p.queueRows?.length) {
    await Promise.all(p.queueRows.map((row) => {
      const novo = scripts[row.platform];
      if (!novo) return Promise.resolve();
      return sb.from("social_posts_queue")
        .update({ post_text: novo, updated_at: new Date().toISOString() })
        .eq("id", row.id)
        .eq("user_id", ctx.userId);
    }));
  }

  const atualizado: PendingSocialPost = {
    ...p,
    scripts,
    variantes,
    variantSelecionada: undefined,
    incluirCtaWhatsapp: incluirCta,
  };
  PENDING_POSTS.set(token, atualizado);
  await updatePendingSocialPostMarker(token, atualizado);

  return JSON.stringify({
    status: "aguardando_escolha_variante",
    revisado: true,
    token,
    formato: p.formato || "feed",
    redes: p.redes,
    variantes,
    cta_whatsapp: incluirCta,
    cta_nota: ctaNota,
    instrucoes: `FASE 1 novamente: mostre as opções A/B/C revisadas e exija uma escolha. Não publique nem agende antes disso. Se responder A/B/C, chame escolher_variante_post. Se pedir novo ajuste, chame revisar_post_pendente com token="${token}".`,
  });
}

// ---- escolher_variante_post: swap barato da opção ativa (A/B/C), sem regerar IA ----
async function toolEscolherVariantePost(
  args: { token: string; opcao: string },
  ctx: { userId: string; fromNumber: string },
): Promise<string> {
  if (!isOwner(ctx)) return JSON.stringify({ erro: "acao_restrita_ao_responsavel", mensagem: "Essa ação é restrita ao responsável da conta." });
  pendingCleanup();
  const token = (args?.token || "").trim().toLowerCase();
  const opcaoRaw = (args?.opcao || "").toString().trim().toUpperCase();
  const opcao = (opcaoRaw.match(/[ABC]/)?.[0] || "") as "A" | "B" | "C" | "";
  if (!/^[a-f0-9]{8}$/.test(token)) return JSON.stringify({ erro: "token inválido" });
  if (!opcao) return JSON.stringify({ erro: "opção inválida — use A, B ou C" });

  const p = PENDING_POSTS.get(token) ?? (await loadPendingSocialPost(token, ctx.userId));
  if (!p) return JSON.stringify({ erro: "token não encontrado ou expirado" });
  if (p.userId !== ctx.userId) return JSON.stringify({ erro: "token pertence a outro usuário" });
  if (!p.variantes) return JSON.stringify({ erro: "esse post não tem variantes — use confirmar_postagem_redes direto" });

  const scripts: Record<string, string> = Object.fromEntries(
    Object.entries(p.variantes).map(([r, v]) => [r, selectSocialVariantScripts(v, opcao)])
  );

  const atualizado: PendingSocialPost = { ...p, scripts, variantSelecionada: opcao };
  const marker = pendingPostMarker(token, atualizado.produto?.nome, atualizado.formato || "feed", atualizado.midiaTipo || atualizado.produto?.midia_tipo || "foto", {
    variantes: atualizado.variantes,
    variantSelecionada: atualizado.variantSelecionada,
    incluirCtaWhatsapp: atualizado.incluirCtaWhatsapp,
    tom: atualizado.tom,
    briefing: atualizado.briefing ? atualizado.briefing.slice(0, 1200) : undefined,
  });
  if (!atualizado.queueRows?.length) return JSON.stringify({ erro: "fila da variante não encontrada" });
  const updateErrors = await Promise.all(atualizado.queueRows.map(async (row) => {
    const novo = scripts[row.platform];
    if (!novo) return `copy ausente para ${row.platform}`;
    const { data, error } = await sb.from("social_posts_queue")
      .update({ post_text: novo, error_message: marker, updated_at: new Date().toISOString() })
      .eq("id", row.id)
      .eq("user_id", ctx.userId)
      .eq("status", "aguardando_confirmacao")
      .select("id");
    return error?.message ?? ((data?.length ?? 0) === 1 ? null : `linha ${row.id} não estava pendente`);
  }));
  const failures = updateErrors.filter(Boolean);
  if (failures.length > 0) {
    return JSON.stringify({ erro: "variante_nao_persistida", mensagem: `Não troquei a opção porque não consegui guardar a escolha: ${failures.join(" | ")}` });
  }
  PENDING_POSTS.set(token, atualizado);

  return JSON.stringify({
    status: "variante_selecionada",
    token,
    opcao_ativa: opcao,
    formato: atualizado.formato || "feed",
    preview: scripts,
    instrucoes: `Mostre que a Opção ${opcao} está ativa e ofereça publicar agora ou agendar. Se confirmar publicação, chame confirmar_postagem_redes com token="${token}". Se informar uma data futura, chame agendar_post_pendente com o mesmo token. Se pedir ajuste, chame revisar_post_pendente.`,
  });
}






async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", Uint8Array.from(bytes).buffer);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function buscarMidiaDuplicadaExata(
  userId: string,
  tipo: "foto" | "video",
  mimeType: string,
  bytes: Uint8Array,
): Promise<any | null> {
  const { data: candidates, error } = await sb
    .from("midias_whatsapp")
    .select("id, tipo, midia_url, mime_type, tamanho_bytes, duracao_segundos, origem, contexto_original, contexto_transcricao, legenda_gerada, tags_ia, created_at")
    .eq("user_id", userId)
    .eq("tipo", tipo)
    .eq("mime_type", mimeType)
    .eq("tamanho_bytes", bytes.length)
    .order("created_at", { ascending: false })
    .limit(12);
  if (error || !candidates?.length) return null;

  const incomingHash = await sha256Hex(bytes);
  for (const candidate of candidates) {
    try {
      const response = await fetch(candidate.midia_url);
      if (!response.ok) continue;
      const stored = new Uint8Array(await response.arrayBuffer());
      if (stored.length !== bytes.length) continue;
      if (await sha256Hex(stored) === incomingHash) return candidate;
    } catch (e) {
      console.warn("[salvar_midia][dedup] candidato indisponível:", candidate.id, (e as Error).message);
    }
  }
  return null;
}

function rotuloMidiaReconhecida(row: any): string {
  if (row?.tipo === "video") {
    if (/motion/i.test(String(row?.origem || ""))) return "Vídeo animado";
    if (/legend|render/i.test(String(row?.origem || ""))) return "Vídeo legendado";
    return "Vídeo";
  }
  if (/edicao|edit/i.test(String(row?.origem || ""))) return "Imagem editada";
  if (/ia|gerad/i.test(String(row?.origem || ""))) return "Imagem gerada";
  if (/anuncio/i.test(String(row?.origem || ""))) return "Imagem de anúncio";
  return "Imagem";
}

// ---- salvar_midia_biblioteca: pega a mídia enviada pelo cliente (foto/vídeo/áudio) e salva na biblioteca de Mídias ----
async function salvarItemMidiaBiblioteca(
  media: MediaExtract,
  ctx: { userId: string; fromNumber?: string },
  contexto: string,
): Promise<{ id: string; tipo: "foto" | "video" | "audio"; url: string; reutilizada?: boolean; nome?: string; rotulo?: string }> {
  const bytes = base64Decode(media.base64);
  const tipoMap = { image: "foto", video: "video", audio: "audio" } as const;
  const tipo = tipoMap[media.kind as keyof typeof tipoMap] || "foto";
  if (tipo === "foto" || tipo === "video") {
    const duplicada = await buscarMidiaDuplicadaExata(ctx.userId, tipo, media.mime, bytes);
    if (duplicada) {
      if (tipo === "video" && !(Number(duplicada.duracao_segundos) > 0)) {
        const duration = parseMp4DurationSeconds(bytes);
        if (duration) {
          const { error } = await sb.from("midias_whatsapp")
            .update({
              duracao_segundos: integerMediaDurationSeconds(duration),
            })
            .eq("id", duplicada.id)
            .eq("user_id", ctx.userId);
          if (error) console.warn("[salvar_midia][duracao_duplicada]", error.message);
        }
      }
      return {
        id: duplicada.id,
        tipo,
        url: duplicada.midia_url,
        reutilizada: true,
        nome: nomeCurtoMidia(duplicada),
        rotulo: rotuloMidiaReconhecida(duplicada),
      };
    }
  }

  const ext = (media.mime.split("/")[1] || "bin").split(";")[0];
  const fileName = `midias/${ctx.userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error: upErr } = await sb.storage
    .from("produtos")
    .upload(fileName, bytes, { contentType: media.mime, upsert: false });
  if (upErr) throw new Error(`upload_falhou: ${upErr.message}`);

  const { data: pub } = sb.storage.from("produtos").getPublicUrl(fileName);
  const url = pub?.publicUrl;
  if (!url) throw new Error("sem_url_publica");

  const { data: novo, error: insErr } = await sb
    .from("midias_whatsapp")
    .insert({
      user_id: ctx.userId,
      origem: "whatsapp",
      telefone_origem: ctx.fromNumber ?? null,
      tipo,
      midia_url: url,
      mime_type: media.mime,
      tamanho_bytes: bytes.length,
      duracao_segundos: tipo === "video"
        ? integerMediaDurationSeconds(parseMp4DurationSeconds(bytes))
        : null,
      contexto_original: contexto || media.caption || null,
      status: "pendente",
    })
    .select("id")
    .single();

  if (insErr) throw new Error(`db_falhou: ${insErr.message}`);
  console.log("[salvar_midia] salvo id=", novo.id, "tipo=", tipo, "bytes=", bytes.length, "url=", url);
  return { id: novo.id, tipo, url };
}


type MidiaSalva = {
  id: string;
  tipo: "foto" | "video" | "audio";
  url: string;
  reutilizada?: boolean;
  nome?: string;
  rotulo?: string;
};

function respostaMidiaSalva(salvos: MidiaSalva[], descricaoVisual?: string, remetenteEhDono = false): string {
  const total = salvos.length;
  const tipos = salvos.reduce((acc, item) => {
    acc[item.tipo] = (acc[item.tipo] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const partes = [
    tipos.foto ? `${tipos.foto} foto${tipos.foto > 1 ? "s" : ""}` : "",
    tipos.video ? `${tipos.video} vídeo${tipos.video > 1 ? "s" : ""}` : "",
    tipos.audio ? `${tipos.audio} áudio${tipos.audio > 1 ? "s" : ""}` : "",
  ].filter(Boolean).join(", ");
  const temFoto = (tipos.foto ?? 0) > 0;
  const temVideo = (tipos.video ?? 0) > 0;
  const reconhecidas = remetenteEhDono
    ? salvos.filter((item) => item.reutilizada && (item.tipo === "foto" || item.tipo === "video"))
    : [];
  if (reconhecidas.length === salvos.length && reconhecidas.length > 0) {
    return reconhecidas.map((item) =>
      recognizedMediaReply({
        type: item.tipo,
        description: item.nome,
      })
    ).join("\n");
  }
  const blocoCodigos = salvos
    .filter((item) => item.tipo === "foto" || item.tipo === "video")
    .map((item) => linhaCodigoMidia(item.id, item.tipo === "video" ? "video" : "foto"))
    .join("\n");
  const comCodigos = (texto: string) => blocoCodigos ? `${texto}\n\n${blocoCodigos}` : texto;
  if (!remetenteEhDono) {
    if (temFoto && descricaoVisual?.trim()) {
      return comCodigos(`Recebi ${partes || "a mídia"}. A imagem mostra: ${descricaoVisual.trim()}\n\nSe você quiser, eu encaminho isso para o responsável.`);
    }
    return comCodigos(`Recebi ${partes || "a mídia"}. Se você quiser, eu encaminho isso para o responsável.`);
  }
  // VÍDEO: como não temos visão de vídeo, coletar rede+formato+legenda numa pergunta só (evita loop de contexto).
  if (temVideo && !temFoto) {
    return comCodigos(`Salvei ${partes} na biblioteca /midias. Como não consigo assistir vídeo, me diga tudo numa mensagem só: **onde publicar** (Instagram / Facebook / ambos), **formato** (Feed, Story ou Reels) e uma **legenda/contexto** (do que se trata). Ex.: "Reels no Insta e Face — Interruptor touch-screen Tramontina, chique e prático".`);
  }
  if (temFoto && descricaoVisual?.trim()) {
    return comCodigos(`Salvei ${partes || "a mídia"} na biblioteca /midias. Estou vendo uma imagem que mostra: ${descricaoVisual.trim()}\n\nO que você quer que eu faça com ela? Posso preparar a legenda e o post para as redes.`);
  }
  const instrucao = temFoto
    ? " INSTRUÇÃO PRO ASSISTENTE: analise VISUALMENTE a(s) imagem(ns) que o cliente acabou de mandar (você as recebeu no conteúdo desta mensagem) e descreva em 1-2 frases o que aparece nela (produto, cena, cor, contexto). Depois confirme que salvou. NÃO responda genericamente — mostre que viu a foto."
    : "";
  return comCodigos(`${total === 1 ? "Salvei" : "Salvei"} ${partes || "a mídia"} na biblioteca /midias. Não usei produto do catálogo; publique/reuse por lá quando quiser.${instrucao}`);
}

async function descreverFotosSalvas(
  medias: MediaExtract[],
  salvos: MidiaSalva[],
  contexto: string,
  userId: string,
): Promise<string> {
  const fotos = medias
    .map((m, i) => ({ m, id: salvos[i]?.id, tipo: salvos[i]?.tipo, url: salvos[i]?.url, reutilizada: salvos[i]?.reutilizada }))
    .filter((x) => !x.reutilizada)
    .filter((x) => x.tipo === "foto");
  if (fotos.length === 0) return "";

  const descricoes = await Promise.all(fotos.map(async (f) => {
    let d = f.url ? await descreverImagemVisao(f.url) : "";
    if (!d) {
      const dataUrl = `data:${f.m.mime};base64,${f.m.base64}`;
      d = await descreverImagemVisao(dataUrl);
    }
    if (d && f.id) {
      await sb
        .from("midias_whatsapp")
        .update({ contexto_original: contexto ? `${contexto}\n\n[visão] ${d}` : `[visão] ${d}` })
        .eq("id", f.id)
        .eq("user_id", userId);
    }
    return d;
  }));
  return descricoes.filter(Boolean).join(" | ");
}

async function toolSalvarMidiaBiblioteca(
  args: { contexto?: string },
  ctx: { userId: string; fromNumber: string; media?: MediaExtract[]; convId?: string; agentState?: AgentConvState },
): Promise<string> {
  const medias = (ctx.media || []).filter((m) => m.kind === "image" || m.kind === "video" || m.kind === "audio");
  if (medias.length === 0) {
    return JSON.stringify({
      erro: "sem_midia",
      mensagem: "Não encontrei nenhuma foto, vídeo ou áudio nessa conversa. Me manda a mídia e depois pede pra salvar.",
    });
  }

  try {
    const contexto = (args?.contexto || "").trim();
    const remetenteEhDono = !!ctx.fromNumber && isOwner({ userId: ctx.userId, fromNumber: ctx.fromNumber });
    const salvos = await Promise.all(medias.map((m) => salvarItemMidiaBiblioteca(m, ctx, contexto)));
    const ultimaSelecionavel = salvos.filter((item) => item.tipo === "foto" || item.tipo === "video").at(-1);
    if (ultimaSelecionavel) {
      const remembered = await rememberLastMediaInteraction(ctx, ultimaSelecionavel.id);
      if (!remembered && ultimaSelecionavel.reutilizada) {
        return JSON.stringify({
          erro: "interacao_midia_nao_persistida",
          mensagem: "Reconheci a mídia, mas não consegui marcá-la como a última desta conversa com segurança. Não criei duplicata; tente reenviar.",
        });
      }
    }

    // Descreve a(s) foto(s) por visão pra Jarvis conseguir comentar o que viu e pra alimentar futura copy.
    let descricaoVisual = "";
    try {
      descricaoVisual = await descreverFotosSalvas(medias, salvos, contexto, ctx.userId);
    } catch (e) {
      console.warn("[salvar_midia][visao] falhou:", (e as Error).message);
    }

    return JSON.stringify({
      ok: true,
      status: salvos.every((item) => item.reutilizada) ? "midia_reconhecida" : undefined,
      midia_id: salvos[0]?.id,
      midia_ids: salvos.map((s) => s.id),
      tipos: salvos.map((s) => s.tipo),
      descricao_visual: descricaoVisual || undefined,
      mensagem: respostaMidiaSalva(salvos, descricaoVisual, remetenteEhDono),
      instrucao_assistente: descricaoVisual
        ? remetenteEhDono
          ? `Você VIU a imagem. Ela mostra: "${descricaoVisual}". Comente 1-2 linhas confirmando o que viu (produto/tema/cor/texto principal) antes de dizer que salvou em /midias. NÃO responda genérico.`
          : `Você VIU a imagem. Ela mostra: "${descricaoVisual}". Responda como atendimento a CLIENTE/CONTATO: nunca chame de chefe/dono, nunca pergunte onde postar e nunca ofereça publicar em redes. Se fizer sentido, ofereça encaminhar para o responsável.`
        : undefined,
    });
  } catch (e) {
    return JSON.stringify({ erro: String((e as Error).message) });
  }
}

// Recupera o TEXTO SUBSTANCIAL mais recente que o dono escreveu nesta conversa
// SOMENTE quando ele pede explicitamente ("usa aquele texto que te mandei").
// Janela curta (padrão 20 min) e, se informado, só mensagens POSTERIORES ao envio
// da mídia — evita pegar assunto antigo e gerar post fora de contexto.
async function buscarBriefingRecenteDono(userId: string, fromNumber: string, afterISO?: string): Promise<string> {
  try {
    const digits = normalizePhoneBR(fromNumber || "");
    if (!digits) return "";
    const tail8 = digits.slice(-8);
    const { data: convs } = await sb
      .from("whatsapp_cloud_conversations")
      .select("id, contact_number")
      .eq("user_id", userId)
      .order("last_message_at", { ascending: false })
      .limit(200);
    const conv = (convs ?? []).find((c: any) => normalizePhoneBR(c.contact_number || "").slice(-8) === tail8);
    if (!conv?.id) return "";

    const janela = new Date(Date.now() - 20 * 60 * 1000).toISOString();
    const since = afterISO && afterISO > janela ? afterISO : janela;
    const { data: msgs } = await sb
      .from("whatsapp_cloud_messages")
      .select("direction, content, created_at")
      .eq("conversation_id", conv.id)
      .eq("direction", "inbound")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(25);


    const comando = /^(a|b|c|op[cç][aã]o\s*[abc]|sim|ok|pode postar|posta|publica|manda|vai|confirma|feed|story|stories|reels)\b/i;
    for (const m of msgs ?? []) {
      const t = String(m.content || "")
        .replace(/^🎙️\s*Áudio transcrito:\s*/i, "")
        .trim();
      if (t.length < 90) continue;
      if (comando.test(t)) continue;
      return t.slice(0, 2500);
    }
    return "";
  } catch (e) {
    console.error("[postar_midia] briefing recente falhou:", e);
    return "";
  }
}

// ---- postar_midia_biblioteca: usa ID explícito ou a última mídia deste fio (nunca do usuário global) ----
async function resolverMidiaBibliotecaPorId(
  userId: string,
  idInformado: string,
): Promise<{ midia: any | null; erro?: string }> {
  const idLimpo = String(idInformado || "").trim().replace(/[^a-fA-F0-9-]/g, "").toLowerCase();
  if (!idLimpo) return { midia: null, erro: "Identificador de mídia vazio." };

  const campos = "id, tipo, origem, midia_pai_id, midia_url, contexto_original, contexto_transcricao, legenda_gerada, tags_ia, telefone_origem, created_at";
  const uuidCompleto = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idLimpo);
  if (uuidCompleto) {
    const { data, error } = await sb
      .from("midias_whatsapp")
      .select(campos)
      .eq("user_id", userId)
      .eq("id", idLimpo)
      .maybeSingle();
    if (error) return { midia: null, erro: `db_falhou: ${error.message}` };
    return { midia: data ?? null };
  }

  // O WhatsApp exibe códigos curtos como 53DBDA63, derivados do início do UUID.
  // Convertemos o prefixo em um intervalo UUID para consultar diretamente no
  // banco, sempre limitado ao mesmo tenant e com detecção de ambiguidade.
  if (!/^[0-9a-f]{8,32}$/i.test(idLimpo.replace(/-/g, ""))) {
    return { midia: null, erro: "Identificador de mídia inválido." };
  }
  const prefixo = idLimpo.replace(/-/g, "");
  const formatarUuid = (hex: string) => `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
  const inicioUuid = formatarUuid(prefixo.padEnd(32, "0"));
  const fimUuid = formatarUuid(prefixo.padEnd(32, "f"));
  const { data, error } = await sb
    .from("midias_whatsapp")
    .select(campos)
    .eq("user_id", userId)
    .in("tipo", ["foto", "video"])
    .gte("id", inicioUuid)
    .lte("id", fimUuid)
    .order("created_at", { ascending: false })
    .limit(2);
  if (error) return { midia: null, erro: `db_falhou: ${error.message}` };
  const encontradas = data || [];
  if (encontradas.length > 1) return { midia: null, erro: "Código curto ambíguo. Informe o identificador completo." };
  return { midia: encontradas[0] ?? null };
}

async function resolverMidiaParaPublicacao(
  input: { midiaId?: string; pedidoOriginal?: string },
  ctx: { userId: string; fromNumber: string; agentState?: AgentConvState },
): Promise<{ midia: any | null; erro?: string }> {
  const pedidoOriginal = String(input.pedidoOriginal || "");
  const referencia = publicationMediaReference(pedidoOriginal);
  const compativel = (midia: any): boolean =>
    referencia === "video"
      ? midia?.tipo === "video"
      : referencia === "image"
      ? midia?.tipo === "foto"
      : midia?.tipo === "foto" || midia?.tipo === "video";

  const explicitId = extrairIdentificadorMidia(pedidoOriginal) ||
    String(input.midiaId || "").trim() ||
    null;
  const selectedExplicitId = selectPublicationMediaId({ explicitId });
  if (selectedExplicitId) {
    return await resolverMidiaBibliotecaPorId(ctx.userId, selectedExplicitId);
  }

  const nowMs = Date.now();
  const lastInteraction = ctx.agentState?.last_media_interaction ?? null;
  const interactionId = selectPublicationMediaId({
    lastInteraction,
    nowMs,
  });
  let interactedMedia: any | null = null;
  if (interactionId) {
    const interacted = await resolverMidiaBibliotecaPorId(
      ctx.userId,
      interactionId,
    );
    if (interacted.erro) return interacted;
    if (interacted.midia && compativel(interacted.midia)) {
      interactedMedia = interacted.midia;
    }
  }

  const generatedSince = new Date(nowMs - 2 * 60 * 60 * 1000)
    .toISOString();
  let query = sb
    .from("midias_whatsapp")
    .select("id, tipo, origem, midia_pai_id, midia_url, contexto_original, contexto_transcricao, legenda_gerada, tags_ia, telefone_origem, created_at")
    .eq("user_id", ctx.userId)
    .eq("telefone_origem", ctx.fromNumber)
    .in("tipo", ["foto", "video"])
    .in("origem", [
      "ia_video_motion",
      "video_legendado",
      "ia_whatsapp",
      "ia_edicao",
      "ia_composicao",
      "anuncio_produto",
      "whatsapp",
      "whatsapp_pietro",
    ])
    .gte("created_at", generatedSince);
  if (referencia === "video") query = query.eq("tipo", "video");
  if (referencia === "image") query = query.eq("tipo", "foto");
  const { data: generated, error } = await query
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return { midia: null, erro: error.message };

  const selectedId = selectPublicationMediaId({
    lastInteraction: interactedMedia
      ? {
        ...lastInteraction,
        media_created_at: interactedMedia.created_at,
      }
      : null,
    recentGenerated: generated ?? null,
    nowMs,
  });
  if (selectedId === interactedMedia?.id) return { midia: interactedMedia };
  if (selectedId === generated?.id) return { midia: generated };
  return { midia: null };
}

async function toolPostarMidiaBiblioteca(
  args: { legenda?: string; nome?: string; preco?: number | string; link?: string; tom?: string; redes?: string[]; midia_id?: string; formato?: string; incluir_cta_whatsapp?: boolean; briefing?: string; usar_contexto_conversa?: boolean; pedido_original?: string },
  ctx: { userId: string; fromNumber: string; convId?: string; agentState?: AgentConvState },
): Promise<string> {
  try {
    if (!isOwner(ctx)) return JSON.stringify({ erro: "acao_restrita_ao_responsavel", mensagem: "Essa ação é restrita ao responsável da conta. Posso encaminhar o pedido para ele, se quiser." });
    pendingCleanup();

    const pedidoOriginal = String(args?.pedido_original || "");
    const midiaIdInformado = extrairIdentificadorMidia(pedidoOriginal) ||
      String(args?.midia_id || "").trim();
    const resolvida = await resolverMidiaParaPublicacao({
      midiaId: midiaIdInformado,
      pedidoOriginal,
    }, ctx);
    if (resolvida.erro) {
      if (/amb[ií]guo/i.test(resolvida.erro)) {
        return JSON.stringify({
          erro: "midia_id_ambiguo",
          mensagem: `Encontrei mais de uma mídia com o código ${midiaIdInformado.toUpperCase()}. Não publiquei nada. Envie o ID completo da mídia correta.`,
        });
      }
      return JSON.stringify({
        erro: "consulta_midia_conversa_falhou",
        mensagem: `Não consegui consultar as mídias desta conversa agora: ${resolvida.erro}. Não publiquei nada.`,
      });
    }
    const midia = resolvida.midia;
    if (!midia) {
      return JSON.stringify({
        erro: "midia_nao_encontrada",
        mensagem: "Qual mídia você quer publicar? Me mande o código (ID da mídia) ou diga 'o último vídeo'.",
      });
    }
    const referencia = publicationMediaReference(pedidoOriginal);
    if (
      (referencia === "video" && midia.tipo !== "video") ||
      (referencia === "image" && midia.tipo !== "foto")
    ) {
      return JSON.stringify({
        erro: "midia_incompativel_com_pedido",
        mensagem: "Qual mídia você quer publicar? Me mande o código (ID da mídia) ou diga 'o último vídeo'.",
      });
    }

    if (midia.origem === "carrossel_whatsapp" || midia.origem === "carrossel_whatsapp_card" || midia.midia_pai_id) {
      const parentId = midia.midia_pai_id || midia.id;
      const requestedNetworks = (args?.redes ?? [])
        .map(canonicalSocialNetwork)
        .filter(Boolean);
      if (requestedNetworks.includes("linkedin") && !requestedNetworks.includes("instagram")) {
        return JSON.stringify({
          erro: "carrossel_linkedin_nao_suportado",
          mensagem: "Carrossel pelo LinkedIn ainda não está habilitado. Não publiquei nada.",
        });
      }
      return await prepararPreviewCarrosselExistente(parentId, ctx, {
        tom: args?.tom,
        legenda: args?.legenda,
        facebookRequested: (args?.redes ?? []).map((rede) => rede.toLowerCase()).includes("facebook"),
        linkedinRequested: (args?.redes ?? []).some((rede) =>
          canonicalSocialNetwork(rede) === "linkedin"
        ),
        enviarCards: true,
      });
    }

    // Etapa 3: story de foto e vídeo, reels (só vídeo), feed (foto/vídeo).
    const formatoRaw = (args?.formato || "feed").toString().toLowerCase();
    const formato: "feed" | "story" | "reels" =
      formatoRaw === "story" ? "story" : formatoRaw === "reels" ? "reels" : "feed";
    const isVideo = midia.tipo === "video";
    if (formato === "reels" && !isVideo) {
      return JSON.stringify({ erro: "Reels só aceita vídeo. Envia um vídeo curto vertical (ideal ≥3s, 9:16) e peça de novo." });
    }

    let redes = (args?.redes && args.redes.length > 0 ? args.redes : ["facebook", "instagram", "tiktok"])
      .map(canonicalSocialNetwork)
      .filter((network): network is NonNullable<typeof network> =>
        !!network && SUPPORTED_SOCIAL_NETWORKS.includes(network)
      );
    // Story e Reels deste fluxo são formatos da Meta.
    if (formato === "story" || formato === "reels") {
      redes = redes.filter((r) => r !== "tiktok" && r !== "linkedin");
    }
    if (redes.length === 0) return JSON.stringify({ erro: `nenhuma rede válida para formato ${formato}` });
    if (!isVideo && redes.includes("tiktok")) {
      return JSON.stringify({
        erro: "tiktok_exige_video",
        mensagem: "O TikTok aceita apenas vídeo neste fluxo. Retire o TikTok ou envie um vídeo.",
      });
    }
    const tom = args?.tom || "urgencia";

    const precoNum = args?.preco != null ? Number(String(args.preco).replace(",", ".").replace(/[^\d.]/g, "")) : null;

    // Extrai descrição visual já salva (se veio de salvar_midia_biblioteca) ou gera agora por visão (SÓ FOTO — vídeo não tem visão).
    const contextoRaw = (midia.contexto_original || "").toString();
    let descricaoVisual = "";
    const mVisao = contextoRaw.match(/\[visão\]\s*([\s\S]+)/i);
    if (mVisao) descricaoVisual = mVisao[1].trim();
    if (!descricaoVisual && !isVideo) {
      descricaoVisual = await descreverImagemVisao(midia.midia_url);
      if (descricaoVisual) {
        await sb.from("midias_whatsapp").update({
          contexto_original: contextoRaw ? `${contextoRaw}\n\n[visão] ${descricaoVisual}` : `[visão] ${descricaoVisual}`,
        }).eq("id", midia.id).eq("user_id", ctx.userId);
      }
    }
    const contextoUsuario = contextoRaw.replace(/\n?\[visão\][\s\S]*/i, "").trim();

    // BRIEFING DO DONO: texto que ele escreveu e quer que seja a MENSAGEM do post.
    // Vem explícito da tool (briefing/legenda longa) ou do contexto salvo com a mídia.
    // ⚠️ A recuperação automática da conversa SÓ acontece quando o dono pede
    // explicitamente (usar_contexto_conversa === true) e apenas com mensagens
    // POSTERIORES ao envio da mídia — antes disso ela pegava assunto antigo e
    // gerava post totalmente fora de contexto.
    let briefing = (args?.briefing || "").toString().trim();
    const legendaArg = (args?.legenda || "").toString().trim();
    if (!briefing && legendaArg.length >= 120) briefing = legendaArg;
    if (!briefing && contextoUsuario.length >= 120) briefing = contextoUsuario;
    if (!briefing && args?.usar_contexto_conversa === true) {
      briefing = await buscarBriefingRecenteDono(ctx.userId, ctx.fromNumber, midia.created_at as string | undefined);
      if (briefing) console.log(`[pietro][postar_midia] briefing recuperado da conversa len=${briefing.length}`);
    }
    briefing = briefing.slice(0, 2500);

    // 🛡️ BLINDAGEM ANTI-ASSUNTO-TROCADO: se a IA (ou o contexto recuperado) trouxer um
    // briefing que fala de um produto de OUTRA categoria que não a mostrada na foto
    // (ex: ficha técnica de veículo em cima da foto de uma garrafa d'água), o briefing
    // é DESCARTADO — o assunto do post é sempre o item da imagem.
    if (briefing && !isVideo && descricaoVisual.trim().length >= 40) {
      if (categoriaConflitante(descricaoVisual, briefing)) {
        console.warn("[pietro][postar_midia] briefing DESCARTADO por conflito de assunto com a imagem");
        briefing = "";
      }
    }

    // VÍDEO precisa de contexto do dono (não temos visão de vídeo — não inventar descrição).
    const legendaDono = (briefing || legendaArg || contextoUsuario || "").toString().trim();
    if (isVideo && !legendaDono) {
      return JSON.stringify({
        erro: "video_sem_contexto",
        mensagem: "Não vejo o conteúdo do vídeo. Me manda a legenda/contexto (do que se trata?) que eu uso como texto do post.",
      });
    }

    // Foto: a descrição visual SEMPRE entra (mesmo com briefing) — o post é sobre
    // a imagem enviada; o briefing define o ângulo, não substitui o assunto.
    const nome = (args?.nome
      || (descricaoVisual ? descricaoVisual.slice(0, 80) : "")
      || (briefing ? briefing.slice(0, 80) : "")
      || legendaDono
      || "Produto").toString().trim().slice(0, 120);
    const descricaoFinal = isVideo
      ? legendaDono  // vídeo: usa direto o texto do dono, sem alucinar
      : [legendaDono, descricaoVisual ? `Conteúdo da imagem: ${descricaoVisual}` : ""].filter(Boolean).join("\n").trim();


    const produtoLike = {
      nome,
      descricao: descricaoFinal || null,
      preco: precoNum && !isNaN(precoNum) ? precoNum : null,
      link: typeof args?.link === "string" && /^https?:\/\//i.test(args.link.trim())
        ? args.link.trim()
        : null,
      categoria: null,
      imagem_url: midia.midia_url,
      ativo: true,
      source: "midias_whatsapp",
      id: midia.id,
      midia_tipo: isVideo ? ("video" as const) : ("foto" as const),
    };

    // Detecta mídia INSTITUCIONAL da marca AMZ (arte/logo, sem produto concreto).
    // Só injeta o pitch da plataforma quando NÃO existe descrição visual de produto —
    // senão a copy virava propaganda da AMZ em cima da foto de um produto do cliente.
    const contextoLower = `${legendaDono} ${descricaoVisual}`.toLowerCase();
    const temProdutoVisivel = !isVideo && descricaoVisual.trim().length >= 40;
    const isBrandContent = !temProdutoVisivel && (
      /\bamz\s*ofertas\b|amzofertas|institucional|nossa\s+plataforma/i.test(contextoLower)
      || (!legendaDono.trim() && (!descricaoVisual || descricaoVisual.length < 40))
    );
    const brandCtx = isBrandContent ? AMZ_BRAND_PITCH : undefined;
    if (isBrandContent) console.log("[pietro][brand_content_detected] injecting AMZ pitch");

    const midiaUsada = `Usando: ${nomeCurtoMidia(midia)} - ${isVideo ? "Vídeo" : "Imagem"} - ${tempoRelativoMidia(midia.created_at)}`;
    try {
      // A mídia escolhida faz parte da prévia: para foto, mostra a própria
      // imagem antes das opções A/B/C em vez de enviar apenas a descrição.
      await sendWhatsApp(
        ctx.userId,
        ctx.fromNumber,
        midiaUsada,
        isVideo ? undefined : midia.midia_url,
        undefined,
        undefined,
        { alreadyLogged: false },
      );
    } catch (e) {
      return JSON.stringify({
        erro: "aviso_midia_falhou",
        mensagem: `Não consegui informar qual mídia seria usada: ${(e as Error).message}. Não gerei as copies.`,
      });
    }

    // Meta/TikTok compartilham a copy-base; LinkedIn recebe variações próprias,
    // profissionais e sem emojis.
    const redeBase: "facebook" | "instagram" = redes.includes("instagram") ? "instagram" : "facebook";
    const gerarOpcoes = async (redeGeracao: "facebook" | "instagram" | "linkedin") => {
      let options = await gerarTresOpcoesRedeSocial(
        produtoLike,
        tom,
        redeGeracao,
        undefined,
        brandCtx,
        briefing || undefined,
      );
      if (!isVideo && descricaoVisual && copyConflitaComImagem(descricaoVisual, options)) {
        console.error(`[pietro][postar_midia] copy ${redeGeracao} REJEITADA por conflito com a imagem; regenerando`);
        options = await gerarTresOpcoesRedeSocial(
          {
            ...produtoLike,
            nome: descricaoVisual.slice(0, 120),
            descricao: `O produto mostrado na foto é: ${descricaoVisual}`,
          },
          "beneficio",
          redeGeracao,
          "Fale exclusivamente sobre o produto identificado nesta foto. Não mencione veículos, carros, concessionária, test-drive, quilometragem, ano ou modelo.",
          undefined,
          undefined,
        );
      }
      return options;
    };
    console.log(`[pietro][postar_midia] gerando copy redes=${redes.join(",")} base=${redeBase} formato=${formato}`);
    const [opcoesBase, opcoesLinkedIn] = await Promise.all([
      redes.some((rede) => rede !== "linkedin") ? gerarOpcoes(redeBase) : Promise.resolve(null),
      redes.includes("linkedin") ? gerarOpcoes("linkedin") : Promise.resolve(null),
    ]);
    const variantes: Record<string, PostVariantes> = Object.fromEntries(redes.map((rede) => [
      rede,
      { ...(rede === "linkedin" ? opcoesLinkedIn! : opcoesBase!) },
    ]));
    let scripts: Record<string, string> = Object.fromEntries(
      Object.entries(variantes).map(([rede, options]) => [rede, options.A]),
    );
    const invalidReason = invalidSocialVariantsReason(redes, variantes);
    if (invalidReason) {
      console.error("[postar_midia][empty_options]", {
        reason: invalidReason,
        userId: ctx.userId,
        midiaId: midia.id,
        redes,
      });
      return JSON.stringify({
        erro: "falha_ao_gerar_opcoes",
        mensagem: "Não consegui gerar as três opções de copy para essa mídia. Tente novamente; não vou pedir A/B/C sem antes mostrar as opções.",
      });
    }


    // Feature A: CTA de WhatsApp (opt-in, número dinâmico do tenant).
    const incluirCta = !!args?.incluir_cta_whatsapp;
    let ctaNota: string | undefined;
    if (incluirCta) {
      const telAgente = await buscarTelefoneAgenteTenant(ctx.userId);
      if (telAgente) {
        for (const [network, options] of Object.entries(variantes)) {
          variantes[network] = network === "linkedin"
            ? {
              A: sanitizeLinkedInApprovalCopy(`${options.A}\n\nhttps://wa.me/${telAgente}`),
              B: sanitizeLinkedInApprovalCopy(`${options.B}\n\nhttps://wa.me/${telAgente}`),
              C: sanitizeLinkedInApprovalCopy(`${options.C}\n\nhttps://wa.me/${telAgente}`),
            }
            : {
              A: appendWhatsappCta(options.A, telAgente),
              B: appendWhatsappCta(options.B, telAgente),
              C: appendWhatsappCta(options.C, telAgente),
            };
        }
        scripts = Object.fromEntries(Object.entries(variantes).map(([r, v]) => [r, v.A]));
        ctaNota = `CTA de WhatsApp incluído (wa.me/${telAgente}).`;
      } else {
        ctaNota = "Não achei o número do agente pra montar o CTA — post sai sem CTA.";
      }
    }

    const token = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
    const pending: PendingSocialPost = { produto: produtoLike, tom, redes, scripts, variantes, userId: ctx.userId, requesterPhone: ctx.fromNumber, createdAt: Date.now(), formato, midiaTipo: produtoLike.midia_tipo, incluirCtaWhatsapp: incluirCta, briefing: briefing || undefined };
    const queueRows = await persistPendingSocialPost(token, pending);
    PENDING_POSTS.set(token, { ...pending, queueRows });
    const avisoFormato = formato === "story"
      ? `⚠️ Formato: STORY (${isVideo ? "vídeo" : "foto"} precisa ser vertical 9:16 em ${redes.join(" e ")}).`
      : formato === "reels"
        ? `Formato: REELS (vídeo vertical, ideal 9:16 ≥3s).`
        : `Formato: FEED.`;

    // Aviso IG-feed-vídeo≡Reels (transparência com o dono).
    const avisoReels = (formato === "feed" && isVideo && redes.includes("instagram"))
      ? "No Instagram, vídeo no feed é publicado como Reels (padrão da Meta) — vou postar como Reels."
      : undefined;

    const perguntaCta = incluirCta
      ? ""
      : ` Se ainda não incluiu CTA de WhatsApp, pergunte também se quer incluir (revisar_post_pendente com incluir_cta_whatsapp=true).`;

    return JSON.stringify({
      status: "aguardando_escolha_variante",
      fonte: "biblioteca_midias",
      token,
      formato,
      midia: { id: midia.id, tipo: midia.tipo, url: midia.midia_url },
      produto: { nome: produtoLike.nome, preco: produtoLike.preco, imagem_url: produtoLike.imagem_url },
      tom,
      redes,
      variantes,
      midia_usada: midiaUsada,
      midia_usada_enviada: true,
      aviso_formato: avisoFormato,
      aviso_reels: avisoReels,
      cta_whatsapp: incluirCta,
      cta_nota: ctaNota,
      instrucoes: `FASE 1: diga o formato, mostre A/B/C e exija a escolha do texto antes de publicar ou agendar.${perguntaCta} Ao responder A/B/C, chame escolher_variante_post com token="${token}". Se pedir ajuste, chame revisar_post_pendente; as novas opções voltam à FASE 1.`,
    });
  } catch (e) {
    return JSON.stringify({ erro: String((e as Error).message) });
  }
}

// ============================================================
// VÍDEO MOTION PELO WHATSAPP — roteiro + aprovação persistente.
// O agente só enfileira depois de uma confirmação explícita do responsável.
// ============================================================
type TrilhaVideoOption = {
  id: string;
  nome: string;
  mood: string;
  padrao_global?: boolean;
};

async function sendVideoInteractiveList(
  ctx: { userId: string; fromNumber: string },
  params: {
    header: string;
    body: string;
    button: string;
    section: string;
    rows: Array<{ id: string; title: string; description?: string }>;
  },
): Promise<void> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-send-message`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICE_KEY}`,
      "apikey": SERVICE_KEY,
    },
    body: JSON.stringify({
      user_id: ctx.userId,
      to: ctx.fromNumber,
      skip_log: false,
      log_sender: "agent",
      interactive_list: {
        header: params.header,
        body: params.body,
        footer: "O roteiro só será gerado depois das escolhas",
        button: params.button,
        section_title: params.section,
        rows: params.rows,
      },
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) {
    throw new Error(`seletor_video_falhou_${response.status}: ${(await response.text()).slice(0, 160)}`);
  }
}

async function persistVideoSetup(
  ctx: { userId: string; fromNumber: string; convId?: string; agentState?: AgentConvState },
  setup: PendingVideoSetupState | null,
): Promise<boolean> {
  if (!ctx.convId) return false;
  const conversation = { id: ctx.convId, userId: ctx.userId, contactNumber: ctx.fromNumber };
  const current = ctx.agentState ?? await loadAgentState(sb, conversation);
  const saved = await saveAgentState(sb, conversation, { pending_video_setup: setup }, current);
  if (saved) {
    current.pending_video_setup = setup;
    ctx.agentState = current;
  }
  return saved;
}

function extractVideoTargetSeconds(text: string): number | undefined {
  const match = String(text).match(/\b(\d{1,3}(?:[,.]\d+)?)\s*(?:s|seg(?:undo)?s?)\b/i);
  const minutes = String(text).match(
    /\b(\d{1,2}(?:[,.]\d+)?)\s*(?:min|minuto|minutos)\b/i,
  );
  if (!match && !minutes) return undefined;
  const value = match
    ? Number(match[1].replace(",", "."))
    : Number(minutes![1].replace(",", ".")) * 60;
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

const extractVideoInteractiveId = (text: string): string | null =>
  String(text).match(/<<INTERACTIVE_ID:(video_[a-z0-9_-]+)>>/i)?.[1] ?? null;

function extractVideoLiteralPhrases(text: string): string[] {
  const found: string[] = [];
  for (const match of String(text).matchAll(/[“"]([^”"]{4,64})[”"]/g)) found.push(match[1].trim());
  const gancho = String(text).match(/\b(?:gancho|frase|texto)\s+(?:literal\s+)?(?:é|e|:)\s*([^.;\n]{4,64})/i)?.[1]?.trim();
  if (gancho) found.push(gancho.replace(/^["“]|["”]$/g, "").trim());
  return [...new Set(found)].slice(0, 5);
}

function detectVideoOutputFormat(text: string): "reels" | "feed" | "story" {
  const n = normalizePt(text);
  if (/\b(stor(?:y|ies))\b/.test(n)) return "story";
  if (/\bfeed\b/.test(n)) return "feed";
  return "reels";
}

async function listVideoTracks(userId: string): Promise<TrilhaVideoOption[]> {
  const { data, error } = await sb
    .from("trilhas_sonoras")
    .select("id, nome, mood, padrao_global, user_id")
    .eq("ativo", true)
    .or(`user_id.is.null,user_id.eq.${userId}`)
    .order("user_id", { ascending: true, nullsFirst: true })
    .order("nome", { ascending: true });
  if (error) throw new Error(`não consegui consultar as trilhas: ${error.message}`);
  return (data ?? []).map((row: any) => ({
    id: String(row.id),
    nome: String(row.nome),
    mood: String(row.mood || "corporativo"),
    padrao_global: row.padrao_global === true,
  }));
}

const trackMoodLabel = (mood: string) =>
  mood === "energetico" ? "Energética" : mood === "inspirador" ? "Inspiradora" : mood === "suave" ? "Suave" : "Corporativa";

function inferTrackFromRequest(text: string, tracks: TrilhaVideoOption[]): { id?: string; nome?: string; sem?: boolean } | null {
  const n = normalizePt(text);
  if (/\bsem\s+(?:trilha|musica|música|som)\b/.test(n)) return { sem: true };
  const exact = tracks.find((track) => n.includes(normalizePt(track.nome)));
  if (exact) return { id: exact.id, nome: exact.nome };

  const choose = (mood: string, preferred: RegExp) =>
    tracks.find((track) => track.mood === mood && preferred.test(track.nome))
      ?? tracks.find((track) => track.mood === mood);
  let selected: TrilhaVideoOption | undefined;
  if (/\b(trilha|musica|música)\s+(animada|energetica|energética|agitada|upbeat)\b/.test(n)) {
    selected = choose("energetico", /upbeat|happy|startup/i);
  } else if (/\b(trilha|musica|música)\s+(inspiradora|motivacional|future)\b/.test(n)) {
    selected = choose("inspirador", /future|motivacional/i);
  } else if (/\b(trilha|musica|música)\s+(corporativa|classica|clássica)\b/.test(n)) {
    selected = tracks.find((track) => track.padrao_global)
      ?? choose("corporativo", /cl[aá]ssico|atlas/i);
  }
  return selected ? { id: selected.id, nome: selected.nome } : null;
}

function extractPublicSiteUrl(text: string): string | null {
  const match = String(text).match(/https?:\/\/[^\s<>"']+|(?:www\.)?[a-z0-9][a-z0-9.-]+\.[a-z]{2,}(?:\/[^\s<>"']*)?/i);
  if (!match) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(match[0]) ? match[0] : `https://${match[0]}`);
    const host = url.hostname.toLowerCase();
    if (!["http:", "https:"].includes(url.protocol)) return null;
    if (
      host === "localhost"
      || host.endsWith(".local")
      || /^127\./.test(host)
      || /^10\./.test(host)
      || /^192\.168\./.test(host)
      || /^169\.254\./.test(host)
      || /^172\.(?:1[6-9]|2\d|3[01])\./.test(host)
      || host === "::1"
    ) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function validPalette(raw: unknown): MotionProps["cores"] {
  const source = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const color = (key: keyof MotionProps["cores"]) => {
    const value = String(source[key] ?? "");
    return /^#[0-9a-f]{6}$/i.test(value) ? value : PALETA_PADRAO[key];
  };
  return {
    bg: color("bg"),
    bg2: color("bg2"),
    panel: color("panel"),
    line: color("line"),
    destaque: color("destaque"),
    destaqueSoft: color("destaqueSoft"),
    texto: color("texto"),
    suave: color("suave"),
  };
}

const rgbPalette = (hex: string): [number, number, number] => {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
};

const paletteSaturation = (hex: string): number => {
  const [r, g, b] = rgbPalette(hex).map((value) => value / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 0;
  const lightness = (max + min) / 2;
  return lightness > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);
};

const paletteBrightness = (hex: string): number => {
  const [r, g, b] = rgbPalette(hex);
  return (r * 0.299 + g * 0.587 + b * 0.114) / 255;
};

function paletteBrandCandidates(colors: string[]): string[] {
  return [...new Set(
    colors
      .map((hex) => String(hex).toLowerCase())
      .filter((hex) => /^#[0-9a-f]{6}$/.test(hex))
      .filter((hex) => paletteSaturation(hex) >= 0.18 && paletteBrightness(hex) > 0.04 && paletteBrightness(hex) < 0.95),
  )].slice(0, 8);
}

function paletteOptionsFromColors(colors: string[]): VideoPaletteOption[] {
  const valid = [...new Set(colors.map((hex) => String(hex).toLowerCase()).filter((hex) => /^#[0-9a-f]{6}$/.test(hex)))];
  const brand = valid.filter((hex) => paletteSaturation(hex) >= 0.18 && paletteBrightness(hex) > 0.08 && paletteBrightness(hex) < 0.95);
  const neutrals = valid.filter((hex) => !brand.includes(hex));
  const background = neutrals.find((hex) => paletteBrightness(hex) >= 0.72) ?? "#ffffff";
  const text = [...neutrals].sort((a, b) => paletteBrightness(a) - paletteBrightness(b))[0] ?? "#1a1a1a";
  const primary = brand[0];
  const secondary = brand.find((hex) => hex !== primary);
  return [
    primary ? { hex: primary, role: "Principal" as const } : null,
    secondary ? { hex: secondary, role: "Secundária" as const } : null,
    { hex: background, role: "Fundo" as const },
    { hex: text, role: "Texto" as const },
  ].filter((item): item is VideoPaletteOption => !!item);
}

function paletteFromOptions(options: VideoPaletteOption[]): MotionProps["cores"] {
  const byRole = (role: VideoPaletteOption["role"]) => options.find((item) => item.role === role)?.hex;
  return paletaAPartirDe({
    destaque: byRole("Principal"),
    // A secundária é usada em bordas/detalhes; o gradiente recebe uma
    // variação clara derivada exclusivamente da cor principal.
    line: byRole("Secundária"),
    bg: byRole("Fundo"),
    texto: byRole("Texto"),
  });
}

async function loadTenantVideoIdentity(userId: string): Promise<{
  cores: MotionProps["cores"];
  marca?: string;
  site?: string;
  tom?: string;
}> {
  const { data, error } = await sb.from("empresa_config")
    .select("nome_empresa, site, voz_copy, paleta_marca, identidade_site")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`não consegui carregar a identidade da empresa: ${error.message}`);
  const identity = data?.identidade_site && typeof data.identidade_site === "object" ? data.identidade_site as any : {};
  return {
    cores: validPalette(data?.paleta_marca ?? identity?.paleta),
    marca: String(data?.nome_empresa || identity?.nome_empresa || "").trim() || undefined,
    site: String(data?.site || identity?.url || "").trim() || undefined,
    tom: String(data?.voz_copy || identity?.tom_de_voz || "").trim() || undefined,
  };
}

async function uploadClientLogoData(
  userId: string,
  dataUrl: string | null | undefined,
  folder: "video-site" | "client-brands" | "brand-image-temp",
): Promise<string | undefined> {
  const match = String(dataUrl ?? "").match(/^data:(image\/(?:png|jpeg|webp|svg\+xml));base64,([\s\S]+)$/i);
  if (!match) return undefined;
  const mime = match[1].toLowerCase();
  const bytes = base64Decode(match[2]);
  if (bytes.length > 5 * 1024 * 1024) return undefined;
  const processed = await removeSolidLogoBackground(bytes, mime);
  const ext = processed.mime === "image/jpeg"
    ? "jpg"
    : processed.mime === "image/svg+xml" ? "svg" : processed.mime.split("/")[1];
  const path = `${userId}/${folder}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-logo.${ext}`;
  const { error } = await sb.storage.from("tenant-logos").upload(path, processed.bytes, {
    contentType: processed.mime,
    upsert: false,
  });
  if (error) {
    console.error("[video-setup][site-logo-upload]", error.message);
    return undefined;
  }
  return path;
}

async function uploadTemporarySiteLogo(userId: string, dataUrl?: string | null): Promise<string | undefined> {
  return await uploadClientLogoData(userId, dataUrl, "video-site");
}

function isClientLogoRegistrationRequest(text: string): boolean {
  const value = String(text ?? "");
  if (!/\b(?:logo|logomarca|logotipo)\b/i.test(value)) return false;
  return /\b(?:guard(?:a|ar|e)|salv(?:a|ar|e)|registr(?:a|ar|e)|cadastr(?:a|ar|e)|us(?:a|e|ar)\s+(?:essa|esse|esta|este|isso)|esse\s+(?:e|é)|essa\s+(?:e|é)|isto\s+(?:e|é)|usar\s+(?:nos?|em)\s+(?:videos?|vídeos?|posts?))\b/i.test(value);
}

async function uploadClientLogoFromMediaUrl(userId: string, mediaUrl: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(mediaUrl, { signal: controller.signal, redirect: "follow" });
    if (!response.ok) return null;
    const mime = String(response.headers.get("content-type") || "").split(";")[0].toLowerCase();
    if (!/^image\/(?:png|jpeg|webp|svg\+xml)$/i.test(mime)) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!bytes.length || bytes.length > 5 * 1024 * 1024) return null;
    const processed = await removeSolidLogoBackground(bytes, mime);
    const ext = processed.mime === "image/jpeg"
      ? "jpg"
      : processed.mime === "image/svg+xml" ? "svg" : processed.mime.split("/")[1];
    const path = `${userId}/client-brands/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-logo.${ext}`;
    const { error } = await sb.storage.from("tenant-logos").upload(path, processed.bytes, {
      contentType: processed.mime,
      upsert: false,
    });
    if (error) {
      console.error("[client-brand][media-logo-upload]", error.message);
      return null;
    }
    return path;
  } catch (error) {
    console.error("[client-brand][media-logo-download]", (error as Error).message);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function toolRegistrarLogoCliente(
  args: {
    cliente?: string;
    variante?: "default" | "light_background" | "dark_background";
  },
  ctx: { userId: string; fromNumber: string; agentState?: AgentConvState },
): Promise<string> {
  if (!isOwner(ctx)) {
    return JSON.stringify({ ok: false, erro: "somente_responsavel" });
  }
  const requestedName = String(args?.cliente || "").replace(/\s+/g, " ").trim().slice(0, 100);
  if (!requestedName) {
    return JSON.stringify({ ok: false, erro: "cliente_ausente", mensagem: "De qual cliente é essa logo?" });
  }
  const latest = await buscarUltimaMidiaDaConversa(ctx);
  if (latest.erro) {
    return JSON.stringify({ ok: false, erro: "busca_midia_falhou", mensagem: latest.erro });
  }
  if (!latest.midia || latest.midia.tipo !== "foto") {
    return JSON.stringify({
      ok: false,
      erro: "foto_ausente",
      mensagem: "Não encontrei uma foto recente nesta conversa. Envie a logo e tente novamente.",
    });
  }
  const age = Date.now() - new Date(latest.midia.created_at).getTime();
  if (!Number.isFinite(age) || age > 24 * 60 * 60 * 1000) {
    return JSON.stringify({
      ok: false,
      erro: "foto_expirada",
      mensagem: "A última foto desta conversa tem mais de 24 horas. Envie a logo novamente.",
    });
  }

  const matches = await listClientBrandIdentityMatches(sb, ctx.userId, requestedName);
  if (matches.length > 1) {
    return JSON.stringify({
      ok: false,
      erro: "cliente_ambiguo",
      mensagem: `Encontrei mais de um cliente parecido: ${matches.map((item) => item.client_name).join(", ")}. Qual deles é?`,
    });
  }
  const clientName = matches[0]?.client_name || requestedName;
  const logoPath = await uploadClientLogoFromMediaUrl(ctx.userId, String(latest.midia.midia_url || ""));
  if (!logoPath) {
    return JSON.stringify({
      ok: false,
      erro: "upload_falhou",
      mensagem: "Encontrei a foto, mas não consegui salvá-la como logo. Envie PNG, JPEG ou WEBP com até 5 MB.",
    });
  }
  try {
    const variant = args.variante ?? "default";
    const previousLogoPath = variant === "light_background"
      ? String(matches[0]?.identity?.logo_fundo_claro_path || "")
      : variant === "dark_background"
      ? String(matches[0]?.identity?.logo_fundo_escuro_path || "")
      : matches[0]?.logo_path;
    const saved = await saveClientBrandIdentity(sb, {
      userId: ctx.userId,
      clientName,
      logoPath,
      logoVariant: variant,
      identity: { logo_origem: "whatsapp_manual", source_media_id: latest.midia.id },
    });
    if (
      previousLogoPath
      && previousLogoPath !== logoPath
      && previousLogoPath.startsWith(`${ctx.userId}/client-brands/`)
    ) {
      await sb.storage.from("tenant-logos").remove([previousLogoPath]);
    }
    return JSON.stringify({
      ok: true,
      client_name: saved.client_name,
      logo_path: saved.logo_path,
      source_media_id: latest.midia.id,
      mensagem: `Guardei como logo do ${saved.client_name}. Vou usar nos vídeos e posts desse cliente.${
        saved.identity?.logo_background_warning
          ? `\n\n${saved.identity.logo_background_warning}`
          : ""
      }`,
    });
  } catch (error) {
    await sb.storage.from("tenant-logos").remove([logoPath]);
    return JSON.stringify({
      ok: false,
      erro: "persistencia_falhou",
      mensagem: (error as Error).message,
    });
  }
}

async function askVideoTemplate(
  ctx: { userId: string; fromNumber: string },
  tema: string,
): Promise<void> {
  await sendVideoInteractiveList(ctx, {
    header: "🎬 Formato visual",
    body: `Como você quer o vídeo sobre *${tema.slice(0, 100)}*?`,
    button: "Escolher formato",
    section: "Templates disponíveis",
    rows: [
      { id: "video_template_conversa", title: "Conversa no celular", description: "Celular e balões de WhatsApp" },
      { id: "video_template_institucional", title: "Institucional", description: "Tipografia, argumentos e selo" },
      { id: "video_template_lista", title: "Lista / passo a passo", description: "Itens numerados em sequência" },
    ],
  });
}

async function askVideoBackground(
  ctx: { userId: string; fromNumber: string },
): Promise<void> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-send-message`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICE_KEY}`,
      "apikey": SERVICE_KEY,
    },
    body: JSON.stringify({
      user_id: ctx.userId,
      to: ctx.fromNumber,
      skip_log: false,
      log_sender: "agent",
      message: "Qual fundo você quer no vídeo?",
      interactive_buttons: {
        header: "🎨 Fundo do vídeo",
        body: "Qual fundo você quer no vídeo?",
        footer: "A cor da marca continua nos destaques",
        buttons: [
          { id: "video_background_dark", title: "Fundo escuro" },
          { id: "video_background_light", title: "Fundo claro" },
        ],
      },
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) {
    throw new Error(`seletor_fundo_video_falhou_${response.status}: ${(await response.text()).slice(0, 160)}`);
  }
}

async function askVideoTrack(
  ctx: { userId: string; fromNumber: string },
  tracks: TrilhaVideoOption[],
  page = 0,
): Promise<void> {
  const start = page === 0 ? 0 : 8 + (page - 1) * 7;
  const size = page === 0 ? 8 : 7;
  const shown = tracks.slice(start, start + size);
  const hasPrevious = page > 0;
  const hasNext = start + size < tracks.length;
  const rows = [
    { id: "video_track_none", title: "Sem trilha", description: "Gerar o vídeo sem música" },
    ...shown.map((track) => ({
      id: `video_track_${track.id}`,
      title: track.nome,
      description: trackMoodLabel(track.mood),
    })),
    ...(hasPrevious
      ? [{ id: "video_track_back", title: "Voltar às primeiras", description: "Mostrar a página anterior" }]
      : []),
    ...(hasNext
      ? [{ id: "video_track_more", title: "Ver outras trilhas", description: `${tracks.length - (start + size)} opções restantes` }]
      : []),
  ];
  await sendVideoInteractiveList(ctx, {
    header: "🎵 Trilha sonora",
    body: "Qual trilha você quer usar? O vídeo só sairá mudo se você escolher *Sem trilha*.",
    button: "Escolher trilha",
    section: page > 0 ? "Outras trilhas" : "Trilhas disponíveis",
    rows,
  });
}

async function askVideoIdentity(ctx: { userId: string; fromNumber: string }): Promise<void> {
  await sendVideoInteractiveList(ctx, {
    header: "🎨 Identidade visual",
    body: "Qual marca deve aparecer neste vídeo?",
    button: "Escolher identidade",
    section: "Marca do vídeo",
    rows: [
      { id: "video_identity_tenant", title: "Minha empresa", description: "Usar paleta e logo atuais" },
      { id: "video_identity_client", title: "Marca do meu cliente", description: "Ler cores e logo pelo site" },
    ],
  });
}

function paletteTouchTitle(hex: string): string {
  const emoji: Record<ReturnType<typeof paletteFamily>, string> = {
    vermelho: "🔴",
    laranja: "🟠",
    amarelo: "🟡",
    verde: "🟢",
    azul: "🔵",
    roxo: "🟣",
    rosa: "🟣",
    neutro: "⚪",
  };
  return `${emoji[paletteFamily(hex)]} ${hex.toUpperCase()}`;
}

async function sendPalettePreview(
  ctx: { userId: string; fromNumber: string },
  options: VideoPaletteOption[],
  logoPath?: string,
): Promise<void> {
  if (options.length >= 2) {
    try {
      const preview = await callEdge("render-palette-preview", {
        user_id: ctx.userId,
        colors: options,
        logo_path: logoPath,
      });
      if (preview?.success && preview?.image_url) {
        await sendWhatsApp(
          ctx.userId,
          ctx.fromNumber,
          "Logo e prévia numerada da paleta:",
          preview.image_url,
          undefined,
          undefined,
          { alreadyLogged: false },
        );
      } else {
        console.warn("[video-setup][palette-preview]", preview?.error || "render sem URL");
      }
    } catch (error) {
      console.warn("[video-setup][palette-preview]", (error as Error).message);
    }
  }
}

async function askPalettePrimary(
  ctx: { userId: string; fromNumber: string },
  candidates: string[],
  options: VideoPaletteOption[],
  logoPath?: string,
): Promise<void> {
  await sendPalettePreview(ctx, options, logoPath);
  await sendVideoInteractiveList(ctx, {
    header: "🎨 Cor principal",
    body: "Toque na cor principal da marca. Depois você escolhe a secundária.",
    button: "Escolher principal",
    section: "Cores extraídas do logo",
    rows: candidates.map((hex) => ({
      id: `video_palette_primary_${hex.slice(1)}`,
      title: paletteTouchTitle(hex),
      description: "Usar como cor principal",
    })),
  });
}

async function askPaletteSecondary(
  ctx: { userId: string; fromNumber: string },
  candidates: string[],
  primary: string,
): Promise<void> {
  const remaining = candidates.filter((hex) => hex !== primary);
  await sendVideoInteractiveList(ctx, {
    header: "🎨 Cor secundária",
    body: `Principal escolhida: ${primary.toUpperCase()}. Agora toque na cor de apoio, ou escolha Nenhuma.`,
    button: "Escolher secundária",
    section: "Detalhes e elementos de apoio",
    rows: [
      ...remaining.map((hex) => ({
        id: `video_palette_secondary_${hex.slice(1)}`,
        title: paletteTouchTitle(hex),
        description: "Usar em bordas e detalhes",
      })),
      { id: "video_palette_secondary_none", title: "Nenhuma", description: "Usar somente a cor principal" },
    ],
  });
}

async function askSitePaletteConfirmation(
  ctx: { userId: string; fromNumber: string },
  options: VideoPaletteOption[],
  extractionFailed = false,
  logoPath?: string,
): Promise<void> {
  if (!extractionFailed) await sendPalettePreview(ctx, options, logoPath);
  const summary = options.map((item, index) => `${index + 1}. ${item.role} ${item.hex.toUpperCase()}`).join("\n");
  const provenance = options
    .filter((item) => item.origem)
    .map((item) => `${item.hex.toUpperCase()}: ${item.origem}`)
    .join("\n");
  await sendVideoInteractiveList(ctx, {
    header: "🎨 Cores do site",
    body: extractionFailed
      ? SITE_IDENTITY_READ_FAILURE_MESSAGE
      : `Encontrei estas candidatas:\n${summary}${provenance ? `\n\nOrigem auditável:\n${provenance}` : ""}\n\nConfirme com o responsável ou ajuste: “tira a 3”, “troca a principal pela 2”, “usa #00a88a e #0b1f6b”.`,
    button: "Confirmar cores",
    section: "Identidade do cliente",
    rows: extractionFailed
      ? [
        { id: "video_identity_send_logo", title: "Enviar logo agora", description: "Anexar o arquivo pelo WhatsApp" },
        { id: "video_identity_manual_colors", title: "Informar as cores", description: "Responder com pelo menos dois códigos hex" },
        { id: "video_palette_retry", title: "Informar outro site", description: "Tentar uma URL diferente" },
      ]
      : [
        { id: "video_palette_use", title: "Usar estas cores", description: "Continuar para o roteiro" },
        { id: "video_palette_default", title: "Usar paleta padrão", description: "Ignorar as cores encontradas" },
        { id: "video_palette_retry", title: "Informar outro site", description: "Tentar uma URL diferente" },
      ],
  });
}

async function askSiteLogoConfirmation(
  ctx: { userId: string; fromNumber: string },
  logoPath: string,
): Promise<void> {
  const { data, error } = await sb.storage.from("tenant-logos").createSignedUrl(logoPath, 3600);
  if (error || !data?.signedUrl) {
    console.warn("[video-setup][site-logo-preview]", error?.message || "URL assinada ausente");
  } else {
    await sendWhatsApp(
      ctx.userId,
      ctx.fromNumber,
      "Encontrei esta imagem no site. Confirme se ela é realmente a logo do cliente:",
      data.signedUrl,
      undefined,
      undefined,
      { alreadyLogged: false },
    );
  }
  await sendVideoInteractiveList(ctx, {
    header: "🖼️ Logo encontrada",
    body: "A imagem do site só será usada no vídeo se você confirmar. Sem confirmação, o vídeo segue sem logo.",
    button: "Confirmar logo",
    section: "Logo do cliente",
    rows: [
      { id: "video_site_logo_use", title: "Usar esta logo", description: "Confirmar a imagem mostrada" },
      { id: "video_site_logo_reject", title: "Não é a logo", description: "Gerar sem esta imagem" },
    ],
  });
}

function normalizeVideoTopic(text: string): string {
  return compactSpaces(text)
    .replace(/^jarvis[,.!\s-]*/i, "")
    .replace(/\b(por favor|pfv|pra mim|para mim)\b/gi, " ")
    .replace(/\b(faz|faca|faça|fazer|cria|criar|crie|monta|montar|monte|gera|gerar|gere|produz|produzir|produza)\b/gi, " ")
    .replace(/\b(um|uma|o|a)\s+(video|vídeo)\b/gi, " ")
    .replace(/\b(video|vídeo)\s+(animado|motion|institucional|publicitario|publicitário)?\b/gi, " ")
    .replace(/\b(para|pra|pro|no|na|em)\s+(whatsapp|instagram|insta|facebook|face|reels?|stories?)\b/gi, " ")
    .replace(/\b(sem|com)\s+(juros|logo|legenda)\b/gi, " $1 $2 ")
    .replace(/\s+/g, " ")
    .replace(/^[\s,;:.-]+|[\s,;:.-]+$/g, "")
    .trim()
    .slice(0, 240);
}

function isVideoApproval(text: string): boolean {
  const n = normalizePt(compactSpaces(text || "")).replace(/[.!?]+$/g, "");
  return /^(sim|ok|okay|pode|pode fazer|faz|faça|confirma|confirmo|aprovado|aprovada|manda ver|pode gerar|gera|gerar|vai|fechado|fechou)$/.test(n)
    || /\b(aprovad[oa]|pode (fazer|gerar|renderizar)|manda ver|pode mandar|pode produzir)\b/.test(n);
}

function isVideoCancellation(text: string): boolean {
  return /\b(cancel(a|ar)|descarta|abandona|deixa pra la|deixa pra lá)\b/.test(normalizePt(text || ""));
}

function videoDraftToken(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 8);
}

function formatVideoDraft(props: any, tema: string, duracao: number, paleta?: string): string {
  const linhas = Array.isArray(props?.hook?.linhas) ? props.hook.linhas.filter(Boolean).join(" ") : "";
  const mensagens = Array.isArray(props?.chat?.mensagens)
    ? props.chat.mensagens.map((m: any) => `${m?.de === "dono" ? "Você" : "Agente"}: ${m?.texto || ""}`).filter((x: string) => !x.endsWith(": ")).join("\n")
    : "";
  const cta = props?.cta?.frase ? `\n\n*CTA:* ${props.cta.frase}` : "";
  const cores = paleta ? `\n\n*Paleta:* ${paleta}` : "";
  // O corpo muda com o estilo: conversa mostra as mensagens; institucional e
  // lista mostram os argumentos/passos.
  const itens: any[] = Array.isArray(props?.blocos) && props.blocos.length
    ? props.blocos
    : Array.isArray(props?.itens) ? props.itens : [];
  const corpo = itens.length
    ? `*${Array.isArray(props?.blocos) && props.blocos.length ? "Argumentos" : "Passos"}:*\n${
      itens.map((b: any, i: number) => `${i + 1}. ${b?.titulo || ""}${b?.apoio ? ` — ${b.apoio}` : ""}`).join("\n")
    }`
    : `*Conversa:*\n${mensagens || "(não informado)"}`;
  const minutos = minutosRenderEstimado(duracao);
  return `🎬 *Roteiro do vídeo — ${tema}*\n\n*Gancho:* ${linhas || "(não informado)"}\n\n${corpo}${cta}${cores}\n\nDuração estimada: ${duracao}s.\n\nResponda *APROVADO* para eu renderizar o MP4 (leva cerca de ${minutos} minutos), ou me diga o que ajustar.`;
}

type VideoDraftOptions = {
  textoCores?: string;
  estilo?: string | null;
  fundo?: FundoMotion;
  duracao?: string | null;
  duracaoAlvoSegundos?: number;
  frasesLiterais?: string[];
  cenas?: CenaMotion[];
  trilhaId?: string | null;
  semTrilha?: boolean;
  cores?: MotionProps["cores"];
  marca?: string;
  site?: string;
  tomDeVoz?: string;
  logoPath?: string;
  semLogoTenant?: boolean;
  identidadeResumo?: string;
  formato?: "reels" | "feed" | "story";
};

async function criarRascunhoVideoMotion(
  ctx: { userId: string; fromNumber: string },
  tema: string,
  options: VideoDraftOptions = {},
): Promise<string> {
  if (!isOwner(ctx)) return "Esse recurso é exclusivo do responsável da conta. Posso encaminhar o pedido para ele.";
  // Prospecção: quando o pedido menciona cores (hex ou nome), o vídeo sai na
  // identidade visual do cliente-alvo; sem menção, segue a paleta do tenant.
  const pedidas = options.cores ? null : extrairCoresDoTexto(`${options.textoCores ?? ""} ${tema}`);
  const roteiro = await montarRoteiroMotion({
    sb,
    userId: ctx.userId,
    tema,
    origem: "whatsapp",
    nomeFallback: null,
    cores: options.cores ?? pedidas?.cores ?? null,
    estilo: options.estilo ?? null,
    fundo: options.fundo,
    duracao: options.duracao ?? null,
    duracaoAlvoSegundos: options.duracaoAlvoSegundos,
    frasesLiterais: options.frasesLiterais,
    cenas: options.cenas,
    trilhaId: options.trilhaId,
    semTrilha: options.semTrilha,
    marca: options.marca,
    tomDeVoz: options.tomDeVoz,
    logoPath: options.logoPath,
    semLogoTenant: options.semLogoTenant,
  });
  if (options.site) roteiro.props.site = normalizarSiteMotion(options.site);
  const token = videoDraftToken();
  const { error } = await sb.from("video_motion_rascunhos").insert({
    user_id: ctx.userId,
    telefone: ctx.fromNumber,
    token,
    tema,
    props: roteiro.props,
    legenda_post: roteiro.legendaPost || null,
    formato: options.formato ?? "reels",
    status: "aguardando_aprovacao",
  });
  if (error) throw new Error(`não consegui salvar o roteiro: ${error.message}`);
  const paleta = options.cores
    ? `fundo ${roteiro.props?.cores?.bg}, destaque ${roteiro.props?.cores?.destaque} (identidade escolhida)`
    : pedidas
    ? `${pedidas.resumo} (cores que você pediu)`
    : `fundo ${roteiro.props?.cores?.bg}, destaque ${roteiro.props?.cores?.destaque} (padrão da sua marca)`;
  const rotuloEstilo = ROTULO_ESTILO[(roteiro.props?.estilo ?? "conversa") as EstiloMotion] ?? "Conversa no celular";
  const segundos = roteiro.props ? duracaoEstimada(roteiro.props) : 0;
  const rotuloDuracao = options.duracaoAlvoSegundos
    ? `${options.duracaoAlvoSegundos}s (solicitada)`
    : ROTULO_DURACAO[(roteiro.props?.duracao ?? "curto") as DuracaoMotion] ?? "Curto (~25s)";
  const minutos = minutosRenderEstimado(segundos);
  const identidade = options.identidadeResumo
    ? `\n\nIdentidade: *${options.identidadeResumo}*`
    : "";
  return `${formatVideoDraft(roteiro.props, tema, segundos, paleta)}${identidade}\n\nFormato: *${rotuloEstilo}*\nDuração: *${rotuloDuracao}* — render em cerca de ${minutos} min\n\nCódigo de aprovação: *${token}*`;
}

async function prepareClientSiteIdentity(
  ctx: { userId: string; fromNumber: string; convId?: string; agentState?: AgentConvState },
  setup: PendingVideoSetupState,
  url: string,
): Promise<string> {
  const fastIdentity = await fetchBrandSiteIdentity(url);
  const identity = await completeSiteIdentityWithRenderedPage(
    sb,
    ctx.userId,
    fastIdentity,
  );
  const automatic = resolveAutomaticVideoSiteIdentity({
    requestedClientName: setup.marca,
    siteBrandName: identity.brand_name,
    siteUrl: identity.url,
    colors: identity.colors,
    logoConfidence: identity.logo_confidence,
    logoDataUrl: identity.logo_data_url,
  });
  const requestedWithoutLogo = /\bsem\s+(?:a\s+)?(?:logo|marca)\b/i.test(
    setup.pedido_original,
  );
  const paletteOptions = paletteOptionsFromColors(automatic.colors);
  const savedIdentity = await findClientBrandIdentity(sb, ctx.userId, {
    name: automatic.clientName,
    site: identity.url,
  });
  const manualLogoPath = savedIdentity?.identity?.logo_origem === "whatsapp_manual"
    ? clientLogoPath(savedIdentity) || undefined
    : undefined;
  const uploadedSiteLogoPath = !manualLogoPath
      && automatic.useSiteLogo
      && !requestedWithoutLogo
    ? await uploadClientLogoData(
      ctx.userId,
      identity.logo_data_url,
      "client-brands",
    )
    : undefined;
  const selectedLogo = selectVideoClientLogo({
    manualLogoPath,
    siteLogoPath: uploadedSiteLogoPath,
    withoutLogo: requestedWithoutLogo,
  });
  const logoPath = selectedLogo.path;
  const appliedIdentity = [
    manualLogoPath && !requestedWithoutLogo
      ? "logo salva do cliente"
      : uploadedSiteLogoPath ? "logo do site" : null,
    automatic.colors.length
      ? `cores ${automatic.colors.slice(0, 4).join(" · ")}`
      : null,
  ].filter(Boolean).join(" + ") || "paleta automática sem logo";
  const identitySummary = `${automatic.clientName} — ${appliedIdentity}`;
  try {
    await saveClientBrandIdentity(sb, {
      userId: ctx.userId,
      clientName: automatic.clientName,
      siteUrl: identity.url,
      logoPath,
      identity: {
        ...identity,
        logo_origem: selectedLogo.source === "none"
          ? undefined
          : selectedLogo.source,
      } as unknown as Record<string, unknown>,
    });
  } catch (error) {
    console.error("[video-setup][client-identity-save]", (error as Error).message);
  }
  console.log("[video-setup][identity-provenance]", JSON.stringify({
    user_id: ctx.userId,
    site: identity.url,
    logo_confidence: identity.logo_confidence,
    logo_used: Boolean(logoPath),
    logo_source: selectedLogo.source,
    colors: automatic.colors,
  }));
  const next: PendingVideoSetupState = {
    ...setup,
    stage: "awaiting_palette_confirmation",
    identidade: "client",
    site: identity.url,
    marca: automatic.clientName,
    logo_path: logoPath,
    logo_light_background_path: savedIdentity
      ? clientLogoPath(savedIdentity, "light") || undefined
      : undefined,
    logo_dark_background_path: savedIdentity
      ? clientLogoPath(savedIdentity, "dark") || undefined
      : undefined,
    site_logo_candidate_path: undefined,
    identity_summary: identitySummary,
    palette_options: paletteOptions,
    palette_candidates: automatic.colors,
    palette_primary: undefined,
    cores: automatic.colors.length ? paletteFromOptions(paletteOptions) : undefined,
  };
  if (!await persistVideoSetup(ctx, next)) {
    if (uploadedSiteLogoPath) {
      await sb.storage.from("tenant-logos").remove([uploadedSiteLogoPath]);
    }
    return "Não consegui guardar a identidade encontrada. Não gerei o roteiro; tente novamente.";
  }
  return await finalizeVideoSetup(ctx, next);
}

async function finalizeVideoSetup(
  ctx: { userId: string; fromNumber: string; convId?: string; agentState?: AgentConvState },
  setup: PendingVideoSetupState,
): Promise<string> {
  const result = await criarRascunhoVideoMotion(ctx, setup.tema, {
    textoCores: setup.pedido_original,
    estilo: setup.estilo,
    fundo: setup.fundo,
    duracao: setup.duracao,
    duracaoAlvoSegundos: setup.duracao_alvo_segundos,
    frasesLiterais: setup.frases_literais,
    cenas: setup.roteiro_cenas,
    trilhaId: setup.trilha_id,
    semTrilha: setup.sem_trilha === true,
    cores: setup.cores,
    marca: setup.identidade === "client" ? setup.marca : undefined,
    site: setup.identidade === "client" ? setup.site : undefined,
    tomDeVoz: setup.tom_de_voz,
    logoPath: setup.identidade === "client"
      ? (setup.fundo === "claro"
        ? setup.logo_light_background_path
        : setup.fundo === "escuro"
        ? setup.logo_dark_background_path
        : setup.logo_path) || setup.logo_path
      : setup.logo_path,
    semLogoTenant: setup.identidade === "client",
    identidadeResumo: setup.identity_summary,
    formato: setup.formato ?? "reels",
  });
  if (!await persistVideoSetup(ctx, null)) {
    console.error("[video-setup] roteiro criado, mas estado pendente não foi limpo");
  }
  return result;
}

async function advanceVideoSetup(
  ctx: { userId: string; fromNumber: string; convId?: string; agentState?: AgentConvState },
  setup: PendingVideoSetupState,
): Promise<string> {
  if (!setup.estilo) {
    const next = { ...setup, stage: "awaiting_template" as const };
    if (!await persistVideoSetup(ctx, next)) return "Não consegui guardar o pedido antes de perguntar o formato. Tente novamente.";
    await askVideoTemplate(ctx, setup.tema);
    return "Escolha o formato visual na lista acima 👆";
  }

  if (!setup.fundo) {
    const next = { ...setup, stage: "awaiting_background" as const };
    if (!await persistVideoSetup(ctx, next)) return "Não consegui guardar o formato antes de perguntar o fundo. Tente novamente.";
    await askVideoBackground(ctx);
    return "Escolha o fundo do vídeo nos botões acima 👆";
  }

  if (!setup.trilha_id && setup.sem_trilha !== true) {
    const tracks = await listVideoTracks(ctx.userId);
    const next = { ...setup, stage: "awaiting_track" as const };
    if (!await persistVideoSetup(ctx, next)) return "Não consegui guardar o formato antes de perguntar a trilha. Tente novamente.";
    if (tracks.length === 0) return "Não há trilhas ativas disponíveis. Responda *Sem trilha* para gerar sem som.";
    await askVideoTrack(ctx, tracks);
    return "Escolha a trilha na lista acima 👆";
  }

  if (!setup.identidade) {
    const next = { ...setup, stage: "awaiting_identity" as const };
    if (!await persistVideoSetup(ctx, next)) return "Não consegui guardar a trilha antes de perguntar a identidade. Tente novamente.";
    await askVideoIdentity(ctx);
    return "Escolha a identidade visual na lista acima 👆";
  }

  if (setup.identidade === "tenant") {
    const identity = await loadTenantVideoIdentity(ctx.userId);
    return await finalizeVideoSetup(ctx, {
      ...setup,
      cores: identity.cores,
      marca: identity.marca,
      site: identity.site,
      tom_de_voz: identity.tom,
    });
  }

  if (!setup.site) {
    const next = { ...setup, stage: "awaiting_site_url" as const };
    if (!await persistVideoSetup(ctx, next)) return "Não consegui guardar a escolha da marca do cliente. Tente novamente.";
    return "Qual é o site ou o nome do cliente? Ex.: https://empresa.com.br ou Casarão Lustres.";
  }

  if (!setup.cores || setup.stage !== "awaiting_palette_confirmation") {
    return await prepareClientSiteIdentity(ctx, setup, setup.site);
  }

  return "Confirme as cores do site na lista acima para eu gerar o roteiro.";
}

async function startVideoSetup(
  ctx: { userId: string; fromNumber: string; convId?: string; agentState?: AgentConvState },
  originalRequest: string,
  explicit?: { tema?: string; estilo?: string | null; duracao?: string | null; cores?: string; fundo?: string | null },
): Promise<string> {
  if (!isOwner(ctx)) return "Esse recurso é exclusivo do responsável da conta.";
  if (!ctx.convId) return "Não consegui identificar esta conversa para guardar as escolhas do vídeo. Tente novamente.";
  const full = compactSpaces(originalRequest);
  const tema = normalizeVideoTopic(explicit?.tema || full);
  if (!hasUsableVideoTopic(tema)) {
    const waitingForTheme: PendingVideoSetupState = {
      stage: "awaiting_tema",
      tema: "",
      pedido_original: full,
      created_at: new Date().toISOString(),
    };
    if (!await persistVideoSetup(ctx, waitingForTheme)) {
      return "Não consegui guardar o pedido antes de perguntar o tema. Envie o pedido completo novamente.";
    }
    return "Qual é o tema do vídeo? Ex.: mostrar como a plataforma agenda e publica posts.";
  }

  const tracks = await listVideoTracks(ctx.userId);
  const inferredTrack = inferTrackFromRequest(full, tracks);
  const explicitStyle = typeof explicit?.estilo === "string" && ["conversa", "institucional", "lista"].includes(explicit.estilo)
    ? explicit.estilo as EstiloMotion
    : null;
  const site = extractPublicSiteUrl(full);
  const requestedClientName = extractVideoClientName(full);
  const tenantIdentity = requestedClientName
    ? await loadTenantVideoIdentity(ctx.userId)
    : null;
  const requestedTenantBrand = isSameVideoBrandName(
    requestedClientName,
    tenantIdentity?.marca,
  );
  const n = normalizePt(full);
  const identity = requestedTenantBrand
      || /\b(minha marca|minha empresa|nossa marca|nossa empresa)\b/.test(n)
    ? "tenant"
    : site || requestedClientName || /\b(marca|empresa)\s+(?:do|da)\s+(?:meu|minha)\s+cliente\b/.test(n)
      ? "client"
      : undefined;
  const textColors = extrairCoresDoTexto(`${explicit?.cores ?? ""} ${full}`);
  const durationTarget = extractVideoTargetSeconds(full);
  const roteiroCenas = cenasPedidasNoTexto(originalRequest);
  const sceneDuration = roteiroCenas.length
    ? Math.max(0, ...roteiroCenas.map((cena) => cena.fim_segundos ?? 0))
    : 0;
  const resolvedDurationTarget = durationTarget ?? (sceneDuration || undefined);
  if (
    resolvedDurationTarget != null &&
    (resolvedDurationTarget < 20 || resolvedDurationTarget > 95)
  ) {
    return "Hoje os templates animados suportam duração exata entre 20 e 95 segundos. Diga uma duração dentro desse intervalo.";
  }
  const setup: PendingVideoSetupState = {
    stage: "awaiting_template",
    tema,
    pedido_original: full,
    estilo: explicitStyle ?? estiloPedidoNoTexto(full) ?? undefined,
    fundo: explicit?.fundo === "claro" || explicit?.fundo === "escuro"
      ? explicit.fundo
      : fundoPedidoNoTexto(full) ?? undefined,
    trilha_id: inferredTrack?.id,
    trilha_nome: inferredTrack?.nome,
    sem_trilha: inferredTrack?.sem === true,
    identidade: identity,
    site: identity === "client" ? site ?? undefined : undefined,
    marca: identity === "client" ? requestedClientName ?? undefined : undefined,
    cores: textColors?.cores,
    formato: detectVideoOutputFormat(full),
    duracao: typeof explicit?.duracao === "string" && ["curto", "medio", "longo"].includes(explicit.duracao)
      ? explicit.duracao as DuracaoMotion
      : duracaoPedidaNoTexto(full) ?? undefined,
    duracao_alvo_segundos: resolvedDurationTarget,
    frases_literais: [
      ...extractVideoLiteralPhrases(full),
      ...roteiroCenas.map((cena) => cena.texto),
    ],
    roteiro_cenas: roteiroCenas.length ? roteiroCenas : undefined,
    created_at: new Date().toISOString(),
  };
  return await advanceVideoSetup(ctx, setup);
}

function pendingVideoInterruptionButtons(): WhatsAppInteractiveButtons {
  return {
    header: "Vídeo em andamento",
    body: "Você quer continuar o vídeo ou cancelar esse rascunho e fazer o novo pedido?",
    buttons: [
      { id: "video_pending_continue", title: "Continuar vídeo" },
      { id: "video_pending_replace", title: "Cancelar e fazer" },
    ],
  };
}

async function resumePendingVideoSetup(
  ctx: { userId: string; fromNumber: string },
  setup: PendingVideoSetupState,
): Promise<string> {
  if (setup.stage === "awaiting_tema") return "Qual é o tema do vídeo? Pode enviar o roteiro completo.";
  if (setup.stage === "awaiting_template") {
    await askVideoTemplate(ctx, setup.tema);
    return "Continuando o vídeo: escolha o formato na lista acima.";
  }
  if (setup.stage === "awaiting_background") {
    await askVideoBackground(ctx);
    return "Continuando o vídeo: escolha o fundo acima.";
  }
  if (setup.stage === "awaiting_track" || setup.stage === "awaiting_track_more") {
    await askVideoTrack(ctx, await listVideoTracks(ctx.userId), setup.track_page ?? 0);
    return "Continuando o vídeo: escolha a trilha acima.";
  }
  if (setup.stage === "awaiting_identity") {
    await askVideoIdentity(ctx);
    return "Continuando o vídeo: escolha a identidade acima.";
  }
  if (setup.stage === "awaiting_site_url") {
    return "Continuando o vídeo: qual é o site ou o nome do cliente?";
  }
  if (setup.stage === "awaiting_site_logo_confirmation" && setup.site_logo_candidate_path) {
    await askSiteLogoConfirmation(ctx, setup.site_logo_candidate_path);
    return "Continuando o vídeo: confirme a logo acima.";
  }
  if (setup.stage === "awaiting_palette_primary") {
    await askPalettePrimary(ctx, setup.palette_candidates ?? [], setup.palette_options ?? [], setup.logo_path);
    return "Continuando o vídeo: escolha a cor principal acima.";
  }
  if (setup.stage === "awaiting_palette_secondary" && setup.palette_primary) {
    await askPaletteSecondary(ctx, setup.palette_candidates ?? [], setup.palette_primary);
    return "Continuando o vídeo: escolha a cor secundária acima.";
  }
  await askSitePaletteConfirmation(ctx, setup.palette_options ?? [], false, setup.logo_path);
  return "Continuando o vídeo: confirme as cores acima.";
}

function paletteFamily(hex: string): "vermelho" | "laranja" | "amarelo" | "verde" | "azul" | "roxo" | "rosa" | "neutro" {
  if (paletteSaturation(hex) < 0.18) return "neutro";
  const [r, g, b] = rgbPalette(hex).map((value) => value / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let hue = 0;
  if (delta > 0) {
    if (max === r) hue = 60 * (((g - b) / delta) % 6);
    else if (max === g) hue = 60 * ((b - r) / delta + 2);
    else hue = 60 * ((r - g) / delta + 4);
  }
  if (hue < 0) hue += 360;
  if (hue < 15 || hue >= 345) return "vermelho";
  if (hue < 45) return "laranja";
  if (hue < 70) return "amarelo";
  if (hue < 170) return "verde";
  if (hue < 255) return "azul";
  if (hue < 290) return "roxo";
  return "rosa";
}

function adjustPaletteOptions(
  response: string,
  current: VideoPaletteOption[],
): { options?: VideoPaletteOption[]; error?: string } {
  const normalized = normalizePt(response);
  const remove = normalized.match(/\b(?:tira|remove|remova|exclui|exclua)\s+(?:a\s+)?(\d+)\b/);
  if (remove) {
    const index = Number(remove[1]) - 1;
    if (!current[index]) return { error: `Não existe a cor ${remove[1]} nessa paleta.` };
    const options = current.filter((_, itemIndex) => itemIndex !== index);
    if (options.length < 2) return { error: "A paleta precisa manter pelo menos duas cores." };
    return { options };
  }

  const principal = normalized.match(/\btroca(?:r)?\s+(?:a\s+)?principal\s+(?:pela|por)\s+(?:a\s+)?(\d+)\b/);
  if (principal) {
    const index = Number(principal[1]) - 1;
    if (!current[index]) return { error: `Não existe a cor ${principal[1]} nessa paleta.` };
    const oldPrimary = current.findIndex((item) => item.role === "Principal");
    const options = current.map((item) => ({ ...item }));
    if (oldPrimary >= 0 && oldPrimary !== index) {
      const previousRole = options[index].role;
      options[index].role = "Principal";
      options[oldPrimary].role = previousRole === "Principal" ? "Secundária" : previousRole;
    }
    return { options };
  }

  const hexes = [...response.matchAll(/#[0-9a-f]{6}\b/gi)].map((match) => match[0].toLowerCase());
  if (hexes.length >= 2) {
    const extracted = extrairCoresDoTexto(response);
    const background = /\b(fundo|background)\b/.test(normalized)
      ? extracted?.cores.bg
      : current.find((item) => item.role === "Fundo")?.hex;
    const text = /\b(texto|letra|fonte)\b/.test(normalized)
      ? extracted?.cores.texto
      : current.find((item) => item.role === "Texto")?.hex;
    const options = paletteOptionsFromColors([
      ...hexes,
      background ?? "#ffffff",
      text ?? "#1a1a1a",
    ]);
    return { options };
  }

  const requestedFamilies = ["verde", "azul", "vermelho", "laranja", "amarelo", "roxo", "rosa"]
    .filter((family) => new RegExp(`\\b${family}\\b`).test(normalized));
  if (requestedFamilies.length > 0) {
    const selected = current.filter((item) => requestedFamilies.includes(paletteFamily(item.hex)));
    if (selected.length === 0) {
      return { error: `Não encontrei ${requestedFamilies.join(" ou ")} entre as cores extraídas do site.` };
    }
    const brand = selected.map((item, index) => ({
      ...item,
      role: (index === 0 ? "Principal" : "Secundária") as VideoPaletteOption["role"],
    }));
    const neutrals = current.filter((item) => item.role === "Fundo" || item.role === "Texto");
    return { options: [...brand.slice(0, 2), ...neutrals] };
  }
  return {};
}

async function handlePendingVideoSetup(
  ctx: { userId: string; fromNumber: string; convId?: string; agentState?: AgentConvState },
  setup: PendingVideoSetupState,
  response: string,
): Promise<string> {
  const age = Date.now() - new Date(setup.created_at).getTime();
  if (!Number.isFinite(age) || age > 2 * 60 * 60 * 1000) {
    if (setup.site_logo_candidate_path) {
      await sb.storage.from("tenant-logos").remove([setup.site_logo_candidate_path]);
    }
    await persistVideoSetup(ctx, null);
    return "As escolhas desse vídeo expiraram. Peça o vídeo novamente para recomeçar.";
  }
  if (isVideoCancellation(response)) {
    if (setup.logo_path?.startsWith(`${ctx.userId}/video-site/`)) {
      await sb.storage.from("tenant-logos").remove([setup.logo_path]);
    }
    if (setup.site_logo_candidate_path) {
      await sb.storage.from("tenant-logos").remove([setup.site_logo_candidate_path]);
    }
    await persistVideoSetup(ctx, null);
    return "Pedido de vídeo cancelado. Não gerei roteiro nem renderizei nada.";
  }

  const n = normalizePt(response);
  const interactiveId = extractVideoInteractiveId(response);
  if (setup.stage === "awaiting_tema") {
    if (!hasUsableVideoTopic(normalizeVideoTopic(response))) {
      return "Qual é o tema do vídeo? Pode enviar o roteiro completo.";
    }
    return await startVideoSetup(
      ctx,
      `${setup.pedido_original}\n${response}`.trim(),
    );
  }
  if (setup.stage === "awaiting_template") {
    const estilo = interactiveId === "video_template_institucional" || /institucional/.test(n)
      ? "institucional"
      : interactiveId === "video_template_lista" || /\blista\b|passo a passo/.test(n)
        ? "lista"
        : interactiveId === "video_template_conversa" || /conversa|celular|whatsapp/.test(n)
          ? "conversa"
          : null;
    if (!estilo) {
      await askVideoTemplate(ctx, setup.tema);
      return "Não reconheci o formato. Escolha uma opção na lista acima.";
    }
    return await advanceVideoSetup(ctx, { ...setup, estilo });
  }

  if (setup.stage === "awaiting_background") {
    const fundo = interactiveId === "video_background_light" || /^fundo claro$/.test(n)
      ? "claro"
      : interactiveId === "video_background_dark" || /^fundo escuro$/.test(n)
        ? "escuro"
        : fundoPedidoNoTexto(response);
    if (!fundo) {
      await askVideoBackground(ctx);
      return "Não reconheci o fundo. Escolha *Fundo escuro* ou *Fundo claro*.";
    }
    return await advanceVideoSetup(ctx, { ...setup, fundo });
  }

  if (setup.stage === "awaiting_track" || setup.stage === "awaiting_track_more") {
    const tracks = await listVideoTracks(ctx.userId);
    if (interactiveId === "video_track_more" || /ver outras trilhas/.test(n)) {
      const nextPage = (setup.track_page ?? 0) + 1;
      const next = { ...setup, stage: "awaiting_track_more" as const, track_page: nextPage };
      await persistVideoSetup(ctx, next);
      await askVideoTrack(ctx, tracks, nextPage);
      return "Mostrei as outras trilhas na lista acima 👆";
    }
    if (interactiveId === "video_track_back" || /voltar as primeiras|voltar às primeiras/.test(n)) {
      const next = { ...setup, stage: "awaiting_track" as const, track_page: 0 };
      await persistVideoSetup(ctx, next);
      await askVideoTrack(ctx, tracks, 0);
      return "Voltei para as primeiras trilhas 👆";
    }
    if (interactiveId === "video_track_none" || /^sem trilha(?:\s+interactive id.*)?$/.test(n)) {
      return await advanceVideoSetup(ctx, { ...setup, trilha_id: null, trilha_nome: undefined, sem_trilha: true });
    }
    const selectedId = interactiveId?.match(/^video_track_([0-9a-f-]{36})$/i)?.[1];
    const selected = selectedId
      ? tracks.find((track) => track.id === selectedId)
      : tracks.find((track) => normalizePt(track.nome.slice(0, 24)) === n);
    if (!selected) {
      await askVideoTrack(ctx, tracks, setup.track_page ?? 0);
      return "Não reconheci a trilha. Escolha uma opção na lista acima.";
    }
    return await advanceVideoSetup(ctx, {
      ...setup,
      trilha_id: selected.id,
      trilha_nome: selected.nome,
      sem_trilha: false,
    });
  }

  if (setup.stage === "awaiting_identity") {
    if (interactiveId === "video_identity_tenant" || /minha empresa/.test(n)) {
      return await advanceVideoSetup(ctx, { ...setup, identidade: "tenant" });
    }
    if (interactiveId === "video_identity_client" || /marca do meu cliente/.test(n)) {
      return await advanceVideoSetup(ctx, { ...setup, identidade: "client" });
    }
    await askVideoIdentity(ctx);
    return "Não reconheci a identidade. Escolha uma opção na lista acima.";
  }

  if (setup.stage === "awaiting_site_url") {
    const url = extractPublicSiteUrl(response);
    if (!url) {
      const saved = await findClientBrandIdentity(sb, ctx.userId, { name: response });
      if (!saved || !clientLogoPath(saved)) {
        return "Não encontrei uma identidade salva com esse nome. Envie a URL do site ou o nome exato do cliente.";
      }
      if (saved.site_url) {
        return await prepareClientSiteIdentity(ctx, {
          ...setup,
          marca: saved.client_name,
          logo_path: clientLogoPath(saved) || undefined,
          logo_light_background_path:
            clientLogoPath(saved, "light") || undefined,
          logo_dark_background_path:
            clientLogoPath(saved, "dark") || undefined,
        }, saved.site_url);
      }
      const savedColors = Array.isArray(saved.identity?.colors)
        ? saved.identity.colors.filter((color): color is string =>
          typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color)
        )
        : [];
      const options = paletteOptionsFromColors(savedColors);
      const applied = [
        clientLogoPath(saved) ? "logo salva do cliente" : null,
        savedColors.length ? `cores ${savedColors.slice(0, 4).join(" · ")}` : null,
      ].filter(Boolean).join(" + ") || "paleta automática sem logo";
      const next = {
        ...setup,
        stage: "awaiting_palette_confirmation" as const,
        marca: saved.client_name,
        logo_path: clientLogoPath(saved) || undefined,
        logo_light_background_path:
          clientLogoPath(saved, "light") || undefined,
        logo_dark_background_path:
          clientLogoPath(saved, "dark") || undefined,
        cores: options.length ? paletteFromOptions(options) : undefined,
        palette_options: options,
        identity_summary: `${saved.client_name} — ${applied}`,
      };
      if (!await persistVideoSetup(ctx, next)) {
        return "Encontrei a logo, mas não consegui vinculá-la ao pedido. Tente novamente.";
      }
      return await finalizeVideoSetup(ctx, next);
    }
    return await prepareClientSiteIdentity(ctx, setup, url);
  }

  // Compatibilidade com pendências criadas antes do fluxo automático:
  // qualquer resposta retoma com a identidade já extraída, sem novas
  // confirmações de logo ou paleta.
  const legacyIdentityStage = [
    "awaiting_site_logo_confirmation",
    "awaiting_palette_primary",
    "awaiting_palette_secondary",
    "awaiting_palette_confirmation",
  ].includes(setup.stage);
  if (legacyIdentityStage) {
    const withoutLogo = /\b(?:sem|tirar|tira|remover|remove)\s+(?:a\s+)?logo\b/i.test(response);
    const candidatePath = setup.site_logo_candidate_path;
    if (withoutLogo && candidatePath) {
      await sb.storage.from("tenant-logos").remove([candidatePath]);
    }
    const adjusted = adjustPaletteOptions(response, setup.palette_options ?? []);
    const options = adjusted.options ?? setup.palette_options ?? [];
    const next = {
      ...setup,
      stage: "awaiting_palette_confirmation" as const,
      logo_path: withoutLogo ? undefined : setup.logo_path ?? candidatePath,
      site_logo_candidate_path: undefined,
      palette_options: options,
      cores: options.length ? paletteFromOptions(options) : setup.cores,
    };
    return await finalizeVideoSetup(ctx, next);
  }

  if (setup.stage === "awaiting_site_logo_confirmation") {
    const accepted = interactiveId === "video_site_logo_use"
      || /^(usar|use|confirmo|confirmar|sim|essa e a logo|essa é a logo)$/i.test(response.trim());
    const rejected = interactiveId === "video_site_logo_reject"
      || /^(nao|não|rejeitar|nao e a logo|não é a logo|gerar sem logo)$/i.test(response.trim());
    if (!accepted && !rejected) {
      if (setup.site_logo_candidate_path) {
        await askSiteLogoConfirmation(ctx, setup.site_logo_candidate_path);
      }
      return "Confirme se a imagem mostrada é a logo do cliente ou escolha gerar sem ela.";
    }
    const candidatePath = setup.site_logo_candidate_path;
    if (rejected && candidatePath) {
      await sb.storage.from("tenant-logos").remove([candidatePath]);
    }
    const hasCandidates = (setup.palette_candidates?.length ?? 0) > 0;
    const next = {
      ...setup,
      stage: (hasCandidates ? "awaiting_palette_primary" : "awaiting_palette_confirmation") as PendingVideoSetupStage,
      logo_path: accepted ? candidatePath : undefined,
      site_logo_candidate_path: undefined,
    };
    if (!await persistVideoSetup(ctx, next)) {
      return "Não consegui guardar sua decisão sobre a logo. Não gerei o roteiro; tente novamente.";
    }
    if (hasCandidates) {
      await askPalettePrimary(ctx, next.palette_candidates ?? [], next.palette_options ?? [], next.logo_path);
      return accepted
        ? "Logo confirmada somente para este vídeo. Agora escolha a cor principal."
        : "Imagem descartada. O vídeo seguirá sem logo; agora escolha a cor principal.";
    }
    await askSitePaletteConfirmation(ctx, [], true, next.logo_path);
    return accepted
      ? "Logo confirmada somente para este vídeo. Agora envie pelo menos duas cores da marca."
      : "Imagem descartada. O vídeo seguirá sem logo; agora envie pelo menos duas cores da marca.";
  }

  if (setup.stage === "awaiting_palette_primary") {
    const candidates = setup.palette_candidates ?? [];
    const selectedFromList = interactiveId?.match(/^video_palette_primary_([0-9a-f]{6})$/i)?.[1];
    const selectedFromText = response.match(/\bprincipal\s*:?\s*(#[0-9a-f]{6})\b/i)?.[1];
    const selected = (selectedFromList ? `#${selectedFromList}` : selectedFromText)?.toLowerCase();
    if (selected && candidates.includes(selected)) {
      const next = {
        ...setup,
        stage: "awaiting_palette_secondary" as const,
        palette_primary: selected,
      };
      if (!await persistVideoSetup(ctx, next)) {
        return "Não consegui guardar a cor principal. Não gerei o roteiro; tente novamente.";
      }
      await askPaletteSecondary(ctx, candidates, selected);
      return `Principal escolhida: ${selected.toUpperCase()}. Agora escolha a secundária na lista acima.`;
    }
    const adjusted = adjustPaletteOptions(response, setup.palette_options ?? []);
    if (adjusted.options) {
      const next = {
        ...setup,
        stage: "awaiting_palette_confirmation" as const,
        palette_options: adjusted.options,
        cores: paletteFromOptions(adjusted.options),
      };
      if (!await persistVideoSetup(ctx, next)) {
        return "Não consegui guardar o ajuste da paleta. Não gerei o roteiro; tente novamente.";
      }
      await askSitePaletteConfirmation(ctx, adjusted.options, false, setup.logo_path);
      return "Atualizei a paleta pelo seu comando. Confira a prévia e confirme.";
    }
    await askPalettePrimary(ctx, candidates, setup.palette_options ?? [], setup.logo_path);
    return adjusted.error
      ? `${adjusted.error} Escolha a principal na lista acima.`
      : "Não reconheci a cor principal. Toque em uma opção da lista acima.";
  }

  if (setup.stage === "awaiting_palette_secondary") {
    const candidates = setup.palette_candidates ?? [];
    const primary = setup.palette_primary;
    if (!primary) {
      await persistVideoSetup(ctx, { ...setup, stage: "awaiting_palette_primary" });
      await askPalettePrimary(ctx, candidates, setup.palette_options ?? [], setup.logo_path);
      return "A escolha da principal não estava registrada. Escolha novamente na lista acima.";
    }
    const selectedFromList = interactiveId?.match(/^video_palette_secondary_([0-9a-f]{6})$/i)?.[1];
    const selectedFromText = response.match(/\bsecund[aá]ria\s*:?\s*(#[0-9a-f]{6})\b/i)?.[1];
    const none = interactiveId === "video_palette_secondary_none" || /^(nenhuma|sem secund[aá]ria|s[oó] a principal)$/.test(n);
    const secondary = (selectedFromList ? `#${selectedFromList}` : selectedFromText)?.toLowerCase();
    if (none || (secondary && candidates.includes(secondary) && secondary !== primary)) {
      const neutrals = (setup.palette_options ?? [])
        .filter((item) => item.role === "Fundo" || item.role === "Texto")
        .map((item) => item.hex);
      const options = paletteOptionsFromColors([primary, ...(secondary ? [secondary] : []), ...neutrals]);
      const next = {
        ...setup,
        stage: "awaiting_palette_confirmation" as const,
        palette_options: options,
        cores: paletteFromOptions(options),
      };
      if (!await persistVideoSetup(ctx, next)) {
        return "Não consegui guardar a cor secundária. Não gerei o roteiro; tente novamente.";
      }
      await askSitePaletteConfirmation(ctx, options, false, setup.logo_path);
      return "Paleta montada. Confira os números e códigos na prévia e confirme.";
    }
    const adjusted = adjustPaletteOptions(response, setup.palette_options ?? []);
    if (adjusted.options) {
      const next = {
        ...setup,
        stage: "awaiting_palette_confirmation" as const,
        palette_options: adjusted.options,
        cores: paletteFromOptions(adjusted.options),
      };
      if (!await persistVideoSetup(ctx, next)) {
        return "Não consegui guardar o ajuste da paleta. Não gerei o roteiro; tente novamente.";
      }
      await askSitePaletteConfirmation(ctx, adjusted.options, false, setup.logo_path);
      return "Atualizei a paleta pelo seu comando. Confira a prévia e confirme.";
    }
    await askPaletteSecondary(ctx, candidates, primary);
    return adjusted.error
      ? `${adjusted.error} Escolha a secundária na lista acima.`
      : "Não reconheci a cor secundária. Toque em uma opção ou escolha Nenhuma.";
  }

  if (setup.stage === "awaiting_palette_confirmation") {
    if (interactiveId === "video_identity_send_logo" || /enviar logo/.test(n)) {
      return "Anexe agora o arquivo da logo em PNG, JPEG ou WEBP. Depois, envie pelo menos duas cores da marca em hexadecimal, por exemplo: #112233 e #AABBCC.";
    }
    if (interactiveId === "video_identity_manual_colors" || /informar as cores/.test(n)) {
      return "Envie pelo menos duas cores confirmadas da marca em hexadecimal, por exemplo: principal #112233 e secundária #AABBCC.";
    }
    if (interactiveId === "video_palette_retry" || /informar outro site/.test(n)) {
      if (setup.logo_path?.startsWith(`${ctx.userId}/video-site/`)) {
        await sb.storage.from("tenant-logos").remove([setup.logo_path]);
      }
      const next = {
        ...setup,
        stage: "awaiting_site_url" as const,
        site: undefined,
        cores: undefined,
        palette_options: undefined,
        palette_candidates: undefined,
        palette_primary: undefined,
        logo_path: undefined,
      };
      await persistVideoSetup(ctx, next);
      return "Envie a nova URL do site do cliente.";
    }
    if (
      (setup.palette_options?.length ?? 0) > 0
      && (interactiveId === "video_palette_default" || /usar paleta padrao|usar paleta padrão/.test(n))
    ) {
      return await finalizeVideoSetup(ctx, { ...setup, cores: PALETA_PADRAO });
    }
    if (
      interactiveId === "video_palette_use"
      || /usar estas cores|usar cores encontradas/.test(n)
      || /^(confirmar|confirmo|confirmado|pode usar|sim)$/.test(n)
    ) {
      if (!setup.cores || (setup.palette_options?.length ?? 0) === 0) {
        return "Ainda não tenho cores confirmadas. Envie pelo menos duas cores em hexadecimal ou anexe a logo da marca.";
      }
      return await finalizeVideoSetup(ctx, setup);
    }
    const adjusted = adjustPaletteOptions(response, setup.palette_options ?? []);
    if (adjusted.error) {
      await askSitePaletteConfirmation(ctx, setup.palette_options ?? [], false, setup.logo_path);
      return `${adjusted.error} Mostrei a paleta novamente acima.`;
    }
    if (adjusted.options) {
      const next = {
        ...setup,
        palette_options: adjusted.options,
        cores: paletteFromOptions(adjusted.options),
      };
      if (!await persistVideoSetup(ctx, next)) {
        return "Não consegui guardar o ajuste da paleta. Não gerei o roteiro; tente novamente.";
      }
      await askSitePaletteConfirmation(ctx, adjusted.options, false, setup.logo_path);
      return "Atualizei a paleta e mostrei uma nova prévia. Confirme quando estiver correta.";
    }
    await askSitePaletteConfirmation(ctx, setup.palette_options ?? [], !setup.palette_options?.length, setup.logo_path);
    return "Não entendi o ajuste. Use o número ou os códigos das cores, ou responda *confirmar*.";
  }

  return "Não consegui retomar as escolhas do vídeo. Cancele e peça novamente.";
}

async function buscarRascunhoVideo(ctx: { userId: string; fromNumber: string }): Promise<any | null> {
  const { data, error } = await sb.from("video_motion_rascunhos")
    .select("*")
    .eq("user_id", ctx.userId)
    .eq("telefone", ctx.fromNumber)
    .eq("status", "aguardando_aprovacao")
    .gt("expira_em", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) {
    console.warn("[video-motion][draft-load]", error.message);
    return null;
  }
  return data?.[0] ?? null;
}

async function refazerVideoMotion(
  ctx: { userId: string; fromNumber: string },
  ajuste: string,
): Promise<string> {
  if (!isOwner(ctx)) {
    return "Esse recurso é exclusivo do responsável da conta.";
  }
  const base = await buscarBaseRefazerVideoMotion(
    sb,
    ctx.userId,
    ctx.fromNumber,
  );
  if (!base) {
    return "Não encontrei um vídeo anterior para refazer. Qual vídeo você quer refazer?";
  }
  const adjusted = aplicarAjusteRoteiroMotion(base.props, ajuste);
  if (!adjusted.changed) {
    return "Qual mudança você quer fazer no último vídeo? Diga, por exemplo, o novo fundo, título, destaque ou a cena que deve ser corrigida.";
  }
  const token = base.source === "draft" &&
      base.status === "aguardando_aprovacao" && base.token
    ? base.token
    : videoDraftToken();
  let id = base.id;
  if (base.source === "draft" && base.status === "aguardando_aprovacao") {
    const { data, error } = await sb.from("video_motion_rascunhos").update({
      props: adjusted.props,
      legenda_post: base.legendaPost || null,
      expira_em: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    }).eq("id", base.id).eq("user_id", ctx.userId)
      .eq("status", "aguardando_aprovacao").select("id").maybeSingle();
    if (error || !data) {
      return "Não consegui atualizar o último roteiro. Nenhum vídeo foi renderizado.";
    }
  } else {
    const { data, error } = await sb.from("video_motion_rascunhos").insert({
      user_id: ctx.userId,
      telefone: ctx.fromNumber,
      token,
      tema: base.tema,
      props: adjusted.props,
      legenda_post: base.legendaPost || null,
      formato: base.formato || "reels",
      status: "aguardando_aprovacao",
    }).select("id").single();
    if (error || !data) {
      return "Não consegui salvar a nova versão do roteiro. Nenhum vídeo foi renderizado.";
    }
    id = data.id;
  }
  const segundos = duracaoEstimada(adjusted.props);
  return `${
    formatVideoDraft(
      adjusted.props,
      base.tema,
      segundos,
      `fundo ${adjusted.props.cores.bg}, destaque ${adjusted.props.cores.destaque}`,
    )
  }\n\nAjustei somente o que você pediu no roteiro ${id}.\nCódigo de aprovação: *${token}*`;
}

async function confirmarRascunhoVideo(ctx: { userId: string; fromNumber: string }, cancelar = false): Promise<string> {
  if (!isOwner(ctx)) return "A aprovação do vídeo só pode ser feita pelo responsável da conta.";
  const draft = await buscarRascunhoVideo(ctx);
  if (!draft) return "Não encontrei um roteiro de vídeo aguardando aprovação. Se quiser, peça um novo vídeo com o tema.";
  if (cancelar) {
    const { error } = await sb.from("video_motion_rascunhos")
      .update({ status: "cancelado" })
      .eq("id", draft.id)
      .eq("user_id", ctx.userId)
      .eq("status", "aguardando_aprovacao");
    if (error) return `Não consegui descartar o roteiro: ${error.message}`;
    const logoPath = typeof draft.props?.logo_path === "string" ? draft.props.logo_path : "";
    if (logoPath.startsWith(`${ctx.userId}/video-site/`)) {
      const { error: removeError } = await sb.storage.from("tenant-logos").remove([logoPath]);
      if (removeError) console.error("[video-setup][cancel-logo-cleanup]", removeError.message);
    }
    return "Roteiro descartado. Nenhum vídeo será renderizado.";
  }

  // Claim atômico: duas mensagens repetidas não podem criar dois jobs para o mesmo roteiro.
  const { data: claimed, error: claimError } = await sb.from("video_motion_rascunhos")
    .update({ status: "aprovando" })
    .eq("id", draft.id)
    .eq("user_id", ctx.userId)
    .eq("status", "aguardando_aprovacao")
    .select("id")
    .maybeSingle();
  if (claimError) return `Não consegui iniciar a aprovação: ${claimError.message}`;
  if (!claimed) return "Esse roteiro já está sendo processado ou não está mais disponível.";

  const r = await enfileirarVideoMotion({
    sb,
    userId: ctx.userId,
    tema: draft.tema,
    origem: "whatsapp",
    telefone: ctx.fromNumber,
    props: draft.props,
    legendaPost: draft.legenda_post,
    formato: draft.formato,
  });
  if (!r.ok) {
    await sb.from("video_motion_rascunhos")
      .update({ status: "aguardando_aprovacao" })
      .eq("id", draft.id)
      .eq("user_id", ctx.userId)
      .eq("status", "aprovando");
    return r.error;
  }
  const { error } = await sb.from("video_motion_rascunhos")
    .update({ status: "aprovado" })
    .eq("id", draft.id)
    .eq("user_id", ctx.userId)
    .eq("status", "aprovando");
  if (error) return `O vídeo foi enfileirado, mas não consegui atualizar o roteiro: ${error.message}`;
  return `✅ Roteiro aprovado e vídeo enfileirado. Posição na fila: *${r.posicao_fila}*. Vou te enviar o MP4 aqui quando terminar (estimativa: cerca de 4 minutos).`;
}

const TOOLS = [
  {
    type: "function",
    function: {
      name: "consultar_cnpj",
      description: "Consulta dados oficiais de uma empresa brasileira pelo CNPJ na Receita Federal (via BrasilAPI). Retorna razão social, sócios, endereço, CNAE, capital social e situação cadastral.",
      parameters: {
        type: "object",
        properties: { cnpj: { type: "string", description: "CNPJ com ou sem formatação (14 dígitos)" } },
        required: ["cnpj"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "pesquisar_web",
      description: "Pesquisa no Google (pt-BR). Retorna títulos, links, resumos, datas E o conteúdo textual extraído das 3 primeiras páginas (campo 'conteudo_extraido'). USE 'conteudo_extraido' como fonte primária ao responder — cite valores/números/datas literalmente conforme aparecem. Ideal para notícias, eventos, resultados, greves, agenda, previsões, clima extremo, informações factuais recentes. NÃO use para cotação de moeda/cripto (chame cotacao_moeda). Inclua ano/mês atual na query e use 'recencia' pra janela temporal.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Termo de busca. Inclua ano/mês/data quando fizer sentido (ex: 'greve ônibus Rio Janeiro dezembro 2026')." },
          recencia: { type: "string", enum: ["d", "w", "m", "y"], description: "Janela: d=últimas 24h, w=última semana, m=último mês, y=último ano. Omita para busca geral." },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "buscar_lugares_proximos",
      description: "Busca lugares (cafeteria, farmácia, mercado, restaurante, posto, hospital, etc.) próximos à localização que o usuário compartilhou no WhatsApp. Retorna nome, endereço, distância, avaliação e se está aberto. Se o usuário nunca compartilhou localização, retorna erro pedindo pra ele mandar via 📎 → Localização.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Tipo de lugar em linguagem natural, ex: 'cafeteria', 'farmácia 24h', 'hamburgueria', 'mercado'" },
          radius_meters: { type: "number", description: "Raio de busca em metros (padrão 2000, máx 20000)" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "gerar_imagem",
      description: "Cria imagem ultrarrealista. Dono: uso normal e mídia pronta para publicação. Prospect do tenant AMZ: no máximo UMA demonstração por telefone; se ele informou um site, passe a URL em site_url para usar a identidade somente nessa imagem. Envie só na conversa, com exemplo de legenda, e diga que nada foi publicado. Cliente final de qualquer outro tenant: bloqueado pelo código. Nunca coloque URL dentro do prompt visual.",
      parameters: {
        type: "object",
        properties: {
          prompt: { type: "string", description: "Descrição visual detalhada. Inclua estilo (fotorealista, cartoon, aquarela), enquadramento, iluminação, cores, elementos. Ex: 'foto profissional de um café expresso em mesa de madeira rústica, luz natural quente, estilo editorial'" },
          incluir_logo: { type: "boolean", description: "A logo cadastrada é usada por padrão. Informe false SOMENTE quando o usuário pedir explicitamente 'sem logo' ou 'sem marca'. A logo original é aplicada no servidor depois da geração." },
          site_url: { type: "string", description: "Somente na demonstração AMZ: site informado pelo prospect para usar logo/cores temporariamente nesta imagem. Nunca invente nem use site de outro negócio." },
          brand_colors: { type: "array", items: { type: "string" }, description: "Somente na demonstração AMZ sem site: cores hex informadas pelo próprio prospect." },
        },
        required: ["prompt"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_clima",
      description: "Consulta clima atual e previsão de 3 dias para uma cidade (ou lat,lng). Se a cidade não for informada, usa a última localização compartilhada pelo usuário. Retorna temperatura, sensação, umidade, vento e previsão.",
      parameters: {
        type: "object",
        properties: { local: { type: "string", description: "Nome da cidade (ex: 'São Paulo'), ou coordenadas 'lat,lng'. Opcional se o usuário já compartilhou localização." } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "cotacao_moeda",
      description: "ÚNICA fonte válida para cotação AO VIVO de moedas e criptos (AwesomeAPI, atualiza a cada segundo). SEMPRE use esta ferramenta — NUNCA responda cotação a partir de pesquisar_web (que traz páginas defasadas). Pares aceitos: USD-BRL (dólar), EUR-BRL (euro), GBP-BRL (libra), JPY-BRL (iene), ARS-BRL (peso), BTC-BRL (bitcoin), ETH-BRL (ethereum), SOL-BRL (solana), BNB-BRL, XRP-BRL, DOGE-BRL, ADA-BRL. Para pares em USD use SUFIXO -USD (ex: BTC-USD, ETH-USD). Chame múltiplas vezes se o usuário pedir várias moedas.",
      parameters: {
        type: "object",
        properties: { par: { type: "string", description: "Par no formato ORIGEM-DESTINO, ex: USD-BRL" } },
        required: ["par"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "editar_imagem",
      description: "Edita/melhora uma FOTO enviada no WhatsApp (mesma mensagem ou foto recente dos últimos 30 min). Use quando pedirem 'melhora essa foto', 'deixa mais bonita/profissional', 'troca o fundo', 'coloca luz natural', 'monta um anúncio dessa foto', 'coloca os dados do carro na imagem', 'coloca meu filho com a roupa do Homem-Aranha'. NÃO use pra criar imagem do zero (use gerar_imagem). IMPORTANTE: quando o usuário citar dados (quilometragem, ano/modelo, 'único dono', 'mais conservado', preço, etc.), coloque cada dado como um item do array 'textos' — assim eles aparecem escritos na imagem. Quando ele pedir troca de roupa/fantasia mantendo o local, use modo='figurino'. A imagem editada é enviada automaticamente — responda com legenda curta descrevendo o que ajustou.",
      parameters: {
        type: "object",
        properties: {
          prompt: { type: "string", description: "Descrição da edição desejada. Ex: 'anúncio profissional desse SUV prata, luz de fim de tarde, fundo elegante desfocado' — mantendo o veículo/pessoa original." },
          textos: { type: "array", items: { type: "string" }, description: "Até 6 frases curtas para APARECEREM escritas na imagem, ao lado do objeto. Ex: ['45.000 km', 'Ano/Modelo 2021/2022', 'Único dono', 'Todas as revisões na concessionária']. Deixe vazio se o usuário não pediu texto na imagem." },
          modo: { type: "string", enum: ["melhoria", "ficha_tecnica", "figurino", "aplicar_logo"], description: "'aplicar_logo' = OBRIGATÓRIO sempre que ele pedir pra colocar/incluir a LOGO, a MARCA ou a logomarca em algum ponto da foto (na xícara, na camisa, na parede, no carro): a foto original é mantida pixel a pixel e SÓ a marca é aplicada — nunca gere outra foto nesse caso; 'ficha_tecnica' = anúncio comercial de produto/veículo: o cenário original é DESCARTADO e o produto vai pra um set de estúdio/showroom limpo (use quando ele pedir anúncio, arte, 'ambiente bonito', 'fundo profissional', ou quando a foto tiver bagunça de casa: fios, TV, móveis); 'figurino' = trocar roupa/fantasia mantendo rosto e ambiente; 'melhoria' = só melhorar nitidez/luz mantendo a cena." },
          preservar_ambiente: { type: "boolean", description: "Omita normalmente. Em modo 'ficha_tecnica' o cenário é trocado por padrão — só passe true se ele pedir EXPLICITAMENTE para manter o local original. Em 'melhoria'/'figurino'/'aplicar_logo' o padrão já é manter." },
        },
        required: ["prompt"],
      },

    },
  },
  {
    type: "function",
    function: {
      name: "criar_lembrete",
      description: "Cria um lembrete/aviso que a Jarvis vai disparar no WhatsApp do usuário automaticamente: 1º aviso 30 minutos antes e depois a cada 10 minutos até a hora combinada, além de um aviso final na hora exata. Use SEMPRE que o usuário pedir 'me lembra', 'me avisa', 'agenda um lembrete', 'não me deixa esquecer', 'me chama X minutos antes'. Você DEVE calcular a data/hora absoluta em horário de São Paulo a partir da 'Data/hora atual' informada no system prompt (ex: 'amanhã 15h' → soma 1 dia à data de hoje). Prefira o parâmetro data_hora_sp. Use minutos_a_partir_de_agora só quando o usuário disser algo como 'daqui 20 minutos'.",
      parameters: {
        type: "object",
        properties: {
          titulo: { type: "string", description: "Assunto curto do lembrete, ex: 'Reunião com Marcelo Martins'" },
          data_hora_sp: { type: "string", description: "Data/hora absoluta em horário de São Paulo no formato 'YYYY-MM-DD HH:MM'. Ex: '2026-07-03 15:00'." },
          minutos_a_partir_de_agora: { type: "number", description: "Alternativa: minutos até o evento a partir de agora. Ex: 20." },
        },
        required: ["titulo"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "listar_contatos_comerciais",
      description: "Lista os CONTATOS COMERCIAIS do dono (clientes, parceiros, prospects próximos com quem ele tem relação direta — Marcelo Martins, Renata, etc). Use ANTES de enviar mensagem quando o dono citar alguém pelo primeiro nome e você precisar confirmar quem é / achar o ID / ver o contexto do relacionamento. Também use pra responder 'quais são meus contatos comerciais', 'me lembra do Marcelo', 'qual o whats da Renata'.",
      parameters: {
        type: "object",
        properties: {
          busca: { type: "string", description: "Filtro opcional por nome ou empresa. Ex: 'marcelo', 'ademicon'. Vazio = lista tudo." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "enviar_mensagem_contato_comercial",
      description: "Envia uma MENSAGEM DE WHATSAPP TEXTO humanizada para um contato comercial (tabela contatos_comerciais), agora ou agendada. NUNCA faz ligação de voz — Jarvis só envia texto. Use quando o dono mandar comandos tipo 'manda mensagem pro Marcelo confirmando nossa reunião amanhã 10:30', 'avisa a Renata que...', 'faz follow-up com o cliente X'.\n\nVOCÊ (Jarvis) COMPÕE o texto da mensagem no parâmetro 'mensagem' — em nome do dono, gentil, humanizado, se apresentando como 'aqui é o Jarvis, assistente do Felício'.\n\n⚠️ REGRA CRÍTICA DE IDENTIFICAÇÃO DO CONTATO (leia antes de chamar):\n• NUNCA INVENTE contato_id. Só passe contato_id se veio EXATAMENTE do retorno de listar_contatos_comerciais nesta mesma conversa.\n• Se você não tem certeza absoluta do UUID, NÃO mande contato_id. Mande APENAS 'nome_busca' com o primeiro nome (ex: 'Marcelo') OU 'whatsapp' com o número que o dono forneceu.\n• Se o dono já te deu o número de telefone (ex: '5521964641312' ou '(21) 96464-1312'), passe em 'whatsapp' — o sistema faz o match automático.\n• Sempre passe 'nome_busca' junto quando não tiver certeza do contato_id — é redundância que salva.\n\nAgendamento: use 'data_hora_sp' (YYYY-MM-DD HH:MM em SP) pra momento futuro; omita ambos os campos de tempo pra enviar AGORA.",
      parameters: {
        type: "object",
        properties: {
          contato_id: { type: "string", description: "UUID EXATO retornado por listar_contatos_comerciais nesta conversa. NUNCA invente. Se em dúvida, deixe vazio e use nome_busca/whatsapp." },
          nome_busca: { type: "string", description: "Primeiro nome ou parte do nome (ex: 'Marcelo'). Use sempre que não tiver 100% de certeza do contato_id." },
          whatsapp: { type: "string", description: "Número de WhatsApp do contato, se o dono forneceu (com ou sem DDD/formatação). Match automático pelos últimos 8-10 dígitos." },
          mensagem: { type: "string", description: "Texto COMPLETO da mensagem WhatsApp já humanizado, em nome do dono. Mín 20 chars. SEMPRE inclua o primeiro nome do contato no início (ex: 'Oi Marcelo, tudo bem? Aqui é o Jarvis, assistente do Felício...')." },
          data_hora_sp: { type: "string", description: "Opcional. Envio agendado em horário SP no formato 'YYYY-MM-DD HH:MM'. Omita pra enviar agora." },
          minutos_a_partir_de_agora: { type: "number", description: "Opcional. Alternativa a data_hora_sp: minutos até o envio." },
          tipo_acao: { type: "string", enum: ["confirmar_reuniao", "followup_proposta", "resposta_comercial", "checkin_relacionamento", "mensagem_livre"], description: "Categoria da ação pra log/analytics. Padrão: mensagem_livre." },
        },
        required: ["mensagem"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "salvar_nota",
      description: "Salva uma nota rápida / segunda memória do usuário. Use quando ele disser 'anota que…', 'lembra que…', 'guarda essa info', 'grava aí que…'.",
      parameters: { type: "object", properties: { conteudo: { type: "string" }, tags: { type: "array", items: { type: "string" }, description: "Palavras-chave opcionais pra facilitar busca depois" } }, required: ["conteudo"] },
    },
  },
  {
    type: "function",
    function: {
      name: "buscar_notas",
      description: "Busca notas salvas anteriormente. Use quando o usuário perguntar 'qual era o CNPJ da X?', 'o que eu tinha anotado sobre Y?', 'me lembra o que eu falei sobre Z'.",
      parameters: { type: "object", properties: { query: { type: "string", description: "Termo/palavra-chave. Vazio = últimas notas." } } },
    },
  },
  {
    type: "function",
    function: {
      name: "adicionar_tarefa",
      description: "Adiciona uma tarefa na to-do list do usuário. Use quando disser 'adiciona na minha lista', 'preciso fazer X', 'coloca X pra eu fazer amanhã'.",
      parameters: { type: "object", properties: { titulo: { type: "string" }, prazo_sp: { type: "string", description: "Opcional YYYY-MM-DD HH:MM em SP" } }, required: ["titulo"] },
    },
  },
  {
    type: "function",
    function: {
      name: "listar_tarefas",
      description: "Lista as tarefas do usuário. Use quando disser 'quais são minhas tarefas', 'o que eu tenho pra fazer', 'to-do'.",
      parameters: { type: "object", properties: { status: { type: "string", enum: ["open", "done"], description: "padrão: open" } } },
    },
  },
  {
    type: "function",
    function: {
      name: "concluir_tarefa",
      description: "Marca uma tarefa como concluída. Use quando disser 'já fiz X', 'concluí a tarefa X', 'pode marcar como feito'.",
      parameters: { type: "object", properties: { id_ou_titulo: { type: "string", description: "id UUID ou parte do título" } }, required: ["id_ou_titulo"] },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_noticias",
      description: "Busca notícias recentes sobre um tema (Google News). Use pra 'notícias sobre X', 'o que tá rolando sobre Y'.",
      parameters: { type: "object", properties: { tema: { type: "string" } }, required: ["tema"] },
    },
  },
  {
    type: "function",
    function: {
      name: "rastrear_correios",
      description: "Rastreia encomenda dos Correios pelo código (13 caracteres, ex: AA123456789BR).",
      parameters: { type: "object", properties: { codigo: { type: "string" } }, required: ["codigo"] },
    },
  },
  {
    type: "function",
    function: {
      name: "calcular_rota",
      description: "Calcula distância e tempo de carro entre origem e destino (OSRM). Aceita endereços, cidades, 'aqui'/'minha localização' pra usar a localização salva do usuário, ou 'lat,lng'.",
      parameters: { type: "object", properties: { origem: { type: "string" }, destino: { type: "string" } }, required: ["origem", "destino"] },
    },
  },
  {
    type: "function",
    function: {
      name: "relatorio_anuncios_meta",
      description: "[SOMENTE DONO] Consulta relatório somente leitura do Meta Ads. Use para 'como estão meus anúncios', 'relatório de anúncios', 'quanto gastei em anúncios' e 'resultado da campanha'. Nunca cria nem altera anúncios.",
      parameters: {
        type: "object",
        properties: {
          periodo: {
            type: "string",
            enum: ["hoje", "ontem", "7_dias", "30_dias", "este_mes"],
            description: "Período do relatório. Padrão: 7_dias.",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "alterar_limite_mensal_anuncios",
      description: "[SOMENTE DONO] Propõe alterar a trava mensal de gasto em Meta Ads da plataforma. Mostra limite atual, gasto do mês e novo valor. NUNCA altera sem o dono tocar no botão Confirmar vinculado à proposta.",
      parameters: {
        type: "object",
        properties: {
          novo_limite: {
            type: "number",
            minimum: 50,
            maximum: 10000,
            description: "Novo limite mensal em reais, entre 50 e 10000.",
          },
        },
        required: ["novo_limite"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "rascunho_anuncio_meta",
      description: "[SOMENTE DONO] Salva no banco um rascunho de campanha Meta Ads e mostra orçamento, gasto do mês, teto mensal e gasto máximo. Esta chamada NUNCA publica. Use também para aplicar mudanças pedidas a um rascunho.",
      parameters: {
        type: "object",
        properties: {
          nome: { type: "string", description: "Nome curto da campanha." },
          objective: {
            type: "string",
            enum: ["whatsapp", "site"],
            description: "Destino da campanha: conversa no WhatsApp ou visita ao site.",
          },
          texto_principal: { type: "string", description: "Texto principal do anúncio." },
          titulo: { type: "string", description: "Título curto do anúncio." },
          descricao: { type: "string", description: "Descrição complementar opcional." },
          midia_url: { type: "string", description: "URL HTTPS da imagem ou vídeo aprovado." },
          tipo_midia: { type: "string", enum: ["image", "video"], description: "Tipo da mídia aprovada." },
          destination_url: {
            type: "string",
            description: "URL HTTPS de destino. Obrigatória quando objective='site'.",
          },
          radius_km: {
            type: "number",
            minimum: 1,
            maximum: 80,
            description: "Raio em quilômetros ao redor de cada cidade. Padrão: 25.",
          },
          age_min: {
            type: "integer",
            minimum: 18,
            maximum: 65,
            description: "Idade mínima. Padrão: 18.",
          },
          age_max: {
            type: "integer",
            minimum: 18,
            maximum: 65,
            description: "Idade máxima. Padrão: 65.",
          },
          gender: {
            type: "string",
            enum: ["all", "male", "female"],
            description: "Todos os gêneros, homens ou mulheres. Padrão: all.",
          },
          whatsapp_message: {
            type: "string",
            description: "Mensagem pré-preenchida ao abrir o WhatsApp. Use apenas no objetivo whatsapp.",
          },
          special_ad_categories: {
            type: "array",
            description: "Categorias especiais aplicáveis; use [] quando nenhuma se aplicar.",
            items: {
              type: "string",
              enum: [
                "CREDIT",
                "EMPLOYMENT",
                "HOUSING",
                "ISSUES_ELECTIONS_POLITICS",
                "FINANCIAL_PRODUCTS_SERVICES",
              ],
            },
          },
          cidades: {
            type: "array",
            description: "Cidades selecionadas no targeting da Meta.",
            items: {
              type: "object",
              properties: {
                id: { type: "string", description: "ID/key da cidade retornado pela Meta." },
                name: { type: "string", description: "Nome da cidade." },
              },
              required: ["id", "name"],
            },
          },
          interesses: {
            type: "array",
            description: "Interesses opcionais selecionados no targeting da Meta.",
            items: {
              type: "object",
              properties: {
                id: { type: "string", description: "ID do interesse retornado pela Meta." },
                name: { type: "string", description: "Nome do interesse." },
              },
              required: ["id", "name"],
            },
          },
          orcamento_diario: { type: "number", description: "Orçamento diário em reais." },
          duracao_dias: { type: "integer", minimum: 1, maximum: 365, description: "Duração em dias." },
        },
        required: ["nome", "objective", "texto_principal", "titulo", "midia_url", "tipo_midia", "cidades", "orcamento_diario", "duracao_dias"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "publicar_anuncio_meta",
      description: "[SOMENTE DONO] Publica o rascunho Meta Ads mais recente desta conversa. Só chame quando a mensagem atual do dono for exatamente SIM em resposta ao rascunho; a confirmação expira em 24 horas.",
      parameters: {
        type: "object",
        properties: {
          confirmacao: { type: "string", enum: ["SIM"], description: "Deve refletir literalmente a mensagem atual do dono." },
          rascunho_id: { type: "string", description: "Código do rascunho mostrado na prévia." },
        },
        required: ["confirmacao"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "pausar_campanha_meta",
      description: "[SOMENTE DONO] Pausa uma campanha Meta Ads publicada por esta conta.",
      parameters: {
        type: "object",
        properties: {
          campanha_id: { type: "string", description: "ID Meta ou código interno da campanha. Omita para usar a campanha publicada mais recente." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ativar_campanha_meta",
      description: "[SOMENTE DONO] Reativa uma campanha Meta Ads publicada por esta conta.",
      parameters: {
        type: "object",
        properties: {
          campanha_id: { type: "string", description: "ID Meta ou código interno da campanha. Omita para usar a campanha publicada mais recente." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "status_campanha_meta",
      description: "[SOMENTE DONO] Consulta na Meta o status atual e efetivo de uma campanha desta conta.",
      parameters: {
        type: "object",
        properties: {
          campanha_id: { type: "string", description: "ID Meta ou código interno da campanha. Omita para usar a campanha publicada mais recente." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_metricas_amz",
      description: "[ADMIN — só Felicio] Retorna métricas gerais do negócio AMZ OFERTAS: total de clientes, assinaturas ativas/pausadas, faturamento do mês e de ontem.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "listar_inadimplentes_amz",
      description: "[ADMIN — só Felicio] Lista clientes AMZ inadimplentes ou com falha de pagamento recente.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "status_plataforma_amz",
      description: "[ADMIN — só Felicio] Retorna saúde das Edge Functions da plataforma (quais estão com problema, offline, com falhas críticas).",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "criar_cobranca_amz",
      description: "[ADMIN — só Felicio] Cria uma cobrança PIX para um cliente AMZ pelo nome/razão social. Valor padrão 597. Use quando Felicio disser 'gera cobrança de X pro cliente Y'.",
      parameters: { type: "object", properties: { cliente: { type: "string" }, valor: { type: "number" } }, required: ["cliente"] },
    },
  },
  {
    type: "function",
    function: {
      name: "ver_produto",
      description: "ENXERGA um produto do catálogo: retorna nome, preço, descrição E uma descrição visual precisa da FOTO do produto (cor, material, acabamento, texto na embalagem via OCR). Use SOB DEMANDA — apenas quando o cliente demonstrou interesse real naquele produto (pediu detalhes/preço/cor) ou quando você vai enviar a oferta. Passe enviar_foto=true pra mandar a foto do produto com legenda junto. NUNCA chame em toda mensagem nem pra produtos que ninguém pediu.",
      parameters: { type: "object", properties: { produto: { type: "string", description: "nome ou parte do nome do produto" }, enviar_foto: { type: "boolean", description: "true pra enviar a foto do produto ao cliente junto com a legenda" } }, required: ["produto"] },
    },
  },
  {
    type: "function",
    function: {
      name: "entregar_ebook_presente",
      description: "Entrega o EBOOK DE PRESENTE deste negócio (PDF) para o cliente com quem você está conversando, e registra a autorização dele pra receber ofertas. Use SOMENTE depois de já ter resolvido o que a pessoa queria, num momento natural da conversa, e SOMENTE se ela disse que quer receber o presente. NUNCA use logo na abertura, nunca insista, nunca ofereça duas vezes.",
      parameters: { type: "object", properties: {} },
    },
  },

  {

    type: "function",
    function: {
      name: "consultar_estoque",
      description: "Consulta produtos/estoque da plataforma. Se query vazia, retorna totais. Se preenchida, busca por nome/categoria/tags/sku (ex.: 'chinelo', 'xícara chocolate'). Dono vê tudo; cliente só o próprio catálogo.",
      parameters: { type: "object", properties: { query: { type: "string", description: "termo de busca ou vazio para totais" } } },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_campanhas",
      description: "Status das campanhas WhatsApp: total, ativas, próximas execuções, envios nas últimas 24h e stats da fila (pendente/processando/enviado/falhou).",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_autopilot",
      description: "Status do Autopilot de redes sociais: configs ativas, quantos posts foram publicados/agendados/falhados nas últimas 24h por rede (Facebook/Instagram).",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_clientes_leads",
      description: "Contagens de clientes ativos, novos clientes nos últimos 7 dias e total de leads B2B/B2C.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "resumo_plataforma",
      description: "Snapshot completo da plataforma agora: estoque + campanhas + autopilot + clientes/leads. Use quando o usuário pedir 'resumo geral', 'como tá a plataforma', 'panorama'.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "postar_redes_sociais",
      description: "Gera PREVIEW COMPLETO de post para Facebook, Instagram e/ou TikTok a partir de um PRODUTO DO CATÁLOGO do dono (estoque cadastrado), com copywriting no TOM escolhido. NÃO publica direto — devolve token de confirmação. ⛔ NUNCA use esta tool quando o cliente ACABOU DE ENVIAR foto/vídeo/áudio nesta mensagem — nesse caso use salvar_midia_biblioteca. Esta tool é EXCLUSIVA pra produto do catálogo pedido POR NOME em texto (ex: 'posta a caneta delineadora', 'divulga o kit xícaras'). LINK NÃO É OBRIGATÓRIO: se o produto não tiver link de compra, gera post institucional/lifestyle/engajamento — NUNCA recuse por falta de link. Quando o usuário pedir por NOME 'posta X nas redes', CHAME IMEDIATAMENTE. A busca do produto é fuzzy. Se retornar 'não encontrado' com sugestoes_do_catalogo, mostre as sugestões. Depois de mostrar o preview, ao aprovar chame confirmar_postagem_redes. Restrito ao dono (Felicio).",
      parameters: {
        type: "object",
        properties: {
          produto: { type: "string", description: "Nome, categoria ou palavra-chave do produto." },
          tom: { type: "string", enum: ["urgencia", "escassez", "black-friday", "prova-social", "beneficio"], description: "Tom do copy. Padrão: urgencia." },
          redes: { type: "array", items: { type: "string", enum: ["facebook", "instagram", "tiktok", "linkedin"] }, description: "Redes. Inclua LinkedIn quando o dono pedir LinkedIn, Linked In ou LKD." },
          incluir_cta_whatsapp: { type: "boolean", description: "OPT-IN. Passe true SÓ SE o dono pediu explicitamente 'posta com meu whatsapp', 'inclui meu whatsapp', 'põe o CTA do whatsapp', 'chama no whatsapp'. Nunca inclua automaticamente." },
        },
        required: ["produto"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "confirmar_postagem_redes",
      description: "Confirma e PUBLICA de fato o post. Só funciona DEPOIS que o dono escolheu explicitamente A, B ou C com escolher_variante_post; nunca presuma A. Se pedir cancelar, passe cancelar=true.",
      parameters: {
        type: "object",
        properties: {
          token: { type: "string", description: "Token de 8 chars devolvido por postar_redes_sociais." },
          cancelar: { type: "boolean", description: "Se true, descarta o preview sem publicar." },
        },
        required: ["token"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "agendar_post_pendente",
      description: "Agenda um criativo somente DEPOIS que o dono escolheu explicitamente A, B ou C. Nunca presuma A. Resolva a expressão usando a data/hora atual de São Paulo e envie data_hora_sp em YYYY-MM-DD HH:MM. Só confirme se retornar ok=true. TikTok não é agendado.",
      parameters: {
        type: "object",
        properties: {
          token: { type: "string", description: "Token de 8 caracteres do criativo pendente." },
          data_hora_sp: { type: "string", description: "Data/hora absoluta em São Paulo, formato YYYY-MM-DD HH:MM." },
        },
        required: ["token", "data_hora_sp"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "listar_agendamentos_posts",
      description: "Lista os próximos posts sociais agendados pelo WhatsApp, com data, redes e código.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "cancelar_agendamento_post",
      description: "Cancela um post social futuro agendado pelo WhatsApp. Omita token quando houver apenas um; se houver vários, a ferramenta pedirá qual código cancelar.",
      parameters: {
        type: "object",
        properties: {
          token: { type: "string", description: "Código de 8 caracteres exibido em 'meus agendamentos'." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "remarcar_agendamento_post",
      description: "Remarca um post social futuro agendado pelo WhatsApp. Use para 'muda o horário', 'remarca' ou 'adia'. Omita token quando houver apenas um; se houver vários, a ferramenta pedirá qual. Resolva a data em São Paulo e só confirme se retornar ok=true.",
      parameters: {
        type: "object",
        properties: {
          token: { type: "string", description: "Código de 8 caracteres exibido em 'meus agendamentos'." },
          data_hora_sp: { type: "string", description: "Nova data/hora em São Paulo. Aceita YYYY-MM-DD HH:MM ou dd/mm às HHh; sem ano, usa a próxima ocorrência." },
        },
        required: ["data_hora_sp"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "revisar_post_pendente",
      description: "🛠️ USE quando houver um POST PENDENTE (aguardando 'pode postar') e o dono pedir AJUSTES NO TEXTO/SCRIPT antes de publicar. Ex: 'tira o ACABA HOJE', 'põe o preço 89,90', 'deixa mais curto', 'muda o tom pra profissional'. TAMBÉM use pra LIGAR/DESLIGAR o CTA de WhatsApp no post pendente (passe incluir_cta_whatsapp=true/false; ajuste pode ser omitido nesse caso). Regenera o script aplicando o ajuste e MANTÉM o mesmo token, mídia, formato e redes.",
      parameters: {
        type: "object",
        properties: {
          token: { type: "string", description: "Token de 8 chars do post pendente." },
          ajuste: { type: "string", description: "Instrução literal do dono do que mudar no texto (ex: 'tira o preço e deixa mais curto'). Pode ser omitido se for SÓ pra ligar/desligar o CTA de WhatsApp." },
          incluir_cta_whatsapp: { type: "boolean", description: "OPT-IN. Passe true quando o dono pedir pra incluir 'Chama no WhatsApp' no post; false pra remover. Omita pra manter como estava." },
        },
        required: ["token"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "escolher_variante_post",
      description: "🎯 USE quando o dono responder 'A', 'B', 'C', 'opção B', 'a segunda', 'quero a C' etc para ESCOLHER qual das 3 variantes do post pendente vai publicar. Troca a variante ativa (sem chamar IA). Depois pergunte se pode postar.",
      parameters: {
        type: "object",
        properties: {
          token: { type: "string", description: "Token de 8 chars do post pendente." },
          opcao: { type: "string", description: "Letra da opção escolhida: A, B ou C." },
        },
        required: ["token", "opcao"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "registrar_logo_cliente",
      description: "CADASTRA DE VERDADE a última FOTO desta conversa como logo de um cliente do responsável. Use quando o DONO disser 'guarde/salve/registre/cadastre/use essa como logo do cliente X', inclusive para as versões 'fundo claro' e 'fundo escuro'. Só confirme que guardou se esta ferramenta retornar ok=true.",
      parameters: {
        type: "object",
        properties: {
          cliente: { type: "string", description: "Nome exato da empresa/cliente citado pelo responsável, ex.: Casarão Lustres." },
          variante: { type: "string", enum: ["default", "light_background", "dark_background"], description: "Versão da logo: fundo claro usa texto escuro; fundo escuro usa texto claro." },
        },
        required: ["cliente"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "salvar_midia_biblioteca",
      description: "🔴 USE quando receber foto, vídeo ou áudio nesta mensagem — mesmo sem legenda — para arquivar na biblioteca de Mídias (/midias). NÃO tenta casar com produto do catálogo, NÃO publica direto, NÃO pergunta antes. Se o remetente NÃO for dono/responsável, nunca fale de publicar/reusar nem pergunte rede/formato; apenas confirme recebimento e, se fizer sentido, ofereça encaminhar ao responsável. Passe em 'contexto' o que foi falado junto, ou string vazia se não falou nada.",
      parameters: {
        type: "object",
        properties: {
          contexto: { type: "string", description: "Breve descrição do que a mídia mostra ou do que o cliente falou (ex: 'cliente João contemplou carta de 80k', 'produto novo chegou'). Ajuda a IA a gerar legenda depois." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "postar_midia_biblioteca",
      description: "🟢 USE SOMENTE quando o DONO/RESPONSÁVEL pedir pra POSTAR/DIVULGAR uma foto ou vídeo da biblioteca /midias. Nunca use para cliente/contato. Se houver código curto ou UUID na conversa, passe exatamente em midia_id. Se não houver, chame a tool SEM midia_id: o sistema usará automaticamente a última foto ou vídeo deste fio de conversa; se o dono quiser outra mídia, ele deve reenviá-la. FORMATO: 'story' (foto ou vídeo 9:16), 'reels' (só vídeo, IG/FB), 'feed' (default). Se o dono disser 'reels' passe formato='reels'; 'story'/'stories' → 'story'; senão 'feed'. Para VÍDEO, sempre passe a legenda que o dono forneceu — não invente descrição de vídeo. ⚠️ BRIEFING (MUITO IMPORTANTE): se o dono ESCREVEU um texto/contexto nesta conversa (mesmo em mensagens anteriores) e pediu pra usar aquele texto/aquele contexto/aquela ideia no post, COPIE esse texto INTEIRO no parâmetro 'briefing'. A copy será gerada para a mídia efetivamente usada. CTA DE WHATSAPP: passe incluir_cta_whatsapp=true SÓ SE o dono pedir explicitamente.",
      parameters: {
        type: "object",
        properties: {
          legenda: { type: "string", description: "Texto/legenda que o cliente falou junto." },
          briefing: { type: "string", description: "TEXTO INTEGRAL escrito pelo dono que deve ser a MENSAGEM CENTRAL do post (argumentos, diferenciais, tema, frase de efeito). Copie literalmente da conversa, sem resumir. Tem prioridade sobre a descrição visual da imagem." },
          usar_contexto_conversa: { type: "boolean", description: "Use SOMENTE se o dono, NESTA mensagem, se referir a um texto que ele mandou logo antes junto com essa mídia ('usa aquele texto que te mandei agora', 'pega o contexto que escrevi'). NUNCA passe true quando ele só disser 'posta no feed/story/reels' — nesse caso o post é sobre a FOTO enviada, e puxar assunto antigo gera post errado." },
          midia_id: { type: "string", description: "ID da mídia a publicar. Aceita o UUID completo ou o código curto de 8 caracteres mostrado ao usuário (ex.: 53DBDA63)." },
          nome: { type: "string", description: "Nome do produto/item, se informado." },
          preco: { type: "string", description: "Preço se informado (ex: '29,99')." },
          link: { type: "string", description: "Link explícito informado pelo dono. No LinkedIn, fica no fim antes das hashtags." },
          tom: { type: "string", enum: ["urgencia", "escassez", "black-friday", "prova-social", "beneficio"] },
          redes: { type: "array", items: { type: "string", enum: ["facebook", "instagram", "tiktok", "linkedin"] } },
          formato: { type: "string", enum: ["feed", "story", "reels"], description: "'feed' (default), 'story' (foto/vídeo 9:16) ou 'reels' (só vídeo)." },
          incluir_cta_whatsapp: { type: "boolean", description: "OPT-IN. true = adiciona '📱 Fale comigo no WhatsApp: wa.me/<numero_do_agente>' em SANDUÍCHE (no INÍCIO E no FIM) da legenda de todas as redes escolhidas. Idempotente: limpa CTA antigo antes de reaplicar (nunca triplica). Nunca inclua automaticamente — só quando o dono pedir com palavras claras ('com meu whatsapp', 'inclui meu whatsapp', 'põe o CTA')." },
        },
      },

    },
  },
  {
    type: "function",
    function: {
      name: "encaminhar_recado_ao_dono",
      description: "📨 USE quando o cliente/contato pedir explicitamente pra você MANDAR RECADO, AVISO, MENSAGEM ou FOTO pro DONO do agente (ex: 'manda pro Marcelo', 'passa isso pro chefe', 'avisa o dono', 'encaminha essa foto pra ele'). Envia o recado (texto + a última foto que o cliente mandou, se houver) pro WhatsApp do dono do tenant automaticamente — você NÃO precisa saber o número dele. Só use quando o pedido for CLARO; não use pra conversas normais. Sempre confirme pro cliente que já mandou.",
      parameters: {
        type: "object",
        properties: {
          recado: {
            type: "string",
            description: "Texto do recado, JÁ HUMANIZADO, como se você (o agente) estivesse avisando o dono. Ex: 'Chefe, o cliente Felício (21 96752-0706) mandou essa foto e pediu pra você dar uma olhada.' Inclua nome/telefone do cliente e o conteúdo/pedido dele. Mínimo 15 caracteres.",
          },
          incluir_ultima_foto: {
            type: "boolean",
            description: "true = anexa a última FOTO que o cliente enviou nesta conversa. false ou ausente = só texto.",
          },
        },
        required: ["recado"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "registrar_lead_novo",
      description: "🔔 USE UMA VEZ quando estiver atendendo alguém DESCONHECIDO e já souber obrigatoriamente o NOME e o RAMO do negócio. Registra o lead e avisa o dono. No tenant AMZ, use quando pedir preço/proposta, demonstrar intenção de contratar ou após a demo; informe ao prospect que um consultor da AMZ entrará em contato. Nos demais tenants, mantenha o atendimento silencioso atual.",
      parameters: {
        type: "object",
        properties: {
          nome: { type: "string", description: "Nome do lead, como ele informou." },
          empresa: { type: "string", description: "Empresa dele, se informou. Vazio se não souber." },
          ramo: { type: "string", description: "Ramo/segmento do negócio dele, se informou. Vazio se não souber." },
          interesse: { type: "string", description: "Em 1 frase, o que ele quer/está buscando (ex: 'quer saber como funciona o atendimento por IA e o preço')." },
          dor_marketing: { type: "string", description: "Principal dificuldade de marketing relatada, se houver." },
          demonstracao: { type: "string", description: "O que foi demonstrado ao prospect, se houver." },
          proximo_passo: { type: "string", description: "Próximo passo combinado, como proposta ou contato de um consultor da AMZ." },
        },
        required: ["nome", "ramo"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "publicar_linkedin",
      description: "💼 Prepara uma prévia para LINKEDIN no fluxo obrigatório de aprovação A/B/C. NUNCA publica nesta chamada. Suporta texto, imagem e vídeo da biblioteca; depois da escolha, o dono decide Publicar agora ou Agendar. Quando o pedido se referir a mídia, passe o ID de 8 caracteres ou UUID em midia_id. Tom profissional, sem emojis ou gírias; observação → argumento → conclusão; link antes de 2–3 hashtags.",
      parameters: {
        type: "object",
        properties: {
          texto: { type: "string", description: "Texto do post em tom profissional, sem emojis, sem link e sem frases do tipo 'link nos comentários'. Termine no raciocínio e, se houver, deixe as hashtags na última linha." },
          link: { type: "string", description: "Link do post. Ele será posicionado no fim do texto, antes das hashtags. Vazio se não houver." },
          comentario: { type: "string", description: "Opcional. Texto do primeiro comentário, usado apenas se a permissão de parceiro do LinkedIn estiver liberada." },
          image_url: { type: "string", description: "URL pública de uma imagem para acompanhar o post, se houver." },
          midia_id: { type: "string", description: "ID curto de 8 caracteres ou UUID da imagem/vídeo da biblioteca. Obrigatório quando o pedido mencionar uma mídia." },
        },
        required: ["texto"],
      },
    },
  },
  {
    type: "function",
    function: {

      name: "criar_carrossel",
      description: "🎠 Gera um CARROSSEL com vários cards separados. Para o dono, cria prévia para aprovação antes de publicar. Para prospect do tenant AMZ, permite UMA demonstração por telefone, mostra os cards e uma legenda, mas NUNCA cria aprovação nem publica. Em outros tenants é restrito ao responsável. FLUXO: 1) primeira chamada sem cor mostra seletor; 2) depois chame com tema + cor.",
      parameters: {
        type: "object",
        properties: {
          tema: { type: "string", description: "Assunto/tema do carrossel, como o usuário pediu (ex: '5 dicas para vender mais no Instagram')." },
          cor: { type: "string", description: "Cor de destaque escolhida PELO USUÁRIO: azul, verde, laranja, preto, dourado ou roxo. Deixe VAZIO na primeira chamada para eu perguntar com a lista de 1 toque." },
          num_slides: { type: "number", description: "Quantidade pedida, de 3 a 10. Sem pedido explícito, use 7." },
          legenda: { type: "string", description: "Legenda do post, se o usuário ditou uma. Vazio = a IA escreve a legenda com hashtags." },
        },
        required: ["tema"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "criar_video_animado",
      description: "🎬 Inicia a criação de vídeo Motion para o RESPONSÁVEL. O sistema pergunta por listas interativas, uma de cada vez, o template visual, o fundo, a trilha e a identidade que ainda não estiverem explícitos no pedido; só então gera o roteiro para aprovação. NUNCA pule essas perguntas, NUNCA renderize sem APROVADO e não use para clientes. Preserve literalmente frases ditadas pelo responsável e qualquer duração exata em segundos.",
      parameters: {
        type: "object",
        properties: {
          tema: { type: "string", description: "Tema e objetivo do vídeo, preservando a ideia do responsável. Ex: 'mostrar como a Ademicon agenda posts e publica nas redes'." },
          cores: { type: "string", description: "Trecho LITERAL do pedido que menciona cores, com rótulos e hex se houver. Ex: 'fundo #ffffff, fundo 2 #fff5f5, destaque #E30613, apoio #ff4d57' ou 'vermelho e branco'. Deixe vazio se ele não citou cor nenhuma." },
          duracao: { type: "string", enum: ["curto", "medio", "longo"], description: "Duração SE ele pediu: 'curto' (~25s, padrão para redes), 'medio' (~45s), 'longo' (~75s, apresentação comercial). Vídeo mais longo tem MAIS conteúdo e demora mais para renderizar. Omita quando ele não pedir." },
          estilo: { type: "string", enum: ["auto", "conversa", "institucional", "lista"], description: "Formato do vídeo SE ele pediu: 'conversa' (celular com balões de WhatsApp), 'institucional' (tipografia grande, argumentos, selo/dado), 'lista' (itens numerados, '3 motivos', 'passo a passo'). Use 'auto' quando ele não pedir formato — a plataforma escolhe pelo tema." },
          fundo: { type: "string", enum: ["claro", "escuro"], description: "Fundo somente quando o responsável disser fundo branco/claro ou preto/escuro. Omita para o sistema perguntar com dois botões." },
        },
        required: ["tema"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_fipe",
      description: "Consulta o preço oficial FIPE de veículo para o responsável do tenant. Use quando ele pedir FIPE por texto ou ÁUDIO transcrito, por marca/modelo ou enviar uma foto e perguntar a FIPE. Preserve números falados por extenso nos argumentos; o sistema normaliza ano, motor e câmbio. Pela foto, apenas sugere o veículo e pede confirmação de ano/modelo e versão; nunca afirme o ano exato pela imagem.",
      parameters: {
        type: "object",
        properties: {
          marca: { type: "string", description: "Marca informada ou confirmada pelo usuário." },
          modelo: { type: "string", description: "Modelo informado ou confirmado pelo usuário." },
          versao: { type: "string", description: "Versão, se informada." },
          ano_modelo: { type: "string", description: "Ano/modelo, se informado. Nunca inferir pela foto." },
          combustivel: { type: "string", description: "Combustível, se informado." },
          cambio: { type: "string", description: "Câmbio informado, por exemplo automático ou manual." },
          motor: { type: "string", description: "Motor informado, inclusive por extenso, por exemplo 'um ponto zero'." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "criar_anuncio",
      description: "🏷️ Monta um ANÚNCIO PROFISSIONAL de produto (arte pronta pra vender) a partir de uma FOTO enviada + somente os dados que o responsável falar. Use quando ele disser 'faz um anúncio disso', 'monta a arte desse carro/imóvel/produto', 'cria anúncio com esses dados'. Quando disser 'anúncio para a loja X' ou 'com a logo do cliente X', passe cliente='X'; a identidade dessa loja substitui a do tenant e nunca pode cair na logo do tenant. Serve pra veículo, imóvel, máquina ou produto de loja. O texto, preços e logo entram por template (exatos, nunca desenhados pela IA); a IA só melhora a foto. NUNCA invente FIPE, preço, ano, quilometragem ou itens. Restrito ao responsável da conta.",
      parameters: {
        type: "object",
        properties: {
          titulo: { type: "string", description: "Nome/modelo em destaque sem repetir ano, versão ou motor (ex: 'HYUNDAI CRETA', 'APARTAMENTO 2 QUARTOS')." },
          cliente: { type: "string", description: "Nome da loja/cliente cuja identidade deve ser usada. Passe quando o dono disser 'para a loja X' ou 'com a logo do cliente X'. Sem cliente, usa a marca do próprio tenant." },
          site: { type: "string", description: "Site público da loja/cliente, somente quando informado pelo dono. Usado para extrair e salvar logo e cores se o cliente ainda não tiver logo cadastrada." },
          subtitulo: { type: "string", description: "Complemento curto sem repetir o ano (ex: 'BAIRRO CENTRO'). Para veículo, prefira os campos versão e motor. Vazio se não souber." },
          ano: { type: "string", description: "Ano para o selo, somente se o dono informou (ex: '2023/2023'). Nunca inferir." },
          versao: { type: "string", description: "Versão exata do veículo, somente se informada." },
          motor: { type: "string", description: "Motor exato, somente se informado." },
          cambio: { type: "string", description: "Câmbio, somente se informado." },
          quilometragem: { type: "string", description: "Quilometragem exata, somente se informada." },
          cor: { type: "string", description: "Cor, somente se informada." },
          donos: { type: "string", description: "Número de donos, somente se informado." },
          documentacao: { type: "string", description: "Situação documental, somente se informada." },
          revisoes: { type: "string", description: "Informação de revisões, somente se informada." },
          pneus: { type: "string", description: "Condição dos pneus, somente se informada." },
          opcionais: { type: "array", items: { type: "string" }, description: "Itens e opcionais exatamente informados." },
          condicoes: { type: "array", items: { type: "string" }, description: "Condições informadas de troca, financiamento ou entrada." },
          fipe: { type: "string", description: "Valor FIPE, somente quando o dono informou explicitamente." },
          itens: {
            type: "array",
            description: "Lista de 4 a 8 destaques EXATAMENTE como o usuário falou (ex: '38 MIL KM', 'ÚNICO DONO', 'PNEUS NOVOS', 'IPVA PAGO'). Não invente.",
            items: { type: "string" },
          },
          preco: { type: "string", description: "Preço formatado (ex: 'R$ 118.900,00'). Vazio se ele não disse o preço." },
          preco_label: { type: "string", description: "Rótulo acima do preço principal (ex: 'HOJE', 'À VISTA'). Vazio se não foi informado." },
          preco_referencia: { type: "string", description: "Preço de referência riscado, somente se o dono informou." },
          preco_referencia_label: { type: "string", description: "Origem/rótulo do preço de referência (ex: 'FIPE'), somente se o dono informou." },
          preco_referencia_obs: { type: "string", description: "Observação factual do preço de referência (ex: 'sem blindagem'), somente se o dono informou." },
          badge: { type: "string", description: "Selo de destaque, se houver (ex: 'PINTURA 100% ORIGINAL', 'ÚLTIMA UNIDADE')." },
          telefone: { type: "string", description: "Telefone de contato pra arte, se o usuário informou." },
          instagram: { type: "string", description: "@ do Instagram pra arte, se o usuário informou. Vazio = uso o do cadastro." },
          formato: { type: "string", description: "'feed' (quadrado, padrão) ou 'story' (9:16 vertical)." },
          estilo: { type: "string", enum: ["impacto", "catalogo", "destaque"], description: "Estilo visual quando o dono pedir diretamente. Sem estilo, respeite a preferência salva ou mostre os três." },
          melhorar_foto: { type: "boolean", description: "Passe true somente se o usuário pedir explicitamente para melhorar fundo/luz; passe false somente se ele pedir foto original/sem melhorar. Se ele não disser nada, OMITA para o sistema usar a preferência salva ou perguntar por botões." },
        },
        required: ["titulo"],
      },
    },
  },

];




// ---- encaminhar_recado_ao_dono: cliente/contato pede pra encaminhar recado/foto pro dono do tenant ----
async function toolEncaminharRecadoAoDono(
  args: { recado?: string; incluir_ultima_foto?: boolean },
  ctx: { userId: string; fromNumber: string; media?: MediaExtract[] },
): Promise<string> {
  const recado = (args?.recado || "").trim();
  if (!recado || recado.length < 15) {
    return JSON.stringify({ erro: "recado_invalido", detalhe: "Componha o recado humanizado (mínimo 15 chars), incluindo nome/telefone do cliente e o que ele pediu." });
  }

  // Owner do tenant atual
  const owner = await resolveTenantOwner(sb, ctx.userId);
  if (!owner?.phone) {
    return JSON.stringify({ erro: "dono_nao_configurado", detalhe: "Este agente não tem owner_phone configurado em whatsapp_cloud_agent_config." });
  }
  // Não encaminha pro próprio remetente (evita loop se o dono se autotestar)
  if ([owner.phone, ...owner.altPhones].includes(ctx.fromNumber)) {
    return JSON.stringify({ erro: "remetente_e_o_dono", detalhe: "O próprio dono está mandando — nada pra encaminhar." });
  }

  // Anexar última foto se solicitado
  let imageUrl: string | undefined;
  if (args?.incluir_ultima_foto) {
    // 1) Foto que veio nessa mesma mensagem
    const img = (ctx.media || []).slice().reverse().find((m) => m.kind === "image");
    if (img?.base64) {
      try {
        const bytes = base64Decode(img.base64);
        const mime = img.mime || "image/jpeg";
        const ext = mime.split("/")[1]?.split(";")[0] || "jpg";
        const fileName = `midias/${ctx.userId}/recado-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await sb.storage.from("produtos").upload(fileName, bytes, { contentType: mime, upsert: true });
        if (!upErr) {
          const { data: pub } = sb.storage.from("produtos").getPublicUrl(fileName);
          imageUrl = pub?.publicUrl;
        } else {
          console.warn("[encaminhar_recado] upload falhou:", upErr.message);
        }
      } catch (e) {
        console.warn("[encaminhar_recado] falhou ao processar imagem:", (e as Error).message);
      }
    }
    // 2) Fallback: última foto enviada por ESTE remetente nos últimos 30 min (caso o cliente tenha mandado a foto antes e agora só confirmado)
    if (!imageUrl) {
      try {
        const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
        const { data: recent } = await sb
          .from("midias_whatsapp")
          .select("midia_url, created_at")
          .eq("user_id", ctx.userId)
          .eq("telefone_origem", ctx.fromNumber)
          .eq("tipo", "foto")
          .gte("created_at", cutoff)
          .order("created_at", { ascending: false })
          .limit(1);
        if (recent && recent[0]?.midia_url) {
          imageUrl = recent[0].midia_url;
          console.log("[encaminhar_recado] usando foto recente da biblioteca:", imageUrl);
        }
      } catch (e) {
        console.warn("[encaminhar_recado] fallback biblioteca falhou:", (e as Error).message);
      }
    }
  }


  try {
    const messageId = await sendWhatsApp(ctx.userId, owner.phone, recado, imageUrl);
    await logOwnerHeadsup(ctx.userId, imageUrl ? `${recado}\n\n[foto anexada]` : recado, messageId);
    const proof = buildForwardProof(messageId);
    const nomeNoRecado = (() => {
      const m = String(recado || "").match(/^\s*Nome:\s*(.+)$/im);
      const v = (m?.[1] || "").trim();
      return v && !/^n[ãa]o informado$/i.test(v) && !/^cliente$/i.test(v) ? v : null;
    })();
    await registrarLeadEncaminhamento({
      userId: ctx.userId,
      telefone: ctx.fromNumber,
      nome: nomeNoRecado,
      mensagem: recado,
      protocolo: proof,
      wamid: messageId,
      destinoDono: owner.phone,
    });
    return JSON.stringify({
      ok: true,
      enviado_para: owner.name || "dono",
      com_foto: !!imageUrl,
      message_id: messageId,
      protocolo: proof,
      instrucao: `Confirme pro cliente de forma humanizada em 2 linhas curtas: (1) que você JÁ ENVIOU o recado${imageUrl ? " e a foto" : ""} para ${owner.name || "o responsável"} agora — TERMINE essa linha EXATAMENTE com este comprovante entre parênteses: ${proof}. (2) NÃO adicione convite, oferta ou pergunta no fim: a resposta termina no raciocínio. Não recite o texto do recado nem telefone, mas o comprovante ${proof} é OBRIGATÓRIO na primeira linha (é a prova pro cliente que o encaminhamento foi feito).`,
    });
  } catch (e) {
    return JSON.stringify({ erro: "falha_ao_enviar", detalhe: String((e as Error).message).slice(0, 200) });
  }
}


// ---- registrar_lead_novo: registra o lead e avisa o dono do tenant ----
// Outros tenants preservam o aviso silencioso. Na venda AMZ, o prospect é
// informado de que o Felicio dará continuidade ao contato.
async function toolRegistrarLeadNovo(
  args: {
    nome?: string;
    empresa?: string;
    ramo?: string;
    interesse?: string;
    dor_marketing?: string;
    demonstracao?: string;
    proximo_passo?: string;
  },
  ctx: { userId: string; fromNumber: string },
): Promise<string> {
  const nome = (args?.nome || "").trim();
  if (!nome) return JSON.stringify({ erro: "nome_obrigatorio" });

  const empresa = (args?.empresa || "").trim() || null;
  const ramo = (args?.ramo || "").trim() || null;
  if (!ramo) return JSON.stringify({ erro: "ramo_obrigatorio" });
  const interesse = (args?.interesse || "").trim() || null;
  const isAmzProspect = ctx.userId === ADMIN_AMZ_USER_ID;
  const amzSummary = buildAmzLeadOwnerSummary({
    business: empresa || ramo,
    pain: (args?.dor_marketing || "").trim() || null,
    demonstration: (args?.demonstracao || "").trim() || null,
    nextStep: (args?.proximo_passo || "").trim() || null,
  });
  const telefone = ctx.fromNumber;

  const owner = await resolveTenantOwner(sb, ctx.userId);
  // Nunca trata o próprio dono como lead
  if (owner?.phone && owner.phone === telefone) {
    return JSON.stringify({ ok: false, motivo: "remetente_e_o_dono" });
  }

  let jaNotificado = false;
  try {
    const { data: existente } = await sb
      .from("jarvis_leads")
      .select("id, notificado_em")
      .eq("user_id", ctx.userId)
      .eq("telefone", telefone)
      .maybeSingle();
    jaNotificado = !!existente?.notificado_em;

    const payload: Record<string, unknown> = {
      user_id: ctx.userId,
      telefone,
      nome,
      origem: "whatsapp",
      updated_at: new Date().toISOString(),
    };
    if (empresa) payload.empresa = empresa;
    if (ramo) payload.ramo = ramo;
    if (interesse || amzSummary.length) {
      payload.interesse = [interesse, ...amzSummary].filter(Boolean).join(" | ");
    }

    const { error } = await sb.from("jarvis_leads").upsert(payload, { onConflict: "user_id,telefone" });
    if (error) console.warn("[registrar_lead_novo] upsert falhou:", error.message);

    const { error: cadastroError } = await sb.from("cadastros").upsert({
      user_id: ctx.userId,
      nome,
      whatsapp: telefone,
      empresa,
      origem: "whatsapp_pietro",
      ultima_interacao: new Date().toISOString(),
      respondeu_alguma_vez: true,
      notas: [
        `Ramo: ${ramo}`,
        interesse ? `Interesse: ${interesse}` : null,
        ...(isAmzProspect ? amzSummary : []),
      ].filter(Boolean).join("\n"),
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,whatsapp" });
    if (cadastroError) console.warn("[registrar_lead_novo] cadastro falhou:", cadastroError.message);
  } catch (e) {
    console.warn("[registrar_lead_novo] persistência falhou:", (e as Error).message);
  }

  if (!owner?.phone) {
    return JSON.stringify({
      ok: true,
      registrado: true,
      notificado: false,
      motivo: "dono_nao_configurado",
      instrucao: isAmzProspect
        ? "Diga apenas que a equipe da AMZ dará continuidade ao contato."
        : "Continue o atendimento normalmente e NÃO comente nada disso com o cliente.",
    });
  }
  if (jaNotificado) {
    return JSON.stringify({
      ok: true,
      registrado: true,
      notificado: false,
      motivo: "lead_ja_notificado",
      instrucao: isAmzProspect
        ? amzProspectHandoffInstruction()
        : "Continue o atendimento normalmente e NÃO comente nada disso com o cliente.",
    });
  }

  const identificacao = empresa ? `${nome}, da ${empresa}, do ramo de ${ramo}` : `${nome}, do ramo de ${ramo}`;
  const aviso = [
    `Chefe, entrou um contato agora. ${identificacao}.`,
    interesse ? `${interesse.replace(/[.!?]+$/, "")}.` : null,
    ...(isAmzProspect ? amzSummary : []),
    `Telefone: +${telefone}. To conversando com ele ainda.`,
  ].filter(Boolean).join(" ");

  try {
    const messageId = await sendWhatsApp(ctx.userId, owner.phone, aviso);
    await logOwnerHeadsup(ctx.userId, aviso, messageId);
    const proof = buildForwardProof(messageId);
    await registrarLeadEncaminhamento({
      userId: ctx.userId,
      telefone,
      nome,
      mensagem: interesse || aviso,
      protocolo: proof,
      wamid: messageId,
      destinoDono: owner.phone,
    });
    await sb
      .from("jarvis_leads")
      .update({ notificado_em: new Date().toISOString() })
      .eq("user_id", ctx.userId)
      .eq("telefone", telefone);
    return JSON.stringify({
      ok: true,
      registrado: true,
      notificado: true,
      message_id: messageId,
      protocolo: proof,
      instrucao: isAmzProspect
        ? amzProspectHandoffInstruction()
        : "O dono já foi avisado em paralelo. NÃO comente isso com o cliente — apenas continue o atendimento de forma natural, respondendo o que ele perguntou.",
    });
  } catch (e) {
    console.warn("[registrar_lead_novo] notificação falhou:", (e as Error).message);
    return JSON.stringify({
      ok: true,
      registrado: true,
      notificado: false,
      instrucao: isAmzProspect
        ? "Diga apenas que a equipe da AMZ dará continuidade ao contato."
        : "Continue o atendimento normalmente e NÃO comente nada disso com o cliente.",
    });
  }
}




// ============================================================
// C1 — criar_carrossel: gera, mostra prévia e só publica após confirmação.
// Fluxo: gerar-carousel-content → render-carousel-slides → preview WhatsApp
// → A/B/C → confirmação → meta-publish-carousel.
// ============================================================
const CARROSSEL_MAX_DIA = 5; // guardrail simples por tenant/dia

async function recentWhatsAppVehiclePhotos(input: {
  userId: string;
  fromNumber: string;
  windowMs: number;
}): Promise<VehicleCarouselPhoto[]> {
  const since = new Date(Date.now() - input.windowMs).toISOString();
  const { data, error } = await sb.from("midias_whatsapp")
    .select("id, midia_url, created_at")
    .eq("user_id", input.userId)
    .eq("telefone_origem", input.fromNumber)
    .eq("tipo", "foto")
    .eq("origem", "whatsapp")
    .gte("created_at", since)
    .order("created_at", { ascending: true })
    .limit(VEHICLE_CAROUSEL_MAX_PHOTOS);
  if (error) throw new Error(`fotos_recentes_indisponiveis: ${error.message}`);
  return (data || [])
    .filter((item) => item.id && item.midia_url)
    .map((item) => ({ id: item.id, url: item.midia_url }));
}

async function registerVehiclePhotoQueueEvent(
  queueId: string,
  photo: VehicleCarouselPhoto,
): Promise<void> {
  const { error } = await sb.from("whatsapp_cloud_inbound_queue").update({
    vehicle_media_id: photo.id,
    vehicle_media_reused: photo.reused === true,
  }).eq("id", queueId);
  if (error) {
    throw new Error(`vinculo_evento_midia_falhou: ${error.message}`);
  }
}

async function claimVehiclePhotoQueueBatch(
  queueId: string,
): Promise<{
  photos: VehicleCarouselPhoto[];
  reusedPhotoIds: string[];
  shouldOffer: boolean;
}> {
  const { data: claimed, error } = await sb.rpc(
    "claim_whatsapp_vehicle_photo_batch",
    { p_queue_id: queueId },
  );
  if (error) throw new Error(`lote_fila_indisponivel: ${error.message}`);
  const rows = Array.isArray(claimed) ? claimed : [];
  const mediaIds = [...new Set(
    rows.map((row: any) => String(row?.media_id || "")).filter(Boolean),
  )];
  if (!mediaIds.length) {
    return { photos: [], reusedPhotoIds: [], shouldOffer: false };
  }
  const { data: mediaRows, error: mediaError } = await sb
    .from("midias_whatsapp")
    .select("id, midia_url")
    .in("id", mediaIds);
  if (mediaError) {
    throw new Error(`midias_do_lote_indisponiveis: ${mediaError.message}`);
  }
  const urlById = new Map(
    (mediaRows || []).map((media) => [String(media.id), media.midia_url]),
  );
  const events = rows.flatMap((row: any) => {
    const mediaId = String(row?.media_id || "");
    const mediaUrl = urlById.get(mediaId);
    return mediaId && mediaUrl
      ? [{
        queue_id: String(row.queue_id),
        media_id: mediaId,
        media_url: String(mediaUrl),
        reused: row.reused === true,
        event_created_at: String(row.event_created_at),
      }]
      : [];
  });
  return {
    photos: vehiclePhotosFromQueueEvents(events),
    reusedPhotoIds: [...new Set(
      events.filter((event) => event.reused).map((event) => event.media_id),
    )],
    shouldOffer: rows.some((row: any) => row?.should_offer === true),
  };
}

async function appendVehicleCarouselPhotosAtomically(
  conversationId: string,
  photos: VehicleCarouselPhoto[],
): Promise<PendingVehicleCarousel | null> {
  const { data, error } = await sb.rpc("append_vehicle_carousel_photos", {
    p_conversation_id: conversationId,
    p_photos: photos,
  });
  if (error) throw new Error(`coleta_atomica_falhou: ${error.message}`);
  return data && typeof data === "object"
    ? data as PendingVehicleCarousel
    : null;
}

async function clearExpiredAnuncioPendingState(
  conversation: ConversationStateIdentity,
  state: AgentConvState,
): Promise<void> {
  const patch = expiredAnuncioPendingPatch(state);
  if (!Object.keys(patch).length) return;
  const saved = await saveAgentState(sb, conversation, patch, state);
  if (!saved) return;
  Object.assign(state, patch);
  console.log(
    `[lote] pendentes_expirados=${Object.keys(patch).join(",")}`,
  );
}

async function startVehicleCarouselFlow(
  ctx: {
    userId: string;
    fromNumber: string;
    convId?: string;
    agentState?: AgentConvState;
  },
  photos: VehicleCarouselPhoto[],
  reason: string,
): Promise<PendingVehicleCarousel> {
  if (!ctx.convId) throw new Error("conversa_sem_id");
  const conversation = {
    id: ctx.convId,
    userId: ctx.userId,
    contactNumber: ctx.fromNumber,
  };
  const current = ctx.agentState ?? await loadAgentState(sb, conversation);
  const last = vehicleCarouselDataFromAgentState(current);
  const state = vehicleCarouselStartState(photos, last?.clientName);
  const patch: Partial<AgentConvState> = {
    pending_carrossel_veiculo: state,
    pending_vehicle_photo_batch: null,
    ...vehicleCarouselAdStateReset(),
  };
  const saved = await saveAgentState(sb, conversation, patch, current);
  if (!saved) throw new Error("estado_carrossel_veiculo_nao_persistido");
  Object.assign(current, patch);
  ctx.agentState = current;
  console.log(`[carrossel] gatilho=sim motivo=${reason}`);
  console.log(
    `[carrossel] fotos=${state.photos.length} estagio=${state.stage}`,
  );
  return state;
}

async function persistVehiclePhotoBatch(
  ctx: {
    userId: string;
    fromNumber: string;
    convId?: string;
    agentState?: AgentConvState;
  },
  state: PendingVehiclePhotoBatch | null,
  resetAdState = false,
): Promise<void> {
  if (!ctx.convId) throw new Error("conversa_sem_id");
  const conversation = {
    id: ctx.convId,
    userId: ctx.userId,
    contactNumber: ctx.fromNumber,
  };
  const current = ctx.agentState ?? await loadAgentState(sb, conversation);
  const patch: Partial<AgentConvState> = {
    pending_vehicle_photo_batch: state,
    ...(resetAdState ? vehiclePhotoBatchNewTopicReset() : {}),
  };
  const saved = await saveAgentState(sb, conversation, patch, current);
  if (!saved) throw new Error("estado_lote_fotos_nao_persistido");
  Object.assign(current, patch);
  ctx.agentState = current;
  console.log(
    `[carrossel] fotos=${state?.photos.length ?? 0} estagio=${
      state?.stage ?? "descartado"
    }`,
  );
}

async function sendVehicleFlowReply(input: {
  conversationId: string;
  userId: string;
  to: string;
  text: string;
  buttons?: WhatsAppInteractiveButtons;
}): Promise<void> {
  const { data: outMsg } = await sb.from("whatsapp_cloud_messages").insert({
    conversation_id: input.conversationId,
    user_id: input.userId,
    direction: "outbound",
    sender: "agent",
    content: input.text,
    message_type: input.buttons ? "interactive" : "text",
  }).select("id").single();
  const sentId = await sendWhatsApp(
    input.userId,
    input.to,
    input.text,
    undefined,
    undefined,
    input.buttons,
  );
  if (sentId && outMsg?.id) {
    await sb.from("whatsapp_cloud_messages").update({ wamid: sentId }).eq(
      "id",
      outMsg.id,
    );
  }
}

async function persistVehicleCarousel(
  ctx: {
    userId: string;
    fromNumber: string;
    convId?: string;
    agentState?: AgentConvState;
  },
  state: PendingVehicleCarousel | null,
): Promise<void> {
  if (!ctx.convId) throw new Error("conversa_sem_id");
  const conversation = {
    id: ctx.convId,
    userId: ctx.userId,
    contactNumber: ctx.fromNumber,
  };
  const current = ctx.agentState ?? await loadAgentState(sb, conversation);
  const saved = await saveAgentState(sb, conversation, {
    pending_carrossel_veiculo: state,
  }, current);
  if (!saved) throw new Error("estado_carrossel_veiculo_nao_persistido");
  current.pending_carrossel_veiculo = state;
  ctx.agentState = current;
}

function vehicleCarouselDataFromAgentState(
  state: AgentConvState | undefined,
): { data: VehicleCarouselData; clientName?: string | null } | null {
  const last = validLastAnuncio(state?.last_anuncio)
    ? state!.last_anuncio!
    : null;
  const lastFipe = state?.last_fipe;
  const fipeFresh = lastFipe &&
    Date.now() - new Date(lastFipe.created_at).getTime() <= 24 * 60 * 60 * 1000;
  if (last) {
    const d = last.data;
    const title = String(d.titulo || "");
    const fipeMatches = fipeFresh &&
      normalizePt(title).includes(normalizePt(lastFipe!.queryModel || lastFipe!.model));
    return {
      data: {
        titulo: title || undefined,
        ano: String(d.ano || "") || undefined,
        preco: String(d.preco || "") || undefined,
        fipe: String(
          d.fipe || d.preco_referencia ||
            (fipeMatches ? lastFipe!.price : "") || "",
        ) || undefined,
        fipe_mes: String(
          d.preco_referencia_obs ||
            (fipeMatches ? lastFipe!.referenceMonth : "") || "",
        ) || undefined,
        quilometragem: String(d.quilometragem || "") || undefined,
        cambio: String(d.cambio || "") || undefined,
        motor: String(d.motor || "") || undefined,
        documentacao: String(d.documentacao || "") || undefined,
        condicoes: Array.isArray(d.condicoes)
          ? d.condicoes.map(String)
          : undefined,
        contato: String(d.telefone || "") || undefined,
        opcionais: [
          ...(Array.isArray(d.opcionais) ? d.opcionais.map(String) : []),
          ...(Array.isArray(d.itens) ? d.itens.map(String) : []),
          ...(Array.isArray(d.ficha) ? d.ficha.map(String) : []),
        ],
      },
      clientName: last.client_name,
    };
  }
  if (fipeFresh) {
    return {
      data: {
        titulo: `${lastFipe!.brand} ${lastFipe!.model}`.trim(),
        ano: String(lastFipe!.modelYear || "") || undefined,
        fipe: lastFipe!.price,
        fipe_mes: lastFipe!.referenceMonth,
        motor: lastFipe!.fuel,
      },
    };
  }
  return null;
}

async function askVehicleCarouselData(
  state: PendingVehicleCarousel,
  ctx: {
    userId: string;
    fromNumber: string;
    convId?: string;
    agentState?: AgentConvState;
  },
): Promise<{
  text: string;
  interactiveButtons?: WhatsAppInteractiveButtons;
}> {
  const suggested = vehicleCarouselDataFromAgentState(ctx.agentState);
  if (suggested) {
    const next = {
      ...state,
      stage: "data_choice" as const,
      suggested_data: suggested.data,
      client_name: suggested.clientName,
      created_at: new Date().toISOString(),
    };
    await persistVehicleCarousel(ctx, next);
    return {
      text: "Encontrei dados recentes deste veículo. Quer aproveitar?",
      interactiveButtons: vehicleCarouselDataButtons(),
    };
  }
  const next = {
    ...state,
    stage: "awaiting_data" as const,
    created_at: new Date().toISOString(),
  };
  await persistVehicleCarousel(ctx, next);
  return {
    text:
      "Me mande em uma mensagem os dados que tiver: modelo, ano, km, câmbio, preço, condições e contato. O que não informar não aparece.",
  };
}

async function askVehicleCarouselPhotoOrFormat(
  state: PendingVehicleCarousel,
  ctx: {
    userId: string;
    fromNumber: string;
    convId?: string;
    agentState?: AgentConvState;
  },
): Promise<{
  text: string;
  interactiveButtons?: WhatsAppInteractiveButtons;
}> {
  const next = {
    ...state,
    stage: "photo_choice" as const,
    photo_preference: undefined,
    created_at: new Date().toISOString(),
  };
  await persistVehicleCarousel(ctx, next);
  return {
    text:
      "Como quer as fotos do carrossel? Melhorar só muda fundo e luz; o veículo fica igual.",
    interactiveButtons: vehicleCarouselPhotoButtons(),
  };
}

async function analyzeVehicleCarouselPhoto(
  imageUrl: string,
): Promise<{
  view: VehiclePhotoView;
  box: [number, number, number, number] | null;
}> {
  const prompt =
    'Analise esta foto de veículo. Responda SOMENTE JSON: {"view":"Frente|Lateral|Traseira|3/4|Interior|Painel|Bancos|Porta-malas|Motor|Rodas|Veículo","box_2d":[ymin,xmin,ymax,xmax]}. Use apenas um dos valores de view. A caixa 0–1000 deve conter o veículo ou componente principal inteiro. Não descreva conservação nem opcionais.';
  try {
    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Lovable-API-Key": LOVABLE_API_KEY,
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          temperature: 0,
          messages: [{
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          }],
        }),
        signal: AbortSignal.timeout(20_000),
      },
    );
    if (!response.ok) throw new Error(`visao_${response.status}`);
    const result = await response.json();
    const raw = String(result?.choices?.[0]?.message?.content || "")
      .replace(/```(?:json)?|```/gi, "").trim();
    const parsed = JSON.parse(raw);
    const allowed: VehiclePhotoView[] = [
      "Frente",
      "Lateral",
      "Traseira",
      "3/4",
      "Interior",
      "Painel",
      "Bancos",
      "Porta-malas",
      "Motor",
      "Rodas",
      "Veículo",
    ];
    const view = allowed.includes(parsed?.view) ? parsed.view : "Veículo";
    const box = parseFotoBoxFromVisionResponse(JSON.stringify(parsed));
    return {
      view,
      box: box
        ? [box.ymin, box.xmin, box.ymax, box.xmax]
        : null,
    };
  } catch (error) {
    console.warn("[vehicle-carousel][vision]", (error as Error).message);
    return { view: "Veículo", box: null };
  }
}

async function renderVehicleCarousel(
  state: PendingVehicleCarousel,
  ctx: {
    userId: string;
    fromNumber: string;
    convId?: string;
    agentState?: AgentConvState;
  },
): Promise<{
  text: string;
  interactiveButtons?: WhatsAppInteractiveButtons;
}> {
  if (!state.data || state.photos.length < VEHICLE_CAROUSEL_MIN_PHOTOS) {
    return {
      text:
        `Preciso de pelo menos ${VEHICLE_CAROUSEL_MIN_PHOTOS} fotos e dos dados do veículo.`,
    };
  }
  const rendering = {
    ...state,
    stage: "rendering" as const,
    created_at: new Date().toISOString(),
  };
  await persistVehicleCarousel(ctx, rendering);
  const processed: VehicleCarouselPhoto[] = [];
  for (const photo of state.photos.slice(0, VEHICLE_CAROUSEL_MAX_PHOTOS)) {
    let url = photo.url;
    if (state.photo_preference === "melhorada") {
      try {
        const edited = JSON.parse(await toolEditarImagem(
          productAdPhotoImprovementPrompt(state.data.titulo || "veículo"),
          {
            userId: ctx.userId,
            fromNumber: ctx.fromNumber,
            media: [],
            textos: [],
            modo: "anuncio",
            preservarAmbiente: false,
            registrarNaBiblioteca: false,
            imageInputUrl: photo.url,
          },
        ));
        if (edited?.image_url) url = edited.image_url;
      } catch (error) {
        console.warn(
          "[vehicle-carousel][photo-improvement]",
          (error as Error).message,
        );
      }
    }
    const analysis = await analyzeVehicleCarouselPhoto(url);
    processed.push({ ...photo, url, ...analysis });
  }
  let generated: {
    slides?: Array<{
      type?: "cover" | "content" | "cta";
      title?: string;
      body?: string;
      number?: number;
    }>;
    caption?: string;
  } | null = null;
  try {
    generated = await callEdge("gerar-carousel-content", {
      user_id: ctx.userId,
      tema: state.data.titulo || "Veículo",
      prompt: buildVehicleCarouselContentPrompt({
        photos: processed,
        data: state.data,
      }),
      neutral_copy: false,
    }, 90_000);
  } catch (error) {
    console.warn(
      "[vehicle-carousel][content-fallback]",
      (error as Error).message,
    );
  }
  const slides = buildVehicleCarouselSlides({
    photos: processed,
    data: state.data,
    generated,
  });
  const client = state.client_name
    ? await findClientBrandIdentity(sb, ctx.userId, { name: state.client_name })
    : null;
  const logoPath = client ? clientLogoPath(client, "dark", true) : null;
  const render = await callEdge("render-carousel-slides", {
    user_id: ctx.userId,
    slides,
    template: "dark-premium",
    vehicle_mode: true,
    format: state.format,
    logo_path: logoPath,
    incluir_logo: true,
    ctaLabel: "CHAMAR NO WHATSAPP",
  }, 240_000);
  const imageUrls = Array.isArray(render?.image_urls)
    ? render.image_urls.filter(Boolean)
    : [];
  if (imageUrls.length !== slides.length) {
    throw new Error("não consegui renderizar todas as páginas do carrossel");
  }
  const mediaId = await registrarCarrosselNaBiblioteca(
    ctx,
    state.data.titulo || "Veículo",
    imageUrls,
  );
  const factualData = {
    ...state.data,
    telefone: state.data.contato,
  };
  const generatedCaption = String(generated?.caption || "").trim();
  const caption = generatedCaption &&
      isGeneratedVehicleCopySafe(generatedCaption, state.data)
    ? generatedCaption
    : generateVehicleAdCaptions(factualData).A;
  await enviarPreviewCarrossel(ctx, imageUrls);
  const delivered = {
    ...state,
    stage: "delivered" as const,
    photos: processed,
    media_id: mediaId,
    image_urls: imageUrls,
    caption,
    created_at: new Date().toISOString(),
  };
  await persistVehicleCarousel(ctx, delivered);
  return {
    text: `Carrossel pronto com ${imageUrls.length} páginas.\n\n${caption}`,
    interactiveButtons: vehicleCarouselDeliveryButtons(),
  };
}

function vehicleCarouselNetworkButtons(
  connected: AnuncioPostNetwork[],
): WhatsAppInteractiveButtons {
  const base = anuncioPostNetworkButtons(connected);
  return {
    ...base,
    buttons: base.buttons.map((button) => ({
      ...button,
      id: button.id.replace(
        "anuncio_post:networks:",
        "vehicle_carousel:networks:",
      ),
    })),
  };
}

async function prepareVehicleCarouselSocial(
  state: PendingVehicleCarousel,
  networks: AnuncioPostNetwork[],
  ctx: {
    userId: string;
    fromNumber: string;
    convId?: string;
    agentState?: AgentConvState;
  },
): Promise<string> {
  if (
    !state.media_id || !state.image_urls?.length || !state.data ||
    !state.caption
  ) {
    return JSON.stringify({
      erro: "carrossel_veiculo_incompleto",
      mensagem: "Não encontrei o carrossel completo para publicar.",
    });
  }
  const captions = generateVehicleAdCaptions({
    ...state.data,
    telefone: state.data.contato,
  });
  const variantes = Object.fromEntries(
    networks.map((network) => [network, { ...captions }]),
  ) as Record<string, PostVariantes>;
  const scripts = Object.fromEntries(
    networks.map((network) => [network, captions.A]),
  );
  const token = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const pending: PendingSocialPost = {
    produto: {
      id: state.media_id,
      source: "carrossel_whatsapp",
      nome: `Carrossel: ${state.data.titulo || "Veículo"}`,
      descricao: JSON.stringify(state.data),
      imagem_url: state.image_urls[0],
      image_urls: state.image_urls,
      midia_tipo: "carrossel",
    },
    tom: "beneficio",
    redes: networks,
    scripts,
    variantes,
    userId: ctx.userId,
    requesterPhone: ctx.fromNumber,
    createdAt: Date.now(),
    formato: "feed",
    midiaTipo: "carrossel",
    briefing: JSON.stringify(state.data).slice(0, 1200),
  };
  const queueRows = await persistPendingSocialPost(token, pending);
  PENDING_POSTS.set(token, { ...pending, queueRows });
  if (!ctx.convId) throw new Error("conversa_sem_id");
  const conversation = {
    id: ctx.convId,
    userId: ctx.userId,
    contactNumber: ctx.fromNumber,
  };
  const current = ctx.agentState ?? await loadAgentState(sb, conversation);
  const vehicleState = {
    ...state,
    stage: "caption_choice" as const,
    token,
    created_at: new Date().toISOString(),
  };
  const carouselState: PendingCarouselState = {
    stage: "awaiting_confirmation",
    tema: state.data.titulo || "Veículo",
    caption: state.caption,
    media_id: state.media_id,
    image_urls: state.image_urls,
    token,
    facebook_requested: networks.includes("facebook"),
    created_at: new Date().toISOString(),
  };
  const saved = await saveAgentState(sb, conversation, {
    pending_carrossel_veiculo: vehicleState,
    pending_carousel: carouselState,
  }, current);
  if (!saved) {
    PENDING_POSTS.delete(token);
    await sb.from("social_posts_queue").update({
      status: "cancelado",
      error_message: "estado_carrossel_veiculo_nao_persistido",
      updated_at: new Date().toISOString(),
    }).in("id", queueRows.map((row) => row.id)).eq("user_id", ctx.userId);
    throw new Error("não consegui salvar a aprovação do carrossel");
  }
  current.pending_carrossel_veiculo = vehicleState;
  current.pending_carousel = carouselState;
  ctx.agentState = current;
  return JSON.stringify({
    status: "aguardando_escolha_variante",
    fonte: "carrossel_veiculo",
    carrossel: true,
    token,
    cards: state.image_urls.length,
    media_id: state.media_id,
    media_code: idCurto(state.media_id),
    formato: "feed",
    redes: networks,
    variantes,
  });
}

async function callEdge(fn: string, payload: any, timeoutMs = 120000): Promise<any> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICE_KEY}`,
      "apikey": SERVICE_KEY,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const txt = await res.text();
  let json: any = null;
  try { json = JSON.parse(txt); } catch { /* resposta não-JSON */ }
  if (!res.ok) {
    throw new Error(json?.error || `${fn} ${res.status}: ${txt.slice(0, 200)}`);
  }
  return json ?? {};
}

async function sendCarrosselColorPicker(userId: string, to: string, tema: string, demonstracao = false): Promise<void> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-send-message`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICE_KEY}`,
      "apikey": SERVICE_KEY,
    },
    body: JSON.stringify({
      user_id: userId,
      to,
      skip_log: false,
      log_sender: "agent",
      interactive_list: {
        header: "🎨 Cor do carrossel",
        body: `Beleza! Vou montar o carrossel sobre *${tema.slice(0, 120)}*.\n\nEscolha a cor de destaque — é só 1 toque:`,
        footer: demonstracao ? "Demonstração: nada será publicado" : "Depois você confere antes de publicar",
        button: "Escolher cor",
        section_title: "Cores",
        rows: carouselColorRows(),
      },
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) {
    throw new Error(`seletor_cor_falhou_${response.status}: ${(await response.text()).slice(0, 160)}`);
  }
}

async function registrarCarrosselNaBiblioteca(
  ctx: { userId: string; fromNumber: string },
  tema: string,
  imageUrls: string[],
): Promise<string> {
  const { data: parent, error: parentError } = await sb
    .from("midias_whatsapp")
    .insert({
      user_id: ctx.userId,
      origem: "carrossel_whatsapp",
      telefone_origem: ctx.fromNumber,
      tipo: "foto",
      midia_url: imageUrls[0],
      mime_type: "image/png",
      contexto_original: `Carrossel: ${tema}`.slice(0, 1500),
      status: "pendente",
    })
    .select("id")
    .single();
  if (parentError || !parent?.id) throw new Error(`carrossel_parent_falhou: ${parentError?.message || "sem id"}`);

  const children = imageUrls.slice(1).map((url, index) => ({
    user_id: ctx.userId,
    origem: "carrossel_whatsapp_card",
    telefone_origem: ctx.fromNumber,
    tipo: "foto",
    midia_url: url,
    mime_type: "image/png",
    contexto_original: `[carrossel_card:${String(index + 2).padStart(3, "0")}] ${tema}`.slice(0, 1500),
    status: "pendente",
    midia_pai_id: parent.id,
  }));
  if (children.length > 0) {
    const { error: childrenError } = await sb.from("midias_whatsapp").insert(children);
    if (childrenError) {
      await sb.from("midias_whatsapp")
        .delete()
        .eq("id", parent.id)
        .eq("user_id", ctx.userId);
      throw new Error(`carrossel_cards_falharam: ${childrenError.message}`);
    }
  }
  return parent.id;
}

async function loadProspectCarouselBranch(userId: string, fromNumber: string): Promise<string | null> {
  const { data, error } = await sb
    .from("jarvis_leads")
    .select("ramo")
    .eq("user_id", userId)
    .eq("telefone", fromNumber)
    .maybeSingle();
  if (error) {
    console.warn("[carrossel-demo][ramo_lookup_failed]", error.message);
    return null;
  }
  return String(data?.ramo || "").trim() || null;
}

async function enviarPreviewCarrossel(
  ctx: { userId: string; fromNumber: string },
  imageUrls: string[],
  startIndex = 0,
  maxCards = imageUrls.length,
): Promise<void> {
  await sendCarouselCardsInOrder({
    imageUrls,
    startIndex,
    maxCards,
    send: async (url, index, total) => {
      await sendWhatsApp(
        ctx.userId,
        ctx.fromNumber,
        `Card ${index + 1} de ${total}`,
        url,
        undefined,
        undefined,
        { alreadyLogged: false },
      );
    },
    pause: wait,
    logger: (message) => console.log(message),
  });
}

async function cancelarPreviewCarrosselAnterior(token: string | undefined, userId: string): Promise<void> {
  if (!token) return;
  PENDING_POSTS.delete(token);
  const { data, error } = await sb.from("social_posts_queue")
    .update({
      status: "cancelado",
      error_message: "cancelado_por_ajuste_carrossel",
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("status", "aguardando_confirmacao")
    .like("error_message", `jarvis_token:${token}%`)
    .select("id");
  if (error || (data?.length ?? 0) === 0) {
    throw new Error(error?.message || "preview_anterior_nao_encontrado");
  }
}

async function prepararPreviewCarrosselExistente(
  parentId: string,
  ctx: { userId: string; fromNumber: string; convId?: string; agentState?: AgentConvState },
  options: { tom?: string; legenda?: string; facebookRequested?: boolean; linkedinRequested?: boolean; enviarCards?: boolean } = {},
): Promise<string> {
  if (!ctx.convId) return JSON.stringify({ erro: "conversa_sem_id", mensagem: "Não consegui identificar a conversa para guardar a aprovação do carrossel." });
  const { data: parent, error: parentError } = await sb
    .from("midias_whatsapp")
    .select("id, midia_url, contexto_original, created_at")
    .eq("id", parentId)
    .eq("user_id", ctx.userId)
    .maybeSingle();
  if (parentError || !parent) return JSON.stringify({ erro: "carrossel_nao_encontrado", mensagem: "Não encontrei o carrossel completo nesta conta." });

  const imageUrls = await loadCarouselImageUrls(ctx.userId, parentId);
  if (imageUrls.length < 2) return JSON.stringify({ erro: "carrossel_incompleto", mensagem: "Não encontrei todos os cards desse carrossel. Não publiquei nada." });
  if (options.enviarCards) {
    try {
      await enviarPreviewCarrossel(ctx, imageUrls);
    } catch (e) {
      return JSON.stringify({ erro: "preview_carrossel_falhou", mensagem: `Não consegui mostrar os cards para aprovação: ${(e as Error).message}. Não publiquei nada.` });
    }
  }

  const state = ctx.agentState?.pending_carousel;
  const tema = state?.media_id === parentId ? state.tema : String(parent.contexto_original || "Carrossel").replace(/^Carrossel:\s*/i, "");
  const slideContext = state?.media_id === parentId && Array.isArray(state.slides)
    ? state.slides.map((slide: any, index: number) => `Card ${index + 1}: ${JSON.stringify(slide)}`).join("\n")
    : `${imageUrls.length} cards sobre ${tema}`;
  const produto = {
    id: parentId,
    source: "carrossel_whatsapp",
    nome: `Carrossel: ${tema}`.slice(0, 120),
    descricao: slideContext.slice(0, 5000),
    imagem_url: imageUrls[0],
    image_urls: imageUrls,
    link: null,
    midia_tipo: "carrossel" as const,
  };
  const tom = options.tom || "beneficio";
  const variantesBase = await gerarTresOpcoesRedeSocial(
    produto,
    tom,
    "instagram",
    options.legenda ? `Use esta orientação do dono na legenda: ${options.legenda}` : undefined,
    undefined,
    options.legenda,
  );
  const variantes = { instagram: variantesBase };
  const token = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const pending: PendingSocialPost = {
    produto,
    tom,
    redes: ["instagram"],
    scripts: { instagram: variantesBase.A },
    variantes,
    userId: ctx.userId,
    requesterPhone: ctx.fromNumber,
    createdAt: Date.now(),
    formato: "feed",
    midiaTipo: "carrossel",
  };
  const queueRows = await persistPendingSocialPost(token, pending);
  PENDING_POSTS.set(token, { ...pending, queueRows });

  const conversation = { id: ctx.convId, userId: ctx.userId, contactNumber: ctx.fromNumber };
  const current = ctx.agentState ?? await loadAgentState(sb, conversation);
  const previous = current.pending_carousel;
  const next: PendingCarouselState = {
    stage: "awaiting_confirmation",
    tema,
    cor: previous?.media_id === parentId ? previous.cor : undefined,
    slides: previous?.media_id === parentId ? previous.slides : undefined,
    caption: options.legenda || previous?.caption,
    media_id: parentId,
    image_urls: imageUrls,
    token,
    facebook_requested: options.facebookRequested || previous?.facebook_requested,
    created_at: new Date().toISOString(),
  };
  const saved = await saveAgentState(sb, conversation, { pending_carousel: next }, current);
  if (!saved) {
    PENDING_POSTS.delete(token);
    await sb.from("social_posts_queue")
      .update({ status: "cancelado", error_message: "estado_carrossel_nao_persistido", updated_at: new Date().toISOString() })
      .in("id", queueRows.map((row) => row.id))
      .eq("user_id", ctx.userId);
    return JSON.stringify({ erro: "estado_carrossel_nao_persistido", mensagem: "Não consegui guardar o snapshot exato do carrossel. Não publiquei nada." });
  }
  current.pending_carousel = next;
  ctx.agentState = current;

  return JSON.stringify({
    status: "aguardando_escolha_variante",
    fonte: "carrossel_whatsapp",
    carrossel: true,
    token,
    cards: imageUrls.length,
    media_id: parentId,
    media_code: idCurto(parentId),
    redes: ["instagram"],
    variantes,
    aviso_facebook: options.facebookRequested || options.linkedinRequested
      ? `Carrossel pelo WhatsApp está disponível apenas no Instagram; não publiquei no ${[
        options.facebookRequested ? "Facebook" : "",
        options.linkedinRequested ? "LinkedIn" : "",
      ].filter(Boolean).join(" nem no ")}.`
      : undefined,
  });
}

async function toolCriarCarrossel(
  args: {
    tema?: string;
    cor?: string;
    legenda?: string;
    ajuste?: string;
    slides?: any[];
    num_slides?: number;
    facebook_requested?: boolean;
  },
  ctx: { userId: string; fromNumber: string; convId?: string; agentState?: AgentConvState; demonstracao?: boolean },
): Promise<string> {
  try {
    const demoProspect = ctx.demonstracao === true
      && ctx.userId === ADMIN_AMZ_USER_ID
      && !isOwner(ctx);
    if (!isOwner(ctx) && !demoProspect) {
      return JSON.stringify({
        erro: "acao_restrita_ao_responsavel",
        mensagem: "Criar e publicar carrossel é restrito ao responsável da conta.",
      });
    }

    const tema = (args?.tema || "").trim();
    if (tema.length < 3) return JSON.stringify({ erro: "informe o tema/assunto do carrossel" });
    const numSlides = Array.isArray(args.slides) && args.slides.length >= 3
      ? Math.min(10, args.slides.length)
      : requestedCarouselSlideCount(
        Number.isFinite(args.num_slides) ? `${args.num_slides} cards` : tema,
        demoProspect,
      );

    // 1) COR — se não vier (ou vier irreconhecível), manda a LISTA de 1 toque e para aqui.
    const cor = resolveCarouselColor(args?.cor);
    if (!cor) {
      if (!ctx.convId) return JSON.stringify({ erro: "conversa_sem_id", mensagem: "Não consegui identificar esta conversa para guardar a escolha da cor." });
      const conversation = { id: ctx.convId, userId: ctx.userId, contactNumber: ctx.fromNumber };
      const current = ctx.agentState ?? await loadAgentState(sb, conversation);
      const pending: PendingCarouselState = {
        stage: "awaiting_color",
        tema,
        num_slides: numSlides,
        caption: args?.legenda,
        facebook_requested: !!args?.facebook_requested,
        created_at: new Date().toISOString(),
      };
      if (!await saveAgentState(sb, conversation, { pending_carousel: pending }, current)) {
        return JSON.stringify({ erro: "estado_carrossel_nao_persistido", mensagem: "Não consegui guardar o carrossel antes de pedir a cor. Tente novamente." });
      }
      current.pending_carousel = pending;
      ctx.agentState = current;
      await sendCarrosselColorPicker(ctx.userId, ctx.fromNumber, tema, demoProspect);
      return JSON.stringify({
        status: "aguardando_cor",
        tema,
        aviso_facebook: args?.facebook_requested ? "Carrossel pelo WhatsApp está disponível apenas no Instagram." : undefined,
        instrucao:
          "Já enviei ao usuário uma LISTA de cores (1 toque). NÃO escreva a lista de novo, NÃO repita as opções. Responda no máximo 1 linha curta tipo 'É só escolher a cor aí em cima 👆'. Quando ele responder a cor (ex: 'Azul'), chame criar_carrossel outra vez com tema=\"" +
          tema.replace(/"/g, "'") + "\" e cor=<a cor escolhida>.",
      });
    }

    // 2) Guardrail de volume por tenant/dia
    const desdeHoje = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: feitosHoje } = await sb
      .from("social_posts_queue")
      .select("id", { count: "exact", head: true })
      .eq("user_id", ctx.userId)
      .eq("produto_source", "carrossel_whatsapp")
      .neq("status", "cancelado")
      .gte("created_at", desdeHoje);
    if ((feitosHoje ?? 0) >= CARROSSEL_MAX_DIA) {
      return JSON.stringify({
        erro: "limite_diario_carrossel",
        mensagem: `Você já criou ${feitosHoje} carrosséis nas últimas 24h (limite ${CARROSSEL_MAX_DIA}). Amanhã libera de novo.`,
      });
    }

    // 3) Identidade do tenant (nome/@ do próprio Instagram conectado)
    const { data: conn } = await sb
      .from("meta_connections")
      .select("page_name, ig_username, ig_account_id")
      .eq("user_id", ctx.userId)
      .eq("is_active", true)
      .maybeSingle();
    if (!conn?.ig_account_id && !demoProspect) {
      return JSON.stringify({
        erro: "instagram_nao_conectado",
        mensagem: "Seu Instagram não está conectado. Vá em Configurações → Redes Sociais, conecte a conta e me chama de novo.",
      });
    }
    const businessName = demoProspect ? null : (conn?.page_name || "").trim() || null;
    const profileHandle = demoProspect || !conn?.ig_username
      ? null
      : `@${String(conn.ig_username).replace(/^@/, "")}`;

    // 4) CONTEÚDO dos slides — MESMO gerador E MESMA metodologia do app
    //    (buildCarouselPrompt espelha src/components/CarouselGenerator.tsx:
    //     4-5 tópicos densos por card) + CONTEXTO REAL do negócio do tenant.
    const business = demoProspect
      ? null
      : await getTenantBusinessContext(sb, ctx.userId, {
        nomeFallback: businessName,
        tipoCriativo: "carrossel",
      });
    const prospectBranch = demoProspect
      ? await loadProspectCarouselBranch(ctx.userId, ctx.fromNumber)
      : null;
    let prompt = demoProspect
      ? buildProspectDemoCarouselPrompt({ tema, ramo: prospectBranch, numSlides })
      : buildCarouselPrompt({ tema, numSlides, business });
    if (args?.ajuste && Array.isArray(args?.slides) && args.slides.length >= 2) {
      prompt += `\n\nCARROSSEL ATUAL:\n${JSON.stringify(args.slides)}\n\nAJUSTE OBRIGATÓRIO DO DONO: ${args.ajuste}\nPreserve todos os cards e textos que não foram citados no ajuste.`;
    }
    console.log("[criar_carrossel] contexto_do_negocio", {
      demonstracao: demoProspect,
      num_slides: numSlides,
      ramo_prospect: prospectBranch,
      tem_contexto: business?.temContexto ?? false,
      produtos: business?.produtos.length ?? 0,
    });

    let conteudo = Array.isArray(args?.slides) && args.slides.length >= 2 && !args?.ajuste
      ? { slides: args.slides, caption: args?.legenda || tema }
      : await callEdge("gerar-carousel-content", {
        prompt,
        tema,
        user_id: ctx.userId,
        neutral_copy: demoProspect,
      }, 90000);
    let slides = Array.isArray(conteudo?.slides)
      ? demoProspect
        ? sanitizeProspectDemoSlides(conteudo.slides)
        : sanitizeCarouselSlides(conteudo.slides)
      : [];
    if ((!args?.slides || args?.ajuste) && slides.length !== numSlides) {
      console.warn(`[criar_carrossel] quantidade_incorreta recebida=${slides.length} esperada=${numSlides}; tentando novamente`);
      conteudo = await callEdge("gerar-carousel-content", {
        prompt: `${prompt}\n\nCORREÇÃO OBRIGATÓRIA: a resposta anterior não trouxe a quantidade pedida. Retorne EXATAMENTE ${numSlides} slides.`,
        tema,
        user_id: ctx.userId,
        neutral_copy: demoProspect,
      }, 90000);
      slides = Array.isArray(conteudo?.slides)
        ? demoProspect
          ? sanitizeProspectDemoSlides(conteudo.slides)
          : sanitizeCarouselSlides(conteudo.slides)
        : [];
    }
    if (slides.length !== numSlides) {
      return JSON.stringify({
        erro: "quantidade_slides_incorreta",
        detalhe: `a IA devolveu ${slides.length} cards; eram esperados ${numSlides}`,
      });
    }
    const generatedCaption = (args?.legenda || conteudo?.caption || tema).toString();
    const caption = demoProspect
      ? sanitizeProspectDemoCaption(generatedCaption, tema)
      : generatedCaption;

    // 5) RENDER server-side (Satori + resvg) — template dark-premium
    const render = await callEdge("render-carousel-slides", {
      user_id: ctx.userId,
      slides,
      template: "dark-premium",
      primaryColor: cor.primaryColor,
      secondaryColor: cor.secondaryColor,
      businessName,
      profileHandle,
      incluir_logo: !demoProspect,
    }, 180000);
    const imageUrls: string[] = Array.isArray(render?.image_urls) ? render.image_urls : [];
    if (imageUrls.length !== slides.length) {
      return JSON.stringify({
        erro: "falha_no_render",
        detalhe: `foram renderizados ${imageUrls.length} de ${slides.length} cards`,
      });
    }

    const mediaId = await registrarCarrosselNaBiblioteca(ctx, tema, imageUrls);
    if (!await rememberLastMediaInteraction(ctx, mediaId)) {
      return JSON.stringify({ erro: "ultima_midia_nao_persistida", mensagem: "Gerei o carrossel, mas não consegui marcá-lo como a última produção desta conversa. Não publiquei nada." });
    }

    try {
      await enviarPreviewCarrossel(ctx, imageUrls);
    } catch (e) {
      return JSON.stringify({ erro: "preview_carrossel_falhou", mensagem: `Gerei os cards, mas não consegui mostrá-los para aprovação: ${(e as Error).message}. Não publiquei nada.` });
    }

    if (demoProspect) {
      if (ctx.convId) {
        const conversation = { id: ctx.convId, userId: ctx.userId, contactNumber: ctx.fromNumber };
        const current = ctx.agentState ?? await loadAgentState(sb, conversation);
        await saveAgentState(sb, conversation, { pending_carousel: null }, current);
        current.pending_carousel = null;
        ctx.agentState = current;
      }
      return JSON.stringify({
        ok: true,
        status: "demonstracao_carrossel",
        demonstracao: true,
        cards: imageUrls.length,
        media_id: mediaId,
        exemplo_legenda: caption,
        mensagem: `Pronto — esta é a demonstração do carrossel. Nada foi publicado.\n\nExemplo de legenda: ${caption}`,
      });
    }

    if (ctx.convId) {
      const conversation = { id: ctx.convId, userId: ctx.userId, contactNumber: ctx.fromNumber };
      const current = ctx.agentState ?? await loadAgentState(sb, conversation);
      const pending: PendingCarouselState = {
        stage: "awaiting_confirmation",
        tema,
        num_slides: numSlides,
        cor: cor.label,
        slides,
        caption,
        media_id: mediaId,
        image_urls: imageUrls,
        facebook_requested: !!args?.facebook_requested,
        created_at: new Date().toISOString(),
      };
      if (!await saveAgentState(sb, conversation, { pending_carousel: pending }, current)) {
        return JSON.stringify({ erro: "estado_carrossel_nao_persistido", mensagem: "Gerei e mostrei os cards, mas não consegui guardar o preview com segurança. Não publiquei nada." });
      }
      current.pending_carousel = pending;
      ctx.agentState = current;
    }

    return await prepararPreviewCarrosselExistente(mediaId, ctx, {
      legenda: caption,
      facebookRequested: !!args?.facebook_requested,
      enviarCards: false,
    });
  } catch (e) {
    return JSON.stringify({ erro: String((e as Error).message).slice(0, 250) });
  }
}

// ============================================================
// criar_anuncio — ANÚNCIO PROFISSIONAL DE PRODUTO (multi-nicho)
// Fluxo: foto (turno atual ou biblioteca 30min) → [IA melhora a foto]
//        → render-anuncio-produto (texto/preço/logo por template)
// A logo é SEMPRE a do próprio tenant (bucket tenant-logos / Minha Marca).
// ============================================================
const ANUNCIO_MAX_DIA = 20;

async function enviarPreviewEstilosAnuncio(
  ctx: { userId: string; fromNumber: string },
  renders: Array<{ style: AnuncioStyle; render: { image_url: string } }>,
): Promise<void> {
  for (const { style, render } of renders) {
    const label = style === "catalogo"
      ? "Catálogo"
      : style[0].toUpperCase() + style.slice(1);
    await sendWhatsApp(
      ctx.userId,
      ctx.fromNumber,
      label,
      render.image_url,
      undefined,
      undefined,
      { alreadyLogged: false },
    );
    await wait(250);
  }
}

async function buscarFotoOriginalRecenteParaAnuncio(ctx: {
  userId: string;
  fromNumber: string;
  agentState?: AgentConvState;
}): Promise<string | null> {
  const { data: recent, error } = await sb
    .from("midias_whatsapp")
    .select("id, tipo, origem, midia_url, telefone_origem, created_at")
    .eq("user_id", ctx.userId)
    .eq("telefone_origem", ctx.fromNumber)
    .eq("tipo", "foto")
    .eq("origem", "whatsapp")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw new Error(error.message);

  const interaction = ctx.agentState?.last_media_interaction ?? null;
  const candidates = [...(recent ?? [])];
  const interactedId = String(interaction?.media_id || "");
  const interactedAt = Date.parse(String(interaction?.at || ""));
  if (
    interactedId &&
    Number.isFinite(interactedAt) &&
    Date.now() - interactedAt <= 30 * 60 * 1000 &&
    !candidates.some((media: any) => media.id === interactedId)
  ) {
    const { data: interacted } = await sb
      .from("midias_whatsapp")
      .select("id, tipo, origem, midia_url, telefone_origem, created_at")
      .eq("id", interactedId)
      .eq("user_id", ctx.userId)
      .eq("telefone_origem", ctx.fromNumber)
      .eq("origem", "whatsapp")
      .maybeSingle();
    if (interacted) candidates.push(interacted);
  }
  return selectRecentOriginalPhoto({
    candidates,
    lastInteraction: interaction,
  })?.midia_url ?? null;
}

async function resolveAnuncioClientIdentity(input: {
  userId: string;
  clientName?: string;
  site?: string;
  allowNameOnly?: boolean;
}): Promise<
  | { mode: "tenant"; businessName: null; logoPath: null; colors: string[]; identity: null }
  | { mode: "client"; businessName: string; logoPath: string | null; colors: string[]; identity: ClientBrandIdentity }
  | { mode: "missing"; message: string }
> {
  const clientName = String(input.clientName || "").replace(/\s+/g, " ").trim().slice(0, 100);
  let saved = clientName
    ? await findClientBrandIdentity(sb, input.userId, {
    name: clientName,
    site: input.site,
  })
    : null;
  const plan = buildAnuncioBrandPlan({
    clientName,
    site: input.site,
    saved,
  });
  if (plan.mode === "tenant") {
    return { mode: "tenant", businessName: null, logoPath: null, colors: [], identity: null };
  }
  if (plan.mode === "client") {
    return {
      mode: "client",
      businessName: plan.businessName,
      logoPath: plan.logoPath,
      colors: plan.colors,
      identity: saved!,
    };
  }
  if (plan.mode === "missing") {
    if (input.allowNameOnly && clientName) {
      saved = await saveClientBrandIdentity(sb, {
        userId: input.userId,
        clientName,
      });
      return {
        mode: "client",
        businessName: saved.client_name || clientName,
        logoPath: null,
        colors: [],
        identity: saved,
      };
    }
    return {
      mode: "missing",
      message: `Não encontrei uma logo cadastrada para ${clientName}. Envie o site da loja ou a logo dizendo “salva essa como logo do cliente ${clientName}”. Não usei a logo da sua empresa.`,
    };
  }

  try {
    const fastIdentity = await fetchBrandSiteIdentity(plan.site);
    const identity = await completeSiteIdentityWithRenderedPage(
      sb,
      input.userId,
      fastIdentity,
    );
    const automatic = resolveAutomaticVideoSiteIdentity({
      requestedClientName: clientName,
      siteBrandName: identity.brand_name,
      siteUrl: identity.url,
      colors: identity.colors,
      logoConfidence: identity.logo_confidence,
      logoDataUrl: identity.logo_data_url,
    });
    const logoPath = automatic.useSiteLogo
      ? await uploadClientLogoData(
        input.userId,
        identity.logo_data_url,
        "client-brands",
      )
      : undefined;
    saved = await saveClientBrandIdentity(sb, {
      userId: input.userId,
      clientName,
      siteUrl: identity.url,
      logoPath,
      identity: {
        ...identity,
        logo_origem: logoPath ? "site" : undefined,
      } as unknown as Record<string, unknown>,
    });
    const colors = automatic.colors.length
      ? automatic.colors.map((color) => color.toUpperCase())
      : anuncioClientColors(saved.identity);
    if (saved.logo_path) {
      return {
        mode: "client",
        businessName: saved.client_name || clientName,
        logoPath: saved.logo_path,
        colors,
        identity: saved,
      };
    }
  } catch (error) {
    console.warn("[criar_anuncio][client-site]", (error as Error).message);
  }

  return {
    mode: "missing",
    message: `Não consegui obter uma logo válida de ${clientName} pelo site informado. Envie a logo dizendo “salva essa como logo do cliente ${clientName}”. Não usei a logo da sua empresa.`,
  };
}

type FipeToolResponse = {
  result: string;
  interactiveList?: WhatsAppInteractiveList;
};

async function persistFipeState(
  ctx: {
    userId: string;
    fromNumber: string;
    convId?: string;
    agentState?: AgentConvState;
  },
  pending: PendingFipeState | null,
  last?: LastFipeResult | null,
): Promise<void> {
  if (!ctx.convId) return;
  const conversation = {
    id: ctx.convId,
    userId: ctx.userId,
    contactNumber: ctx.fromNumber,
  };
  const current = ctx.agentState ?? await loadAgentState(sb, conversation);
  const patch: Partial<AgentConvState> = { pending_fipe: pending };
  if (last !== undefined) patch.last_fipe = last;
  await saveAgentState(sb, conversation, patch, current);
  current.pending_fipe = pending;
  if (last !== undefined) current.last_fipe = last;
  ctx.agentState = current;
}

function fipeResultText(result: FipePrice): string {
  return `FIPE ${result.referenceMonth}: ${result.price} — ${result.brand} ${result.model} ${result.modelYear} ${result.fuel} (código ${result.codeFipe})`;
}

async function finishFipeLookup(
  ctx: {
    userId: string;
    fromNumber: string;
    convId?: string;
    agentState?: AgentConvState;
  },
  input: {
    brand: FipeListItem;
    model: FipeListItem;
    year: FipeListItem;
    queryModel: string;
  },
): Promise<FipeToolResponse> {
  const result = await consultarPreco({
    brandId: input.brand.code,
    modelId: input.model.code,
    yearId: input.year.code,
  });
  const last: LastFipeResult = {
    ...result,
    queryBrand: input.brand.name,
    queryModel: input.queryModel || input.model.name,
    yearId: input.year.code,
    created_at: new Date().toISOString(),
  };
  await persistFipeState(ctx, null, last);
  return { result: fipeResultText(result) };
}

async function continueFipeWithModel(
  ctx: {
    userId: string;
    fromNumber: string;
    convId?: string;
    agentState?: AgentConvState;
  },
  input: {
    brand: FipeListItem;
    model: FipeListItem;
    queryModel: string;
    requestedYear?: string;
    requestedFuel?: string;
  },
): Promise<FipeToolResponse> {
  let years = await listarAnos(
    input.brand.code,
    input.model.code,
    [input.requestedYear, input.requestedFuel].filter(Boolean).join(" "),
  );
  if (!years.length && input.requestedYear) {
    years = await listarAnos(
      input.brand.code,
      input.model.code,
      input.requestedYear,
    );
  }
  if (!years.length) {
    years = await listarAnos(input.brand.code, input.model.code);
  }
  if (years.length === 1) {
    return await finishFipeLookup(ctx, {
      brand: input.brand,
      model: input.model,
      year: years[0],
      queryModel: input.queryModel,
    });
  }
  const pending: PendingFipeState = {
    stage: "year",
    brand: input.brand,
    model: input.model,
    years: years.slice(0, 10),
    queryModel: input.queryModel,
    created_at: new Date().toISOString(),
  };
  await persistFipeState(ctx, pending);
  return {
    result: "Encontrei mais de um ano/combustível. Escolha a opção correta:",
    interactiveList: {
      body: "Qual é o ano/modelo e combustível?",
      button: "Escolher ano",
      section_title: "Opções FIPE",
      rows: fipeListRows(pending.years, "fipe_year"),
    },
  };
}

async function identifyFipeVehicleFromPhoto(
  media: MediaExtract,
): Promise<{ brand: string; model: string; earliestYear?: number } | null> {
  if (!media.base64) return null;
  const imageUrl = `data:${media.mime || "image/jpeg"};base64,${media.base64}`;
  const prompt =
    'Identifique apenas como sugestão o veículo principal da foto. Responda SOMENTE JSON: {"brand":"marca","model":"modelo/geração","earliestYear":ano_inicial_no_Brasil_ou_null}. Não afirme o ano exato e não invente versão.';
  try {
    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Lovable-API-Key": LOVABLE_API_KEY,
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          temperature: 0,
          messages: [{
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          }],
        }),
        signal: AbortSignal.timeout(20_000),
      },
    );
    if (!response.ok) return null;
    const data = await response.json();
    const raw = String(data?.choices?.[0]?.message?.content || "")
      .replace(/```json\s*|\s*```/gi, "")
      .trim();
    const parsed = JSON.parse(raw);
    const brand = String(parsed?.brand || "").trim();
    const model = String(parsed?.model || "").trim();
    const earliestYear = Number(parsed?.earliestYear);
    if (!brand || !model) return null;
    return {
      brand,
      model,
      earliestYear: Number.isInteger(earliestYear) &&
          earliestYear >= 1900 && earliestYear <= new Date().getFullYear() + 1
        ? earliestYear
        : undefined,
    };
  } catch (error) {
    console.warn("[fipe][vision]", (error as Error).message);
    return null;
  }
}

async function toolConsultarFipe(
  rawArgs: FipeLookupInput,
  ctx: {
    userId: string;
    fromNumber: string;
    media?: MediaExtract[];
    convId?: string;
    agentState?: AgentConvState;
  },
): Promise<FipeToolResponse> {
  try {
    const args = normalizeFipeLookupInput(rawArgs ?? {});
    const photo = (ctx.media || []).find((item) => item.kind === "image");
    if (photo && (!args?.marca || !args?.modelo)) {
      const suggestion = await identifyFipeVehicleFromPhoto(photo);
      if (!suggestion) {
        return {
          result:
            "Não consegui identificar o veículo com segurança pela foto. Me diga a marca, o modelo, o ano/modelo e a versão.",
        };
      }
      const pending: PendingFipeState = {
        stage: "photo_confirmation",
        ...suggestion,
        created_at: new Date().toISOString(),
      };
      await persistFipeState(ctx, pending);
      return {
        result: fipePhotoSuggestionMessage(suggestion),
      };
    }
    const marca = String(args?.marca || "").trim();
    const modelo = String(args?.modelo || "").trim();
    if (!marca || !modelo) {
      return {
        result:
          "Me diga a marca, o modelo, o ano/modelo e, se souber, a versão do veículo.",
      };
    }
    const brand = await buscarMarca(marca);
    if (!brand) {
      return { result: `Não encontrei a marca “${marca}” na tabela FIPE.` };
    }
    const queryModel = [modelo, args?.versao].filter(Boolean).join(" ");
    const rankedModels = await listarModelos(brand.code, queryModel);
    const models = args.motor || args.cambio
      ? filterFipeModelCandidates(rankedModels, args)
      : rankedModels;
    if (!models.length) {
      return {
        result:
          `Não encontrei “${queryModel}” entre os modelos FIPE da ${brand.name}.`,
      };
    }
    if (models.length > 1) {
      const pending: PendingFipeState = {
        stage: "model",
        brand,
        models: models.slice(0, 10),
        requestedYear: args?.ano_modelo,
        requestedFuel: args?.combustivel,
        queryModel,
        created_at: new Date().toISOString(),
      };
      await persistFipeState(ctx, pending);
      return {
        result: "Encontrei mais de uma versão. Escolha a correta:",
        interactiveList: {
          body: `Qual versão do ${modelo}?`,
          button: "Escolher versão",
          section_title: "Versões FIPE",
          rows: fipeListRows(pending.models, "fipe_model"),
        },
      };
    }
    return await continueFipeWithModel(ctx, {
      brand,
      model: models[0],
      queryModel,
      requestedYear: args?.ano_modelo,
      requestedFuel: args?.combustivel,
    });
  } catch (error) {
    console.warn("[fipe][lookup]", (error as Error).message);
    return {
      result:
        "Não consegui consultar a FIPE agora. Tente de novo em alguns minutos.",
    };
  }
}

async function toolCriarAnuncio(
  args: {
    titulo?: string;
    cliente?: string;
    site?: string;
    subtitulo?: string;
    itens?: string[];
    versao?: string;
    motor?: string;
    cambio?: string;
    quilometragem?: string;
    cor?: string;
    donos?: string;
    documentacao?: string;
    revisoes?: string;
    pneus?: string;
    opcionais?: string[];
    condicoes?: string[];
    fipe?: string;
    ano?: string;
    preco?: string;
    preco_label?: string;
    preco_referencia?: string;
    preco_referencia_label?: string;
    preco_referencia_obs?: string;
    badge?: string;
    telefone?: string;
    instagram?: string;
    formato?: string;
    estilo?: string;
    melhorar_foto?: boolean;
    _foto_resolvida?: boolean;
    _foto_url_original?: string;
    _mostrar_tres_estilos?: boolean;
    _refazer_foto?: boolean;
    _usar_marca_tenant?: boolean;
    _usar_apenas_nome_cliente?: boolean;
    _fipe_choice?: "queried" | "supplied";
  },
  ctx: {
    userId: string;
    fromNumber: string;
    media?: MediaExtract[];
    convId?: string;
    agentState?: AgentConvState;
  },
): Promise<string> {
  try {
    if (!isOwner(ctx)) {
      return JSON.stringify({
        erro: "acao_restrita_ao_responsavel",
        mensagem: "Montar anúncio é restrito ao responsável da conta.",
      });
    }

    const titulo = (args?.titulo || "").trim();
    if (titulo.length < 2) {
      return JSON.stringify({
        erro: "titulo_ausente",
        mensagem: "Qual é o produto ou modelo que deve aparecer no anúncio?",
      });
    }

    const suppliedFipe = args?.fipe ||
      (String(args?.preco_referencia_label || "").toUpperCase() === "FIPE"
        ? args?.preco_referencia
        : undefined);
    if (args?._fipe_choice === "queried" && ctx.agentState?.last_fipe) {
      args.fipe = ctx.agentState.last_fipe.price;
      args.preco_referencia = undefined;
      args.preco_referencia_label = "FIPE";
      args.preco_referencia_obs = ctx.agentState.last_fipe.referenceMonth;
    } else if (args?._fipe_choice === "supplied") {
      args.fipe = String(suppliedFipe || "");
    } else {
      const fipeDecision = decideFipeForAd({
        last: ctx.agentState?.last_fipe,
        titulo: args?.titulo,
        versao: args?.versao,
        ano: args?.ano,
        suppliedFipe,
      });
      if (fipeDecision.action === "use_last") {
        args.fipe = fipeDecision.value;
        args.preco_referencia_label = "FIPE";
        args.preco_referencia_obs = fipeDecision.referenceMonth;
      } else if (fipeDecision.action === "confirm") {
        const pending: PendingFipeState = {
          stage: "ad_difference",
          args: { ...args },
          queriedValue: fipeDecision.queriedValue,
          suppliedValue: fipeDecision.suppliedValue,
          referenceMonth: fipeDecision.referenceMonth,
          created_at: new Date().toISOString(),
        };
        await persistFipeState(ctx, pending);
        return JSON.stringify({
          status: "fipe_divergente",
          mensagem:
            `A FIPE consultada (${fipeDecision.queriedValue}) difere mais de 5% do valor informado (${fipeDecision.suppliedValue}). Qual devo usar?`,
          interactive_buttons: {
            body: "Escolha o valor de referência:",
            buttons: [
              { id: "fipe_ad:queried", title: "Usar FIPE consultada" },
              { id: "fipe_ad:supplied", title: "Usar o meu valor" },
            ],
          },
        });
      }
    }

    if (shouldAskAmzAnuncioClient({
      tenantId: ctx.userId,
      amzTenantId: ADMIN_AMZ_USER_ID,
      clientName: args?.cliente,
      useTenantBrand: args?._usar_marca_tenant,
    })) {
      if (ctx.convId) {
        const conversation = {
          id: ctx.convId,
          userId: ctx.userId,
          contactNumber: ctx.fromNumber,
        };
        const current = ctx.agentState ?? await loadAgentState(sb, conversation);
        const pending = {
          args: { ...args },
          created_at: new Date().toISOString(),
        };
        await saveAgentState(
          sb,
          conversation,
          { pending_anuncio_cliente: pending },
          current,
        );
        current.pending_anuncio_cliente = pending;
        ctx.agentState = current;
      }
      return JSON.stringify({
        erro: "cliente_loja_necessario",
        mensagem: "Para qual loja é esse anúncio? Me mande o nome e o site da loja.",
        interactive_buttons: amzAnuncioClientButtons(),
      });
    }

    const formato = (args?.formato || "").toLowerCase() === "story" ? "story" : "feed";
    const anuncioIdentity = await resolveAnuncioClientIdentity({
      userId: ctx.userId,
      clientName: args?.cliente,
      site: args?.site,
      allowNameOnly: args?._usar_apenas_nome_cliente,
    });
    if (anuncioIdentity.mode === "missing") {
      if (ctx.userId === ADMIN_AMZ_USER_ID && ctx.convId) {
        const conversation = {
          id: ctx.convId,
          userId: ctx.userId,
          contactNumber: ctx.fromNumber,
        };
        const current = ctx.agentState ?? await loadAgentState(sb, conversation);
        const pending = {
          args: { ...args },
          created_at: new Date().toISOString(),
        };
        await saveAgentState(
          sb,
          conversation,
          { pending_anuncio_cliente: pending },
          current,
        );
        current.pending_anuncio_cliente = pending;
        ctx.agentState = current;
      }
      return JSON.stringify({
        erro: "identidade_cliente_ausente",
        mensagem: anuncioIdentity.message,
        ...(ctx.userId === ADMIN_AMZ_USER_ID
          ? { interactive_buttons: amzMissingClientLogoButtons() }
          : {}),
      });
    }
    const requestedStyle = ANUNCIO_STYLES.includes(args?.estilo as AnuncioStyle)
      ? args?.estilo as AnuncioStyle
      : null;
    const savedStyle = anuncioIdentity.mode === "client"
      ? savedClientAnuncioStyle(anuncioIdentity.identity)
      : await getTenantAnuncioStyle(sb, ctx.userId);
    const singleStyle = args?._mostrar_tres_estilos
      ? null
      : requestedStyle ?? savedStyle;

    // 1) FOTO — turno atual; senão, última foto recente da biblioteca (30 min)
    let fotoUrl: string | null = String(args?._foto_url_original || "").trim() ||
      null;
    const imgAtual = (ctx.media || []).slice().reverse().find((m) => m.kind === "image");
    if (imgAtual?.base64) {
      try {
        const bytes = base64Decode(imgAtual.base64);
        const mime = imgAtual.mime || "image/jpeg";
        const ext = mime.split("/")[1]?.split(";")[0] || "jpg";
        const fileName = `anuncios/${ctx.userId}/origem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await sb.storage.from("produtos").upload(fileName, bytes, { contentType: mime, upsert: true });
        if (!upErr) {
          const { data: pub } = sb.storage.from("produtos").getPublicUrl(fileName);
          fotoUrl = pub?.publicUrl ?? null;
        }
      } catch (e) {
        console.warn("[criar_anuncio] upload da foto do turno falhou:", (e as Error).message);
      }
    }
    if (!fotoUrl) {
      try {
        fotoUrl = await buscarFotoOriginalRecenteParaAnuncio(ctx);
      } catch (e) {
        console.warn("[criar_anuncio] fallback midias falhou:", (e as Error).message);
      }
    }
    if (!fotoUrl) {
      return JSON.stringify({
        erro: "sem_foto",
        mensagem: "Me mande a foto original do produto ou veículo para montar o anúncio.",
      });
    }

    const argumentPhotoPreference: AnuncioPhotoPreference | null =
      typeof args?.melhorar_foto === "boolean"
        ? (args.melhorar_foto ? "melhorada" : "original")
        : null;
    const savedPhotoPreference = argumentPhotoPreference
      ? null
      : await getTenantAnuncioPhotoPreference(sb, ctx.userId);
    const photoPreference = resolveAnuncioPhotoPreference({
      explicit: argumentPhotoPreference,
      saved: savedPhotoPreference,
    });
    if (!photoPreference) {
      if (!ctx.convId) {
        return JSON.stringify({
          erro: "preferencia_foto_necessaria",
          mensagem:
            "Como quer a foto do anúncio? Melhorar só muda fundo e luz; o veículo fica igual.",
          interactive_buttons: anuncioPhotoChoiceButtons(),
        });
      }
      const conversation = {
        id: ctx.convId,
        userId: ctx.userId,
        contactNumber: ctx.fromNumber,
      };
      const current = ctx.agentState ?? await loadAgentState(sb, conversation);
      const pendingPhoto = {
        stage: "choice" as const,
        args: { ...args, _foto_url_original: fotoUrl },
        created_at: new Date().toISOString(),
      };
      const saved = await saveAgentState(sb, conversation, {
        pending_anuncio_photo: pendingPhoto,
      }, current);
      if (!saved) {
        throw new Error("não consegui salvar a escolha pendente da foto");
      }
      current.pending_anuncio_photo = pendingPhoto;
      ctx.agentState = current;
      return JSON.stringify({
        status: "aguardando_preferencia_foto",
        mensagem:
          "Como quer a foto do anúncio? Melhorar só muda fundo e luz; o veículo fica igual.",
        interactive_buttons: anuncioPhotoChoiceButtons(),
      });
    }
    args.melhorar_foto = shouldImproveAnuncioPhoto(photoPreference);
    args._foto_resolvida = true;

    // 2) Guardrail simples de volume/dia
    try {
      const { count } = await sb
        .from("midias_whatsapp")
        .select("id", { count: "exact", head: true })
        .eq("user_id", ctx.userId)
        .eq("origem", "anuncio_produto")
        .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
      if ((count ?? 0) >= ANUNCIO_MAX_DIA) {
        return JSON.stringify({
          erro: "limite_diario_anuncio",
          mensagem: `Você já montou ${count} anúncios nas últimas 24h (limite ${ANUNCIO_MAX_DIA}).`,
        });
      }
    } catch { /* coluna origem pode não existir — guardrail é best-effort */ }

    // 3) IA melhora SÓ a foto (nada de texto na imagem)
    let fotoFinal = fotoUrl;
    let fotoSource: "improved" | "original" = "original";
    if (args?.melhorar_foto !== false) {
      try {
        const raw = await toolEditarImagem(
          productAdPhotoImprovementPrompt(titulo),
          {
            userId: ctx.userId,
            fromNumber: ctx.fromNumber,
            media: ctx.media,
            textos: [],
            modo: "anuncio",
            preservarAmbiente: false,
            registrarNaBiblioteca: false,
            imageInputUrl: fotoUrl,
          },
        );
        const parsed = JSON.parse(raw);
        if (parsed?.image_url) {
          fotoFinal = parsed.image_url;
          fotoSource = "improved";
          console.log("[criar_anuncio] melhoria da foto concluída; usando foto melhorada");
        } else {
          console.warn("[criar_anuncio] melhoria da foto falhou; usando original:", parsed?.erro);
        }
      } catch (e) {
        console.warn("[criar_anuncio] melhoria da foto lançou exceção; usando original:", (e as Error).message);
      }
    } else {
      console.log("[criar_anuncio] melhoria desativada; usando foto original");
    }
    console.log(`[criar_anuncio] foto selecionada=${fotoSource}`);
    const fotoBox = await detectarCaixaProdutoVisao(fotoFinal);
    console.log(
      `[criar_anuncio] foto_box=${
        fotoBox
          ? [fotoBox.ymin, fotoBox.xmin, fotoBox.ymax, fotoBox.xmax].join(",")
          : "ausente; usando contain"
      }`,
    );

    // 4) Identidade do tenant (nome do negócio / @ / telefone)
    let businessName: string | null = anuncioIdentity.businessName;
    let instagram = (args?.instagram || "").trim() || null;
    if (anuncioIdentity.mode === "tenant") try {
      const { data: conn } = await sb
        .from("meta_connections")
        .select("page_name, ig_username")
        .eq("user_id", ctx.userId)
        .eq("is_active", true)
        .maybeSingle();
      businessName = conn?.page_name ?? null;
      if (!instagram && conn?.ig_username) instagram = `@${String(conn.ig_username).replace(/^@/, "")}`;
    } catch { /* opcional */ }

    let telefone = (args?.telefone || "").trim() || null;
    if (!telefone) {
      try {
        const owner = await resolveTenantOwner(sb, ctx.userId);
        if (owner?.phone) {
          const d = String(owner.phone).replace(/\D/g, "").replace(/^55/, "");
          if (d.length >= 10) telefone = `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}`;
        }
      } catch { /* opcional */ }
    }

    const vehicleContent = buildVehicleAdContent(args);
    const itens = vehicleContent.highlights;
    const fallbackSubtitle = String(args?.subtitulo || "")
      .replace(String(args?.ano || ""), "")
      .replace(/\s*[•|,-]\s*$/, "")
      .trim() || null;
    const anuncioData: Record<string, unknown> = {
      titulo,
      subtitulo: vehicleContent.subtitle || fallbackSubtitle,
      versao: args?.versao,
      motor: args?.motor,
      cambio: args?.cambio,
      quilometragem: args?.quilometragem,
      cor: args?.cor,
      donos: args?.donos,
      documentacao: args?.documentacao,
      opcionais: args?.opcionais,
      revisoes: args?.revisoes,
      pneus: args?.pneus,
      condicoes: args?.condicoes,
      itens,
      ficha: vehicleContent.ficha,
      ano: args?.ano,
      preco: args?.preco,
      fipe: args?.fipe || (
        String(args?.preco_referencia_label || "").toUpperCase() === "FIPE"
          ? args?.preco_referencia
          : undefined
      ),
      preco_referencia: args?.preco_referencia,
      preco_referencia_label: args?.preco_referencia_label,
      preco_referencia_obs: args?.preco_referencia_obs,
      telefone,
      instagram,
    };

    // 5) RENDER — a foto é melhorada uma vez e reutilizada nos templates.
    const renderPayload: Record<string, unknown> = {
      user_id: ctx.userId,
      titulo,
      subtitulo: vehicleContent.subtitle || fallbackSubtitle,
      itens,
      ficha: vehicleContent.ficha,
      ano: args?.ano || null,
      preco: args?.preco || null,
      preco_label: args?.preco_label || null,
      preco_referencia: args?.preco_referencia || args?.fipe || null,
      preco_referencia_label: args?.preco_referencia_label ||
        (args?.fipe ? "FIPE" : null),
      preco_referencia_obs: args?.preco_referencia_obs || null,
      badge: args?.badge || null,
      telefone,
      instagram,
      business_name: businessName,
      logo_is_icon: anuncioIdentity.mode === "client"
        ? (() => {
          const ratio = Number(anuncioIdentity.identity.identity?.logo_aspect_ratio);
          return Number.isFinite(ratio) && ratio >= 0.8 && ratio <= 1.25;
        })()
        : false,
      logo_source: anuncioIdentity.mode,
      primary_color: anuncioIdentity.colors[1] || anuncioIdentity.colors[0] || undefined,
      accent_color: anuncioIdentity.colors[0] || undefined,
      foto_url: fotoFinal,
      foto_url_original: fotoUrl,
      foto_source: fotoSource,
      foto_box: fotoBox
        ? [fotoBox.ymin, fotoBox.xmin, fotoBox.ymax, fotoBox.xmax]
        : null,
      formato,
      incluir_logo: true,
    };
    const styles = singleStyle ? [singleStyle] : [...ANUNCIO_STYLES];
    const renders = await Promise.all(styles.map(async (style) => {
      const background = style === "catalogo" ? "light" : "dark";
      const logoPath = anuncioIdentity.mode === "client"
        ? clientLogoPath(anuncioIdentity.identity, background, true)
        : null;
      const render = await callEdge("render-anuncio-produto", {
        ...renderPayload,
        estilo: style,
        logo_path: logoPath,
      }, 120000);
      if (!render?.success || !render?.image_url) {
        throw new Error(String(render?.error || `falha no estilo ${style}`));
      }
      return { style, render };
    }));

    // 6) Salva todos os estilos na biblioteca.
    const savedMedia = await Promise.all(renders.map(async ({ style, render }) => {
      try {
        const { data: mid } = await sb.from("midias_whatsapp").insert({
          user_id: ctx.userId,
          telefone_origem: ctx.fromNumber,
          tipo: "foto",
          midia_url: render.image_url,
          contexto_original: `Anúncio ${style} ${formato}: ${titulo}`,
          origem: "anuncio_produto",
          status: "pendente",
        }).select("id").maybeSingle();
        return mid?.id ?? null;
      } catch (e) {
        console.warn("[criar_anuncio] salvar na biblioteca falhou:", (e as Error).message);
        return null;
      }
    }));

    if (requestedStyle) {
      if (anuncioIdentity.mode === "client") {
        await saveClientBrandIdentity(sb, {
          userId: ctx.userId,
          clientName: anuncioIdentity.businessName,
          identity: { preferred_ad_style: requestedStyle },
        });
      } else {
        await saveTenantAnuncioStyle(sb, ctx.userId, requestedStyle);
      }
    }

    if (ctx.convId) {
      const conversation = {
        id: ctx.convId,
        userId: ctx.userId,
        contactNumber: ctx.fromNumber,
      };
      const current = ctx.agentState ?? await loadAgentState(sb, conversation);
      const images = renders.map(({ style, render }, index) => ({
        style,
        formato,
        id: String(savedMedia[index] || ""),
        url: String(render.image_url),
      })) satisfies LastAnuncioImage[];
      const lastAnuncio: LastAnuncio = {
        images,
        selected_style: renders.length === 1 ? styles[0] : undefined,
        data: anuncioData,
        render_payload: renderPayload,
        client_name: args?.cliente || null,
        created_at: new Date().toISOString(),
      };
      const pending = {
        render_payload: renderPayload,
        source_args: {
          ...args,
          _foto_url_original: fotoUrl,
          _foto_resolvida: true,
          _mostrar_tres_estilos: true,
          _refazer_foto: false,
        },
        client_name: args?.cliente || null,
        shown_styles: styles,
        images,
        data: anuncioData,
        photo_preference_used: photoPreference,
        created_at: lastAnuncio.created_at,
      };
      const pendingPost: PendingAnuncioPost | null = renders.length === 1
        ? {
          stage: "action",
          created_at: lastAnuncio.created_at,
        }
        : null;
      const pendingPhoto = args?._refazer_foto
        ? {
          stage: "preference_confirmation" as const,
          preference: photoPreference,
          created_at: lastAnuncio.created_at,
        }
        : null;
      const stateSaved = await saveAgentState(sb, conversation, {
        pending_anuncio_styles: pending,
        last_anuncio: lastAnuncio,
        pending_anuncio_post: pendingPost,
        pending_anuncio_photo: pendingPhoto,
      }, current);
      if (!stateSaved) {
        throw new Error(
          "não consegui salvar o anúncio para continuar a escolha e publicação",
        );
      }
      current.pending_anuncio_styles = pending;
      current.last_anuncio = lastAnuncio;
      current.pending_anuncio_post = pendingPost;
      current.pending_anuncio_photo = pendingPhoto;
      ctx.agentState = current;
    }

    if (renders.length > 1) {
      await enviarPreviewEstilosAnuncio(ctx, renders);
      await sendWhatsApp(
        ctx.userId,
        ctx.fromNumber,
        "Preparei os três estilos com a mesma foto. Qual você prefere?",
        undefined,
        undefined,
        anuncioStyleButtons(),
        { alreadyLogged: false },
      );
    }
    const only = renders[0];

    return JSON.stringify({
      ok: true,
      image_url: renders.length === 1 ? only.render.image_url : undefined,
      image_urls: renders.map(({ render }) => render.image_url),
      estilos: styles,
      formato,
      logo_aplicada: renders.every(({ render }) => !!render.logo_aplicada),
      midia_id: renders.length === 1 ? savedMedia[0] : null,
      midia_ids: savedMedia.filter(Boolean),
      itens_usados: itens.length,
      mensagem: renders.length > 1
        ? args?._refazer_foto
          ? "Quer usar sempre assim?"
          : "Se quiser, também posso refazer usando a outra opção de foto."
        : anuncioSuccessMessage(),
      interactive_buttons: renders.length > 1
        ? args?._refazer_foto
          ? anuncioPhotoPreferenceConfirmationButtons(photoPreference)
          : anuncioPhotoRedoButtons(photoPreference)
        : anuncioPostActionButtons(),
    });
  } catch (e) {
    return JSON.stringify({ erro: String((e as Error).message).slice(0, 250) });
  }
}



// ============================================================
// FASE 4B.1 — ROTEAMENTO DETERMINÍSTICO DO CARROSSEL
// Roteamento determinístico do carrossel e de seus ajustes.
// ============================================================
export function isCarrosselRequest(text: string): boolean {
  const n = normalizePt(compactSpaces(text || ""));
  return /\bcarrosse(l|is)\b|\bcarousel\b|\b(?:card|slide)\s*1\b[\s\S]*\b(?:card|slide)\s*2\b|\bsequencia\s+de\s+(?:cards|slides|artes)\b/.test(n);
}

function isCarouselAdjustment(text: string): boolean {
  const n = normalizePt(compactSpaces(text || ""));
  return /\b(muda|mudar|troca|trocar|altera|alterar|ajusta|ajustar|corrige|corrigir|refaz|refazer)\b[\s\S]{0,120}\b(card|slide|texto|titulo|cor|fundo)\b|\b(card|slide)\s*\d+\b/.test(n);
}

function requestedFacebook(text: string): boolean {
  return /\b(facebook|face|fb|redes\s+sociais|todas?\s+as\s+redes|instagram\s+e\s+facebook|insta\s+e\s+face)\b/i.test(text || "");
}

function detectExplicitCarouselColor(text: string): string | undefined {
  const match = String(text || "").match(/\b(?:cor|fundo|destaque)\s*[:=-]?\s*(azul|verde|laranja|preto|dourado|roxo)\b/i);
  return match?.[1] && resolveCarouselColor(match[1]) ? match[1] : undefined;
}

// Extrai o tema do pedido, tirando o "faz um carrossel", o nº de páginas e o "posta no instagram".
function extractCarrosselTema(text: string): string {
  let t = compactSpaces(text || "").replace(/^jarvis[,.!\s-]*/i, "");
  const sobre = t.match(/\b(?:sobre|com o tema|de tema|falando de|falando sobre)\s+(.+)$/i);
  if (sobre?.[1]) t = sobre[1];
  else {
    t = t.replace(/^.*?\bcarrosse(?:l|is)\b/i, "").replace(/^.*?\bcarousel\b/i, "");
  }
  t = t
    .replace(/\b(para|pra|pro|no|na|em)\s+(o\s+|a\s+)?(instagram|insta|ig|facebook|face|fb|whatsapp|zap)\b/gi, " ")
    .replace(/\bcom\s+\d+\s*(paginas?|páginas?|cards?|slides?)\b/gi, " ")
    .replace(/\b\d+\s*(paginas?|páginas?|cards?|slides?)\b/gi, " ")
    .replace(/\b(posta|poste|postar|publica|publique|publicar|manda|mandar|envia|enviar)\b/gi, " ")
    .replace(/^[\s,.:;–—-]+|[\s,.:;–—-]+$/g, "");
  return compactSpaces(t);
}

// Resposta curta só com a cor ("Azul", "🟡 Dourado", "quero dourado")
function detectStandaloneCarrosselColor(text: string): string | null {
  const raw = compactSpaces(text || "");
  if (!raw || raw.length > 40) return null;
  return resolveCarouselColor(raw) ? raw : null;
}

function formatCarrosselToolResult(raw: string): string {
  let d: any = null;
  try { d = JSON.parse(raw); } catch { return raw; }
  if (d?.status === "aguardando_cor") {
    return d?.aviso_facebook
      ? `⚠️ ${d.aviso_facebook}<<SPLIT>>É só escolher a cor aí em cima 👆`
      : "É só escolher a cor aí em cima 👆";
  }
  if (d?.status === "aguardando_escolha_variante") return formatSocialPostToolResult(raw);
  if (d?.status === "demonstracao_carrossel") {
    return String(d.mensagem || "Carrossel de demonstração criado. Nada foi publicado.");
  }
  if (d?.status === "publicado") {
    const base = `✅ Carrossel de *${d.cards} cards* na cor *${d.cor}* publicado no seu Instagram!<<SPLIT>>Confere aqui: ${d.link_perfil}`;
    return d?.aviso_sem_contexto
      ? `${base}<<SPLIT>>💡 Dica: preencha *Sobre o meu negócio* em Configuração da Empresa — assim os próximos carrosséis falam do seu negócio de verdade, não só do tema.`
      : base;
  }
  if (d?.erro === "falha_ao_publicar") {
    return `Os cards ficaram prontos, mas o Instagram recusou a publicação (${d.detalhe ?? "erro"}). Quer que eu tente de novo?`;
  }
  if (d?.mensagem) return String(d.mensagem);
  if (d?.erro) return `Não consegui montar o carrossel: ${d.erro}`;
  return "Carrossel processado.";
}

function carouselToolResponse(raw: string): {
  text: string;
  interactiveButtons?: WhatsAppInteractiveButtons;
} {
  return {
    text: formatCarrosselToolResult(raw),
    interactiveButtons: interactiveButtonsFromSocialResult(raw),
  };
}

async function countProspectDemoMedia(
  userId: string,
  fromNumber: string,
  origin: "ia_whatsapp" | "carrossel_whatsapp",
): Promise<number> {
  const { count, error } = await sb.from("midias_whatsapp")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("telefone_origem", fromNumber)
    .eq("origem", origin);
  if (error) throw new Error(`demo_count_failed: ${error.message}`);
  return count ?? 0;
}

async function latestProspectDemoMedia(
  userId: string,
  fromNumber: string,
  toolName?: string,
): Promise<{ midia_url: string; created_at: string } | null> {
  const query = sb.from("midias_whatsapp")
    .select("midia_url, created_at")
    .eq("user_id", userId)
    .eq("telefone_origem", fromNumber)
    .order("created_at", { ascending: false })
    .limit(1);
  const scoped = toolName
    ? query.eq(
      "origem",
      toolName === "criar_carrossel"
        ? "carrossel_whatsapp"
        : "ia_whatsapp",
    )
    : query.in("origem", ["ia_whatsapp", "carrossel_whatsapp"]);
  const { data, error } = await scoped.maybeSingle();
  if (error) {
    console.warn("[demo-policy][latest_media_failed]", error.message);
    return null;
  }
  return data?.midia_url && data?.created_at
    ? { midia_url: data.midia_url, created_at: data.created_at }
    : null;
}

async function resolveCreativeToolDecision(
  name: string,
  ctx: { userId: string; fromNumber: string; demoTestPhones?: string[] },
): Promise<DemoToolDecision> {
  const owner = isOwner(ctx);
  const isAmzTenant = ctx.userId === ADMIN_AMZ_USER_ID;
  const exemptTestPhone = isAmzTenant
    && !owner
    && isDemoTestPhone(ctx.fromNumber, ctx.demoTestPhones);
  try {
    const generatedImages = !owner && isAmzTenant && !exemptTestPhone && name === "gerar_imagem"
      ? await countProspectDemoMedia(ctx.userId, ctx.fromNumber, "ia_whatsapp")
      : 0;
    const generatedCarousels = !owner && isAmzTenant && !exemptTestPhone && name === "criar_carrossel"
      ? await countProspectDemoMedia(ctx.userId, ctx.fromNumber, "carrossel_whatsapp")
      : 0;
    return decideWhatsAppCreativeTool({
      toolName: name,
      isOwner: owner,
      isAmzTenant,
      generatedImages,
      generatedCarousels,
    });
  } catch (error) {
    console.error("[demo-policy][count_failed]", error);
    return {
      allowed: false,
      reason: isAmzTenant ? "demo_restricted" : "tenant_restricted",
      message: isAmzTenant ? DEMO_LIMIT_MESSAGE : TENANT_CREATION_BLOCK_MESSAGE,
    };
  }
}

async function runTool(



  name: string,
  args: any,
  ctx: {
    userId: string;
    fromNumber: string;
    media?: MediaExtract[];
    convId?: string;
    agentState?: AgentConvState;
    demoTestPhones?: string[];
  },
): Promise<{
  result: string;
  imageUrl?: string;
  interactiveButtons?: WhatsAppInteractiveButtons;
  interactiveList?: WhatsAppInteractiveList;
}> {
  if (OWNER_ONLY_TOOL_NAMES.has(name) && !isOwner(ctx)) {
    return { result: "Essa ferramenta é restrita ao responsável da conta." };
  }
  if (AMZ_GLOBAL_TOOL_NAMES.has(name) && !hasAmzGlobalToolAccess(ctx)) {
    return { result: JSON.stringify({ erro: "ferramenta_restrita" }) };
  }
  const creativeDecision = await resolveCreativeToolDecision(name, ctx);
  if (!creativeDecision.allowed) {
    const previousDemo = creativeDecision.reason === "demo_limit"
      ? await latestProspectDemoMedia(ctx.userId, ctx.fromNumber, name)
      : null;
    const replay = demoLimitReplay(previousDemo);
    return {
      result: JSON.stringify({
        ok: false,
        status: "demonstracao_bloqueada",
        erro: creativeDecision.reason,
        mensagem: previousDemo
          ? replay.message
          : creativeDecision.message,
      }),
      imageUrl: replay.imageUrl,
    };
  }
  const demonstracao = creativeDecision.mode === "demo";
  const hasFreshLibraryMedia = (ctx.media ?? []).some((m) => m.kind === "image" || m.kind === "video");
  if (
    hasFreshLibraryMedia &&
    name !== "salvar_midia_biblioteca" &&
    name !== "encaminhar_recado_ao_dono" &&
    name !== "consultar_fipe"
  ) {
    console.warn(`[pietro][media_guard] bloqueando tool ${name}; mídia nova deve ir para /midias`);
    const result = await toolSalvarMidiaBiblioteca({ contexto: args?.contexto ?? args?.produto ?? args?.query ?? "" }, ctx);
    return { result };
  }

  if (name === "consultar_cnpj") return { result: await toolConsultarCnpj(args?.cnpj ?? "") };
  if (name === "consultar_fipe") {
    return await toolConsultarFipe(args ?? {}, ctx);
  }
  if (name === "pesquisar_web") return { result: await toolPesquisarWeb(args?.query ?? "", args?.recencia) };
  if (name === "buscar_lugares_proximos") return { result: await toolBuscarLugaresProximos(ctx, args?.query ?? "", args?.radius_meters) };
  if (name === "gerar_imagem") {
    const prepared = await prepareWhatsAppImageGeneration({
      prompt: args?.prompt ?? "",
      ctx,
      demonstracao,
      prospectSiteUrl: args?.site_url,
      prospectBrandColors: args?.brand_colors,
    });
    if (prepared.deferred) {
      return {
        result: JSON.stringify({ ok: false, status: "aguardando_escolha_marca", mensagem: prepared.text }),
        imageUrl: prepared.imageUrl,
        interactiveButtons: prepared.interactiveButtons,
      };
    }
    const r = prepared.raw;
    let parsed: any = {}; try { parsed = JSON.parse(r); } catch {}
    return { result: r, imageUrl: parsed?.image_url };
  }
  if (name === "editar_imagem") {
    const r = await toolEditarImagem(args?.prompt ?? "", {
      userId: ctx.userId,
      fromNumber: ctx.fromNumber,
      media: ctx.media,
      textos: Array.isArray(args?.textos) ? args.textos : [],
      modo: args?.modo,
      preservarAmbiente: typeof args?.preservar_ambiente === "boolean" ? args.preservar_ambiente : undefined,
    });

    let parsed: any = {}; try { parsed = JSON.parse(r); } catch {}
    return { result: r, imageUrl: parsed?.image_url };
  }
  if (name === "criar_video_animado") {
    return {
      result: await startVideoSetup(
        ctx,
        [args?.tema, args?.cores, args?.duracao, args?.estilo, args?.fundo ? `fundo ${args.fundo}` : ""].filter(Boolean).join(" "),
        {
          tema: String(args?.tema ?? ""),
          cores: String(args?.cores ?? ""),
          estilo: typeof args?.estilo === "string" ? args.estilo : null,
          duracao: typeof args?.duracao === "string" ? args.duracao : null,
          fundo: typeof args?.fundo === "string" ? args.fundo : null,
        },
      ),
    };
  }
  if (name === "consultar_clima") return { result: await toolConsultarClima(args?.local ?? "", ctx) };
  if (name === "cotacao_moeda") return { result: await toolCotacaoMoeda(args?.par ?? "") };
  if (name === "criar_lembrete") return { result: await toolCriarLembrete(args ?? {}, ctx) };
  if ((name === "listar_contatos_comerciais" || name === "enviar_mensagem_contato_comercial") && !isOwner(ctx)) {
    if (name === "enviar_mensagem_contato_comercial") {
      return {
        result: await toolEncaminharRecadoAoDono({
          recado: buildOwnerForwardMessage({
            ownerName: (await resolveTenantOwner(sb, ctx.userId)).name,
            fromNumber: ctx.fromNumber,
            pedido: args?.mensagem || args?.recado || "Cliente pediu contato/retorno do responsável.",
            messageType: "text",
          }),
          incluir_ultima_foto: !!args?.incluir_ultima_foto,
        }, ctx),
      };
    }
    return { result: JSON.stringify({ erro: "ferramenta_restrita_ao_dono", detalhe: "Cliente não lista contatos comerciais; encaminhe o pedido ao responsável do tenant." }) };
  }
  if (name === "listar_contatos_comerciais") return { result: await toolListarContatosComerciais(args ?? {}, ctx) };
  if (name === "enviar_mensagem_contato_comercial") return { result: await toolEnviarMensagemContatoComercial(args ?? {}, ctx) };
  if (name === "salvar_nota") return { result: await toolSalvarNota(args?.conteudo ?? "", args?.tags, ctx) };
  if (name === "buscar_notas") return { result: await toolBuscarNotas(args?.query ?? "", ctx) };
  if (name === "adicionar_tarefa") return { result: await toolAdicionarTarefa(args ?? {}, ctx) };
  if (name === "listar_tarefas") return { result: await toolListarTarefas(args?.status, ctx) };
  if (name === "concluir_tarefa") return { result: await toolConcluirTarefa(args?.id_ou_titulo ?? "", ctx) };
  if (name === "consultar_noticias") return { result: await toolConsultarNoticias(args?.tema ?? "") };
  if (name === "rastrear_correios") return { result: await toolRastrearCorreios(args?.codigo ?? "") };
  if (name === "calcular_rota") return { result: await toolCalcularRota(args?.origem ?? "", args?.destino ?? "", ctx) };
  if (name === "alterar_limite_mensal_anuncios") {
    return await toolProporLimiteMensalMetaAds(args?.novo_limite, ctx);
  }
  if (name === "relatorio_anuncios_meta") {
    return {
      result: await toolRelatorioAnunciosMeta(args?.periodo, ctx),
    };
  }
  if (name === "rascunho_anuncio_meta") {
    return { result: await toolRascunhoAnuncioMeta(args ?? {}, ctx) };
  }
  if (name === "publicar_anuncio_meta") {
    return { result: await toolPublicarAnuncioMeta(args ?? {}, ctx) };
  }
  if (name === "pausar_campanha_meta") {
    return {
      result: await toolAlterarStatusCampanhaMeta("PAUSED", args ?? {}, ctx),
    };
  }
  if (name === "ativar_campanha_meta") {
    return {
      result: await toolAlterarStatusCampanhaMeta("ACTIVE", args ?? {}, ctx),
    };
  }
  if (name === "status_campanha_meta") {
    return {
      result: await toolAlterarStatusCampanhaMeta(null, args ?? {}, ctx),
    };
  }
  if (name === "consultar_metricas_amz") return { result: await toolMetricasAmz(ctx) };
  if (name === "listar_inadimplentes_amz") return { result: await toolInadimplentesAmz(ctx) };
  if (name === "status_plataforma_amz") return { result: await toolStatusPlataforma(ctx) };
  if (name === "criar_cobranca_amz") return { result: await toolCriarCobrancaAmz(args ?? {}, ctx) };
  if (name === "ver_produto") return { result: await toolVerProduto(args ?? {}, ctx) };
  if (name === "entregar_ebook_presente") return { result: await toolEntregarEbook(ctx) };
  if (name === "consultar_estoque") return { result: await toolConsultarEstoque(args?.query ?? "", ctx) };
  if (name === "consultar_campanhas") return { result: await toolConsultarCampanhas(ctx) };
  if (name === "consultar_autopilot") return { result: await toolConsultarAutopilot(ctx) };
  if (name === "consultar_clientes_leads") return { result: await toolConsultarClientesLeads(ctx) };
  if (name === "resumo_plataforma") return { result: await toolResumoPlataforma(ctx) };
  if (name === "postar_redes_sociais") return { result: await toolPostarRedesSociais(args ?? {}, ctx) };
  if (name === "confirmar_postagem_redes") return { result: await toolConfirmarPostagemRedes(args ?? {}, ctx) };
  if (name === "agendar_post_pendente") return { result: await toolAgendarPostPendente(args ?? {}, ctx) };
  if (name === "listar_agendamentos_posts") return { result: await toolListarAgendamentosPosts(ctx) };
  if (name === "cancelar_agendamento_post") return { result: await toolCancelarAgendamentoPost(args ?? {}, ctx) };
  if (name === "remarcar_agendamento_post") return { result: await toolRemarcarAgendamentoPost(args ?? {}, ctx) };
  if (name === "revisar_post_pendente") return { result: await toolRevisarPostPendente(args ?? {}, ctx) };
  if (name === "escolher_variante_post") return { result: await toolEscolherVariantePost(args ?? {}, ctx) };
  if (name === "registrar_logo_cliente") return { result: await toolRegistrarLogoCliente(args ?? {}, ctx) };
  if (name === "salvar_midia_biblioteca") return { result: await toolSalvarMidiaBiblioteca(args ?? {}, ctx) };
  if (name === "postar_midia_biblioteca") return { result: await toolPostarMidiaBiblioteca(args ?? {}, ctx) };
  if (name === "criar_carrossel") {
    return { result: await toolCriarCarrossel(args ?? {}, { ...ctx, demonstracao }) };
  }
  if (name === "publicar_linkedin") return { result: await toolPrepararLinkedin(args ?? {}, ctx) };
  if (name === "criar_anuncio") {
    const r = await toolCriarAnuncio(args ?? {}, ctx);
    let parsed: any = {}; try { parsed = JSON.parse(r); } catch {}
    return {
      result: r,
      imageUrl: parsed?.image_url,
      interactiveButtons: parsed?.interactive_buttons,
    };
  }

  if (name === "encaminhar_recado_ao_dono") return { result: await toolEncaminharRecadoAoDono(args ?? {}, ctx) };
  if (name === "registrar_lead_novo") return { result: await toolRegistrarLeadNovo(args ?? {}, ctx) };


  return { result: JSON.stringify({ erro: `ferramenta ${name} não existe` }) };
}

function mensagemErroEdicaoImagem(parsed: any): string {
  const erro = String(parsed?.erro || "");
  if (erro === "sem_imagem") {
    return "Não encontrei uma imagem recente nesta conversa para editar. Envie a foto junto com o pedido de edição.";
  }
  if (erro === "sem_logo_cadastrada") {
    return "Não encontrei uma logo cadastrada para aplicar. Cadastre a marca ou envie o arquivo da logo.";
  }
  const explicacao = String(parsed?.instrucao || parsed?.motivo || parsed?.detalhe || "").trim();
  return explicacao
    ? `Não consegui concluir a edição: ${explicacao}`
    : "Não consegui concluir a edição da imagem desta vez.";
}


async function callGemini(
  systemPrompt: string,
  history: Array<{ role: string; content: string }>,
  userContent: any,
  hasMedia: boolean,
  toolCtx: {
    userId: string;
    fromNumber: string;
    media?: MediaExtract[];
    convId?: string;
    agentState?: AgentConvState;
    demoTestPhones?: string[];
  },
): Promise<{
  text: string;
  imageUrl?: string;
  forwardProof?: string;
  forwardAttempted?: boolean;
  interactiveList?: WhatsAppInteractiveList;
  interactiveButtons?: WhatsAppInteractiveButtons;
  metaAdsSummaryDraftId?: string;
}> {
  let forwardProof: string | undefined;
  let forwardAttempted = false;
  const senderIsOwner = isOwner(toolCtx);
  const senderIsAmzProspect = !senderIsOwner
    && toolCtx.userId === ADMIN_AMZ_USER_ID;
  const multimodalText = Array.isArray(userContent)
    ? userContent
      .filter((part: any) => part?.type === "text")
      .map((part: any) => String(part.text || ""))
      .join(" ")
    : "";
  if (hasMedia && senderIsOwner && /\bfipe\b/i.test(multimodalText)) {
    const response = await toolConsultarFipe(
      parseFipeRequestText(multimodalText),
      toolCtx,
    );
    return {
      text: response.result,
      interactiveList: response.interactiveList,
    };
  }
  if (hasMedia && senderIsOwner && toolCtx.agentState?.pending_fipe) {
    await persistFipeState(toolCtx, null);
  }
  const audioOnly = !!toolCtx.media?.length &&
    toolCtx.media.every((item) => item.kind === "audio");
  if (hasMedia && audioOnly && multimodalText) {
    const transcript = multimodalText.match(
      /TRANSCRIÇÃO DO ÁUDIO[^:]*:\s*"([\s\S]*)"\s*$/i,
    )?.[1]?.trim();
    // Áudio transcrito participa dos mesmos atalhos determinísticos do texto.
    // A mídia continua disponível no contexto caso o modelo seja necessário.
    userContent = transcript || multimodalText;
    hasMedia = false;
  }
  const nowSP = new Date().toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long", day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
  const timeHeader = `Data/hora atual em São Paulo: ${nowSP}. Use isto para resolver expressões como "hoje", "amanhã", "daqui a X min" ao chamar ferramentas de agendamento.`;
  const messages: any[] = [
    { role: "system", content: `${timeHeader}\n\n${systemPrompt}` },
    ...history,
    { role: "user", content: userContent },
  ];
  let restrictedNonOwnerCapabilityTurn = false;
  const deferRestrictedShortcutToModel = (shortcutDetected: boolean): boolean => {
    const guidance = nonOwnerCapabilityGuidance(
      senderIsOwner,
      shortcutDetected,
    );
    if (!guidance) return false;
    if (!restrictedNonOwnerCapabilityTurn) {
      messages[0].content = `${messages[0].content}\n\n${guidance}`;
      restrictedNonOwnerCapabilityTurn = true;
    }
    return true;
  };
  // Um anexo novo sempre inicia o fluxo daquela mídia; o modelo não pode
  // consumir um post pendente anterior no mesmo turno.
  let blockModelPendingTextActions = hasMedia;
  let modelPendingActionNotice = "";

  if (
    hasMedia &&
    isOwner(toolCtx) &&
    toolCtx.agentState?.pending_anuncio_photo &&
    toolCtx.convId
  ) {
    const conversation = {
      id: toolCtx.convId,
      userId: toolCtx.userId,
      contactNumber: toolCtx.fromNumber,
    };
    const current = toolCtx.agentState;
    await saveAgentState(sb, conversation, {
      pending_anuncio_photo: null,
    }, current);
    current.pending_anuncio_photo = null;
  }

  if (!hasMedia && typeof userContent === "string") {
    const remetenteEhDono = isOwner(toolCtx);
    if (remetenteEhDono && toolCtx.convId && toolCtx.agentState) {
      await clearExpiredAnuncioPendingState({
        id: toolCtx.convId,
        userId: toolCtx.userId,
        contactNumber: toolCtx.fromNumber,
      }, toolCtx.agentState);
    }
    const prospectAmz = !remetenteEhDono && toolCtx.userId === ADMIN_AMZ_USER_ID;
    const pendingCarousel = remetenteEhDono || prospectAmz ? toolCtx.agentState?.pending_carousel : null;
    const pendingVehicleCarousel = remetenteEhDono &&
        validPendingVehicleCarousel(
          toolCtx.agentState?.pending_carrossel_veiculo,
        )
      ? toolCtx.agentState!.pending_carrossel_veiculo!
      : null;
    const pendingVehiclePhotoBatch = remetenteEhDono &&
        validPendingVehiclePhotoBatch(
          toolCtx.agentState?.pending_vehicle_photo_batch,
        )
      ? toolCtx.agentState!.pending_vehicle_photo_batch!
      : null;
    const pendingVideoSetup = remetenteEhDono ? toolCtx.agentState?.pending_video_setup : null;
    const pendingAnuncioCliente = remetenteEhDono
      ? toolCtx.agentState?.pending_anuncio_cliente
      : null;
    const pendingCreativeMediaAmbiguity = remetenteEhDono
      ? toolCtx.agentState?.pending_creative_media_ambiguity
      : null;
    const pendingClientLogo = remetenteEhDono ? toolCtx.agentState?.pending_client_logo : null;
    const pendingClientLogoIntent = remetenteEhDono ? toolCtx.agentState?.pending_client_logo_intent : null;
    const pendingAnuncioStyles = remetenteEhDono
      ? toolCtx.agentState?.pending_anuncio_styles
      : null;
    const pendingAnuncioPhoto = remetenteEhDono
      ? toolCtx.agentState?.pending_anuncio_photo
      : null;
    const lastAnuncio = remetenteEhDono && validLastAnuncio(
        toolCtx.agentState?.last_anuncio,
      )
      ? toolCtx.agentState!.last_anuncio!
      : null;
    const pendingAnuncioPost = remetenteEhDono
      ? toolCtx.agentState?.pending_anuncio_post
      : null;
    const pendingBrandGeneration = remetenteEhDono ? toolCtx.agentState?.pending_brand_generation : null;
    const pendingFipe = remetenteEhDono
      ? toolCtx.agentState?.pending_fipe
      : null;
    const latestPendingSocial = remetenteEhDono
      ? await findLatestPendingSocialToken(toolCtx.userId, toolCtx.fromNumber)
      : null;
    const latestPendingSocialToken = latestPendingSocial?.token ?? null;
    const recentPendingSocialToken = latestPendingSocial
      && canUseAmbiguousPendingReply(latestPendingSocial.isRecent, hasMedia)
      ? latestPendingSocial.token
      : null;
    const latestPendingNotice = latestPendingSocial && latestPendingSocial.count > 1
      ? `Há mais de um post aguardando aprovação. Vou usar ${latestPendingSocial.description}, que é o mais recente.\n\n`
      : "";
    const explicitPendingNotice = latestPendingSocial
      ? `Vou usar ${latestPendingSocial.description}.\n\n`
      : "";
    const pendingVideoDraft = remetenteEhDono ? await buscarRascunhoVideo(toolCtx) : null;
    const normalizedInput = normalizePt(userContent);
    const brandInteractiveId = userContent.match(/<<INTERACTIVE_ID:(brand_[^>]+)>>/i)?.[1]?.toLowerCase() || "";
    const socialInteractiveId = userContent.match(/<<INTERACTIVE_ID:(social_[^>]+)>>/i)?.[1] || "";
    const anuncioPostInteractiveId = userContent.match(
      /<<INTERACTIVE_ID:(anuncio_post:[^>]+)>>/i,
    )?.[1]?.toLowerCase() || "";
    const anuncioPhotoInteractiveId = userContent.match(
      /<<INTERACTIVE_ID:(anuncio_photo(?::|_pref:)[^>]+)>>/i,
    )?.[1]?.toLowerCase() || "";
    const vehicleCarouselInteractiveId = userContent.match(
      /<<INTERACTIVE_ID:(vehicle_carousel:[^>]+)>>/i,
    )?.[1]?.toLowerCase() || "";
    const vehiclePhotoBatchInteractiveId = userContent.match(
      /<<INTERACTIVE_ID:(vehicle_photo_batch:[^>]+)>>/i,
    )?.[1]?.toLowerCase() || "";
    const socialActionInteractive = socialInteractiveId.match(/^social_(publish|publish_confirm|schedule):([a-f0-9]{8})$/i);
    const socialVariantInteractive = socialInteractiveId.match(/^social_variant:([ABC]):([a-f0-9]{8})$/i);
    const previousHistoryMessage = history.at(-1);
    const previousTurnAskedVideoTheme = previousHistoryMessage?.role === "assistant"
      && /\bqual e o tema do video\b/.test(
        normalizePt(String(previousHistoryMessage.content ?? "")),
      );
    const ownerMediaIntent = classifyOwnerMediaIntent(userContent);
    const explicitPendingCommand = classifyExplicitPendingPostCommand(userContent, hasMedia);
    const anyPendingInteractive = !!socialInteractiveId || !!tiktokInteractiveId(userContent);
    modelPendingActionNotice = explicitPendingCommand && latestPendingSocial
      ? `Vou usar ${latestPendingSocial.description}.\n\n`
      : "";
    blockModelPendingTextActions = !!latestPendingSocial
      && !latestPendingSocial.isRecent
      && !explicitPendingCommand
      && !anyPendingInteractive;

    // Fluxos pendentes têm prioridade sobre atalhos de texto e respostas
    // interativas. Assim, botões de vídeo/marca/social nunca viram por engano
    // um pedido avulso de cadastro de logo.
    if (pendingVideoDraft && isVideoCancellation(userContent)) {
      return { text: await confirmarRascunhoVideo(toolCtx, true) };
    }
    if (pendingVideoDraft && isVideoApproval(userContent)) {
      return { text: await confirmarRascunhoVideo(toolCtx) };
    }
    if (remetenteEhDono && isVideoMotionRedoRequest(userContent)) {
      return { text: await refazerVideoMotion(toolCtx, userContent) };
    }
    if (
      remetenteEhDono &&
      !pendingVehicleCarousel &&
      isVehiclePhotoCarouselTextRequest(userContent)
    ) {
      const recentPhotos = await recentWhatsAppVehiclePhotos({
        userId: toolCtx.userId,
        fromNumber: toolCtx.fromNumber,
        windowMs: 3 * 60 * 1000,
      });
      const state = await startVehicleCarouselFlow(
        toolCtx,
        recentPhotos,
        recentPhotos.length ? "texto_com_fotos_recentes" : "texto_explicito",
      );
      return {
        text: state.photos.length
          ? `Recebi ${vehiclePhotoCountLabel(state.photos.length)}. Manda mais ou toque em Pronto.`
          : "Me manda até 8 fotos do veículo. Quando terminar, toque em Pronto.",
        interactiveButtons: vehicleCarouselCollectionButtons(),
      };
    }
    if (remetenteEhDono && !pendingVehicleCarousel) {
      console.log("[carrossel] gatilho=não motivo=texto_sem_pedido");
    }
    if (
      remetenteEhDono &&
      pendingVehiclePhotoBatch &&
      vehiclePhotoBatchInteractiveId === "vehicle_photo_batch:carousel"
    ) {
      const state = await startVehicleCarouselFlow(
        toolCtx,
        pendingVehiclePhotoBatch.photos,
        "botao_lote_fotos",
      );
      return {
        text:
          `Recebi ${vehiclePhotoCountLabel(state.photos.length)}. Manda mais ou toque em Pronto.`,
        interactiveButtons: vehicleCarouselCollectionButtons(),
      };
    }
    if (
      remetenteEhDono &&
      pendingVehiclePhotoBatch &&
      vehiclePhotoBatchInteractiveId === "vehicle_photo_batch:ad"
    ) {
      const firstPhoto = pendingVehiclePhotoBatch.photos[0];
      if (toolCtx.convId) {
        const conversation = {
          id: toolCtx.convId,
          userId: toolCtx.userId,
          contactNumber: toolCtx.fromNumber,
        };
        const current = toolCtx.agentState!;
        const interaction = firstPhoto
          ? { media_id: firstPhoto.id, at: new Date().toISOString() }
          : undefined;
        await saveAgentState(sb, conversation, {
          pending_vehicle_photo_batch: null,
          ...(interaction ? { last_media_interaction: interaction } : {}),
        }, current);
        current.pending_vehicle_photo_batch = null;
        if (interaction) current.last_media_interaction = interaction;
      }
      return {
        text:
          "Vou usar a primeira foto. Me mande modelo, ano, preço e os outros dados que quiser mostrar no anúncio.",
      };
    }
    if (
      remetenteEhDono &&
      pendingVehiclePhotoBatch &&
      vehiclePhotoBatchInteractiveId === "vehicle_photo_batch:none"
    ) {
      await persistVehiclePhotoBatch(toolCtx, null);
      return { text: "Certo. As fotos ficaram salvas na biblioteca." };
    }
    if (
      remetenteEhDono &&
      pendingVehicleCarousel &&
      vehicleCarouselInteractiveId === "vehicle_carousel:cancel"
    ) {
      if (pendingVehicleCarousel.token) {
        await toolConfirmarPostagemRedes({
          token: pendingVehicleCarousel.token,
          cancelar: true,
        }, toolCtx);
      }
      await persistVehicleCarousel(toolCtx, null);
      return { text: "Carrossel cancelado." };
    }
    if (
      remetenteEhDono &&
      pendingVehicleCarousel?.stage === "collecting" &&
      vehicleCarouselInteractiveId === "vehicle_carousel:photos:add"
    ) {
      return {
        text: "Pode mandar as fotos. Quando terminar, toque em Pronto.",
        interactiveButtons: vehicleCarouselCollectionButtons(),
      };
    }
    if (
      remetenteEhDono &&
      pendingVehicleCarousel?.stage === "collecting" &&
      vehicleCarouselInteractiveId === "vehicle_carousel:photos:done"
    ) {
      if (!hasEnoughVehicleCarouselPhotos(pendingVehicleCarousel.photos.length)) {
        const needMore = vehicleCarouselNeedMoreButtons(
          pendingVehicleCarousel.photos.length,
        );
        return {
          text: needMore.body,
          interactiveButtons: needMore,
        };
      }
      return await askVehicleCarouselData(pendingVehicleCarousel, toolCtx);
    }
    if (
      remetenteEhDono &&
      pendingVehicleCarousel?.stage === "data_choice" &&
      vehicleCarouselInteractiveId === "vehicle_carousel:data:last"
    ) {
      const next = {
        ...pendingVehicleCarousel,
        data: pendingVehicleCarousel.suggested_data || {},
        suggested_data: undefined,
        created_at: new Date().toISOString(),
      };
      return await askVehicleCarouselPhotoOrFormat(next, toolCtx);
    }
    if (
      remetenteEhDono &&
      pendingVehicleCarousel?.stage === "data_choice" &&
      vehicleCarouselInteractiveId === "vehicle_carousel:data:new"
    ) {
      const next = {
        ...pendingVehicleCarousel,
        stage: "awaiting_data" as const,
        suggested_data: undefined,
        created_at: new Date().toISOString(),
      };
      await persistVehicleCarousel(toolCtx, next);
      return {
        text:
          "Me mande em uma mensagem os dados que tiver: modelo, ano, km, câmbio, preço, condições e contato. O que não informar não aparece.",
      };
    }
    if (
      remetenteEhDono &&
      pendingVehicleCarousel?.stage === "awaiting_data" &&
      !vehicleCarouselInteractiveId &&
      hasVehicleCarouselData(userContent)
    ) {
      const data = parseVehicleCarouselData(userContent);
      const next = {
        ...pendingVehicleCarousel,
        data,
        created_at: new Date().toISOString(),
      };
      return await askVehicleCarouselPhotoOrFormat(next, toolCtx);
    }
    const vehiclePhotoChoice = vehicleCarouselInteractiveId.match(
      /^vehicle_carousel:photo:(melhorada|original)$/,
    )?.[1] as AnuncioPhotoPreference | undefined;
    if (
      remetenteEhDono &&
      pendingVehicleCarousel?.stage === "photo_choice" &&
      vehiclePhotoChoice
    ) {
      const next = {
        ...pendingVehicleCarousel,
        stage: "format_choice" as const,
        photo_preference: vehiclePhotoChoice,
        created_at: new Date().toISOString(),
      };
      await persistVehicleCarousel(toolCtx, next);
      return {
        text: "Qual formato do carrossel?",
        interactiveButtons: vehicleCarouselFormatButtons(),
      };
    }
    const vehicleFormat = vehicleCarouselInteractiveId.match(
      /^vehicle_carousel:format:(portrait|square)$/,
    )?.[1] as "portrait" | "square" | undefined;
    if (
      remetenteEhDono &&
      pendingVehicleCarousel?.stage === "format_choice" &&
      vehicleFormat
    ) {
      try {
        return await renderVehicleCarousel({
          ...pendingVehicleCarousel,
          format: vehicleFormat,
        }, toolCtx);
      } catch (error) {
        await persistVehicleCarousel(toolCtx, null);
        return {
          text:
            `Não consegui montar o carrossel: ${(error as Error).message}.`,
        };
      }
    }
    if (
      remetenteEhDono &&
      pendingVehicleCarousel?.stage === "delivered" &&
      vehicleCarouselInteractiveId === "vehicle_carousel:deliver"
    ) {
      if (pendingVehicleCarousel.image_urls?.length) {
        await enviarPreviewCarrossel(
          toolCtx,
          pendingVehicleCarousel.image_urls,
        );
      }
      await persistVehicleCarousel(toolCtx, null);
      return {
        text:
          `Álbum pronto para encaminhar.${pendingVehicleCarousel.caption ? `\n\n${pendingVehicleCarousel.caption}` : ""}`,
      };
    }
    if (
      remetenteEhDono &&
      pendingVehicleCarousel?.stage === "delivered" &&
      vehicleCarouselInteractiveId === "vehicle_carousel:save"
    ) {
      await persistVehicleCarousel(toolCtx, null);
      return { text: "Salvei o carrossel na biblioteca. Nada foi publicado." };
    }
    if (
      remetenteEhDono &&
      pendingVehicleCarousel?.stage === "delivered" &&
      vehicleCarouselInteractiveId === "vehicle_carousel:publish"
    ) {
      const connected = await connectedAnuncioNetworks(toolCtx.userId);
      if (!connected.length) {
        return { text: "Não encontrei Facebook nem Instagram conectados." };
      }
      const next = {
        ...pendingVehicleCarousel,
        stage: "network_choice" as const,
        created_at: new Date().toISOString(),
      };
      await persistVehicleCarousel(toolCtx, next);
      return {
        text: "Em quais redes?",
        interactiveButtons: vehicleCarouselNetworkButtons(connected),
      };
    }
    const vehicleNetworks = vehicleCarouselInteractiveId.match(
      /^vehicle_carousel:networks:(both|instagram|facebook)$/,
    )?.[1];
    if (
      remetenteEhDono &&
      pendingVehicleCarousel?.stage === "network_choice" &&
      vehicleNetworks
    ) {
      const connected = await connectedAnuncioNetworks(toolCtx.userId);
      const requested: AnuncioPostNetwork[] = vehicleNetworks === "both"
        ? ["facebook", "instagram"]
        : [vehicleNetworks as AnuncioPostNetwork];
      const networks = requested.filter((network) =>
        connected.includes(network)
      );
      const raw = await prepareVehicleCarouselSocial(
        pendingVehicleCarousel,
        networks,
        toolCtx,
      );
      return {
        text: formatSocialPostToolResult(raw),
        interactiveButtons: interactiveButtonsFromSocialResult(raw),
      };
    }
    if (
      remetenteEhDono &&
      pendingVehicleCarousel?.stage === "caption_choice" &&
      pendingVehicleCarousel.token &&
      socialVariantInteractive?.[2]?.toLowerCase() ===
        pendingVehicleCarousel.token
    ) {
      const option = socialVariantInteractive[1].toUpperCase() as
        | "A"
        | "B"
        | "C";
      const selected = await toolEscolherVariantePost({
        token: pendingVehicleCarousel.token,
        opcao: option,
      }, toolCtx);
      const parsed = JSON.parse(selected);
      if (parsed?.status !== "variante_selecionada") {
        return { text: formatSocialPostToolResult(selected) };
      }
      const next = {
        ...pendingVehicleCarousel,
        stage: "approval" as const,
        created_at: new Date().toISOString(),
      };
      await persistVehicleCarousel(toolCtx, next);
      return {
        text:
          `Resumo: carrossel de *${pendingVehicleCarousel.data?.titulo || "veículo"}*, ${pendingVehicleCarousel.image_urls?.length || 0} páginas, ${parsed?.preview ? Object.keys(parsed.preview).join(" + ") : "redes selecionadas"}, legenda *Opção ${option}*. Nada foi publicado ainda.`,
        interactiveButtons: {
          body: "Revise e confirme:",
          buttons: [
            {
              id:
                `vehicle_carousel:confirm:${pendingVehicleCarousel.token}`,
              title: "Publicar",
            },
            {
              id: `vehicle_carousel:cancel:${pendingVehicleCarousel.token}`,
              title: "Cancelar",
            },
          ],
        },
      };
    }
    const vehiclePublishAction = vehicleCarouselInteractiveId.match(
      /^vehicle_carousel:(confirm|cancel):([a-f0-9]{8})$/,
    );
    if (
      remetenteEhDono &&
      pendingVehicleCarousel?.stage === "approval" &&
      pendingVehicleCarousel.token &&
      vehiclePublishAction?.[2] === pendingVehicleCarousel.token
    ) {
      const result = await toolConfirmarPostagemRedes({
        token: pendingVehicleCarousel.token,
        cancelar: vehiclePublishAction[1] === "cancel",
      }, toolCtx);
      await persistVehicleCarousel(toolCtx, null);
      return { text: formatSocialPostToolResult(result) };
    }
    if (
      remetenteEhDono &&
      pendingVehicleCarousel &&
      !vehicleCarouselInteractiveId
    ) {
      // Texto de outro assunto abandona o fluxo sem insistir.
      await persistVehicleCarousel(toolCtx, null);
    }
    if (
      remetenteEhDono &&
      pendingVehiclePhotoBatch &&
      !vehiclePhotoBatchInteractiveId
    ) {
      // A oferta automática também não prende a conversa.
      await persistVehiclePhotoBatch(toolCtx, null);
    }
    const anuncioPhotoRedo = anuncioPhotoInteractiveId.match(
      /^anuncio_photo:redo:(melhorada|original)$/,
    )?.[1] as AnuncioPhotoPreference | undefined;
    if (
      remetenteEhDono &&
      anuncioPhotoRedo &&
      pendingAnuncioStyles?.source_args
    ) {
      const age = Date.now() -
        new Date(pendingAnuncioStyles.created_at).getTime();
      if (!Number.isFinite(age) || age > 2 * 60 * 60 * 1000) {
        return {
          text:
            "Esse anúncio não está mais disponível para refazer. Envie a foto e os dados novamente.",
        };
      }
      const raw = await toolCriarAnuncio({
        ...pendingAnuncioStyles.source_args,
        melhorar_foto: shouldImproveAnuncioPhoto(anuncioPhotoRedo),
        _foto_resolvida: true,
        _mostrar_tres_estilos: true,
        _refazer_foto: true,
        estilo: undefined,
      } as any, {
        ...toolCtx,
        media: [],
      });
      let parsed: any = {};
      try {
        parsed = JSON.parse(raw);
      } catch {
        return { text: raw };
      }
      return {
        text: String(
          parsed?.mensagem || "Não consegui refazer o anúncio.",
        ),
        imageUrl: parsed?.image_url,
        interactiveButtons: parsed?.interactive_buttons,
      };
    }
    const anuncioPhotoChoice = anuncioPhotoInteractiveId.match(
      /^anuncio_photo:(melhorada|original)$/,
    )?.[1] as AnuncioPhotoPreference | undefined;
    if (
      remetenteEhDono &&
      anuncioPhotoChoice &&
      pendingAnuncioPhoto?.stage === "choice" &&
      pendingAnuncioPhoto.args
    ) {
      const age = Date.now() -
        new Date(pendingAnuncioPhoto.created_at).getTime();
      if (!Number.isFinite(age) || age > 2 * 60 * 60 * 1000) {
        return {
          text:
            "Essa escolha expirou. Envie a foto e os dados do anúncio novamente.",
        };
      }
      await saveTenantAnuncioPhotoPreference(
        sb,
        toolCtx.userId,
        anuncioPhotoChoice,
      );
      if (toolCtx.convId) {
        const conversation = {
          id: toolCtx.convId,
          userId: toolCtx.userId,
          contactNumber: toolCtx.fromNumber,
        };
        const current = toolCtx.agentState ??
          await loadAgentState(sb, conversation);
        const saved = await saveAgentState(sb, conversation, {
          pending_anuncio_photo: null,
        }, current);
        if (!saved) {
          return {
            text:
              "Salvei sua preferência, mas não consegui retomar esse anúncio. Envie o pedido novamente.",
          };
        }
        current.pending_anuncio_photo = null;
        toolCtx.agentState = current;
      }
      const raw = await toolCriarAnuncio({
        ...pendingAnuncioPhoto.args,
        melhorar_foto: shouldImproveAnuncioPhoto(anuncioPhotoChoice),
        _foto_resolvida: true,
      } as any, toolCtx);
      let parsed: any = {};
      try {
        parsed = JSON.parse(raw);
      } catch {
        return { text: raw };
      }
      return {
        text: String(
          parsed?.mensagem || "Não consegui concluir o anúncio.",
        ),
        imageUrl: parsed?.image_url,
        interactiveButtons: parsed?.interactive_buttons,
      };
    }
    const anuncioPhotoAlways = anuncioPhotoInteractiveId.match(
      /^anuncio_photo_pref:always:(melhorada|original)$/,
    )?.[1] as AnuncioPhotoPreference | undefined;
    const anuncioPhotoOnce =
      anuncioPhotoInteractiveId === "anuncio_photo_pref:once";
    if (
      remetenteEhDono &&
      pendingAnuncioPhoto?.stage === "preference_confirmation" &&
      (anuncioPhotoAlways || anuncioPhotoOnce)
    ) {
      if (anuncioPhotoAlways) {
        await saveTenantAnuncioPhotoPreference(
          sb,
          toolCtx.userId,
          anuncioPhotoAlways,
        );
      }
      if (toolCtx.convId) {
        const conversation = {
          id: toolCtx.convId,
          userId: toolCtx.userId,
          contactNumber: toolCtx.fromNumber,
        };
        const current = toolCtx.agentState ??
          await loadAgentState(sb, conversation);
        const saved = await saveAgentState(sb, conversation, {
          pending_anuncio_photo: null,
        }, current);
        if (!saved) {
          return {
            text:
              "Não consegui concluir essa escolha agora. Tente novamente.",
          };
        }
        current.pending_anuncio_photo = null;
        toolCtx.agentState = current;
      }
      return {
        text: anuncioPhotoAlways
          ? `Certo — vou usar a foto ${anuncioPhotoAlways} nos próximos anúncios.`
          : "Certo — usei assim só desta vez e mantive sua preferência anterior.",
      };
    }
    if (
      remetenteEhDono &&
      pendingAnuncioPhoto &&
      !anuncioPhotoInteractiveId
    ) {
      // A pergunta da foto não sequestra outro assunto.
      if (toolCtx.convId) {
        const conversation = {
          id: toolCtx.convId,
          userId: toolCtx.userId,
          contactNumber: toolCtx.fromNumber,
        };
        const current = toolCtx.agentState ??
          await loadAgentState(sb, conversation);
        await saveAgentState(sb, conversation, {
          pending_anuncio_photo: null,
        }, current);
        current.pending_anuncio_photo = null;
        toolCtx.agentState = current;
      }
    }
    if (pendingFipe) {
      const age = Date.now() - new Date(pendingFipe.created_at).getTime();
      const fipeInteractiveId = userContent.match(
        /<<INTERACTIVE_ID:(fipe_(?:model|year):\d+|fipe_ad:(?:queried|supplied))>>/i,
      )?.[1]?.toLowerCase();
      if (!Number.isFinite(age) || age > 30 * 60 * 1000) {
        await persistFipeState(toolCtx, null);
      } else if (pendingFipe.stage === "model" && fipeInteractiveId) {
        const index = Number(fipeInteractiveId.match(/^fipe_model:(\d+)$/)?.[1]);
        const model = pendingFipe.models[index];
        if (model) {
          try {
            const response = await continueFipeWithModel(toolCtx, {
              brand: pendingFipe.brand,
              model,
              queryModel: pendingFipe.queryModel,
              requestedYear: pendingFipe.requestedYear,
              requestedFuel: pendingFipe.requestedFuel,
            });
            return {
              text: response.result,
              interactiveList: response.interactiveList,
            };
          } catch (error) {
            console.warn("[fipe][model-choice]", (error as Error).message);
            await persistFipeState(toolCtx, null);
            return {
              text:
                "Não consegui consultar a FIPE agora. Tente de novo em alguns minutos.",
            };
          }
        }
      } else if (pendingFipe.stage === "year" && fipeInteractiveId) {
        const index = Number(fipeInteractiveId.match(/^fipe_year:(\d+)$/)?.[1]);
        const year = pendingFipe.years[index];
        if (year) {
          try {
            const response = await finishFipeLookup(toolCtx, {
              brand: pendingFipe.brand,
              model: pendingFipe.model,
              year,
              queryModel: pendingFipe.queryModel,
            });
            return { text: response.result };
          } catch (error) {
            console.warn("[fipe][year-choice]", (error as Error).message);
            await persistFipeState(toolCtx, null);
            return {
              text:
                "Não consegui consultar a FIPE agora. Tente de novo em alguns minutos.",
            };
          }
        }
      } else if (
        pendingFipe.stage === "photo_confirmation" &&
        /\b(?:19|20)\d{2}\b/.test(userContent)
      ) {
        const year = userContent.match(/\b(?:19|20)\d{2}\b/)?.[0];
        const version = compactSpaces(
          userContent
            .replace(/<<INTERACTIVE_ID:[^>]+>>/gi, "")
            .replace(/\b(?:19|20)\d{2}\b/g, " ")
            .replace(/^(?:sim|confirma|confirmo|modelo|ano|vers[aã]o)\b[\s:,-]*/i, ""),
        );
        const response = await toolConsultarFipe({
          marca: pendingFipe.brand,
          modelo: pendingFipe.model,
          versao: version || undefined,
          ano_modelo: year,
        }, toolCtx);
        return {
          text: response.result,
          interactiveList: response.interactiveList,
        };
      } else if (
        pendingFipe.stage === "photo_confirmation" &&
        /\b(?:sim|confirma|confirmo|fipe|vers[aã]o|ano|modelo)\b/i.test(userContent)
      ) {
        return {
          text: "Qual é o ano/modelo e a versão? Pela foto eu não afirmo o ano exato.",
        };
      } else if (
        pendingFipe.stage === "ad_difference" &&
        fipeInteractiveId?.startsWith("fipe_ad:")
      ) {
        const choice = fipeInteractiveId.endsWith(":queried")
          ? "queried"
          : "supplied";
        const resumedArgs = {
          ...pendingFipe.args,
          _fipe_choice: choice,
        };
        await persistFipeState(toolCtx, null);
        const raw = await toolCriarAnuncio(resumedArgs as any, toolCtx);
        let parsed: any = {};
        try {
          parsed = JSON.parse(raw);
        } catch {
          return { text: raw };
        }
        return {
          text: String(parsed?.mensagem || "Não consegui concluir o anúncio."),
          imageUrl: parsed?.image_url,
          interactiveButtons: parsed?.interactive_buttons,
        };
      } else {
        // A FIPE não sequestra a conversa: qualquer assunto diferente abandona
        // silenciosamente a seleção pendente e segue o roteamento normal.
        await persistFipeState(toolCtx, null);
      }
    }
    const anuncioStyleInteractive = userContent.match(
      /<<INTERACTIVE_ID:anuncio_style:(impacto|catalogo|destaque)>>/i,
    )?.[1]?.toLowerCase() as AnuncioStyle | undefined;
    const wantsOtherAnuncioStyles =
      /<<INTERACTIVE_ID:anuncio_other_styles>>/i.test(userContent);
    if (anuncioStyleInteractive && pendingAnuncioStyles) {
      const client = pendingAnuncioStyles.client_name
        ? await findClientBrandIdentity(sb, toolCtx.userId, {
          name: pendingAnuncioStyles.client_name,
        })
        : null;
      if (client) {
        await saveClientBrandIdentity(sb, {
          userId: toolCtx.userId,
          clientName: client.client_name,
          identity: { preferred_ad_style: anuncioStyleInteractive },
        });
      } else {
        await saveTenantAnuncioStyle(
          sb,
          toolCtx.userId,
          anuncioStyleInteractive,
        );
      }
      const selectedImage = pendingAnuncioStyles.images?.find((image) =>
        image.style === anuncioStyleInteractive
      );
      const lastAnuncio: LastAnuncio = {
        images: pendingAnuncioStyles.images ?? [],
        selected_style: anuncioStyleInteractive,
        data: pendingAnuncioStyles.data ?? {},
        render_payload: pendingAnuncioStyles.render_payload,
        client_name: pendingAnuncioStyles.client_name,
        created_at: pendingAnuncioStyles.created_at,
      };
      const pendingPost: PendingAnuncioPost = {
        stage: "action",
        created_at: new Date().toISOString(),
      };
      await persistAnuncioFlowState(toolCtx, {
        last_anuncio: lastAnuncio,
        pending_anuncio_post: pendingPost,
      });
      if (selectedImage?.id) {
        await rememberLastMediaInteraction(toolCtx, selectedImage.id);
      }
      return {
        text: `${anuncioSuccessMessage()} Salvei *${anuncioStyleInteractive}* como seu estilo preferido.`,
        interactiveButtons: anuncioPostActionButtons(),
      };
    }
    if (wantsOtherAnuncioStyles && pendingAnuncioStyles) {
      const age = Date.now() -
        new Date(pendingAnuncioStyles.created_at).getTime();
      if (Number.isFinite(age) && age <= 2 * 60 * 60 * 1000) {
        const preferred = pendingAnuncioStyles.shown_styles[0];
        const styles = pendingAnuncioStyles.shown_styles.length === 1
          ? otherAnuncioStyles(preferred)
          : ANUNCIO_STYLES;
        const client = pendingAnuncioStyles.client_name
          ? await findClientBrandIdentity(sb, toolCtx.userId, {
            name: pendingAnuncioStyles.client_name,
          })
          : null;
        const renders = await Promise.all(styles.map(async (style) => {
          const logoPath = client
            ? clientLogoPath(
              client,
              style === "catalogo" ? "light" : "dark",
              true,
            )
            : null;
          const render = await callEdge("render-anuncio-produto", {
            ...pendingAnuncioStyles.render_payload,
            estilo: style,
            logo_path: logoPath,
          }, 120000);
          return { style, render };
        }));
        const urls = renders.map(({ render }) => render?.image_url).filter(Boolean);
        if (urls.length === styles.length) {
          await enviarPreviewEstilosAnuncio(
            toolCtx,
            renders as Array<{
              style: AnuncioStyle;
              render: { image_url: string };
            }>,
          );
          return {
            text: "Aqui estão os outros estilos. Qual você prefere?",
            interactiveButtons: {
              body: "Qual você prefere?",
              buttons: styles.map((style) => ({
                id: `anuncio_style:${style}`,
                title: style === "catalogo"
                  ? "Catálogo"
                  : style[0].toUpperCase() + style.slice(1),
              })),
            },
          };
        }
      }
      return { text: "Esse anúncio não está mais disponível para comparar. Me envie o pedido novamente." };
    }
    if (remetenteEhDono && anuncioPostInteractiveId && lastAnuncio) {
      const action = anuncioPostInteractiveId.match(
        /^anuncio_post:action:(publish|schedule|save)$/,
      )?.[1] as "publish" | "schedule" | "save" | undefined;
      if (action === "save") {
        await persistAnuncioFlowState(toolCtx, {
          last_anuncio: lastAnuncio,
          pending_anuncio_post: null,
        });
        return { text: "Salvei o anúncio. Quando quiser publicar, é só pedir usando o estilo escolhido." };
      }
      if (action === "publish" || action === "schedule") {
        const next: PendingAnuncioPost = {
          stage: "format",
          action,
          created_at: new Date().toISOString(),
        };
        await persistAnuncioFlowState(toolCtx, {
          last_anuncio: lastAnuncio,
          pending_anuncio_post: next,
        });
        return {
          text: action === "publish"
            ? "Certo. Onde você quer publicar?"
            : "Certo. Qual formato você quer agendar?",
          interactiveButtons: anuncioPostFormatButtons(action === "schedule"),
        };
      }

      const format = anuncioPostInteractiveId.match(
        /^anuncio_post:format:(feed|story|feed_story)$/,
      )?.[1] as "feed" | "story" | "feed_story" | undefined;
      if (format && pendingAnuncioPost?.action) {
        if (pendingAnuncioPost.action === "schedule" && format !== "feed") {
          return {
            text:
              "Story ainda não pode ser agendado pelo WhatsApp. Para agendar, escolha Feed; para Story, use Publicar agora.",
            interactiveButtons: anuncioPostFormatButtons(true),
          };
        }
        const connected = await connectedAnuncioNetworks(toolCtx.userId);
        if (!connected.length) {
          await persistAnuncioFlowState(toolCtx, {
            last_anuncio: lastAnuncio,
            pending_anuncio_post: null,
          });
          return { text: "Não encontrei Facebook nem Instagram conectados nessa conta." };
        }
        const next: PendingAnuncioPost = {
          ...pendingAnuncioPost,
          stage: "networks",
          format,
          created_at: new Date().toISOString(),
        };
        await persistAnuncioFlowState(toolCtx, {
          last_anuncio: lastAnuncio,
          pending_anuncio_post: next,
        });
        return {
          text: "Agora escolha as redes.",
          interactiveButtons: anuncioPostNetworkButtons(connected),
        };
      }

      const networkChoice = anuncioPostInteractiveId.match(
        /^anuncio_post:networks:(both|instagram|facebook)$/,
      )?.[1];
      if (
        networkChoice &&
        pendingAnuncioPost?.action &&
        pendingAnuncioPost.format
      ) {
        const connected = await connectedAnuncioNetworks(toolCtx.userId);
        const requested: AnuncioPostNetwork[] = networkChoice === "both"
          ? ["facebook", "instagram"]
          : [networkChoice as AnuncioPostNetwork];
        const networks = requested.filter((network) =>
          connected.includes(network)
        );
        if (!networks.length) {
          return { text: "Essa rede não está conectada. Escolha uma das redes disponíveis." };
        }
        try {
          const prepared = await prepareAnuncioSocialPosts({
            last: lastAnuncio,
            action: pendingAnuncioPost.action === "schedule"
              ? "schedule"
              : "publish",
            format: pendingAnuncioPost.format,
            networks,
            ctx: toolCtx,
          });
          return await deliverAnuncioCaptionChoices(prepared.raw, toolCtx);
        } catch (error) {
          return { text: `Não consegui preparar a publicação: ${(error as Error).message}. Nada foi publicado.` };
        }
      }
    }
    if (pendingAnuncioCliente) {
      const interactiveId = userContent.match(
        /<<INTERACTIVE_ID:(anuncio_(?:use_amz|other_store|send_client_logo))>>/i,
      )?.[1]?.toLowerCase();
      const age = Date.now() -
        new Date(pendingAnuncioCliente.created_at).getTime();
      if (!Number.isFinite(age) || age > 2 * 60 * 60 * 1000) {
        if (toolCtx.convId) {
          await saveAgentState(
            sb,
            {
              id: toolCtx.convId,
              userId: toolCtx.userId,
              contactNumber: toolCtx.fromNumber,
            },
            { pending_anuncio_cliente: null },
            toolCtx.agentState ?? {},
          );
        }
        return {
          text: "Esse pedido de anúncio expirou. Envie a foto e os dados novamente.",
        };
      }
      if (interactiveId === "anuncio_other_store") {
        if (toolCtx.convId) {
          const nextPending = {
            ...pendingAnuncioCliente,
            awaiting_store_details: true,
          };
          await saveAgentState(
            sb,
            {
              id: toolCtx.convId,
              userId: toolCtx.userId,
              contactNumber: toolCtx.fromNumber,
            },
            { pending_anuncio_cliente: nextPending },
            toolCtx.agentState ?? {},
          );
          if (toolCtx.agentState) {
            toolCtx.agentState.pending_anuncio_cliente = nextPending;
          }
        }
        return {
          text: "Me mande o nome e o site da loja.",
        };
      }
      if (interactiveId === "anuncio_send_client_logo") {
        const clientName = compactSpaces(
          String(pendingAnuncioCliente.args.cliente || ""),
        ).slice(0, 100);
        if (toolCtx.convId && clientName) {
          const pendingIntent = {
            client_name: clientName,
            created_at: new Date().toISOString(),
            variant: "default" as const,
            anuncio_args: { ...pendingAnuncioCliente.args },
          };
          await saveAgentState(
            sb,
            {
              id: toolCtx.convId,
              userId: toolCtx.userId,
              contactNumber: toolCtx.fromNumber,
            },
            {
              pending_anuncio_cliente: null,
              pending_client_logo_intent: pendingIntent,
            },
            toolCtx.agentState ?? {},
          );
          if (toolCtx.agentState) {
            toolCtx.agentState.pending_anuncio_cliente = null;
            toolCtx.agentState.pending_client_logo_intent = pendingIntent;
          }
          return {
            text: `Envie agora a logo de ${clientName} em PNG, JPEG ou WEBP.`,
          };
        }
        return {
          text: "Envie a logo dizendo o nome da loja, por exemplo: “salva essa como logo do cliente Loja X”.",
        };
      }
      const plainStoreReply = compactSpaces(
        userContent.replace(/<<INTERACTIVE_ID:[^>]+>>/gi, ""),
      ).replace(/^[\s:,-]+|[\s:,-]+$/g, "");
      const site = extractPublicSiteUrl(userContent);
      const storeReply = classifyStoreReply({
        text: plainStoreReply,
        site,
        storedName: pendingAnuncioCliente.store_name,
        askedSite: pendingAnuncioCliente.asked_site,
      });
      const declinedSite = storeReply.action === "name_only";
      if (
        pendingAnuncioCliente.awaiting_store_details &&
        storeReply.action === "ask_site" &&
        !interactiveId
      ) {
        const storeName = storeReply.name;
        if (storeName.length >= 2 && toolCtx.convId) {
          const nextPending = {
            ...pendingAnuncioCliente,
            store_name: storeName,
            asked_site: true,
          };
          await saveAgentState(
            sb,
            {
              id: toolCtx.convId,
              userId: toolCtx.userId,
              contactNumber: toolCtx.fromNumber,
            },
            { pending_anuncio_cliente: nextPending },
            toolCtx.agentState ?? {},
          );
          if (toolCtx.agentState) {
            toolCtx.agentState.pending_anuncio_cliente = nextPending;
          }
          return {
            text: "Tem site? Se tiver, me mande o link. Se não tiver, responda 'não' que eu uso só o nome.",
          };
        }
      }
      if (interactiveId || site || declinedSite) {
        let clientName = storeReply.action === "site"
          ? storeReply.name || ""
          : storeReply.action === "name_only"
          ? storeReply.name
          : pendingAnuncioCliente.store_name || "";
        if (site && clientName.length < 2) {
          try {
            const siteIdentity = await fetchBrandSiteIdentity(site);
            clientName = storeNameFromSite(site, siteIdentity.brand_name);
          } catch {
            clientName = storeNameFromSite(site);
          }
        }
        if (toolCtx.convId) {
          await saveAgentState(
            sb,
            {
              id: toolCtx.convId,
              userId: toolCtx.userId,
              contactNumber: toolCtx.fromNumber,
            },
            { pending_anuncio_cliente: null },
            toolCtx.agentState ?? {},
          );
          if (toolCtx.agentState) toolCtx.agentState.pending_anuncio_cliente = null;
        }
        const mergedArgs = {
          ...pendingAnuncioCliente.args,
          ...(interactiveId === "anuncio_use_amz"
            ? {
              cliente: undefined,
              site: undefined,
              _usar_marca_tenant: true,
            }
            : { cliente: clientName, site }),
          ...(declinedSite
            ? {
              cliente: pendingAnuncioCliente.store_name,
              site: undefined,
              _usar_apenas_nome_cliente: true,
            }
            : {}),
        };
        const result = await toolCriarAnuncio(mergedArgs as any, {
          ...toolCtx,
          media: [],
        });
        let parsed: any = {};
        try {
          parsed = JSON.parse(result);
        } catch {
          return { text: result };
        }
        return {
          text: String(parsed?.mensagem || "Não consegui concluir o anúncio."),
          imageUrl: parsed?.image_url,
          interactiveButtons: parsed?.interactive_buttons,
        };
      }
    }
    if (pendingVideoSetup) {
      const videoInteractiveId = extractVideoInteractiveId(userContent);
      if (videoInteractiveId === "video_pending_continue") {
        const resumed = { ...pendingVideoSetup, interrupted_request: undefined };
        await persistVideoSetup(toolCtx, resumed);
        return { text: await resumePendingVideoSetup(toolCtx, resumed) };
      }
      if (
        videoInteractiveId === "video_pending_replace" &&
        pendingVideoSetup.interrupted_request
      ) {
        const deferredRequest = pendingVideoSetup.interrupted_request;
        await persistVideoSetup(toolCtx, null);
        return await callGemini(systemPrompt, history, deferredRequest, false, {
          ...toolCtx,
          agentState: { ...toolCtx.agentState, pending_video_setup: null },
        });
      }
      if (isClearlyDifferentFromPendingVideo(userContent)) {
        const interrupted = { ...pendingVideoSetup, interrupted_request: userContent };
        await persistVideoSetup(toolCtx, interrupted);
        return {
          text: "Você ainda tem um vídeo em andamento. Quer continuar ou cancelar esse rascunho e fazer o novo pedido?",
          interactiveButtons: pendingVideoInterruptionButtons(),
        };
      }
      return { text: await handlePendingVideoSetup(toolCtx, pendingVideoSetup, userContent) };
    }
    const mediaChoiceId = userContent.match(
      /<<INTERACTIVE_ID:(creative_media_(?:video|image))>>/i,
    )?.[1]?.toLowerCase();
    if (pendingCreativeMediaAmbiguity && mediaChoiceId) {
      const age = Date.now() -
        new Date(pendingCreativeMediaAmbiguity.created_at).getTime();
      const original = pendingCreativeMediaAmbiguity.original_request;
      const conversation = toolCtx.convId
        ? { id: toolCtx.convId, userId: toolCtx.userId, contactNumber: toolCtx.fromNumber }
        : null;
      if (conversation) {
        await saveAgentState(
          sb,
          conversation,
          { pending_creative_media_ambiguity: null },
          toolCtx.agentState ?? {},
        );
      }
      if (!Number.isFinite(age) || age > 2 * 60 * 60 * 1000) {
        return { text: "Essa escolha expirou. Envie o pedido novamente." };
      }
      const clarified = mediaChoiceId.endsWith("video")
        ? `Crie um vídeo. Pedido original: ${original}`
        : `Crie uma imagem/arte. Pedido original: ${original}`;
      return await callGemini(systemPrompt, history, clarified, false, {
        ...toolCtx,
        agentState: {
          ...toolCtx.agentState,
          pending_creative_media_ambiguity: null,
        },
      });
    }
    if (
      remetenteEhDono &&
      classifyCreativeMediaRequest(userContent) === "ambiguous"
    ) {
      const pending = {
        original_request: userContent,
        created_at: new Date().toISOString(),
      };
      const conversation = toolCtx.convId
        ? { id: toolCtx.convId, userId: toolCtx.userId, contactNumber: toolCtx.fromNumber }
        : null;
      if (conversation) {
        await saveAgentState(
          sb,
          conversation,
          { pending_creative_media_ambiguity: pending },
          toolCtx.agentState ?? {},
        );
      }
      return {
        text: "Você quer criar um vídeo ou uma imagem/arte?",
        interactiveButtons: {
          body: "Escolha o formato para eu seguir com o pedido.",
          buttons: [
            { id: "creative_media_video", title: "Vídeo" },
            { id: "creative_media_image", title: "Imagem/arte" },
          ],
        },
      };
    }
    if (!remetenteEhDono && isVideoMotionRequest(userContent)) {
      deferRestrictedShortcutToModel(true);
    }
    if (
      remetenteEhDono
      && (previousTurnAskedVideoTheme || shouldStartVideoSetup(userContent))
    ) {
      const previousVideoRequest = previousTurnAskedVideoTheme
        && history.at(-2)?.role === "user"
        ? String(history.at(-2)?.content ?? "")
        : "";
      return {
        text: await startVideoSetup(
          toolCtx,
          `${previousVideoRequest}\n${userContent}`.trim(),
        ),
      };
    }
    if (pendingClientLogoIntent && isVideoCancellation(userContent)) {
      const conversation = toolCtx.convId
        ? { id: toolCtx.convId, userId: toolCtx.userId, contactNumber: toolCtx.fromNumber }
        : null;
      if (conversation) {
        await saveAgentState(sb, conversation, {
          pending_client_logo_intent: null,
        }, toolCtx.agentState ?? {});
      }
      return { text: "Cadastro da logo cancelado." };
    }

    if (remetenteEhDono && pendingBrandGeneration) {
      const conversation = toolCtx.convId
        ? { id: toolCtx.convId, userId: toolCtx.userId, contactNumber: toolCtx.fromNumber }
        : null;
      let brandReply = classifyPendingBrandReply({
        stage: pendingBrandGeneration.stage,
        text: userContent,
        interactiveId: brandInteractiveId,
        createdAt: pendingBrandGeneration.created_at,
      });
      if (brandReply.action === "expired" || brandReply.action === "continue_conversation") {
        if (pendingBrandGeneration.logo_candidate_path) {
          await sb.storage.from("tenant-logos").remove([
            pendingBrandGeneration.logo_candidate_path,
          ]);
        }
        if (conversation) {
          await saveAgentState(sb, conversation, { pending_brand_generation: null }, toolCtx.agentState ?? {});
        }
        if (toolCtx.agentState) toolCtx.agentState.pending_brand_generation = null;
        console.log("[whatsapp-brand] pendência descartada; seguindo conversa", {
          reason: brandReply.action,
          stage: pendingBrandGeneration.stage,
        });
        if (brandReply.action === "expired") {
          return { text: "Esse pedido de imagem expirou. Envie o pedido novamente para eu continuar." };
        }
      } else if (brandReply.action === "choose_none") {
        if (conversation) {
          await saveAgentState(sb, conversation, {
            pending_brand_generation: null,
          }, toolCtx.agentState ?? {});
        }
        const raw = await toolGerarImagem(pendingBrandGeneration.prompt, {
          userId: toolCtx.userId,
          fromNumber: toolCtx.fromNumber,
          incluirLogo: false,
          references: pendingBrandGeneration.reference_urls,
        });
        return await completePendingBrandGeneration(raw, pendingBrandGeneration, toolCtx, true);
      } else if (brandReply.action === "choose_logo") {
        const assets = await loadTenantBrandAssets(sb, toolCtx.userId);
        if (!assets.logoDataUrl) {
          const next = { ...pendingBrandGeneration, stage: "awaiting_logo_upload" as const };
          if (conversation) {
            await saveAgentState(sb, conversation, { pending_brand_generation: next }, toolCtx.agentState ?? {});
            toolCtx.agentState!.pending_brand_generation = next;
          }
          return { text: "Envie a imagem da sua logo (PNG, de preferência com fundo transparente)." };
        }
        if (conversation) {
          await saveAgentState(sb, conversation, { pending_brand_generation: null }, toolCtx.agentState ?? {});
        }
        const raw = await toolGerarImagem(pendingBrandGeneration.prompt, {
          userId: toolCtx.userId,
          fromNumber: toolCtx.fromNumber,
          incluirLogo: true,
          references: pendingBrandGeneration.reference_urls,
        });
        return await completePendingBrandGeneration(raw, pendingBrandGeneration, toolCtx);
      } else if (brandReply.action === "choose_site") {
        const next = {
          ...pendingBrandGeneration,
          stage: "awaiting_site_url" as const,
        };
        if (conversation) {
          await saveAgentState(sb, conversation, { pending_brand_generation: next }, toolCtx.agentState ?? {});
          toolCtx.agentState!.pending_brand_generation = next;
        }
        return { text: "Envie o link de qualquer site para eu usar a identidade visual nesta imagem." };
      }
      if (brandReply.action === "site_url") {
        try {
          const identity = await fetchBrandSiteIdentity(brandReply.url);
          if (conversation) {
            await saveAgentState(sb, conversation, {
              pending_brand_generation: null,
            }, toolCtx.agentState ?? {});
          }
          const siteBrand = whatsAppSiteBrandGenerationOptions(identity);
          const raw = await toolGerarImagem(pendingBrandGeneration.prompt, {
            userId: toolCtx.userId,
            fromNumber: toolCtx.fromNumber,
            references: pendingBrandGeneration.reference_urls,
            ...siteBrand,
          });
          return await completePendingBrandGeneration(
            raw,
            pendingBrandGeneration,
            toolCtx,
          );
        } catch (error) {
          console.error("[whatsapp-brand-site] leitura falhou:", error instanceof Error ? error.message : String(error));
          return { text: SITE_IDENTITY_READ_FAILURE_MESSAGE };
        }
      } else if (
        brandReply.action === "save_uploaded_logo"
        || brandReply.action === "use_uploaded_logo_once"
      ) {
        const candidatePath = pendingBrandGeneration.logo_candidate_path;
        const candidateMime = pendingBrandGeneration.logo_candidate_mime || "image/png";
        const logoDataUrl = candidatePath
          ? await temporaryBrandLogoDataUrl(candidatePath, candidateMime)
          : null;
        if (!candidatePath || !logoDataUrl) {
          if (conversation) {
            await saveAgentState(sb, conversation, { pending_brand_generation: null }, toolCtx.agentState ?? {});
          }
          return { text: "Não consegui recuperar essa logo. Envie o pedido de imagem novamente." };
        }
        let saved = false;
        if (brandReply.action === "save_uploaded_logo") {
          const extension = candidatePath.split(".").pop() || "png";
          saved = await setTenantLogo(sb, toolCtx.userId, {
            storagePath: candidatePath,
            fileName: `logo-whatsapp.${extension}`,
            mimeType: candidateMime,
            variant: detectLogoVariantRequest(
              pendingBrandGeneration.original_request ||
                pendingBrandGeneration.prompt,
            ) ?? "default",
          });
          if (!saved) {
            return { text: "Não consegui salvar essa logo com segurança. Seu cadastro não foi alterado." };
          }
        }
        if (conversation) {
          await saveAgentState(sb, conversation, { pending_brand_generation: null }, toolCtx.agentState ?? {});
        }
        const raw = await toolGerarImagem(pendingBrandGeneration.prompt, {
          userId: toolCtx.userId,
          fromNumber: toolCtx.fromNumber,
          incluirLogo: true,
          logoDataUrl,
          references: pendingBrandGeneration.reference_urls,
        });
        if (!saved) {
          await sb.storage.from("tenant-logos").remove([candidatePath]);
        }
        const completed = await completePendingBrandGeneration(
          raw,
          pendingBrandGeneration,
          toolCtx,
        );
        completed.text = saved
          ? `Salvei a logo com sua confirmação.\n\n${completed.text}`
          : `Usei a logo somente nesta imagem e não alterei seu cadastro.\n\n${completed.text}`;
        return completed;
      }
    }

    if (remetenteEhDono && /\bmeus agendamentos\b/.test(normalizedInput)) {
      const result = await toolListarAgendamentosPosts(toolCtx);
      return { text: formatSocialPostToolResult(result) };
    }
    if (remetenteEhDono && /\bcancelar agendamento\b/.test(normalizedInput)) {
      const explicitToken = userContent.match(/\b[a-f0-9]{8}\b/i)?.[0];
      const result = await toolCancelarAgendamentoPost({ token: explicitToken }, toolCtx);
      const parsed = JSON.parse(result);
      return { text: String(parsed?.mensagem || "Não consegui cancelar o agendamento.") };
    }
    const standaloneScheduleToken = userContent.trim().match(/^[a-f0-9]{8}$/i)?.[0]?.toLowerCase();
    if (remetenteEhDono && standaloneScheduleToken) {
      const groups = await loadScheduledSocialGroups(toolCtx.userId).catch(() => []);
      if (groups.some((group) => group.token.toLowerCase() === standaloneScheduleToken)) {
        const result = await toolCancelarAgendamentoPost({ token: standaloneScheduleToken }, toolCtx);
        const parsed = JSON.parse(result);
        return { text: String(parsed?.mensagem || "Não consegui cancelar o agendamento.") };
      }
    }
    const anuncioPostTokens = pendingAnuncioPost?.token
      ? [
        pendingAnuncioPost.token,
        ...(pendingAnuncioPost.extra_tokens ?? []),
      ]
      : [];
    if (
      remetenteEhDono &&
      lastAnuncio &&
      pendingAnuncioPost &&
      anuncioPostInteractiveId === "anuncio_post:caption:regenerate" &&
      anuncioPostTokens.length
    ) {
      const captions = generateVehicleAdCaptions(lastAnuncio.data, Date.now());
      try {
        await replaceAnuncioPendingCaptions(
          anuncioPostTokens,
          captions,
          toolCtx,
        );
        const primary = PENDING_POSTS.get(anuncioPostTokens[0]);
        const raw = JSON.stringify({
          status: "aguardando_escolha_variante",
          token: anuncioPostTokens[0],
          formato: primary?.formato || "feed",
          redes: primary?.redes || pendingAnuncioPost.networks,
          variantes: primary?.variantes,
        });
        return await deliverAnuncioCaptionChoices(raw, toolCtx);
      } catch (error) {
        return { text: `Não consegui gerar outras opções: ${(error as Error).message}.` };
      }
    }
    if (
      remetenteEhDono &&
      lastAnuncio &&
      pendingAnuncioPost &&
      anuncioPostInteractiveId === "anuncio_post:caption:custom" &&
      anuncioPostTokens.length
    ) {
      const next = {
        ...pendingAnuncioPost,
        stage: "custom_caption" as const,
        created_at: new Date().toISOString(),
      };
      await persistAnuncioFlowState(toolCtx, {
        last_anuncio: lastAnuncio,
        pending_anuncio_post: next,
      });
      return { text: "Escreva a legenda exatamente como quer publicar." };
    }
    if (
      remetenteEhDono &&
      lastAnuncio &&
      pendingAnuncioPost?.stage === "custom_caption" &&
      anuncioPostTokens.length &&
      !anuncioPostInteractiveId
    ) {
      const caption = compactSpaces(userContent);
      if (caption.length < 2) {
        return { text: "Escreva a legenda que você quer usar." };
      }
      try {
        await replaceAnuncioPendingCaptions(
          anuncioPostTokens,
          { A: caption.slice(0, 600), B: caption.slice(0, 600), C: caption.slice(0, 600) },
          toolCtx,
          "A",
        );
        if (pendingAnuncioPost.action === "schedule") {
          const next = {
            ...pendingAnuncioPost,
            stage: "schedule_time" as const,
            selected_option: "personalizada" as const,
            created_at: new Date().toISOString(),
          };
          await persistAnuncioFlowState(toolCtx, {
            last_anuncio: lastAnuncio,
            pending_anuncio_post: next,
          });
          return {
            text: "Legenda salva. Para quando? Informe o dia/mês e a hora. Ex.: 30/09 às 10h.",
            interactiveButtons: anuncioScheduleTimeButtons(
              anuncioPostTokens[0],
            ),
          };
        }
        const next = {
          ...pendingAnuncioPost,
          stage: "approval" as const,
          selected_option: "personalizada" as const,
          created_at: new Date().toISOString(),
        };
        await persistAnuncioFlowState(toolCtx, {
          last_anuncio: lastAnuncio,
          pending_anuncio_post: next,
        });
        return {
          text: anuncioPostSummary(lastAnuncio, next, "personalizada"),
          interactiveButtons: anuncioFinalApprovalButtons(anuncioPostTokens[0]),
        };
      } catch (error) {
        return { text: `Não consegui salvar essa legenda: ${(error as Error).message}.` };
      }
    }
    const anuncioScheduleConfirm = anuncioPostInteractiveId.match(
      /^anuncio_post:schedule_confirm:([a-f0-9]{8})$/,
    );
    if (
      remetenteEhDono &&
      lastAnuncio &&
      pendingAnuncioPost?.stage === "schedule_approval" &&
      pendingAnuncioPost.scheduled_at &&
      anuncioScheduleConfirm &&
      anuncioPostTokens.includes(anuncioScheduleConfirm[1])
    ) {
      const loaded = await Promise.all(anuncioPostTokens.map((token) =>
        loadPendingSocialPost(token, toolCtx.userId)
      ));
      if (
        loaded.some((post) =>
          !post ||
          post.formato !== "feed" ||
          !canRunSocialPostAction(post.variantSelecionada)
        )
      ) {
        return {
          text:
            "Não consegui validar todos os itens desse agendamento. Nada foi agendado.",
        };
      }
      const results: string[] = [];
      for (const token of anuncioPostTokens) {
        results.push(await toolAgendarPostPendente({
          token,
          data_hora_sp: pendingAnuncioPost.scheduled_at,
        }, toolCtx));
      }
      const allScheduled = results.every((result) => {
        try {
          return JSON.parse(result)?.status === "agendado";
        } catch {
          return false;
        }
      });
      if (allScheduled) {
        await persistAnuncioFlowState(toolCtx, {
          last_anuncio: lastAnuncio,
          pending_anuncio_post: null,
        });
      }
      return {
        text: results.map(formatSocialPostToolResult).join("<<SPLIT>>"),
        ...(!allScheduled
          ? {
            interactiveButtons: anuncioScheduleApprovalButtons(
              anuncioPostTokens[0],
            ),
          }
          : {}),
      };
    }
    const anuncioConfirm = anuncioPostInteractiveId.match(
      /^anuncio_post:(confirm|cancel):([a-f0-9]{8})$/,
    );
    if (
      remetenteEhDono &&
      lastAnuncio &&
      pendingAnuncioPost &&
      anuncioConfirm &&
      anuncioPostTokens.includes(anuncioConfirm[2])
    ) {
      const cancel = anuncioConfirm[1] === "cancel";
      const results: string[] = [];
      for (const token of anuncioPostTokens) {
        results.push(await toolConfirmarPostagemRedes({
          token,
          cancelar: cancel,
        }, toolCtx));
      }
      await persistAnuncioFlowState(toolCtx, {
        last_anuncio: lastAnuncio,
        pending_anuncio_post: null,
      });
      if (cancel) return { text: "Publicação cancelada. Nada foi enviado." };
      return {
        text: results.map(formatSocialPostToolResult).join("<<SPLIT>>"),
      };
    }
    if (
      remetenteEhDono &&
      lastAnuncio &&
      pendingAnuncioPost?.stage === "schedule_time" &&
      anuncioPostTokens.length &&
      !anuncioPostInteractiveId
    ) {
      const dateText = userContent.replace(/<<INTERACTIVE_ID:[^>]+>>/gi, "").trim();
      if (parseSaoPauloDateTime(dateText)) {
        const next = {
          ...pendingAnuncioPost,
          stage: "schedule_approval" as const,
          scheduled_at: dateText,
          created_at: new Date().toISOString(),
        };
        await persistAnuncioFlowState(toolCtx, {
          last_anuncio: lastAnuncio,
          pending_anuncio_post: next,
        });
        return {
          text: anuncioPostSummary(
            lastAnuncio,
            next,
            pendingAnuncioPost.selected_option || "selecionada",
          ),
          interactiveButtons: anuncioScheduleApprovalButtons(
            anuncioPostTokens[0],
          ),
        };
      }
      return {
        text:
          "Não entendi a data. Informe dia/mês e hora, por exemplo: 30/09 às 10h.",
        interactiveButtons: anuncioScheduleTimeButtons(anuncioPostTokens[0]),
      };
    }
    if (
      remetenteEhDono &&
      lastAnuncio &&
      pendingAnuncioPost &&
      socialVariantInteractive &&
      anuncioPostTokens.includes(socialVariantInteractive[2].toLowerCase())
    ) {
      const option = socialVariantInteractive[1].toUpperCase() as "A" | "B" | "C";
      for (const token of anuncioPostTokens) {
        await toolEscolherVariantePost({ token, opcao: option }, toolCtx);
      }
      if (pendingAnuncioPost.action === "schedule") {
        const next = {
          ...pendingAnuncioPost,
          stage: "schedule_time" as const,
          selected_option: option,
          created_at: new Date().toISOString(),
        };
        await persistAnuncioFlowState(toolCtx, {
          last_anuncio: lastAnuncio,
          pending_anuncio_post: next,
        });
        return {
          text: `Opção ${option} selecionada. Para quando? Informe o dia/mês e a hora. Ex.: 30/09 às 10h.`,
          interactiveButtons: anuncioScheduleTimeButtons(
            anuncioPostTokens[0],
          ),
        };
      }
      const next = {
        ...pendingAnuncioPost,
        stage: "approval" as const,
        selected_option: option,
        created_at: new Date().toISOString(),
      };
      await persistAnuncioFlowState(toolCtx, {
        last_anuncio: lastAnuncio,
        pending_anuncio_post: next,
      });
      return {
        text: anuncioPostSummary(lastAnuncio, next, option),
        interactiveButtons: anuncioFinalApprovalButtons(anuncioPostTokens[0]),
      };
    }
    if (remetenteEhDono && lastAnuncio && !anuncioPostInteractiveId) {
      const request = parseAnuncioPostRequest(userContent);
      const socialRequest = detectSocialPostIntent(userContent);
      const hasAnuncioPostAnswer = !!request.action || !!request.format ||
        request.networks.length > 0 || !!request.style;
      const refersToLastAnuncio = shouldBindPostToLastAnuncio({
        requestText: userContent,
        explicitProduct: socialRequest?.temProduto
          ? socialRequest.produto
          : undefined,
        anuncioTitle: String(lastAnuncio.data.titulo || ""),
        pendingFlow: !!pendingAnuncioPost,
      });
      if (
        refersToLastAnuncio &&
        hasAnuncioPostAnswer &&
        (request.action || pendingAnuncioPost)
      ) {
        const selectedStyle = request.style ?? lastAnuncio.selected_style;
        const selectedImageExists = selectedStyle &&
          lastAnuncio.images.some((image) => image.style === selectedStyle);
        if (!selectedStyle || !selectedImageExists) {
          return {
            text: "Escolha primeiro o estilo do anúncio.",
            interactiveButtons: anuncioStyleButtons(),
          };
        }
        lastAnuncio.selected_style = selectedStyle;
        const action = request.action ?? pendingAnuncioPost?.action;
        if (action === "save") {
          await persistAnuncioFlowState(toolCtx, {
            last_anuncio: lastAnuncio,
            pending_anuncio_post: null,
          });
          return { text: "Salvei o anúncio. Nada foi publicado." };
        }
        if (!action) {
          const next: PendingAnuncioPost = {
            stage: "action",
            created_at: new Date().toISOString(),
          };
          await persistAnuncioFlowState(toolCtx, {
            last_anuncio: lastAnuncio,
            pending_anuncio_post: next,
          });
          return {
            text: "O que você quer fazer com este anúncio?",
            interactiveButtons: anuncioPostActionButtons(),
          };
        }
        const format = request.format ?? pendingAnuncioPost?.format;
        if (!format) {
          const next: PendingAnuncioPost = {
            ...pendingAnuncioPost,
            stage: "format",
            action,
            created_at: new Date().toISOString(),
          };
          await persistAnuncioFlowState(toolCtx, {
            last_anuncio: lastAnuncio,
            pending_anuncio_post: next,
          });
          return {
            text: "Em qual formato?",
            interactiveButtons: anuncioPostFormatButtons(action === "schedule"),
          };
        }
        if (action === "schedule" && format !== "feed") {
          const next: PendingAnuncioPost = {
            ...pendingAnuncioPost,
            stage: "format",
            action,
            created_at: new Date().toISOString(),
          };
          await persistAnuncioFlowState(toolCtx, {
            last_anuncio: lastAnuncio,
            pending_anuncio_post: next,
          });
          return {
            text:
              "Story ainda não pode ser agendado pelo WhatsApp. Para agendar, escolha Feed; para Story, use Publicar agora.",
            interactiveButtons: anuncioPostFormatButtons(true),
          };
        }
        const connected = await connectedAnuncioNetworks(toolCtx.userId);
        const requestedNetworks = request.networks.length
          ? request.networks
          : pendingAnuncioPost?.networks ?? [];
        const networks = requestedNetworks.filter((network) =>
          connected.includes(network)
        );
        if (!networks.length) {
          const next: PendingAnuncioPost = {
            ...pendingAnuncioPost,
            stage: "networks",
            action,
            format,
            created_at: new Date().toISOString(),
          };
          await persistAnuncioFlowState(toolCtx, {
            last_anuncio: lastAnuncio,
            pending_anuncio_post: next,
          });
          return {
            text: connected.length
              ? "Em quais redes?"
              : "Não encontrei Facebook nem Instagram conectados nessa conta.",
            interactiveButtons: connected.length
              ? anuncioPostNetworkButtons(connected)
              : undefined,
          };
        }
        try {
          const prepared = await prepareAnuncioSocialPosts({
            last: lastAnuncio,
            action: action === "schedule" ? "schedule" : "publish",
            format,
            networks,
            ctx: toolCtx,
          });
          return await deliverAnuncioCaptionChoices(prepared.raw, toolCtx);
        } catch (error) {
          return { text: `Não consegui preparar a publicação: ${(error as Error).message}. Nada foi publicado.` };
        }
      }
      if (
        pendingAnuncioPost &&
        !["custom_caption", "schedule_time"].includes(
          pendingAnuncioPost.stage,
        )
      ) {
        // Um assunto diferente encerra este assistente sem sequestrar a conversa.
        await persistAnuncioFlowState(toolCtx, {
          last_anuncio: lastAnuncio,
          pending_anuncio_post: null,
        });
      }
    }
    if (
      remetenteEhDono
      && !latestPendingSocialToken
      && explicitPendingCommand
    ) {
      return {
        text: "Não encontrei um post aguardando aprovação. Quer que eu prepare de novo a partir da última mídia?",
      };
    }
    if (remetenteEhDono && socialVariantInteractive) {
      const token = socialVariantInteractive[2].toLowerCase();
      const pending = await loadPendingSocialPost(token, toolCtx.userId);
      const result = await toolEscolherVariantePost({
        token,
        opcao: socialVariantInteractive[1],
      }, toolCtx);
      return {
        text: `${pending ? `Vou usar ${describeLoadedPendingSocialPost(pending)}.\n\n` : ""}${formatSocialPostToolResult(result)}`,
        interactiveButtons: interactiveButtonsFromSocialResult(result),
      };
    }
    if (remetenteEhDono && socialActionInteractive?.[1]?.toLowerCase() === "publish_confirm") {
      const result = await toolConfirmarPostagemRedes({ token: socialActionInteractive[2] }, toolCtx);
      return {
        text: formatSocialPostToolResult(result),
        interactiveList: interactiveListFromSocialResult(result),
        interactiveButtons: interactiveButtonsFromSocialResult(result),
      };
    }
    if (remetenteEhDono && socialActionInteractive?.[1]?.toLowerCase() === "publish") {
      const token = socialActionInteractive[2].toLowerCase();
      const pending = await loadPendingSocialPost(token, toolCtx.userId);
      if (
        pending
        && requiresOldPendingPublishConfirmation(
          isPendingInteractionRecent(pending.createdAt, pending.lastInteractionAt),
        )
      ) {
        const description = describeLoadedPendingSocialPost(pending);
        return {
          text: `Vou usar ${description}. Como essa aprovação tem mais de 30 minutos, confirme no botão antes de publicar.`,
          interactiveButtons: oldPendingPublishConfirmationButtons(token, description),
        };
      }
      const result = await toolConfirmarPostagemRedes({ token }, toolCtx);
      return {
        text: formatSocialPostToolResult(result),
        interactiveList: interactiveListFromSocialResult(result),
        interactiveButtons: interactiveButtonsFromSocialResult(result),
      };
    }
    if (remetenteEhDono && socialActionInteractive?.[1]?.toLowerCase() === "schedule") {
      const token = socialActionInteractive[2].toLowerCase();
      const pending = await loadPendingSocialPost(token, toolCtx.userId);
      if (!pending || !canRunSocialPostAction(pending.variantSelecionada)) {
        const result = pending
          ? variantSelectionRequiredResult(token, pending)
          : JSON.stringify({ erro: "token_nao_encontrado", mensagem: "Não encontrei esse criativo aguardando confirmação." });
        return {
          text: formatSocialPostToolResult(result),
          interactiveButtons: interactiveButtonsFromSocialResult(result),
        };
      }
      return {
        text: `Vou usar ${describeLoadedPendingSocialPost(pending)}. Para quando? Informe o dia/mês e a hora. Ex.: 30/09 às 10h`,
      };
    }
    if (
      remetenteEhDono
      && latestPendingSocialToken
      && explicitPendingCommand === "schedule"
      && /^(agendar|agenda|agende)$/.test(
        normalizedInput.replace(/<<interactive id:[^>]+>>/g, "").trim(),
      )
    ) {
      const pending = PENDING_POSTS.get(latestPendingSocialToken)
        ?? await loadPendingSocialPost(latestPendingSocialToken, toolCtx.userId);
      if (pending && !canRunSocialPostAction(pending.variantSelecionada)) {
        const result = variantSelectionRequiredResult(latestPendingSocialToken, pending);
        return {
          text: `${explicitPendingNotice}${formatSocialPostToolResult(result)}`,
          interactiveButtons: interactiveButtonsFromSocialResult(result),
        };
      }
      return { text: `${explicitPendingNotice}Para quando? Informe o dia/mês e a hora. Ex.: 30/09 às 10h` };
    }
    if (remetenteEhDono && latestPendingSocialToken && explicitPendingCommand === "schedule") {
      const rawSchedule = userContent
        .replace(/<<INTERACTIVE_ID:[^>]+>>/gi, "")
        .replace(/^(?:agendar|agenda|agende)\s+(?:para\s+)?/i, "")
        .trim();
      if (parseSaoPauloDateTime(rawSchedule)) {
        const result = await toolAgendarPostPendente({
          token: latestPendingSocialToken,
          data_hora_sp: rawSchedule,
        }, toolCtx);
        return {
          text: `${explicitPendingNotice}${formatSocialPostToolResult(result)}`,
          interactiveList: interactiveListFromSocialResult(result),
          interactiveButtons: interactiveButtonsFromSocialResult(result),
        };
      }
    }
    if (
      remetenteEhDono
      && latestPendingSocialToken
      && explicitPendingCommand === "publish"
      && requiresOldPendingPublishConfirmation(!!latestPendingSocial?.isRecent)
    ) {
      return {
        text: `${explicitPendingNotice}Como essa aprovação tem mais de 30 minutos, confirme no botão antes de publicar.`,
        interactiveButtons: oldPendingPublishConfirmationButtons(
          latestPendingSocialToken,
          latestPendingSocial!.description,
        ),
      };
    }

    // Precedência de mídia do dono: gerar > postar > editar. Uma geração
    // encadeada com post salva a nova imagem em /midias e usa exatamente esse
    // ID na prévia, sem deixar os atalhos capturarem uma mídia anterior.
    const productAdCreativeRequest = isProductAdCreativeRequest(userContent);
    if (
      remetenteEhDono
      && !productAdCreativeRequest
      && (ownerMediaIntent.action === "generate" || ownerMediaIntent.action === "generate_and_post")
    ) {
      const imagePrompt = userContent.split(/\b(?:depois|em seguida|na sequência)\b/i)[0].trim();
      console.log("[pietro][forced_image_generation]", { chainedPost: ownerMediaIntent.action === "generate_and_post" });
      const prepared = await prepareWhatsAppImageGeneration({
        prompt: imagePrompt || userContent,
        ctx: toolCtx,
        chainedPost: ownerMediaIntent.action === "generate_and_post",
        chainedRequest: userContent,
      });
      if (prepared.deferred) {
        return {
          text: prepared.text,
          imageUrl: prepared.imageUrl,
          interactiveButtons: prepared.interactiveButtons,
        };
      }
      const generatedRaw = prepared.raw;
      let generated: any = {};
      try { generated = JSON.parse(generatedRaw); } catch { /* tratado abaixo */ }
      if (generated?.ok !== true || !generated?.image_url) {
        return { text: whatsAppImageFailureMessage(generated) };
      }
      if (generated?.midia_id) await rememberLastMediaInteraction(toolCtx, generated.midia_id);
      const brandResult = whatsAppImageBrandResultMessage(
        generated,
        detectWhatsAppBrandDirective(userContent) === "none",
      );

      if (ownerMediaIntent.action === "generate_and_post") {
        if (!generated?.midia_id) {
          return {
            text: "Gerei a imagem, mas não consegui salvá-la na biblioteca para montar a prévia do post.",
            imageUrl: generated.image_url,
          };
        }
        const social = detectSocialPostIntent(userContent, { allowGenerationChain: true }) ?? {
          produto: "",
          tom: "urgencia",
          redes: ["facebook", "instagram"],
          temProduto: false,
          formato: detectSocialPostFormat(userContent) ?? "feed",
        };
        const briefing = extractSocialPostBriefing(userContent);
        const postResult = await toolPostarMidiaBiblioteca({
          midia_id: generated.midia_id,
          legenda: briefing || cleanMediaPostLegenda(userContent),
          briefing,
          tom: social.tom,
          redes: social.redes.length ? social.redes : ["facebook", "instagram"],
          formato: social.formato ?? "feed",
          incluir_cta_whatsapp: detectWantsWhatsappCta(userContent),
        }, toolCtx);
        return {
          text: `${brandResult}\n\n${formatSocialPostToolResult(postResult)}`,
          interactiveButtons: interactiveButtonsFromSocialResult(postResult),
        };
      }

      const code = generated?.midia_id ? `<<SPLIT>>${linhaCodigoMidia(generated.midia_id, "foto")}` : "";
      return {
        text: `Pronto — criei a imagem e salvei na biblioteca. ${brandResult}${code}`,
        imageUrl: generated.image_url,
      };
    }

    if (pendingClientLogo) {
      const conversation = toolCtx.convId
        ? { id: toolCtx.convId, userId: toolCtx.userId, contactNumber: toolCtx.fromNumber }
        : null;
      const age = Date.now() - new Date(pendingClientLogo.created_at).getTime();
      if (!Number.isFinite(age) || age > 24 * 60 * 60 * 1000) {
        await sb.storage.from("tenant-logos").remove([pendingClientLogo.logo_path]);
        if (conversation) {
          await saveAgentState(sb, conversation, { pending_client_logo: null }, toolCtx.agentState ?? {});
        }
        return { text: "O envio anterior da logo expirou. Envie a imagem novamente dizendo de qual cliente ela é." };
      }
      if (isVideoCancellation(userContent) || /^(cancelar|cancela|deixa pra l[aá])$/i.test(userContent.trim())) {
        await sb.storage.from("tenant-logos").remove([pendingClientLogo.logo_path]);
        if (conversation) {
          await saveAgentState(sb, conversation, { pending_client_logo: null }, toolCtx.agentState ?? {});
        }
        return { text: "Cadastro da logo cancelado." };
      }
      const clientName = extractClientNameFromLogoRequest(userContent)
        || userContent
          .replace(/^(?:[ée]\s+)?(?:d[oa]|de)\s+(?:cliente\s+)?/i, "")
          .replace(/[.!?]+$/g, "")
          .trim()
          .slice(0, 100);
      if (
        !clientName
        || clientName.length < 2
        || /^(?:cliente|empresa|marca|n[aã]o sei|esse|essa)$/i.test(clientName)
      ) {
        return { text: "De qual cliente é essa logo? Responda com o nome da empresa, por exemplo: Casarão Lustres." };
      }
      try {
        const matches = await listClientBrandIdentityMatches(sb, toolCtx.userId, clientName);
        if (matches.length > 1) {
          return {
            text: `Encontrei mais de um cliente parecido: ${matches.map((item) => item.client_name).join(", ")}. De qual deles é a logo?`,
          };
        }
        const saved = await saveClientBrandIdentity(sb, {
          userId: toolCtx.userId,
          clientName: matches[0]?.client_name || clientName,
          logoPath: pendingClientLogo.logo_path,
          logoVariant: pendingClientLogo.variant ?? "default",
          identity: { logo_origem: "whatsapp_manual" },
        });
        if (conversation) {
          await saveAgentState(sb, conversation, { pending_client_logo: null }, toolCtx.agentState ?? {});
        }
        return {
          text: `Guardei como logo do ${saved.client_name}. Vou usar nos vídeos e posts desse cliente.${
            saved.identity?.logo_background_warning
              ? `\n\n${saved.identity.logo_background_warning}`
              : ""
          }`,
        };
      } catch (error) {
        console.error("[client-brand][pending-logo-save]", error);
        return { text: "Não consegui associar a logo ao cliente. O arquivo continua guardado; diga novamente o nome da empresa." };
      }
    }

    if (
      remetenteEhDono
      && canRunClientLogoRegistrationShortcut({
        text: userContent,
        hasPendingVideoSetup: Boolean(pendingVideoSetup),
      })
    ) {
      const clientName = extractClientNameFromLogoRequest(userContent);
      if (!clientName) {
        return { text: "De qual cliente é essa logo? Diga o nome da empresa para eu associar a última foto." };
      }
      const raw = await toolRegistrarLogoCliente({
        cliente: clientName,
        variante: detectLogoVariantRequest(userContent) ?? "default",
      }, toolCtx);
      try {
        const result = JSON.parse(raw);
        const uploadFollowUp = clientLogoUploadFollowUp(
          clientName,
          String(result?.erro ?? ""),
        );
        if (uploadFollowUp) {
          const conversation = toolCtx.convId
            ? { id: toolCtx.convId, userId: toolCtx.userId, contactNumber: toolCtx.fromNumber }
            : null;
          if (conversation) {
            const pendingIntent = {
              client_name: clientName,
              created_at: new Date().toISOString(),
              variant: detectLogoVariantRequest(userContent) ?? "default",
            };
            await saveAgentState(sb, conversation, {
              pending_client_logo_intent: pendingIntent,
            }, toolCtx.agentState ?? {});
            if (toolCtx.agentState) {
              toolCtx.agentState.pending_client_logo_intent = pendingIntent;
            }
          }
          return {
            text: uploadFollowUp,
          };
        }
        return {
          text: String(
            result?.mensagem
            || (result?.ok === true
              ? `Guardei como logo do ${result.client_name}. Vou usar nos vídeos e posts desse cliente.`
              : "Não consegui cadastrar a logo."),
          ),
        };
      } catch {
        return { text: "Não consegui confirmar o cadastro da logo. Não marquei a imagem como logo do cliente." };
      }
    }

    // Composição produto+ambiente tem prioridade sobre forced_image_edit.
    // Diferentemente da edição comum, este fluxo exige DUAS referências e
    // nunca pode degradar silenciosamente para ficha técnica de uma só foto.
    const imageCompositionIntent = !productAdCreativeRequest &&
      isImageCompositionIntent(userContent);
    if (imageCompositionIntent && !remetenteEhDono) {
      deferRestrictedShortcutToModel(true);
    }
    if (imageCompositionIntent && remetenteEhDono) {
      try {
        const pendingComposition = toolCtx.agentState?.pending_image_composition;
        const pendingAge = pendingComposition?.at
          ? Date.now() - new Date(pendingComposition.at).getTime()
          : Number.POSITIVE_INFINITY;
        const preferredMediaIds = pendingAge <= 15 * 60 * 1000
          ? pendingComposition?.media_ids ?? []
          : [];
        const sources = await resolveCompositionSources(
          toolCtx.userId,
          toolCtx.fromNumber,
          userContent,
          undefined,
          preferredMediaIds,
        );
        if (!sources) {
          return {
            text: "Me manda duas fotos: uma do ambiente e outra do produto exato que você quer colocar nele.",
          };
        }
        const result = await composeProductInEnvironment({
          userId: toolCtx.userId,
          fromNumber: toolCtx.fromNumber,
          conversationId: toolCtx.convId || null,
          requestText: userContent,
          ...sources,
        });
        if (!result.ok) return { text: result.message };
        if (toolCtx.convId) {
          const conversation = {
            id: toolCtx.convId,
            userId: toolCtx.userId,
            contactNumber: toolCtx.fromNumber,
          };
          const current = toolCtx.agentState ?? await loadAgentState(sb, conversation);
          const interaction = { media_id: result.mediaId, at: new Date().toISOString() };
          await saveAgentState(sb, conversation, {
            pending_image_composition: null,
            last_media_interaction: interaction,
          }, current);
          current.pending_image_composition = null;
          current.last_media_interaction = interaction;
          toolCtx.agentState = current;
        }
        return {
          text: `Pronto — mantive o ambiente e inseri o produto de referência. É uma simulação ilustrativa.${result.resolution === "2K" ? " Gerei em alta resolução." : ""}<<SPLIT>>${linhaCodigoMidia(result.mediaId, "foto")}`,
          imageUrl: result.imageUrl,
        };
      } catch (error) {
        console.error("[image_composition][route_failed]", error);
        return {
          text: "Não consegui combinar as duas fotos agora. Mantive as originais sem entregar uma edição diferente.",
        };
      }
    }

    const tiktokChoiceInteractive = !!tiktokInteractiveId(userContent);
    const pendingTokenForTikTokChoice = tiktokChoiceInteractive
      ? latestPendingSocialToken
      : recentPendingSocialToken;
    if (pendingTokenForTikTokChoice) {
      const privacyResult = await applyPendingTikTokPrivacyChoice(pendingTokenForTikTokChoice, userContent, toolCtx);
      if (privacyResult) {
        return {
          text: `${tiktokChoiceInteractive ? explicitPendingNotice : latestPendingNotice}${formatSocialPostToolResult(privacyResult)}`,
          interactiveList: interactiveListFromSocialResult(privacyResult),
        };
      }
    }

    // Edição de foto recente é determinística: o modelo não pode apenas prometer
    // que vai trabalhar em segundo plano. A própria ferramenta busca a última
    // foto do tenant (janela de 30 min) e devolve a imagem pronta neste turno.
    const pedidoEdicaoFoto = ownerMediaIntent.action === "edit";
    const pedidoLogoNaFoto = pedidoEdicaoFoto
      && /\b(?:logo|logotipo|logomarca|marca)\b/i.test(userContent);
    let temFotoParaEditar = (toolCtx.media || []).some((m) => m.kind === "image");
    if (remetenteEhDono && pedidoEdicaoFoto && !temFotoParaEditar) {
      const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const { data: fotoRecente, error: fotoError } = await sb
        .from("midias_whatsapp")
        .select("id")
        .eq("user_id", toolCtx.userId)
        .eq("telefone_origem", toolCtx.fromNumber)
        .eq("tipo", "foto")
        .gte("created_at", cutoff)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (fotoError) console.warn("[processor][forced_image_edit][recent_photo_error]", fotoError.message);
      temFotoParaEditar = !!fotoRecente?.id;
      if (!temFotoParaEditar) {
        console.log("[processor][forced_image_edit][skipped_no_image]");
      }
    }
    if (remetenteEhDono && pedidoEdicaoFoto && temFotoParaEditar && !isCarrosselRequest(userContent)) {
      // Pedido de LOGO tem prioridade absoluta: a foto original é mantida e só a marca é aplicada.
      const trocarCenario = !pedidoLogoNaFoto && /\b(?:cen[aá]rio|ambiente|fundo|est[uú]dio|showroom)\b/i.test(userContent);
      const modoForcado = pedidoLogoNaFoto ? "aplicar_logo" : trocarCenario ? "ficha_tecnica" : "melhoria";
      console.log(`[processor][forced_image_edit] modo=${modoForcado}`);
      const raw = await toolEditarImagem(userContent, {
        userId: toolCtx.userId,
        fromNumber: toolCtx.fromNumber,
        media: toolCtx.media,
        textos: [],
        modo: modoForcado,
        preservarAmbiente: trocarCenario ? false : undefined,
      });
      let parsed: any = {};
      try { parsed = JSON.parse(raw); } catch { /* resposta inválida tratada abaixo */ }
      if (parsed?.image_url) {
        if (parsed?.midia_id) await rememberLastMediaInteraction(toolCtx, parsed.midia_id);
        const codigo = parsed?.midia_id ? `<<SPLIT>>${linhaCodigoMidia(parsed.midia_id, "foto")}` : "";
        return {
          text: pedidoLogoNaFoto
            ? `Pronto — apliquei a marca na sua foto original, sem mudar nada mais na imagem.${codigo}`
            : `Pronto — deixei a foto em um cenário profissional para divulgação.${codigo}`,
          imageUrl: parsed.image_url,
        };
      }
      return { text: mensagemErroEdicaoImagem(parsed) };
    }

    // Fluxo A/B/C: resolve seleção e confirmação direto no código, sem depender da IA.
    const variantChoice = recentPendingSocialToken ? detectSocialVariantChoice(userContent) : null;
    if (variantChoice) {
      console.log("[pietro][forced_social_variant_choice]", { token: recentPendingSocialToken, opcao: variantChoice });
      const variantResult = await toolEscolherVariantePost({ token: recentPendingSocialToken!, opcao: variantChoice }, toolCtx);
      return {
        text: `${latestPendingNotice}${formatSocialPostToolResult(variantResult)}`,
        interactiveButtons: interactiveButtonsFromSocialResult(variantResult),
      };
    }

    const plainPostConfirmation = recentPendingSocialToken ? detectPlainSocialPostConfirmation(userContent) : null;
    if (plainPostConfirmation) {
      console.log("[pietro][forced_social_plain_confirm]", { token: recentPendingSocialToken, cancelar: !!plainPostConfirmation.cancelar });
      const confirmResult = await toolConfirmarPostagemRedes({ token: recentPendingSocialToken!, cancelar: plainPostConfirmation.cancelar }, toolCtx);
      return {
        text: `${latestPendingNotice}${formatSocialPostToolResult(confirmResult)}`,
        interactiveList: interactiveListFromSocialResult(confirmResult),
        interactiveButtons: interactiveButtonsFromSocialResult(confirmResult),
      };
    }

    // Ajuste explícito em texto livre: encaminha a frase LITERAL diretamente ao
    // gerador. Isso elimina a etapa em que o modelo podia resumir ou omitir o
    // briefing novo e garante a resposta determinística com as opções completas.
    const plainCopyAdjustment = recentPendingSocialToken ? detectPlainSocialCopyAdjustment(userContent) : null;
    if (plainCopyAdjustment) {
      console.log("[pietro][forced_social_copy_adjustment]", {
        token: recentPendingSocialToken,
        chars: plainCopyAdjustment.length,
      });
      const revisedResult = await toolRevisarPostPendente({
        token: recentPendingSocialToken!,
        ajuste: plainCopyAdjustment,
      }, toolCtx);
      return {
        text: `${latestPendingNotice}${formatSocialPostToolResult(revisedResult)}`,
        interactiveButtons: interactiveButtonsFromSocialResult(revisedResult),
      };
    }

    // 0) Postagem em redes sociais: atalho determinístico para não deixar o modelo "prometer" preview sem chamar a tool.
    const detectedPostConfirmation = detectSocialPostConfirmation(userContent);
    const postConfirmation = detectedPostConfirmation && recentPendingSocialToken &&
        detectedPostConfirmation.token.toLowerCase() === recentPendingSocialToken.toLowerCase()
      ? detectedPostConfirmation
      : null;
    if (postConfirmation && !remetenteEhDono) {
      deferRestrictedShortcutToModel(true);
    }
    if (postConfirmation && remetenteEhDono) {
      console.log("[pietro][forced_social_confirm]", postConfirmation);
      const confirmResult = await toolConfirmarPostagemRedes(postConfirmation, toolCtx);
      return {
        text: `${latestPendingNotice}${formatSocialPostToolResult(confirmResult)}`,
        interactiveList: interactiveListFromSocialResult(confirmResult),
        interactiveButtons: interactiveButtonsFromSocialResult(confirmResult),
      };
    }

    // ---- CARROSSEL (prioridade sobre o post único) ----
    if (
      pendingCarousel?.stage === "awaiting_confirmation"
      && pendingCarousel.media_id
      && /\b(ver|mostra|mostrar|manda|enviar)\b[\s\S]{0,40}\b(restante|resto|demais|outros?\s+cards?)\b/i.test(userContent)
    ) {
      const urls = Array.isArray(pendingCarousel.image_urls) ? pendingCarousel.image_urls : [];
      if (urls.length < 2) return { text: "Perdi o snapshot da prévia; gere o carrossel novamente para eu mostrar os cards exatos." };
      try {
        await enviarPreviewCarrossel(toolCtx, urls, 3, Math.max(0, urls.length - 3));
        return { text: `Enviei os ${Math.max(0, urls.length - 3)} cards restantes. Ainda não publiquei.` };
      } catch (e) {
        return { text: `Não consegui enviar os cards restantes: ${(e as Error).message}` };
      }
    }

    if (pendingCarousel?.stage === "awaiting_confirmation" && isCarouselAdjustment(userContent)) {
      const colorChange = /\b(?:muda|troca|altera|ajusta)(?:\s+a)?(?:\s+cor)?\s+(?:para\s+)?(?:azul|verde|laranja|preto|dourado|roxo)\b|\b(?:na|para\s+a)\s+cor\s+(?:azul|verde|laranja|preto|dourado|roxo)\b/i.test(normalizePt(userContent));
      const novaCor = colorChange && resolveCarouselColor(userContent) ? userContent : pendingCarousel.cor;
      if (!novaCor) return { text: "Qual cor você quer usar no carrossel?" };
      const alsoChangesContent = /\b(card|slide|texto|titulo|chamada|legenda)\b/i.test(userContent);
      const r = await toolCriarCarrossel({
        tema: pendingCarousel.tema,
        cor: novaCor,
        num_slides: pendingCarousel.num_slides,
        legenda: pendingCarousel.caption,
        slides: pendingCarousel.slides,
        ajuste: colorChange && !alsoChangesContent ? undefined : userContent,
        facebook_requested: pendingCarousel.facebook_requested,
      }, toolCtx);
      try {
        const parsed = JSON.parse(r);
        if (parsed?.status === "aguardando_escolha_variante") {
          try {
            await cancelarPreviewCarrosselAnterior(pendingCarousel.token, toolCtx.userId);
          } catch (e) {
            if (parsed?.token) {
              PENDING_POSTS.delete(parsed.token);
              await sb.from("social_posts_queue")
                .update({ status: "cancelado", error_message: "ajuste_nao_substituiu_preview_anterior", updated_at: new Date().toISOString() })
                .eq("user_id", toolCtx.userId)
                .eq("status", "aguardando_confirmacao")
                .like("error_message", `jarvis_token:${parsed.token}%`);
            }
            if (toolCtx.convId) {
              const conversation = { id: toolCtx.convId, userId: toolCtx.userId, contactNumber: toolCtx.fromNumber };
              const current = toolCtx.agentState ?? await loadAgentState(sb, conversation);
              await saveAgentState(sb, conversation, { pending_carousel: pendingCarousel }, current);
              current.pending_carousel = pendingCarousel;
              toolCtx.agentState = current;
            }
            return { text: `Gerei o ajuste, mas não consegui substituir o preview anterior com segurança (${(e as Error).message}). Não publiquei nada; tente o ajuste novamente.` };
          }
        }
      } catch (e) {
        console.error("[carrossel][adjust_parse_failed]", (e as Error).message);
      }
      return carouselToolResponse(r);
    }

    // 1) pedido explícito ou detalhado de carrossel
    const carouselRequest = isCarrosselRequest(userContent);
    if (
      carouselRequest
      && !remetenteEhDono
      && toolCtx.userId !== ADMIN_AMZ_USER_ID
    ) {
      deferRestrictedShortcutToModel(true);
    }
    if (
      carouselRequest
      && (remetenteEhDono || toolCtx.userId === ADMIN_AMZ_USER_ID)
    ) {
      const carouselNetworks = detectRequestedSocialNetworks(userContent);
      if (carouselNetworks.includes("linkedin") && !carouselNetworks.includes("instagram")) {
        return {
          text: "Carrossel pelo LinkedIn ainda não está habilitado. Posso preparar esse carrossel para o Instagram.",
        };
      }
      const tema = extractCarrosselTema(userContent);
      const corPedida = detectExplicitCarouselColor(userContent);
      console.log("[pietro][forced_carrossel]", { tema, cor: corPedida ? "detectada" : "aguardando" });
      if (tema.length < 3) {
        return { text: "Fechado, carrossel! Sobre qual assunto você quer? (ex: “vantagens da AMZ Ofertas”)" };
      }
      const { result: r, imageUrl } = await runTool("criar_carrossel", {
        tema,
        cor: corPedida,
        num_slides: requestedCarouselSlideCount(userContent, !remetenteEhDono),
        facebook_requested: requestedFacebook(userContent),
      }, toolCtx);
      const blocked = deterministicDemoBlockedResponse(
        "criar_carrossel",
        r,
        imageUrl,
      );
      if (blocked) return blocked;
      const response = { ...carouselToolResponse(r), imageUrl };
      if (carouselNetworks.includes("linkedin")) {
        response.text = `${response.text}<<SPLIT>>Carrossel pelo LinkedIn ainda não está habilitado; mantive apenas o Instagram.`;
      }
      return response;
    }

    // 2) resposta curta só com a cor, retomando o carrossel pendente
    const corResposta = pendingCarousel?.stage === "awaiting_color" ? detectStandaloneCarrosselColor(userContent) : null;
    if (
      (remetenteEhDono || toolCtx.userId === ADMIN_AMZ_USER_ID)
      && pendingCarousel?.stage === "awaiting_color"
      && corResposta
    ) {
      console.log("[pietro][carrossel_cor_escolhida]", { tema: pendingCarousel.tema });
      const { result: r, imageUrl } = await runTool("criar_carrossel", {
        tema: pendingCarousel.tema,
        cor: corResposta,
        num_slides: pendingCarousel.num_slides,
        legenda: pendingCarousel.caption,
        facebook_requested: pendingCarousel.facebook_requested,
      }, toolCtx);
      const blocked = deterministicDemoBlockedResponse(
        "criar_carrossel",
        r,
        imageUrl,
      );
      if (blocked) return blocked;
      return { ...carouselToolResponse(r), imageUrl };
    }

    const socialPost = detectSocialPostIntent(userContent);

    if (socialPost && !remetenteEhDono) {
      deferRestrictedShortcutToModel(true);
    }
    if (socialPost && remetenteEhDono) {
      console.log("[pietro][forced_social_post]", socialPost);
      const midiaId = extrairIdentificadorMidia(userContent);
      const briefing = extractSocialPostBriefing(userContent);
      if (midiaId) {
        const postResult = await toolPostarMidiaBiblioteca({
          midia_id: midiaId,
          pedido_original: userContent,
          legenda: briefing || cleanMediaPostLegenda(userContent),
          briefing,
          tom: socialPost.tom,
          redes: socialPost.redes,
          formato: socialPost.formato ?? "feed",
        }, toolCtx);
        return {
          text: formatSocialPostToolResult(postResult),
          interactiveButtons: interactiveButtonsFromSocialResult(postResult),
        };
      }

      if (pedidoReferenciaMidiaGenerica(userContent, socialPost.produto) || !socialPost.temProduto) {
        const postResult = await toolPostarMidiaBiblioteca({
          pedido_original: userContent,
          legenda: briefing || cleanMediaPostLegenda(userContent),
          briefing,
          tom: socialPost.tom,
          redes: socialPost.redes,
          formato: socialPost.formato ?? "feed",
          incluir_cta_whatsapp: detectWantsWhatsappCta(userContent),
        }, toolCtx);
        return {
          text: formatSocialPostToolResult(postResult),
          interactiveButtons: interactiveButtonsFromSocialResult(postResult),
        };
      }

      const postResult = await toolPostarRedesSociais({
        ...socialPost,
        pedido_original: userContent,
      }, toolCtx);
      return {
        text: formatSocialPostToolResult(postResult),
        interactiveButtons: interactiveButtonsFromSocialResult(postResult),
      };
    }

    // Texto puro do turno (turno multimodal chega como array de partes).
    const userTextOnly = typeof userContent === "string" ? userContent : "";

    // 1) Cotações em tempo real (AwesomeAPI) — antes de qualquer coisa
    const quotePairs = hasMedia ? [] : detectQuoteIntent(userTextOnly);
    if (quotePairs.length > 0) {
      console.log("[pietro][forced_quote]", quotePairs);
      const quotes = await Promise.all(quotePairs.map((p) => toolCotacaoMoeda(p)));
      for (let i = 0; i < quotePairs.length; i++) {
        const id = `forced_quote_${i + 1}`;
        messages.push({
          role: "assistant",
          content: null,
          tool_calls: [{
            id,
            type: "function",
            function: { name: "cotacao_moeda", arguments: JSON.stringify({ par: quotePairs[i] }) },
          }],
        });
        messages.push({ role: "tool", tool_call_id: id, content: quotes[i] });
      }
    }

    // 2) Busca web (Google) só para pedido explícito de pesquisa ou pergunta de fato externo.
    //    Nunca em turno com mídia, nunca em conversa operacional.
    const forcedSearch = detectWebSearchIntent(userTextOnly, { hasMedia });
    if (forcedSearch) {

      console.log("[pietro][forced_web_search]", forcedSearch);
      const searchResult = await toolPesquisarWeb(forcedSearch.query, forcedSearch.recencia);
      messages.push({
        role: "assistant",
        content: null,
        tool_calls: [{
          id: "forced_web_search_1",
          type: "function",
          function: { name: "pesquisar_web", arguments: JSON.stringify(forcedSearch) },
        }],
      });
      messages.push({ role: "tool", tool_call_id: "forced_web_search_1", content: searchResult });
    }
  }


  // Modelo pro é mais confiável com áudio/imagem
  // Roteamento por tipo de fluxo (Feature 2): multimodal → DEEP, texto conversa → FAST.
  const model = escolherModelo({ kind: hasMedia ? "multimodal" : "conversation" });
  let pendingImageUrl: string | undefined;
  let pendingMediaCodeBlock = "";
  let pendingDemoSiteBrandResult: Record<string, unknown> | null = null;
  let creativeToolRanThisTurn = false;
  let pendingSocialToken: string | undefined; // token de post aguardando confirmação — anexa <<SPLIT>>pode postar {token} no fim
  let metaAdsSummaryDraftId: string | undefined;

  const captureSocialToken = (raw: string) => {
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.status === "aguardando_confirmacao" && typeof parsed?.token === "string") {
        pendingSocialToken = parsed.token;
      }
    } catch { /* ignore */ }
  };

  const appendConfirmCommand = (text: string): string => {
    if (!pendingSocialToken) return text;
    const token = pendingSocialToken;
    const cmd = `pode postar ${token}`;
    // Limpa qualquer menção inline ao token/comando pra reanexar de forma determinística.
    let cleaned = text
      .replace(new RegExp(`pode postar\\s+\\*?${token}\\*?`, "gi"), "")
      .replace(new RegExp(`\\*?\\b${token}\\b\\*?`, "g"), "")
      .replace(/Posso publicar agora\??.*$/gim, "")
      .replace(/Quer ajustar[^\n]*/gi, "")
      .replace(/O token[^\n.]*\.?/gi, "")
      .replace(/Token[:\s]*\.?/gi, "")
      .replace(/pode postar\s*$/gim, "")
      .replace(/[ \t]{2,}/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    const convite = `Quer ajustar algo antes de postar? Me diga o que mudar (ex: "mais curto", "foca em tecnologia AMZ", "tira o ACABA HOJE", "muda o tom"). Se estiver bom, responde:`;
    return `${cleaned}<<SPLIT>>${convite}<<SPLIT>>${cmd}`;
  };

  const unavailableForRestrictedNonOwner = new Set([
    "editar_imagem",
    "criar_video_animado",
    "postar_redes_sociais",
    "confirmar_postagem_redes",
    "agendar_post_pendente",
    "cancelar_agendamento_post",
    "remarcar_agendamento_post",
    "revisar_post_pendente",
    "escolher_variante_post",
    "postar_midia_biblioteca",
    "publicar_linkedin",
  ]);
  const availableTools = filterToolsForTenant(TOOLS, {
    userId: toolCtx.userId,
    isOwner: isOwner(toolCtx),
    adminAmzUserId: ADMIN_AMZ_USER_ID,
  }).filter((tool: any) =>
    !restrictedNonOwnerCapabilityTurn
    || !unavailableForRestrictedNonOwner.has(tool?.function?.name)
  );
  const requiredProspectSiteUrl = senderIsAmzProspect
      && typeof userContent === "string"
    ? extractWhatsAppBrandSiteUrl(userContent)
    : null;
  const requiredCreativeTool = !restrictedNonOwnerCapabilityTurn
      && senderIsAmzProspect
      && typeof userContent === "string"
    ? requiredProspectCreativeTool(
      userContent,
      Boolean(requiredProspectSiteUrl),
    )
    : null;
  const explicitMetaAdsSim = senderIsOwner
    && !hasMedia
    && isLiteralMetaAdsApproval(userContent);
  const pendingMetaAdsDraft = explicitMetaAdsSim
    ? await findLatestMetaAdsDraft(toolCtx, userContent)
    : null;
  const requiredMetaAdsTool = pendingMetaAdsDraft
    ? "publicar_anuncio_meta"
    : senderIsOwner
        && !hasMedia
        && typeof userContent === "string"
        && isMetaAdsReportRequest(userContent)
    ? "relatorio_anuncios_meta"
    : null;
  const requiredTool = requiredMetaAdsTool || requiredCreativeTool;

  for (let step = 0; step < 4; step++) {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.7,
        tools: availableTools,
        ...(step === 0 && requiredTool
          ? {
              tool_choice: {
                type: "function",
                function: { name: requiredTool },
              },
            }
          : {}),
      }),
    });

    if (!res.ok) {
      const t = await res.text();
      throw new Error(`gemini ${res.status}: ${t.slice(0, 200)}`);
    }
    const data = await res.json();
    const msg = data?.choices?.[0]?.message;
    const toolCalls = msg?.tool_calls;

    if (toolCalls && toolCalls.length > 0) {
      messages.push(msg);
      for (const tc of toolCalls) {
        const name = tc.function?.name;
        let args: any = {};
        try { args = JSON.parse(tc.function?.arguments ?? "{}"); } catch { /* ignore */ }
        args ??= {};
        if (name === "criar_anuncio" && typeof userContent === "string") {
          const photoDirective = anuncioPhotoDirectiveFromText(userContent);
          if (photoDirective) {
            args.melhorar_foto = shouldImproveAnuncioPhoto(photoDirective);
            args._foto_resolvida = true;
          } else {
            delete args.melhorar_foto;
            delete args._foto_resolvida;
          }
          args.estilo = anuncioStyleFromText(userContent) ?? args.estilo;
        }
        if (
          name === "registrar_logo_cliente" &&
          typeof userContent === "string"
        ) {
          args.variante =
            detectLogoVariantRequest(userContent) ?? args.variante ?? "default";
        }
        if (name === "publicar_anuncio_meta") {
          args.confirmacao = typeof userContent === "string"
            ? userContent.trim()
            : "";
          args.rascunho_id = pendingMetaAdsDraft?.id ?? args.rascunho_id;
        }
        if (
          name === "gerar_imagem"
          && requiredCreativeTool === "gerar_imagem"
          && requiredProspectSiteUrl
        ) {
          args.site_url = requiredProspectSiteUrl;
        }
        if (
          name === "publicar_linkedin" ||
          name === "postar_redes_sociais" ||
          name === "postar_midia_biblioteca"
        ) {
          const originalRequest = typeof userContent === "string" ? userContent : "";
          args.pedido_original = originalRequest;
          const explicitMediaId = extrairIdentificadorMidia(originalRequest);
          if (explicitMediaId || name === "publicar_linkedin") {
            args.midia_id = explicitMediaId || undefined;
          }
        }
        console.log(`[pietro][tool] ${name}`, args);
        if (isCreativeDemoTool(name)) creativeToolRanThisTurn = true;
        if (
          blockModelPendingTextActions
          && [
            "confirmar_postagem_redes",
            "escolher_variante_post",
            "revisar_post_pendente",
            "agendar_post_pendente",
          ].includes(String(name))
        ) {
          return {
            text: "Esse post não está mais no assunto recente. Se quiser retomá-lo, diga “publicar agora” ou “agendar” e eu mostro qual post será usado.",
            imageUrl: pendingImageUrl,
            forwardProof,
            forwardAttempted,
          };
        }
        const { result, imageUrl, interactiveButtons, interactiveList } =
          await runTool(name, args, toolCtx);
        if (name === "rascunho_anuncio_meta") {
          metaAdsSummaryDraftId = result.match(
            /Código do rascunho:\s*([0-9a-f-]{36})/i,
          )?.[1];
        }
        if ([
          "relatorio_anuncios_meta",
          "rascunho_anuncio_meta",
          "publicar_anuncio_meta",
          "pausar_campanha_meta",
          "ativar_campanha_meta",
          "status_campanha_meta",
        ].includes(String(name))) {
          return {
            text: result,
            imageUrl: pendingImageUrl,
            forwardProof,
            forwardAttempted,
            metaAdsSummaryDraftId,
          };
        }
        const blocked = deterministicDemoBlockedResponse(
          name,
          result,
          imageUrl,
        );
        if (blocked) {
          return {
            ...blocked,
            forwardProof,
            forwardAttempted,
          };
        }
        if (imageUrl) pendingImageUrl = imageUrl;
        if (interactiveButtons) {
          let parsed: any = {};
          try { parsed = JSON.parse(result); } catch { /* mensagem padrão abaixo */ }
          return {
            text: String(parsed?.mensagem || "Escolha como devo tratar a marca desta imagem."),
            imageUrl: pendingImageUrl,
            interactiveButtons,
            forwardProof,
            forwardAttempted,
          };
        }
        if (name === "consultar_fipe") {
          return {
            text: result,
            imageUrl: pendingImageUrl,
            interactiveList,
            forwardProof,
            forwardAttempted,
          };
        }
        try {
          if (name === "criar_carrossel") {
            return {
              ...carouselToolResponse(result),
              imageUrl: pendingImageUrl,
              forwardProof,
              forwardAttempted,
            };
          }
        } catch { /* resultado comum da ferramenta */ }
        if (name === "registrar_logo_cliente") {
          try {
            const parsed = JSON.parse(result);
            return {
              text: String(parsed?.mensagem || (parsed?.ok === true
                ? `Guardei como logo do ${parsed.client_name}. Vou usar nos vídeos e posts desse cliente.`
                : "Não consegui cadastrar a logo.")),
              imageUrl: pendingImageUrl,
              forwardProof,
              forwardAttempted,
            };
          } catch {
            return {
              text: "Não consegui confirmar o cadastro da logo. Não marquei a imagem como logo do cliente.",
              imageUrl: pendingImageUrl,
              forwardProof,
              forwardAttempted,
            };
          }
        }
        if (name === "editar_imagem") {
          try {
            const parsed = JSON.parse(result);
            if (parsed?.erro && !parsed?.image_url) {
              return {
                text: mensagemErroEdicaoImagem(parsed),
                imageUrl: pendingImageUrl,
                forwardProof,
                forwardAttempted,
              };
            }
          } catch {
            return {
              text: "Não consegui concluir a edição da imagem porque a ferramenta devolveu uma resposta inválida.",
              imageUrl: pendingImageUrl,
              forwardProof,
              forwardAttempted,
            };
          }
        }
        if (name === "gerar_imagem" || name === "editar_imagem" || name === "criar_anuncio" || name === "salvar_midia_biblioteca") {
          try {
            const parsed = JSON.parse(result);
            const ids: string[] = parsed?.demonstracao === true
              ? []
              : Array.isArray(parsed?.midia_ids)
              ? parsed.midia_ids
              : parsed?.midia_id ? [parsed.midia_id] : [];
            const tipos: string[] = Array.isArray(parsed?.tipos) ? parsed.tipos : [];
            const lastSelectableIndex = ids.map((_, index) => index)
              .filter((index) => !tipos[index] || tipos[index] === "foto" || tipos[index] === "video")
              .at(-1);
            if (lastSelectableIndex != null) {
              await rememberLastMediaInteraction(toolCtx, ids[lastSelectableIndex]);
            }
            pendingMediaCodeBlock = ids.map((id, index) =>
              linhaCodigoMidia(id, tipos[index] === "video" ? "video" : "foto")
            ).join("\n");
          } catch { /* resultado sem mídia identificável */ }
        }
        if (name === "gerar_imagem") {
          let generated: any = {};
          try { generated = JSON.parse(result); } catch { /* resposta inválida tratada pelo formatter */ }
          // A demonstração ainda passa pelo modelo para incluir a legenda curta.
          // Para o dono, a confirmação da marca é determinística: nunca depende
          // de o modelo lembrar de dizer se aplicou ou não a logo.
          if (generated?.demonstracao !== true) {
            return {
              ...completedWhatsAppImageResponse(
                result,
                detectWhatsAppBrandDirective(String(args?.prompt || "")) === "none",
              ),
              forwardProof,
              forwardAttempted,
            };
          }
          if (generated?.brand_source === "site") {
            pendingDemoSiteBrandResult = generated;
          }
        }
        if (name === "postar_midia_biblioteca" || name === "postar_redes_sociais" || name === "publicar_linkedin" || name === "revisar_post_pendente" || name === "escolher_variante_post") captureSocialToken(result);
        // Comprovante de encaminhamento: só existe se a tool realmente entregou (ok: true).
        if (name === "encaminhar_recado_ao_dono" || name === "enviar_mensagem_contato_comercial" || name === "registrar_lead_novo") {
          forwardAttempted = true;
          try {
            const p = JSON.parse(result);
            const realmenteNotificado = name !== "registrar_lead_novo" || p?.notificado === true;
            if (p?.ok === true && realmenteNotificado && p?.message_id) forwardProof = String(p?.protocolo || buildForwardProof(p.message_id));
            else console.warn("[processor][handoff][tool_failed]", String(p?.erro ?? "desconhecido"));
          } catch { /* ignore */ }
        }
        if (name === "publicar_linkedin") {
          return {
            text: formatSocialPostToolResult(result),
            imageUrl: pendingImageUrl,
            forwardProof,
            forwardAttempted,
            interactiveButtons: interactiveButtonsFromSocialResult(result),
          };
        }
        if (
          name === "criar_lembrete"
          || name === "criar_cobranca_amz"
          || name === "entregar_ebook_presente"
          || (name === "enviar_mensagem_contato_comercial" && isOwner(toolCtx))
        ) {
          try {
            const parsed = JSON.parse(result);
            if (parsed?.ok !== true) {
              return {
                text: `❌ Não concluí a ação: ${String(parsed?.detalhe || parsed?.erro || parsed?.motivo || "a ferramenta não confirmou sucesso")}`,
                imageUrl: pendingImageUrl,
                forwardProof,
                forwardAttempted,
              };
            }
            const deterministicText = name === "criar_lembrete"
              ? `✅ Lembrete criado para ${parsed.quando}. ID: ${parsed.id}.`
              : name === "criar_cobranca_amz"
              ? `✅ Cobrança criada para ${parsed.cliente} no valor de R$ ${Number(parsed.valor).toFixed(2).replace(".", ",")}.\n${parsed.payment_link}`
              : name === "entregar_ebook_presente"
              ? `✅ Enviei o PDF “${parsed.ebook}”.`
              : `✅ Mensagem enfileirada para ${parsed?.contato?.nome || "o contato"} em ${parsed.agendado_para}.`;
            return { text: deterministicText, imageUrl: pendingImageUrl, forwardProof, forwardAttempted };
          } catch {
            return {
              text: "❌ Não concluí a ação: a ferramenta devolveu uma resposta inválida.",
              imageUrl: pendingImageUrl,
              forwardProof,
              forwardAttempted,
            };
          }
        }
        if (["agendar_post_pendente", "listar_agendamentos_posts", "cancelar_agendamento_post", "remarcar_agendamento_post"].includes(name)) {
          try {
            const parsed = JSON.parse(result);
            const isTikTokChoice = parsed?.status === "aguardando_privacidade_tiktok"
              || parsed?.status === "aguardando_declaracao_tiktok";
            return {
              text: `${name === "agendar_post_pendente" ? modelPendingActionNotice : ""}${isTikTokChoice
                ? formatSocialPostToolResult(result)
                : String(
                  parsed?.mensagem
                    || (parsed?.ok === true ? "Ação concluída." : "Não consegui concluir a ação."),
                )}`,
              imageUrl: pendingImageUrl,
              forwardProof,
              forwardAttempted,
              interactiveList: interactiveListFromSocialResult(result),
              interactiveButtons: interactiveButtonsFromSocialResult(result),
            };
          } catch {
            return {
              text: "Não consegui concluir a ação porque a ferramenta devolveu uma resposta inválida.",
              imageUrl: pendingImageUrl,
              forwardProof,
              forwardAttempted,
            };
          }
        }
        // Short-circuit determinístico do fluxo A/B/C — evita a IA reescrever/repetir textos.
        try {
          const parsed = JSON.parse(result);
          const st = parsed?.status;
          if (st === "midia_reconhecida" && parsed?.mensagem) {
            return {
              text: String(parsed.mensagem),
              imageUrl: pendingImageUrl,
              forwardProof,
              forwardAttempted,
            };
          }
          if (
            st === "aguardando_escolha_variante"
            || st === "escolha_variante_necessaria"
            || st === "variante_selecionada"
            || st === "aguardando_privacidade_tiktok"
            || st === "aguardando_declaracao_tiktok"
            || st === "aguardando_retry_instagram"
            || st === "publicado"
            || st === "cancelado"
            || (
              parsed?.erro
              && ["postar_midia_biblioteca", "postar_redes_sociais", "confirmar_postagem_redes", "revisar_post_pendente", "escolher_variante_post"].includes(name)
            )
          ) {
            const formatted = formatSocialPostToolResult(result);
            return {
              text: pendingMediaCodeBlock ? `${formatted}<<SPLIT>>${pendingMediaCodeBlock}` : formatted,
              imageUrl: pendingImageUrl,
              forwardProof,
              forwardAttempted,
              interactiveList: interactiveListFromSocialResult(result),
              interactiveButtons: interactiveButtonsFromSocialResult(result),
            };
          }
        } catch { /* ignore */ }
        messages.push({ role: "tool", tool_call_id: tc.id, content: result });
      }
      continue;
    }

    const rawModelText = pendingDemoSiteBrandResult
      ? whatsAppDemoResponseWithBrand(msg?.content ?? "", pendingDemoSiteBrandResult)
      : msg?.content ?? "";
    let guardReplayImageUrl: string | undefined;
    let previousDemo: { midia_url: string; created_at: string } | null = null;
    if (
      senderIsAmzProspect
      && !creativeToolRanThisTurn
      && containsUnsupportedCreativeClaim(rawModelText)
    ) {
      previousDemo = await latestProspectDemoMedia(
        toolCtx.userId,
        toolCtx.fromNumber,
      );
      guardReplayImageUrl = previousDemo?.midia_url;
    }
    const modelText = senderIsAmzProspect
      ? guardProspectCreativeClaims({
        text: rawModelText,
        isAmzProspect: true,
        creativeToolRan: creativeToolRanThisTurn,
        previousDemoCreatedAt: previousDemo?.created_at,
      })
      : rawModelText;
    const baseText = appendConfirmCommand(modelText);
    const text = pendingMediaCodeBlock && !baseText.includes(pendingMediaCodeBlock)
      ? `${baseText}<<SPLIT>>${pendingMediaCodeBlock}`
      : baseText;
    return {
      text,
      imageUrl: pendingImageUrl ?? guardReplayImageUrl,
      forwardProof,
      forwardAttempted,
      metaAdsSummaryDraftId,
    };
  }
  const fallbackModelText = pendingDemoSiteBrandResult
    ? whatsAppDemoResponseWithBrand("", pendingDemoSiteBrandResult)
    : "Desculpa, não consegui concluir a pesquisa agora.";
  const fallbackText = appendConfirmCommand(fallbackModelText);
  return {
    text: pendingMediaCodeBlock ? `${fallbackText}<<SPLIT>>${pendingMediaCodeBlock}` : fallbackText,
    imageUrl: pendingImageUrl,
    forwardProof,
    forwardAttempted,
    metaAdsSummaryDraftId,
  };
}


const recentAutomaticMessageGuard = createRecentAutomaticMessageGuard();

async function sendWhatsApp(
  user_id: string,
  to: string,
  message: string,
  imageUrl?: string,
  interactiveList?: WhatsAppInteractiveList,
  interactiveButtons?: WhatsAppInteractiveButtons,
  delivery?: {
    beforeChunk?: (chunk: string) => Promise<void>;
    alreadyLogged?: boolean;
  },
): Promise<string | null> {
  const dedupedMessage = dedupeConsecutiveReplyText(message);
  const automaticMessageKey = JSON.stringify([
    user_id,
    String(to || "").replace(/\D/g, ""),
    dedupedMessage,
    imageUrl || null,
    interactiveList || null,
    interactiveButtons || null,
  ]);
  const automaticClaim = recentAutomaticMessageGuard.claim(
    automaticMessageKey,
  );
  if (!automaticClaim.allowed) {
    console.log("[processor][automatic_reply_dedup] suprimida_em_30s");
    return automaticClaim.receipt;
  }
  const chunks = splitWhatsAppText(dedupedMessage);
  if (chunks.length > 1) {
    console.warn(`[processor][meta_text_split] chars=${message.length} chunks=${chunks.length}`);
  }

  let firstMessageId: string | null = null;
  for (let index = 0; index < chunks.length; index++) {
    if (index > 0 && delivery?.beforeChunk) await delivery.beforeChunk(chunks[index]);
    const skipLog = processorSkipOutboundLog(delivery?.alreadyLogged);
    const body: any = {
      user_id,
      to,
      message: chunks[index],
      skip_log: skipLog,
    };
    if (!skipLog) body.log_sender = "agent";
    if (imageUrl && index === 0) body.image_url = imageUrl;
    if (interactiveList && index === chunks.length - 1) body.interactive_list = interactiveList;
    if (interactiveButtons && index === chunks.length - 1) body.interactive_buttons = interactiveButtons;
    const res = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-send-message`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SERVICE_KEY}`,
        "apikey": SERVICE_KEY,
      },
      body: JSON.stringify(body),
    });
    const txt = await res.text();
    if (!res.ok) throw new Error(`send ${res.status}: ${txt.slice(0, 200)}`);
    try {
      const j = JSON.parse(txt);
      const messageId = j?.message_id ?? j?.wamid ?? null;
      if (j?.success !== true || !messageId) {
        throw new Error(`send_without_delivery_receipt: ${txt.slice(0, 200)}`);
      }
      if (!firstMessageId) firstMessageId = messageId;
    } catch {
      throw new Error(`send_invalid_response: ${txt.slice(0, 200)}`);
    }
  }
  recentAutomaticMessageGuard.complete(
    automaticMessageKey,
    firstMessageId,
  );
  return firstMessageId;
}

// Avisa o dono do tenant no WhatsApp quando um cliente ACEITA o opt-in.
// Manda nome + telefone (clicável via wa.me) para ele poder chamar direto.
async function notificarDonoOptinAceito(
  userId: string,
  telefone: string,
  nome?: string | null,
  origem?: string,
) {
  try {
    const owner = await resolveTenantOwner(sb, userId);
    if (!owner.phone) return;
    if ((owner.phone || "").replace(/\D/g, "") === (telefone || "").replace(/\D/g, "")) return;

    let nomeFinal = (nome || "").trim();
    if (!nomeFinal) {
      const { data: m } = await sb
        .from("pj_lista_membros")
        .select("nome")
        .eq("user_id", userId)
        .eq("telefone", telefone)
        .not("nome", "is", null)
        .limit(1);
      nomeFinal = (m?.[0]?.nome || "").trim();
    }

    const texto = [
      "🟢 *Opt-in ACEITO!*",
      "",
      `👤 ${nomeFinal || "Cliente sem nome cadastrado"}`,
      `📱 ${telefone}`,
      origem ? `🔖 origem: ${origem}` : "",
      "",
      `Falar agora: https://wa.me/${(telefone || "").replace(/\D/g, "")}`,
    ].filter(Boolean).join("\n");

    const wamid = await sendWhatsApp(userId, owner.phone, texto);
    await logOwnerHeadsup(userId, texto, wamid);
    console.log(`[optin-notify] dono avisado tenant=${userId} lead=${telefone}`);
  } catch (e) {
    console.warn("[optin-notify] falhou:", (e as Error).message);
  }
}



function shortStableHash(raw: string): string {
  let h = 0;
  for (let i = 0; i < raw.length; i += 1) h = Math.imul(31, h) + raw.charCodeAt(i) | 0;
  return Math.abs(h).toString(36).slice(0, 8) || "0";
}

function classifyCommercialReply(raw: string): "confirmacao" | "remarcar" | "resposta" {
  const low = normalizeContactLookupText(raw);
  const isConfirma = /\b(confirm[a-z]*|pode ser|beleza|tudo certo|combinado|ok|okay|sim|fechado|ta bom|ta ok|perfeito|show|topo|combinamos|ate amanha|ate la|estarei|vou sim)\b/.test(low);
  if (isConfirma) return "confirmacao";
  const isRecusa = /\b(nao posso|nao vai dar|remarcar|desmarcar|adiar|outro dia|outro horario|imprevisto|cancelar)\b/.test(low);
  if (isRecusa) return "remarcar";
  return "resposta";
}

async function logOwnerHeadsup(userId: string, content: string, wamid?: string | null) {
  const owner = await resolveTenantOwner(sb, userId);
  if (!owner.phone) return; // sem dono configurado neste tenant → sem heads-up

  const { data: existing } = await sb
    .from("whatsapp_cloud_conversations")
    .select("id")
    .eq("user_id", userId)
    .eq("contact_number", owner.phone)
    .maybeSingle();

  let conversationId = existing?.id;
  if (!conversationId) {
    const { data: created } = await sb
      .from("whatsapp_cloud_conversations")
      .insert({
        user_id: userId,
        contact_number: owner.phone,
        contact_name: owner.name ?? "Dono",
        status: "active",
        last_message_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    conversationId = created?.id;
  }

  if (!conversationId) return;
  await sb.from("whatsapp_cloud_messages").insert({
    conversation_id: conversationId,
    user_id: userId,
    direction: "outbound",
    sender: "agent",
    content,
    message_type: "text",
    wamid: wamid ?? null,
  });
  await sb.from("whatsapp_cloud_conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", conversationId);
}

async function findCommercialContactByPhone(userId: string, phone: string): Promise<any | null> {
  const fromDigits = normalizePhoneBR(phone);
  const fromTail10 = fromDigits.slice(-10);
  const fromTail8 = fromDigits.slice(-8);
  if (!fromTail8) return null;

  const { data, error } = await sb
    .from("contatos_comerciais")
    .select("nome, empresa, cargo, tipo_relacionamento, contexto, proximos_passos, permite_jarvis_contatar, tags, whatsapp")
    .eq("user_id", userId)
    .eq("ativo", true);

  if (error) {
    console.warn("[processor][commercial-contact-lookup] falhou:", error.message);
    return null;
  }

  return (data ?? []).find((c: any) => {
    const cd = normalizePhoneBR(c.whatsapp || "");
    if (!cd) return false;
    return cd === fromDigits || cd.slice(-10) === fromTail10 || cd.slice(-8) === fromTail8;
  }) ?? null;
}

async function transcribeAudioMedia(media: MediaExtract[]): Promise<string> {
  const audio = media.find((m) => m.kind === "audio");
  if (!audio?.base64) return "";

  // 1ª via: endpoint dedicado de speech-to-text (determinístico, não depende do modelo "ouvir").
  try {
    const bytes = Uint8Array.from(atob(audio.base64), (c) => c.charCodeAt(0));
    const mime = (audio.mime || "audio/ogg").split(";")[0];
    const ext = mime.includes("mpeg") || mime.includes("mp3")
      ? "mp3"
      : mime.includes("wav")
      ? "wav"
      : mime.includes("m4a")
      ? "m4a"
      : mime.includes("mp4")
      ? "mp4"
      : "ogg";
    const form = new FormData();
    form.append("model", "openai/gpt-4o-mini-transcribe");
    form.append("file", new Blob([bytes], { type: mime }), `audio.${ext}`);
    const sttRes = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${LOVABLE_API_KEY}` },
      body: form,
    });
    const sttTxt = await sttRes.text();
    if (sttRes.ok) {
      try {
        const j = JSON.parse(sttTxt);
        const t = String(j?.text || "").trim();
        if (t) return t;
      } catch { /* cai no fallback */ }
    } else {
      console.warn(`[processor][stt] ${sttRes.status}: ${sttTxt.slice(0, 200)}`);
    }
  } catch (e) {
    console.warn("[processor][stt] falhou:", (e as Error).message);
  }

  // 2ª via: modelo multimodal ouvindo o áudio.
  const content = buildUserContent(
    "Transcreva literalmente este áudio de WhatsApp em português do Brasil. Responda somente com a transcrição, sem comentários.",
    [audio],
  );
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
    },
    body: JSON.stringify({
      model: escolherModelo({ kind: "multimodal" }),
      temperature: 0,
      messages: [
        { role: "system", content: "Você é um transcritor de áudios de WhatsApp. Nunca invente; se não entender, retorne exatamente: [áudio não compreendido]." },
        { role: "user", content },
      ],
    }),
  });
  const txt = await res.text();
  if (!res.ok) throw new Error(`audio transcript ${res.status}: ${txt.slice(0, 200)}`);
  try {
    const json = JSON.parse(txt);
    return String(json?.choices?.[0]?.message?.content || "").trim();
  } catch {
    return txt.trim();
  }
}


function confirmationNoticeFromReply(match: any, text: string, source: "texto" | "audio"): string | null {
  const intent = classifyCommercialReply(text);
  if (intent !== "confirmacao" && intent !== "remarcar") return null;
  const badge = intent === "confirmacao" ? "✅ CONFIRMAÇÃO" : "⚠️ PRECISA REMARCAR";
  const preview = text.trim().replace(/\s+/g, " ").slice(0, 500);
  const primeiro = String(match?.nome || "contato").split(/\s+/)[0] || "contato";
  return `${badge} — *${match?.nome || "Contato comercial"}*${match?.empresa ? ` (${match.empresa})` : ""} respondeu por ${source} sobre a reunião.\n\n"${preview}"\n\n_Pra responder é só me pedir aqui: "responde pro ${primeiro}: ..."_`;
}

async function notifyOwnerAboutCommercialReply(params: {
  userId: string;
  fromNumber: string;
  match: any;
  inboundText?: string;
  aiSummaryText?: string;
  messageType?: string | null;
}) {
  const { userId, fromNumber, match } = params;
  const tenantOwner = await resolveTenantOwner(sb, userId);
  if (!match || !tenantOwner.phone || fromNumber === tenantOwner.phone) return;

  const inbound = (params.inboundText || "").trim().replace(/\s+/g, " ");
  const aiSummary = (params.aiSummaryText || "").trim().replace(/\s+/g, " ");
  const basis = inbound || aiSummary || String(params.messageType || "mensagem");
  if (!basis) return;

  const intent = classifyCommercialReply(`${inbound}\n${aiSummary}`);
  const badge = intent === "confirmacao" ? "✅ CONFIRMAÇÃO" : intent === "remarcar" ? "⚠️ PRECISA REMARCAR" : "📩 RESPOSTA";
  const sigTag = `[jarvis-headsup:${match.nome}:${shortStableHash(`${fromNumber}|${params.messageType || "text"}|${basis}`)}]`;

  const cutoffNotif = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data: recentOwnerMsgs } = await sb
    .from("whatsapp_cloud_messages")
    .select("content, created_at")
    .eq("user_id", userId)
    .eq("direction", "outbound")
    .gte("created_at", cutoffNotif)
    .order("created_at", { ascending: false })
    .limit(50);
  const jaNotificou = (recentOwnerMsgs ?? []).some((m: any) => String(m.content || "").includes(sigTag));
  if (jaNotificou) return;

  const primeiro = String(match.nome || "contato").split(/\s+/)[0];
  const preview = inbound
    ? `"${inbound.slice(0, 400)}"`
    : `Áudio recebido. Resumo do Jarvis: ${aiSummary.slice(0, 420) || "sem resumo disponível"}`;
  const heads = `${badge} — *${match.nome}*${match.empresa ? ` (${match.empresa})` : ""} respondeu no WhatsApp:\n\n${preview}\n\n_Pra responder é só me pedir aqui: "responde pro ${primeiro}: ..."_\n${sigTag}`;

  const sentId = await sendWhatsApp(userId, tenantOwner.phone, heads);
  await logOwnerHeadsup(userId, heads, sentId);
  console.log(`[processor][headsup-owner] enviado (${badge}) para dono sobre ${match.nome}`);
}

async function notifyOwnerDeterministic(params: {
  userId: string;
  fromNumber: string;
  match: any;
  text: string;
  messageType?: string | null;
  source: "texto" | "audio";
}): Promise<boolean> {
  const clean = (params.text || "").trim().replace(/\s+/g, " ");
  const tenantOwner = await resolveTenantOwner(sb, params.userId);
  if (!clean || !tenantOwner.phone || params.fromNumber === tenantOwner.phone) return false;
  const notice = confirmationNoticeFromReply(params.match, clean, params.source);
  if (!notice) return false;

  const sigTag = `[jarvis-headsup:${params.match?.nome || "contato"}:${shortStableHash(`${params.fromNumber}|deterministic|${params.messageType || params.source}|${clean}`)}]`;
  const cutoffNotif = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data: recentOwnerMsgs } = await sb
    .from("whatsapp_cloud_messages")
    .select("content, created_at")
    .eq("user_id", params.userId)
    .eq("direction", "outbound")
    .gte("created_at", cutoffNotif)
    .order("created_at", { ascending: false })
    .limit(50);
  const jaNotificou = (recentOwnerMsgs ?? []).some((m: any) => String(m.content || "").includes(sigTag));
  if (jaNotificou) return true;

  const content = `${notice}\n${sigTag}`;
  const sentId = await sendWhatsApp(params.userId, tenantOwner.phone, content);
  await logOwnerHeadsup(params.userId, content, sentId);
  console.log(`[processor][headsup-owner-deterministic] enviado para dono sobre ${params.match?.nome || params.fromNumber}`);
  return true;
}

function isOwnerAskingCommercialReplyStatus(text: string): boolean {
  const low = normalizeContactLookupText(text);
  return /\b(respondeu|resposta|retorno|confirmou|confirmado|ok|deu ok|falou|mandou|reuniao|reuniao)\b/.test(low);
}

async function answerOwnerCommercialStatus(userId: string, text: string): Promise<string | null> {
  if (!isOwnerAskingCommercialReplyStatus(text)) return null;
  const contato = await inferContatoComercialFromText(text, userId);
  if (!contato?.whatsapp) return null;

  const targetDigits = normalizePhoneBR(contato.whatsapp);
  const targetTail10 = targetDigits.slice(-10);
  const targetTail8 = targetDigits.slice(-8);
  const { data: convs } = await sb
    .from("whatsapp_cloud_conversations")
    .select("id, contact_number")
    .eq("user_id", userId)
    .order("last_message_at", { ascending: false })
    .limit(500);
  const contactConv = (convs ?? []).find((c: any) => {
    const cd = normalizePhoneBR(c.contact_number || "");
    return cd === targetDigits || cd.slice(-10) === targetTail10 || cd.slice(-8) === targetTail8;
  });
  if (!contactConv?.id) return `Ainda não encontrei conversa recente do ${contato.nome} no WhatsApp.`;

  const { data: msgs } = await sb
    .from("whatsapp_cloud_messages")
    .select("direction, content, message_type, created_at")
    .eq("conversation_id", contactConv.id)
    .order("created_at", { ascending: false })
    .limit(12);

  const inbound = (msgs ?? []).find((m: any) => m.direction === "inbound");
  if (!inbound) return `Ainda não identifiquei resposta do ${contato.nome}. Assim que ele responder, eu te aviso.`;

  const afterInboundAssistant = (msgs ?? [])
    .filter((m: any) => m.direction === "outbound" && new Date(m.created_at).getTime() >= new Date(inbound.created_at).getTime())
    .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0];
  const evidence = `${inbound.content || ""}\n${afterInboundAssistant?.content || ""}`;
  const intent = classifyCommercialReply(evidence);
  const when = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  }).format(new Date(inbound.created_at));
  const preview = String(inbound.content || "").replace(/^🎙️\s*Áudio transcrito:\s*/i, "").replace(/\s+/g, " ").slice(0, 420);
  const assistantUnderstanding = String(afterInboundAssistant?.content || "").replace(/\s+/g, " ").slice(0, 420);

  if (intent === "confirmacao") {
    return `Sim, chefe — o ${contato.nome} respondeu e a reunião está confirmada.\n\nResposta (${when}): ${preview || "áudio recebido"}${assistantUnderstanding ? `\n\nEntendimento do Jarvis: ${assistantUnderstanding}` : ""}`;
  }
  if (intent === "remarcar") {
    return `O ${contato.nome} respondeu (${when}), mas parece que precisa remarcar.\n\nResposta: ${preview || "áudio recebido"}${assistantUnderstanding ? `\n\nEntendimento do Jarvis: ${assistantUnderstanding}` : ""}`;
  }
  return `Sim, chefe — o ${contato.nome} respondeu (${when}).\n\nResposta: ${preview || "áudio recebido"}${assistantUnderstanding ? `\n\nEntendimento do Jarvis: ${assistantUnderstanding}` : ""}`;
}

async function processOne(queueId: string) {
  const { data: claimed, error: claimErr } = await sb
    .from("whatsapp_cloud_inbound_queue")
    .update({
      status: "processing",
      processing_started_at: new Date().toISOString(),
      attempts: undefined as any,
    })
    .eq("id", queueId)
    .eq("status", "received")
    .select("*")
    .maybeSingle();

  if (claimErr) throw claimErr;
  if (!claimed) return { skipped: true, queueId };

  await sb
    .from("whatsapp_cloud_inbound_queue")
    .update({ attempts: (claimed.attempts ?? 0) + 1 })
    .eq("id", queueId);

  const row = claimed as QueueRow;
  let stopTypingHeartbeat = () => {};

  try {
    // PASSO 3 — Resolve tenant + access_token
    let userId = row.user_id;
    let waAccessToken: string | null = null;
    const { data: cfg } = await sb
      .from("whatsapp_config")
      .select("user_id, access_token, connection_method, phone_number_id, business_name")
      .eq("phone_number_id", row.phone_number_id)
      .eq("is_active", true)
      .maybeSingle();
    if (cfg) {
      if (!userId) userId = cfg.user_id;
      // Isolamento multi-tenant: sempre usa o token salvo no row do tenant.
      // Única exceção: número sandbox oficial de dev/teste continua com token global.
      const SANDBOX_PHONE_ID = "1156251107576181";
      waAccessToken = cfg.phone_number_id === SANDBOX_PHONE_ID && WHATSAPP_TEST_ACCESS_TOKEN
        ? WHATSAPP_TEST_ACCESS_TOKEN
        : cfg.access_token ?? null;
    }
    if (!userId) {
      await failQueue(row.id, "tenant_not_found");
      return { ok: false, reason: "tenant_not_found" };
    }
    if (["text", "audio"].includes(row.message_type ?? "")) {
      await sendTypingIndicator(row.phone_number_id, waAccessToken, row.wamid);
      const heartbeat = setInterval(() => {
        void sendTypingIndicator(row.phone_number_id, waAccessToken, row.wamid);
      }, 15000);
      stopTypingHeartbeat = () => clearInterval(heartbeat);
    }

    // PASSO 4 — Config do agente
    const { data: agent } = await sb
      .from("whatsapp_cloud_agent_config")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (!agent || !agent.is_active) {
      await failQueue(row.id, "agent_inactive");
      return { ok: false, reason: "agent_inactive" };
    }

    // PASSO 5 — Upsert conversa
    const { data: existingConv } = await sb
      .from("whatsapp_cloud_conversations")
      .select("*")
      .eq("user_id", userId)
      .eq("contact_number", row.from_number)
      .maybeSingle();

    const contactName =
      row.payload?.profile?.name ??
      row.payload?.contacts?.[0]?.profile?.name ??
      existingConv?.contact_name ??
      null;

    let conv = existingConv;
    if (!conv) {
      const { data: created, error: convErr } = await sb
        .from("whatsapp_cloud_conversations")
        .insert({
          user_id: userId,
          contact_number: row.from_number,
          contact_name: contactName,
          status: "active",
          last_message_at: new Date().toISOString(),
        })
        .select("*")
        .single();
      if (convErr) throw convErr;
      conv = created;
    } else {
      await sb
        .from("whatsapp_cloud_conversations")
        .update({ last_message_at: new Date().toISOString(), contact_name: contactName })
        .eq("id", conv.id);
    }
    const convStateIdentity: ConversationStateIdentity = {
      id: conv.id,
      userId,
      contactNumber: row.from_number,
    };

    const userText = extractText(row.payload);
    let commercialContactForOwner: any = null;
    let inboundContent = userText || `(${row.message_type ?? "mídia"} sem legenda)`;
    const directNearbySearch = row.message_type === "text" ? detectNearbySearch(userText) : null;

    // Captura localização compartilhada
    const loc = row.payload?.location;
    if (loc?.latitude != null && loc?.longitude != null) {
      await sb.from("whatsapp_user_locations").upsert({
        user_id: userId,
        contact_number: row.from_number,
        latitude: Number(loc.latitude),
        longitude: Number(loc.longitude),
        name: loc.name ?? null,
        address: loc.address ?? null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,contact_number" });
      inboundContent = `📍 Localização compartilhada${loc.name ? ` (${loc.name})` : ""}${loc.address ? ` — ${loc.address}` : ""} [${loc.latitude}, ${loc.longitude}]`;
      console.log(`[processor] location saved for ${row.from_number}`);
    }

    // PASSO 6 — Grava inbound
    await sb.from("whatsapp_cloud_messages").insert({
      conversation_id: conv.id,
      user_id: userId,
      direction: "inbound",
      sender: "contact",
      content: inboundContent,
      message_type: row.message_type ?? "text",
      wamid: row.wamid,
    });

    if (conv.status === "handoff") {
      await doneQueue(row.id);
      return { ok: true, handoff: true };
    }

    // PASSO 6.5 — Contexto por tenant (owner / partner / client / stranger)
    // Resolve o dono DESTE tenant e registra pro isOwner(ctx) enxergar.
    const _tenantOwner = await resolveTenantOwner(sb, userId, { fresh: true });
    const tenantOwnerPhone: string | null = _tenantOwner.phone;
    // No tenant AMZ o Felicio tem mais de um número (pessoal + comercial da
    // Comex IA). Todos contam como dono; o encaminhamento continua indo para
    // o número principal (tenantOwnerPhone).
    const isAmzTenantEarly = userId === ADMIN_AMZ_USER_ID;
    const ownerNumbers: string[] = [
      tenantOwnerPhone,
      ..._tenantOwner.altPhones,
      ...(isAmzTenantEarly && isAmzOwnerAltPhone(row.from_number) ? [row.from_number] : []),
    ].filter((p): p is string => !!p);
    setTenantOwnerForCtx(userId, ownerNumbers);
    const fromIsOwner = tenantOwnerMatchesPhone(_tenantOwner, row.from_number)
      || (isAmzTenantEarly && isAmzOwnerAltPhone(row.from_number));


    // =====================================================================
    // OPT-IN GATE (Fase 1 — Meta oficial)
    // Roda ANTES de qualquer fluxo do Silvester/Jarvis/AMZ.
    // Responsabilidades:
    //   1) STOP/opt-out UNIVERSAL — sempre respeita PARE/SAIR/STOP/DESCADASTRAR,
    //      independente do status atual (exigência Meta + LGPD).
    //   2) Captura de resposta ao convite (SIM/NÃO) quando o convite foi
    //      enviado nas últimas 168h.
    //   3) Higiene: convites > 7 dias sem resposta viram "expirado" (não
    //      ficam presos em "convite_enviado" pra sempre).
    // Falha do gate NUNCA bloqueia atendimento — try/catch envolve tudo e
    // qualquer exceção só loga e segue o fluxo normal.
    //
    // NOTA IMPORTANTE (Fase 2): o Template 1 (convite) DEVE usar exatamente
    // estes IDs nos quick-reply buttons: "OPTIN_SIM" e "OPTIN_NAO".
    // Se mudar aqui, atualizar o template na Meta na mesma PR.
    // =====================================================================
    try {
      const phoneLookupVariants = brazilianPhoneLookupVariants(row.from_number);
      if (!phoneLookupVariants.length && row.from_number) {
        phoneLookupVariants.push(row.from_number);
      }
      // O dono normalmente não passa pelo gate (ele conversa como chefe).
      // Exceção: se ELE recebeu um convite (teste/self-onboarding), o gate vale.
      let conviteAbertoParaDono = false;
      if (fromIsOwner && row.from_number) {
        const { data: cv } = await sb
          .from("pj_lista_membros")
          .select("id")
          .eq("user_id", userId)
          .in("telefone", phoneLookupVariants)
          .eq("opt_in_status", "convite_enviado")
          .limit(1);
        conviteAbertoParaDono = !!(cv && cv.length > 0);
      }
      const isOwnerInbound = fromIsOwner && !conviteAbertoParaDono;
      if (!isOwnerInbound && row.from_number) {

        const rawText = (userText || "").toString();
        const normalized = rawText
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .trim();
        // Quick-reply de TEMPLATE chega como payload.button.{payload,text};
        // botão interativo (não-template) chega como interactive.button_reply.id.
        const buttonId: string = row.payload?.interactive?.button_reply?.id ??
          row.payload?.button?.payload ?? "";
        const buttonTextNorm = String(
          row.payload?.button?.text ??
          row.payload?.interactive?.button_reply?.title ?? "",
        )
          .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

        const SIM_TOKENS = new Set([
          "sim", "s", "ok", "pode", "pode sim", "aceito", "confirmo",
          "quero", "aceitar", "confirmar", "sim, quero!", "sim quero",
          "sim, quero",
        ]);
        const NAO_TOKENS_SOFT = new Set(["nao", "não", "n"]);

        // Botões de TODOS os templates da plataforma (multi-tenant):
        //   convite_ebook_v1        → "Sim, quero!" / "Não, obrigado"
        //   novidade_v1            → "Quero ver!"  / "Agora não"
        //   campanha_oferta_img_v1 → "Quero esta oferta!" / "Não quero mais"
        // Qualquer botão positivo confirma o opt-in; qualquer negativo recusa.
        const POSITIVE_BUTTON_PREFIXES = ["sim", "quero", "ver oferta", "quero ver", "quero esta"];
        const NEGATIVE_BUTTON_PREFIXES = ["nao", "agora nao", "nao quero", "sair", "parar"];

        const isStopButton = buttonId === "OPTIN_NAO" ||
          buttonId === "OPTIN_STOP" ||
          buttonId === "STOP" ||
          NEGATIVE_BUTTON_PREFIXES.some((p) => buttonTextNorm.startsWith(p));
        const isStopText = isWhatsAppOptOutRequest({
          text: rawText,
          isOwner: fromIsOwner,
        });
        const isSimButton = buttonId === "OPTIN_SIM" ||
          (!!buttonTextNorm && !isStopButton &&
            POSITIVE_BUTTON_PREFIXES.some((p) => buttonTextNorm.startsWith(p)));
        const isSimText = SIM_TOKENS.has(normalized) || normalized.startsWith("sim, quero") || normalized.startsWith("sim quero") || normalized.startsWith("quero ver");
        const isSoftNao = NAO_TOKENS_SOFT.has(normalized);

        const { data: membrosDoTelefone } = await sb
          .from("pj_lista_membros")
          .select("id, nome, telefone, opt_in_status, convite_enviado_em, convite_template_id")
          .eq("user_id", userId)
          .in("telefone", phoneLookupVariants);

        // Helper: registra log de auditoria (best-effort)
        const logOptIn = async (
          status: "confirmado" | "recusado" | "expirado",
          origem: string,
          extra: Record<string, unknown> = {},
        ) => {
          try {
            await sb.from("opt_in_log").insert({
              user_id: userId,
              telefone: row.from_number,
              status_novo: status,
              origem,
              canal: "whatsapp_cloud",
              texto_original: rawText.slice(0, 500),
              payload_extra: {
                button_id: buttonId || null,
                message_type: row.message_type,
                ...extra,
              },
            });
          } catch (e) {
            console.warn("[opt-in-gate][log] falhou:", (e as Error).message);
          }
        };

        // --- (1) STOP/opt-out UNIVERSAL — vale SEMPRE ----------------------
        // Independe do status atual do membro (ou de existir membro).
        // Só não redispara se já estiver "recusado".
        if (isStopButton || isStopText) {
          const membros = membrosDoTelefone || [];
          const jaRecusado = membros.length > 0 &&
            membros.every(m => m.opt_in_status === "recusado");
          const nowIso = new Date().toISOString();

          if (!jaRecusado) {
            if (membros.length > 0) {
              await sb
                .from("pj_lista_membros")
                .update({
                  opt_in_status: "recusado",
                  opt_in_origem: "stop_universal",
                  opt_in_em: nowIso,
                })
                .in("id", membros.map((m) => m.id));
            } else {
              // Sem membro cadastrado — cria um marcador de recusa para
              // garantir que campanhas futuras respeitem o opt-out.
              await sb.from("pj_lista_membros").insert({
                user_id: userId,
                telefone: row.from_number,
                opt_in_status: "recusado",
                opt_in_origem: "stop_universal_sem_membro",
                opt_in_em: nowIso,
              });
            }
            await logOptIn("recusado", "stop_universal");
            await registrarOfertaEbook(sb, userId, row.from_number, null, "recusado", "stop_universal");
          }

          // Resposta de despedida (dentro da janela 24h — texto livre, ok).
          try {
            const despedida = "Combinado, não vamos mais te enviar campanhas. Se mudar de ideia, é só chamar aqui. 👋";
            await sendWhatsApp(userId, row.from_number, despedida);
            await sb.from("whatsapp_cloud_messages").insert({
              conversation_id: conv.id,
              user_id: userId,
              direction: "outbound",
              sender: "agent",
              content: despedida,
              message_type: "text",
            });
          } catch (e) {
            console.warn("[opt-in-gate][stop][reply] falhou:", (e as Error).message);
          }

          console.log(`[opt-in-gate] STOP universal aplicado tenant=${userId} from=${row.from_number} ja_recusado=${jaRecusado}`);
          await doneQueue(row.id);
          return { ok: true, opt_in_gate: "recusado_stop_universal" };
        }

        // --- (2) Captura de resposta ao convite ---------------------------
        // Só olha membros com convite enviado.
        const membrosConvidados = (membrosDoTelefone || [])
          .filter((m) => m.opt_in_status === "convite_enviado");

        if (membrosConvidados && membrosConvidados.length > 0) {
          const SETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;
          const agora = Date.now();

          // Separa dentro/fora da janela de 7 dias.
          const dentroJanela: typeof membrosConvidados = [];
          const foraJanela: typeof membrosConvidados = [];
          for (const m of membrosConvidados) {
            const enviadoEm = m.convite_enviado_em ? new Date(m.convite_enviado_em).getTime() : 0;
            if (enviadoEm && (agora - enviadoEm) <= SETE_DIAS_MS) dentroJanela.push(m);
            else foraJanela.push(m);
          }

          // --- (3) Higiene: expira quem passou de 7 dias sem responder ---
          if (foraJanela.length > 0) {
            const ids = foraJanela.map(m => m.id);
            await sb
              .from("pj_lista_membros")
              .update({ opt_in_status: "expirado" })
              .in("id", ids);
            await logOptIn("expirado", "janela_7d_sem_resposta", { membros_expirados: ids.length });
            console.log(`[opt-in-gate] ${ids.length} convite(s) expirados tenant=${userId} from=${row.from_number}`);
          }

          if (dentroJanela.length > 0) {
            const idsDentro = dentroJanela.map(m => m.id);
            const nowIso = new Date().toISOString();
            const conviteMaisRecente = [...dentroJanela].sort((a, b) =>
              String(b.convite_enviado_em || "").localeCompare(String(a.convite_enviado_em || ""))
            )[0];

            if (
              !isSimButton &&
              !isSimText &&
              !isSoftNao &&
              isLikelyBusinessAutoReply({
                text: rawText,
                invitationSentAt: conviteMaisRecente?.convite_enviado_em,
                receivedAt: row.created_at,
                buttonId,
              })
            ) {
              console.log(`[opt-in-gate] auto-resposta ignorada tenant=${userId} from=${row.from_number}`);
              await doneQueue(row.id);
              return { ok: true, opt_in_gate: "auto_resposta_ignorada" };
            }

            if (isSimButton || isSimText) {
              await sb
                .from("pj_lista_membros")
                .update({
                  opt_in_status: "confirmado",
                  opt_in_origem: isSimButton ? "convite_botao_sim" : "convite_texto_sim",
                  opt_in_em: nowIso,
                })
                .in("id", idsDentro);
              await logOptIn("confirmado", isSimButton ? "convite_botao_sim" : "convite_texto_sim");
              await notificarDonoOptinAceito(
                userId,
                row.from_number,
                (conv as any).contact_name ?? null,
                isSimButton ? "botao_sim" : "resposta_sim",
              );


              try {
                const ebookTenant = await getTenantEbook(sb, userId);
                const fallbackBoasVindas = ebookTenant
                  ? "Show! Você está na lista. 🎉 Já vou te mandar seu presente aqui."
                  : "Show! Você está na lista. 🎉 Em breve mandaremos novidades e ofertas selecionadas.";
                let inviteTemplate: {
                  nome_meta?: string | null;
                  tipo_uso?: string | null;
                  variaveis_map?: Record<string, unknown> | null;
                } | null = null;
                if (conviteMaisRecente?.convite_template_id) {
                  const { data: template } = await sb
                    .from("whatsapp_templates")
                    .select("nome_meta, tipo_uso, variaveis_map")
                    .eq("id", conviteMaisRecente.convite_template_id)
                    .eq("user_id", userId)
                    .maybeSingle();
                  inviteTemplate = template as typeof inviteTemplate;
                }
                const rawBoasVindas = resolveInviteConfirmation({
                  isAmzTenant: userId === ADMIN_AMZ_USER_ID,
                  template: inviteTemplate,
                  contactName: conviteMaisRecente?.nome ?? (conv as any).contact_name ?? null,
                  fallback: fallbackBoasVindas,
                });
                const boasVindas = finalizeAmzInboundReply({
                  text: rawBoasVindas,
                  isAmzTenant: isAmzTenantEarly,
                  inboundFromOwner: fromIsOwner,
                  ownerName: _tenantOwner?.name,
                });
                await sendWhatsApp(userId, row.from_number, boasVindas);
                await sb.from("whatsapp_cloud_messages").insert({
                  conversation_id: conv.id,
                  user_id: userId,
                  direction: "outbound",
                  sender: "agent",
                  content: boasVindas,
                  message_type: "text",
                });

                // ENTREGA DO EBOOK DO TENANT (janela 24h aberta pela resposta).
                if (ebookTenant) {
                  const r = await entregarEbookTenant({
                    sb,
                    userId,
                    telefone: row.from_number,
                    origem: "optin_convite_sim",
                    supabaseUrl: SUPABASE_URL,
                    serviceKey: SERVICE_KEY,
                  });
                  console.log(`[ebook] optin_sim tenant=${userId} enviado=${r.enviado} motivo=${r.motivo ?? "-"}`);
                  if (r.enviado) {
                    await sb.from("whatsapp_cloud_messages").insert({
                      conversation_id: conv.id,
                      user_id: userId,
                      direction: "outbound",
                      sender: "agent",
                      content: `[ebook] ${ebookTenant.nome} enviado em PDF`,
                      message_type: "document",
                    });
                  }
                }
              } catch (e) {
                console.warn("[opt-in-gate][sim][reply] falhou:", (e as Error).message);
              }


              console.log(`[opt-in-gate] SIM capturado tenant=${userId} from=${row.from_number} membros=${idsDentro.length}`);
              await doneQueue(row.id);
              return { ok: true, opt_in_gate: "confirmado" };
            }

            if (isSoftNao) {
              // Recusa é permanente para todas as listas deste tenant.
              const idsDoTelefone = (membrosDoTelefone || []).map((m) => m.id);
              await sb
                .from("pj_lista_membros")
                .update({
                  opt_in_status: "recusado",
                  opt_in_origem: "convite_texto_nao",
                  opt_in_em: nowIso,
                })
                .in("id", idsDoTelefone);
              await logOptIn("recusado", "convite_texto_nao");
              await registrarOfertaEbook(sb, userId, row.from_number, null, "recusado", "convite_texto_nao");

              try {
                const despedida = "Combinado, não vamos te incomodar. Se mudar de ideia, é só chamar aqui. 👋";
                await sendWhatsApp(userId, row.from_number, despedida);
                await sb.from("whatsapp_cloud_messages").insert({
                  conversation_id: conv.id,
                  user_id: userId,
                  direction: "outbound",
                  sender: "agent",
                  content: despedida,
                  message_type: "text",
                });
              } catch (e) {
                console.warn("[opt-in-gate][nao][reply] falhou:", (e as Error).message);
              }

              console.log(`[opt-in-gate] NÃO capturado tenant=${userId} from=${row.from_number} membros=${idsDentro.length}`);
              await doneQueue(row.id);
              return { ok: true, opt_in_gate: "recusado_convite" };
            }
            // Se não classificou SIM/NÃO, NÃO consome — deixa o Silvester/Jarvis
            // responder normalmente e mantém convite_enviado (dentro da janela).
          }
        }
      }
    } catch (e) {
      // Falha do gate NUNCA deve derrubar o atendimento.
      console.error("[opt-in-gate] falha (seguindo fluxo normal):", (e as Error).message);
    }
    // ================== FIM OPT-IN GATE ==================================

    // Leads costumam enviar a ideia em várias mensagens curtas. A mensagem mais
    // nova responde com todo o histórico; as anteriores encerram sem duplicar.
    if (!fromIsOwner && row.message_type === "text") {
      const grouped = await groupIfNewerLeadTextExists(row);
      if (grouped) return { ok: true, status: "grouped", queueId: row.id };
    }

    const isAmzTenant = userId === ADMIN_AMZ_USER_ID;
    const isAmzMode = (agent as any).agent_mode === "amz" && isAmzTenant;

    let amzContextBlock: string | undefined;
    // Papel do agente no modo AMZ. DEFAULT "support": no ambíguo, atende.
    // Só vira "sales" com LEAD NOVO confirmado (access === "stranger").
    let amzAudience: "sales" | "support" = "support";
    // Roda buildAmzContext quando: (a) é o tenant AMZ (comportamento clássico),
    // ou (b) qualquer tenant que tenha owner_phone configurado — só pra
    // reconhecer o dono e injetar o bloco minimalista.
    if (isAmzMode || tenantOwnerPhone) {
      const amzCtx = await buildAmzContext(sb, row.from_number, userId);
      console.log(`[processor][ctx] tenant=${userId} from=${row.from_number} access=${amzCtx.access}`);

      // LEAD NOVO: não corta mais o atendimento. O bloco de contexto
      // "LEAD NOVO" (amz-context) faz o Pietro Eugenio atender do início ao
      // fim, sem repassar nenhum outro número de WhatsApp.
      if (amzCtx.access === "stranger") amzAudience = "sales";

      if (amzCtx.block) amzContextBlock = amzCtx.block;
    }


    // "answerOwnerCommercialStatus" é uma feature Jarvis específica pra Felicio
    // consultar contatos comerciais dele — só faz sentido no tenant AMZ.
    if (isAmzTenant && fromIsOwner && row.message_type === "text" && userText.trim()) {
      const statusReply = await answerOwnerCommercialStatus(userId, userText);
      if (statusReply) {
        const { data: outMsg } = await sb
          .from("whatsapp_cloud_messages")
          .insert({
            conversation_id: conv.id,
            user_id: userId,
            direction: "outbound",
            sender: "agent",
            content: statusReply,
            message_type: "text",
          })
          .select("id")
          .single();

        let sendError: string | null = null;
        try {
          const sentId = await sendWhatsApp(userId, row.from_number, statusReply);
          if (sentId && outMsg?.id) {
            await sb.from("whatsapp_cloud_messages").update({ wamid: sentId }).eq("id", outMsg.id);
          }
        } catch (e) {
          sendError = String((e as Error).message ?? e);
        }

        await sb.from("whatsapp_cloud_conversations").update({ last_message_at: new Date().toISOString() }).eq("id", conv.id);
        if (sendError) {
          await failQueue(row.id, `send_failed: ${sendError}`);
          return { ok: false, reason: "send_failed", error: sendError };
        }
        await doneQueue(row.id);
        return { ok: true, commercial_status_checked: true, reply_preview: statusReply.slice(0, 120) };
      }
    }

    // Atalho determinístico: pedidos explícitos de lugar próximo não dependem da IA chamar tool.
    // Isso evita respostas falsas de "permissão bloqueada" quando a localização já está salva.
    if (directNearbySearch && userId) {
      console.log(`[processor][nearby-direct] from=${row.from_number} query=${directNearbySearch.query}`);
      const rawNearby = await toolBuscarLugaresProximos(
        { userId, fromNumber: row.from_number },
        directNearbySearch.query,
        directNearbySearch.radiusMeters,
      );
      const reply = formatNearbyReply(rawNearby, directNearbySearch.query);

      const { data: outMsg } = await sb
        .from("whatsapp_cloud_messages")
        .insert({
          conversation_id: conv.id,
          user_id: userId,
          direction: "outbound",
          sender: "agent",
          content: reply,
          message_type: "text",
        })
        .select("id")
        .single();

      let sendError: string | null = null;
      try {
        const mediaReplyParts = reply.split("<<SPLIT>>")
          .map((part) => part.trim())
          .filter(Boolean);
        const sentId = await sendWhatsApp(
          userId,
          row.from_number,
          mediaReplyParts[0] ?? reply,
        );
        for (const part of mediaReplyParts.slice(1)) {
          await sendWhatsApp(userId, row.from_number, part);
        }
        if (sentId && outMsg?.id) {
          await sb.from("whatsapp_cloud_messages").update({ wamid: sentId }).eq("id", outMsg.id);
        }
      } catch (e) {
        sendError = String((e as Error).message ?? e);
      }

      await sb.from("whatsapp_cloud_conversations").update({ last_message_at: new Date().toISOString() }).eq("id", conv.id);

      if (sendError) {
        await failQueue(row.id, `send_failed: ${sendError}`);
        return { ok: false, reason: "send_failed", error: sendError };
      }

      await doneQueue(row.id);
      return { ok: true, direct_nearby: true, reply_preview: reply.slice(0, 120) };
    }

    // PASSO 8 — Janela 24h (WhatsApp Cloud)
    // A regra da Meta: o negócio pode responder livremente por 24h APÓS a última
    // mensagem do usuário. Qualquer inbound recém-chegado RESETA a janela — então
    // referenciamos o inbound ATUAL (row.created_at), não o anterior. O dono do
    // agente é sempre exempto: responder pro próprio Marcelo não pode ser bloqueado.
    if (!fromIsOwner) {
      const currentInboundTs = (row as any).created_at ? new Date((row as any).created_at).getTime() : Date.now();
      const ageMs = Date.now() - currentInboundTs;
      if (ageMs > 24 * 60 * 60 * 1000) {
        console.warn(`[processor][24h] inbound antigo demais (${Math.round(ageMs/3600000)}h) — bloqueando resposta`);
        await failQueue(row.id, "outside_24h_window");
        return { ok: false, reason: "outside_24h_window" };
      }
    }


    // PASSO 4.5 — Quota
    let { data: quota } = await sb
      .from("ai_messages_quota")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (!quota) {
      const ins = await sb
        .from("ai_messages_quota")
        .insert({ user_id: userId })
        .select("*")
        .single();
      quota = ins.data;
    }

    if (quota && new Date(quota.reset_at).getTime() <= Date.now()) {
      const nextReset = new Date();
      nextReset.setUTCMonth(nextReset.getUTCMonth() + 1, 1);
      nextReset.setUTCHours(0, 0, 0, 0);
      const r = await sb
        .from("ai_messages_quota")
        .update({ used_count: 0, reset_at: nextReset.toISOString() })
        .eq("user_id", userId)
        .select("*")
        .single();
      quota = r.data;
    }

    if (!quota?.is_enabled) {
      await sb.from("whatsapp_cloud_conversations").update({ status: "handoff" }).eq("id", conv.id);
      await failQueue(row.id, "ai_disabled");
      return { ok: false, reason: "ai_disabled" };
    }
    if (quota.used_count >= quota.monthly_limit) {
      await sb.from("whatsapp_cloud_conversations").update({ status: "handoff" }).eq("id", conv.id);
      await failQueue(row.id, "quota_exceeded");
      return { ok: false, reason: "quota_exceeded" };
    }

    // PASSO 6.7 — Baixa mídias
    let media: MediaExtract[] = [];
    let mediaRejections: MediaRejection[] = [];
    if (waAccessToken && ["image", "audio", "video", "document"].includes(row.message_type ?? "")) {
      const dl = await downloadAllMediaDetailed(row.payload, waAccessToken);
      media = dl.items;
      mediaRejections = dl.rejections;
      console.log(`[processor] media baixadas: ${media.length} | recusadas: ${mediaRejections.length}`);
    }

    // Rejeição por tamanho NUNCA é silenciosa: avisa o remetente e encerra o turno.
    const tooLarge = mediaRejections.filter((r) => r.reason === "too_large");
    if (media.length === 0 && tooLarge.length > 0) {
      const maiorMb = Math.max(...tooLarge.map((r) => (r.bytes ?? 0))) / 1048576;
      console.warn(
        `[processor][media_too_large] user=${userId} from=${row.from_number} tipo=${row.message_type} bytes_max=${maiorMb.toFixed(2)}MB limite=${(tooLarge[0].limitBytes / 1048576).toFixed(0)}MB`,
      );
      const kind = tooLarge[0].kind;
      const label = kind === "video" ? "vídeo" : kind === "image" ? "imagem" : kind === "audio" ? "áudio" : "arquivo";
      const aviso = kind === "video"
        ? "Recebi seu vídeo, mas ele passou do tamanho que consigo processar por aqui. Manda uma versão menor ou mais curta que eu sigo com as legendas."
        : `Recebi seu ${label}, mas ele passou do tamanho que consigo processar por aqui. Manda uma versão menor que eu sigo daqui.`;
      try {
        await sendWhatsApp(userId, row.from_number, aviso);
        await sb.from("whatsapp_cloud_messages").insert({
          conversation_id: conv.id,
          direction: "outbound",
          message_type: "text",
          content: aviso,
        });
      } catch (e) {
        console.error("[processor][media_too_large] falha ao avisar remetente:", (e as Error).message);
      }
      await doneQueue(row.id);
      return { ok: true, reason: "media_too_large" };
    }


    // Falha de download (token expirado / Graph fora) também nunca é silenciosa.
    const falhouDownload = mediaRejections.filter((r) => r.reason !== "too_large");
    if (media.length === 0 && falhouDownload.length > 0) {
      console.error(
        `[processor][media_download_failed] user=${userId} tipo=${row.message_type} motivos=${falhouDownload.map((r) => r.reason).join(",")}`,
      );
      const aviso = "Recebi seu arquivo, mas não consegui baixar ele agora (falha na conexão com o WhatsApp). Manda de novo, por favor.";
      try {
        await sendWhatsApp(userId, row.from_number, aviso);
        await sb.from("whatsapp_cloud_messages").insert({
          conversation_id: conv.id,
          direction: "outbound",
          message_type: "text",
          content: aviso,
        });
      } catch (e) {
        console.error("[processor][media_download_failed] falha ao avisar remetente:", (e as Error).message);
      }
      await doneQueue(row.id);
      return { ok: true, reason: "media_download_failed" };
    }

    // REGRA FIXA: todo áudio recebido é transcrito por STT dedicado (determinístico).
    // O agente NUNCA pode dizer que "não transcreve áudio" — o texto já chega pronto.
    let audioTranscript = "";
    if (media.some((m) => m.kind === "audio")) {
      try {
        audioTranscript = await transcribeAudioMedia(media);
        if (audioTranscript) {
          inboundContent = `🎙️ Áudio transcrito: ${audioTranscript}`;
          await sb
            .from("whatsapp_cloud_messages")
            .update({ content: inboundContent })
            .eq("conversation_id", conv.id)
            .eq("wamid", row.wamid);
        }
        console.log(`[processor][audio] transcricao_len=${audioTranscript.length}`);
      } catch (e) {
        console.warn("[processor][audio-transcribe] falhou:", (e as Error).message);
      }
    }

    if (!fromIsOwner && row.message_type === "audio") {
      commercialContactForOwner = await findCommercialContactByPhone(userId, row.from_number);
      if (commercialContactForOwner && audioTranscript) {
        try {
          await notifyOwnerDeterministic({
            userId,
            fromNumber: row.from_number,
            match: commercialContactForOwner,
            text: audioTranscript,
            messageType: row.message_type,
            source: "audio",
          });
        } catch (e) {
          console.warn("[processor][audio-transcribe-headsup] falhou:", (e as Error).message);
        }
      }
    }


    // Regra determinística: foto/vídeo enviado no WhatsApp vira mídia livre em /midias.
    // Não deixa a IA buscar produto parecido no catálogo nem preparar post com imagem errada.
    const freshLibraryMedia = media.filter((m) => m.kind === "image" || m.kind === "video");
    if (freshLibraryMedia.length > 0) {
      const contexto = (userText || freshLibraryMedia.map((m) => m.caption).filter(Boolean).join(" ") || "").trim();
      const stateConversation = {
        id: conv.id,
        userId,
        contactNumber: row.from_number,
      };
      const freshAgentState = await loadAgentState(sb, stateConversation);
      if (fromIsOwner) {
        await clearExpiredAnuncioPendingState(
          stateConversation,
          freshAgentState,
        );
      }
      const rawPendingVideoIdentity = fromIsOwner
        ? freshAgentState.pending_video_setup
        : null;
      const pendingVideoIdentityAge = Date.now() -
        new Date(rawPendingVideoIdentity?.created_at || "").getTime();
      const pendingVideoIdentity = rawPendingVideoIdentity &&
          Number.isFinite(pendingVideoIdentityAge) &&
          pendingVideoIdentityAge <= 10 * 60 * 1000
        ? rawPendingVideoIdentity
        : null;
      const incomingLogo = freshLibraryMedia.find((item) => item.kind === "image");
      const pendingBrandUpload = fromIsOwner
        && !pendingVideoIdentity
        && freshAgentState.pending_brand_generation?.stage === "awaiting_logo_upload"
        ? freshAgentState.pending_brand_generation
        : null;
      if (pendingBrandUpload && incomingLogo) {
        const pendingAge = Date.now() - new Date(pendingBrandUpload.created_at).getTime();
        if (Number.isFinite(pendingAge) && pendingAge <= 10 * 60 * 1000) {
          console.log(
            "[lote] fotos=1 bloqueado_por=pending_brand_generation oferta=não motivo=fluxo_logo",
          );
          console.log("[lote] aguardando_mais_fotos=não");
          const logoPath = await uploadClientLogoData(
            userId,
            `data:${incomingLogo.mime};base64,${incomingLogo.base64}`,
            "brand-image-temp",
          );
          let reply = "Não consegui preparar essa logo. Envie PNG, JPEG ou WEBP com até 5 MB.";
          let previewUrl: string | undefined;
          let buttons: WhatsAppInteractiveButtons | undefined;
          if (logoPath) {
            const extension = logoPath.split(".").pop()?.toLowerCase();
            const logoMime = extension === "jpg" || extension === "jpeg"
              ? "image/jpeg"
              : extension === "webp"
              ? "image/webp"
              : extension === "svg"
              ? "image/svg+xml"
              : "image/png";
            const next: PendingBrandGeneration = {
              ...pendingBrandUpload,
              stage: "awaiting_uploaded_logo_confirmation",
              logo_candidate_path: logoPath,
              logo_candidate_mime: logoMime,
            };
            await saveAgentState(sb, stateConversation, {
              pending_brand_generation: next,
            }, freshAgentState);
            freshAgentState.pending_brand_generation = next;
            const signed = await sb.storage.from("tenant-logos").createSignedUrl(logoPath, 30 * 60);
            previewUrl = signed.data?.signedUrl;
            reply = "Recebi esta logo. Quer cadastrá-la ou usar somente nesta imagem?";
            buttons = {
              header: "Confirmar logo",
              body: "Só salvo como sua logo com sua confirmação.",
              buttons: whatsAppUploadedLogoConfirmationButtons(),
            };
          }
          const { data: outMsg } = await sb
            .from("whatsapp_cloud_messages")
            .insert({
              conversation_id: conv.id,
              user_id: userId,
              direction: "outbound",
              sender: "agent",
              content: previewUrl ? `${reply}\n\n[imagem: ${previewUrl}]` : reply,
              message_type: previewUrl ? "image" : "text",
            })
            .select("id")
            .single();
          try {
            const sentId = await sendWhatsApp(
              userId,
              row.from_number,
              reply,
              previewUrl,
              undefined,
              buttons,
            );
            if (sentId && outMsg?.id) {
              await sb.from("whatsapp_cloud_messages").update({ wamid: sentId }).eq("id", outMsg.id);
            }
          } catch (error) {
            const sendError = error instanceof Error ? error.message : String(error);
            await failQueue(row.id, `send_failed: ${sendError}`);
            return { ok: false, reason: "send_failed", error: sendError };
          }
          await doneQueue(row.id);
          return { ok: true, awaiting_uploaded_brand_logo_confirmation: !!logoPath };
        }
        await saveAgentState(sb, stateConversation, {
          pending_brand_generation: null,
        }, freshAgentState);
        freshAgentState.pending_brand_generation = null;
      }
      const waitingForClientLogo = pendingVideoIdentity?.identidade === "client";
      if (waitingForClientLogo && incomingLogo) {
        console.log(
          "[lote] fotos=1 bloqueado_por=pending_video_setup oferta=não motivo=fluxo_logo",
        );
        console.log("[lote] aguardando_mais_fotos=não");
        const logoPath = await uploadClientLogoData(
          userId,
          `data:${incomingLogo.mime};base64,${incomingLogo.base64}`,
          "client-brands",
        );
        let reply: string;
        if (!logoPath) {
          reply = "Não consegui salvar essa logo. Envie em PNG, JPEG ou WEBP com até 5 MB.";
        } else {
          const previousLogoPath = pendingVideoIdentity.logo_path;
          const previousCandidatePath = pendingVideoIdentity.site_logo_candidate_path;
          const clientName = extractClientNameFromLogoRequest(contexto)
            || pendingVideoIdentity.marca
            || (pendingVideoIdentity.site ? videoSiteDomain(pendingVideoIdentity.site) : "Cliente");
          const identityColors = pendingVideoIdentity.palette_candidates
            ?? pendingVideoIdentity.palette_options?.map((option) => option.hex)
            ?? [];
          const identitySummary = `${clientName} — logo enviada${
            identityColors.length ? ` + cores ${identityColors.slice(0, 4).join(" · ")}` : ""
          }`;
          const nextSetup: PendingVideoSetupState = {
            ...pendingVideoIdentity,
            stage: "awaiting_palette_confirmation",
            marca: clientName,
            logo_path: logoPath,
            site_logo_candidate_path: undefined,
            identity_summary: identitySummary,
          };
          const persisted = await persistVideoSetup({
            userId,
            fromNumber: row.from_number,
            convId: conv.id,
            agentState: freshAgentState,
          }, nextSetup);
          if (!persisted) {
            await sb.storage.from("tenant-logos").remove([logoPath]);
          } else if (
            previousLogoPath
            && previousLogoPath !== logoPath
            && previousLogoPath.startsWith(`${userId}/video-site/`)
          ) {
            await sb.storage.from("tenant-logos").remove([previousLogoPath]);
          }
          if (persisted && previousCandidatePath && previousCandidatePath !== logoPath) {
            await sb.storage.from("tenant-logos").remove([previousCandidatePath]);
          }
          if (persisted) {
            try {
              await saveClientBrandIdentity(sb, {
                userId,
                clientName,
                siteUrl: pendingVideoIdentity.site,
                logoPath,
                identity: { logo_origem: "whatsapp_manual" },
              });
            } catch (error) {
              console.error("[client-brand][video-logo-save]", error);
            }
            reply = await finalizeVideoSetup({
              userId,
              fromNumber: row.from_number,
              convId: conv.id,
              agentState: freshAgentState,
            }, nextSetup);
          } else {
            reply = "Recebi a logo, mas não consegui vinculá-la ao pedido. Envie o arquivo novamente.";
          }
        }

        const { data: outMsg } = await sb
          .from("whatsapp_cloud_messages")
          .insert({
            conversation_id: conv.id,
            user_id: userId,
            direction: "outbound",
            sender: "agent",
            content: reply,
            message_type: "text",
          })
          .select("id")
          .single();
        try {
          const sentId = await sendWhatsApp(userId, row.from_number, reply);
          if (sentId && outMsg?.id) {
            await sb.from("whatsapp_cloud_messages").update({ wamid: sentId }).eq("id", outMsg.id);
          }
        } catch (error) {
          const sendError = error instanceof Error ? error.message : String(error);
          await failQueue(row.id, `send_failed: ${sendError}`);
          return { ok: false, reason: "send_failed", error: sendError };
        }
        await sb.from("whatsapp_cloud_conversations")
          .update({ last_message_at: new Date().toISOString() })
          .eq("id", conv.id);
        await doneQueue(row.id);
        return { ok: true, video_client_logo_received: !!logoPath };
      }

      const pendingClientLogoIntent = fromIsOwner
        ? freshAgentState.pending_client_logo_intent
        : null;
      if (pendingClientLogoIntent && incomingLogo) {
        const age = Date.now() - new Date(pendingClientLogoIntent.created_at).getTime();
        if (Number.isFinite(age) && age <= 10 * 60 * 1000) {
          console.log(
            "[lote] fotos=1 bloqueado_por=pending_client_logo oferta=não motivo=fluxo_logo",
          );
          console.log("[lote] aguardando_mais_fotos=não");
          const logoPath = await uploadClientLogoData(
            userId,
            `data:${incomingLogo.mime};base64,${incomingLogo.base64}`,
            "client-brands",
          );
          let registered = false;
          let reply = "Não consegui salvar essa logo. Envie em PNG, JPEG ou WEBP com até 5 MB.";
          let resumedImageUrl: string | undefined;
          let resumedButtons: WhatsAppInteractiveButtons | undefined;
          if (logoPath) {
            try {
              const matches = await listClientBrandIdentityMatches(
                sb,
                userId,
                pendingClientLogoIntent.client_name,
              );
              if (matches.length > 1) {
                await saveAgentState(sb, stateConversation, {
                  pending_client_logo_intent: null,
                  pending_client_logo: {
                    logo_path: logoPath,
                    created_at: new Date().toISOString(),
                    variant: pendingClientLogoIntent.variant ?? "default",
                  },
                }, freshAgentState);
                reply = `Encontrei mais de um cliente parecido: ${matches.map((item) => item.client_name).join(", ")}. De qual deles é a logo?`;
              } else {
                const saved = await saveClientBrandIdentity(sb, {
                  userId,
                  clientName: matches[0]?.client_name || pendingClientLogoIntent.client_name,
                  logoPath,
                  logoVariant: pendingClientLogoIntent.variant ?? "default",
                  identity: { logo_origem: "whatsapp_manual" },
                });
                await saveAgentState(sb, stateConversation, {
                  pending_client_logo_intent: null,
                  pending_client_logo: null,
                }, freshAgentState);
                freshAgentState.pending_client_logo_intent = null;
                registered = true;
                reply = `Guardei como logo do ${saved.client_name}. Vou usar nos vídeos e posts desse cliente.${
                  saved.identity?.logo_background_warning
                    ? `\n\n${saved.identity.logo_background_warning}`
                    : ""
                }`;
                if (pendingClientLogoIntent.anuncio_args) {
                  const resumed = await toolCriarAnuncio({
                    ...pendingClientLogoIntent.anuncio_args,
                    cliente: saved.client_name,
                    site: saved.site_url || undefined,
                  } as any, {
                    userId,
                    fromNumber: row.from_number,
                    media: [],
                    convId: conv.id,
                    agentState: freshAgentState,
                  });
                  try {
                    const parsed = JSON.parse(resumed);
                    reply = parsed?.ok
                      ? `Logo salva. ${parsed.mensagem}`
                      : `${reply}\n\n${parsed?.mensagem || "Não consegui retomar o anúncio."}`;
                    resumedImageUrl = parsed?.image_url;
                    resumedButtons = parsed?.interactive_buttons;
                  } catch {
                    reply = `${reply}\n\n${resumed}`;
                  }
                }
              }
            } catch (error) {
              console.error("[client-brand][pending-intent-save]", error);
              await sb.storage.from("tenant-logos").remove([logoPath]);
              reply = "Recebi a imagem, mas não consegui concluir o cadastro. Envie novamente ou responda *cancelar*.";
            }
          }

          const { data: outMsg } = await sb
            .from("whatsapp_cloud_messages")
            .insert({
              conversation_id: conv.id,
              user_id: userId,
              direction: "outbound",
              sender: "agent",
              content: reply,
              message_type: "text",
            })
            .select("id")
            .single();
          try {
            const sentId = await sendWhatsApp(
              userId,
              row.from_number,
              reply,
              resumedImageUrl,
              undefined,
              resumedButtons,
            );
            if (sentId && outMsg?.id) {
              await sb.from("whatsapp_cloud_messages").update({ wamid: sentId }).eq("id", outMsg.id);
            }
          } catch (error) {
            const sendError = error instanceof Error ? error.message : String(error);
            await failQueue(row.id, `send_failed: ${sendError}`);
            return { ok: false, reason: "send_failed", error: sendError };
          }
          await doneQueue(row.id);
          return { ok: true, client_logo_registered: registered };
        }
        await saveAgentState(sb, stateConversation, {
          pending_client_logo_intent: null,
        }, freshAgentState);
        freshAgentState.pending_client_logo_intent = null;
      }

      let salvos: Awaited<ReturnType<typeof salvarItemMidiaBiblioteca>>[];
      try {
        salvos = await Promise.all(
          freshLibraryMedia.map((m) =>
            salvarItemMidiaBiblioteca(
              m,
              { userId, fromNumber: row.from_number },
              contexto,
            )
          ),
        );
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        console.error(
          `[processor][media_save_failed] user=${userId} from=${row.from_number} tipo=${row.message_type}:`,
          detail,
        );
        const aviso = whatsAppMediaSaveFailureMessage(
          freshLibraryMedia.some((item) => item.kind === "video"),
        );
        let outMessageId: string | undefined;
        try {
          const { data: outMsg, error: outError } = await sb
            .from("whatsapp_cloud_messages")
            .insert({
              conversation_id: conv.id,
              user_id: userId,
              direction: "outbound",
              sender: "agent",
              content: aviso,
              message_type: "text",
            })
            .select("id")
            .single();
          if (outError) {
            console.error(
              "[processor][media_save_failed] falha ao registrar aviso:",
              outError.message,
            );
          }
          outMessageId = outMsg?.id;
        } catch (logError) {
          console.error(
            "[processor][media_save_failed] exceção ao registrar aviso:",
            logError instanceof Error ? logError.message : String(logError),
          );
        }
        let notifiedSender = false;
        try {
          const sentId = await sendWhatsApp(userId, row.from_number, aviso);
          notifiedSender = true;
          if (sentId && outMessageId) {
            await sb.from("whatsapp_cloud_messages")
              .update({ wamid: sentId })
              .eq("id", outMessageId);
          }
        } catch (sendError) {
          console.error(
            "[processor][media_save_failed] falha ao avisar remetente:",
            sendError instanceof Error ? sendError.message : String(sendError),
          );
        }
        await failQueue(row.id, `media_save_failed: ${detail}`);
        return {
          ok: false,
          reason: "media_save_failed",
          error: detail,
          notified_sender: notifiedSender,
        };
      }
      const savedPhotoIds = salvos
        .filter((item) => item.tipo === "foto")
        .map((item) => item.id);
      const { data: incomingRows, error: incomingRowsError } =
        savedPhotoIds.length
          ? await sb.from("midias_whatsapp")
            .select("id, origem")
            .eq("user_id", userId)
            .in("id", savedPhotoIds)
          : { data: [], error: null };
      if (incomingRowsError) {
        throw new Error(
          `falha_ao_validar_fotos_carrossel: ${incomingRowsError.message}`,
        );
      }
      const whatsappPhotoIds = new Set(
        (incomingRows || [])
          .filter((item) => item.origem === "whatsapp")
          .map((item) => item.id),
      );
      const incomingPhotos = salvos
        .filter((item) =>
          item.tipo === "foto" && whatsappPhotoIds.has(item.id)
        )
        .map((item) => ({
          id: item.id,
          url: item.url,
          reused: item.reutilizada === true,
        }));
      if (incomingPhotos[0]) {
        await registerVehiclePhotoQueueEvent(row.id, incomingPhotos[0]);
      }
      const vehicleFlowCtx = {
        userId,
        fromNumber: row.from_number,
        convId: conv.id,
        agentState: freshAgentState,
      };
      const captionStartsVehicleCarousel = fromIsOwner &&
        incomingPhotos.length > 0 &&
        isVehiclePhotoCarouselRequest(contexto);
      if (captionStartsVehicleCarousel) {
        const recentPhotos = await recentWhatsAppVehiclePhotos({
          userId,
          fromNumber: row.from_number,
          windowMs: 3 * 60 * 1000,
        });
        const state = await startVehicleCarouselFlow(
          vehicleFlowCtx,
          addVehicleCarouselPhotos(recentPhotos, incomingPhotos).photos,
          "legenda_da_foto",
        );
        const reply =
          `Recebi ${vehiclePhotoCountLabel(state.photos.length)}. Manda mais ou toque em Pronto.`;
        await sendVehicleFlowReply({
          conversationId: conv.id,
          userId,
          to: row.from_number,
          text: reply,
          buttons: vehicleCarouselCollectionButtons(),
        });
        await doneQueue(row.id);
        return {
          ok: true,
          vehicle_carousel_collecting: true,
          vehicle_carousel_photos: state.photos.length,
        };
      }
      if (fromIsOwner && incomingPhotos.length > 0) {
        console.log(
          `[carrossel] gatilho=não motivo=${
            contexto ? "legenda_sem_pedido" : "foto_sem_texto"
          }`,
        );
      }
      const pendingVehicleCollection = fromIsOwner &&
          blockingVehiclePhotoFlow(freshAgentState) ===
            "pending_carrossel_veiculo"
        ? freshAgentState.pending_carrossel_veiculo
        : null;
      if (pendingVehicleCollection) {
        if (incomingPhotos.length > 0) {
          const updatedCollection = await appendVehicleCarouselPhotosAtomically(
            conv.id,
            incomingPhotos,
          );
          if (!updatedCollection) {
            throw new Error("coleta_carrossel_nao_esta_ativa");
          }
          const ignored = Math.max(
            0,
            pendingVehicleCollection.photos.length + incomingPhotos.length -
              updatedCollection.photos.length,
          );
          vehicleFlowCtx.agentState = {
            ...freshAgentState,
            pending_carrossel_veiculo: updatedCollection,
          };
          console.log(
            `[carrossel] fotos=${updatedCollection.photos.length} estagio=collecting`,
          );
          const full = updatedCollection.photos.length >=
            VEHICLE_CAROUSEL_MAX_PHOTOS;
          console.log(
            `[lote] fotos=${updatedCollection.photos.length} bloqueado_por=pending_carrossel_veiculo oferta=não motivo=fotos_na_coleta`,
          );
          console.log(
            `[lote] aguardando_mais_fotos=${full ? "não" : "sim"}`,
          );
          const next = full
            ? await askVehicleCarouselData(
              updatedCollection,
              vehicleFlowCtx,
            )
            : {
              text:
                `Recebi ${
                  vehiclePhotoCountLabel(updatedCollection.photos.length)
                }, de até ${VEHICLE_CAROUSEL_MAX_PHOTOS}.`,
              interactiveButtons: vehicleCarouselCollectionButtons(),
            };
          const warning = ignored > 0 ? "Usei as 8 primeiras.\n\n" : "";
          const reply = `${warning}${next.text}`;
          try {
            await sendVehicleFlowReply({
              conversationId: conv.id,
              userId,
              to: row.from_number,
              text: reply,
              buttons: next.interactiveButtons,
            });
          } catch (error) {
            const sendError = error instanceof Error
              ? error.message
              : String(error);
            await failQueue(row.id, `send_failed: ${sendError}`);
            return {
              ok: false,
              reason: "send_failed",
              error: sendError,
            };
          }
          await doneQueue(row.id);
          return {
            ok: true,
            vehicle_carousel_collecting: !full,
            vehicle_carousel_photos: updatedCollection.photos.length,
          };
        }
        // Vídeo ou outra mídia não pertence à coleta de fotos. Abandona o
        // estado para que o pedido atual siga pelo roteamento normal.
        await persistVehicleCarousel(vehicleFlowCtx, null);
      }
      if (fromIsOwner && incomingPhotos.length > 0 && !contexto) {
        const initialBlocker = blockingVehiclePhotoFlow(freshAgentState);
        if (initialBlocker) {
          console.log(
            `[lote] fotos=${incomingPhotos.length} bloqueado_por=${initialBlocker} oferta=não motivo=fluxo_midia_recente`,
          );
          console.log("[lote] aguardando_mais_fotos=não");
        } else {
          await wait(8_000);
          const [queueBatch, refreshedState] = await Promise.all([
            claimVehiclePhotoQueueBatch(row.id),
            loadAgentState(sb, stateConversation),
          ]);
          await clearExpiredAnuncioPendingState(
            stateConversation,
            refreshedState,
          );
          const refreshedBlocker = blockingVehiclePhotoFlow(refreshedState);
          if (!refreshedBlocker) {
            vehicleFlowCtx.agentState = refreshedState;
            const plannedBatch = planVehiclePhotoBatch({
              previous: null,
              recentPhotos: queueBatch.photos,
              currentEventId: row.wamid || row.id,
              reusedPhotoIds: queueBatch.reusedPhotoIds,
              currentPhotoId: queueBatch.photos.at(-1)?.id,
              hasNewerQueuedPhoto: !queueBatch.shouldOffer,
            });
            const batch = plannedBatch.state;
            const sendsSingleRepeatedOffer = batch.photos.length === 1 &&
              queueBatch.shouldOffer &&
              (batch.reused_photo_ids?.length ?? 0) > 0;
            if (queueBatch.shouldOffer) {
              await persistVehiclePhotoBatch(
                vehicleFlowCtx,
                batch,
                plannedBatch.shouldOffer || sendsSingleRepeatedOffer,
              );
            }
            if (queueBatch.shouldOffer && batch.photos.length >= 2) {
              await sendVehicleFlowReply({
                conversationId: conv.id,
                userId,
                to: row.from_number,
                text: vehiclePhotoBatchOfferMessage(batch),
                buttons: vehiclePhotoBatchButtons(),
              });
            } else if (
              queueBatch.shouldOffer &&
              batch.photos.length === 1 &&
              plannedBatch.currentPhotoIsLatest
            ) {
              const repeated = (batch.reused_photo_ids?.length ?? 0) > 0;
              await sendVehicleFlowReply({
                conversationId: conv.id,
                userId,
                to: row.from_number,
                text: repeated
                  ? SINGLE_REPEATED_VEHICLE_PHOTO_MESSAGE
                  : "Recebi a foto.",
                buttons: repeated
                  ? vehicleSingleRepeatedPhotoButtons()
                  : undefined,
              });
            }
            const awaitingMore = !queueBatch.shouldOffer;
            console.log(
              `[lote] fotos=${batch.photos.length} bloqueado_por=nenhum oferta=${
                queueBatch.shouldOffer
                  ? "sim"
                  : "não"
              } motivo=${
                queueBatch.shouldOffer && batch.photos.length >= 2
                  ? "lote_pronto"
                  : sendsSingleRepeatedOffer
                  ? "foto_repetida_unica"
                  : awaitingMore
                  ? "debounce"
                  : "foto_unica"
              }`,
            );
            console.log(
              `[lote] aguardando_mais_fotos=${awaitingMore ? "sim" : "não"}`,
            );
            await doneQueue(row.id);
            return {
              ok: true,
              vehicle_photo_batch: batch.stage,
              vehicle_photo_count: batch.photos.length,
            };
          }
          console.log(
            `[lote] fotos=${incomingPhotos.length} bloqueado_por=${refreshedBlocker} oferta=não motivo=fluxo_midia_recente`,
          );
          console.log("[lote] aguardando_mais_fotos=não");
        }
      }
      if (fromIsOwner) {
        await Promise.all(
          salvos
            .filter((item) => item.tipo === "video")
            .map(async (item) => {
              try {
                await syncProdutoVideoFromMidia(sb, item.id);
              } catch (e) {
                console.error(
                  "[processor][produto_videos_sync] falhou; mantendo vídeo em midias_whatsapp:",
                  e instanceof Error ? e.message : String(e),
                );
              }
            }),
        );
      }

      const clientLogoRequest = fromIsOwner
        && !!incomingLogo
        && isClientLogoRegistrationRequest(contexto);
      if (clientLogoRequest && incomingLogo) {
        const requestedLogoVariant =
          detectLogoVariantRequest(contexto) ?? "default";
        const logoPath = await uploadClientLogoData(
          userId,
          `data:${incomingLogo.mime};base64,${incomingLogo.base64}`,
          "client-brands",
        );
        const clientName = extractClientNameFromLogoRequest(contexto);
        let clientLogoRegistered = false;
        let reply: string;
        if (!logoPath) {
          reply = "Não consegui salvar essa logo. Envie em PNG, JPEG ou WEBP com até 5 MB.";
        } else if (!clientName) {
          await saveAgentState(sb, stateConversation, {
            pending_client_logo: {
              logo_path: logoPath,
              created_at: new Date().toISOString(),
              variant: requestedLogoVariant,
            },
          }, freshAgentState);
          reply = "Guardei o arquivo, mas ainda não associei a nenhuma identidade. De qual cliente é essa logo?";
        } else {
          try {
            const matches = await listClientBrandIdentityMatches(sb, userId, clientName);
            if (matches.length > 1) {
              await saveAgentState(sb, stateConversation, {
                pending_client_logo: {
                  logo_path: logoPath,
                  created_at: new Date().toISOString(),
                  variant: requestedLogoVariant,
                },
              }, freshAgentState);
              reply = `Encontrei mais de um cliente parecido: ${matches.map((item) => item.client_name).join(", ")}. De qual deles é a logo?`;
            } else {
              const saved = await saveClientBrandIdentity(sb, {
                userId,
                clientName: matches[0]?.client_name || clientName,
                logoPath,
                logoVariant: requestedLogoVariant,
                identity: { logo_origem: "whatsapp_manual" },
              });
              await saveAgentState(sb, stateConversation, { pending_client_logo: null }, freshAgentState);
              clientLogoRegistered = true;
              reply = `Guardei como logo do ${saved.client_name}. Vou usar nos vídeos e posts desse cliente.${
                saved.identity?.logo_background_warning
                  ? `\n\n${saved.identity.logo_background_warning}`
                  : ""
              }`;
            }
          } catch (error) {
            console.error("[client-brand][logo-save]", error);
            await saveAgentState(sb, stateConversation, {
              pending_client_logo: {
                logo_path: logoPath,
                created_at: new Date().toISOString(),
                variant: requestedLogoVariant,
              },
            }, freshAgentState);
            reply = "Salvei o arquivo, mas não consegui associá-lo à identidade. Confirme o nome do cliente para eu tentar novamente.";
          }
        }

        const { data: outMsg } = await sb
          .from("whatsapp_cloud_messages")
          .insert({
            conversation_id: conv.id,
            user_id: userId,
            direction: "outbound",
            sender: "agent",
            content: reply,
            message_type: "text",
          })
          .select("id")
          .single();
        try {
          const sentId = await sendWhatsApp(userId, row.from_number, reply);
          if (sentId && outMsg?.id) {
            await sb.from("whatsapp_cloud_messages").update({ wamid: sentId }).eq("id", outMsg.id);
          }
        } catch (error) {
          const sendError = error instanceof Error ? error.message : String(error);
          await failQueue(row.id, `send_failed: ${sendError}`);
          return { ok: false, reason: "send_failed", error: sendError };
        }
        await sb.from("whatsapp_cloud_conversations")
          .update({ last_message_at: new Date().toISOString() })
          .eq("id", conv.id);
        await doneQueue(row.id);
        return {
          ok: true,
          client_logo_registered: clientLogoRegistered,
          midia_ids: salvos.map((item) => item.id),
        };
      }

      const savedPhotos = salvos
        .filter((item) => item.tipo === "foto")
        .map((item) => ({ id: item.id, url: item.url, context: contexto }));
      const priorPending = freshAgentState.pending_image_composition;
      const priorPendingAge = priorPending?.at
        ? Date.now() - new Date(priorPending.at).getTime()
        : Number.POSITIVE_INFINITY;
      const pendingMediaIds = [
        ...(priorPendingAge <= 15 * 60 * 1000 ? priorPending?.media_ids ?? [] : []),
        ...savedPhotos.map((item) => item.id),
      ].filter((id, index, all) => all.indexOf(id) === index).slice(-2);
      const latestSaved = salvos.at(-1);
      const freshStatePatch: Partial<AgentConvState> = {
        ...(latestSaved
          ? { last_media_interaction: { media_id: latestSaved.id, at: new Date().toISOString() } }
          : {}),
        ...(fromIsOwner && savedPhotos.length > 0
          ? {
            pending_image_composition: {
              media_ids: pendingMediaIds,
              at: new Date().toISOString(),
            },
          }
          : {}),
      };
      await saveAgentState(sb, stateConversation, freshStatePatch, freshAgentState);
      Object.assign(freshAgentState, freshStatePatch);
      const freshImageIntent = classifyOwnerMediaIntent(contexto);
      if (
        fromIsOwner
        && savedPhotos.length > 0
        && !isImageCompositionIntent(contexto)
        && (freshImageIntent.action === "generate" || freshImageIntent.action === "edit")
      ) {
        const generationCtx = {
          userId,
          fromNumber: row.from_number,
          convId: conv.id,
          agentState: freshAgentState,
        };
        const prepared = await prepareWhatsAppImageGeneration({
          prompt: contexto,
          ctx: generationCtx,
          references: savedPhotos.map((item) => item.url),
        });
        const completed = prepared.deferred
          ? { text: prepared.text, imageUrl: prepared.imageUrl }
          : completedWhatsAppImageResponse(prepared.raw, detectWhatsAppBrandDirective(contexto) === "none");
        const buttons = prepared.deferred ? prepared.interactiveButtons : undefined;
        const { data: outMsg } = await sb
          .from("whatsapp_cloud_messages")
          .insert({
            conversation_id: conv.id,
            user_id: userId,
            direction: "outbound",
            sender: "agent",
            content: completed.imageUrl
              ? `${completed.text}\n\n[imagem: ${completed.imageUrl}]`
              : completed.text,
            message_type: completed.imageUrl ? "image" : "text",
          })
          .select("id")
          .single();
        try {
          const sentId = await sendWhatsApp(
            userId,
            row.from_number,
            completed.text,
            completed.imageUrl,
            undefined,
            buttons,
          );
          if (sentId && outMsg?.id) {
            await sb.from("whatsapp_cloud_messages").update({ wamid: sentId }).eq("id", outMsg.id);
          }
        } catch (error) {
          const sendError = error instanceof Error ? error.message : String(error);
          await failQueue(row.id, `send_failed: ${sendError}`);
          return { ok: false, reason: "send_failed", error: sendError };
        }
        await sb.from("whatsapp_cloud_conversations")
          .update({ last_message_at: new Date().toISOString() })
          .eq("id", conv.id);
        await doneQueue(row.id);
        return {
          ok: true,
          generated_from_fresh_photo: !prepared.deferred,
          awaiting_brand_choice: prepared.deferred,
        };
      }
      if (fromIsOwner && isImageCompositionIntent(contexto) && savedPhotos.length > 0) {
        let compositionReply = "";
        let compositionImageUrl: string | undefined;
        let compositionMediaId: string | undefined;
        try {
          const sources = await resolveCompositionSources(
            userId,
            row.from_number,
            contexto,
            savedPhotos,
            pendingMediaIds,
          );
          if (!sources) {
            compositionReply = "Recebi a foto. Agora me manda também a foto do ambiente e a do produto que você quer simular.";
          } else {
            const result = await composeProductInEnvironment({
              userId,
              fromNumber: row.from_number,
              conversationId: conv.id,
              requestText: contexto,
              ...sources,
            });
            compositionReply = result.ok
              ? `Pronto — montei a composição mantendo o ambiente e usando o produto de referência. É uma simulação ilustrativa.${result.resolution === "2K" ? " Gerei em alta resolução." : ""}`
              : result.message;
            if (result.ok) {
              compositionImageUrl = result.imageUrl;
              compositionMediaId = result.mediaId;
              const interaction = { media_id: result.mediaId, at: new Date().toISOString() };
              await saveAgentState(sb, stateConversation, {
                pending_image_composition: null,
                last_media_interaction: interaction,
              }, freshAgentState);
            }
          }
        } catch (error) {
          console.error("[image_composition][fresh_media_route_failed]", error);
          compositionReply = "Não consegui combinar as duas fotos agora. Mantive as originais salvas, sem entregar uma edição diferente.";
        }

        const { data: outMsg } = await sb
          .from("whatsapp_cloud_messages")
          .insert({
            conversation_id: conv.id,
            user_id: userId,
            direction: "outbound",
            sender: "agent",
            content: compositionImageUrl
              ? `${compositionReply}\n\n[imagem: ${compositionImageUrl}]`
              : compositionReply,
            message_type: compositionImageUrl ? "image" : "text",
          })
          .select("id")
          .single();
        try {
          const sentId = await sendWhatsApp(
            userId,
            row.from_number,
            compositionReply,
            compositionImageUrl,
          );
          if (sentId && outMsg?.id) {
            await sb.from("whatsapp_cloud_messages").update({ wamid: sentId }).eq("id", outMsg.id);
          }
        } catch (error) {
          const sendError = error instanceof Error ? error.message : String(error);
          await failQueue(row.id, `send_failed: ${sendError}`);
          return { ok: false, reason: "send_failed", error: sendError };
        }
        await sb.from("whatsapp_cloud_conversations")
          .update({ last_message_at: new Date().toISOString() })
          .eq("id", conv.id);
        await doneQueue(row.id);
        return { ok: true, image_composition: !!compositionImageUrl, media_id: compositionMediaId };
      }

      let descricaoVisual = "";
      try {
        descricaoVisual = await descreverFotosSalvas(freshLibraryMedia, salvos, contexto, userId);
      } catch (e) {
        console.warn("[processor][fresh_media_visao] falhou:", (e as Error).message);
      }
      // VÍDEO do dono → transcreve, gera 3 copies e abre o fluxo de legenda queimada.
      // A queima acontece no worker da VPS (fila video_render_jobs), não no navegador.
      let videoFlowReply: string | null = null;
      const videoSalvo = salvos.find((s) => s.tipo === "video");
      if (fromIsOwner && videoSalvo?.url) {
        try {
          videoFlowReply = await iniciarFluxoLegendaVideo({
            userId,
            telefone: row.from_number,
            videoUrl: videoSalvo.url,
            contexto,
            midiaId: videoSalvo.id,
          });
        } catch (e) {
          console.warn("[processor][video_legenda_flow] início falhou:", (e as Error).message);
        }
      }

      const pendingForwardRequest = !fromIsOwner
        ? await recentForwardRequestFromConversation(conv.id, _tenantOwner?.name)
        : null;
      const shouldForwardToOwner = !fromIsOwner && !!tenantOwnerPhone && (
        isExplicitOwnerForwardIntent(userText, _tenantOwner?.name) || !!pendingForwardRequest
      );
      const imageUrlToOwner = salvos.find((s) => s.tipo === "foto")?.url;
      let ownerForwarded = false;
      let ownerForwardWamid: string | null = null;
      if (shouldForwardToOwner) {
        const recado = buildOwnerForwardMessage({
          ownerName: _tenantOwner?.name,
          contactName,
          fromNumber: row.from_number,
          pedido: userText || pendingForwardRequest || contexto,
          descricaoVisual,
          messageType: row.message_type,
        });
        const sentOwnerId = await sendWhatsApp(userId, tenantOwnerPhone!, recado, imageUrlToOwner);
        await logOwnerHeadsup(userId, imageUrlToOwner ? `${recado}\n\n[foto anexada]` : recado, sentOwnerId);
        ownerForwarded = true;
        ownerForwardWamid = sentOwnerId || null;
        console.log(`[processor][owner-forward-direct-media] enviado para ${tenantOwnerPhone} com_foto=${!!imageUrlToOwner} wamid=${sentOwnerId}`);
      }
      const protoOwner = ownerForwarded ? buildForwardProof(ownerForwardWamid) : "";
      const rawReply = videoFlowReply
        ? `${videoFlowReply}\n\n${linhaCodigoMidia(videoSalvo!.id, "video")}`
        : ownerForwarded
        ? `Recebi ${salvos.length === 1 ? "a foto" : "as mídias"}${descricaoVisual ? `. A imagem mostra: ${descricaoVisual.trim()}` : ""}\n\n${
          ownerForwardClientConfirmation({
            isAmzTenant,
            humanNeeded: false,
            explicitForward: true,
            ownerName: _tenantOwner?.name,
            protocol: protoOwner,
          })
        }`
        : respostaMidiaSalva(salvos, descricaoVisual, fromIsOwner);
      const finalizedReply = finalizeAmzInboundReply({
        text: rawReply,
        isAmzTenant,
        inboundFromOwner: fromIsOwner,
        ownerName: _tenantOwner?.name,
      });
      const mediaState = isAmzTenant && ownerForwarded
        ? await loadAgentState(sb, convStateIdentity)
        : {};
      const siteLink = appendAmzSiteLinkAfterHandoff({
        text: finalizedReply,
        isAmzProspect: isAmzTenant && !fromIsOwner,
        handoffSucceeded: ownerForwarded,
        siteLinkAlreadySent: mediaState.site_link_enviado === true,
      });
      const reply = siteLink.text;
      if (siteLink.markSiteLinkSent) {
        await saveAgentState(
          sb,
          convStateIdentity,
          { site_link_enviado: true },
          mediaState,
        );
      }

      const { data: outMsg } = await sb
        .from("whatsapp_cloud_messages")
        .insert({
          conversation_id: conv.id,
          user_id: userId,
          direction: "outbound",
          sender: "agent",
          content: reply,
          message_type: "text",
        })
        .select("id")
        .single();

      let sendError: string | null = null;
      try {
        const sentId = await sendWhatsApp(userId, row.from_number, reply);
        if (sentId && outMsg?.id) {
          await sb.from("whatsapp_cloud_messages").update({ wamid: sentId }).eq("id", outMsg.id);
        }
      } catch (e) {
        sendError = String((e as Error).message ?? e);
      }

      await sb.from("whatsapp_cloud_conversations").update({ last_message_at: new Date().toISOString() }).eq("id", conv.id);

      if (sendError) {
        await failQueue(row.id, `send_failed: ${sendError}`);
        return { ok: false, reason: "send_failed", error: sendError };
      }

      await doneQueue(row.id);
      return { ok: true, saved_to_midias: true, midia_ids: salvos.map((s) => s.id), reply_preview: reply.slice(0, 120) };
    }

    // ============================================================
    // Fluxo determinístico do VÍDEO LEGENDADO (dono respondendo A/B/C ou SIM).
    // A queima da legenda roda no worker da VPS — nada depende do navegador.
    // ============================================================
    if (fromIsOwner && userText.trim()) {
      const [videoLegendaLogo, lightLogo, darkLogo] = await Promise.all([
        getTenantLogoStorageLocation(sb, userId),
        getTenantLogoStorageLocation(sb, userId, "light"),
        getTenantLogoStorageLocation(sb, userId, "dark"),
      ]);
      if (videoLegendaLogo) {
        videoLegendaLogo.lightBackgroundPath = lightLogo?.path;
        videoLegendaLogo.darkBackgroundPath = darkLogo?.path;
      }
      const fluxoReply = await tratarRespostaFluxoLegenda({
        userId,
        telefone: row.from_number,
        texto: userText,
        logo: videoLegendaLogo,
      });
      if (fluxoReply) {
        console.log("[processor][video_legenda_flow] resposta determinística do fluxo de legenda");
        const availableLogoButtons = botoesLegendaParaLogo(videoLegendaLogo);
        const logoButtons: WhatsAppInteractiveButtons | undefined =
          availableLogoButtons && /^Legenda \*[ABC]\* registrada/u.test(fluxoReply)
            ? {
              body: fluxoReply,
              buttons: availableLogoButtons,
            }
            : undefined;
        const { data: outMsg } = await sb
          .from("whatsapp_cloud_messages")
          .insert({
            conversation_id: conv.id,
            user_id: userId,
            direction: "outbound",
            sender: "agent",
            content: fluxoReply,
            message_type: logoButtons ? "interactive" : "text",
          })
          .select("id")
          .single();

        const sentFlowId = await sendWhatsApp(
          userId,
          row.from_number,
          fluxoReply,
          undefined,
          undefined,
          logoButtons,
        );
        if (sentFlowId && outMsg?.id) {
          await sb.from("whatsapp_cloud_messages").update({ wamid: sentFlowId }).eq("id", outMsg.id);
        }
        await sb
          .from("whatsapp_cloud_conversations")
          .update({ last_message_at: new Date().toISOString() })
          .eq("id", conv.id);
        await doneQueue(row.id);
        return { ok: true, video_legenda_flow: true, reply_preview: fluxoReply.slice(0, 120) };
      }
    }

    // ---- Captura de NOME do lead (a qualquer momento) -----------------------
    // Grava em contact_name, completa o registro do lead e, se o encaminhamento
    // já foi feito, manda ao dono UM complemento curto com o nome.
    let nomeLeadConhecido: string | null = ((conv as any)?.contact_name ?? contactName ?? null) as string | null;
    let nomePerguntado = false;
    if (!fromIsOwner && userText.trim()) {
      try {
        const stNome = await loadAgentState(sb, convStateIdentity);
        const pendente = (stNome as any)?.nome_pergunta === true;
        nomePerguntado = pendente || (stNome as any)?.nome_pergunta === "feita";
        const { data: lastOutbound } = await sb.from("whatsapp_cloud_messages")
          .select("content")
          .eq("conversation_id", conv.id)
          .eq("direction", "outbound")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        const agentAskedName = asksForLeadName(String(lastOutbound?.content || ""));
        const nomeCap = nomeLeadConhecido
          ? null
          : extractLeadName(userText, pendente || agentAskedName);
        if (nomeCap) {
          nomeLeadConhecido = nomeCap;
          await persistKnownLeadName({
            userId,
            telefone: row.from_number,
            conversationId: conv.id,
            nome: nomeCap,
          });
          (conv as any).contact_name = nomeCap;
          console.log(`[processor][lead_nome][capturado] tel=${row.from_number} nome=${nomeCap}`);

          const proofPersistido = (stNome as any)?.forward?.protocolo as string | undefined;
          const complementoJa = (stNome as any)?.complemento_nome === true;
          if (proofPersistido && !complementoJa && tenantOwnerPhone) {
            const okComp = await enviarComplementoNomeAoDono({
              userId,
              ownerPhone: tenantOwnerPhone,
              protocolo: proofPersistido,
              nome: nomeCap,
            });
            await saveAgentState(sb, convStateIdentity, { nome: nomeCap, nome_pergunta: "feita", complemento_nome: okComp }, stNome);
            if (okComp) {
              await sb
                .from("lead_encaminhamentos")
                .update({ complemento_nome_enviado: true })
                .eq("user_id", userId)
                .eq("telefone", row.from_number)
                .eq("protocolo", extractProtocolCode(proofPersistido));
            }
          } else {
            await saveAgentState(sb, convStateIdentity, { nome: nomeCap, nome_pergunta: "feita" }, stNome);
          }
        }
      } catch (e) {
        console.warn("[processor][lead_nome][falhou]", (e as Error).message);
      }
    }

    // Recupera nomes já registrados pela tool ou ditos anteriormente na
    // conversa antes de qualquer encaminhamento/pergunta fixa.
    if (!fromIsOwner && !nomeLeadConhecido) {
      try {
        const recoveredName = await findKnownLeadName({
          userId,
          telefone: row.from_number,
          conversationId: conv.id,
        });
        if (recoveredName) {
          nomeLeadConhecido = recoveredName;
          await persistKnownLeadName({
            userId,
            telefone: row.from_number,
            conversationId: conv.id,
            nome: recoveredName,
          });
          (conv as any).contact_name = recoveredName;
          const currentState = await loadAgentState(sb, convStateIdentity);
          const proof = (currentState as any)?.forward?.protocolo as string | undefined;
          const complementSent = (currentState as any)?.complemento_nome === true;
          let sentNow = complementSent;
          if (proof && !complementSent && tenantOwnerPhone) {
            sentNow = await enviarComplementoNomeAoDono({
              userId,
              ownerPhone: tenantOwnerPhone,
              protocolo: proof,
              nome: recoveredName,
            });
          }
          await saveAgentState(sb, convStateIdentity, {
            nome: recoveredName,
            nome_pergunta: "feita",
            ...(proof ? { complemento_nome: sentNow } : {}),
          }, currentState);
          nomePerguntado = true;
          console.log(`[processor][lead_nome][recuperado] tel=${row.from_number} nome=${recoveredName}`);
        }
      } catch (error) {
        console.warn("[processor][lead_nome][recuperacao_falhou]", (error as Error).message);
      }
    }


    // Atalho determinístico: quando cliente pede equipe/responsável/Marcelo ou faz
    // pergunta comercial que exige retorno humano, NÃO deixa a IA procurar contato.
    // Encaminha direto para owner_phone do tenant (Marcelo: número diferente do agente).
    if (!fromIsOwner && row.message_type === "text" && userText.trim() && tenantOwnerPhone) {
      const explicitForward = isExplicitOwnerForwardIntent(userText, _tenantOwner?.name);
      const humanNeeded = isOwnerHandoffQuestion(userText);
      if (explicitForward || humanNeeded) {
        let imageUrlToOwner: string | undefined;
        if (explicitForward) {
          const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
          const { data: recent } = await sb
            .from("midias_whatsapp")
            .select("midia_url, created_at")
            .eq("user_id", userId)
            .eq("telefone_origem", row.from_number)
            .eq("tipo", "foto")
            .gte("created_at", cutoff)
            .order("created_at", { ascending: false })
            .limit(1);
          imageUrlToOwner = recent?.[0]?.midia_url || undefined;
        }
        const recado = buildOwnerForwardMessage({
          ownerName: _tenantOwner?.name,
          contactName: nomeLeadConhecido || contactName,
          fromNumber: row.from_number,
          pedido: userText,
          messageType: row.message_type,
          urgent: explicitForward,
        });
        const sentOwnerId = await sendWhatsApp(userId, tenantOwnerPhone, recado, imageUrlToOwner);
        await logOwnerHeadsup(userId, imageUrlToOwner ? `${recado}\n\n[foto anexada]` : recado, sentOwnerId);
        console.log(`[processor][owner-forward-direct-text] enviado para ${tenantOwnerPhone} com_foto=${!!imageUrlToOwner} reason=${explicitForward ? "explicit" : "human_needed"}`);

        const proto = buildForwardProof(sentOwnerId);
        await registrarLeadEncaminhamento({
          userId,
          telefone: row.from_number,
          nome: nomeLeadConhecido,
          mensagem: userText,
          protocolo: proto,
          wamid: sentOwnerId,
          destinoDono: tenantOwnerPhone,
        });
        let pedirNomeAgora = false;
        let siteLinkAlreadySent = false;
        try {
          const stPrev = await loadAgentState(sb, convStateIdentity);
          pedirNomeAgora = !nomeLeadConhecido && !(stPrev as any)?.nome_pergunta;
          siteLinkAlreadySent = stPrev.site_link_enviado === true;
          const stateSaved = await saveAgentState(sb, convStateIdentity, {
            forward: { protocolo: proto, destinatario: tenantOwnerPhone, wamid: sentOwnerId ?? null, at: new Date().toISOString() },
            ...(pedirNomeAgora ? { nome_pergunta: true } : {}),
            ...(isAmzTenant && !siteLinkAlreadySent
              ? { site_link_enviado: true }
              : {}),
          }, stPrev);
          if (!stateSaved) {
            console.warn(`[processor][handoff][state_degraded] comprovante preservado em lead_encaminhamentos from=${row.from_number}`);
          }
        } catch (_e) { /* não bloqueia */ }
        const confirmacao = ownerForwardClientConfirmation({
          isAmzTenant,
          humanNeeded,
          explicitForward,
          ownerName: _tenantOwner?.name,
          protocol: proto,
        });
        const rawReply = pedirNomeAgora
          ? `${confirmacao}\n\n${PERGUNTA_NOME}`
          : confirmacao;
        const finalizedReply = finalizeAmzInboundReply({
          text: rawReply,
          isAmzTenant,
          inboundFromOwner: false,
          ownerName: _tenantOwner?.name,
        });
        const siteLink = appendAmzSiteLinkAfterHandoff({
          text: finalizedReply,
          isAmzProspect: isAmzTenant,
          handoffSucceeded: true,
          siteLinkAlreadySent,
        });
        const reply = siteLink.text;

        const { data: outMsg } = await sb
          .from("whatsapp_cloud_messages")
          .insert({
            conversation_id: conv.id,
            user_id: userId,
            direction: "outbound",
            sender: "agent",
            content: reply,
            message_type: "text",
          })
          .select("id")
          .single();

        const directReplyParts = reply.split("<<SPLIT>>")
          .map((part) => part.trim())
          .filter(Boolean);
        const sentClientId = await sendWhatsApp(
          userId,
          row.from_number,
          directReplyParts[0] ?? reply,
        );
        for (const part of directReplyParts.slice(1)) {
          await sendWhatsApp(userId, row.from_number, part);
        }
        if (sentClientId && outMsg?.id) {
          await sb.from("whatsapp_cloud_messages").update({ wamid: sentClientId }).eq("id", outMsg.id);
        }
        await sb.from("whatsapp_cloud_conversations").update({ last_message_at: new Date().toISOString() }).eq("id", conv.id);
        await doneQueue(row.id);
        return { ok: true, owner_forwarded_direct: true, forwarded_to: tenantOwnerPhone, reply_preview: reply.slice(0, 120) };
      }
    }

    // PASSO 6.8 — DOCUMENTOS (.md, .txt, .json, .pdf) → ler e COMENTAR
    // Regra: nunca chamar tools, nunca buscar lugares, nunca postar. Só análise.
    const docMedia = media.filter((m) => m.kind === "document");
    const senderIsClient = !!tenantOwnerPhone && !fromIsOwner;

    // === CLIENTE mandou documento (RG/CNH/comprovante/PDF/imagem-doc) ===
    // Silvester deve LER de verdade (vision multimodal), extrair dados
    // estruturados, salvar no dossiê e responder de forma natural — não
    // devolver análise técnica genérica tipo "certificado digital MP 2.200".
    if (docMedia.length > 0 && senderIsClient) {
      const doc = docMedia[0];
      const label = doc.filename || `arquivo ${doc.mime}`;

      const _agentNomeDoc = String(agent.agent_name || "assistente").trim();
      const _consorcioDoc = /cons[oó]rcio|ademicon|carta\s+de\s+cr[eé]dito/i.test(`${(agent as any)?.persona || ""} ${(agent as any)?.knowledge_base || ""}`);
      const _donoNomeDoc = ownerFirstName(_tenantOwner?.name) || "o responsável";
      const clientVisionPrompt = `Você é o ${_agentNomeDoc}, pré-atendente ${_consorcioDoc ? `do consultor de consórcio ${_donoNomeDoc}` : `de ${_donoNomeDoc}`}. O cliente acabou de mandar um documento por WhatsApp. LEIA o documento (imagem/PDF) e devolva JSON PURO (sem markdown) neste formato:

{
  "tipo": "rg" | "cnh" | "comprovante_residencia" | "comprovante_renda" | "ir" | "foto_bem" | "outro",
  "legivel": true | false,
  "resumo_humano": "1 frase curta pro cliente confirmando o que você viu, ex: 'Recebi sua CNH, João Silva, tudo legível'",
  "dados": {
    "nome_completo": "...", "cpf": "...", "rg": "...", "data_nascimento": "YYYY-MM-DD",
    "profissao": "...", "renda_mensal": 0,
    "endereco_logradouro": "...", "endereco_numero": "...", "endereco_bairro": "...",
    "endereco_cidade": "...", "endereco_estado": "UF", "endereco_cep": "..."
  }
}

Regras:
- OMITA chaves que não aparecem no documento (não invente).
- CPF só dígitos (11). Datas ISO YYYY-MM-DD. renda_mensal em número.
- Se estiver borrado/ilegível: legivel=false e no resumo_humano peça pra reenviar mais nítido.
- Se for CNH-e / QR-code de validação sem dados pessoais visíveis: legivel=false, resumo_humano="O arquivo é só o QR de validação da CNH-e — não mostra os dados. Consegue mandar uma foto da frente e verso da CNH?"
- Devolva JSON PURO.`;

      let vision: any = { tipo: "outro", legivel: false, resumo_humano: `Recebi *${label}*, mas não consegui ler.` };
      try {
        const vr = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${LOVABLE_API_KEY}` },
          body: JSON.stringify({
            model: MODEL_DEEP,
            messages: [{
              role: "user",
              content: [
                { type: "text", text: clientVisionPrompt },
                doc.mime.includes("pdf")
                  ? { type: "file", file: { filename: label, file_data: `data:${doc.mime};base64,${doc.base64}` } }
                  : { type: "image_url", image_url: { url: `data:${doc.mime};base64,${doc.base64}` } },
              ],
            }],
          }),
        });
        if (vr.ok) {
          const vj = await vr.json();
          const raw = vj?.choices?.[0]?.message?.content ?? "{}";
          const cleaned = raw.replace(/```json\s*|\s*```/g, "").trim();
          try { vision = JSON.parse(cleaned); } catch { /* keep default */ }
        } else {
          console.error("[processor][client-doc] vision falhou", vr.status, (await vr.text()).slice(0, 300));
        }
      } catch (e) {
        console.error("[processor][client-doc] vision erro", (e as Error).message);
      }

      // Grava dossiê + documento (best-effort)
      let dossieAtual: any = null;
      try {
        const { data: existing } = await sb
          .from("silvester_dossies")
          .select("*")
          .eq("user_id", userId)
          .eq("telefone_cliente", row.from_number)
          .maybeSingle();
        if (existing) dossieAtual = existing;
        else {
          const { data: created } = await sb
            .from("silvester_dossies")
            .insert({ user_id: userId, telefone_cliente: row.from_number, nome_completo: vision?.dados?.nome_completo ?? null, status: "coletando" })
            .select("*")
            .single();
          dossieAtual = created;
        }

        if (dossieAtual) {
          // upload no storage (se bucket existir)
          let storagePath: string | null = null;
          try {
            const ext = doc.mime.includes("pdf") ? "pdf" : doc.mime.includes("png") ? "png" : "jpg";
            const path = `${userId}/${dossieAtual.id}/${crypto.randomUUID()}.${ext}`;
            const bin = Uint8Array.from(atob(doc.base64), (c) => c.charCodeAt(0));
            const { error: upErr } = await sb.storage.from("silvester-docs").upload(path, bin, { contentType: doc.mime, upsert: false });
            if (!upErr) storagePath = path;
          } catch (e) {
            console.warn("[processor][client-doc] upload falhou", (e as Error).message);
          }

          await sb.from("silvester_documentos").insert({
            dossie_id: dossieAtual.id,
            user_id: userId,
            tipo: vision?.tipo ?? "outro",
            storage_path: storagePath,
            mime_type: doc.mime,
            ocr_texto: vision?.resumo_humano ?? null,
            dados_extraidos: vision?.dados ?? {},
            status_validacao: vision?.legivel === false ? "ilegivel" : "validado",
            observacoes_ia: vision?.resumo_humano ?? null,
            wamid: row.wamid ?? null,
            processed_at: new Date().toISOString(),
          });

          const patch: Record<string, any> = {};
          for (const [k, v] of Object.entries(vision?.dados ?? {})) {
            if (v === null || v === undefined) continue;
            if (typeof v === "string" && v.trim() === "") continue;
            patch[k] = v;
          }
          if (Object.keys(patch).length > 0) {
            await sb.from("silvester_dossies").update(patch).eq("id", dossieAtual.id);
            // Recarrega para ter os dados atualizados em memória
            const { data: fresh } = await sb.from("silvester_dossies").select("*").eq("id", dossieAtual.id).maybeSingle();
            if (fresh) dossieAtual = fresh;
          }
        }
      } catch (e) {
        console.warn("[processor][client-doc] persist dossie falhou", (e as Error).message);
      }

      const primeiroNome = ownerFirstName(_tenantOwner?.name) || "o Marcelo";
      const humano = (vision?.resumo_humano || "").trim();



      const temNome = !!(dossieAtual?.nome_completo && String(dossieAtual.nome_completo).trim());
      const temCpf = !!(dossieAtual?.cpf && String(dossieAtual.cpf).trim());
      const temIdentidade = !!(dossieAtual?.rg || vision?.tipo === "cnh" || vision?.tipo === "rg");
      const jaEncaminhado = dossieAtual?.status === "enviado";
      const deveEncaminhar = !jaEncaminhado && temNome && temCpf && temIdentidade && !!tenantOwnerPhone;

      let ownerForwardWamid: string | null = null;
      if (deveEncaminhar) {
        try {
          const linhas: string[] = [];
          linhas.push(`👋 Oi ${primeiroNome}, aqui é o ${String(agent.agent_name || "seu assistente").trim()}.`);
          linhas.push(_consorcioDoc ? `Novo cliente interessado em consórcio, pré-atendimento concluído:` : `Novo contato de cliente, pré-atendimento concluído:`);
          linhas.push("");
          linhas.push(`👤 *Nome:* ${dossieAtual.nome_completo}`);
          if (dossieAtual.cpf) linhas.push(`🆔 *CPF:* ${dossieAtual.cpf}`);
          if (dossieAtual.rg) linhas.push(`📄 *RG:* ${dossieAtual.rg}`);
          if (dossieAtual.data_nascimento) linhas.push(`🎂 *Nascimento:* ${dossieAtual.data_nascimento}`);
          if (dossieAtual.profissao) linhas.push(`💼 *Profissão:* ${dossieAtual.profissao}`);
          if (dossieAtual.renda_mensal) linhas.push(`💰 *Renda:* ${dossieAtual.renda_mensal}`);
          linhas.push(`📱 *WhatsApp:* ${row.from_number}`);
          linhas.push("");
          linhas.push(`Documentos anexados no dossiê. Pode assumir o atendimento quando puder. 🙌`);
          const recado = linhas.join("\n");
          ownerForwardWamid = await sendWhatsApp(userId, tenantOwnerPhone!, recado);
          await logOwnerHeadsup(userId, recado, ownerForwardWamid);
          await sb.from("silvester_dossies").update({ status: "enviado" }).eq("id", dossieAtual.id);
          // NÃO mutamos o bot (status="handoff") aqui: o cliente ainda pode
          // agradecer/perguntar coisas simples ("obrigado", "quanto tempo?", etc.)
          // e o Silvester precisa responder com naturalidade até o Marcelo assumir.
          console.log(`[processor][silvester][handoff] dossiê ${dossieAtual.id} enviado para ${tenantOwnerPhone} wamid=${ownerForwardWamid}`);
        } catch (e) {
          console.warn("[processor][silvester][handoff] falhou:", (e as Error).message);
        }
      }

      let reply: string;
      let docSiteLinkAlreadySent = false;
      if (vision?.legivel === false) {
        reply = humano || `Recebi *${label}*, mas não consegui ler direito. Consegue mandar de novo mais nítido?`;
      } else if (deveEncaminhar && ownerForwardWamid) {
        const proto = buildForwardProof(ownerForwardWamid);
        try {
          const stPrev = await loadAgentState(sb, convStateIdentity);
          docSiteLinkAlreadySent = stPrev.site_link_enviado === true;
          await saveAgentState(sb, convStateIdentity, {
            forward: { protocolo: proto, destinatario: tenantOwnerPhone ?? null as any, wamid: ownerForwardWamid, at: new Date().toISOString() },
            ...(isAmzTenant && !docSiteLinkAlreadySent
              ? { site_link_enviado: true }
              : {}),
          }, stPrev);
        } catch (_e) { /* não bloqueia */ }
        reply = isAmzTenant
          ? `${humano ? humano + "\n\n" : ""}Prontinho! Já encaminhei seu cadastro completo para um dos nossos consultores agora — nome, CPF e documento. ${proto}\n\nEle vai te retornar em instantes com a proposta. 🙌`
          : `${humano ? humano + "\n\n" : ""}Prontinho, Felício! Já encaminhei seu cadastro completo pro ${primeiroNome} agora — nome, CPF e documento. ${proto}\n\nEle vai te retornar em instantes com a proposta. 🙌`;
      } else if (deveEncaminhar) {
        reply = isAmzTenant
          ? `${humano ? humano + "\n\n" : ""}Anexei no seu cadastro. Vou avisar um dos nossos consultores agora mesmo para ele te retornar. 🙌`
          : `${humano ? humano + "\n\n" : ""}Anexei no seu cadastro. Vou avisar o ${primeiroNome} agora mesmo pra ele te retornar. 🙌`;
      } else {
        const nomeVisto = vision?.dados?.nome_completo ? ` (${vision.dados.nome_completo})` : "";
        reply = isAmzTenant
          ? humano
            ? `${humano} Já anexei no seu cadastro para um dos nossos consultores usar na proposta. 👍`
            : `Recebi seu documento${nomeVisto} e já anexei no seu cadastro para um dos nossos consultores. Obrigado!`
          : humano
          ? `${humano} Já anexei no seu cadastro pra ${primeiroNome} usar na proposta. 👍`
          : `Recebi seu documento${nomeVisto} e já anexei no seu cadastro pra ${primeiroNome}. Obrigado!`;
      }
      reply = finalizeAmzInboundReply({
        text: reply,
        isAmzTenant,
        inboundFromOwner: false,
        ownerName: _tenantOwner?.name,
      });
      reply = appendAmzSiteLinkAfterHandoff({
        text: reply,
        isAmzProspect: isAmzTenant,
        handoffSucceeded: Boolean(deveEncaminhar && ownerForwardWamid),
        siteLinkAlreadySent: docSiteLinkAlreadySent,
      }).text;

      const { data: outMsg } = await sb
        .from("whatsapp_cloud_messages")
        .insert({
          conversation_id: conv.id,
          user_id: userId,
          direction: "outbound",
          sender: "agent",
          content: reply,
          message_type: "text",
        })
        .select("id")
        .single();

      let sendError: string | null = null;
      try {
        const docReplyParts = reply.split("<<SPLIT>>")
          .map((part) => part.trim())
          .filter(Boolean);
        const sentId = await sendWhatsApp(
          userId,
          row.from_number,
          docReplyParts[0] ?? reply,
        );
        for (const part of docReplyParts.slice(1)) {
          await sendWhatsApp(userId, row.from_number, part);
        }
        if (sentId && outMsg?.id) {
          await sb.from("whatsapp_cloud_messages").update({ wamid: sentId }).eq("id", outMsg.id);
        }
      } catch (e) {
        sendError = String((e as Error).message ?? e);
      }
      await sb.from("whatsapp_cloud_conversations").update({ last_message_at: new Date().toISOString() }).eq("id", conv.id);

      if (sendError) {
        await failQueue(row.id, `send_failed: ${sendError}`);
        return { ok: false, reason: "send_failed", error: sendError };
      }

      await doneQueue(row.id);
      return { ok: true, client_doc_processed: true, tipo: vision?.tipo, legivel: vision?.legivel };
    }

    if (docMedia.length > 0) {
      const doc = docMedia[0]; // trata 1 por vez (o mais comum no WhatsApp)
      const extracted = await extractDocumentText(doc.base64, doc.mime, doc.filename);
      const label = doc.filename || `arquivo ${doc.mime}`;

      let reply: string;
      if (!extracted.supported || !extracted.text) {
        reply = extracted.note
          ? `Recebi o arquivo *${label}*, mas ${extracted.note}`
          : `Recebi *${label}*, mas não consegui ler o conteúdo. Se puder, manda em .md, .txt, .json ou .pdf com texto.`;
      } else {
        const truncNote = extracted.truncated
          ? `\n\n(Obs: o documento é grande — analisei os primeiros ~60 mil caracteres.)`
          : "";
        const userComment = userText ? `\n\nContexto que o dono mandou junto: "${userText}"` : "";
        const docPrompt = [
          `O dono (Felício) te enviou um documento/projeto pelo WhatsApp para você COMENTAR.`,
          `Sua tarefa: LEIA o conteúdo abaixo e responda como o Jarvis — assistente do Felício —`,
          `com um comentário útil, honesto e direto: pontos fortes, riscos, o que falta, sugestões práticas.`,
          `Formato: WhatsApp (curto, parágrafos claros, sem tabelas ASCII). Máx ~250 palavras.`,
          `NÃO use nenhuma ferramenta (nada de busca de lugares, nada de pesquisar_web, nada de postar).`,
          `Só análise textual do que está aqui.${userComment}`,
          ``,
          `NOME DO ARQUIVO: ${label}`,
          `TIPO: ${extracted.kind}`,
          ``,
          `--- CONTEÚDO ---`,
          extracted.text,
          `--- FIM ---`,
        ].join("\n");

        try {
          const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${LOVABLE_API_KEY}`,
            },
            body: JSON.stringify({
              model: escolherModelo({ kind: "document" }),
              temperature: 0.5,
              messages: [
                { role: "system", content: "Você é o Jarvis, assistente pessoal do Felício. Leia o documento enviado e comente com franqueza técnica e prática. Nunca invente informação. Nunca peça localização. Nunca ofereça buscar lugares." },
                { role: "user", content: docPrompt },
              ],
            }),
          });
          if (!aiRes.ok) {
            const t = await aiRes.text();
            throw new Error(`gateway ${aiRes.status}: ${t.slice(0, 200)}`);
          }
          const aiJson = await aiRes.json();
          const aiText = aiJson?.choices?.[0]?.message?.content?.trim();
          reply = aiText || `Li o arquivo *${label}*, mas não consegui montar o comentário agora. Tenta reenviar em alguns segundos.`;
          if (extracted.truncated) reply += truncNote;
        } catch (e) {
          console.error("[processor][document] falha modelo:", (e as Error).message);
          reply = `Recebi e li *${label}*, mas travei ao gerar o comentário (${(e as Error).message.slice(0, 120)}). Tenta reenviar.`;
        }
      }

      // Grava outbound e envia — usa o mesmo split de mensagens longas
      const parts: string[] = [];
      const MAX = 3800;
      let rest = reply;
      while (rest.length > MAX) {
        let cut = rest.lastIndexOf("\n\n", MAX);
        if (cut < MAX * 0.5) cut = rest.lastIndexOf("\n", MAX);
        if (cut < MAX * 0.5) cut = MAX;
        parts.push(rest.slice(0, cut).trim());
        rest = rest.slice(cut).trim();
      }
      if (rest) parts.push(rest);

      const { data: outMsg } = await sb
        .from("whatsapp_cloud_messages")
        .insert({
          conversation_id: conv.id,
          user_id: userId,
          direction: "outbound",
          sender: "agent",
          content: reply,
          message_type: "text",
        })
        .select("id")
        .single();

      let sendError: string | null = null;
      try {
        const sentId = await sendWhatsApp(userId, row.from_number, parts[0]);
        if (sentId && outMsg?.id) {
          await sb.from("whatsapp_cloud_messages").update({ wamid: sentId }).eq("id", outMsg.id);
        }
        for (const part of parts.slice(1)) {
          await new Promise((r) => setTimeout(r, 600));
          await sendWhatsApp(userId, row.from_number, part);
        }
      } catch (e) {
        sendError = String((e as Error).message ?? e);
      }

      await sb.from("whatsapp_cloud_conversations").update({ last_message_at: new Date().toISOString() }).eq("id", conv.id);

      if (sendError) {
        await failQueue(row.id, `send_failed: ${sendError}`);
        return { ok: false, reason: "send_failed", error: sendError };
      }
      await doneQueue(row.id);
      return { ok: true, document_commented: true, filename: label, kind: extracted.kind, truncated: extracted.truncated };
    }


    // PASSO 6.9 — Memória por contato (read-only): se o número está em
    // contatos_comerciais, injeta contexto pra Jarvis personalizar a resposta.
    let contactMemoryBlock = "";
    try {
      const match = commercialContactForOwner ?? await findCommercialContactByPhone(userId, row.from_number);
        if (match) {
          commercialContactForOwner = match;
          const { data: recentMsgs } = await sb
            .from("whatsapp_cloud_messages")
            .select("direction, content, created_at")
            .eq("conversation_id", conv.id)
            .order("created_at", { ascending: false })
            .limit(6);
          const histLines = (recentMsgs ?? [])
            .slice(1) // exclui a mensagem atual recém-inserida
            .reverse()
            .map((m: any) => {
              const who = m.direction === "inbound" ? "Ele" : "Você";
              const txt = String(m.content || "").replace(/\s+/g, " ").slice(0, 140);
              return `  - ${who}: ${txt}`;
            })
            .join("\n");
          const tags = Array.isArray(match.tags) ? match.tags.join(", ") : (match.tags || "");
          const linhas = [
            `\n\nCONTEXTO DO CONTATO (uso INTERNO — personalize a resposta com naturalidade, NUNCA cite esses campos literalmente, nunca diga "seu tipo é X" ou "seus próximos passos são Y". É contexto pra VOCÊ, não pra recitar):`,
            match.nome ? `- Nome: ${match.nome}` : null,
            match.empresa ? `- Empresa: ${match.empresa}` : null,
            match.tipo_relacionamento ? `- Tipo de relacionamento: ${match.tipo_relacionamento}` : null,
            tags ? `- Tags: ${tags}` : null,
            match.contexto ? `- Sobre ele: ${match.contexto}` : null,
            match.proximos_passos ? `- Próximos passos combinados: ${match.proximos_passos}` : null,
            match.permite_jarvis_contatar === false ? `- IMPORTANTE: contato NÃO autorizou disparo proativo.` : null,
            histLines ? `- Últimas interações:\n${histLines}` : null,
            `- Regra: fale como quem já conhece a pessoa (use o primeiro nome quando fizer sentido), mas NÃO exponha esses dados crus.`,
          ].filter(Boolean).join("\n");
          contactMemoryBlock = linhas;
          console.log(`[processor][contact-memory] hit for ${row.from_number} -> ${match.nome}`);

          // 🔔 HEADS-UP AO DONO: contato comercial respondeu — Jarvis reporta ao Felício.
          // Assim, quando Marcelo/Renata/etc respondem (ex: confirmando reunião),
          // o dono recebe um resumo imediato no WhatsApp dele.
          try {
            if (!fromIsOwner && userText && userText.trim().length > 0) {
              await notifyOwnerAboutCommercialReply({ userId, fromNumber: row.from_number, match, inboundText: userText, messageType: row.message_type });
            }
          } catch (e) {
            console.warn("[processor][headsup-owner] falhou:", (e as Error).message);
          }
        }
    } catch (e) {
      console.warn("[processor][contact-memory] falhou:", (e as Error).message);
    }


    // PASSO 7 — System prompt (com contexto AMZ se aplicável)
    const { systemPrompt, mode } = await buildSystemPrompt(
      sb,
      {
        user_id: userId,
        agent_mode: (agent as any).agent_mode,
        agent_name: agent.agent_name,
        persona: agent.persona,
        tone: agent.tone,
        greeting: agent.greeting,
        knowledge_base: agent.knowledge_base,
        handoff_rules: agent.handoff_rules,
        is_active: agent.is_active,
        // Template COMPARTILHADO de segmento + variáveis DESTE tenant
        knowledge_segment_id: (agent as any).knowledge_segment_id,
        nome_consultor: (agent as any).nome_consultor,
        primeiro_nome: (agent as any).primeiro_nome,
        cargo: (agent as any).cargo,
        whatsapp_consultor: (agent as any).whatsapp_consultor,
        owner_phone: (agent as any).owner_phone,
        owner_name: (agent as any).owner_name,
        business_name: (cfg as any)?.business_name,

      },
      userText || "",
      amzContextBlock,
      amzAudience,

    );
    // Injeta DATA/HORA atual (São Paulo) no system prompt — evita respostas desatualizadas
    const nowSP = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      weekday: "long", day: "2-digit", month: "long", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    }).format(new Date());
    const dateBlock = `\n\nCONTEXTO TEMPORAL (IMPORTANTE):\n- Data e hora atual em São Paulo: ${nowSP}.\n- Use SEMPRE esta data como referência de "hoje", "ontem", "esta semana", "este ano".\n- Para qualquer pergunta sobre notícias, eventos, cotações, clima, preços, jogos, agenda ou "o que está acontecendo", chame pesquisar_web com termos incluindo o ano/mês atual e passe recencia="d" (últimas 24h) ou "w" (última semana) quando fizer sentido. NUNCA responda de memória sobre fatos recentes.`;
    const inboundFromOwner = fromIsOwner;
    let mediaBlock = media.length > 0
      ? inboundFromOwner
        ? `\n\nMÍDIA RECEBIDA AGORA (REGRA CRÍTICA):\n- O DONO/RESPONSÁVEL ENVIOU ${media.length} arquivo(s) (foto/vídeo/áudio) nesta mensagem.\n- Foto/vídeo/áudio recebido é MÍDIA LIVRE da biblioteca — NÃO é um produto do catálogo.\n- SEMPRE chame salvar_midia_biblioteca IMEDIATAMENTE. Passe em "contexto" o que ele falou (ou "sem contexto" se só mandou o arquivo).\n- É PROIBIDO chamar postar_redes_sociais quando há mídia nova enviada nesta mensagem — aquela tool é SÓ pra produtos do catálogo, nunca pra mídia recém-enviada.\n- 🏷️ ANÚNCIO: se ele pedir arte/anúncio de produto (veículo, imóvel, máquina, item de loja) e passar dados (modelo, ano, km, preço, garantia), chame criar_anuncio DEPOIS de salvar, NESTA MESMA RESPOSTA — 'titulo' = modelo, 'subtitulo' = ano/câmbio, cada dado citado em 'itens' exatamente como ele escreveu, 'preco' com o valor dito. Nunca invente dado.\n- 🎨 EDIÇÃO: se ele pedir para MELHORAR a foto, escrever dados na imagem (km, ano/modelo, "único dono", preço) ou trocar roupa/fantasia mantendo o ambiente, chame editar_imagem DEPOIS de salvar. Coloque cada dado citado por ele em "textos" (exatamente como ele escreveu) e escolha modo='ficha_tecnica' (produto/veículo — TROCA o ambiente por estúdio/showroom limpo, tirando fios, TV, móveis e bagunça da foto) ou modo='figurino' (troca de roupa mantendo rosto e cenário). Se ele pedir 'ambiente bonito', 'fundo profissional' ou 'ambiente para anúncio', use modo='ficha_tecnica' e NÃO passe preservar_ambiente.\n- ⛔ REGRA DE PUBLICAÇÃO PÓS-EDIÇÃO: se você chamou editar_imagem (ou criar_anuncio) e ele pedir pra POSTAR, a mídia a publicar é SEMPRE a versão TRATADA — chame postar_midia_biblioteca passando o midia_id retornado por aquela tool. É PROIBIDO publicar a foto original enviada por ele.\n- Depois de salvar, responda curto. Só fale de publicar/reusar porque o remetente é o responsável da conta.`
        : `\n\nMÍDIA RECEBIDA AGORA (REGRA CRÍTICA):\n- Um CLIENTE/CONTATO ENVIOU ${media.length} arquivo(s) (foto/vídeo/áudio) nesta mensagem.\n- Esse remetente NÃO é o dono/responsável da conta — trate como cliente, NUNCA como "chefe"/"dono".\n- SEMPRE chame salvar_midia_biblioteca IMEDIATAMENTE para arquivar a mídia (uso interno, não comente com o cliente).\n- DEPOIS: OLHE a foto/vídeo, IDENTIFIQUE o teor (o que aparece — produto, documento, print, situação, etc.) e responda naturalmente comentando o que viu. Se o cliente fez uma pergunta ou pedido junto (ex: "esse produto tem?", "quanto custa?", "vocês fazem isso?"), TIRE A DÚVIDA dele com base no que dá pra ver + contexto do negócio.\n- É PROIBIDO perguntar onde postar, oferecer preparar legenda/post, publicar/reusar em redes ou pedir confirmação de rede/formato.\n- Só DEPOIS de comentar a foto e responder a dúvida, PERGUNTE se ele quer que você encaminhe essa foto/recado pro responsável (Marcelo). Só chame encaminhar_recado_ao_dono se ele CONFIRMAR que quer encaminhar (ou já pediu explicitamente na mesma mensagem).`
      : "";
    if (media.length > 0 && inboundFromOwner) {
      mediaBlock += `\n- PUBLICAÇÃO SEM ID: chame postar_midia_biblioteca sem midia_id. O sistema usará a última foto ou vídeo deste fio de conversa e informará qual mídia escolheu antes das copies.`;
    }

    // Detecta mídia recente em /midias (últimos 30 min) — mesma janela do fallback de editar_imagem
    let recentMediaBlock = "";
    try {
      const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const { data: recMid } = await sb
        .from("midias_whatsapp")
        .select("id, tipo, contexto_original, created_at")
        .eq("user_id", userId)
        .eq("telefone_origem", row.from_number)
        .in("tipo", ["foto", "video"])
        .gte("created_at", cutoff)
        .order("created_at", { ascending: false })
        .limit(1);
      const m0 = recMid?.[0];
      if (m0 && media.length === 0) {
          recentMediaBlock = inboundFromOwner
            ? `\n\nMÍDIA RECENTE NA BIBLIOTECA /midias (últimos 15 min):\n- Tipo: ${m0.tipo}. Contexto salvo: "${m0.contexto_original ?? "sem contexto"}".\n- Se o dono pedir pra POSTAR/DIVULGAR agora em QUALQUER formato (feed, story, stories, reels), a mídia a publicar é ESTA que ele acabou de enviar — chame IMEDIATAMENTE postar_midia_biblioteca passando legenda/nome/preço do texto atual e formato='story' se ele citar story/stories (senão 'feed').\n- 🏷️ ANÚNCIO/ARTE: se ele pedir "cria a imagem para anúncio", "monta a arte", "faz um anúncio" e passar dados do produto (modelo, ano, km, preço, chaves, câmbio, "único dono"), chame IMEDIATAMENTE criar_anuncio NESTA MESMA RESPOSTA usando ESTA foto recente. Monte 'titulo' com o modelo citado, 'subtitulo' com ano/câmbio, coloque cada dado citado em 'itens' EXATAMENTE como ele escreveu e 'preco' com o valor dito. NÃO invente dados e NÃO pergunte nada se ele já deu o modelo.\n- ⛔ NUNCA chame postar_redes_sociais nesse caso — aquela tool busca PRODUTO no CATÁLOGO e vai devolver item ERRADO.\n- 🎨 EDIÇÃO/CENÁRIO: se ele pedir pra MELHORAR a foto, "deixar bonita", "colocar um cenário bonito", "fundo profissional", "ambiente para divulgar no Face/Insta", escrever dados na imagem (km, ano, preço, "único dono") ou trocar roupa/fantasia, chame IMEDIATAMENTE editar_imagem NESTA MESMA RESPOSTA — a ferramenta já pega ESTA foto recente sozinha. Se ele pedir pra COLOCAR/INCLUIR a LOGO ou a MARCA em algum ponto da foto (xícara, camisa, parede, carro), use OBRIGATORIAMENTE modo='aplicar_logo' — a foto dele é mantida igual e só a marca é aplicada; é PROIBIDO gerar outra foto. Use modo='ficha_tecnica' para cenário/estúdio/anúncio de produto e modo='figurino' para troca de roupa. Coloque em "textos" só os dados que ele escreveu.\n- ⛔ NUNCA responda que não consegue editar/gerar imagem, que "não tem essa função" ou que precisa reenviar a foto: a foto está aqui e a ferramenta existe. Chame a tool.\n- ⛔ NÃO chame buscar_estoque/consultar_estoque nesse caso.`
            : `\n\nMÍDIA RECENTE NA BIBLIOTECA /midias (últimos 15 min):\n- Tipo: ${m0.tipo}. Foi enviada por CLIENTE/CONTATO, não pelo responsável.\n- NÃO ofereça postar/divulgar, NÃO pergunte rede/formato e NÃO chame ferramentas de publicação.\n- Se ele acabou de confirmar ("pode mandar", "sim manda pro Marcelo", "encaminha") depois de você ter oferecido, chame encaminhar_recado_ao_dono com incluir_ultima_foto=true.`;
        if (inboundFromOwner) {
          recentMediaBlock = recentMediaBlock.replace(
            /- Se o dono pedir pra POSTAR\/DIVULGAR[\s\S]*?(?=\n- 🏷️ ANÚNCIO\/ARTE:)/,
            "- Se o dono pedir pra POSTAR/DIVULGAR sem identificar a mídia, chame postar_midia_biblioteca SEM midia_id. O sistema usará a última mídia deste fio de conversa e informará qual escolheu.",
          );
        }
      }
    } catch (e) {
      console.warn("[pietro][recent_media_hint] falhou:", (e as Error).message);
    }

    // FIX contexto perdido do vídeo: se dono mandou APENAS texto e há vídeo recente (~15min) sem legenda do dono,
    // persistir esse texto como contexto_original. Assim postar_midia_biblioteca vai achar contexto e não cair em video_sem_contexto.
    let pendingConfirmBlock = "";
    try {
      const isDono = fromIsOwner;
      if (isDono && media.length === 0 && (userText || "").trim().length > 0) {
        const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
        const { data: recVid } = await sb
          .from("midias_whatsapp")
          .select("id, tipo, contexto_original, created_at")
          .eq("user_id", userId)
          .eq("telefone_origem", row.from_number)
          .eq("tipo", "video")
          .gte("created_at", cutoff)
          .order("created_at", { ascending: false })
          .limit(1);
        const v0 = recVid?.[0];
        const contextoAtual = (v0?.contexto_original || "").toString().trim();
        // Considera "sem legenda do dono" se contexto está vazio OU só tem bloco [visão] (vídeo não tem visão, mas por segurança).
        const semLegendaDono = !contextoAtual || /^\s*\[visão\]/i.test(contextoAtual);
        const texto = (userText || "").trim();
        // Evita gravar comandos puros de publicação como legenda.
        const ehComandoPublicar = /^(publica[rl]?|posta[rl]?|manda|pode postar|pode publicar|confirma|confirmar|agend(?:a|ar|e)|ok|sim)\b/i.test(texto);
        // Guard extra: só um post pendente dos últimos 10 min impede que o
        // texto vire legenda da nova mídia. Pendentes antigos não bloqueiam.
        const { data: pendCheck } = await sb
          .from("social_posts_queue")
          .select("id")
          .eq("user_id", userId)
          .eq("status", "aguardando_confirmacao")
          .or(`solicitante_telefone.eq.${row.from_number},solicitante_telefone.is.null`)
          .gte("created_at", new Date(Date.now() - 10 * 60 * 1000).toISOString())
          .limit(1);
        const temPending = (pendCheck?.length ?? 0) > 0;
        if (v0 && semLegendaDono && !ehComandoPublicar && !temPending && texto.length >= 3 && texto.length <= 400) {
          await sb
            .from("midias_whatsapp")
            .update({ contexto_original: contextoAtual ? `${texto}\n\n${contextoAtual}` : texto })
            .eq("id", v0.id);
          console.log(`[pietro][video_contexto_persist] midia=${v0.id} len=${texto.length}`);
        }
      }

      // FIX token não consumido: se há pending aguardando confirmação (até 24h) e dono manda linguagem natural de publicar,
      // instruir o LLM a chamar confirmar_postagem_redes com o token JÁ existente em vez de recriar do zero.
      if (isDono) {
        const cutoffPend = new Date(Date.now() - SOCIAL_CONFIRMATION_TTL_MS).toISOString();
        const { data: pendRows } = await sb
          .from("social_posts_queue")
          .select("platform, error_message, created_at, updated_at, solicitante_telefone")
          .eq("user_id", userId)
          .eq("status", "aguardando_confirmacao")
          .or(`solicitante_telefone.eq.${row.from_number},solicitante_telefone.is.null`)
          .gte("created_at", cutoffPend)
          .order("updated_at", { ascending: false })
          .limit(50);
        if (pendRows && pendRows.length > 0) {
          const marker = (pendRows[0] as any).error_message as string | null;
          const tokMatch = marker?.match(/jarvis_token:([a-f0-9]{8})/i);
          const token = tokMatch?.[1];
          if (token) {
            const tokenRows = pendRows.filter((pendingRow: any) =>
              pendingRow.error_message?.match(/jarvis_token:([a-f0-9]{8})/i)?.[1]?.toLowerCase()
                === token.toLowerCase()
            );
            const pendingCount = new Set(pendRows.map((pendingRow: any) =>
              pendingRow.error_message?.match(/jarvis_token:([a-f0-9]{8})/i)?.[1]?.toLowerCase()
            ).filter(Boolean)).size;
            const formato = formatoFromPendingMarker(marker);
            const midiaTipo = midiaTipoFromPendingMarker(marker);
            const redes = [...new Set(tokenRows.map((r: any) => r.platform))].join(", ");
            const selectedVariant = decodePendingPostState(marker)?.variantSelecionada;
            const pendingIsRecent = isPendingInteractionRecent(
              tokenRows[0].created_at,
              tokenRows[0].updated_at,
            );
            const phase = canRunSocialPostAction(selectedVariant)
              ? `FASE 2 — texto escolhido: ${selectedVariant}. Agora o dono pode publicar ou agendar.`
              : "FASE 1 — nenhum texto foi escolhido. É PROIBIDO presumir a opção A ou executar publicação/agendamento.";
            const multiple = pendingCount > 1
              ? `\n- Há ${pendingCount} posts pendentes. Use o mais recente e diga ao dono que está usando ${describePendingSocialPost(marker, tokenRows[0].created_at)}.`
              : "";
            const recencyRule = pendingIsRecent
              ? "RECENTE (até 30 min da última interação): respostas curtas podem se referir a este post."
              : "ANTIGO (mais de 30 min): respostas curtas ou ambíguas como sim, ok, pode, vai, manda, A/B/C e ajustes NÃO se referem a este post. Só use com botão/token ou comando explícito agendar <data/hora>, publicar agora ou postar agora. Para publicar, peça confirmação por botão antes.";
            pendingConfirmBlock = `\n\nPOST PENDENTE (últimas 24h):\n- token: ${token}\n- formato: ${formato}\n- mídia: ${midiaTipo}\n- redes: ${redes}\n- janela: ${recencyRule}${multiple}\n- ${phase}\n\nCOMO ROTEAR:\n1. ESCOLHA A/B/C: só chame escolher_variante_post por texto se o pendente for RECENTE; botão com token continua válido por 24h.\n2. PUBLICAR: só depois de A/B/C escolhido. Se ANTIGO, "publicar agora" exige confirmação por botão antes de confirmar_postagem_redes. Respostas curtas nunca publicam post antigo.\n3. AGENDAR: comando explícito "agendar <data/hora>" pode usar o post por 24h e deve informar qual post será usado. Se faltar data, pergunte: "Para quando? Informe o dia/mês e a hora. Ex.: 30/09 às 10h".\n4. AJUSTE: só use texto livre para revisar_post_pendente se o pendente for RECENTE; isso gera novas opções e volta obrigatoriamente à FASE 1.\n5. MUDANÇA DE ESCOPO (rede, formato ou mídia): recrie via postar_midia_biblioteca.\n- Nunca presuma A. Mídia nova nunca usa este pendente antigo.\n- Se a intenção explícita for agendar/publicar e não houver post pendente, responda: "Não encontrei um post aguardando aprovação. Quer que eu prepare de novo a partir da última mídia?" Nunca transforme isso em consulta de agendamentos.`;
          }
        }
      }
    } catch (e) {
      console.warn("[pietro][video_ctx_or_pending] falhou:", (e as Error).message);
    }

    // Bloco de identidade do RESPONSÁVEL (dono do tenant) — injeta quando quem fala é CLIENTE/CONTATO (não o dono).
    // Sem isso, o agente não sabe quem é "Marcelo/Felício/chefe" e cai em respostas do tipo "não sei qual Marcelo".
    let ownerHintBlock = "";
    const _fromNumForPrompt = String(row.from_number || "");
    const _tenantNichoTxt = `${(agent as any)?.persona || ""} ${(agent as any)?.knowledge_base || ""} ${(agent as any)?.greeting || ""}`;
    const _tenantConsorcio = /cons[oó]rcio|ademicon|carta\s+de\s+cr[eé]dito/i.test(_tenantNichoTxt);
    if (!inboundFromOwner && _tenantOwner?.name) {
      const nomeCompleto = _tenantOwner.name.trim();
      const primeiroNome = nomeCompleto.split(/\s+/)[0] || nomeCompleto;
      ownerHintBlock = `\n\n=== RESPONSÁVEL DESTE ATENDIMENTO (LEIA ANTES DE RESPONDER) ===\n- O DONO/CHEFE/RESPONSÁVEL deste agente é **${nomeCompleto}** (chamado geralmente de "${primeiroNome}").\n- Quando o cliente disser "manda pro ${primeiroNome}", "passa pro chefe", "avisa o dono", "encaminha pra ele", "passe para a equipe", "passa pro gerente", "pede pra equipe/consultor me mandar", "pede um orçamento/plano", ou QUALQUER pedido pra que alguém DA CASA responda/envie algo — chame IMEDIATAMENTE \`encaminhar_recado_ao_dono\` com um recado humanizado (incluindo nome/telefone do cliente e o que ele quer). NÃO chame \`enviar_mensagem_contato_comercial\`, NÃO chame listar_contatos_comerciais, NÃO tente "identificar qual ${primeiroNome}", NÃO peça sobrenome — o responsável já está configurado no sistema e a ferramenta sabe pra quem mandar.\n- É PROIBIDO responder ao cliente coisas como "não consegui identificar qual ${primeiroNome}", "tem vários com esse nome", "me confirma o nome completo dele" — isso é falha grave de atendimento. Se o cliente pediu pra passar algo pra dentro da casa, você JÁ SABE pra quem: é ${primeiroNome}.\n\n=== REGRA DE OURO DO ENCAMINHAMENTO (NUNCA VIOLE) ===\n- Quando o cliente pedir algo que você não pode resolver (orçamento, simulação, valores, negociação) ou pedir falar com alguém da casa, chame \`encaminhar_recado_ao_dono\` IMEDIATAMENTE, SEM ANUNCIAR ANTES. Não escreva nada sobre envio antes da ferramenta rodar.\n- Só DEPOIS de a ferramenta retornar \`ok: true\`, confirme ao cliente que o recado foi enviado — e a confirmação DEVE terminar com o comprovante (protocolo) devolvido pela ferramenta.\n- É PROIBIDO dizer que encaminhou, que vai encaminhar, que passou o recado, ou que o dono/${primeiroNome} vai retornar, sem que a ferramenta tenha retornado \`ok: true\`.\n- Se a ferramenta falhar (\`ok\` diferente de true ou \`erro\`), diga ao cliente que houve um problema no envio e peça o nome e o telefone dele para retorno. NUNCA invente entrega.\n- Confirmação modelo (só com ok: true), 1 linha curta:\n   1) "Prontinho, acabei de mandar seu recado aqui pro ${primeiroNome} — assim que ele puder, te retorna. <protocolo>"\n- PROIBIDO terminar mensagem com convite ou pergunta de cortesia ("é só me chamar", "qualquer dúvida", "fico à disposição", "posso te ajudar em mais algo?"). A resposta termina no raciocínio.\n- O sistema pergunta o nome do cliente automaticamente DEPOIS do encaminhamento — você NUNCA pede o nome antes de encaminhar.\n- Se o cliente responder que quer ir adiantando com você, ATENDA NORMALMENTE. Se preferir aguardar o ${primeiroNome}, respeite e se coloque à disposição.\n- Nunca recite o texto do recado nem o telefone de ninguém.\n\n=== COLETA NATURAL DE DADOS DO CLIENTE (LEVE, SEM INSISTIR) ===\n- Logo no início da conversa, de forma leve e humanizada, pergunte UMA VEZ: nome do cliente e o que ele precisa. O telefone padrão já é o próprio WhatsApp dele (${_fromNumForPrompt}) — só peça outro se ele oferecer.\n- Se o cliente NÃO responder, **NÃO repita a pergunta, NÃO insista, NÃO trave o atendimento**. Siga ajudando normalmente com o que ele quiser falar.\n- Guarde mentalmente o que ele informar espontaneamente.\n- SEMPRE que chamar \`encaminhar_recado_ao_dono\`, inclua no topo do \`recado\`:\n    Nome: <nome informado, ou "não informado">\n    Telefone: <telefone informado pelo cliente; se não informou, use ${_fromNumForPrompt}>\n  Depois, 1-3 linhas do que o cliente quer.`;
      if (_tenantConsorcio) {
        ownerHintBlock += `\n\n=== PRÉ-ATENDIMENTO DE CONSÓRCIO — OFERECER UMA VEZ, RESPEITAR RESPOSTA ===\n- Quando o cliente demonstrar INTERESSE em consórcio (ex: "quero contratar", "tenho interesse", "como funciona", "quero uma proposta", "quero falar sobre consórcio"), você DEVE oferecer UMA VEZ o pré-atendimento antes de encaminhar pro ${primeiroNome}. Assim o ${primeiroNome} já recebe o cliente com tudo pronto.\n- Ofereça de forma natural, em UMA mensagem só, algo como:\n  "Que ótimo! Pra já adiantar e o ${primeiroNome} te retornar com a proposta na mão, posso te fazer umas perguntinhas rápidas e recolher uns documentos (RG/CNH, comprovante de residência e de renda)? Assim ele já monta tudo antes de te ligar. Se preferir falar direto com ele, também tudo bem — é só me avisar."\n- Se o cliente ACEITAR: colete um item por vez, com ritmo de conversa (bem/valor da carta/prazo → nome completo/CPF → RG ou CNH → comprovante de residência → comprovante de renda → IR se tiver). Cada documento/dado recebido, agradeça leve e siga pro próximo. Se ele parar de responder ou pular etapa, DEIXE PRA LÁ e siga pro handoff.\n- Se o cliente RECUSAR ou preferir falar direto: respeite, NÃO insista, e faça o handoff automático pro ${primeiroNome}.\n- Se o cliente IGNORAR a oferta e responder outra coisa: siga o rumo dele, não repita a oferta.\n- REGRA DE OURO: **oferecer o pré-atendimento é OBRIGATÓRIO uma vez em conversas com interesse em consórcio, mas insistir é PROIBIDO.**\n\n=== HANDOFF AUTOMÁTICO AO FINAL DO ATENDIMENTO (OBRIGATÓRIO) ===\n- Assim que você PERCEBER que o atendimento chegou ao fim naturalmente, chame \`encaminhar_recado_ao_dono\` AUTOMATICAMENTE — SEM esperar o cliente pedir. O ${primeiroNome} PRECISA receber o resumo de todo cliente que passou por você.\n- Sinais de que o atendimento acabou (dispare o handoff assim que UM deles ocorrer):\n  • Cliente se despediu ("valeu", "obrigado", "tá bom então", "depois eu vejo", "vou pensar", "qualquer coisa te falo", 👍/🙏).\n  • Cliente demonstrou interesse concreto E você já concluiu (ou ele recusou) o pré-atendimento — hora de passar pro ${primeiroNome}.\n  • Cliente mandou documento(s) e não continuou a conversa em ~1-2 mensagens.\n  • Você já respondeu a dúvida principal e o cliente ficou em silêncio por várias trocas / mandou só "ok".\n- **AVISE O CLIENTE** antes/depois do handoff automático: "Perfeito, vou passar tudo isso pro ${primeiroNome} agora — ele te retorna em breve com a proposta." Não é surpresa: o cliente precisa saber que o próximo contato será do ${primeiroNome}.\n- REGRA ANTI-DUPLICATA: chame \`encaminhar_recado_ao_dono\` **UMA VEZ POR ATENDIMENTO**. Se já encaminhou nesta conversa e o cliente voltou a falar depois, só encaminhe de novo se surgiu FATO NOVO relevante (novo documento, mudou de ideia, quer fechar agora, etc.).\n- O recado deve conter:\n    Nome: <nome do cliente ou "não informado">\n    Telefone: <telefone do cliente; se não informou, ${_fromNumForPrompt}>\n    Status: <"Interessado — quer proposta" | "Só tirou dúvida" | "Mandou documentos" | "Vai pensar" | resumo curto do estágio>\n    Dados coletados: <bem, valor da carta, prazo, CPF, renda, etc. — só o que foi informado>\n    Documentos recebidos: <lista, ou "nenhum">\n    Resumo (2-4 linhas): o que o cliente quer, o que você já explicou, o que ${primeiroNome} precisa fazer ao retornar.`;
      }
    }

    // === SILVESTER DOSSIÊ — fire-and-forget ===
    // Para conversas com CLIENTE (não-dono), dispara extração/atualização de dossiê em background.
    // Não bloqueia a resposta ao cliente. Roda para texto E mídia.
    if (!inboundFromOwner && tenantOwnerPhone) {
      try {
        // Coleta mídias JÁ salvas (fotos/PDFs) da biblioteca dessa conversa (últimos 10min)
        const cutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();
        const { data: recentMidias } = await sb
          .from("midias_whatsapp")
          .select("midia_url, tipo, created_at, telefone_origem")
          .eq("user_id", userId)
          .eq("telefone_origem", row.from_number)
          .in("tipo", ["foto"])
          .gte("created_at", cutoff)
          .order("created_at", { ascending: false })
          .limit(5);
        const mediaPayload = (recentMidias ?? []).map((m: any) => ({ url: m.midia_url }));

        // Coleta últimas mensagens de texto do cliente (para extração de dados)
        const { data: recentTexts } = await sb
          .from("whatsapp_cloud_messages")
          .select("content, direction, created_at")
          .eq("conversation_id", conv.id)
          .eq("direction", "inbound")
          .order("created_at", { ascending: false })
          .limit(8);
        const textoConversa = (recentTexts ?? []).reverse().map((m: any) => m.content).filter(Boolean).join("\n");

        const payload = {
          user_id: userId,
          telefone_cliente: row.from_number,
          nome_cliente: contactName || null,
          owner_phone: tenantOwnerPhone,
          media: mediaPayload,
          texto_conversa: textoConversa,
        };
        // fire-and-forget
        fetch(`${SUPABASE_URL}/functions/v1/silvester-extract-document`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SERVICE_KEY}`,
          },
          body: JSON.stringify(payload),
        }).then((r) => console.log(`[silvester-hook] fired status=${r.status}`)).catch((e) => console.warn("[silvester-hook] err", (e as Error).message));
      } catch (e) {
        console.warn("[silvester-hook] setup falhou:", (e as Error).message);
      }
    }

    // EBOOK DE PRESENTE (multi-tenant): só entra no prompt se o tenant configurou
    // e se este contato ainda não recebeu/recusou. Guardrail de 1x por contato.
    let ebookBlock = "";
    try {
      if (!fromIsOwner && row.from_number) {
        const ebookTenant = await getTenantEbook(sb, userId);
        if (ebookTenant) {
          const entregaEbook = await getEntregaEbook(sb, userId, row.from_number);
          if (!entregaEbook) {
            ebookBlock = `\n\nPRESENTE DISPONÍVEL (use com elegância, NUNCA de cara):\n- Este negócio tem um ebook de presente: "${ebookTenant.nome}".\n- REGRA: atender vem primeiro. Só mencione o presente DEPOIS de resolver o que a pessoa queria, e só se a conversa estiver num momento natural.\n- Convite sugerido (adapte ao seu tom, não copie robótico): "Ah, e se quiser, salva nosso contato que te mando de presente o ebook ${ebookTenant.nome} 🎁 — quer?"\n- Se ela disser que quer, chame entregar_ebook_presente. Se ela não quiser ou ignorar, DEIXE PASSAR e nunca ofereça de novo.\n- É PROIBIDO oferecer o presente mais de uma vez, insistir, ou usar o presente pra empurrar venda.`;
          } else if (entregaEbook.status === "entregue") {
            ebookBlock = `\n\nPRESENTE: este contato JÁ recebeu o ebook "${ebookTenant.nome}". NÃO ofereça de novo e não chame entregar_ebook_presente.`;
          } else {
            ebookBlock = `\n\nPRESENTE: este contato já foi abordado sobre o ebook "${ebookTenant.nome}". NÃO ofereça de novo.`;
          }
        }
      }
    } catch (e) {
      console.warn("[ebook][prompt-block] falhou:", (e as Error).message);
    }

    // ⛔ ANTI-PROMESSA: o agente não pode dizer que vai fazer e não chamar a tool no mesmo turno.
    const antiPromessaBlock = `\n\nENTREGA NO MESMO TURNO (REGRA ABSOLUTA):\n- É PROIBIDO prometer trabalho futuro. Frases como "já estou preparando", "fica pronto em um instante", "vou montar e te mando", "aguarde uns minutos" são PROIBIDAS se você não chamou a ferramenta correspondente NESTA MESMA RESPOSTA.\n- Você NÃO tem fila nem execução em segundo plano: se não chamar a tool agora, NADA acontece e o pedido se perde.\n- Pedido de arte/anúncio/imagem/post ⇒ chame a tool (criar_anuncio, editar_imagem, gerar_imagem, criar_carrossel, postar_midia_biblioteca) AGORA e só depois responda.\n- Se faltar UM dado essencial, faça UMA pergunta curta em vez de prometer. Se os dados já vieram, execute sem perguntar.`;

    // ⛔ ANTI-RECUSA: o modelo não pode inventar limitação que ele não tem.
    const antiRecusaBlock = `\n\nCAPACIDADES REAIS (REGRA ABSOLUTA — NUNCA NEGUE):\n- Você VÊ imagens, ESCUTA áudios, LÊ documentos e EDITA/GERA imagens por ferramenta.\n- É TERMINANTEMENTE PROIBIDO dizer qualquer variação de: "sou um assistente de texto", "não consigo processar imagens/áudios", "não posso editar fotos", "não tenho essa funcionalidade", "não consigo transcrever áudio".\n- Pedido de melhorar/tratar foto, trocar cenário/fundo, criar arte para Facebook/Instagram ⇒ chame editar_imagem (ou criar_anuncio/gerar_imagem) AGORA.\n- Se a ferramenta devolver erro, diga o erro real em uma frase curta e o que você precisa. NUNCA transforme erro técnico em "não tenho essa capacidade".`;

    // === RETENTATIVA DETERMINÍSTICA DE LEAD JÁ QUALIFICADO ===================
    // O primeiro aviso é disparado pela tool somente depois de NOME + RAMO.
    // Se o envio falhar, uma mensagem posterior tenta novamente usando o
    // cadastro persistido, sem relaxar os dois campos obrigatórios.
    if (!inboundFromOwner && tenantOwnerPhone && row.message_type === "text") {
      try {
        const { data: pendingLead } = await sb
          .from("jarvis_leads")
          .select("nome, empresa, ramo, interesse, notificado_em")
          .eq("user_id", userId)
          .eq("telefone", row.from_number)
          .is("notificado_em", null)
          .maybeSingle();
        if (pendingLead?.nome?.trim() && pendingLead?.ramo?.trim()) {
          const rawNotice = await toolRegistrarLeadNovo({
            nome: pendingLead.nome,
            empresa: pendingLead.empresa || undefined,
            ramo: pendingLead.ramo,
            interesse: pendingLead.interesse || undefined,
          }, { userId, fromNumber: row.from_number });
          const notice = JSON.parse(rawNotice);
          if (notice?.notificado === true && notice?.message_id) {
            console.log(`[processor][lead_notice][delivered] from=${row.from_number} owner=${tenantOwnerPhone} wamid=${notice.message_id}`);
          } else if (notice?.motivo !== "lead_ja_notificado") {
            console.warn(`[processor][lead_notice][not_delivered] from=${row.from_number} motivo=${notice?.motivo ?? notice?.erro ?? "unknown"}`);
          }
        }
      } catch (e) {
        console.warn(`[processor][lead_notice][retry_next_message] from=${row.from_number} erro=${(e as Error).message}`);
      }
    }

    // === ESTADO PERSISTENTE DA CONVERSA (comprovante de encaminhamento + decisões) ===
    const agentState = await loadAgentState(sb, convStateIdentity);
    let metaAdsJarvisOriginalText: string | undefined;
    let metaAdsQuestionarioResult: MetaAdsQuestionarioProcessorResult = {
      handled: false,
    };
    try {
      const limitValueText = audioTranscript || userText;
      const limitValueAction = resolveMetaAdsLimitValueInput({
        text: limitValueText,
        pending: agentState.pending_meta_ads_limit_value,
        isOwner: fromIsOwner,
      });
      if (limitValueAction === "consume") {
        const proposed = await toolProporLimiteMensalMetaAds(limitValueText, {
          userId,
          fromNumber: row.from_number,
          convId: conv.id,
          agentState,
        });
        let parsed: any = {};
        try {
          parsed = JSON.parse(proposed.result);
        } catch { /* mensagens de validação são texto simples */ }
        metaAdsQuestionarioResult = {
          handled: true,
          text: String(parsed?.mensagem || proposed.result),
          interactiveButtons: proposed.interactiveButtons,
        };
        if (proposed.interactiveButtons) {
          agentState.pending_meta_ads_limit_value = null;
          await saveAgentState(
            sb,
            convStateIdentity,
            { pending_meta_ads_limit_value: null },
            agentState,
          );
        }
      } else {
        if (limitValueAction === "clear") {
          agentState.pending_meta_ads_limit_value = null;
          await saveAgentState(
            sb,
            convStateIdentity,
            { pending_meta_ads_limit_value: null },
            agentState,
          );
        }
        const limitAction = resolveMetaAdsLimitAction({
          text: userText,
          pending: agentState.pending_meta_ads_limit,
          isOwner: fromIsOwner,
        });
        if (limitAction) {
          metaAdsQuestionarioResult = await applyMetaAdsLimitAction({
            ...limitAction,
            ctx: {
              userId,
              fromNumber: row.from_number,
              convId: conv.id,
              agentState,
            },
            conversation: convStateIdentity,
            agentState,
          });
        } else {
          const ambiguityChoice = resolveMetaAdsQuestionarioAmbiguity({
            text: userText,
            pending: agentState.pending_meta_ads_ambiguity,
          });
          if (ambiguityChoice) {
            agentState.pending_meta_ads_ambiguity = null;
            await saveAgentState(
              sb,
              convStateIdentity,
              { pending_meta_ads_ambiguity: null },
              agentState,
            );
            if (ambiguityChoice.destino === "jarvis") {
              metaAdsJarvisOriginalText = ambiguityChoice.textoOriginal;
            } else {
              metaAdsQuestionarioResult = await processMetaAdsQuestionario({
                userId,
                fromNumber: row.from_number,
                conversationId: conv.id,
                text: userText,
                owner: fromIsOwner,
              });
            }
          } else {
            metaAdsQuestionarioResult = await processMetaAdsQuestionario({
              userId,
              fromNumber: row.from_number,
              conversationId: conv.id,
              text: audioTranscript || userText,
              owner: fromIsOwner,
            });
          }
        }
      }
      if (metaAdsQuestionarioResult.ambiguityOriginal) {
        const pending = {
          texto_original: metaAdsQuestionarioResult.ambiguityOriginal,
          criado_em: new Date().toISOString(),
        };
        agentState.pending_meta_ads_ambiguity = pending;
        await saveAgentState(
          sb,
          convStateIdentity,
          { pending_meta_ads_ambiguity: pending },
          agentState,
        );
      }
      if (metaAdsQuestionarioResult.requestLimitValue) {
        const pending = { criado_em: new Date().toISOString() };
        agentState.pending_meta_ads_limit_value = pending;
        await saveAgentState(
          sb,
          convStateIdentity,
          { pending_meta_ads_limit_value: pending },
          agentState,
        );
      }
    } catch (error) {
      console.error(
        "[meta-ads-questionario][process]",
        (error as Error).message,
      );
      if (
        fromIsOwner &&
        (isMetaAdsQuestionarioTrigger(userText) ||
          metaAdsQuestionarioInteractiveId(userText)?.startsWith("meta_ads_q:"))
      ) {
        metaAdsQuestionarioResult = {
          handled: true,
          text: "Não consegui continuar a campanha agora. Tente novamente em alguns segundos.",
        };
      }
    }
    let persistedForward = (agentState.forward ?? null) as { protocolo?: string; destinatario?: string; wamid?: string | null; at?: string } | null;
    if (!persistedForward?.protocolo && !fromIsOwner) {
      const recovered = await recoverForwardProof(userId, row.from_number);
      if (recovered?.protocolo) {
        persistedForward = recovered;
        agentState.forward = recovered;
        const recoveredSaved = await saveAgentState(sb, convStateIdentity, { forward: recovered }, agentState);
        console.warn(`[processor][handoff][proof_recovered] from=${row.from_number} state_repaired=${recoveredSaved}`);
      }
    }
    const decisaoAnterior = (agentState.decisao ?? null) as { valor?: string; at?: string } | null;

    let estadoBlock = "";
    if (persistedForward?.protocolo) {
      estadoBlock += `\n\n=== ENCAMINHAMENTO JÁ CONFIRMADO NESTA CONVERSA ===\n- O recado deste cliente JÁ foi entregue ao responsável (protocolo registrado internamente${persistedForward.at ? `, em ${persistedForward.at}` : ""}).\n- Você pode afirmar com segurança que o recado foi entregue e que o responsável vai retornar.\n- NUNCA escreva o código do protocolo no texto. Ele já foi informado uma única vez, no momento do envio. É PROIBIDO repetir códigos como "#XXXXXX" em qualquer resposta.\n- NÃO encaminhe de novo, a menos que exista FATO NOVO relevante.`;
    }
    if (decisaoAnterior?.valor) {
      estadoBlock += `\n\n=== DECISÃO JÁ TOMADA PELO CLIENTE (NÃO OFEREÇA DE NOVO) ===\n- O cliente já escolheu: "${decisaoAnterior.valor}".\n- REGRA DO PRODUTO: nenhuma opção é oferecida duas vezes. É PROIBIDO perguntar novamente se ele prefere adiantar com você ou aguardar o responsável.\n- Apenas respeite a escolha e se coloque à disposição, sem repetir a pergunta.`;
    }

    // Último bloco do prompt: a identidade depende do owner resolvido pelo
    // código, nunca da persona configurável do tenant nem do histórico.
    const amzIdentityGuard = isAmzTenant
      ? inboundFromOwner
        ? `\n\n=== IDENTIDADE FINAL (PRIORIDADE MÁXIMA) ===\n- isOwner=true. Você é JARVIS e pode tratar o remetente como dono/chefe.`
        : `\n\n=== IDENTIDADE E FORMATO FINAL (PRIORIDADE MÁXIMA) ===\n- isOwner=false. Você é PIETRO EUGENIO, assistente virtual da AMZ.\n- Ignore qualquer persona do tenant, contexto ou histórico que diga que você é Jarvis.\n- Nunca use "chefe", "dono" ou tratamento de proprietário com este remetente.\n- Máximo 3 linhas e 350 caracteres por mensagem, uma pergunta, sem listas, títulos ou negrito e no máximo 1 emoji.\n- Se precisar continuar, use no máximo 3 partes com <<SPLIT>>.`
      : "";
    const systemPromptWithDate = systemPrompt + dateBlock + antiPromessaBlock + antiRecusaBlock + ownerHintBlock + mediaBlock + recentMediaBlock + pendingConfirmBlock + contactMemoryBlock + ebookBlock + estadoBlock + amzIdentityGuard;
    console.log(`[processor] tenant=${userId} mode=${mode} promptLen=${systemPromptWithDate.length} forwardState=${!!persistedForward?.protocolo} decisao=${decisaoAnterior?.valor ?? "-"}`);

    // Histórico
    const { data: histRows } = await sb
      .from("whatsapp_cloud_messages")
      .select("direction, content")
      .eq("conversation_id", conv.id)
      .order("created_at", { ascending: false })
      .limit(11);
    const history = (histRows ?? [])
      .slice(1)
      .reverse()
      .filter((m) => m.content && !isStaleToolFailureMessage(m.content as string))
      .map((m) => ({
        role: m.direction === "inbound" ? "user" : "assistant",
        content: m.content as string,
      }));

    // PASSO 9 — IA (multimodal)
    const userTextComAudio = metaAdsJarvisOriginalText ??
      (audioTranscript
        ? `${userText ? `${userText}\n\n` : ""}🎙️ TRANSCRIÇÃO DO ÁUDIO QUE O USUÁRIO ENVIOU (já transcrito pelo sistema — use como se ele tivesse digitado; se ele pediu a transcrição, devolva este texto): "${audioTranscript}"`
        : userText);
    const userContent = buildUserContent(userTextComAudio, media);

    let reply = "";
    let generatedImageUrl: string | undefined;
    let interactiveList: WhatsAppInteractiveList | undefined;
    let interactiveButtons: WhatsAppInteractiveButtons | undefined;
    let forwardProof: string | undefined;
    let forwardAttempted = false;
    let metaAdsSummaryDraftId: string | undefined;
    try {
      if (metaAdsQuestionarioResult.handled) {
        reply = metaAdsQuestionarioResult.text ??
          "Vamos continuar sua campanha.";
        interactiveList = metaAdsQuestionarioResult.interactiveList;
        interactiveButtons = metaAdsQuestionarioResult.interactiveButtons;
        metaAdsSummaryDraftId = metaAdsQuestionarioResult.summaryDraftId;
      } else {
        const aiResult = await callGemini(systemPromptWithDate, history, userContent, media.length > 0, {
          userId,
          fromNumber: row.from_number,
          media,
          convId: conv.id,
          agentState,
          demoTestPhones: Array.isArray((agent as any).demo_test_phones)
            ? (agent as any).demo_test_phones
            : [],
        });
        reply = aiResult.text;
        generatedImageUrl = aiResult.imageUrl;
        interactiveList = aiResult.interactiveList;
        interactiveButtons = metaAdsQuestionarioResult.offerResume
          ? metaAdsQuestionarioContinuarButtons()
          : aiResult.interactiveButtons;
        forwardProof = aiResult.forwardProof;
        forwardAttempted = !!aiResult.forwardAttempted;
        metaAdsSummaryDraftId = aiResult.metaAdsSummaryDraftId;
      }
    } catch (e) {
      const aiError = String((e as Error).message ?? e).slice(0, 300);
      console.error("[processor][ai_fallback]", aiError);
      reply = inboundFromOwner
        ? "Recebi sua mensagem, mas tive uma instabilidade agora. Me manda de novo em alguns segundos que eu continuo."
        : `Boa tarde! Tudo bem? Posso saber seu nome? Me conta rapidinho o que você precisa — e, pra retorno, uso esse WhatsApp mesmo (${row.from_number}) ou prefere outro telefone?`;
    }

    // ---- Blindagem anti "encaminhamento fantasma" ----------------------------
    // 1) Handoff determinístico quando o cliente pediu orçamento/valores ou encerrou
    //    ("aguardar ele", "valeu", "vou pensar") e a IA não chamou a ferramenta.
    // 2) A confirmação ao cliente só sobrevive se houver comprovante real.
    if (!inboundFromOwner) {
      try {
        const ownerInfo = await resolveTenantOwner(sb, userId);
        const ownerFirst = ownerFirstName(ownerInfo?.name);
        const pediuDono = pedeAtencaoDoDono(userText);
        const encerrou = clienteEncerrouAtendimento(userText);
        const pediuEncaminhamentoExplicito = isExplicitOwnerForwardIntent(userText, ownerInfo?.name);

        const jaEncaminhado = !!persistedForward?.protocolo;
        if (!forwardProof && ownerInfo?.phone && ownerInfo.phone !== row.from_number && (pediuDono || encerrou || pediuEncaminhamentoExplicito) && !(jaEncaminhado && encerrou && !pediuDono && !pediuEncaminhamentoExplicito)) {
          console.warn(`[processor][handoff][miss] tool não executada com sucesso (pediu_dono=${pediuDono} encerrou=${encerrou} tentou=${forwardAttempted}) from=${row.from_number} → handoff determinístico`);
          const recadoAuto = [
            `Nome: ${(conv as any)?.contact_name ?? "não informado"}`,
            `Telefone: ${row.from_number}`,
            `Status: ${encerrou ? "Atendimento encerrado — cliente prefere falar/aguardar você" : "Interessado — pediu orçamento/valores"}`,
            `Resumo: última mensagem do cliente: "${(userText || "(mídia)").slice(0, 300)}"`,
            "Ação: retornar o contato do cliente.",
          ].join("\n");
          try {
            const r = await toolEncaminharRecadoAoDono({ recado: recadoAuto }, { userId, fromNumber: row.from_number, media });
            const p = JSON.parse(r);
            if (p?.ok === true && p?.message_id) forwardProof = String(p?.protocolo || buildForwardProof(p.message_id));
            else console.warn("[processor][handoff][deterministic_failed]", String(p?.erro ?? "desconhecido"));
          } catch (e) {
            console.warn("[processor][handoff][deterministic_error]", (e as Error).message);
          }
        }

        const guard = enforceForwardTruth(reply, forwardProof, ownerFirst, persistedForward);
        if (guard.scrubbed) {
          console.warn(`[processor][handoff][claim_scrubbed] afirmação de encaminhamento sem comprovante removida from=${row.from_number}`);
        }
        reply = guard.text;

        // Protocolo só pode aparecer no turno em que foi gerado, no fim da linha.
        const proto = sanitizeProtocolLeaks(reply, forwardProof);
        if (proto.cleaned) console.warn(`[processor][protocol][leak_scrubbed] protocolo copiado do histórico removido from=${row.from_number}`);
        reply = proto.text;

        // Cliente já decidiu? Não oferecer a mesma escolha duas vezes.
        if (decisaoAnterior?.valor || encerrou) {
          const dedupe = removerReoferta(reply);
          if (dedupe.removed) console.warn(`[processor][oferta][reoferta_removida] from=${row.from_number}`);
          reply = dedupe.text || reply;
        }

        // Persiste comprovante e decisão no estado da conversa
        const patch: AgentConvState = {};
        if (forwardProof && !persistedForward?.protocolo) {
          patch.forward = {
            protocolo: forwardProof,
            destinatario: ownerInfo?.phone ?? null as any,
            wamid: null,
            at: new Date().toISOString(),
          };
        }
        if (encerrou && !decisaoAnterior?.valor) {
          patch.decisao = { valor: "aguardar o responsável", at: new Date().toISOString() };
        }

        // Voz: a resposta termina no raciocínio — sem convite no fim.
        const semConvite = removerConviteFinal(reply);
        if (semConvite.removed) console.log(`[processor][voz][convite_final_removido] from=${row.from_number}`);
        reply = semConvite.text;

        // Nome DEPOIS do encaminhamento: pergunta curta, UMA vez só.
        if (!nomeLeadConhecido) {
          nomeLeadConhecido = await findKnownLeadName({
            userId,
            telefone: row.from_number,
            conversationId: conv.id,
          });
          if (nomeLeadConhecido) {
            await persistKnownLeadName({
              userId,
              telefone: row.from_number,
              conversationId: conv.id,
              nome: nomeLeadConhecido,
            });
            (conv as any).contact_name = nomeLeadConhecido;
            patch.nome = nomeLeadConhecido;
            patch.nome_pergunta = "feita";
          }
        }
        const jaTemNome = !!(nomeLeadConhecido || (agentState as any)?.nome);
        const jaPerguntou = !!(agentState as any)?.nome_pergunta || nomePerguntado;
        if (forwardProof && !jaTemNome && !jaPerguntou) {
          reply = `${reply}<<SPLIT>>${PERGUNTA_NOME}`;
          patch.nome_pergunta = true;
          console.log(`[processor][lead_nome][pergunta_enviada] from=${row.from_number}`);
        }

        const siteLink = appendAmzSiteLinkAfterHandoff({
          text: reply,
          isAmzProspect: userId === ADMIN_AMZ_USER_ID,
          handoffSucceeded: Boolean(forwardProof),
          siteLinkAlreadySent: agentState.site_link_enviado === true,
        });
        reply = siteLink.text;
        if (siteLink.markSiteLinkSent) {
          patch.site_link_enviado = true;
        }

        if (Object.keys(patch).length > 0) {
          await saveAgentState(sb, convStateIdentity, patch, agentState);
          console.log(`[processor][agent_state][saved] forward=${!!patch.forward} decisao=${patch.decisao?.valor ?? "-"}`);
        }
      } catch (e) {
        console.warn("[processor][handoff][guard_failed]", (e as Error).message);
      }
    }


    // Se o contato comercial respondeu por áudio, userText vem vazio. Agora que a IA ouviu
    // e produziu uma resposta, usa esse entendimento para avisar o dono também.
    if (commercialContactForOwner && !userText.trim() && media.some((m) => m.kind === "audio")) {
      try {
        const deterministicSent = await notifyOwnerDeterministic({
          userId,
          fromNumber: row.from_number,
          match: commercialContactForOwner,
          text: reply,
          messageType: row.message_type,
          source: "audio",
        });
        if (!deterministicSent) await notifyOwnerAboutCommercialReply({
          userId,
          fromNumber: row.from_number,
          match: commercialContactForOwner,
          inboundText: "",
          aiSummaryText: reply,
          messageType: row.message_type,
        });
      } catch (e) {
        console.warn("[processor][headsup-owner-audio] falhou:", (e as Error).message);
      }
    }

    // Incrementa quota
    await sb
      .from("ai_messages_quota")
      .update({ used_count: quota.used_count + 1 })
      .eq("user_id", userId);

    reply = finalizeAmzInboundReply({
      text: reply,
      isAmzTenant: userId === ADMIN_AMZ_USER_ID,
      inboundFromOwner,
      ownerName: _tenantOwner?.name,
    });

    const dedupedReply = dedupeConsecutiveReplyText(reply);
    if (dedupedReply !== reply) {
      console.warn(`[processor][reply_deduplicated] before=${reply.length} after=${dedupedReply.length}`);
      reply = dedupedReply;
    }

    // Para leads, a trava de transporte limita cada parte a 700 caracteres e
    // no máximo 3 mensagens. Para o dono, preserva prévias/listas/resultados.
    const replyParts = inboundFromOwner
      ? reply.split("<<SPLIT>>").map((p) => p.trim()).filter((p) => p.length > 0)
      : prepareLeadReplyParts(reply);
    const primaryReply = replyParts[0] ?? reply;
    const followUps = replyParts.slice(1);
    const loggedContent = replyParts.join("\n\n---\n\n");

    // PASSO 10 — Grava outbound
    const { data: outMsg } = await sb
      .from("whatsapp_cloud_messages")
      .insert({
        conversation_id: conv.id,
        user_id: userId,
        direction: "outbound",
        sender: "agent",
        content: generatedImageUrl ? `${loggedContent}\n\n[imagem: ${generatedImageUrl}]` : loggedContent,
        message_type: generatedImageUrl ? "image" : (interactiveList || interactiveButtons) ? "interactive" : "text",
      })
      .select("id")
      .single();

    // PASSO 11 — Envia (mensagem principal + follow-ups separados)
    let sendError: string | null = null;
    try {
      const hasFollowUps = followUps.length > 0;
      await sendTypingIndicator(row.phone_number_id, waAccessToken, row.wamid);
      await wait(firstReplyDelayForSenderMs(
        inboundFromOwner,
        row.created_at,
        primaryReply.length,
      ));
      const sentId = await sendWhatsApp(
        userId,
        row.from_number,
        primaryReply,
        generatedImageUrl,
        hasFollowUps ? undefined : interactiveList,
        undefined,
        {
          beforeChunk: async (chunk) => {
            await sendTypingIndicator(row.phone_number_id, waAccessToken, row.wamid);
            await wait(betweenPartsDelayForSenderMs(inboundFromOwner, chunk.length));
          },
        },
      );
      if (sentId && outMsg?.id) {
        await sb.from("whatsapp_cloud_messages").update({ wamid: sentId }).eq("id", outMsg.id);
      }
      for (let index = 0; index < followUps.length; index++) {
        const part = followUps[index];
        const isLast = index === followUps.length - 1;
        try {
          await sendTypingIndicator(row.phone_number_id, waAccessToken, row.wamid);
          await wait(betweenPartsDelayForSenderMs(inboundFromOwner, part.length));
          await sendWhatsApp(
            userId,
            row.from_number,
            part,
            undefined,
            isLast ? interactiveList : undefined,
            undefined,
            {
              beforeChunk: async (chunk) => {
                await sendTypingIndicator(row.phone_number_id, waAccessToken, row.wamid);
                await wait(betweenPartsDelayForSenderMs(inboundFromOwner, chunk.length));
              },
            },
          );
        } catch (e) {
          console.error("[pietro][followup_send_failed]", (e as Error).message ?? e);
          // Interrompe a sequência: continuar enviando poderia entregar a
          // pergunta A/B/C depois de uma mensagem de opções que falhou.
          throw e;
        }
      }
      if (interactiveButtons) {
        await sendTypingIndicator(row.phone_number_id, waAccessToken, row.wamid);
        await wait(betweenPartsDelayForSenderMs(inboundFromOwner, interactiveButtons.body.length));
        await sendWhatsApp(
          userId,
          row.from_number,
          interactiveButtons.body,
          undefined,
          undefined,
          interactiveButtons,
          {
            beforeChunk: async (chunk) => {
              await sendTypingIndicator(row.phone_number_id, waAccessToken, row.wamid);
              await wait(betweenPartsDelayForSenderMs(inboundFromOwner, chunk.length));
            },
          },
        );
      }
    } catch (e) {
      sendError = String((e as Error).message ?? e);
    }

    await sb
      .from("whatsapp_cloud_conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", conv.id);

    if (sendError) {
      await failQueue(row.id, `send_failed: ${sendError}`);
      return { ok: false, reason: "send_failed", error: sendError };
    }

    if (metaAdsSummaryDraftId && outMsg?.id) {
      const summarySentAt = new Date().toISOString();
      const { data: campaign, error: campaignLoadError } = await sb
        .from("meta_ads_campanhas")
        .select("rascunho")
        .eq("id", metaAdsSummaryDraftId)
        .eq("user_id", userId)
        .eq("status", "rascunho")
        .maybeSingle();
      if (!campaignLoadError && campaign?.rascunho) {
        const { error: correlationError } = await sb
          .from("meta_ads_campanhas")
          .update({
            rascunho: {
              ...(campaign.rascunho as Record<string, unknown>),
              resumo_message_id: outMsg.id,
              resumo_enviado_em: summarySentAt,
            },
            atualizado_em: summarySentAt,
          })
          .eq("id", metaAdsSummaryDraftId)
          .eq("user_id", userId)
          .eq("status", "rascunho");
        if (correlationError) {
          console.error("[processor][meta_ads_summary_correlation_failed]");
        }
      }
    }

    await doneQueue(row.id);
    return { ok: true, conversation_id: conv.id, reply_preview: reply.slice(0, 120) };
  } catch (e) {
    const msg = String((e as Error).message ?? e).slice(0, 500);
    await failQueue(row.id, msg);
    return { ok: false, reason: "exception", error: msg };
  } finally {
    stopTypingHeartbeat();
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const queueId = body?.queue_id as string | undefined;

    if (queueId) {
      const result = await processOne(queueId);
      return Response.json(result, { headers: corsHeaders });
    }

    const { data: pending } = await sb
      .from("whatsapp_cloud_inbound_queue")
      .select("id")
      .eq("status", "received")
      .order("created_at", { ascending: true })
      .limit(20);

    const results: any[] = [];
    for (const p of pending ?? []) {
      results.push(await processOne(p.id));
    }
    return Response.json({ processed: results.length, results }, { headers: corsHeaders });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message ?? e) }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
