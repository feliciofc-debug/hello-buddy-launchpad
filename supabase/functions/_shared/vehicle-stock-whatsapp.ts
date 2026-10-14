import { isAutomotiveTenant } from "./vertical-router.ts";

export const VITRINE_ID_PREFIX = "veiculo_vitrine:";

export type VehicleShowcaseTenantFlags = {
  segmento: string | null;
  vitrine_veiculos_demo: boolean;
};

export type PendingVitrineEstoque = {
  stage: "marcas" | "carrossel" | "detalhe" | "handoff";
  marca?: string | null;
  offset: number;
  veiculo_id?: string | null;
  updated_at: string;
};

export type VeiculoVitrineRow = {
  id: string;
  marca: string;
  modelo: string;
  versao: string | null;
  ano_fabricacao: number | null;
  ano_modelo: number | null;
  km: number | null;
  preco: number | null;
  cor: string | null;
  cambio: string | null;
  combustivel: string | null;
  portas: number | null;
  blindado: boolean;
  nivel_blindagem: string | null;
  opcionais: string[] | null;
  caracteristicas: string[] | null;
  descricao: string | null;
  fotos: string[] | null;
  status: string;
};

export function shouldOfferVehicleShowcase(
  flags: VehicleShowcaseTenantFlags,
): boolean {
  return isAutomotiveTenant(flags.segmento) || flags.vitrine_veiculos_demo === true;
}

export function isVitrineInteractiveId(id: string): boolean {
  return String(id || "").toLowerCase().startsWith(VITRINE_ID_PREFIX);
}

export function resolveVitrineInboundButtonId(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const record = payload as {
    interactive?: { button_reply?: { id?: string } };
    button?: { payload?: string };
  };
  const interactiveId = String(record.interactive?.button_reply?.id ?? "");
  if (isVitrineInteractiveId(interactiveId)) return interactiveId;
  const carouselPayload = String(record.button?.payload ?? "");
  if (isVitrineInteractiveId(carouselPayload)) return carouselPayload;
  return interactiveId || carouselPayload || "";
}

/** Quick reply de carrossel Meta: type button + button.payload (não interactive.button_reply). */
export function formatCarouselVitrineButtonText(
  button: { payload?: string; text?: string } | undefined,
): string | null {
  if (!button?.payload) return null;
  const id = String(button.payload);
  if (!isVitrineInteractiveId(id)) return null;
  const text = String(button.text ?? "").trim();
  return text ? `${text}\n<<INTERACTIVE_ID:${id}>>` : `<<INTERACTIVE_ID:${id}>>`;
}

export function extractVitrineInteractiveId(input: {
  userText?: string;
  buttonId?: string;
  listId?: string;
  inboundPayload?: unknown;
}): string | null {
  const fromPayload = input.inboundPayload
    ? resolveVitrineInboundButtonId(input.inboundPayload)
    : "";
  const direct = fromPayload || input.buttonId || input.listId || "";
  if (isVitrineInteractiveId(direct)) return String(direct);
  const match = String(input.userText || "").match(
    /<<INTERACTIVE_ID:(veiculo_vitrine:[^>]+)>>/i,
  );
  return match?.[1] ?? null;
}

/** Gatilhos que mencionam carro/veículo explicitamente (conta demo não automotiva). */
const SHOWCASE_TEXT_VEHICLE_SPECIFIC = [
  /\bver\s+carros?\b/,
  /\bquero\s+ver\s+(os\s+)?carros?\b/,
  /\bestoque\s+de\s+veiculos?\b/,
  /\bcarros?\s+disponiveis\b/,
  /\bveiculos?\s+disponiveis\b/,
  /\bmostrar?\s+veiculos?\b/,
  /\bmostrar?\s+carros?\b/,
  /\bver\s+veiculos?\b/,
];

/** Só tenants automotivos (expo genérica de “loja”/“estoque” não dispara vitrine). */
const SHOWCASE_TEXT_AUTOMOTIVE_EXTRA = [
  /\bo\s+que\s+tem\s+na\s+loja\b/,
  /\bver\s+o\s+estoque\b/,
];

function normalizedShowcaseText(text: string): string {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/<<INTERACTIVE_ID:[^>]+>>/gi, "")
    .toLowerCase()
    .trim();
}

export function isExplicitVehicleShowcaseRequest(
  text: string,
  flags?: VehicleShowcaseTenantFlags,
): boolean {
  const value = normalizedShowcaseText(text);
  if (!value) return false;

  const automotive = isAutomotiveTenant(flags?.segmento ?? null);
  const demoOnly = flags?.vitrine_veiculos_demo === true && !automotive;

  const vehicleSpecific = SHOWCASE_TEXT_VEHICLE_SPECIFIC.some((re) => re.test(value));
  if (demoOnly) return vehicleSpecific;

  const patterns = automotive
    ? [...SHOWCASE_TEXT_VEHICLE_SPECIFIC, ...SHOWCASE_TEXT_AUTOMOTIVE_EXTRA]
    : SHOWCASE_TEXT_VEHICLE_SPECIFIC;
  return patterns.some((re) => re.test(value));
}

export function marcaToSlug(marca: string): string {
  return String(marca || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "") || "marca";
}

export function slugToMarcaCandidates(slug: string, marcas: string[]): string | null {
  const normalizedSlug = String(slug || "").toLowerCase();
  const exact = marcas.find((m) => marcaToSlug(m) === normalizedSlug);
  if (exact) return exact;
  return marcas.find((m) =>
    marcaToSlug(m).startsWith(normalizedSlug) ||
    normalizedSlug.startsWith(marcaToSlug(m))
  ) ?? null;
}

export function vitrineButtonId(action: string, suffix?: string): string {
  return suffix
    ? `${VITRINE_ID_PREFIX}${action}:${suffix}`
    : `${VITRINE_ID_PREFIX}${action}`;
}

export function parseVitrineButtonId(id: string): {
  action: string;
  parts: string[];
} {
  const raw = id.replace(/^veiculo_vitrine:/i, "");
  const parts = raw.split(":");
  return { action: parts[0] || "", parts: parts.slice(1) };
}

export function formatPrecoBrl(preco: number | null | undefined): string {
  if (preco == null || !Number.isFinite(Number(preco))) return "Consulte";
  return Number(preco).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

export function formatAno(v: VeiculoVitrineRow): string {
  const af = v.ano_fabricacao;
  const am = v.ano_modelo;
  if (af && am && af !== am) return `${af}/${am}`;
  if (am) return String(am);
  if (af) return String(af);
  return "—";
}

export function formatCardBody(v: VeiculoVitrineRow): string {
  const titulo = [v.marca, v.modelo, v.versao].filter(Boolean).join(" ");
  const km = v.km != null ? `${v.km.toLocaleString("pt-BR")} km` : null;
  const extras = [formatAno(v), km, v.cambio, v.cor, formatPrecoBrl(v.preco)]
    .filter(Boolean)
    .join(" · ");
  return truncateCardText(`${titulo}\n${extras}`);
}

function truncateCardText(text: string): string {
  const t = text.trim();
  if (t.length <= 160) return t;
  return `${t.slice(0, 157)}...`;
}

export function formatDetailLines(v: VeiculoVitrineRow): string[] {
  const lines: string[] = [
    `*${[v.marca, v.modelo, v.versao].filter(Boolean).join(" ")}*`,
    `Ano: ${formatAno(v)}`,
    v.km != null ? `Km: ${v.km.toLocaleString("pt-BR")}` : null,
    v.preco != null ? `Preço: ${formatPrecoBrl(v.preco)}` : null,
    v.cor ? `Cor: ${v.cor}` : null,
    v.cambio ? `Câmbio: ${v.cambio}` : null,
    v.combustivel ? `Combustível: ${v.combustivel}` : null,
    v.portas != null ? `Portas: ${v.portas}` : null,
    v.blindado ? `Blindado: sim${v.nivel_blindagem ? ` (${v.nivel_blindagem})` : ""}` : null,
  ].filter((line): line is string => !!line);

  const opcionais = (v.opcionais || []).filter(Boolean);
  if (opcionais.length) lines.push(`Opcionais: ${opcionais.slice(0, 12).join(", ")}`);
  const caracteristicas = (v.caracteristicas || []).filter(Boolean);
  if (caracteristicas.length) {
    lines.push(`Características: ${caracteristicas.slice(0, 12).join(", ")}`);
  }
  if (v.descricao?.trim()) {
    lines.push(v.descricao.trim().slice(0, 500));
  }
  // Procedência: sem coluna dedicada; origem/url_origem não são exibidas ao cliente.
  return lines;
}

export function vehicleTitle(v: VeiculoVitrineRow): string {
  return [v.marca, v.modelo, v.versao, formatAno(v)].filter(Boolean).join(" ");
}

export function buildRecadoInteresse(input: {
  contactName?: string | null;
  fromNumber: string;
  vehicle: VeiculoVitrineRow;
}): string {
  const nome = (input.contactName || "").trim() || "Cliente";
  const titulo = vehicleTitle(input.vehicle);
  const preco = formatPrecoBrl(input.vehicle.preco);
  return [
    `Nome: ${nome}`,
    `Telefone: ${input.fromNumber}`,
    `Cliente ${nome} (${input.fromNumber}) tem interesse no ${titulo} – ${preco}.`,
    `Veículo (estoque): ${input.vehicle.id}`,
    "Ação: retornar o contato do cliente.",
  ].join("\n");
}

export function buildRecadoConsultor(input: {
  contactName?: string | null;
  fromNumber: string;
  vehicle?: VeiculoVitrineRow | null;
  marca?: string | null;
}): string {
  const nome = (input.contactName || "").trim() || "Cliente";
  const ctx = input.vehicle
    ? `${vehicleTitle(input.vehicle)} – ${formatPrecoBrl(input.vehicle.preco)}`
    : (input.marca ? `marca ${input.marca}` : "vitrine de veículos");
  return [
    `Nome: ${nome}`,
    `Telefone: ${input.fromNumber}`,
    `Cliente ${nome} (${input.fromNumber}) pediu falar com consultor sobre ${ctx}.`,
    input.vehicle ? `Veículo (estoque): ${input.vehicle.id}` : null,
    "Ação: retornar o contato do cliente.",
  ].filter(Boolean).join("\n");
}

export const CLIENT_HANDOFF_CONFIRMATION =
  "Perfeito! Um consultor vai falar com você em instantes.";

export function brandListRows(marcas: string[]) {
  return marcas.slice(0, 10).map((marca) => ({
    id: vitrineButtonId("marca", marcaToSlug(marca)),
    title: marca.slice(0, 24),
    description: "Ver carros desta marca",
  }));
}

export function pendingIsActive(
  pending: PendingVitrineEstoque | null | undefined,
  nowMs = Date.now(),
): boolean {
  if (!pending?.updated_at) return false;
  const updated = Date.parse(pending.updated_at);
  if (!Number.isFinite(updated)) return false;
  return nowMs - updated <= 30 * 60 * 1000;
}

export function shouldEnterShowcase(input: {
  flags: VehicleShowcaseTenantFlags;
  explicitText: boolean;
  vitrineInteractiveId: string | null;
}): boolean {
  if (!shouldOfferVehicleShowcase(input.flags)) return false;
  if (input.vitrineInteractiveId) return true;
  if (!input.explicitText) return false;
  if (isAutomotiveTenant(input.flags.segmento)) return true;
  if (input.flags.vitrine_veiculos_demo) return true;
  return false;
}

export const VITRINE_CAROUSEL_PAGE_SIZE = 10;
