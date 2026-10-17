import {
  activeFaixasFromCounts,
  buildDetalheVehicleListRows,
  buildProximosDiasUteisVisita,
  buildRecadoConsultor,
  buildRecadoFormCancelado,
  buildRecadoInteresse,
  buildRecadoVisita,
  buildShowcaseMenuSections,
  buildVisitaDiaListRows,
  buildVitrineRecadoIdempotencyKey,
  confirmacaoComNomeLoja,
  confirmacaoVisitaAgendada,
  activeFaixasMotoFromCounts,
  buildMotoShowcaseMenuSections,
  countMotosByFaixa,
  countVehiclesByFaixa,
  registerVitrineRecadoIdempotency,
  vitrineRecadoJaEnviado,
  extractVitrineInteractiveId,
  FaixaPrecoId,
  FaixaPrecoMotoId,
  formatCardBody,
  formatFichaElegante,
  isExplicitVehicleShowcaseRequest,
  isVitrineFormControlText,
  marcaToSlug,
  parseIsoDateFromButtonParts,
  parseVisitaTurnoFromButtonParts,
  parseVitrineButtonId,
  pendingFormExpired,
  pendingFormIsActive,
  PendingVitrineEstoque,
  resolveShowcaseSegmentFromText,
  vitrineFormStepExpectsText,
  vitrineFinanciamentoStepExpectsText,
  normalizeVitrineText,
  shouldEnterShowcase,
  shouldOfferVehicleShowcase,
  slugToMarcaCandidates,
  VehicleShowcaseTenantFlags,
  VeiculoVitrineRow,
  vitrineButtonId,
  vitrineSegmentoFromPending,
  VITRINE_CAROUSEL_PAGE_SIZE,
  VITRINE_CAROUSEL_POST_DELAY_MS,
  VITRINE_ID_PREFIX,
  vehicleDisplayTitle,
  VitrineVisitaTurno,
  VitrineSegmentoCounts,
} from "./vehicle-stock-whatsapp.ts";
import {
  advanceTrocaAfterPhoto,
  advanceTrocaAfterText,
  advanceTrocaSkipOptionalSlot,
  appendTrocaInternalNotes,
  buildRecadoTrocaAvaliacao,
  confirmacaoTrocaCliente,
  currentTrocaFotoSlot,
  mergePendingForTrocaStart,
  promptTrocaModeloAno,
  promptTrocaObservacoes,
  skipTrocaObservacoes,
  type TrocaFotoVisionMeta,
  VITRINE_TROCA_FOTO_SLOTS,
} from "./vehicle-stock-troca.ts";
import type { CarouselCardInput } from "./whatsapp-interactive-carousel.ts";
import {
  isClienteNomeCaptureForm,
  isClienteNomeForm,
  isClienteNomeOpcionalForm,
  parseOptionalClienteNome,
  sanitizeClienteNomeResposta,
  vehicleIdForClienteNomeForm,
  vitrineClienteNomeSalvo,
  vitrineContactNameFallback,
  vitrineNomeParaRecado,
  VITRINE_CLIENTE_NOME_OPCIONAL_PROMPT,
  type VitrineRecadoResume,
} from "./vehicle-stock-cliente-nome.ts";
import { stripAudioTranscriptPrefix } from "./vitrine-inbound-text.ts";
import { isFinanciamentoSpokenSkip } from "./vitrine-spoken-input.ts";
import type { VitrineEvento } from "./vitrine-eventos.ts";
import {
  advanceFinanciamentoAfterText,
  applyFinanciamentoCepLookup,
  applyFinanciamentoCnh,
  applyFinanciamentoLgpdChoice,
  applyFinanciamentoModo,
  applyFinanciamentoPerfil,
  applyFinanciamentoPrazo,
  beginFinanciamentoCorrecao,
  buildFinanciamentoFichaRow,
  buildFinanciamentoResumoText,
  buildRecadoFinanciamentoFichaSemPii,
  confirmacaoFinanciamentoFicha,
  FINANCIAMENTO_LGPD_BODY,
  FINANCIAMENTO_MODO_BODY,
  FINANCIAMENTO_PRAZO_OPTIONS,
  FIN_CORRECTABLE_FIELDS,
  mergePendingForFinanciamentoStart,
  promptFinanciamentoStep,
  skipFinanciamentoInteractiveStep,
  type FinanciamentoFichaRow,
  type FinanciamentoPerfil,
} from "./vehicle-stock-financiamento.ts";
import { safeErrorMessage } from "./pii-log-sanitize.ts";
import { OWNER_VITRINE_CLIENT_PREVIEW_MSG } from "./vehicle-stock-owner-inbound.ts";

export type ShowcaseSendResult = {
  ok: boolean;
  messageId?: string | null;
  httpStatus?: number;
  metaError?: unknown;
};

export type ShowcaseTurnDeps = {
  loadTenantFlags: () => Promise<VehicleShowcaseTenantFlags>;
  loadMarcas: () => Promise<string[]>;
  loadPrecosDisponiveis: () => Promise<number[]>;
  loadVeiculosByMarca: (
    marca: string,
    offset: number,
    limit: number,
  ) => Promise<VeiculoVitrineRow[]>;
  loadVeiculosByFaixa: (
    faixa: FaixaPrecoId,
    offset: number,
    limit: number,
  ) => Promise<VeiculoVitrineRow[]>;
  loadSegmentoCounts: () => Promise<VitrineSegmentoCounts>;
  loadEstilosMoto: () => Promise<string[]>;
  loadPrecosMotosDisponiveis: () => Promise<number[]>;
  loadVeiculosByEstilo: (
    estilo: string,
    offset: number,
    limit: number,
  ) => Promise<VeiculoVitrineRow[]>;
  loadVeiculosByFaixaMoto: (
    faixa: FaixaPrecoMotoId,
    offset: number,
    limit: number,
  ) => Promise<VeiculoVitrineRow[]>;
  loadVeiculoById: (id: string) => Promise<VeiculoVitrineRow | null>;
  sendText: (text: string) => Promise<ShowcaseSendResult>;
  sendMenu: (
    body: string,
    sections: Array<{ title: string; rows: Array<{ id: string; title: string; description?: string }> }>,
    button?: string,
  ) => Promise<ShowcaseSendResult>;
  sendButtons: (
    body: string,
    buttons: Array<{ id: string; title: string }>,
    imageUrl?: string,
  ) => Promise<ShowcaseSendResult>;
  sendImage: (imageUrl: string, caption?: string) => Promise<ShowcaseSendResult>;
  sendImageHeaderButtons: (
    body: string,
    buttons: Array<{ id: string; title: string }>,
    imageUrl: string,
  ) => Promise<ShowcaseSendResult>;
  sendCarousel: (body: string, cards: CarouselCardInput[]) => Promise<ShowcaseSendResult>;
  encaminharRecado: (recado: string) => Promise<{ ok: boolean; protocolo?: string }>;
  savePending: (pending: PendingVitrineEstoque | null) => Promise<void>;
  getPending: () => PendingVitrineEstoque | null | undefined;
  pause: (ms: number) => Promise<void>;
  fetchViaCep: (cep: string) => Promise<import("./viacep-client.ts").ViaCepAddress | null>;
  saveFinanciamentoFicha: (row: FinanciamentoFichaRow) => Promise<{ id: string }>;
  userId: string;
  trackVitrineCrmEvent?: (
    evento: VitrineEvento,
    veiculoId?: string | null,
    vehicleLabel?: string | null,
  ) => void | Promise<void>;
};

export type ShowcaseAudience = "cliente" | "dono";

export type ShowcaseTurnInput = {
  userText: string;
  listId?: string;
  inboundPayload?: unknown;
  contactName?: string | null;
  fromNumber: string;
  forceInteractive?: boolean;
  allowEarlyFormCapture?: boolean;
  audience?: ShowcaseAudience;
  deps: ShowcaseTurnDeps;
};

function isOwnerAudience(input: ShowcaseTurnInput): boolean {
  return input.audience === "dono";
}

async function trackClienteCrmEvent(
  input: ShowcaseTurnInput,
  evento: VitrineEvento,
  veiculoId?: string | null,
  vehicleLabel?: string | null,
): Promise<void> {
  if (isOwnerAudience(input) || !input.deps.trackVitrineCrmEvent) return;
  try {
    await input.deps.trackVitrineCrmEvent(evento, veiculoId ?? null, vehicleLabel ?? null);
  } catch {
    /* auditoria — não bloqueia vitrine */
  }
}

async function ownerClientPreviewStub(
  input: ShowcaseTurnInput,
): Promise<ShowcaseTurnOutput> {
  await input.deps.sendText(OWNER_VITRINE_CLIENT_PREVIEW_MSG);
  return { handled: true, replyPreview: "owner_client_preview" };
}

export type ShowcaseTurnOutput = {
  handled: boolean;
  replyPreview?: string;
};

const VEHICLE_SELECT =
  "id,segmento,marca,modelo,versao,ano_fabricacao,ano_modelo,km,preco,cor,cambio,combustivel,portas,cilindrada_cc,estilo_moto,partida,refrigeracao,blindado,nivel_blindagem,opcionais,caracteristicas,descricao,fotos,status";

export { VEHICLE_SELECT };

function basePending(
  pending: PendingVitrineEstoque | null | undefined,
): PendingVitrineEstoque {
  return pending ?? {
    stage: "detalhe",
    offset: 0,
    updated_at: new Date().toISOString(),
  };
}

/** Recado ao dono com trava de 10 min (mesmo cliente + veículo + ação). */
async function vitrineNotifyOwner(
  input: ShowcaseTurnInput,
  key: string,
  recado: string,
): Promise<{ duplicate: boolean; notified: boolean }> {
  if (isOwnerAudience(input)) {
    return { duplicate: false, notified: false };
  }
  let pending = basePending(input.deps.getPending());
  if (vitrineRecadoJaEnviado(pending, key)) {
    return { duplicate: true, notified: true };
  }
  const fwd = await input.deps.encaminharRecado(recado);
  if (!fwd.ok) {
    return { duplicate: false, notified: false };
  }
  pending = registerVitrineRecadoIdempotency(pending, key);
  await input.deps.savePending(pending);
  return { duplicate: false, notified: true };
}

async function beginClienteNomeOpcional(
  input: ShowcaseTurnInput,
  vehicleId: string,
): Promise<ShowcaseTurnOutput | null> {
  if (isOwnerAudience(input)) return null;
  const pending = basePending(input.deps.getPending());
  if (vitrineClienteNomeSalvo(pending)) return null;
  const now = new Date().toISOString();
  await input.deps.savePending({
    ...pending,
    form: {
      flow: "cliente_nome_opcional",
      step: "nome",
      veiculo_id: vehicleId,
      updated_at: now,
    },
    updated_at: now,
  });
  await input.deps.sendText(VITRINE_CLIENTE_NOME_OPCIONAL_PROMPT);
  return { handled: true, replyPreview: "cliente_nome_opcional_prompt" };
}

async function maybeOfferOptionalClienteNome(
  input: ShowcaseTurnInput,
  vehicleId: string,
  after: ShowcaseTurnOutput,
): Promise<ShowcaseTurnOutput> {
  if (!after.handled) return after;
  const optional = await beginClienteNomeOpcional(input, vehicleId);
  return optional ?? after;
}

async function resumeVitrineRecado(
  input: ShowcaseTurnInput,
  resume: VitrineRecadoResume,
): Promise<ShowcaseTurnOutput> {
  switch (resume.kind) {
    case "interesse":
      return await completeHandoffVehicle(input, resume.vehicleId, "interesse");
    case "consultor":
      if (resume.vehicleId) {
        return await completeHandoffVehicle(input, resume.vehicleId, "consultor");
      }
      return await completeHandoffConsultorGeral(input);
    case "financiamento":
      return await startFinanciamentoFlow(input, resume.vehicleId);
    case "visita":
      return await completeVisitaAgendada(
        input,
        resume.diaIso,
        resume.turno,
      );
    case "troca_confirm":
      return await completeTrocaRecado(input);
  }
}

async function handleClienteNomeStep(
  input: ShowcaseTurnInput,
  pending: PendingVitrineEstoque,
): Promise<ShowcaseTurnOutput> {
  const form = pending.form;
  if (isClienteNomeOpcionalForm(form)) {
    const nome = parseOptionalClienteNome(input.userText);
    const now = new Date().toISOString();
    if (!nome) {
      await input.deps.savePending({
        ...pending,
        form: null,
        form_suspend_backup: null,
        updated_at: now,
      });
      return { handled: false };
    }
    await input.deps.savePending({
      ...pending,
      cliente_nome: nome,
      form: null,
      form_suspend_backup: null,
      updated_at: now,
    });
    await input.deps.sendText(`Obrigado, ${nome.split(/\s+/)[0]}! 😊`);
    return { handled: true, replyPreview: "cliente_nome_opcional_salvo" };
  }
  if (!isClienteNomeForm(form)) {
    return { handled: false };
  }
  const resume = form.resume;
  const parsed = sanitizeClienteNomeResposta(input.userText);
  const nome = parsed || vitrineContactNameFallback(input.contactName);
  const now = new Date().toISOString();
  const restoredForm = pending.form_suspend_backup ?? null;
  await input.deps.savePending({
    ...pending,
    cliente_nome: nome,
    form: restoredForm,
    form_suspend_backup: null,
    updated_at: now,
  });
  return resumeVitrineRecado(input, resume);
}

export async function runVehicleStockShowcaseTurn(
  input: ShowcaseTurnInput,
): Promise<ShowcaseTurnOutput> {
  input = {
    ...input,
    userText: stripAudioTranscriptPrefix(input.userText),
  };
  if (isOwnerAudience(input)) {
    input = { ...input, allowEarlyFormCapture: false };
  }
  const flags = await input.deps.loadTenantFlags();
  if (!shouldOfferVehicleShowcase(flags) && !isOwnerAudience(input)) {
    return { handled: false };
  }

  const vitrineId = extractVitrineInteractiveId({
    userText: input.userText,
    listId: input.listId,
    inboundPayload: input.inboundPayload,
  });
  const explicit = isExplicitVehicleShowcaseRequest(input.userText, flags);

  let pending = input.deps.getPending() ?? null;
  if (isOwnerAudience(input) && pending?.form) {
    pending = {
      ...pending,
      form: null,
      form_suspend_backup: null,
      updated_at: new Date().toISOString(),
    };
    await input.deps.savePending(pending);
  }
  if (pending?.form && pendingFormExpired(pending.form)) {
    pending = {
      ...pending,
      form: null,
      form_suspend_backup: null,
      updated_at: new Date().toISOString(),
    };
    await input.deps.savePending(pending);
  }

  const formControl = isVitrineFormControlText(input.userText);
  if (
    pendingFormIsActive(pending) &&
    isClienteNomeCaptureForm(pending.form) &&
    formControl
  ) {
    return await handleClienteNomeFormControl(input, pending, formControl);
  }

  if (
    pendingFormIsActive(pending) &&
    pending.form.flow === "cliente_nome_opcional" &&
    (vitrineId || explicit) &&
    !formControl
  ) {
    pending = {
      ...pending,
      form: null,
      form_suspend_backup: null,
      updated_at: new Date().toISOString(),
    };
    await input.deps.savePending(pending);
  } else if (pendingFormIsActive(pending) && formControl) {
    return await handleFormControl(input, pending, formControl);
  }

  if (
    pendingFormIsActive(pending) &&
    pending.form.flow === "visita" &&
    !vitrineId
  ) {
    return { handled: false };
  }

  if (
    pendingFormIsActive(pending) &&
    pending.form.flow === "financiamento" &&
    !vitrineId &&
    !input.allowEarlyFormCapture &&
    !vitrineFinanciamentoStepExpectsText(pending.form.step)
  ) {
    if (normalizeVitrineText(input.userText) === "pular") {
      return await handleFinanciamentoInteractivePular(input, pending);
    }
    await input.deps.sendText(
      "Escolha uma opção acima, digite *pular* se aplicável, ou *cancelar*.",
    );
    return { handled: true, replyPreview: "financiamento_aguardando_botao" };
  }

  if (
    pendingFormIsActive(pending) &&
    pending.form.flow === "troca" &&
    !vitrineId &&
    !input.allowEarlyFormCapture
  ) {
    if (pending.form.step === "fotos") {
      await input.deps.sendText(
        "Estou aguardando a foto desta etapa. Envie uma imagem ou digite *cancelar*.",
      );
      return { handled: true, replyPreview: "troca_aguardando_foto" };
    }
    return { handled: false };
  }

  if (
    input.allowEarlyFormCapture &&
    pendingFormIsActive(pending) &&
    isClienteNomeCaptureForm(pending.form) &&
    !vitrineId
  ) {
    return await handleClienteNomeStep(input, pending);
  }

  if (
    input.allowEarlyFormCapture &&
    pendingFormIsActive(pending) &&
    pending.form.flow === "financiamento" &&
    !vitrineId &&
    vitrineFinanciamentoStepExpectsText(pending.form.step)
  ) {
    return await handleFinanciamentoTextStep(input, pending);
  }

  if (
    input.allowEarlyFormCapture &&
    pendingFormIsActive(pending) &&
    pending.form.flow === "troca" &&
    !vitrineId &&
    vitrineFormStepExpectsText(pending.form.step)
  ) {
    return await handleTrocaTextStep(input, pending);
  }

  const entersShowcase = shouldEnterShowcase({
    flags,
    explicitText: explicit,
    vitrineInteractiveId: vitrineId,
  }) ||
    (isOwnerAudience(input) && (!!vitrineId || explicit));
  if (
    !entersShowcase &&
    !(input.allowEarlyFormCapture && pendingFormIsActive(pending))
  ) {
    return { handled: false };
  }

  if (vitrineId || input.forceInteractive) {
    const result = await handleVitrineAction({
      ...input,
      vitrineId: vitrineId || "",
      flags,
    });
    return result;
  }

  if (explicit) {
    return await openShowcaseEntry(input);
  }

  return { handled: false };
}

async function openShowcaseEntry(
  input: ShowcaseTurnInput,
): Promise<ShowcaseTurnOutput> {
  const flags = await input.deps.loadTenantFlags();
  const counts = await input.deps.loadSegmentoCounts();
  const resolved = resolveShowcaseSegmentFromText({
    text: input.userText,
    flags,
    counts,
  });
  if (resolved === null) {
    await input.deps.sendText(
      "No momento não temos veículos disponíveis no estoque. Posso ajudar em algo mais?",
    );
    await input.deps.savePending(null);
    return { handled: true, replyPreview: "estoque_vazio" };
  }
  if (resolved === "escolher") {
    await input.deps.savePending({
      stage: "escolha_segmento",
      offset: 0,
      updated_at: new Date().toISOString(),
    });
    await input.deps.sendButtons(
      "Temos carros e motos no estoque. O que você quer ver?",
      [
        { id: vitrineButtonId("segmento", "carro"), title: "Carros" },
        { id: vitrineButtonId("segmento", "moto"), title: "Motos" },
      ],
    );
    return { handled: true, replyPreview: "escolha_segmento" };
  }
  return resolved === "moto"
    ? await openShowcaseMenuMoto(input, 0)
    : await openShowcaseMenuCar(input, 0);
}

async function openShowcaseMenuCar(
  input: ShowcaseTurnInput,
  marcaOffset: number,
): Promise<ShowcaseTurnOutput> {
  const marcas = await input.deps.loadMarcas();
  if (!marcas.length) {
    await input.deps.sendText(
      "No momento não temos carros disponíveis no estoque. Posso ajudar em algo mais?",
    );
    await input.deps.savePending(null);
    return { handled: true, replyPreview: "estoque_vazio" };
  }
  const precos = await input.deps.loadPrecosDisponiveis();
  const faixas = activeFaixasFromCounts(countVehiclesByFaixa(precos));
  const { sections } = buildShowcaseMenuSections({
    marcas,
    marcaOffset,
    faixasAtivas: faixas,
  });
  await input.deps.savePending({
    stage: "menu",
    segmento_vitrine: "carro",
    offset: 0,
    marca_offset: marcaOffset,
    updated_at: new Date().toISOString(),
  });
  await input.deps.sendMenu(
    "Como prefere explorar nosso estoque de carros?",
    sections,
    "Ver opções",
  );
  return { handled: true, replyPreview: "menu_carro" };
}

async function openShowcaseMenuMoto(
  input: ShowcaseTurnInput,
  estiloOffset: number,
): Promise<ShowcaseTurnOutput> {
  const estilos = await input.deps.loadEstilosMoto();
  if (!estilos.length) {
    await input.deps.sendText(
      "No momento não temos motos disponíveis no estoque. Posso ajudar em algo mais?",
    );
    await input.deps.savePending(null);
    return { handled: true, replyPreview: "estoque_moto_vazio" };
  }
  const precos = await input.deps.loadPrecosMotosDisponiveis();
  const faixas = activeFaixasMotoFromCounts(countMotosByFaixa(precos));
  const { sections } = buildMotoShowcaseMenuSections({
    estilos,
    estiloOffset,
    faixasAtivas: faixas,
  });
  await input.deps.savePending({
    stage: "menu",
    segmento_vitrine: "moto",
    offset: 0,
    marca_offset: estiloOffset,
    updated_at: new Date().toISOString(),
  });
  await input.deps.sendMenu(
    "Como prefere explorar nossas motos?",
    sections,
    "Ver opções",
  );
  return { handled: true, replyPreview: "menu_moto" };
}

async function handleVitrineAction(input: ShowcaseTurnInput & {
  vitrineId: string;
  flags: VehicleShowcaseTenantFlags;
}): Promise<ShowcaseTurnOutput> {
  const id = input.vitrineId;
  if (!id.startsWith(VITRINE_ID_PREFIX)) {
    return { handled: false };
  }

  const { action, parts } = parseVitrineButtonId(id);
  if (isOwnerAudience(input)) {
    const clientOnly =
      action === "interesse" ||
      action === "consultor" ||
      (action === "acao" &&
        ["troca", "visita", "financiamento"].includes(parts[0] ?? "")) ||
      action === "fin_modo" ||
      action.startsWith("fin_") ||
      action === "visita_dia" ||
      action === "visita_turno" ||
      action === "troca_foto" ||
      action === "troca_obs";
    if (clientOnly) return ownerClientPreviewStub(input);
  }
  const marcas = await input.deps.loadMarcas();

  if (
    action === "voltar_marcas" ||
    action === "marcas" ||
    (action === "acao" && parts[0] === "inicio")
  ) {
    return await reopenShowcaseMenu(input, 0);
  }

  if (action === "segmento" && parts[0] === "carro") {
    return await openShowcaseMenuCar(input, 0);
  }
  if (action === "segmento" && parts[0] === "moto") {
    return await openShowcaseMenuMoto(input, 0);
  }

  if (action === "menu_marcas" && parts[0] != null) {
    const offset = Number.parseInt(parts[0], 10) || 0;
    return await reopenShowcaseMenu(input, offset);
  }

  if (action === "menu_estilos" && parts[0] != null) {
    const offset = Number.parseInt(parts[0], 10) || 0;
    return await openShowcaseMenuMoto(input, offset);
  }

  if (action === "estilo" && parts[0]) {
    const estilo = parts[0];
    return await sendEstiloCarousel(input, estilo, 0);
  }

  if (action === "faixa_moto" && parts[0]) {
    const faixa = parts[0] as FaixaPrecoMotoId;
    if (!["ate_50", "50_120", "acima_120"].includes(faixa)) {
      await input.deps.sendText("Faixa inválida. Escolha outra opção no menu.");
      return { handled: true };
    }
    return await sendFaixaMotoCarousel(input, faixa, 0);
  }

  if (action === "faixa" && parts[0]) {
    const faixa = parts[0] as FaixaPrecoId;
    if (!["ate_300", "300_600", "acima_600"].includes(faixa)) {
      await input.deps.sendText("Faixa inválida. Escolha outra opção no menu.");
      return { handled: true };
    }
    return await sendFaixaCarousel(input, faixa, 0);
  }

  if (action === "marca" && parts[0]) {
    const marca = slugToMarcaCandidates(parts[0], marcas);
    if (!marca) {
      await input.deps.sendText("Não encontrei essa marca. Escolha outra na lista.");
      return { handled: true, replyPreview: "marca_invalida" };
    }
    return await sendMarcaCarousel(input, marca, 0);
  }

  if (action === "mais" && parts[0] && parts[1] != null) {
    const slugOrFaixa = parts[0];
    const offset = Number.parseInt(parts[1], 10) || 0;
    if (["ate_50", "50_120", "acima_120"].includes(slugOrFaixa)) {
      return await sendFaixaMotoCarousel(input, slugOrFaixa as FaixaPrecoMotoId, offset);
    }
    if (["ate_300", "300_600", "acima_600"].includes(slugOrFaixa)) {
      return await sendFaixaCarousel(input, slugOrFaixa as FaixaPrecoId, offset);
    }
    const pendingSeg = vitrineSegmentoFromPending(input.deps.getPending());
    if (pendingSeg === "moto") {
      return await sendEstiloCarousel(input, slugOrFaixa, offset);
    }
    const marca = slugToMarcaCandidates(slugOrFaixa, marcas);
    if (!marca) {
      await input.deps.sendText("Não encontrei essa marca.");
      return { handled: true };
    }
    return await sendMarcaCarousel(input, marca, offset);
  }

  if (action === "detalhe" && parts[0]) {
    const ctx = input.deps.getPending();
    return await sendVehicleDetail(input, parts[0], ctx ?? undefined);
  }

  if (action === "fotos" && parts[0]) {
    const vehicle = await input.deps.loadVeiculoById(parts[0]);
    if (!vehicle?.fotos?.length) {
      await input.deps.sendText("Não há fotos cadastradas para este veículo.");
      return { handled: true };
    }
    for (const url of vehicle.fotos.slice(0, 8)) {
      await input.deps.sendImage(url);
    }
    await trackClienteCrmEvent(
      input,
      "fotos",
      vehicle.id,
      vehicleDisplayTitle(vehicle),
    );
    return { handled: true, replyPreview: "fotos" };
  }

  if (action === "interesse" && parts[0]) {
    return await handoffVehicle(input, parts[0], "interesse");
  }

  if (action === "consultor") {
    const vehicleId = parts[0];
    if (vehicleId) return await handoffVehicle(input, vehicleId, "consultor");
    return await handoffConsultorGeral(input);
  }

  if (action === "acao" && parts[0] === "proximo" && parts[1]) {
    return await showNextVehicle(input, parts[1]);
  }

  if (action === "acao" && parts[0] === "troca" && parts[1]) {
    return await startTrocaFlow(input, parts[1]);
  }

  if (action === "troca_foto" && parts[0] === "pular" && parts[1]) {
    return await skipTrocaOptionalFoto(input, parts[1]);
  }

  if (action === "troca_obs" && parts[0] === "pular") {
    const pendingCtx = input.deps.getPending();
    if (
      pendingCtx?.form?.flow === "troca" &&
      pendingCtx.form.step === "observacoes"
    ) {
      const now = new Date().toISOString();
      await input.deps.savePending({
        ...pendingCtx,
        form: skipTrocaObservacoes(pendingCtx.form, now),
        updated_at: now,
      });
    }
    return await finalizeTrocaFlow(input);
  }

  if (action === "acao" && parts[0] === "visita" && parts[1]) {
    return await startVisitaFlow(input, parts[1]);
  }

  if (action === "acao" && parts[0] === "financiamento" && parts[1]) {
    return await startFinanciamentoFlow(input, parts[1]);
  }

  if (action === "fin_modo" && parts[0]) {
    return await handleFinanciamentoModo(input, parts[0] as "preencher" | "consultor");
  }

  if (action === "fin_lgpd" && parts[0]) {
    return await handleFinanciamentoLgpd(input, parts[0] === "sim");
  }

  if (action === "fin_perfil" && parts[0]) {
    return await handleFinanciamentoPerfil(input, parts[0] as FinanciamentoPerfil);
  }

  if (action === "fin_cnh" && parts[0]) {
    return await handleFinanciamentoCnh(input, parts[0] === "sim");
  }

  if (action === "fin_confirm") {
    return await finalizeFinanciamentoFicha(input);
  }

  if (action === "fin_corrigir") {
    return await handleFinanciamentoCorrigirMenu(input);
  }

  if (action === "fin_edit" && parts[0]) {
    return await handleFinanciamentoEditField(input, parts[0]);
  }

  if (action === "fin_prazo" && parts[0]) {
    const prazo = Number.parseInt(parts[0], 10);
    return await handleFinanciamentoPrazo(input, prazo);
  }

  if (action === "visita_dia") {
    const iso = parseIsoDateFromButtonParts(parts);
    if (!iso) {
      await input.deps.sendText("Não reconheci esse dia. Escolha outra data na lista.");
      return { handled: true };
    }
    return await handleVisitaDiaEscolhido(input, iso);
  }

  if (action === "visita_turno") {
    const parsed = parseVisitaTurnoFromButtonParts(parts);
    if (!parsed) {
      await input.deps.sendText("Não reconheci o turno. Toque em Manhã ou Tarde.");
      return { handled: true };
    }
    return await finalizeVisita(input, parsed.iso, parsed.turno);
  }

  return { handled: false };
}

async function startVisitaFlow(
  input: ShowcaseTurnInput,
  vehicleId: string,
): Promise<ShowcaseTurnOutput> {
  if (isOwnerAudience(input)) return ownerClientPreviewStub(input);
  const vehicle = await input.deps.loadVeiculoById(vehicleId);
  if (!vehicle) {
    await input.deps.sendText("Esse veículo não está mais disponível.");
    return { handled: true };
  }
  const pending = input.deps.getPending();
  const dias = buildProximosDiasUteisVisita(6);
  const now = new Date().toISOString();
  await input.deps.savePending({
    stage: pending?.stage ?? "detalhe",
    marca: pending?.marca ?? vehicle.marca,
    faixa: pending?.faixa ?? null,
    filtro_tipo: pending?.filtro_tipo ?? null,
    offset: pending?.offset ?? 0,
    marca_offset: pending?.marca_offset ?? 0,
    veiculo_id: vehicle.id,
    carousel_ids: pending?.carousel_ids ?? null,
    carousel_index: pending?.carousel_index ?? null,
    form: {
      flow: "visita",
      step: "dia",
      veiculo_id: vehicle.id,
      updated_at: now,
    },
    updated_at: now,
  });
  await input.deps.sendMenu(
    `Agendar visita ou test drive — ${vehicleDisplayTitle(vehicle)}`,
    [{ title: "Próximos dias", rows: buildVisitaDiaListRows(dias) }],
    "Escolher dia",
  );
  return { handled: true, replyPreview: "visita_dia" };
}

async function handleVisitaDiaEscolhido(
  input: ShowcaseTurnInput,
  diaIso: string,
): Promise<ShowcaseTurnOutput> {
  const pending = input.deps.getPending();
  const vehicleId = pending?.form?.veiculo_id ?? pending?.veiculo_id;
  if (!vehicleId) {
    await input.deps.sendText("Não encontrei o veículo. Toque em Ver detalhes de novo.");
    return { handled: true };
  }
  const now = new Date().toISOString();
  await input.deps.savePending({
    ...(pending ?? { stage: "detalhe", offset: 0, updated_at: now }),
    form: {
      flow: "visita",
      step: "turno",
      veiculo_id: vehicleId,
      dia_iso: diaIso,
      updated_at: now,
    },
    updated_at: now,
  });
  await input.deps.sendButtons(
    "Qual turno prefere?",
    [
      { id: vitrineButtonId("visita_turno", `${diaIso}:manha`), title: "Manhã" },
      { id: vitrineButtonId("visita_turno", `${diaIso}:tarde`), title: "Tarde" },
    ],
  );
  return { handled: true, replyPreview: "visita_turno" };
}

async function finalizeVisita(
  input: ShowcaseTurnInput,
  diaIso: string,
  turno: VitrineVisitaTurno,
): Promise<ShowcaseTurnOutput> {
  const pending = input.deps.getPending();
  const vehicleId = pending?.form?.veiculo_id ?? pending?.veiculo_id;
  if (!vehicleId) {
    await input.deps.sendText("Não encontrei o veículo.");
    return { handled: true };
  }
  const done = await completeVisitaAgendada(input, diaIso, turno);
  return maybeOfferOptionalClienteNome(input, vehicleId, done);
}

async function completeVisitaAgendada(
  input: ShowcaseTurnInput,
  diaIso: string,
  turno: VitrineVisitaTurno,
): Promise<ShowcaseTurnOutput> {
  const pending = input.deps.getPending();
  const vehicleId = pending?.form?.veiculo_id ?? pending?.veiculo_id;
  if (!vehicleId) {
    await input.deps.sendText("Não encontrei o veículo.");
    return { handled: true };
  }
  const vehicle = await input.deps.loadVeiculoById(vehicleId);
  if (!vehicle) {
    await input.deps.sendText("Esse veículo não está mais disponível.");
    return { handled: true };
  }
  const flags = await input.deps.loadTenantFlags();
  const clienteNome = vitrineNomeParaRecado({
    pending: input.deps.getPending(),
    contactName: input.contactName,
  });
  const recado = buildRecadoVisita({
    clienteNome,
    contactName: input.contactName,
    fromNumber: input.fromNumber,
    vehicle,
    diaIso,
    turno,
  });
  const idemKey = buildVitrineRecadoIdempotencyKey({
    acao: "visita",
    fromNumber: input.fromNumber,
    veiculoId: vehicle.id,
    diaIso,
    turno,
  });
  const notify = await vitrineNotifyOwner(input, idemKey, recado);
  const after = input.deps.getPending() ?? basePending(pending);
  await input.deps.savePending({
    ...after,
    form: null,
    stage: "handoff",
    veiculo_id: vehicle.id,
    updated_at: new Date().toISOString(),
  });
  const msg = confirmacaoVisitaAgendada(flags.nome_empresa, diaIso, turno);
  const sent = await input.deps.sendText(msg);
  if (!sent.ok && !notify.notified && !notify.duplicate) {
    await input.deps.sendText(
      "Recebi sua preferência de horário, mas não consegui avisar a loja agora — tente novamente em instantes.",
    );
  }
  await trackClienteCrmEvent(
    input,
    "visita",
    vehicle.id,
    vehicleDisplayTitle(vehicle),
  );
  return {
    handled: true,
    replyPreview: notify.duplicate ? "visita_confirmada_dedup" : "visita_confirmada",
  };
}

async function startFinanciamentoFlow(
  input: ShowcaseTurnInput,
  vehicleId: string,
): Promise<ShowcaseTurnOutput> {
  if (isOwnerAudience(input)) return ownerClientPreviewStub(input);
  const vehicle = await input.deps.loadVeiculoById(vehicleId);
  if (!vehicle) {
    await input.deps.sendText("Esse veículo não está mais disponível.");
    return { handled: true };
  }
  const pending = input.deps.getPending();
  const now = new Date().toISOString();
  const next = mergePendingForFinanciamentoStart(pending, vehicle, now);
  await input.deps.savePending(next);
  await input.deps.sendButtons(FINANCIAMENTO_MODO_BODY, [
    { id: vitrineButtonId("fin_modo", "preencher"), title: "📝 Preencher por aqui" },
    { id: vitrineButtonId("fin_modo", "consultor"), title: "👤 Falar consultor" },
  ]);
  await trackClienteCrmEvent(
    input,
    "financiamento",
    vehicle.id,
    vehicleDisplayTitle(vehicle),
  );
  return { handled: true, replyPreview: "financiamento_modo" };
}

async function sendFinanciamentoResumo(
  input: ShowcaseTurnInput,
  form: import("./vehicle-stock-whatsapp.ts").VitrineEstoqueForm,
): Promise<void> {
  const body = buildFinanciamentoResumoText(form);
  await input.deps.sendButtons(body, [
    { id: vitrineButtonId("fin_confirm", "ok"), title: "✅ Confirmar" },
    { id: vitrineButtonId("fin_corrigir", "ok"), title: "✏️ Corrigir algo" },
  ]);
}

async function sendFinanciamentoStepPrompt(
  input: ShowcaseTurnInput,
  form: import("./vehicle-stock-whatsapp.ts").VitrineEstoqueForm,
): Promise<void> {
  const pending = input.deps.getPending();
  if (form.step === "lgpd") {
    await input.deps.sendButtons(FINANCIAMENTO_LGPD_BODY, [
      { id: vitrineButtonId("fin_lgpd", "sim"), title: "Sim, continuar" },
      { id: vitrineButtonId("fin_lgpd", "nao"), title: "Não" },
    ]);
    return;
  }
  if (form.step === "perfil") {
    const rows = [
      { id: vitrineButtonId("fin_perfil", "assalariado"), title: "Assalariado", description: "Carteira assinada" },
      { id: vitrineButtonId("fin_perfil", "autonomo"), title: "Autônomo", description: "MEI / autônomo" },
      { id: vitrineButtonId("fin_perfil", "empresario"), title: "Empresário", description: "Sócio / empresa" },
      { id: vitrineButtonId("fin_perfil", "aposentado"), title: "Aposentado", description: "Aposentadoria/pensão" },
    ];
    await input.deps.sendMenu(
      "Qual seu *perfil* profissional? (ou digite *pular*)",
      [{ title: "Perfil", rows }],
      "Escolher perfil",
    );
    return;
  }
  if (form.step === "cnh") {
    await input.deps.sendButtons("Você possui *CNH*? (ou digite *pular*)", [
      { id: vitrineButtonId("fin_cnh", "sim"), title: "Sim" },
      { id: vitrineButtonId("fin_cnh", "nao"), title: "Não" },
    ]);
    return;
  }
  if (form.step === "resumo") {
    await sendFinanciamentoResumo(input, form);
    return;
  }
  if (form.step === "corrigir_menu") {
    await input.deps.sendMenu(
      "Qual campo deseja corrigir?",
      [{
        title: "Campos",
        rows: FIN_CORRECTABLE_FIELDS.map((f) => ({
          id: vitrineButtonId("fin_edit", f.key),
          title: f.label,
        })),
      }],
      "Corrigir",
    );
    return;
  }
  if (form.step === "prazo") {
    const rows = FINANCIAMENTO_PRAZO_OPTIONS.map((m) => ({
      id: vitrineButtonId("fin_prazo", String(m)),
      title: `${m} meses`,
      description: `Parcelar em ${m}x`,
    }));
    await input.deps.sendMenu(
      promptFinanciamentoStep(form, pending),
      [{ title: "Prazo", rows }],
      "Escolher prazo",
    );
    return;
  }
  await input.deps.sendText(promptFinanciamentoStep(form, pending));
}

async function handleFinanciamentoModo(
  input: ShowcaseTurnInput,
  modo: "preencher" | "consultor",
): Promise<ShowcaseTurnOutput> {
  const pending = input.deps.getPending();
  const form = pending?.form;
  if (!form || form.flow !== "financiamento" || form.step !== "modo") {
    return { handled: true, replyPreview: "financiamento_modo_ignored" };
  }
  const now = new Date().toISOString();
  const { form: next, consultor } = applyFinanciamentoModo(form, modo, now);
  if (consultor) {
    await input.deps.savePending({ ...pending!, form: null, updated_at: now });
    return completeHandoffVehicle(input, form.veiculo_id, "consultor");
  }
  await input.deps.savePending({ ...pending!, form: next, updated_at: now });
  await sendFinanciamentoStepPrompt(input, next);
  return { handled: true, replyPreview: "financiamento_lgpd" };
}

async function handleFinanciamentoInteractivePular(
  input: ShowcaseTurnInput,
  pending: PendingVitrineEstoque,
): Promise<ShowcaseTurnOutput> {
  const form = pending.form!;
  const now = new Date().toISOString();
  const advanced = skipFinanciamentoInteractiveStep(form, form.step, now);
  await input.deps.savePending({ ...pending, form: advanced.form, updated_at: now });
  await sendFinanciamentoStepPrompt(input, advanced.form);
  return { handled: true, replyPreview: `financiamento_pular_${form.step}` };
}

async function handleFinanciamentoLgpd(
  input: ShowcaseTurnInput,
  accept: boolean,
): Promise<ShowcaseTurnOutput> {
  const pending = input.deps.getPending();
  const form = pending?.form;
  if (!form || form.flow !== "financiamento" || form.step !== "lgpd") {
    return { handled: true, replyPreview: "financiamento_lgpd_ignored" };
  }
  const now = new Date().toISOString();
  const { form: next, rejected } = applyFinanciamentoLgpdChoice(
    form,
    accept,
    pending,
    now,
  );
  if (rejected) {
    await input.deps.savePending({
      ...(pending ?? basePending(pending)),
      form: null,
      updated_at: now,
    });
    await input.deps.sendText(
      "Sem problemas. Se quiser simular depois, toque em *Financiamento* no carro desejado.",
    );
    return { handled: true, replyPreview: "financiamento_lgpd_nao" };
  }
  await input.deps.savePending({ ...pending!, form: next, updated_at: now });
  await sendFinanciamentoStepPrompt(input, next);
  return { handled: true, replyPreview: `financiamento_${next.step}` };
}

async function handleFinanciamentoPerfil(
  input: ShowcaseTurnInput,
  perfil: FinanciamentoPerfil,
): Promise<ShowcaseTurnOutput> {
  const pending = input.deps.getPending();
  const form = pending?.form;
  if (!form || form.flow !== "financiamento" || form.step !== "perfil") {
    return { handled: true, replyPreview: "financiamento_perfil_ignored" };
  }
  const now = new Date().toISOString();
  const next = applyFinanciamentoPerfil(form, perfil, now);
  await input.deps.savePending({ ...pending!, form: next, updated_at: now });
  await sendFinanciamentoStepPrompt(input, next);
  return { handled: true, replyPreview: `financiamento_${next.step}` };
}

async function handleFinanciamentoCnh(
  input: ShowcaseTurnInput,
  possui: boolean,
): Promise<ShowcaseTurnOutput> {
  const pending = input.deps.getPending();
  const form = pending?.form;
  if (!form || form.flow !== "financiamento" || form.step !== "cnh") {
    return { handled: true, replyPreview: "financiamento_cnh_ignored" };
  }
  const now = new Date().toISOString();
  const next = applyFinanciamentoCnh(form, possui, now);
  await input.deps.savePending({ ...pending!, form: next, updated_at: now });
  await sendFinanciamentoStepPrompt(input, next);
  return { handled: true, replyPreview: "financiamento_referencia_nome" };
}

async function handleFinanciamentoCorrigirMenu(
  input: ShowcaseTurnInput,
): Promise<ShowcaseTurnOutput> {
  const pending = input.deps.getPending();
  const form = pending?.form;
  if (!form || form.flow !== "financiamento") {
    return { handled: true };
  }
  const now = new Date().toISOString();
  const next = { ...form, step: "corrigir_menu", updated_at: now };
  await input.deps.savePending({ ...pending!, form: next, updated_at: now });
  await sendFinanciamentoStepPrompt(input, next);
  return { handled: true, replyPreview: "financiamento_corrigir_menu" };
}

async function handleFinanciamentoEditField(
  input: ShowcaseTurnInput,
  fieldKey: string,
): Promise<ShowcaseTurnOutput> {
  const pending = input.deps.getPending();
  const form = pending?.form;
  if (!form || form.flow !== "financiamento") {
    return { handled: true };
  }
  const now = new Date().toISOString();
  const next = beginFinanciamentoCorrecao(form, fieldKey, now);
  await input.deps.savePending({ ...pending!, form: next, updated_at: now });
  await sendFinanciamentoStepPrompt(input, next);
  return { handled: true, replyPreview: `financiamento_edit_${fieldKey}` };
}

async function handleFinanciamentoPrazo(
  input: ShowcaseTurnInput,
  prazo: number,
): Promise<ShowcaseTurnOutput> {
  const pending = input.deps.getPending();
  const form = pending?.form;
  if (!form || form.flow !== "financiamento" || form.step !== "prazo") {
    return { handled: true, replyPreview: "financiamento_prazo_ignored" };
  }
  const now = new Date().toISOString();
  const { form: next, reply } = applyFinanciamentoPrazo(form, prazo, now);
  if (reply) {
    await input.deps.sendText(reply);
    return { handled: true, replyPreview: "financiamento_prazo_invalido" };
  }
  await input.deps.savePending({ ...pending!, form: next, updated_at: now });
  await sendFinanciamentoStepPrompt(input, next);
  return { handled: true, replyPreview: "financiamento_resumo" };
}

async function handleFinanciamentoTextStep(
  input: ShowcaseTurnInput,
  pending: PendingVitrineEstoque,
): Promise<ShowcaseTurnOutput> {
  const form = pending.form!;
  const skip = normalizeVitrineText(input.userText) === "pular" ||
    isFinanciamentoSpokenSkip(input.userText);
  const now = new Date().toISOString();
  let advanced = advanceFinanciamentoAfterText(
    form,
    input.userText,
    now,
    { pending, skipOptional: skip },
  );
  if (advanced.reply && !advanced.needsCepLookup) {
    await input.deps.sendText(advanced.reply);
    return { handled: true, replyPreview: `financiamento_${form.step}_retry` };
  }
  if (advanced.needsCepLookup) {
    let addr = null;
    try {
      addr = await input.deps.fetchViaCep(advanced.form.cep ?? "");
    } catch (e) {
      console.error("[financiamento][viacep]", safeErrorMessage(e));
    }
    advanced = applyFinanciamentoCepLookup(advanced.form, addr, now);
    if (advanced.reply && !addr) {
      await input.deps.savePending({
        ...pending,
        form: advanced.form,
        updated_at: now,
      });
      await input.deps.sendText(advanced.reply);
      return { handled: true, replyPreview: "financiamento_cep_fail" };
    }
  }
  await input.deps.savePending({
    ...pending,
    form: advanced.form,
    updated_at: now,
  });
  if (advanced.reply) {
    await input.deps.sendText(advanced.reply);
    return { handled: true, replyPreview: `financiamento_${advanced.form.step}` };
  }
  await sendFinanciamentoStepPrompt(input, advanced.form);
  return { handled: true, replyPreview: `financiamento_${advanced.form.step}` };
}

async function finalizeFinanciamentoFicha(
  input: ShowcaseTurnInput,
): Promise<ShowcaseTurnOutput> {
  const pending = input.deps.getPending();
  const form = pending?.form;
  if (!form || form.flow !== "financiamento") {
    await input.deps.sendText("Não encontrei a ficha. Toque em *Financiamento* de novo.");
    return { handled: true };
  }
  const vehicle = await input.deps.loadVeiculoById(form.veiculo_id);
  if (!vehicle) {
    await input.deps.sendText("Esse veículo não está mais disponível.");
    return { handled: true };
  }
  const row = buildFinanciamentoFichaRow({
    userId: input.deps.userId,
    form,
    fromNumber: input.fromNumber,
    contactName: input.contactName,
    pending,
  });
  if (!row) {
    await input.deps.sendText(
      "Não foi possível fechar a ficha. Toque em *Financiamento* e tente de novo.",
    );
    return { handled: true, replyPreview: "financiamento_incompleto" };
  }
  let fichaId = "";
  try {
    const saved = await input.deps.saveFinanciamentoFicha(row);
    fichaId = saved.id;
  } catch (e) {
    console.error("[financiamento][save]", safeErrorMessage(e));
    await input.deps.sendText(
      "Não consegui salvar sua ficha agora. Tente novamente em instantes.",
    );
    return { handled: true, replyPreview: "financiamento_save_fail" };
  }
  const clienteNome = form.nome_completo?.trim() ||
    vitrineNomeParaRecado({ pending, contactName: input.contactName });
  const recado = buildRecadoFinanciamentoFichaSemPii({
    clienteNome,
    contactName: input.contactName,
    fromNumber: input.fromNumber,
    vehicle,
    fichaId,
    camposPendentes: row.campos_pendentes,
  });
  const idemKey = buildVitrineRecadoIdempotencyKey({
    acao: "financiamento",
    fromNumber: input.fromNumber,
    veiculoId: vehicle.id,
  });
  const notify = await vitrineNotifyOwner(input, idemKey, recado);
  const flags = await input.deps.loadTenantFlags();
  const after = pending ?? basePending(pending);
  const firstName = form.nome_completo?.trim().split(/\s+/)[0];
  await input.deps.savePending({
    ...after,
    cliente_nome: pending?.cliente_nome || firstName || pending?.cliente_nome,
    form: null,
    stage: "handoff",
    veiculo_id: vehicle.id,
    updated_at: new Date().toISOString(),
  });
  const msg = confirmacaoFinanciamentoFicha(flags.nome_empresa);
  const sent = await input.deps.sendText(msg);
  if (!sent.ok && !notify.notified && !notify.duplicate) {
    await input.deps.sendText(
      "Recebi sua ficha, mas não consegui avisar a loja agora — tente novamente em instantes.",
    );
  }
  return {
    handled: true,
    replyPreview: notify.duplicate ? "financiamento_ficha_dedup" : "financiamento_ficha",
  };
}

async function startTrocaFlow(
  input: ShowcaseTurnInput,
  vehicleId: string,
): Promise<ShowcaseTurnOutput> {
  if (isOwnerAudience(input)) return ownerClientPreviewStub(input);
  const vehicle = await input.deps.loadVeiculoById(vehicleId);
  if (!vehicle) {
    await input.deps.sendText("Esse veículo não está mais disponível.");
    return { handled: true };
  }
  const pending = input.deps.getPending();
  const sessionId = crypto.randomUUID();
  const now = new Date().toISOString();
  await input.deps.savePending(
    mergePendingForTrocaStart(pending, vehicle, sessionId, now),
  );
  await input.deps.sendText(promptTrocaModeloAno(vehicle));
  await trackClienteCrmEvent(
    input,
    "troca",
    vehicle.id,
    vehicleDisplayTitle(vehicle),
  );
  return { handled: true, replyPreview: "troca_modelo_ano" };
}

async function handleTrocaTextStep(
  input: ShowcaseTurnInput,
  pending: PendingVitrineEstoque,
): Promise<ShowcaseTurnOutput> {
  const text = input.userText.trim();
  if (!text) {
    await input.deps.sendText("Pode digitar a resposta ou *cancelar*.");
    return { handled: true, replyPreview: "troca_texto_vazio" };
  }
  const now = new Date().toISOString();
  const { form, reply, done } = advanceTrocaAfterText(pending.form!, text, now);
  await input.deps.savePending({ ...pending, form, updated_at: now });
  if (done) {
    return await finalizeTrocaFlow(input);
  }
  if (form.step === "fotos") {
    const slot = currentTrocaFotoSlot(form);
    if (slot) await sendTrocaFotoSlotPrompt(input, slot);
    return { handled: true, replyPreview: `troca_${form.step}` };
  }
  if (form.step === "observacoes") {
    await input.deps.sendButtons(promptTrocaObservacoes(), [
      { id: vitrineButtonId("troca_obs", "pular"), title: "Pular" },
    ]);
    return { handled: true, replyPreview: "troca_observacoes" };
  }
  if (reply) await input.deps.sendText(reply);
  return { handled: true, replyPreview: `troca_${form.step}` };
}

async function finalizeTrocaFlow(
  input: ShowcaseTurnInput,
): Promise<ShowcaseTurnOutput> {
  const pending = input.deps.getPending();
  const vehicleId = pending?.form?.veiculo_id ?? pending?.veiculo_id ?? "troca";
  const done = await completeTrocaRecado(input);
  return maybeOfferOptionalClienteNome(input, String(vehicleId), done);
}

async function completeTrocaRecado(
  input: ShowcaseTurnInput,
): Promise<ShowcaseTurnOutput> {
  const pending = input.deps.getPending();
  const form = pending?.form;
  const vehicleId = form?.veiculo_id ?? pending?.veiculo_id;
  if (!form || form.flow !== "troca" || !vehicleId) {
    await input.deps.sendText("Não encontrei os dados da troca. Toque em *Avaliar troca* de novo.");
    return { handled: true };
  }
  const vehicle = await input.deps.loadVeiculoById(vehicleId);
  if (!vehicle) {
    await input.deps.sendText("Esse veículo não está mais disponível.");
    return { handled: true };
  }
  const flags = await input.deps.loadTenantFlags();
  const clienteNome = vitrineNomeParaRecado({
    pending,
    contactName: input.contactName,
  });
  const recado = buildRecadoTrocaAvaliacao({
    clienteNome,
    contactName: input.contactName,
    fromNumber: input.fromNumber,
    vehicleEstoque: vehicle,
    form,
  });
  const idemKey = buildVitrineRecadoIdempotencyKey({
    acao: "troca",
    fromNumber: input.fromNumber,
    veiculoId: vehicle.id,
  });
  const notify = await vitrineNotifyOwner(input, idemKey, recado);
  const now = new Date().toISOString();
  await input.deps.savePending({
    ...(pending ?? { stage: "handoff", offset: 0, updated_at: now }),
    form: null,
    stage: "handoff",
    veiculo_id: vehicle.id,
    updated_at: now,
  });
  const msg = confirmacaoTrocaCliente(flags.nome_empresa);
  const sent = await input.deps.sendText(msg);
  if (!sent.ok && !notify.notified && !notify.duplicate) {
    await input.deps.sendText(
      "Recebi seus dados, mas não consegui avisar a loja agora — tente novamente em instantes.",
    );
  }
  return {
    handled: true,
    replyPreview: notify.duplicate ? "troca_confirmada_dedup" : "troca_confirmada",
  };
}

async function sendTrocaFotoSlotPrompt(
  input: ShowcaseTurnInput,
  slot: (typeof VITRINE_TROCA_FOTO_SLOTS)[number],
): Promise<void> {
  if (slot.optional) {
    await input.deps.sendButtons(slot.prompt, [
      { id: vitrineButtonId("troca_foto", `pular:${slot.id}`), title: "Pular" },
    ]);
  } else {
    await input.deps.sendText(slot.prompt);
  }
}

async function skipTrocaOptionalFoto(
  input: ShowcaseTurnInput,
  slotId: string,
): Promise<ShowcaseTurnOutput> {
  const pending = input.deps.getPending();
  const form = pending?.form;
  if (!form || form.flow !== "troca" || form.step !== "fotos") {
    return { handled: true, replyPreview: "troca_skip_ignored" };
  }
  const now = new Date().toISOString();
  const advanced = advanceTrocaSkipOptionalSlot(
    form,
    slotId as import("./vehicle-stock-troca.ts").TrocaFotoSlotId,
    now,
  );
  if (!advanced) {
    await input.deps.sendText("Este passo não pode ser pulado. Envie a foto, por favor.");
    return { handled: true, replyPreview: "troca_skip_rejected" };
  }
  await input.deps.savePending({
    ...pending!,
    form: advanced.form,
    updated_at: now,
  });
  if (advanced.form.step === "observacoes") {
    await input.deps.sendButtons(promptTrocaObservacoes(), [
      { id: vitrineButtonId("troca_obs", "pular"), title: "Pular" },
    ]);
    return { handled: true, replyPreview: "troca_observacoes" };
  }
  if (advanced.nextSlot) {
    await sendTrocaFotoSlotPrompt(input, advanced.nextSlot);
  }
  return { handled: true, replyPreview: `troca_skip_${slotId}` };
}

export async function applyTrocaPhotoReprompt(
  input: ShowcaseTurnInput,
  form: import("./vehicle-stock-whatsapp.ts").VitrineEstoqueForm,
  clientMessage: string,
): Promise<ShowcaseTurnOutput> {
  const pending = input.deps.getPending();
  if (!pending) return { handled: false };
  const now = new Date().toISOString();
  await input.deps.savePending({ ...pending, form, updated_at: now });
  await input.deps.sendText(clientMessage);
  return { handled: true, replyPreview: "troca_foto_reprompt" };
}

export async function applyTrocaPhotoAndReply(
  input: ShowcaseTurnInput,
  photo: { url: string; vision?: TrocaFotoVisionMeta; internalNotes?: string[] },
): Promise<ShowcaseTurnOutput> {
  const pending = input.deps.getPending();
  const form = pending?.form;
  if (!form || form.flow !== "troca" || form.step !== "fotos") {
    return { handled: false };
  }
  const slotDef = currentTrocaFotoSlot(form);
  if (!slotDef) {
    return { handled: false };
  }
  const now = new Date().toISOString();
  let nextForm = appendTrocaInternalNotes(form, photo.internalNotes ?? [], now);
  const { form: afterPhoto, nextSlot } = advanceTrocaAfterPhoto({
    form: nextForm,
    slot: slotDef.id,
    url: photo.url,
    vision: photo.vision,
    now,
  });
  await input.deps.savePending({ ...pending!, form: afterPhoto, updated_at: now });
  if (afterPhoto.step === "observacoes") {
    await input.deps.sendButtons(promptTrocaObservacoes(), [
      { id: vitrineButtonId("troca_obs", "pular"), title: "Pular" },
    ]);
    return { handled: true, replyPreview: "troca_observacoes" };
  }
  if (nextSlot) {
    await sendTrocaFotoSlotPrompt(input, nextSlot);
  }
  return { handled: true, replyPreview: `troca_foto_${slotDef.id}` };
}

async function handleClienteNomeFormControl(
  input: ShowcaseTurnInput,
  pending: PendingVitrineEstoque,
  kind: "cancelar" | "consultor",
): Promise<ShowcaseTurnOutput> {
  const form = pending.form;
  if (isClienteNomeOpcionalForm(form)) {
    const now = new Date().toISOString();
    await input.deps.savePending({
      ...pending,
      form: null,
      form_suspend_backup: null,
      updated_at: now,
    });
    if (kind === "cancelar") {
      await input.deps.sendText(
        "Sem problemas — cancelei por aqui. Se quiser, digite *ver carros* para explorar o estoque de novo.",
      );
      return { handled: true, replyPreview: "cliente_nome_opcional_cancel" };
    }
    return completeHandoffConsultorGeral(input);
  }
  if (!isClienteNomeForm(form)) {
    return { handled: false };
  }
  const fallback = vitrineContactNameFallback(input.contactName);
  const now = new Date().toISOString();
  await input.deps.savePending({
    ...pending,
    cliente_nome: vitrineClienteNomeSalvo(pending)
      ? pending.cliente_nome
      : fallback,
    form: null,
    form_suspend_backup: null,
    updated_at: now,
  });
  if (kind === "cancelar") {
    await input.deps.sendText(
      "Sem problemas — cancelei por aqui. Se quiser, digite *ver carros* para explorar o estoque de novo.",
    );
    return { handled: true, replyPreview: "cliente_nome_cancel" };
  }
  const resume = form.resume;
  switch (resume.kind) {
    case "consultor":
      if (resume.vehicleId) {
        return completeHandoffVehicle(input, resume.vehicleId, "consultor");
      }
      return completeHandoffConsultorGeral(input);
    case "interesse":
    case "visita":
      return completeHandoffVehicle(input, resume.vehicleId, "consultor");
    case "financiamento":
      return startFinanciamentoFlow(input, resume.vehicleId);
    case "troca_confirm":
      return completeHandoffConsultorGeral(input);
  }
}

async function handleFormControl(
  input: ShowcaseTurnInput,
  pending: PendingVitrineEstoque,
  kind: "cancelar" | "consultor",
): Promise<ShowcaseTurnOutput> {
  const vehicleId = pending.form?.veiculo_id ?? pending.veiculo_id;
  const vehicle = vehicleId
    ? await input.deps.loadVeiculoById(vehicleId)
    : null;
  const flags = await input.deps.loadTenantFlags();
  const clienteNome = vitrineNomeParaRecado({
    pending,
    contactName: input.contactName,
  });
  const recado = kind === "cancelar"
    ? buildRecadoFormCancelado({
      clienteNome,
      contactName: input.contactName,
      fromNumber: input.fromNumber,
      vehicle,
      form: pending.form!,
    })
    : buildRecadoConsultor({
      clienteNome,
      contactName: input.contactName,
      fromNumber: input.fromNumber,
      vehicle,
      marca: pending.marca ?? null,
    });
  if (kind === "cancelar") {
    await input.deps.encaminharRecado(recado);
  } else {
    const idemKey = buildVitrineRecadoIdempotencyKey({
      acao: "consultor",
      fromNumber: input.fromNumber,
      veiculoId: vehicle?.id ?? vehicleId ?? "geral",
    });
    await vitrineNotifyOwner(input, idemKey, recado);
  }
  await input.deps.savePending({
    ...pending,
    form: null,
    updated_at: new Date().toISOString(),
  });
  if (kind === "cancelar") {
    await input.deps.sendText(
      "Sem problemas — cancelei por aqui. Se quiser, digite *ver carros* para explorar o estoque de novo.",
    );
  } else {
    await input.deps.sendText(confirmacaoComNomeLoja(flags.nome_empresa));
  }
  return { handled: true, replyPreview: `form_${kind}` };
}

async function showNextVehicle(
  input: ShowcaseTurnInput,
  currentId: string,
): Promise<ShowcaseTurnOutput> {
  const pending = input.deps.getPending();
  const ids = pending?.carousel_ids ?? [];
  const idx = ids.indexOf(currentId);
  const nextId = idx >= 0 && idx + 1 < ids.length ? ids[idx + 1] : null;
  if (!nextId) {
    await input.deps.sendText("Este é o último carro desta lista. Quer ver outra marca ou faixa?");
    await input.deps.sendButtons(
      "Voltar ao menu:",
      [{ id: vitrineButtonId("acao", "inicio"), title: "Voltar ao início" }],
    );
    return { handled: true, replyPreview: "proximo_fim" };
  }
  return await sendVehicleDetail(input, nextId, {
    ...pending,
    carousel_index: idx + 1,
  } as PendingVitrineEstoque);
}

async function sendVehicleDetail(
  input: ShowcaseTurnInput,
  vehicleId: string,
  pendingCtx: PendingVitrineEstoque | null | undefined,
): Promise<ShowcaseTurnOutput> {
  const vehicle = await input.deps.loadVeiculoById(vehicleId);
  if (!vehicle) {
    await input.deps.sendText("Esse veículo não está mais disponível.");
    return { handled: true };
  }

  const carouselIds = pendingCtx?.carousel_ids ?? [vehicleId];
  const carouselIndex = pendingCtx?.carousel_ids
    ? carouselIds.indexOf(vehicleId)
    : 0;

  await input.deps.savePending({
    stage: "detalhe",
    marca: vehicle.marca,
    faixa: pendingCtx?.faixa ?? null,
    filtro_tipo: pendingCtx?.filtro_tipo ?? null,
    offset: pendingCtx?.offset ?? 0,
    marca_offset: pendingCtx?.marca_offset ?? 0,
    veiculo_id: vehicle.id,
    carousel_ids: carouselIds,
    carousel_index: carouselIndex >= 0 ? carouselIndex : 0,
    updated_at: new Date().toISOString(),
  });

  const fotos = (vehicle.fotos || []).filter(Boolean);
  for (const url of fotos.slice(0, 8)) {
    await input.deps.sendImage(url);
  }

  await input.deps.sendText(formatFichaElegante(vehicle));

  await input.deps.sendMenu(
    "Detalhes do veículo",
    [{ title: "O que deseja fazer?", rows: buildDetalheVehicleListRows(vehicle.id) }],
    "Escolher",
  );

  await trackClienteCrmEvent(
    input,
    "detalhe",
    vehicle.id,
    vehicleDisplayTitle(vehicle),
  );
  return { handled: true, replyPreview: "detalhe" };
}

async function deliverVehicleCarousel(
  input: ShowcaseTurnInput,
  opts: {
    vehicles: VeiculoVitrineRow[];
    body: string;
    pending: PendingVitrineEstoque;
    maisIdSuffix: string;
    emptyMessage: string;
  },
): Promise<ShowcaseTurnOutput> {
  const { vehicles, body, pending, maisIdSuffix, emptyMessage } = opts;
  if (!vehicles.length) {
    await input.deps.sendText(emptyMessage);
    return { handled: true, replyPreview: "carrossel_vazio" };
  }

  await input.deps.savePending({
    ...pending,
    carousel_ids: vehicles.map((v) => v.id),
    updated_at: new Date().toISOString(),
  });

  const allHavePhotos = vehicles.every((v) => !!v.fotos?.[0]);
  const cards: CarouselCardInput[] = vehicles.map((v, index) => ({
    card_index: index,
    imageUrl: v.fotos?.[0] || "",
    body: formatCardBody(v),
    buttons: [
      { id: vitrineButtonId("detalhe", v.id), title: "Ver detalhes" },
      { id: vitrineButtonId("interesse", v.id), title: "Tenho interesse" },
    ],
  }));

  const canCarousel = allHavePhotos && vehicles.length >= 2;
  const carouselResult = canCarousel
    ? await input.deps.sendCarousel(body, cards)
    : { ok: false as const, httpStatus: 400, metaError: { message: "carousel_skip" } };

  if (!carouselResult.ok) {
    console.warn("[vehicle-vitrine][carousel_rejected]", {
      status: carouselResult.httpStatus,
      error: carouselResult.metaError,
    });
    for (const v of vehicles.slice(0, 5)) {
      const photo = v.fotos?.[0];
      if (!photo) {
        await input.deps.sendButtons(
          formatCardBody(v),
          [
            { id: vitrineButtonId("detalhe", v.id), title: "Detalhes" },
            { id: vitrineButtonId("interesse", v.id), title: "Tenho interesse" },
          ],
        );
        continue;
      }
      await input.deps.sendImageHeaderButtons(
        formatCardBody(v),
        [
          { id: vitrineButtonId("fotos", v.id), title: "Fotos" },
          { id: vitrineButtonId("detalhe", v.id), title: "Detalhes" },
          { id: vitrineButtonId("interesse", v.id), title: "Tenho interesse" },
        ],
        photo,
      );
    }
  }

  await input.deps.pause(VITRINE_CAROUSEL_POST_DELAY_MS);

  const nextOffset = pending.offset + vehicles.length;
  const hasMore = vehicles.length >= VITRINE_CAROUSEL_PAGE_SIZE;
  if (hasMore) {
    await input.deps.sendButtons(
      "Quer ver mais carros?",
      [{
        id: vitrineButtonId("mais", `${maisIdSuffix}:${nextOffset}`),
        title: "Ver mais carros",
      }],
    );
  } else {
    await input.deps.sendButtons(
      "Quer ver outra marca?",
      [{ id: vitrineButtonId("voltar_marcas"), title: "Voltar marcas" }],
    );
  }

  if (pending.filtro_tipo === "faixa") {
    await trackClienteCrmEvent(input, "faixa", null);
  } else if (pending.filtro_tipo === "marca") {
    await trackClienteCrmEvent(input, "marca", null);
  }
  return { handled: true, replyPreview: `carrossel_${maisIdSuffix}` };
}

async function sendMarcaCarousel(
  input: ShowcaseTurnInput,
  marca: string,
  offset: number,
): Promise<ShowcaseTurnOutput> {
  const vehicles = await input.deps.loadVeiculosByMarca(
    marca,
    offset,
    VITRINE_CAROUSEL_PAGE_SIZE,
  );
  const body = offset > 0
    ? `Mais carros ${marca} (${offset + 1}–${offset + vehicles.length}):`
    : `Carros ${marca} disponíveis:`;

  return deliverVehicleCarousel(input, {
    vehicles,
    body,
    pending: {
      stage: "carrossel_marca",
      segmento_vitrine: "carro",
      marca,
      filtro_tipo: "marca",
      offset,
      marca_offset: input.deps.getPending()?.marca_offset ?? 0,
      updated_at: new Date().toISOString(),
    },
    maisIdSuffix: marcaToSlug(marca),
    emptyMessage: `Não há carros disponíveis da ${marca} no momento.`,
  });
}

async function reopenShowcaseMenu(
  input: ShowcaseTurnInput,
  offset: number,
): Promise<ShowcaseTurnOutput> {
  const seg = vitrineSegmentoFromPending(input.deps.getPending());
  return seg === "moto"
    ? await openShowcaseMenuMoto(input, offset)
    : await openShowcaseMenuCar(input, offset);
}

async function sendEstiloCarousel(
  input: ShowcaseTurnInput,
  estilo: string,
  offset: number,
): Promise<ShowcaseTurnOutput> {
  const vehicles = await input.deps.loadVeiculosByEstilo(
    estilo,
    offset,
    VITRINE_CAROUSEL_PAGE_SIZE,
  );
  const label = estilo.replace(/_/g, " ");
  const body = offset > 0
    ? `Mais motos ${label} (${offset + 1}–${offset + vehicles.length}):`
    : `Motos ${label} disponíveis:`;

  return deliverVehicleCarousel(input, {
    vehicles,
    body,
    pending: {
      stage: "carrossel_estilo",
      segmento_vitrine: "moto",
      estilo_moto: estilo,
      filtro_tipo: "estilo",
      offset,
      marca_offset: input.deps.getPending()?.marca_offset ?? 0,
      updated_at: new Date().toISOString(),
    },
    maisIdSuffix: estilo,
    emptyMessage: `Não há motos do estilo ${label} no momento.`,
  });
}

async function sendFaixaMotoCarousel(
  input: ShowcaseTurnInput,
  faixa: FaixaPrecoMotoId,
  offset: number,
): Promise<ShowcaseTurnOutput> {
  const vehicles = await input.deps.loadVeiculosByFaixaMoto(
    faixa,
    offset,
    VITRINE_CAROUSEL_PAGE_SIZE,
  );
  const body = offset > 0
    ? `Mais motos nesta faixa (${offset + 1}–${offset + vehicles.length}):`
    : "Motos nesta faixa de preço:";

  return deliverVehicleCarousel(input, {
    vehicles,
    body,
    pending: {
      stage: "carrossel_faixa_moto",
      segmento_vitrine: "moto",
      faixa_moto: faixa,
      filtro_tipo: "faixa_moto",
      offset,
      marca_offset: input.deps.getPending()?.marca_offset ?? 0,
      updated_at: new Date().toISOString(),
    },
    maisIdSuffix: faixa,
    emptyMessage: "Não há motos disponíveis nesta faixa no momento.",
  });
}

async function sendFaixaCarousel(
  input: ShowcaseTurnInput,
  faixa: FaixaPrecoId,
  offset: number,
): Promise<ShowcaseTurnOutput> {
  const vehicles = await input.deps.loadVeiculosByFaixa(
    faixa,
    offset,
    VITRINE_CAROUSEL_PAGE_SIZE,
  );
  const body = offset > 0
    ? `Mais carros nesta faixa (${offset + 1}–${offset + vehicles.length}):`
    : "Carros nesta faixa de preço:";

  return deliverVehicleCarousel(input, {
    vehicles,
    body,
    pending: {
      stage: "carrossel_faixa",
      segmento_vitrine: "carro",
      faixa,
      filtro_tipo: "faixa",
      offset,
      marca_offset: input.deps.getPending()?.marca_offset ?? 0,
      updated_at: new Date().toISOString(),
    },
    maisIdSuffix: faixa,
    emptyMessage: "Não há carros disponíveis nesta faixa no momento.",
  });
}

async function handoffVehicle(
  input: ShowcaseTurnInput,
  vehicleId: string,
  kind: "interesse" | "consultor",
): Promise<ShowcaseTurnOutput> {
  if (isOwnerAudience(input)) return ownerClientPreviewStub(input);
  const done = await completeHandoffVehicle(input, vehicleId, kind);
  return maybeOfferOptionalClienteNome(input, vehicleId, done);
}

async function completeHandoffVehicle(
  input: ShowcaseTurnInput,
  vehicleId: string,
  kind: "interesse" | "consultor",
): Promise<ShowcaseTurnOutput> {
  if (isOwnerAudience(input)) return ownerClientPreviewStub(input);
  const vehicle = await input.deps.loadVeiculoById(vehicleId);
  if (!vehicle) {
    await input.deps.sendText("Esse veículo não está mais disponível.");
    return { handled: true };
  }
  const flags = await input.deps.loadTenantFlags();
  const clienteNome = vitrineNomeParaRecado({
    pending: input.deps.getPending(),
    contactName: input.contactName,
  });
  const recado = kind === "interesse"
    ? buildRecadoInteresse({
      clienteNome,
      contactName: input.contactName,
      fromNumber: input.fromNumber,
      vehicle,
    })
    : buildRecadoConsultor({
      clienteNome,
      contactName: input.contactName,
      fromNumber: input.fromNumber,
      vehicle,
    });
  const idemKey = buildVitrineRecadoIdempotencyKey({
    acao: kind,
    fromNumber: input.fromNumber,
    veiculoId: vehicle.id,
  });
  const notify = await vitrineNotifyOwner(input, idemKey, recado);
  const after = input.deps.getPending() ?? basePending(null);
  await input.deps.savePending({
    ...after,
    stage: "handoff",
    marca: vehicle.marca,
    offset: 0,
    veiculo_id: vehicle.id,
    updated_at: new Date().toISOString(),
  });
  const confirm = confirmacaoComNomeLoja(flags.nome_empresa);
  const sent = await input.deps.sendText(confirm);
  if (!sent.ok && !notify.notified && !notify.duplicate) {
    await input.deps.sendText(
      "Recebi seu interesse! Não consegui avisar a loja agora — tente novamente em instantes.",
    );
  }
  await trackClienteCrmEvent(
    input,
    kind,
    vehicle.id,
    vehicleDisplayTitle(vehicle),
  );
  return { handled: true, replyPreview: kind };
}

async function handoffConsultorGeral(input: ShowcaseTurnInput): Promise<ShowcaseTurnOutput> {
  if (isOwnerAudience(input)) return ownerClientPreviewStub(input);
  const pending = input.deps.getPending();
  const vehicleId = pending?.veiculo_id ?? null;
  const done = await completeHandoffConsultorGeral(input);
  const vid = vehicleId ?? "geral";
  return maybeOfferOptionalClienteNome(input, String(vid), done);
}

async function completeHandoffConsultorGeral(
  input: ShowcaseTurnInput,
): Promise<ShowcaseTurnOutput> {
  if (isOwnerAudience(input)) return ownerClientPreviewStub(input);
  const pending = input.deps.getPending();
  const flags = await input.deps.loadTenantFlags();
  const clienteNome = vitrineNomeParaRecado({
    pending,
    contactName: input.contactName,
  });
  const recado = buildRecadoConsultor({
    clienteNome,
    contactName: input.contactName,
    fromNumber: input.fromNumber,
    marca: pending?.marca ?? null,
  });
  const vehicleId = pending?.veiculo_id ?? "geral";
  const idemKey = buildVitrineRecadoIdempotencyKey({
    acao: "consultor",
    fromNumber: input.fromNumber,
    veiculoId: String(vehicleId),
  });
  const notify = await vitrineNotifyOwner(input, idemKey, recado);
  const confirm = confirmacaoComNomeLoja(flags.nome_empresa);
  const sent = await input.deps.sendText(confirm);
  if (!sent.ok && !notify.notified && !notify.duplicate) {
    await input.deps.sendText(
      "Não consegui avisar a loja agora — tente novamente em instantes.",
    );
  }
  const vid = pending?.veiculo_id ?? null;
  await trackClienteCrmEvent(input, "consultor", vid);
  return { handled: true, replyPreview: "consultor" };
}
