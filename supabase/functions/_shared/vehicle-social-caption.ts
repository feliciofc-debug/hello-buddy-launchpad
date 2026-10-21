import { parseVehicleCarouselData, type VehicleCarouselData } from "./vehicle-carousel.ts";
import { generateVehicleAdCaptions } from "./anuncio-veiculo-captions.ts";
import { sanitizeLinkedInApprovalCopy } from "./linkedin-approval.ts";
import {
  getOwnerMediaRoute,
  type VerticalRouterMediaState,
} from "./owner-media-route.ts";
import type { InboundVertical } from "./vertical-router.ts";

export const VEHICLE_SOCIAL_COPY_PENDING_TTL_MS = 30 * 60 * 1000;

export type VehicleSocialCaptionSources = {
  nome: string;
  descricao?: string | null;
  briefing?: string | null;
  precoNum?: number | null;
  telefone?: string | null;
  cidade?: string | null;
};

export function vehicleCaptionDataFromSources(
  input: VehicleSocialCaptionSources,
): Record<string, unknown> {
  const blob = [
    input.nome,
    input.descricao || "",
    input.briefing || "",
  ].join("\n");
  const parsed = parseVehicleCarouselData(blob);
  const data: Record<string, unknown> = {
    titulo: parsed.titulo || input.nome.trim(),
    ...parsed,
  };
  if (input.precoNum && !Number.isNaN(input.precoNum) && !data.preco) {
    data.preco = `R$ ${
      Number(input.precoNum).toFixed(2).replace(".", ",")
    }`;
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
  const captions = generateVehicleAdCaptions(data, variation);
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
  return /\b(ve[ií]culo|carro|autom[oó]vel|seminovo|suv|hatch|sedan|c[aâ]mbio|jeep|renegade|corolla|civic|onix|hb20|compass|tracker|hilux|km\b|quilometragem)\b/i
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
  return /^(cancelar|cancela|deixa|deixar|esquece|para|parar|cancel)$/.test(n) ||
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
