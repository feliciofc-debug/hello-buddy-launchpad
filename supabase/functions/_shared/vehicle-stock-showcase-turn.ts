import {
  activeFaixasFromCounts,
  buildDetalheVehicleListRows,
  buildProximosDiasUteisVisita,
  buildRecadoConsultor,
  buildRecadoFinanciamento,
  buildRecadoFormCancelado,
  buildRecadoInteresse,
  buildRecadoVisita,
  buildShowcaseMenuSections,
  buildVisitaDiaListRows,
  buildVitrineRecadoIdempotencyKey,
  confirmacaoComNomeLoja,
  confirmacaoFinanciamento,
  confirmacaoVisitaAgendada,
  countVehiclesByFaixa,
  registerVitrineRecadoIdempotency,
  vitrineRecadoJaEnviado,
  extractVitrineInteractiveId,
  FaixaPrecoId,
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
  vitrineFormStepExpectsText,
  shouldEnterShowcase,
  shouldOfferVehicleShowcase,
  slugToMarcaCandidates,
  VehicleShowcaseTenantFlags,
  VeiculoVitrineRow,
  vitrineButtonId,
  VITRINE_CAROUSEL_PAGE_SIZE,
  VITRINE_CAROUSEL_POST_DELAY_MS,
  VITRINE_ID_PREFIX,
  vehicleDisplayTitle,
  VitrineVisitaTurno,
} from "./vehicle-stock-whatsapp.ts";
import {
  advanceTrocaAfterPhoto,
  advanceTrocaAfterText,
  buildRecadoTrocaAvaliacao,
  confirmacaoTrocaCliente,
  mergePendingForTrocaStart,
  promptTrocaModeloAno,
  promptTrocaObservacoes,
  skipTrocaObservacoes,
  VITRINE_TROCA_FOTO_SLOTS,
} from "./vehicle-stock-troca.ts";
import type { CarouselCardInput } from "./whatsapp-interactive-carousel.ts";

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
};

export type ShowcaseTurnInput = {
  userText: string;
  listId?: string;
  inboundPayload?: unknown;
  contactName?: string | null;
  fromNumber: string;
  forceInteractive?: boolean;
  allowEarlyFormCapture?: boolean;
  deps: ShowcaseTurnDeps;
};

export type ShowcaseTurnOutput = {
  handled: boolean;
  replyPreview?: string;
};

const VEHICLE_SELECT =
  "id,marca,modelo,versao,ano_fabricacao,ano_modelo,km,preco,cor,cambio,combustivel,portas,blindado,nivel_blindagem,opcionais,caracteristicas,descricao,fotos,status";

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

export async function runVehicleStockShowcaseTurn(
  input: ShowcaseTurnInput,
): Promise<ShowcaseTurnOutput> {
  const flags = await input.deps.loadTenantFlags();
  if (!shouldOfferVehicleShowcase(flags)) {
    return { handled: false };
  }

  const vitrineId = extractVitrineInteractiveId({
    userText: input.userText,
    listId: input.listId,
    inboundPayload: input.inboundPayload,
  });
  const explicit = isExplicitVehicleShowcaseRequest(input.userText, flags);

  let pending = input.deps.getPending() ?? null;
  if (pending?.form && pendingFormExpired(pending.form)) {
    pending = { ...pending, form: null };
    await input.deps.savePending(pending);
  }

  const formControl = isVitrineFormControlText(input.userText);
  if (pendingFormIsActive(pending) && formControl) {
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
    pending.form.flow === "troca" &&
    !vitrineId &&
    vitrineFormStepExpectsText(pending.form.step)
  ) {
    return await handleTrocaTextStep(input, pending);
  }

  if (
    !shouldEnterShowcase({
      flags,
      explicitText: explicit,
      vitrineInteractiveId: vitrineId,
    }) &&
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
    return await openShowcaseMenu(input, 0);
  }

  return { handled: false };
}

async function openShowcaseMenu(
  input: ShowcaseTurnInput,
  marcaOffset: number,
): Promise<ShowcaseTurnOutput> {
  const marcas = await input.deps.loadMarcas();
  if (!marcas.length) {
    await input.deps.sendText(
      "No momento não temos veículos disponíveis no estoque. Posso ajudar em algo mais?",
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
    offset: 0,
    marca_offset: marcaOffset,
    updated_at: new Date().toISOString(),
  });
  await input.deps.sendMenu(
    "Como prefere explorar nosso estoque?",
    sections,
    "Ver opções",
  );
  return { handled: true, replyPreview: "menu" };
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
  const marcas = await input.deps.loadMarcas();

  if (
    action === "voltar_marcas" ||
    action === "marcas" ||
    (action === "acao" && parts[0] === "inicio")
  ) {
    return await openShowcaseMenu(input, 0);
  }

  if (action === "menu_marcas" && parts[0] != null) {
    const offset = Number.parseInt(parts[0], 10) || 0;
    return await openShowcaseMenu(input, offset);
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
    if (["ate_300", "300_600", "acima_600"].includes(slugOrFaixa)) {
      return await sendFaixaCarousel(input, slugOrFaixa as FaixaPrecoId, offset);
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
    return await handleFinanciamentoSimples(input, parts[1]);
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
  const vehicle = await input.deps.loadVeiculoById(vehicleId);
  if (!vehicle) {
    await input.deps.sendText("Esse veículo não está mais disponível.");
    return { handled: true };
  }
  const flags = await input.deps.loadTenantFlags();
  const recado = buildRecadoVisita({
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
  return {
    handled: true,
    replyPreview: notify.duplicate ? "visita_confirmada_dedup" : "visita_confirmada",
  };
}

async function handleFinanciamentoSimples(
  input: ShowcaseTurnInput,
  vehicleId: string,
): Promise<ShowcaseTurnOutput> {
  const vehicle = await input.deps.loadVeiculoById(vehicleId);
  if (!vehicle) {
    await input.deps.sendText("Esse veículo não está mais disponível.");
    return { handled: true };
  }
  const flags = await input.deps.loadTenantFlags();
  const recado = buildRecadoFinanciamento({
    contactName: input.contactName,
    fromNumber: input.fromNumber,
    vehicle,
  });
  const idemKey = buildVitrineRecadoIdempotencyKey({
    acao: "financiamento",
    fromNumber: input.fromNumber,
    veiculoId: vehicle.id,
  });
  const notify = await vitrineNotifyOwner(input, idemKey, recado);
  const after = input.deps.getPending() ?? basePending(input.deps.getPending());
  await input.deps.savePending({
    ...after,
    form: null,
    stage: "handoff",
    veiculo_id: vehicle.id,
    updated_at: new Date().toISOString(),
  });
  const msg = confirmacaoFinanciamento(flags.nome_empresa);
  const sent = await input.deps.sendText(msg);
  if (!sent.ok && !notify.notified && !notify.duplicate) {
    await input.deps.sendText(
      "Recebi seu pedido de simulação, mas não consegui avisar a loja agora — tente novamente em instantes.",
    );
  }
  return { handled: true, replyPreview: "financiamento" };
}

async function startTrocaFlow(
  input: ShowcaseTurnInput,
  vehicleId: string,
): Promise<ShowcaseTurnOutput> {
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
  if (reply) {
    await input.deps.sendText(reply);
  }
  if (form.step === "observacoes") {
    await input.deps.sendButtons(promptTrocaObservacoes(), [
      { id: vitrineButtonId("troca_obs", "pular"), title: "Pular" },
    ]);
    return { handled: true, replyPreview: "troca_observacoes" };
  }
  return { handled: true, replyPreview: `troca_${form.step}` };
}

async function finalizeTrocaFlow(
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
  const recado = buildRecadoTrocaAvaliacao({
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

export async function applyTrocaPhotoAndReply(
  input: ShowcaseTurnInput,
  photo: { url: string; visionView?: string },
): Promise<ShowcaseTurnOutput> {
  const pending = input.deps.getPending();
  const form = pending?.form;
  if (!form || form.flow !== "troca" || form.step !== "fotos") {
    return { handled: false };
  }
  const slotDef = VITRINE_TROCA_FOTO_SLOTS[form.foto_slot_index ?? 0];
  if (!slotDef) {
    return { handled: false };
  }
  const now = new Date().toISOString();
  const { form: nextForm, reply } = advanceTrocaAfterPhoto({
    form,
    slot: slotDef.id,
    url: photo.url,
    visionView: photo.visionView as
      | import("./vehicle-stock-troca-vision.ts").TrocaVisionView
      | undefined,
    now,
  });
  await input.deps.savePending({ ...pending!, form: nextForm, updated_at: now });
  if (nextForm.step === "observacoes") {
    await input.deps.sendButtons(promptTrocaObservacoes(), [
      { id: vitrineButtonId("troca_obs", "pular"), title: "Pular" },
    ]);
    return { handled: true, replyPreview: "troca_observacoes" };
  }
  await input.deps.sendText(reply);
  return { handled: true, replyPreview: `troca_foto_${slotDef.id}` };
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
  const recado = kind === "cancelar"
    ? buildRecadoFormCancelado({
      contactName: input.contactName,
      fromNumber: input.fromNumber,
      vehicle,
      form: pending.form!,
    })
    : buildRecadoConsultor({
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
  const vehicle = await input.deps.loadVeiculoById(vehicleId);
  if (!vehicle) {
    await input.deps.sendText("Esse veículo não está mais disponível.");
    return { handled: true };
  }
  const flags = await input.deps.loadTenantFlags();
  const recado = kind === "interesse"
    ? buildRecadoInteresse({
      contactName: input.contactName,
      fromNumber: input.fromNumber,
      vehicle,
    })
    : buildRecadoConsultor({
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
  return { handled: true, replyPreview: kind };
}

async function handoffConsultorGeral(input: ShowcaseTurnInput): Promise<ShowcaseTurnOutput> {
  const pending = input.deps.getPending();
  const flags = await input.deps.loadTenantFlags();
  const recado = buildRecadoConsultor({
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
  return { handled: true, replyPreview: "consultor" };
}
