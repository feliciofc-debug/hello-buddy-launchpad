import {
  brandListRows,
  buildRecadoConsultor,
  buildRecadoInteresse,
  CLIENT_HANDOFF_CONFIRMATION,
  extractVitrineInteractiveId,
  formatCardBody,
  formatDetailLines,
  isExplicitVehicleShowcaseRequest,
  marcaToSlug,
  parseVitrineButtonId,
  PendingVitrineEstoque,
  shouldEnterShowcase,
  shouldOfferVehicleShowcase,
  slugToMarcaCandidates,
  VehicleShowcaseTenantFlags,
  VeiculoVitrineRow,
  vitrineButtonId,
  VITRINE_CAROUSEL_PAGE_SIZE,
  VITRINE_ID_PREFIX,
} from "./vehicle-stock-whatsapp.ts";
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
  loadVeiculosByMarca: (
    marca: string,
    offset: number,
    limit: number,
  ) => Promise<VeiculoVitrineRow[]>;
  loadVeiculoById: (id: string) => Promise<VeiculoVitrineRow | null>;
  sendText: (text: string) => Promise<ShowcaseSendResult>;
  sendList: (body: string, rows: Array<{ id: string; title: string; description?: string }>) =>
    Promise<ShowcaseSendResult>;
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
};

export type ShowcaseTurnInput = {
  userText: string;
  listId?: string;
  inboundPayload?: unknown;
  contactName?: string | null;
  fromNumber: string;
  forceInteractive?: boolean;
  deps: ShowcaseTurnDeps;
};

export type ShowcaseTurnOutput = {
  handled: boolean;
  replyPreview?: string;
};

const VEHICLE_SELECT =
  "id,marca,modelo,versao,ano_fabricacao,ano_modelo,km,preco,cor,cambio,combustivel,portas,blindado,nivel_blindagem,opcionais,caracteristicas,descricao,fotos,status";

export { VEHICLE_SELECT };

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

  if (
    !shouldEnterShowcase({
      flags,
      explicitText: explicit,
      vitrineInteractiveId: vitrineId,
    })
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
    const marcas = await input.deps.loadMarcas();
    if (!marcas.length) {
      await input.deps.sendText(
        "No momento não temos veículos disponíveis no estoque. Posso ajudar em algo mais?",
      );
      await input.deps.savePending(null);
      return { handled: true, replyPreview: "estoque_vazio" };
    }
    await input.deps.savePending({
      stage: "marcas",
      offset: 0,
      updated_at: new Date().toISOString(),
    });
    await input.deps.sendList(
      "Escolha uma marca para ver os carros disponíveis:",
      brandListRows(marcas),
    );
    return { handled: true, replyPreview: "marcas" };
  }

  return { handled: false };
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

  if (action === "voltar_marcas" || action === "marcas") {
    await input.deps.savePending({
      stage: "marcas",
      offset: 0,
      updated_at: new Date().toISOString(),
    });
    await input.deps.sendList(
      "Escolha uma marca:",
      brandListRows(marcas),
    );
    return { handled: true, replyPreview: "voltar_marcas" };
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
    const marca = slugToMarcaCandidates(parts[0], marcas);
    const offset = Number.parseInt(parts[1], 10) || 0;
    if (!marca) {
      await input.deps.sendText("Não encontrei essa marca.");
      return { handled: true };
    }
    return await sendMarcaCarousel(input, marca, offset);
  }

  if (action === "detalhe" && parts[0]) {
    const vehicle = await input.deps.loadVeiculoById(parts[0]);
    if (!vehicle) {
      await input.deps.sendText("Esse veículo não está mais disponível.");
      return { handled: true };
    }
    await input.deps.savePending({
      stage: "detalhe",
      marca: vehicle.marca,
      offset: 0,
      veiculo_id: vehicle.id,
      updated_at: new Date().toISOString(),
    });
    const detail = formatDetailLines(vehicle).join("\n");
    await input.deps.sendButtons(
      detail,
      [
        { id: vitrineButtonId("interesse", vehicle.id), title: "Tenho interesse" },
        { id: vitrineButtonId("consultor", vehicle.id), title: "Falar consultor" },
        { id: vitrineButtonId("voltar_marcas"), title: "Voltar marcas" },
      ],
      vehicle.fotos?.[0] || undefined,
    );
    return { handled: true, replyPreview: "detalhe" };
  }

  if (action === "fotos" && parts[0]) {
    const vehicle = await input.deps.loadVeiculoById(parts[0]);
    if (!vehicle?.fotos?.length) {
      await input.deps.sendText("Não há fotos cadastradas para este veículo.");
      return { handled: true };
    }
    for (const url of vehicle.fotos.slice(0, 5)) {
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

  return { handled: false };
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
  if (!vehicles.length) {
    await input.deps.sendText(`Não há carros disponíveis da ${marca} no momento.`);
    return { handled: true, replyPreview: "carrossel_vazio" };
  }

  await input.deps.savePending({
    stage: "carrossel",
    marca,
    offset,
    updated_at: new Date().toISOString(),
  });

  const body = offset > 0
    ? `Mais carros ${marca} (${offset + 1}–${offset + vehicles.length}):`
    : `Carros ${marca} disponíveis:`;

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

  const nextOffset = offset + vehicles.length;
  const hasMore = vehicles.length >= VITRINE_CAROUSEL_PAGE_SIZE;
  if (hasMore) {
    await input.deps.sendButtons(
      "Quer ver mais carros desta marca?",
      [{
        id: vitrineButtonId("mais", `${marcaToSlug(marca)}:${nextOffset}`),
        title: "Ver mais carros",
      }],
    );
  } else {
    await input.deps.sendButtons(
      "Quer ver outra marca?",
      [{ id: vitrineButtonId("voltar_marcas"), title: "Voltar marcas" }],
    );
  }

  return { handled: true, replyPreview: `carrossel_${marca}` };
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
  const fwd = await input.deps.encaminharRecado(recado);
  await input.deps.savePending({
    stage: "handoff",
    marca: vehicle.marca,
    offset: 0,
    veiculo_id: vehicle.id,
    updated_at: new Date().toISOString(),
  });
  if (fwd.ok) {
    await input.deps.sendText(CLIENT_HANDOFF_CONFIRMATION);
  } else {
    await input.deps.sendText(
      "Recebi seu interesse! Não consegui avisar a loja agora — tente novamente em instantes.",
    );
  }
  return { handled: true, replyPreview: kind };
}

async function handoffConsultorGeral(input: ShowcaseTurnInput): Promise<ShowcaseTurnOutput> {
  const pending = input.deps.getPending();
  const recado = buildRecadoConsultor({
    contactName: input.contactName,
    fromNumber: input.fromNumber,
    marca: pending?.marca ?? null,
  });
  const fwd = await input.deps.encaminharRecado(recado);
  if (fwd.ok) {
    await input.deps.sendText(CLIENT_HANDOFF_CONFIRMATION);
  } else {
    await input.deps.sendText(
      "Não consegui avisar a loja agora — tente novamente em instantes.",
    );
  }
  return { handled: true, replyPreview: "consultor" };
}
