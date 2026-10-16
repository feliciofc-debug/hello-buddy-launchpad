import { validPendingVehicleCarousel } from "./vehicle-carousel.ts";
import { validPendingVehicleIdentification } from "./vehicle-identification.ts";
import {
  formatAno,
  formatPrecoBrl,
  isExplicitVehicleShowcaseRequest,
  type VehicleShowcaseTenantFlags,
  vehicleDisplayTitle,
  type VeiculoVitrineRow,
} from "./vehicle-stock-whatsapp.ts";

export type OwnerStockIntent =
  | "vitrine"
  | "resumo"
  | "busca"
  | "vendidos"
  | "none";

function normalize(text: string): string {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/<<INTERACTIVE_ID:[^>]+>>/gi, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function ownerStockMentionsFipe(text: string): boolean {
  return /\bfipe\b/.test(normalize(text));
}

const RESUMO_PATTERNS = [
  /\bmeu estoque\b/,
  /\bquais carros tenho\b/,
  /\bquantos carros\b/,
  /\bquantidade de carros\b/,
  /\bestoque de carros\b/,
];

const VENDIDOS_PATTERNS = [
  /\bquantos vendi\b/,
  /\bquantos vendeu\b/,
  /\bveiculos vendidos\b/,
  /\bcarros vendidos\b/,
  /\bvendas do estoque\b/,
];

const VITRINE_OWNER_EXTRA = [
  /\bme mostra a vitrine\b/,
  /\bmostra a vitrine\b/,
  /\bminha vitrine\b/,
  /\bcomo o cliente ve\b/,
];

export function isOwnerVitrineTextRequest(
  text: string,
  flags: VehicleShowcaseTenantFlags,
): boolean {
  const value = normalize(text);
  if (!value) return false;
  if (VITRINE_OWNER_EXTRA.some((re) => re.test(value))) return true;
  return isExplicitVehicleShowcaseRequest(text, flags);
}

export function classifyOwnerStockIntent(
  text: string,
  flags: VehicleShowcaseTenantFlags,
): OwnerStockIntent {
  const value = normalize(text);
  if (!value) return "none";
  if (VENDIDOS_PATTERNS.some((re) => re.test(value))) return "vendidos";
  if (RESUMO_PATTERNS.some((re) => re.test(value))) return "resumo";
  if (isOwnerVitrineTextRequest(text, flags)) return "vitrine";
  if (looksLikeOwnerVehicleSearch(value)) return "busca";
  return "none";
}

function looksLikeOwnerVehicleSearch(value: string): boolean {
  if (/\b(tenho|tem|quanto|preco|valor|custa|disponivel)\b/.test(value)) {
    return true;
  }
  if (/\b(bmw|mercedes|porsche|land rover|defender|911|x6|audi|jeep|toyota|honda|fiat|vw|volkswagen)\b/.test(value)) {
    return true;
  }
  return /\b(carro|veiculo|modelo)\b/.test(value);
}

export function shouldDeferOwnerStockShortcut(input: {
  userText: string;
  hasInboundMedia: boolean;
  agentState?: Record<string, unknown> | null;
}): boolean {
  if (ownerStockMentionsFipe(input.userText)) return true;
  if (input.hasInboundMedia) return true;
  const s = input.agentState ?? {};
  if (
    s.pending_anuncio_post ||
    s.pending_anuncio_styles ||
    s.pending_anuncio_photo ||
    s.pending_anuncio_cliente
  ) {
    return true;
  }
  if (validPendingVehicleCarousel(s.pending_carrossel_veiculo as never)) {
    return true;
  }
  if (s.pending_fipe) return true;
  if (
    validPendingVehicleIdentification(
      s.pending_vehicle_identification as { created_at?: string },
    )
  ) {
    return true;
  }
  const lastFipe = s.last_fipe as { created_at?: string } | undefined;
  if (lastFipe?.created_at) {
    const age = Date.now() - Date.parse(lastFipe.created_at);
    if (Number.isFinite(age) && age <= 24 * 60 * 60 * 1000) return true;
  }
  return false;
}

export function formatOwnerStockLine(v: VeiculoVitrineRow): string {
  const km = v.km != null ? `${v.km.toLocaleString("pt-BR")} km` : "— km";
  const preco = formatPrecoBrl(v.preco);
  const status = String(v.status || "disponivel");
  return `${vehicleDisplayTitle(v)} · ${formatAno(v)} · ${km} · ${preco} · ${status}`;
}

export function formatOwnerStockSummary(
  disponiveis: VeiculoVitrineRow[],
): string {
  if (!disponiveis.length) {
    return "Você não tem veículos disponíveis no estoque agora.";
  }
  const byMarca = new Map<string, number>();
  let minP: number | null = null;
  let maxP: number | null = null;
  for (const v of disponiveis) {
    const m = String(v.marca || "Sem marca").trim();
    byMarca.set(m, (byMarca.get(m) ?? 0) + 1);
    if (v.preco != null && Number.isFinite(Number(v.preco))) {
      const p = Number(v.preco);
      minP = minP == null ? p : Math.min(minP, p);
      maxP = maxP == null ? p : Math.max(maxP, p);
    }
  }
  const marcas = [...byMarca.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"))
    .map(([marca, n]) => `${marca} (${n})`)
    .join(", ");
  const faixa = minP != null && maxP != null
    ? `${formatPrecoBrl(minP)} – ${formatPrecoBrl(maxP)}`
    : "sem preços cadastrados";
  return [
    `📦 Estoque: ${disponiveis.length} disponível(is).`,
    `Marcas: ${marcas}.`,
    `Faixa de preço: ${faixa}.`,
  ].join("\n");
}

export function formatOwnerVendidosCount(count: number): string {
  if (count <= 0) return "Nenhum veículo com status vendido no estoque.";
  return `Você tem ${count} veículo(s) marcado(s) como vendido no estoque.`;
}

function searchTokens(text: string): string[] {
  const stop = new Set([
    "tenho", "tem", "quanto", "esta", "está", "preco", "preço", "valor",
    "custa", "disponivel", "disponível", "carro", "carros", "veiculo",
    "veículo", "modelo", "marca", "o", "a", "os", "as", "um", "uma", "no",
    "na", "meu", "minha", "estoque",
  ]);
  return normalize(text)
    .split(" ")
    .filter((t) => t.length >= 2 && !stop.has(t));
}

export function rankOwnerStockMatches(
  text: string,
  rows: VeiculoVitrineRow[],
): VeiculoVitrineRow[] {
  const tokens = searchTokens(text);
  if (!tokens.length) return rows.slice(0, 8);
  const scored = rows.map((row) => {
    const hay = normalize(
      `${row.marca} ${row.modelo} ${row.versao ?? ""} ${row.descricao ?? ""}`,
    );
    let score = 0;
    for (const t of tokens) {
      if (hay.includes(t)) score += t.length >= 4 ? 3 : 2;
    }
    if (normalize(row.modelo).includes(tokens.join(" "))) score += 5;
    return { row, score };
  });
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || String(a.row.marca).localeCompare(String(b.row.marca)))
    .map((s) => s.row)
    .slice(0, 8);
}

export function formatOwnerStockSearchReply(
  text: string,
  all: VeiculoVitrineRow[],
): string {
  const disponiveis = all.filter((v) => v.status === "disponivel");
  const matches = rankOwnerStockMatches(text, disponiveis);
  if (!matches.length) {
    return "Não encontrei esse veículo no estoque disponível.";
  }
  const lines = matches.slice(0, 6).map(formatOwnerStockLine);
  const extra = matches.length > 6
    ? `\n… e mais ${matches.length - 6}.`
    : "";
  return `${lines.join("\n")}${extra}`;
}

export const OWNER_VITRINE_CLIENT_PREVIEW_MSG =
  "Isso é o que o cliente vê 🙂";
