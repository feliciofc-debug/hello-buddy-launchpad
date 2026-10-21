import { parseVehicleCarouselData, type VehicleCarouselData } from "./vehicle-carousel.ts";
import { generateVehicleAdCaptions } from "./anuncio-veiculo-captions.ts";
import { sanitizeLinkedInApprovalCopy } from "./linkedin-approval.ts";

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
