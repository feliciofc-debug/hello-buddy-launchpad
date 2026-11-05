import { normalizeCaptionText } from "./anuncio-caption-common.ts";
import { looksLikeVehicleMakeModel } from "./vehicle-identification.ts";

const KNOWN_BRANDS =
  "abarth|audi|bmw|byd|caoa|chery|chevrolet|citroen|fiat|ford|honda|hyundai|jeep|kia|land rover|mercedes|mitsubishi|nissan|peugeot|porsche|ram|renault|toyota|volkswagen|volvo|vw|yamaha|ducati|harley|harley-davidson|triumph|kawasaki|suzuki|royal enfield";

const GENERIC_IDENTITY_WORDS =
  /^(marca|modelo|ve[ií]culo|carro|moto|motocicleta|motociclo|scooter|logotipo|emblema)$/i;

const VISION_SCENE_MARKERS =
  /\b(foto real|concession[aá]ria|logotipo|posicionad[oa]|destaca|vitrine|conte[uú]do da imagem|esta foto|imagem mostra|a imagem|produto em uma|visual de vitrine|naked com)\b/i;

const HASHTAG_STOPWORDS = new Set([
  "esta",
  "foto",
  "real",
  "produto",
  "conteudo",
  "imagem",
  "concessionaria",
  "logotipo",
  "posicionado",
  "destaca",
  "visual",
  "vitrine",
  "uma",
  "com",
  "para",
  "ideal",
  "quem",
  "busca",
  "veiculo",
  "automóvel",
  "automovel",
  "motocicleta",
  "naked",
  "lateralmente",
  "apresenta",
  "esportivo",
  "marca",
  "modelo",
  "versao",
  "cor",
  "tipo",
  "seminovos",
  "seminovas",
  "motos",
  "carros",
]);

export function stripLibraryVisionWrapper(text: string): string {
  return String(text || "")
    .replace(/^conte[uú]do da imagem:\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function isVisionSceneDescription(text: string): boolean {
  const raw = stripLibraryVisionWrapper(text);
  if (!raw) return false;
  if (VISION_SCENE_MARKERS.test(raw)) return true;
  const normalized = normalizeCaptionText(raw);
  return normalized.length > 72 &&
    /\b(foto|imagem|concessionaria|logotipo|destaca)\b/.test(normalized);
}

export function isMotorcycleVehicle(data: Record<string, unknown>): boolean {
  const kind = normalizeCaptionText(
    String(data.tipo_veiculo || data.tipo || data.carroceria || ""),
  );
  if (/\bmoto|motocic|scooter/.test(kind)) return true;
  const blob = normalizeCaptionText(
    [
      data.titulo,
      data.marca,
      data.modelo,
      data._vision_blob,
    ].filter(Boolean).join(" "),
  );
  return /\bmotocicleta\b|\bmoto\b|\bnaked\b|\bscooter\b|\bpilotar\b/.test(
    blob,
  );
}

export function vehicleLeadEmoji(data: Record<string, unknown>): string {
  return isMotorcycleVehicle(data) ? "🏍️" : "🚗";
}

function titleCaseWords(value: string): string {
  return value.split(/\s+/).filter(Boolean).map((word) => {
    if (/^\d/.test(word)) return word.toUpperCase();
    if (word.length <= 3 && /^[a-z]/i.test(word)) return word.toUpperCase();
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }).join(" ");
}

function normalizeBrandToken(value: string): string {
  const lower = value.toLowerCase();
  if (lower === "vw") return "Volkswagen";
  if (lower === "bmw") return "BMW";
  if (lower === "mercedes") return "Mercedes-Benz";
  return titleCaseWords(value);
}

function knownBrand(value: string): string | null {
  const match = value.match(new RegExp(`^(${KNOWN_BRANDS})$`, "i"));
  return match && !GENERIC_IDENTITY_WORDS.test(match[1])
    ? normalizeBrandToken(match[1])
    : null;
}

function extractColor(text: string): string | null {
  const match = text.match(
    /\b(preto|preta|branco|branca|prata|cinza|vermelho|vermelha|azul|verde|amarelo|amarela|laranja|marrom|bege|dourado|dourada)\b/i,
  );
  return match ? titleCaseWords(match[1]) : null;
}

export function extractVehicleIdentityFromVision(text: string): {
  titulo: string | null;
  marca: string | null;
  modelo: string | null;
  cor: string | null;
  tipo_veiculo: "moto" | "carro" | null;
} {
  const source = stripLibraryVisionWrapper(text);
  if (!source) {
    return {
      titulo: null,
      marca: null,
      modelo: null,
      cor: null,
      tipo_veiculo: null,
    };
  }
  const motorcycle = /\b(moto|motocicleta|motociclo|naked|scooter)\b/i.test(
    source,
  );
  let marca: string | null = null;
  let modelo: string | null = null;

  const logoBrand = source.match(
    new RegExp(
      `logotipo\\s+(?:da|de)\\s+(?:marca\\s+)?["']?\\s*(${KNOWN_BRANDS})\\b`,
      "i",
    ),
  )?.[1];
  if (logoBrand) marca = knownBrand(logoBrand);

  const brandRegex = new RegExp(
    `\\b(${KNOWN_BRANDS})\\b(?:\\s+(?:motorrad|motors|benz))?`,
    "gi",
  );
  if (!marca) {
    const brandHit = source.match(brandRegex)?.[0];
    if (brandHit) {
      marca = knownBrand(
        brandHit.replace(/\s+(motorrad|motors|benz)$/i, ""),
      );
    }
  }

  const modelPatterns = [
    /\b([A-Z]{1,2}\s*\d{2,4}\s*[A-Z]{0,2})\b/g,
    /\b(Renegade|Compass|Corolla|Civic|Onix|HB20|Tracker|Hilux|Argo|Mobi|Cronos|T-Cross|Toro|Kicks|Sentra|Creta|HB20S|Golf|Polo|Tiguan|Ranger|Mustang|Fiesta|Focus|Ka|C4|C3|208|2008|3008|Sandero|Logan|Duster|Kwid|Virtus|Nivus|Taos|Saveiro|S10|Amarok|Frontier|L200|Outlander|Eclipse|ASX|RAV4|Hilux|Yaris|Etios|Camry|SW4|Land Cruiser|Prado|CR-V|HR-V|WR-V|City|Fit|Accord|G\s*310\s*R|F\s*850\s*GS|R\s*1250|MT-?\d{2,3}|XRE\s*\d{3}|CB\s*\d{3}|Twister|Fazer|Factor|Crosser|Tenere|Dominar|Pulsar|Apache|Classic\s*350|PCX(?:\s*\d{2,3})?|Biz(?:\s*\d{2,3})?|Pop(?:\s*\d{2,3})?|CG(?:\s*\d{2,3})?|NMax(?:\s*\d{2,3})?|XMax(?:\s*\d{2,3})?|Burgman(?:\s*\d{2,3})?|Lead(?:\s*\d{2,3})?|Elite(?:\s*\d{2,3})?)\b/gi,
  ];
  for (const pattern of modelPatterns) {
    const hits = [...source.matchAll(pattern)].map((m) =>
      m[1].replace(/\s+/g, " ").trim()
    );
    for (const hit of hits) {
      if (hit.length >= 2 && !/^(com|da|de|do|em|na|no|um|uma)$/i.test(hit)) {
        modelo = hit.replace(/\s+/g, " ").toUpperCase().replace(/\s+/g, " ");
        if (/^g\s*310\s*r$/i.test(modelo)) modelo = "G 310 R";
        break;
      }
    }
    if (modelo) break;
  }

  if (marca && !modelo) {
    const afterBrand = source.match(
      new RegExp(
        `\\b${
          marca.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
        }\\b\\s+([A-Z0-9][\\w\\s-]{1,24})`,
        "i",
      ),
    )?.[1];
    if (afterBrand) {
      const candidate = afterBrand.split(
        /\b(?:com|em|na|no|de|da|posicionad)/i,
      )[0]
        ?.trim();
      if (
        candidate &&
        candidate.split(/\s+/).length <= 4 &&
        !GENERIC_IDENTITY_WORDS.test(candidate)
      ) {
        modelo = candidate.replace(/\s+/g, " ").toUpperCase();
      }
    }
  }

  if (GENERIC_IDENTITY_WORDS.test(String(marca || ""))) marca = null;
  if (GENERIC_IDENTITY_WORDS.test(String(modelo || ""))) modelo = null;
  const isScooter = /\bscooter\b/i.test(source);
  const titulo = marca && modelo
    ? `${marca} ${modelo}`.trim()
    : marca
    ? `${isScooter ? "Scooter" : motorcycle ? "Moto" : "Carro"} ${marca}`
    : motorcycle
    ? (isScooter ? "Scooter" : "Moto")
    : "Carro";
  return {
    titulo,
    marca,
    modelo,
    cor: extractColor(source),
    tipo_veiculo: motorcycle ? "moto" : null,
  };
}

export function resolveVehicleSocialTitle(input: {
  nome: string;
  descricao?: string | null;
  briefing?: string | null;
  parsedTitulo?: string | null;
}): string {
  const candidates = [
    input.parsedTitulo,
    looksLikeVehicleMakeModel(input.nome) &&
      !isVisionSceneDescription(input.nome)
      ? input.nome.trim()
      : null,
    extractVehicleIdentityFromVision(input.nome).titulo,
    extractVehicleIdentityFromVision(String(input.descricao || "")).titulo,
    extractVehicleIdentityFromVision(String(input.briefing || "")).titulo,
  ].map((value) => String(value || "").trim()).filter(Boolean);

  for (const candidate of candidates) {
    if (
      !GENERIC_IDENTITY_WORDS.test(candidate) &&
      !isVisionSceneDescription(candidate)
    ) {
      return candidate.slice(0, 100);
    }
  }
  return "Veículo";
}

export function visionTextForVehicleIdentity(input: {
  nome: string;
  descricao?: string | null;
}): string {
  return [
    stripLibraryVisionWrapper(input.nome),
    stripLibraryVisionWrapper(String(input.descricao || "")),
  ].filter(Boolean).join("\n");
}

export function isVehicleAdNarrativeLeak(text: string): boolean {
  return isVisionSceneDescription(text) ||
    /\b(logotipo|concession[aá]ria destaca|foto real de produto)\b/i.test(text);
}

export function filterVehicleHashtagToken(token: string): boolean {
  const clean = normalizeCaptionText(token).replace(/[^a-z0-9]/g, "");
  return clean.length >= 2 && !HASHTAG_STOPWORDS.has(clean);
}

export function vehicleModelHashtag(modelo: string): string | null {
  const compact = normalizeCaptionText(modelo).replace(/[^a-z0-9]/g, "");
  return compact.length >= 2 ? compact : null;
}

export function vehicleBrandHashtags(
  marca: string,
  motorcycle: boolean,
): string[] {
  const brand = normalizeCaptionText(marca).replace(/[^a-z0-9]/g, "");
  if (!brand) return [];
  const tags = [brand];
  if (brand === "bmw" && motorcycle) tags.push("bmwmotorrad");
  if (brand === "honda" && motorcycle) tags.push("hondamotorcycles");
  if (brand === "yamaha") tags.push("yamahamotor");
  return tags;
}
