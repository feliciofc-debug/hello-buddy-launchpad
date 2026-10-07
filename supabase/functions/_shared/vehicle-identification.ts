export type VehicleIdentificationConfidence = "alta" | "media" | "baixa";

export type VehicleIdentification = {
  marca: string | null;
  modelo: string | null;
  geracao_ou_faixa_de_anos: string | null;
  cor: string | null;
  carroceria: string | null;
  confianca: VehicleIdentificationConfidence;
  pistas_visuais: string[];
};

const GENERIC_VEHICLE_TITLES = new Set([
  "veiculo",
  "veiculo sedan",
  "carro",
  "carro sedan",
  "sedan",
  "hatch",
  "carro hatch",
  "suv",
  "caminhonete",
  "pickup",
  "moto",
  "motocicleta",
]);

function normalize(value: string): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function vehicleIdentificationPrompt(): string {
  return [
    "Responda somente JSON puro.",
    "Identifique marca e modelo exatos pelo formato da carroceria, faróis, lanternas, grade, colunas e rodas.",
    "Não responda só a categoria (sedan, hatch, SUV).",
    "Não invente versão ou ano exato. Informe uma geração ou faixa de anos somente quando houver pistas visuais.",
    'Formato obrigatório: {"marca":string|null,"modelo":string|null,"geracao_ou_faixa_de_anos":string|null,"cor":string|null,"carroceria":string|null,"confianca":"alta"|"media"|"baixa","pistas_visuais":string[]}.',
  ].join("\n");
}

export function parseVehicleIdentification(
  raw: string,
): VehicleIdentification | null {
  try {
    const parsed = JSON.parse(
      String(raw || "").replace(/```json\s*|\s*```/gi, "").trim(),
    );
    const confidence = ["alta", "media", "baixa"].includes(parsed?.confianca)
      ? parsed.confianca as VehicleIdentificationConfidence
      : "baixa";
    const clean = (value: unknown): string | null => {
      const text = typeof value === "string" ? value.trim() : "";
      return text && !/^(desconhecid[oa]|nao identificado|null)$/i.test(text)
        ? text
        : null;
    };
    return {
      marca: clean(parsed?.marca),
      modelo: clean(parsed?.modelo),
      geracao_ou_faixa_de_anos: clean(parsed?.geracao_ou_faixa_de_anos),
      cor: clean(parsed?.cor),
      carroceria: clean(parsed?.carroceria),
      confianca: confidence,
      pistas_visuais: Array.isArray(parsed?.pistas_visuais)
        ? parsed.pistas_visuais.filter((item: unknown) =>
          typeof item === "string" && item.trim()
        ).map((item: string) => item.trim()).slice(0, 8)
        : [],
    };
  } catch {
    return null;
  }
}

export function hasSpecificVehicleModel(
  identification: VehicleIdentification | null,
): boolean {
  return Boolean(
    identification?.marca &&
      identification?.modelo &&
      !isGenericVehicleTitle(
        `${identification.marca} ${identification.modelo}`,
      ),
  );
}

export function isGenericVehicleTitle(value: string): boolean {
  const normalized = normalize(value);
  const withoutYear = normalized
    .replace(/\b(?:19|20)\d{2}(?:\s*[/.-]\s*(?:19|20)?\d{2})?\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (GENERIC_VEHICLE_TITLES.has(withoutYear)) return true;
  return /^(veiculo|carro|automovel)\s+(sedan|hatch|suv|pickup|caminhonete)$/
    .test(withoutYear);
}

export function resolveVehicleAdTitle(params: {
  requestedTitle?: string | null;
  identification?: {
    confirmed?: boolean;
    confirmed_title?: string;
  } | null;
}):
  | { ok: true; title: string }
  | { ok: false; reason: "unconfirmed_suggestion" | "generic_title" } {
  if (params.identification && !params.identification.confirmed) {
    return { ok: false, reason: "unconfirmed_suggestion" };
  }
  const title = String(
    params.identification?.confirmed
      ? params.identification.confirmed_title
      : params.requestedTitle,
  ).trim();
  if (!title || isGenericVehicleTitle(title)) {
    return { ok: false, reason: "generic_title" };
  }
  return { ok: true, title };
}

export function vehicleIdentificationQuestion(
  identification: VehicleIdentification | null,
): string {
  if (
    !identification ||
    identification.confianca === "baixa" ||
    !hasSpecificVehicleModel(identification)
  ) {
    return "Não consegui identificar o modelo com segurança. Qual é a marca, o modelo e o ano?";
  }
  const vehicle = `${identification.marca} ${identification.modelo}`;
  const range = identification.geracao_ou_faixa_de_anos
    ? ` (${identification.geracao_ou_faixa_de_anos})`
    : "";
  const color = identification.cor ? `, cor ${identification.cor}` : "";
  return `Pela foto parece um ${vehicle}${range}${color}. Confirma?\n\nTambém me mande ano, km, preço e os outros dados reais que quiser mostrar.`;
}

export function vehicleIdentificationButtons() {
  return {
    body: "A identificação visual é apenas uma sugestão.",
    buttons: [
      { id: "vehicle_identification:confirm", title: "Confirmar" },
      {
        id: "vehicle_identification:correct",
        title: "Corrigir modelo",
      },
    ],
  };
}
