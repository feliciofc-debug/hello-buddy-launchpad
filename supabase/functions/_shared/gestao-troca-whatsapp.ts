import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { formatGestaoMoney } from "./gestao-format.ts";
import {
  gestaoTrocaFotoIsCrlv,
  normalizeGestaoTrocaFotos,
  type GestaoTrocaFotoEntry,
} from "./gestao-troca-fotos.ts";
import {
  isGestaoAuthorizedPhone,
  loadGestaoAuthContext,
  type GestaoAuthContext,
} from "./gestao-auth-phone.ts";
import { ownerPhoneVariants } from "./owner-phone.ts";
import { buildGestaoTrocaLaudoWhatsappPdfBytes } from "./gestao-troca-laudo-whatsapp-pdf.ts";
import { loadLatestGestaoTrocaAnalise } from "./gestao-troca-ia-ops.ts";
import { vehiclePostFipeTrocaGuide } from "./vehicle-post-fipe-menu.ts";

export const GESTAO_TROCA_WA_PREFIX = "gestao_troca_wa:";

const TROCAS_BUCKET = "trocas";
const SIGNED_TTL_SEC = 60 * 60 * 24;
const MAX_LIST = 10;
const MAX_PHOTOS = 6;
const MAX_APONTAMENTOS = 5;

const PHOTO_PRIORITY = [
  "Frente",
  "Traseira",
  "Lateral esquerda",
  "Lateral direita",
  "Painel ligado (km)",
  "Motor",
];

export type GestaoTrocaWaFilter = {
  placa?: string;
  modelHint?: string;
  period?: "today" | "week";
};

export type GestaoTrocaWaDelivery =
  | { kind: "text"; text: string }
  | { kind: "document"; url: string; filename: string; caption?: string }
  | { kind: "image"; url: string; caption?: string };

export type GestaoTrocaWaResult = {
  handled: boolean;
  reply?: string;
  interactiveList?: {
    body: string;
    button: string;
    section_title: string;
    rows: { id: string; title: string; description: string }[];
  };
  interactiveButtons?: {
    body: string;
    buttons: { id: string; title: string }[];
  };
  deliveries?: GestaoTrocaWaDelivery[];
};

type TrocaRow = Record<string, unknown>;

function normalizeText(value: string): string {
  return String(value || "").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function gestaoTrocaWaInteractiveId(action: string): string {
  return `${GESTAO_TROCA_WA_PREFIX}${action}`;
}

export function parseGestaoTrocaWaInteractiveId(text: string): string | null {
  const match = String(text || "").match(
    /<<INTERACTIVE_ID:gestao_troca_wa:([^>]+)>>/i,
  );
  return match?.[1]?.trim() || null;
}

export function classifyGestaoTrocaWhatsAppIntent(text: string): {
  matches: boolean;
  filter: GestaoTrocaWaFilter;
} {
  const t = normalizeText(text);
  const filter: GestaoTrocaWaFilter = {};

  const placaMatch = text.match(
    /\b([A-Z]{3}\d[A-Z0-9]\d{2})\b/i,
  ) ?? text.match(/\bplaca\s+([A-Z0-9-]{7,8})\b/i);
  if (placaMatch?.[1]) {
    filter.placa = placaMatch[1].replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  }

  const laudoModelo = t.match(
    /laudo\s+(?:da|do|de)\s+([a-z0-9][a-z0-9\s-]{2,40})/,
  );
  if (laudoModelo?.[1]) {
    filter.modelHint = laudoModelo[1].trim();
  }

  if (/\bhoje\b/.test(t)) filter.period = "today";
  else if (/\b(semana|ultimos?\s*7)\b/.test(t)) filter.period = "week";

  const matches = !!parseGestaoTrocaWaInteractiveId(text) ||
    /\btrocas?\s+avaliadas?\b/.test(t) ||
    /\bveiculo\s+analisad[oa]\s+(?:na\s+)?troca\b/.test(t) ||
    /\bpassou\s+por\s+vistoria\b/.test(t) ||
    /\bvistoria\s+(?:na\s+)?troca\b/.test(t) ||
    /\blaudo\s+(?:da|do|de)\s+/i.test(text) ||
    /\bo\s+que\s+passou\s+por\s+vistoria\b/.test(t) ||
    (/\btroca\b/.test(t) && /\b(vistoria|laudo|avaliad)/.test(t));

  return { matches, filter };
}

async function loadTeamPhoneVariants(
  sb: SupabaseClient,
  userId: string,
): Promise<Set<string>> {
  const { data } = await sb.from("gestao_vendedores")
    .select("whatsapp_e164, is_gerente, ativo")
    .eq("user_id", userId)
    .eq("ativo", true);
  const out = new Set<string>();
  for (const row of data ?? []) {
    const phone = String((row as { whatsapp_e164?: string }).whatsapp_e164 ?? "")
      .trim();
    if (!phone) continue;
    for (const v of ownerPhoneVariants(phone)) out.add(v);
  }
  return out;
}

export async function isGestaoTrocaWhatsAppAuthorized(
  sb: SupabaseClient,
  userId: string,
  fromNumber: string,
  auth?: GestaoAuthContext,
): Promise<boolean> {
  const ctx = auth ?? await loadGestaoAuthContext(sb, userId);
  if (isGestaoAuthorizedPhone(fromNumber, ctx)) return true;
  const team = await loadTeamPhoneVariants(sb, userId);
  for (const v of ownerPhoneVariants(fromNumber)) {
    if (team.has(v)) return true;
  }
  return false;
}

export function gestaoTrocaWaNeutralReply(): string {
  return "Posso ajudar com informações gerais da loja. Para assuntos internos, use o número autorizado da equipe.";
}

function isTrocaAvaliada(row: TrocaRow): boolean {
  const laudo = String(row.laudo_status ?? "");
  if (laudo === "finalizado") return true;
  if (row.semaforo === "verde" || row.semaforo === "amarelo" || row.semaforo === "vermelho") {
    return true;
  }
  const st = String(row.status ?? "");
  return st === "aguardando_aprovacao" || st === "aprovada" || st === "fechada";
}

function semaforoRotulo(semaforo: unknown): string {
  if (semaforo === "verde") return "🟢 Verde";
  if (semaforo === "amarelo") return "🟡 Amarelo";
  if (semaforo === "vermelho") return "🔴 Vermelho";
  return "⚪ Sem semáforo";
}

function formatTrocaData(iso: unknown): string {
  const s = String(iso ?? "");
  if (!s) return "—";
  try {
    return new Date(s).toLocaleDateString("pt-BR", {
      timeZone: "America/Sao_Paulo",
    });
  } catch {
    return s.slice(0, 10);
  }
}

function trocaTitulo(row: TrocaRow): string {
  const marca = String(row.marca ?? "").trim();
  const modelo = String(row.modelo ?? "").trim();
  const ano = row.ano_modelo ?? row.ano_fabricacao;
  const anoTxt = ano != null ? String(ano) : "";
  const base = `${marca} ${modelo}`.trim() || "Veículo";
  return anoTxt ? `${base} ${anoTxt}`.trim().slice(0, 24) : base.slice(0, 24);
}

function trocaDescricaoLista(row: TrocaRow): string {
  const placa = String(row.placa ?? "—").trim() || "—";
  const sem = semaforoRotulo(row.semaforo).replace("⚪ Sem semáforo", "—");
  const data = formatTrocaData(row.updated_at ?? row.created_at);
  return `${placa} · ${sem} · ${data}`.slice(0, 72);
}

function periodStart(filter: GestaoTrocaWaFilter): string | null {
  if (!filter.period) return null;
  const now = new Date();
  if (filter.period === "today") {
    const sp = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    sp.setHours(0, 0, 0, 0);
    return sp.toISOString();
  }
  const week = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  return week.toISOString();
}

export async function fetchGestaoTrocaWaCandidates(
  sb: SupabaseClient,
  userId: string,
  filter: GestaoTrocaWaFilter,
): Promise<TrocaRow[]> {
  let q = sb.from("gestao_troca")
    .select(
      "id, user_id, placa, marca, modelo, ano_fabricacao, ano_modelo, km, cor, status, semaforo, laudo_status, laudo_numero, valor_sugerido, teto, created_at, updated_at, fotos_json",
    )
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(50);

  const since = periodStart(filter);
  if (since) q = q.gte("updated_at", since);

  const { data } = await q;
  let rows = (data ?? []) as TrocaRow[];
  rows = rows.filter(isTrocaAvaliada);

  if (filter.placa) {
    const p = filter.placa.replace(/[^A-Z0-9]/gi, "").toUpperCase();
    rows = rows.filter((r) =>
      String(r.placa ?? "").replace(/[^A-Z0-9]/gi, "").toUpperCase().includes(p)
    );
  }
  if (filter.modelHint) {
    const hint = normalizeText(filter.modelHint);
    rows = rows.filter((r) => {
      const blob = normalizeText(`${r.marca} ${r.modelo}`);
      return blob.includes(hint) || hint.split(/\s+/).every((w) => blob.includes(w));
    });
  }

  return rows.slice(0, MAX_LIST);
}

export function buildGestaoTrocaWaListInteractive(
  rows: TrocaRow[],
): GestaoTrocaWaResult["interactiveList"] {
  if (!rows.length) {
    return undefined;
  }
  return {
    body: "Escolha a troca para ver o resumo e o laudo:",
    button: "Ver trocas",
    section_title: "Trocas avaliadas",
    rows: rows.map((row) => ({
      id: gestaoTrocaWaInteractiveId(`pick:${String(row.id)}`),
      title: trocaTitulo(row),
      description: trocaDescricaoLista(row),
    })),
  };
}

function appBaseUrl(): string {
  return (Deno.env.get("APP_URL") ||
    Deno.env.get("PUBLIC_SITE_URL") ||
    Deno.env.get("SITE_URL") ||
    "https://hello-buddy-launchpad.lovable.app").replace(/\/$/, "");
}

function panelTrocaUrl(trocaId: string): string {
  return `${appBaseUrl()}/gestao/trocas/${trocaId}`;
}

function selectWhatsappPhotos(fotos: GestaoTrocaFotoEntry[]): GestaoTrocaFotoEntry[] {
  const safe = fotos.filter((f) => !gestaoTrocaFotoIsCrlv(f));
  const picked: GestaoTrocaFotoEntry[] = [];
  const used = new Set<string>();
  for (const label of PHOTO_PRIORITY) {
    const hit = safe.find((f) =>
      f.etiqueta === label || String(f.slot ?? "") === label.toLowerCase()
    );
    if (hit && !used.has(hit.path)) {
      picked.push(hit);
      used.add(hit.path);
    }
    if (picked.length >= MAX_PHOTOS) break;
  }
  for (const f of safe) {
    if (picked.length >= MAX_PHOTOS) break;
    if (!used.has(f.path)) {
      picked.push(f);
      used.add(f.path);
    }
  }
  return picked;
}

async function signedStorageUrl(
  sb: SupabaseClient,
  path: string,
): Promise<string | null> {
  const clean = String(path || "").trim();
  if (!clean) return null;
  const { data, error } = await sb.storage.from(TROCAS_BUCKET)
    .createSignedUrl(clean, SIGNED_TTL_SEC);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

function topApontamentos(itens: Record<string, unknown>[]): string[] {
  return itens
    .filter((i) => String(i.decisao) === "confirmado")
    .slice(0, MAX_APONTAMENTOS)
    .map((i) => {
      const area = String(i.area ?? "").trim();
      const desc = String(i.descricao ?? i.tipo ?? "").trim();
      return area && desc ? `${area}: ${desc}` : (desc || area);
    })
    .filter(Boolean);
}

function trocaPdfMoneyLine(label: string, value: unknown): string | null {
  if (value == null) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return `${label}: ${formatGestaoMoney(n)}`;
}

/** Linhas do PDF WhatsApp (exportado para testes — somente leitura). */
export function pdfLinesFromTroca(
  troca: TrocaRow,
  apontamentos: string[],
  laudoNumero: string | null,
): string[] {
  const lines: string[] = ["Laudo de troca — uso interno"];
  if (laudoNumero) lines.push(`Número: ${laudoNumero}`);
  const titulo = `${String(troca.marca ?? "")} ${String(troca.modelo ?? "")}`.trim();
  if (titulo) lines.push(titulo);
  const placa = String(troca.placa ?? "").trim();
  if (placa) lines.push(`Placa: ${placa}`);
  const ano = troca.ano_modelo ?? troca.ano_fabricacao;
  if (ano != null && String(ano).trim()) lines.push(`Ano: ${String(ano).trim()}`);
  if (troca.km != null && Number.isFinite(Number(troca.km))) {
    lines.push(`KM: ${Number(troca.km).toLocaleString("pt-BR")}`);
  }
  const cor = String(troca.cor ?? "").trim();
  if (cor) lines.push(`Cor: ${cor}`);
  lines.push(`Resultado: ${semaforoRotulo(troca.semaforo)}`);
  const sugerido = trocaPdfMoneyLine("Valor sugerido", troca.valor_sugerido);
  if (sugerido) lines.push(sugerido);
  const teto = trocaPdfMoneyLine("Teto", troca.teto);
  if (teto) lines.push(teto);
  lines.push("");
  lines.push("Principais apontamentos:");
  lines.push(
    ...(apontamentos.length ? apontamentos : ["Nenhum item confirmado no laudo."]),
  );
  return lines;
}

async function uploadLaudoPdf(
  sb: SupabaseClient,
  userId: string,
  trocaId: string,
  bytes: Uint8Array,
): Promise<string | null> {
  const path = `${userId}/_wa_exports/${trocaId}-laudo.pdf`;
  const { error } = await sb.storage.from(TROCAS_BUCKET).upload(path, bytes, {
    contentType: "application/pdf",
    upsert: true,
  });
  if (error) return null;
  return signedStorageUrl(sb, path);
}

export async function buildGestaoTrocaWaPickDeliveries(
  sb: SupabaseClient,
  userId: string,
  trocaId: string,
): Promise<GestaoTrocaWaResult> {
  const { data: troca } = await sb.from("gestao_troca")
    .select("*")
    .eq("user_id", userId)
    .eq("id", trocaId)
    .maybeSingle();
  if (!troca?.id) {
    return { handled: true, reply: "Não encontrei essa troca na sua loja." };
  }

  const row = troca as TrocaRow;
  const { analise, itens } = await loadLatestGestaoTrocaAnalise(sb, userId, trocaId);
  const apontamentos = topApontamentos(itens);
  const laudoFinal = String(row.laudo_status ?? "") === "finalizado";
  const fichaUrl = panelTrocaUrl(trocaId);

  const summaryLines = [
    `*${trocaTitulo(row)}*`,
    `Placa: ${String(row.placa ?? "—")}`,
    `KM: ${row.km != null ? Number(row.km).toLocaleString("pt-BR") : "—"}`,
    `Cor: ${String(row.cor ?? "—")}`,
    `Resultado: ${semaforoRotulo(row.semaforo)}`,
    apontamentos.length
      ? `Apontamentos:\n${apontamentos.map((a) => `• ${a}`).join("\n")}`
      : "",
    row.valor_sugerido != null
      ? `Valor sugerido: ${formatGestaoMoney(Number(row.valor_sugerido))}`
      : "",
    row.teto != null ? `Teto: ${formatGestaoMoney(Number(row.teto))}` : "",
  ].filter(Boolean);

  const deliveries: GestaoTrocaWaDelivery[] = [{
    kind: "text",
    text: summaryLines.join("\n"),
  }];

  if (!laudoFinal && !analise) {
    deliveries.push({
      kind: "text",
      text:
        `Avaliação sem laudo gerado. Abra a ficha no painel:\n${fichaUrl}`,
    });
    return { handled: true, deliveries };
  }

  if (!laudoFinal) {
    deliveries.push({
      kind: "text",
      text:
        `Avaliação sem laudo finalizado. Veja a ficha no painel:\n${fichaUrl}`,
    });
  }

  const pdfLines = pdfLinesFromTroca(
    row,
    apontamentos,
    row.laudo_numero != null ? String(row.laudo_numero) : null,
  );
  if (analise?.resumo_laudo && typeof analise.resumo_laudo === "string") {
    pdfLines.push("", String(analise.resumo_laudo).slice(0, 2000));
  }

  try {
    const bytes = await buildGestaoTrocaLaudoWhatsappPdfBytes(pdfLines);
    const docUrl = await uploadLaudoPdf(sb, userId, trocaId, bytes);
    if (docUrl) {
      deliveries.push({
        kind: "document",
        url: docUrl,
        filename: `laudo-troca-${String(row.placa ?? trocaId).slice(0, 12)}.pdf`,
        caption: laudoFinal ? "Laudo da troca (PDF)" : "Pré-laudo / resumo (PDF)",
      });
    }
  } catch {
    /* PDF opcional — resumo textual já foi enviado */
  }

  const fotos = selectWhatsappPhotos(normalizeGestaoTrocaFotos(row.fotos_json));
  for (const foto of fotos) {
    const url = await signedStorageUrl(sb, foto.path);
    if (!url) continue;
    deliveries.push({
      kind: "image",
      url,
      caption: foto.etiqueta?.slice(0, 60),
    });
  }

  return { handled: true, deliveries };
}

export function vehiclePhotoTrocaMenuButtons(): GestaoTrocaWaResult["interactiveButtons"] {
  return {
    body: `${vehiclePostFipeTrocaGuide()}\n\nToque abaixo para ver trocas já avaliadas:`,
    buttons: [
      {
        id: gestaoTrocaWaInteractiveId("list_recent"),
        title: "Ver trocas avaliadas",
      },
    ],
  };
}

export async function tryProcessGestaoTrocaWhatsAppInbound(input: {
  sb: SupabaseClient;
  userId: string;
  fromNumber: string;
  userText: string;
  fromIsOwner: boolean;
}): Promise<GestaoTrocaWaResult> {
  const interactive = parseGestaoTrocaWaInteractiveId(input.userText);
  const { matches, filter } = classifyGestaoTrocaWhatsAppIntent(input.userText);

  if (!interactive && !matches) return { handled: false };

  const authorized = await isGestaoTrocaWhatsAppAuthorized(
    input.sb,
    input.userId,
    input.fromNumber,
  );

  if (!authorized) {
    if (input.fromIsOwner) {
      return { handled: true, reply: gestaoTrocaWaNeutralReply() };
    }
    return { handled: true, reply: gestaoTrocaWaNeutralReply() };
  }

  if (interactive === "list_recent" || interactive?.startsWith("list")) {
    const rows = await fetchGestaoTrocaWaCandidates(input.sb, input.userId, filter);
    const list = buildGestaoTrocaWaListInteractive(rows);
    if (!list) {
      return {
        handled: true,
        reply: "Nenhuma troca avaliada nesse período.",
      };
    }
    return {
      handled: true,
      reply: list.body,
      interactiveList: list,
    };
  }

  const pickMatch = interactive?.match(/^pick:([0-9a-f-]{36})$/i);
  if (pickMatch?.[1]) {
    return await buildGestaoTrocaWaPickDeliveries(
      input.sb,
      input.userId,
      pickMatch[1],
    );
  }

  if (matches) {
    const rows = await fetchGestaoTrocaWaCandidates(input.sb, input.userId, filter);
    const list = buildGestaoTrocaWaListInteractive(rows);
    if (!list) {
      return {
        handled: true,
        reply: "Nenhuma troca avaliada nesse período.",
      };
    }
    return {
      handled: true,
      reply: list.body,
      interactiveList: list,
    };
  }

  return { handled: false };
}
