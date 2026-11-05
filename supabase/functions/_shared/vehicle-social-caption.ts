import {
  parseVehicleCarouselData,
  type VehicleCarouselData,
} from "./vehicle-carousel.ts";
import { composeVehicleSocialVariant } from "./anuncio-veiculo-captions.ts";
import {
  extractVehicleIdentityFromVision,
  resolveVehicleSocialTitle,
  stripLibraryVisionWrapper,
  visionTextForVehicleIdentity,
} from "./vehicle-social-identity.ts";
import { sanitizeLinkedInApprovalCopy } from "./linkedin-approval.ts";
import {
  getOwnerMediaRoute,
  ownerMediaRoutesFromRouter,
  type VerticalRouterMediaState,
} from "./owner-media-route.ts";
import type { InboundVertical } from "./vertical-router.ts";
import type { VehicleIdentification } from "./vehicle-identification.ts";

export const VEHICLE_SOCIAL_COPY_PENDING_TTL_MS = 30 * 60 * 1000;

type VehicleIdentityContext = {
  identification: VehicleIdentification;
  media_ids?: string[] | null;
  created_at?: string | null;
};

export function resolveVehicleSocialIdentification(input: {
  ownIdentification?: VehicleIdentification | null;
  postedMediaId: string;
  ancestorMediaIds?: string[];
  contexts?: Array<VehicleIdentityContext | null | undefined>;
  verticalRouter?: VerticalRouterMediaState | null;
  nowMs?: number;
}): VehicleIdentification | null {
  if (input.ownIdentification) return input.ownIdentification;

  const lineage = new Set(
    [input.postedMediaId, ...(input.ancestorMediaIds ?? [])]
      .map((id) => String(id || "").trim())
      .filter(Boolean),
  );
  const routes = ownerMediaRoutesFromRouter(input.verticalRouter);
  const nowMs = input.nowMs ?? Date.now();

  for (const context of input.contexts ?? []) {
    if (!context?.identification) continue;
    const contextIds = (context.media_ids ?? [])
      .map((id) => String(id || "").trim())
      .filter(Boolean);
    if (contextIds.some((id) => lineage.has(id))) {
      return context.identification;
    }

    const createdAtMs = Date.parse(String(context.created_at || ""));
    const recent = Number.isFinite(createdAtMs) &&
      createdAtMs <= nowMs &&
      nowMs - createdAtMs <= VEHICLE_SOCIAL_COPY_PENDING_TTL_MS;
    if (!recent) continue;

    const hasNewerDifferentVehicle = Object.entries(routes).some(
      ([mediaId, route]) => {
        if (
          route.route !== "veiculo" ||
          lineage.has(mediaId) ||
          contextIds.includes(mediaId)
        ) {
          return false;
        }
        const updatedAtMs = Date.parse(String(route.updated_at || ""));
        return Number.isFinite(updatedAtMs) && updatedAtMs > createdAtMs;
      },
    );
    if (!hasNewerDifferentVehicle) return context.identification;
  }
  return null;
}

export type VehicleSocialCaptionSources = {
  nome: string;
  descricao?: string | null;
  briefing?: string | null;
  precoNum?: number | null;
  telefone?: string | null;
  cidade?: string | null;
  vehicleIdentification?: VehicleIdentification | null;
};

export function vehicleCaptionDataFromSources(
  input: VehicleSocialCaptionSources,
): Record<string, unknown> {
  const ownerBlob = [
    input.briefing || "",
    stripLibraryVisionWrapper(String(input.descricao || "")),
  ].filter(Boolean).join("\n");
  const parsed = parseVehicleCarouselData(ownerBlob);
  const visionBlob = visionTextForVehicleIdentity({
    nome: input.nome,
    descricao: input.descricao,
  });
  const identity = extractVehicleIdentityFromVision(visionBlob);
  const structured = input.vehicleIdentification?.confianca !== "baixa"
    ? input.vehicleIdentification
    : null;
  const structuredBrand = structured?.marca &&
      !/^(marca|modelo|ve[ií]culo|carro|moto|logotipo|emblema)$/i.test(
        structured.marca,
      )
    ? structured.marca
    : null;
  const structuredModel = structured?.modelo &&
      !/^(marca|modelo|ve[ií]culo|carro|moto|logotipo|emblema)$/i.test(
        structured.modelo,
      )
    ? structured.modelo
    : null;
  const structuredKind = /\bscooter\b/i.test(structured?.carroceria || "")
    ? "Scooter"
    : /\b(moto|motocic)/i.test(structured?.carroceria || "")
    ? "Moto"
    : "Carro";
  const structuredTitle = structuredBrand && structuredModel
    ? `${structuredBrand} ${structuredModel}`
    : structuredBrand
    ? `${structuredKind} ${structuredBrand}`
    : structured
    ? structuredKind
    : "";
  const titulo = resolveVehicleSocialTitle({
    nome: input.nome,
    descricao: input.descricao,
    briefing: input.briefing,
    parsedTitulo: structuredTitle || parsed.titulo,
  });
  const data: Record<string, unknown> = {
    ...parsed,
    titulo,
    ...((structuredBrand || identity.marca)
      ? { marca: structuredBrand || identity.marca }
      : {}),
    ...((structuredModel || identity.modelo)
      ? { modelo: structuredModel || identity.modelo }
      : {}),
    ...((structured?.geracao_ou_faixa_de_anos)
      ? { geracao_ou_faixa_de_anos: structured.geracao_ou_faixa_de_anos }
      : {}),
    ...((structured?.carroceria) ? { carroceria: structured.carroceria } : {}),
    ...((structured?.cor || identity.cor) && !parsed.cor
      ? { cor: structured?.cor || identity.cor }
      : {}),
    _vision_blob: visionBlob,
  };
  if (input.precoNum && !Number.isNaN(input.precoNum) && !data.preco) {
    data.preco = `R$ ${Number(input.precoNum).toFixed(2).replace(".", ",")}`;
  }
  if (input.telefone) {
    data.telefone = input.telefone;
  }
  if (input.cidade) {
    data.cidade_loja = input.cidade;
  }
  if (parsed.motor && !data.combustivel) {
    data.combustivel = parsed.motor;
  }
  const typeBlob = `${visionBlob}\n${ownerBlob}`;
  if (
    identity.tipo_veiculo === "moto" ||
    /\b(moto|motocicleta|motociclo|scooter)\b/i.test(
      `${structured?.carroceria || ""}\n${typeBlob}`,
    )
  ) {
    data.tipo_veiculo = "moto";
  }
  return data;
}

export function vehicleCaptionMissingKmOrPreco(
  data: Record<string, unknown>,
): Array<"km" | "preco"> {
  const missing: Array<"km" | "preco"> = [];
  const km = String(data.quilometragem || data.km || "").trim();
  const preco = String(data.preco || "").trim();
  if (!km) missing.push("km");
  if (!preco) missing.push("preco");
  return missing;
}

export function generateVehicleSocialPostVariants(
  data: Record<string, unknown>,
  rede: "facebook" | "instagram" | "linkedin",
  variation = 0,
): { A: string; B: string; C: string } {
  const offset = Math.abs(variation) % 3;
  const styles: Array<"A" | "B" | "C"> = ["A", "B", "C"];
  const rotated = [...styles.slice(offset), ...styles.slice(0, offset)];
  const captions = {
    A: composeVehicleSocialVariant("", data, rotated[0]),
    B: composeVehicleSocialVariant("", data, rotated[1]),
    C: composeVehicleSocialVariant("", data, rotated[2]),
  };
  if (rede !== "linkedin") return captions;
  return {
    A: sanitizeLinkedInApprovalCopy(captions.A),
    B: sanitizeLinkedInApprovalCopy(captions.B),
    C: sanitizeLinkedInApprovalCopy(captions.C),
  };
}

export function vehicleSocialCaptionGateButtons(): Array<
  { id: string; title: string }
> {
  return [
    { id: "vehicle_social_copy:inform", title: "Informar agora" },
    { id: "vehicle_social_copy:skip", title: "Gerar sem esses dados" },
  ];
}

export function isVehicleSocialLibraryContext(input: {
  nome: string;
  descricaoVisual: string;
  briefing: string;
}): boolean {
  const combined = `${input.nome} ${input.descricaoVisual} ${input.briefing}`;
  return /\b(ve[ií]culo|carro|autom[oó]vel|moto|motocicleta|scooter|seminovo|suv|hatch|sedan|c[aâ]mbio|jeep|honda|yamaha|renegade|corolla|civic|onix|hb20|compass|tracker|hilux|pcx|biz|pop|nmax|xmax|burgman|lead|km\b|quilometragem)\b/i
    .test(combined);
}

/** Legenda de veículo na biblioteca: rota salva da mídia manda; keywords só como fallback. */
export function shouldUseVehicleSocialLibraryCaption(input: {
  mediaId: string;
  verticalRouter?: VerticalRouterMediaState | null;
  verticalScope?: InboundVertical | null;
  fallbackContext: {
    nome: string;
    descricaoVisual: string;
    briefing: string;
  };
}): boolean {
  const stored = getOwnerMediaRoute(input.verticalRouter, input.mediaId);
  if (stored?.route === "geral") return false;
  if (stored?.route === "veiculo") return true;
  if (input.verticalScope !== "veiculo") return false;
  return isVehicleSocialLibraryContext(input.fallbackContext);
}

export function vehicleSocialCopyPendingExpired(
  createdAt: string,
  nowMs = Date.now(),
): boolean {
  const t = Date.parse(createdAt);
  if (!Number.isFinite(t)) return true;
  return nowMs - t > VEHICLE_SOCIAL_COPY_PENDING_TTL_MS;
}

function normalizePendingText(text: string): string {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function vehicleSocialCopyCancelRequest(text: string): boolean {
  const n = normalizePendingText(text);
  if (!n) return false;
  return /^(cancelar|cancela|deixa|deixar|esquece|para|parar|cancel)$/.test(
    n,
  ) ||
    /\b(cancelar|deixa pra l[aá]|esquece isso)\b/.test(n);
}

function vehicleKmPrecoSignals(normalized: string): boolean {
  const n = normalized;
  const hasKm = /\bquilometragem\b/.test(n) ||
    /\bkm\s*[:=]?\s*\d+/.test(n) ||
    /\b\d+[.\d]*\s*km\b/.test(n) ||
    /\b\d+\s*mil\s*km\b/.test(n) ||
    /\b\d+mil\s*km\b/.test(n) ||
    /\b\d+mil\b/.test(n);
  const hasPrice = /\br\$\s*[\d.,]+/.test(n) ||
    (/\bpre[cç]o\b/.test(n) && /\d/.test(n)) ||
    (/\bvalor\b/.test(n) && /\d/.test(n)) ||
    /\b\d{1,3}(?:\.\d{3})+(?:,\d{2})?\b/.test(n) ||
    /\b\d{5,6}\b/.test(n) ||
    (/\b\d+\s*mil\b/.test(n) && !/\bmil\s*km\b/.test(n)) ||
    /\b\d+k\b/.test(n);
  return hasKm || hasPrice;
}

export function looksLikeVehicleKmPrecoReply(text: string): boolean {
  const raw = String(text || "").trim();
  if (!raw || vehicleSocialCopyCancelRequest(raw)) return false;
  const n = normalizePendingText(raw);
  if (!n) return false;
  if (/^(bom dia|boa tarde|boa noite|oi|ola)$/.test(n)) return false;
  if (/\bfaz\s+um\s+carrossel\b/.test(n)) return false;
  if (
    /\b(cria|criar|faz|fazer|monta|montar|gera|gerar|postar|publicar)\b.*\b(v[ií]deo|an[uú]ncio|carrossel|post|story|reels)\b/
      .test(n)
  ) {
    return false;
  }
  return vehicleKmPrecoSignals(n);
}

export function mergeVehicleCarouselIntoCaptionData(
  base: Record<string, unknown>,
  carousel: VehicleCarouselData,
): Record<string, unknown> {
  return {
    ...base,
    ...Object.fromEntries(
      Object.entries(carousel).filter(([, v]) =>
        v != null && String(v).trim() !== "" &&
        (!(Array.isArray(v)) || v.length > 0)
      ),
    ),
  };
}
