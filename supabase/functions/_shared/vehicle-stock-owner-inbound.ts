import { validPendingVehicleCarousel } from "./vehicle-carousel.ts";
import { validPendingVehicleIdentification } from "./vehicle-identification.ts";
import { carrosLabel, formatPosicaoMoney, mesNomePt } from "./gestao-posicao-loja.ts";
import {
  formatAno,
  formatPrecoBrl,
  isExplicitVehicleShowcaseRequest,
  type VehicleShowcaseTenantFlags,
  vehicleDisplayTitle,
  type VeiculoVitrineRow,
} from "./vehicle-stock-whatsapp.ts";
import { isVeiculoEstoqueAtivoInterno } from "./veiculo-estoque-status.ts";

export type OwnerStockRow = VeiculoVitrineRow & { created_at?: string | null };

export type OwnerStockIntent =
  | "vitrine"
  | "resumo"
  | "resumo_moto"
  | "busca"
  | "vendidos"
  | "none";

export type OwnerStockSegmentFilter = "carro" | "moto" | null;

const RESUMO_MOTO_PATTERNS = [
  /\bquantas motos\b/,
  /\bquais motos tenho\b/,
  /\bquantidade de motos\b/,
  /\bestoque de motos\b/,
  /\bmeu estoque de motos\b/,
];

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
  /\bvalor do estoque\b/,
  /\bvalor total\b.*\bestoque\b/,
  /\bpre[çc]o de cada\b/,
  /\bmarcas e modelos\b/,
  /\bquantos carros tenho no estoque\b/,
];

const VENDIDOS_PATTERNS = [
  /\bquantos vendi\b/,
  /\bquantos vendeu\b/,
  /\bveiculos vendidos\b/,
  /\bveiculos foram vendidos\b/,
  /\bcarros vendidos\b/,
  /\bcarros foram vendidos\b/,
  /\bvendas do estoque\b/,
  /\bo que vendemos\b/,
  /\bo que foi vendido\b/,
];

const GESTAO_DEFER_KEYWORDS = [
  "lucro",
  "custo",
  "margem",
  "despesa",
  "gasto",
  "parado",
  "mais tempo",
  "comissao",
  "vendedor",
  "meta",
];

function mentionsGestaoDeferTopic(text: string): boolean {
  const t = normalize(text);
  if (/\bdias\b/.test(t)) return true;
  for (const kw of GESTAO_DEFER_KEYWORDS) {
    if (t.includes(kw)) return true;
  }
  return false;
}

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

const ACTION_VERB_PATTERN =
  /\b(cria|criar|crie|faz|faca|fazer|gera|gerar|post|posta|postar|publica|publicar|anuncio|arte|story|stories|reels|video|foto|imagem|legenda|campanha|dispara|disparar|edita|editar|manda|mandar|envia|enviar|agenda|agendar|lembra|lembrete)\b/;

export function ownerStockBlockedByActionVerb(text: string): boolean {
  const value = normalize(text);
  return ACTION_VERB_PATTERN.test(value);
}

export function hasExplicitOwnerStockSearchContext(value: string): boolean {
  if (/\bestoque\b/.test(value)) return true;
  const hasHave = /\b(tenho|temos|tem)\b/.test(value);
  const hasCtx =
    /\b(algum|alguma|disponivel|no estoque|pra vender|a venda)\b/.test(value);
  return hasHave && hasCtx;
}

export function classifyOwnerStockIntent(
  text: string,
  flags: VehicleShowcaseTenantFlags,
): OwnerStockIntent {
  const value = normalize(text);
  if (!value) return "none";
  if (ownerStockBlockedByActionVerb(text)) return "none";
  if (VENDIDOS_PATTERNS.some((re) => re.test(value))) return "vendidos";
  if (RESUMO_MOTO_PATTERNS.some((re) => re.test(value))) return "resumo_moto";
  if (RESUMO_PATTERNS.some((re) => re.test(value))) return "resumo";
  if (isOwnerVitrineTextRequest(text, flags)) return "vitrine";
  if (hasExplicitOwnerStockSearchContext(value)) return "busca";
  return "none";
}

export function shouldDeferOwnerStockShortcut(input: {
  userText: string;
  hasInboundMedia: boolean;
  agentState?: Record<string, unknown> | null;
  gestaoAuthorized?: boolean;
}): boolean {
  if (input.gestaoAuthorized && mentionsGestaoDeferTopic(input.userText)) {
    return true;
  }
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

export function ownerStockSegmentFilter(text: string): OwnerStockSegmentFilter {
  const value = normalize(text);
  if (RESUMO_MOTO_PATTERNS.some((re) => re.test(value))) return "moto";
  if (/\bmotos?\b/.test(value) && !/\bcarros?\b/.test(value)) return "moto";
  if (/\bcarros?\b/.test(value) && !/\bmotos?\b/.test(value)) return "carro";
  return null;
}

export function formatOwnerStockLine(v: VeiculoVitrineRow): string {
  const km = v.km != null ? `${v.km.toLocaleString("pt-BR")} km` : "— km";
  const preco = formatPrecoBrl(v.preco);
  const status = String(v.status || "disponivel");
  const seg = v.segmento === "moto" ? "moto" : "carro";
  return `${vehicleDisplayTitle(v)} · ${formatAno(v)} · ${km} · ${preco} · ${status} · ${seg}`;
}

function ownerDisponiveisLabel(qtd: number, label: string): string {
  if (label === "Motos") {
    return qtd === 1 ? "1 moto disponível" : `${qtd} motos disponíveis`;
  }
  return qtd === 1 ? "1 carro disponível" : `${qtd} carros disponíveis`;
}

function diasNoEstoque(v: OwnerStockRow, nowMs = Date.now()): number | null {
  const created = Date.parse(String(v.created_at ?? ""));
  if (!Number.isFinite(created)) return null;
  return Math.max(0, Math.floor((nowMs - created) / 86400000));
}

export function formatOwnerStockSummary(
  disponiveis: OwnerStockRow[],
  label = "Estoque",
  nowMs = Date.now(),
): string {
  if (!disponiveis.length) {
    return label === "Motos"
      ? "Você não tem motos disponíveis no estoque agora."
      : "Você não tem veículos disponíveis no estoque agora.";
  }
  const byMarca = new Map<string, number>();
  let totalAnunciado = 0;
  let semPreco = 0;
  for (const v of disponiveis) {
    const m = String(v.marca || "Sem marca").trim();
    byMarca.set(m, (byMarca.get(m) ?? 0) + 1);
    if (v.preco != null && Number.isFinite(Number(v.preco)) && Number(v.preco) > 0) {
      totalAnunciado += Number(v.preco);
    } else {
      semPreco += 1;
    }
  }
  const sorted = [...disponiveis].sort((a, b) => {
    const pa = a.preco != null ? Number(a.preco) : -1;
    const pb = b.preco != null ? Number(b.preco) : -1;
    return pb - pa;
  });
  const maxList = 15;
  const listLines = sorted.slice(0, maxList).map((v, i) => {
    const preco = v.preco != null && Number(v.preco) > 0
      ? formatPrecoBrl(Number(v.preco))
      : "sem preço";
    const dias = diasNoEstoque(v, nowMs);
    const diasTxt = dias != null ? `${dias} ${dias === 1 ? "dia" : "dias"}` : "— dias";
    return `${i + 1}. ${vehicleDisplayTitle(v)} — ${preco} · ${diasTxt}`;
  });
  const extra = sorted.length > maxList
    ? `\n… e mais ${sorted.length - maxList}.`
    : "";
  const marcas = [...byMarca.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"))
    .map(([marca, n]) => `${marca} (${n})`)
    .join(", ");
  const lines: string[] = [
    `📦 *${label}: ${ownerDisponiveisLabel(disponiveis.length, label)}*`,
    `Valor total anunciado: ${formatPrecoBrl(totalAnunciado)}`,
    ...listLines,
  ];
  if (extra) lines.push(extra.trim());
  lines.push(`Marcas: ${marcas}.`);
  if (semPreco > 0) {
    const aviso = semPreco === 1 ? "1 sem preço" : `${semPreco} sem preço`;
    lines.push(`(${aviso} — não entram no total anunciado)`);
  }
  return lines.join("\n");
}

export type OwnerVendidosMesSnapshot = {
  periodo?: { competencia?: string; fim?: string; label?: string };
  vendas?: {
    lista?: Array<{
      data?: string;
      veiculo?: string;
      valor_venda?: number;
      vendedor?: string | null;
    }>;
    totais?: { qtd?: number; faturamento?: number };
  };
};

function formatVendaDataBr(ymd: string): string {
  const s = String(ymd).slice(0, 10);
  if (s.length < 10) return s;
  return `${s.slice(8, 10)}/${s.slice(5, 7)}`;
}

export function formatOwnerVendidosMesFromSnapshot(
  snap: OwnerVendidosMesSnapshot,
  ateDiaLabel: string,
): string {
  const lista = snap.vendas?.lista ?? [];
  const totais = snap.vendas?.totais;
  const competencia = snap.periodo?.competencia ?? "";
  const mes = competencia ? mesNomePt(competencia) : (snap.periodo?.label ?? "mês");
  const lines: string[] = [`🚗 *Vendidos — ${mes} (até ${ateDiaLabel})*`];
  if (!lista.length) {
    lines.push("Nenhuma venda registrada no período.");
    return lines.join("\n");
  }
  lista.forEach((v, i) => {
    const valor = v.valor_venda != null ? formatPosicaoMoney(Number(v.valor_venda)) : "—";
    const data = v.data ? formatVendaDataBr(v.data) : "—";
    const vend = v.vendedor ? ` · ${v.vendedor}` : "";
    lines.push(`${i + 1}. ${v.veiculo ?? "Veículo"} — ${valor} · ${data}${vend}`);
  });
  const qtd = totais?.qtd ?? lista.length;
  const fat = totais?.faturamento ?? lista.reduce(
    (a, x) => a + Number(x.valor_venda ?? 0),
    0,
  );
  lines.push(`Total: ${carrosLabel(qtd)} · ${formatPosicaoMoney(fat)}`);
  return lines.join("\n");
}

export function formatOwnerVendidosCount(count: number): string {
  if (count <= 0) return "Nenhum veículo com status vendido no estoque.";
  return `Você tem ${count} veículo(s) marcado(s) como vendido no estoque.`;
}

function searchTokens(text: string): string[] {
  const stop = new Set([
    "tenho", "tem", "quanto", "esta", "está", "preco", "preço", "valor",
    "custa", "disponivel", "disponível", "carro", "carros", "moto", "motos",
    "veiculo", "veículo", "modelo", "marca", "o", "a", "os", "as", "um", "uma",
    "no", "na", "meu", "minha", "estoque",
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
  const ativos = all.filter((v) => isVeiculoEstoqueAtivoInterno(v.status));
  const matches = rankOwnerStockMatches(text, ativos);
  if (!matches.length) {
    return "Não encontrei esse veículo no estoque ativo.";
  }
  const lines = matches.slice(0, 6).map(formatOwnerStockLine);
  const extra = matches.length > 6
    ? `\n… e mais ${matches.length - 6}.`
    : "";
  return `${lines.join("\n")}${extra}`;
}

export const OWNER_VITRINE_CLIENT_PREVIEW_MSG =
  "Isso é o que o cliente vê 🙂";
