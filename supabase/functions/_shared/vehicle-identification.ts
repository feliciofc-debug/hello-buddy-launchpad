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

export const VEHICLE_IDENTIFICATION_TTL_MS = 30 * 60 * 1000;

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

export function validPendingVehicleIdentification(
  value: { created_at?: string } | null | undefined,
  nowMs = Date.now(),
): boolean {
  const createdAt = Date.parse(String(value?.created_at || ""));
  return Number.isFinite(createdAt) && createdAt <= nowMs &&
    nowMs - createdAt <= VEHICLE_IDENTIFICATION_TTL_MS;
}

export function isVehicleIdentificationConfirmation(
  text: string,
  identification?: VehicleIdentification | null,
): boolean {
  const value = normalize(text.replace(/<<interactive_id:[^>]+>>/gi, ""));
  if (/^(sim|isso|correto|confirmo|confirmado|pode confirmar)\b/.test(value)) {
    return true;
  }
  const model = normalize(identification?.modelo || "");
  return Boolean(
    model &&
      /\b(e|eh|parece|modelo)\b/.test(value) &&
      value.includes(model),
  );
}

export function isVehicleIdentificationAbandonRequest(text: string): boolean {
  const value = normalize(text.replace(/<<interactive_id:[^>]+>>/gi, ""));
  return /\b(edita|editar|edite|tira|tirar|remove|remover|troca|trocar)\b[\s\S]{0,40}\b(foto|imagem|fundo|cenario)\b/
    .test(value) ||
    /\b(faz|fazer|cria|criar|publica|publicar|posta|postar)\b[\s\S]{0,30}\b(post|video|reels)\b/
      .test(value);
}

const KNOWN_VEHICLE_BRANDS =
  /\b(abarth|audi|bmw|byd|caoa|chery|chevrolet|citroen|fiat|ford|honda|hyundai|jeep|kia|land rover|mercedes|mitsubishi|nissan|peugeot|porsche|ram|renault|toyota|volkswagen|volvo|vw|yamaha)\b/i;

export function looksLikeVehicleMakeModel(text: string): boolean {
  const clean = String(text || "")
    .replace(/<<interactive_id:[^>]+>>/gi, "")
    .replace(/^(?:e|é|eh)\s+(?:um|uma)\s+/i, "")
    .replace(/\b(?:ano|km|quilometragem|preco|valor)\s*[:=-].*$/i, "")
    .replace(/[,\n;].*$/, "")
    .trim();
  if (!clean || isVehicleIdentificationAbandonRequest(clean)) return false;
  if (KNOWN_VEHICLE_BRANDS.test(clean)) {
    return clean.split(/\s+/).filter(Boolean).length >= 2;
  }
  return /^[A-ZÀ-Ý][\p{L}\d-]+(?:\s+[A-ZÀ-Ý][\p{L}\d-]+){1,3}$/u.test(
    clean,
  );
}

export function explicitVehiclePriceChoice(text: string): string | null {
  const value = normalize(text);
  return /\b(sem preco|consulte|consultar valor|sob consulta)\b/.test(value)
    ? "Consulte"
    : null;
}

export function resolveVehiclePrice(
  value: string | null | undefined,
): { ok: true; value: string } | { ok: false } {
  const price = String(value || "").trim();
  return price ? { ok: true, value: price } : { ok: false };
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
