// WhatsApp Cloud — Inbound Processor (Fase 1.2 — Pietro Multimodal)
// Modo AMZ: reconhece Felicio (dono), filtra clientes AMZ, lê imagens e áudios.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { decode as base64Decode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { buildSystemPrompt, ADMIN_AMZ_USER_ID } from "../_shared/agent-soul.ts";
import { buildAmzContext, STRANGER_MSG, OWNER_PHONE } from "../_shared/amz-context.ts";
import { downloadAllMedia, type MediaExtract } from "../_shared/whatsapp-media.ts";
import { extractDocumentText } from "../_shared/document-extract.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

// ============================================================
// FEATURE 2 — Roteamento de modelo por tipo de tarefa
// ============================================================
// FAST = conversa normal (rápido/barato). DEEP = raciocínio pesado
// (documento, código, multimodal). Decisão é pelo TIPO de fluxo,
// nunca por heurística de palavra-chave no conteúdo.
const MODEL_FAST = "google/gemini-2.5-flash";
const MODEL_DEEP = "google/gemini-2.5-pro";

type TaskContext = {
  kind: "conversation" | "document" | "multimodal";
};

function escolherModelo(ctx: TaskContext): string {
  const model = (ctx.kind === "document" || ctx.kind === "multimodal") ? MODEL_DEEP : MODEL_FAST;
  console.log(`[model-router] kind=${ctx.kind} → ${model}`);
  return model;
}
const WHATSAPP_PERMANENT_TOKEN = Deno.env.get("WHATSAPP_PERMANENT_TOKEN");
const WHATSAPP_TEST_ACCESS_TOKEN = Deno.env.get("WHATSAPP_TEST_ACCESS_TOKEN");

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

type QueueRow = {
  id: string;
  wamid: string;
  user_id: string | null;
  phone_number_id: string;
  from_number: string;
  message_type: string | null;
  payload: any;
  status: string;
  attempts: number;
};

async function failQueue(id: string, error: string) {
  await sb
    .from("whatsapp_cloud_inbound_queue")
    .update({ status: "failed", error, processed_at: new Date().toISOString() })
    .eq("id", id);
}

async function doneQueue(id: string) {
  await sb
    .from("whatsapp_cloud_inbound_queue")
    .update({ status: "done", processed_at: new Date().toISOString(), error: null })
    .eq("id", id);
}

function extractText(payload: any): string {
  if (!payload) return "";
  if (payload.text?.body) return payload.text.body;
  if (payload.button?.text) return payload.button.text;
  if (payload.interactive?.button_reply?.title) return payload.interactive.button_reply.title;
  if (payload.interactive?.list_reply?.title) return payload.interactive.list_reply.title;
  if (payload.image?.caption) return payload.image.caption;
  if (payload.video?.caption) return payload.video.caption;
  if (payload.document?.caption) return payload.document.caption;
  return "";
}

function buildUserContent(userText: string, media: MediaExtract[]): any {
  if (media.length === 0) return userText || "(mensagem sem texto)";
  const hasAudio = media.some((m) => m.kind === "audio");
  const hasImage = media.some((m) => m.kind === "image");
  let preface = userText;
  if (!preface) {
    if (hasAudio && hasImage) preface = "O usuário mandou um áudio e uma imagem. ESCUTE o áudio, VEJA a imagem e responda ao que ele pede — não cumprimente sem responder.";
    else if (hasAudio) preface = "O usuário mandou um ÁUDIO de voz. ESCUTE o áudio, entenda o que ele está pedindo e RESPONDA à pergunta dele. Não responda só 'oi' — responda o conteúdo do áudio.";
    else if (hasImage) preface = "O usuário mandou uma imagem/print. ANALISE a imagem e comente/responda baseado no que você vê.";
    else preface = `[o usuário mandou ${media.length} mídia(s)]`;
  } else if (hasAudio) {
    preface = `${userText}\n\n(o usuário também mandou um áudio — ESCUTE e responda ao conteúdo dele)`;
  }
  const parts: any[] = [{ type: "text", text: preface }];
  for (const m of media) {
    if (m.kind === "image") {
      parts.push({ type: "image_url", image_url: { url: `data:${m.mime};base64,${m.base64}` } });
    } else if (m.kind === "audio") {
      const format = m.mime.includes("ogg") ? "ogg"
        : m.mime.includes("mpeg") || m.mime.includes("mp3") ? "mp3"
        : m.mime.includes("wav") ? "wav"
        : m.mime.includes("m4a") || m.mime.includes("mp4") ? "m4a" : "ogg";
      parts.push({ type: "input_audio", input_audio: { data: m.base64, format } });
    }
  }
  return parts;
}

// ============ TOOLS DO PIETRO ============

const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY");
const GOOGLE_CX = Deno.env.get("GOOGLE_CX");
const SERPAPI_KEY = Deno.env.get("SERPAPI_KEY");
const GOOGLE_REFERER = (Deno.env.get("APP_URL") || "https://hello-buddy-launchpad.lovable.app/").replace(/\/?$/, "/");

type SearchItem = {
  titulo?: string;
  link?: string;
  resumo?: string;
  fonte?: string;
  data?: string | null;
  consulta?: string;
  score?: number;
  conteudo_extraido?: string;
};

const SEARCH_STOPWORDS = new Set([
  "para", "pra", "por", "com", "sem", "uma", "um", "uns", "umas", "dos", "das", "que", "qual", "quais", "como",
  "onde", "quando", "agora", "hoje", "amanha", "sobre", "depois", "encontre", "encontrar", "pesquisa", "pesquisar",
  "busca", "buscar", "google", "internet", "jarvis", "felicio", "instrucoes", "instrucao", "enquanto", "daqui",
]);

function currentMonthYearPt(): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", month: "long", year: "numeric" }).format(new Date());
}

function compactSpaces(text: string): string {
  return (text || "").replace(/\s+/g, " ").trim();
}

function cleanSearchQuery(query: string): string {
  return compactSpaces((query || "")
    .replace(/^jarvis[,\s]*/i, "")
    .replace(/\b(depois\s+te\s+dou\s+mais\s+instru[cç][oõ]es|por\s+enquanto|aguarde\s+um\s+instante)\b/gi, " ")
    .replace(/\b(procura|procurar|busca|buscar|pesquisa|pesquisar|consulta|consulte)\s+(no\s+google\s+|na\s+internet\s+|na\s+web\s+)?/gi, " "))
    .slice(0, 320);
}

function searchTokens(text: string): string[] {
  return normalizePt(text)
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !SEARCH_STOPWORDS.has(w))
    .slice(0, 24);
}

function isLodgingQuery(query: string): boolean {
  const t = normalizePt(query);
  return /\b(pousada|pousadas|hotel|hoteis|hostel|resort|hospedagem|hospedar|diaria|diarias|booking|tripadvisor|luxo|alto padrao|5 estrelas|cinco estrelas)\b/.test(t);
}

function isLiveTrafficQuery(query: string): boolean {
  const t = normalizePt(query);
  return /\b(transito|trafego|engarrafamento|rota|waze|acidente|interdicao|bloqueio)\b/.test(t);
}

function extractDestinationFromQuery(query: string): string | null {
  const cleaned = compactSpaces(query.replace(/[?!.,;]+/g, " "));
  const matches = [...cleaned.matchAll(/\b(?:em|para|pra|no|na|nos|nas)\s+([\p{L}][\p{L}'-]+(?:\s+(?:de|do|da|dos|das|d'|[\p{L}][\p{L}'-]+)){0,4})/giu)];
  const bad = /^(daqui|hoje|amanha|depois|enquanto|adultos?|criancas?|pessoas?|dias?|semana|mes|ano|google|internet|web)\b/i;
  const picked = matches
    .map((m) => compactSpaces(m[1]))
    .filter((v) => v.length >= 4 && !bad.test(normalizePt(v)))
    .sort((a, b) => b.length - a.length)[0];
  return picked || null;
}

function extractTravelParty(query: string): string {
  const t = normalizePt(query);
  const parts: string[] = [];
  const adults = t.match(/(\d+)\s*adultos?/);
  const kids = t.match(/(\d+)\s*(crianca|criancas|filho|filhos)/);
  if (adults) parts.push(`${adults[1]} adultos`);
  if (kids) parts.push(`${kids[1]} criança${kids[1] === "1" ? "" : "s"}`);
  return parts.join(" ");
}

function extractRelativeDateHint(query: string): string {
  const t = normalizePt(query);
  const m = t.match(/daqui\s+(\d{1,2})\s+dias?/);
  if (!m) return "";
  const d = new Date();
  d.setDate(d.getDate() + Number(m[1]));
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "long", year: "numeric" }).format(d);
}

function buildSearchVariants(query: string, recencia?: string): string[] {
  const base = cleanSearchQuery(query);
  const variants = new Set<string>();
  const monthYear = currentMonthYearPt();
  const dateHint = extractRelativeDateHint(base);
  const party = extractTravelParty(base);
  const destination = extractDestinationFromQuery(base);

  if (isLodgingQuery(base)) {
    const dest = destination || base;
    const tail = compactSpaces([party, dateHint || monthYear].filter(Boolean).join(" "));
    variants.add(compactSpaces(`${dest} pousada hotel boutique luxo alto padrão piscina ${tail}`));
    variants.add(compactSpaces(`site:booking.com ${dest} pousada hotel ${tail}`));
    variants.add(compactSpaces(`site:tripadvisor.com.br ${dest} pousadas hotéis luxo`));
    variants.add(compactSpaces(`${dest} melhores pousadas luxo hospedagem alto padrão`));
  } else if (isLiveTrafficQuery(base)) {
    variants.add(compactSpaces(`${base} trânsito agora ${monthYear}`));
    variants.add(compactSpaces(`${base} situação do trânsito ao vivo hoje`));
    variants.add(compactSpaces(`${base} acidente interdição congestionamento hoje`));
  } else {
    variants.add(base);
    if (recencia === "d" || /\b(hoje|agora|atual|recente|ultimas|noticias)\b/.test(normalizePt(base))) {
      variants.add(compactSpaces(`${base} ${monthYear}`));
      variants.add(compactSpaces(`${base} últimas notícias hoje`));
    }
  }

  return Array.from(variants).filter(Boolean).slice(0, 4);
}

function scoreSearchItem(item: SearchItem, query: string): number {
  const hayTitle = normalizePt(item.titulo || "");
  const haySnippet = normalizePt(`${item.resumo || ""} ${item.fonte || ""}`);
  const tokens = searchTokens(query);
  let score = 0;
  for (const token of tokens) {
    if (hayTitle.includes(token)) score += 3;
    if (haySnippet.includes(token)) score += 1.2;
  }
  const source = normalizePt(item.fonte || item.link || "");
  if (/booking|tripadvisor|google|hoteis|expedia|kayak|trivago|melhoresdestinos|guiaviajarmelhor/.test(source)) score += 2;
  if (item.data) score += 0.8;
  if (isLodgingQuery(query)) {
    const all = `${hayTitle} ${haySnippet}`;
    if (/\b(pousada|hotel|hoteis|hospedagem|resort|suite|chale|boutique|luxo|piscina|diaria|booking|tripadvisor)\b/.test(all)) score += 4;
    if (/\b(papelaria|papelarias|imobiliaria|concurso|edital|prefeitura|camara municipal)\b/.test(all)) score -= 8;
  }
  return Number(score.toFixed(2));
}

function dedupeAndRankSearchItems(items: SearchItem[], query: string): SearchItem[] {
  const seen = new Set<string>();
  const filtered: SearchItem[] = [];
  for (const item of items) {
    const link = item.link || "";
    const key = link.replace(/[#?].*$/, "").replace(/\/$/, "").toLowerCase() || normalizePt(`${item.titulo} ${item.fonte}`);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const score = scoreSearchItem(item, query);
    if (isLodgingQuery(query) && score < 2) continue;
    filtered.push({ ...item, score });
  }
  return filtered.sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 12);
}

async function googleCustomSearchItems(query: string, recencia?: string): Promise<SearchItem[]> {
  if (!GOOGLE_API_KEY || !GOOGLE_CX) return [];
  const params = new URLSearchParams({
    key: GOOGLE_API_KEY,
    cx: GOOGLE_CX,
    q: query,
    num: "10",
    hl: "pt-BR",
    gl: "br",
    lr: "lang_pt",
    safe: "off",
  });
  const r2 = (recencia || "").toLowerCase().trim();
  if (["d", "w", "m", "y"].includes(r2)) params.set("dateRestrict", `${r2}1`);
  const url = `https://www.googleapis.com/customsearch/v1?${params.toString()}`;
  const r = await fetch(url, { headers: googleApiHeaders(), signal: AbortSignal.timeout(12000) });
  if (!r.ok) {
    const detalhe = await r.text().catch(() => "");
    console.error("[pietro][pesquisar_web] falhou", r.status, detalhe.slice(0, 300));
    return [];
  }
  const d = await r.json();
  return (d.items ?? []).map((it: any) => ({
    titulo: it.title,
    link: it.link,
    resumo: it.snippet,
    fonte: it.displayLink,
    data: it.pagemap?.metatags?.[0]?.["article:published_time"] || it.pagemap?.metatags?.[0]?.["og:updated_time"] || null,
    consulta: query,
  }));
}

function googleApiHeaders(): HeadersInit {
  return {
    "Referer": GOOGLE_REFERER,
    "Origin": GOOGLE_REFERER.replace(/\/$/, ""),
    "User-Agent": "amz-jarvis/1.0",
  };
}

async function toolPesquisarWebSerpApi(query: string, recencia?: string): Promise<string | null> {
  if (!SERPAPI_KEY) return null;
  const params = new URLSearchParams({
    engine: "google",
    q: query,
    google_domain: "google.com.br",
    gl: "br",
    hl: "pt-br",
    num: "8",
    api_key: SERPAPI_KEY,
  });
  const r2 = (recencia || "").toLowerCase().trim();
  if (["d", "w", "m", "y"].includes(r2)) params.set("tbs", `qdr:${r2}`);

  const r = await fetch(`https://serpapi.com/search.json?${params.toString()}`, { signal: AbortSignal.timeout(12000) });
  if (!r.ok) {
    const detalhe = await r.text().catch(() => "");
    console.error("[pietro][pesquisar_web][serpapi] falhou", r.status, detalhe.slice(0, 400));
    return JSON.stringify({ erro: `busca fallback falhou (${r.status})`, detalhe: detalhe.slice(0, 400) });
  }
  const d = await r.json();
  const items = (d.organic_results ?? []).slice(0, 8).map((it: any) => ({
    titulo: it.title,
    link: it.link,
    resumo: it.snippet,
    fonte: it.displayed_link || it.source,
    data: it.date || null,
    consulta: query,
  }));
  return JSON.stringify({ query, recencia: recencia || "qualquer", fonte_busca: "Google via SerpAPI", total: items.length, resultados: items });
}

async function serpApiSearchItems(query: string, recencia?: string): Promise<SearchItem[]> {
  const raw = await toolPesquisarWebSerpApi(query, recencia);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed?.resultados)) return [];
    return parsed.resultados.map((it: SearchItem) => ({ ...it, consulta: it.consulta || query }));
  } catch {
    return [];
  }
}

async function toolConsultarCnpj(cnpj: string): Promise<string> {
  const clean = (cnpj || "").replace(/\D/g, "");
  if (clean.length !== 14) return JSON.stringify({ erro: "CNPJ inválido — precisa ter 14 dígitos" });
  try {
    const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${clean}`);
    if (!r.ok) return JSON.stringify({ erro: `CNPJ não encontrado (${r.status})` });
    const d = await r.json();
    return JSON.stringify({
      cnpj: d.cnpj,
      razao_social: d.razao_social,
      nome_fantasia: d.nome_fantasia,
      situacao: d.descricao_situacao_cadastral,
      data_abertura: d.data_inicio_atividade,
      capital_social: d.capital_social,
      porte: d.porte,
      natureza_juridica: d.natureza_juridica,
      cnae_principal: `${d.cnae_fiscal} - ${d.cnae_fiscal_descricao}`,
      endereco: `${d.logradouro}, ${d.numero} ${d.complemento ?? ""} - ${d.bairro}, ${d.municipio}/${d.uf} - CEP ${d.cep}`,
      telefone: d.ddd_telefone_1,
      email: d.email,
      socios: (d.qsa ?? []).map((s: any) => ({ nome: s.nome_socio, qualificacao: s.qualificacao_socio, entrada: s.data_entrada_sociedade })),
    });
  } catch (e) {
    return JSON.stringify({ erro: String((e as Error).message) });
  }
}

// Extrai texto legível de uma página (strip HTML) — timeout curto, retorna vazio em erro.
async function fetchPageText(url: string, maxChars = 1800): Promise<string> {
  try {
    const r = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; JarvisBot/1.0)",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.6",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) return "";
    const ct = r.headers.get("content-type") || "";
    if (!ct.includes("html") && !ct.includes("text")) return "";
    let html = await r.text();
    // Corta scripts/styles/nav/footer
    html = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
      .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
      .replace(/<header[\s\S]*?<\/header>/gi, " ")
      .replace(/<aside[\s\S]*?<\/aside>/gi, " ");
    // Preserva um pouco de estrutura em parágrafos
    html = html.replace(/<\/(p|h[1-6]|li|br|div)>/gi, "\n");
    const text = html
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{2,}/g, "\n")
      .trim();
    return text.slice(0, maxChars);
  } catch {
    return "";
  }
}

async function toolPesquisarWeb(query: string, recencia?: string): Promise<string> {
  const originalQuery = cleanSearchQuery(query);
  const variants = buildSearchVariants(originalQuery, recencia);
  let fonteBusca = "";
  let gathered: SearchItem[] = [];

  if (GOOGLE_API_KEY && GOOGLE_CX) {
    try {
      const batches = await Promise.all(variants.map((q) => googleCustomSearchItems(q, recencia)));
      gathered = batches.flat();
      if (gathered.length > 0) fonteBusca = `Google Custom Search (${variants.length} consultas otimizadas)`;
    } catch (e) {
      console.error("[pietro][pesquisar_web] erro", (e as Error).message);
    }
  }

  if (gathered.length < 4) {
    const serpBatches = await Promise.all(variants.slice(0, 3).map((q) => serpApiSearchItems(q, recencia)));
    const serpItems = serpBatches.flat();
    if (serpItems.length > 0) {
      gathered = [...gathered, ...serpItems];
      fonteBusca = fonteBusca ? `${fonteBusca} + SerpAPI` : "Google via SerpAPI";
    }
  }

  const ranked = dedupeAndRankSearchItems(gathered, originalQuery);
  if (ranked.length === 0) {
    return JSON.stringify({
      query: originalQuery,
      consultas_tentadas: variants,
      erro: "sem_resultados_relevantes",
      instrucao: "A busca retornou resultados fracos ou fora do tema. Peça 1 detalhe a mais (cidade, bairro, data, marca, evento) antes de afirmar algo.",
    });
  }

  // Enriquecimento: baixa conteúdo textual das top 5 páginas em paralelo.
  const topN = Math.min(5, ranked.length);
  const enriched = await Promise.all(
    ranked.slice(0, topN).map(async (it: SearchItem) => ({
      ...it,
      conteudo_extraido: await fetchPageText(it.link || "", 2600),
    })),
  );
  const finalItems = [...enriched, ...ranked.slice(topN)];
  const withReadableContent = finalItems.filter((it) => (it.conteudo_extraido || "").length > 180).length;

  return JSON.stringify({
    query: originalQuery,
    consultas_tentadas: variants,
    recencia: recencia || "qualquer",
    fonte_busca: fonteBusca || "Google",
    qualidade: {
      total_bruto: gathered.length,
      total_relevante: finalItems.length,
      paginas_lidas: withReadableContent,
    },
    instrucao: "Responda SOMENTE com base nos resultados relevantes e no conteudo_extraido. Se paginas_lidas=0 ou os resultados não responderem exatamente, diga que a busca não trouxe confirmação suficiente e sugira uma consulta mais específica. Para hospedagem, priorize links de Booking/Tripadvisor/hotéis/pousadas e descarte resultados genéricos fora da cidade.",
    resultados: finalItems,
  });
}

function detectWebSearchIntent(text: string): { query: string; recencia?: string } | null {
  const raw = (text || "").trim();
  if (!raw) return null;
  const t = normalizePt(raw);

  const hasExplicitSearchIntent = /\b(procura|procurar|busca|buscar|pesquisa|pesquisar|google|internet|web|acha ai|ve pra mim|consulte)\b/.test(t);
  const hasRealtimeIntent = /\b(hoje|agora|atual|recente|ultimas|noticias|transito|trafego|cotacao|preco|placar|resultado|agenda|greve)\b/.test(t);
  const hasRecipeIntent = /\b(receita|como fazer|ingredientes|modo de preparo)\b/.test(t);

  if (!hasExplicitSearchIntent && !hasRealtimeIntent && !hasRecipeIntent) return null;

  let query = cleanSearchQuery(raw);

  if (!query) query = raw;
  if (/\btransito\b/.test(t)) query = `${query} trânsito agora ${currentMonthYearPt()}`;
  if (/\b(notícias|noticias|recente|hoje|agora|atual|transito|trafego|greve)\b/i.test(raw)) return { query, recencia: "d" };
  if (isLodgingQuery(query)) return { query, recencia: "m" };
  return { query };
}

// Detecta pedidos de cotação e retorna pares a consultar (AwesomeAPI é tempo real).
function detectQuoteIntent(text: string): string[] {
  const t = normalizePt(text);
  if (!/\b(cotacao|cotacoes|preco|valor|fechamento|quanto (esta|ta|custa)|hoje|agora|atual)\b/.test(t)
      && !/\b(dolar|euro|libra|iene|peso|bitcoin|btc|ethereum|eth|solana|sol|bnb|xrp|doge|cardano|ada)\b/.test(t)) {
    return [];
  }
  const map: Record<string, string> = {
    "dolar": "USD-BRL",
    "usd": "USD-BRL",
    "euro": "EUR-BRL",
    "eur": "EUR-BRL",
    "libra": "GBP-BRL",
    "gbp": "GBP-BRL",
    "iene": "JPY-BRL",
    "jpy": "JPY-BRL",
    "peso argentino": "ARS-BRL",
    "peso": "ARS-BRL",
    "bitcoin": "BTC-BRL",
    "btc": "BTC-BRL",
    "ethereum": "ETH-BRL",
    "eth": "ETH-BRL",
    "solana": "SOL-BRL",
    "\\bsol\\b": "SOL-BRL",
    "bnb": "BNB-BRL",
    "xrp": "XRP-BRL",
    "ripple": "XRP-BRL",
    "doge": "DOGE-BRL",
    "cardano": "ADA-BRL",
    "\\bada\\b": "ADA-BRL",
  };
  const pairs = new Set<string>();
  for (const [k, v] of Object.entries(map)) {
    const re = new RegExp(k.includes("\\b") ? k : `\\b${k}\\b`);
    if (re.test(t)) pairs.add(v);
  }
  return Array.from(pairs);
}

function isStaleToolFailureMessage(content: string): boolean {
  const t = normalizePt(content);
  return (
    /\b(nao consigo acessar a internet|ferramenta de pesquisa|erro de permissao|pesquisa esta bloqueada|acesso ao google|buscar diretamente no google)\b/.test(t) ||
    /\b(problema|erro|bloquead|permissao)\b/.test(t) && /\b(google|internet|web|pesquisa|ferramenta)\b/.test(t)
  );
}

function normalizePt(text: string): string {
  return (text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function detectNearbySearch(text: string): { query: string; radiusMeters: number } | null {
  const raw = text ?? "";
  const t = normalizePt(raw);
  if (!t.trim()) return null;

  // Guard 1: mensagens longas são conteúdo pra comentar, não pedido de lugar.
  if (raw.length > 400) return null;

  // Guard 2: cara de documento/código colado (markdown, blocos, várias linhas, chaves, ;).
  const newlineCount = (raw.match(/\n/g) ?? []).length;
  const looksLikeDoc =
    newlineCount >= 3 ||
    /^\s*#{1,6}\s/m.test(raw) ||
    /```/.test(raw) ||
    /[{};]\s*$/m.test(raw) ||
    /\*\*[^*]+\*\*/.test(raw);
  if (looksLikeDoc) return null;

  const placePatterns: Array<{ re: RegExp; query: string; radiusMeters?: number }> = [
    { re: /\b(supermercado|hortifruti|mercearia|grocery)\b/, query: "supermercado", radiusMeters: 2500 },
    { re: /\b(farmacia|drogaria)\b/, query: "farmácia", radiusMeters: 2500 },
    { re: /\b(cafeteria)\b/, query: "cafeteria", radiusMeters: 2000 },
    { re: /\b(restaurante)\b/, query: "restaurante", radiusMeters: 2500 },
    { re: /\b(posto de gasolina|posto gasolina)\b/, query: "posto de gasolina", radiusMeters: 3000 },
    { re: /\b(hospital|upa|pronto socorro)\b/, query: "hospital", radiusMeters: 5000 },
    { re: /\b(padaria)\b/, query: "padaria", radiusMeters: 2000 },
    { re: /\b(caixa eletronico|atm)\b/, query: "banco", radiusMeters: 2500 },
    { re: /\b(shopping)\b/, query: "shopping", radiusMeters: 5000 },
  ];

  // Guard 3: exigir intenção EXPLÍCITA de lugar físico. Palavra solta ("banco",
  // "loja", "mercado", "comida") NÃO dispara — quase sempre é contexto técnico.
  const explicitIntent =
    /\bperto de (mim|aqui|voce)\b/.test(t) ||
    /\b(mais )?(proximo|proxima|perto)\b.*\b(de|da|do)\b/.test(t) ||
    /\b(onde (tem|fica|acho|encontro|posso)|onde ha)\b/.test(t) ||
    /\b(endereco|endereço) (de|do|da)\b/.test(t) ||
    /\bcomo (chego|chegar)\b/.test(t) ||
    /\b(me (indica|mostra|acha|ache)|indica|mostra|ache|acha) (um|uma|o|a) /.test(t) ||
    /\b(ao redor|nas redondezas|na regiao|aqui perto)\b/.test(t);

  if (!explicitIntent) return null;

  const found = placePatterns.find((p) => p.re.test(t));
  if (!found) return null;

  return { query: found.query, radiusMeters: found.radiusMeters ?? 2500 };
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function overpassFilterForQuery(query: string): string {
  const q = normalizePt(query);
  if (/supermercado|mercado|grocery/.test(q)) return `["shop"~"supermarket|convenience|grocery|greengrocer"]`;
  if (/farmacia|drogaria/.test(q)) return `["amenity"="pharmacy"]`;
  if (/cafe|cafeteria/.test(q)) return `["amenity"="cafe"]`;
  if (/restaurante|comida/.test(q)) return `["amenity"="restaurant"]`;
  if (/posto|gasolina|combustivel/.test(q)) return `["amenity"="fuel"]`;
  if (/hospital|emergencia|upa/.test(q)) return `["amenity"~"hospital|clinic|doctors"]`;
  if (/padaria|pao/.test(q)) return `["shop"="bakery"]`;
  if (/banco|caixa|atm/.test(q)) return `["amenity"~"bank|atm"]`;
  if (/shopping|loja/.test(q)) return `["shop"]`;
  return `["name"~"${query.replace(/[^\p{L}\p{N}\s-]/gu, "").slice(0, 40)}",i]`;
}

async function toolBuscarLugaresOpenStreetMap(locRow: any, query: string, radiusMeters?: number, googleError?: string): Promise<string> {
  const radius = Math.min(Math.max(radiusMeters ?? 2500, 200), 20000);
  const lat = Number(locRow.latitude);
  const lng = Number(locRow.longitude);
  const filter = overpassFilterForQuery(query);
  const overpassQuery = `
[out:json][timeout:12];
(
  node${filter}(around:${radius},${lat},${lng});
  way${filter}(around:${radius},${lat},${lng});
  relation${filter}(around:${radius},${lat},${lng});
);
out center tags 25;`.trim();

  const ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    "https://overpass.osm.jp/api/interpreter",
  ];
  let d: any = null;
  let lastErr = "";
  for (const ep of ENDPOINTS) {
    try {
      console.log(`[osm][try] endpoint=${ep} lat=${lat} lng=${lng} r=${radius} q="${query}"`);
      const r = await fetch(ep, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8", "User-Agent": "amz-jarvis/1.0" },
        body: new URLSearchParams({ data: overpassQuery }),
        signal: AbortSignal.timeout(8000),
      });
      if (!r.ok) {
        lastErr = `overpass ${r.status}: ${(await r.text().catch(() => "")).slice(0, 200)}`;
        console.log(`[osm][fail] ${ep} -> ${lastErr}`);
        continue;
      }
      d = await r.json();
      console.log(`[osm][ok] ${ep} elements=${(d.elements ?? []).length}`);
      break;
    } catch (e) {
      lastErr = String((e as Error).message);
      console.log(`[osm][exception] ${ep} -> ${lastErr}`);
    }
  }
  if (!d) {
    return JSON.stringify({ erro: `openstreetmap indisponivel: ${lastErr}`, detalhe_google: googleError });
  }
  try {
    const seen = new Set<string>();
    const lugares = (d.elements ?? [])
      .map((el: any) => {
        const pLat = Number(el.lat ?? el.center?.lat);
        const pLng = Number(el.lon ?? el.center?.lon);
        if (!Number.isFinite(pLat) || !Number.isFinite(pLng)) return null;
        const tags = el.tags ?? {};
        const nome = tags.name || tags.brand || tags.operator || query;
        const key = `${normalizePt(nome)}:${pLat.toFixed(5)}:${pLng.toFixed(5)}`;
        if (seen.has(key)) return null;
        seen.add(key);
        const endereco = [
          tags["addr:street"],
          tags["addr:housenumber"],
          tags["addr:suburb"] || tags["addr:neighbourhood"],
          tags["addr:city"],
        ].filter(Boolean).join(", ") || null;
        return {
          nome,
          tipo: tags.shop || tags.amenity || tags.healthcare || query,
          endereco,
          distancia_km: Number(haversineKm(lat, lng, pLat, pLng).toFixed(2)),
          aberto_agora: tags.opening_hours ? undefined : undefined,
          horario: tags.opening_hours || null,
          telefone: tags.phone || tags["contact:phone"] || null,
          mapa: `https://www.google.com/maps/search/?api=1&query=${pLat},${pLng}`,
          fonte: "OpenStreetMap",
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => a.distancia_km - b.distancia_km)
      .slice(0, 8);

    return JSON.stringify({
      query,
      origem: { lat, lng, endereco: locRow.address, idade_minutos: Math.round((Date.now() - new Date(locRow.updated_at).getTime()) / 60000) },
      fonte: "OpenStreetMap",
      fallback_usado: Boolean(googleError),
      detalhe_google: googleError ? googleError.slice(0, 180) : undefined,
      lugares,
    });
  } catch (e) {
    return JSON.stringify({ erro: String((e as Error).message), detalhe_google: googleError });
  }
}

function formatNearbyReply(raw: string, query: string): string {
  let data: any;
  try { data = JSON.parse(raw); } catch { data = { erro: raw }; }

  if (data?.erro === "sem_localizacao") {
    return "Ainda não recebi sua localização atual. Me envie pelo WhatsApp em 📎 → Localização → Enviar localização atual, que eu busco os lugares mais próximos na sequência.";
  }

  const lugares = Array.isArray(data?.lugares) ? data.lugares : [];
  if (!lugares.length) {
    if (data?.erro) {
      console.log(`[nearby][empty] erro=${String(data.erro).slice(0, 300)} google=${String(data?.detalhe_google ?? "").slice(0, 300)}`);
    }
    return `Recebi sua localização, mas não encontrei ${query} próximo num raio seguro agora. Quer que eu tente ampliar a busca para alguns quilômetros a mais?`;
  }


  const first = lugares[0];
  const lines = lugares.slice(0, 4).map((l: any, i: number) => {
    const dist = Number.isFinite(Number(l.distancia_km)) ? `${Number(l.distancia_km).toFixed(2)} km` : "distância não informada";
    const nota = l.nota ? ` • nota ${l.nota}${l.avaliacoes ? ` (${l.avaliacoes})` : ""}` : "";
    const aberto = l.aberto_agora === true ? " • aberto agora" : l.aberto_agora === false ? " • pode estar fechado" : "";
    const endereco = l.endereco ? `\n   ${l.endereco}` : "";
    const mapa = l.mapa ? `\n   Mapa: ${l.mapa}` : "";
    return `${i + 1}. ${l.nome || query} — ${dist}${nota}${aberto}${endereco}${mapa}`;
  });

  return `Localização recebida. O ${query} mais próximo que encontrei é **${first.nome || query}**, a cerca de **${Number(first.distancia_km).toFixed(2)} km**.\n\n${lines.join("\n\n")}\n\nQuer que eu trace a rota para o primeiro?`;
}

async function toolBuscarLugaresProximos(
  ctx: { userId: string; fromNumber: string },
  query: string,
  radiusMeters?: number,
): Promise<string> {
  const { data: locRow } = await sb
    .from("whatsapp_user_locations")
    .select("latitude, longitude, address, updated_at")
    .eq("user_id", ctx.userId)
    .eq("contact_number", ctx.fromNumber)
    .maybeSingle();
  if (!locRow) {
    return JSON.stringify({
      erro: "sem_localizacao",
      instrucao: "Peça ao usuário para compartilhar a localização no WhatsApp (📎 → Localização → Enviar localização atual) e tentar de novo.",
    });
  }
  // OSM (Overpass) como fonte primária — gratuito, sem chave.
  const overpassResult = await toolBuscarLugaresOpenStreetMap(locRow, query, radiusMeters, null);
  try {
    const parsed = JSON.parse(overpassResult);
    if (Array.isArray(parsed?.lugares) && parsed.lugares.length > 0) return overpassResult;
    console.log(`[nearby] overpass vazio/falhou, tentando Nominatim. erro=${parsed?.erro ?? "vazio"}`);
  } catch (_) {}
  // Fallback: Nominatim (busca textual em torno do ponto)
  return await toolBuscarLugaresNominatim(locRow, query, radiusMeters);
}

async function toolBuscarLugaresNominatim(locRow: any, query: string, radiusMeters?: number): Promise<string> {
  const lat = Number(locRow.latitude);
  const lng = Number(locRow.longitude);
  const radius = Math.min(Math.max(radiusMeters ?? 2500, 500), 20000);
  // ~1 grau lat = 111km. Aproxima uma bounding box.
  const dLat = radius / 111000;
  const dLng = radius / (111000 * Math.max(0.1, Math.cos(lat * Math.PI / 180)));
  const viewbox = `${lng - dLng},${lat + dLat},${lng + dLng},${lat - dLat}`;
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=20&addressdetails=1&bounded=1&viewbox=${viewbox}&q=${encodeURIComponent(query)}`;
  try {
    console.log(`[nominatim][try] ${url}`);
    const r = await fetch(url, {
      headers: { "User-Agent": "amz-jarvis/1.0 (contato@amzofertas.com.br)", "Accept-Language": "pt-BR" },
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      return JSON.stringify({ erro: `nominatim ${r.status}`, detalhe: t.slice(0, 200) });
    }
    const arr = await r.json();
    const lugares = (Array.isArray(arr) ? arr : [])
      .map((el: any) => {
        const pLat = Number(el.lat);
        const pLng = Number(el.lon);
        if (!Number.isFinite(pLat) || !Number.isFinite(pLng)) return null;
        const a = el.address ?? {};
        const endereco = [a.road, a.house_number, a.suburb || a.neighbourhood, a.city || a.town || a.village].filter(Boolean).join(", ") || el.display_name || null;
        return {
          nome: el.name || (el.display_name || query).split(",")[0],
          tipo: el.type || query,
          endereco,
          distancia_km: Number(haversineKm(lat, lng, pLat, pLng).toFixed(2)),
          mapa: `https://www.google.com/maps/search/?api=1&query=${pLat},${pLng}`,
          fonte: "Nominatim",
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => a.distancia_km - b.distancia_km)
      .slice(0, 8);
    return JSON.stringify({
      query,
      origem: { lat, lng, endereco: locRow.address, idade_minutos: Math.round((Date.now() - new Date(locRow.updated_at).getTime()) / 60000) },
      fonte: "Nominatim",
      fallback_usado: true,
      lugares,
    });
  } catch (e) {
    return JSON.stringify({ erro: `nominatim_exception: ${String((e as Error).message)}` });
  }
}

// ---- gerar_imagem: cria imagem por IA (Nano Banana), sobe pro storage e salva em /midias ----
// Padrão IA Marketing: fotorealista, sem texto/letras/marca d'água, iluminação profissional.
async function toolGerarImagem(
  prompt: string,
  ctx: { userId: string; fromNumber?: string },
): Promise<string> {
  const clean = (prompt || "").trim();
  if (!clean) return JSON.stringify({ erro: "prompt vazio" });
  try {
    // Blindagem de qualidade — força padrão ULTRA REALISTA idêntico ao IA Marketing
    const enhancedPrompt = `${clean}

DIRETRIZES OBRIGATÓRIAS DE QUALIDADE (padrão IA Marketing):
- Fotografia ultra-realista, resolução máxima, nível editorial/publicitário profissional.
- Iluminação natural e cinematográfica, sombras suaves, profundidade de campo real.
- Cores vibrantes, texturas nítidas, materiais convincentes (madeira, tecido, metal, pele).
- Composição equilibrada, enquadramento profissional (regra dos terços quando fizer sentido).
- Se houver produto: destacado em primeiro plano, foco perfeito, apelo comercial.
- Se houver pessoa: rosto e mãos anatomicamente corretos, expressão natural.
- PROIBIDO: qualquer texto, letras, palavras, números, legendas, marcas d'água, logos artificiais, bordas ou molduras.
- PROIBIDO: aparência de IA/CGI barato, plástico, cartoon (a menos que o usuário peça explicitamente).
- Resultado final: parece uma foto tirada por um fotógrafo profissional de marketing.`;

    console.log("[gerar_imagem] iniciando geração, promptLen=", enhancedPrompt.length);
    const t0 = Date.now();
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${LOVABLE_API_KEY}` },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-image",
        messages: [{ role: "user", content: enhancedPrompt }],
        modalities: ["image", "text"],
      }),
      signal: AbortSignal.timeout(90000),
    });
    console.log("[gerar_imagem] gateway respondeu em", Date.now() - t0, "ms status=", res.status);
    if (!res.ok) {
      const t = await res.text();
      console.error("[gerar_imagem] erro gateway:", res.status, t.slice(0, 300));
      return JSON.stringify({ erro: `image_gen ${res.status}`, detalhe: t.slice(0, 200) });
    }
    const data = await res.json();
    const dataUrl = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!dataUrl) {
      console.error("[gerar_imagem] resposta sem imagem:", JSON.stringify(data).slice(0, 400));
      return JSON.stringify({ erro: "sem_imagem_retornada" });
    }

    let b64 = dataUrl;
    let mime = "image/png";
    if (b64.startsWith("data:")) {
      const m = b64.match(/^data:(image\/\w+);base64,(.+)$/);
      if (m) { mime = m[1]; b64 = m[2]; }
    }
    const bytes = base64Decode(b64);
    const fileName = `midias/${ctx.userId}/ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
    const { error: upErr } = await sb.storage.from("produtos").upload(fileName, bytes, { contentType: mime, upsert: true });
    if (upErr) return JSON.stringify({ erro: `upload_falhou: ${upErr.message}` });
    const { data: pub } = sb.storage.from("produtos").getPublicUrl(fileName);
    if (!pub?.publicUrl) return JSON.stringify({ erro: "sem_url_publica" });

    // Salva automaticamente na biblioteca /midias para o usuário poder publicar
    let midiaId: string | null = null;
    try {
      const { data: novo } = await sb
        .from("midias_whatsapp")
        .insert({
          user_id: ctx.userId,
          origem: "ia_whatsapp",
          telefone_origem: ctx.fromNumber ?? null,
          tipo: "foto",
          midia_url: pub.publicUrl,
          mime_type: mime,
          tamanho_bytes: bytes.length,
          contexto_original: clean,
          status: "pendente",
        })
        .select("id")
        .single();
      midiaId = novo?.id ?? null;
    } catch (e) {
      console.warn("[gerar_imagem] falhou ao salvar em midias_whatsapp:", (e as Error).message);
    }

    return JSON.stringify({
      ok: true,
      image_url: pub.publicUrl,
      prompt: clean,
      midia_id: midiaId,
      salvo_em_midias: !!midiaId,
      instrucao: "A imagem foi enviada ao usuário E salva automaticamente na biblioteca /midias. Diga em 1-2 linhas o que criou e avise que já está disponível pra publicar nas redes sociais (ele pode pedir 'posta essa imagem' ou usar em /midias).",
    });
  } catch (e) {
    return JSON.stringify({ erro: String((e as Error).message) });
  }
}

// ---- editar_imagem: edita/melhora foto que o usuário mandou (usa última imagem do turno) ----
async function toolEditarImagem(
  prompt: string,
  ctx: { userId: string; media?: MediaExtract[] },
): Promise<string> {
  const clean = (prompt || "").trim();
  if (!clean) return JSON.stringify({ erro: "prompt vazio" });
  const img = (ctx.media || []).slice().reverse().find((m) => m.kind === "image");
  if (!img) {
    return JSON.stringify({
      erro: "sem_imagem",
      instrucao: "Peça ao usuário para enviar a foto no mesmo momento do pedido de edição.",
    });
  }
  try {
    const dataUrlInput = `data:${img.mime};base64,${img.base64}`;
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${LOVABLE_API_KEY}` },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-image",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Edite esta foto conforme o pedido abaixo, preservando pessoas, rostos e o produto/objeto principal reconhecíveis. Apenas melhore ambiente, iluminação, cores, fundo e composição.\n\nPedido: ${clean}\n\nRegras: sem texto, palavras, letras ou marcas d'água na imagem. Resultado fotorealista de alta qualidade.`,
              },
              { type: "image_url", image_url: { url: dataUrlInput } },
            ],
          },
        ],
        modalities: ["image", "text"],
      }),
      signal: AbortSignal.timeout(90000),
    });
    if (!res.ok) {
      const t = await res.text();
      return JSON.stringify({ erro: `image_edit ${res.status}`, detalhe: t.slice(0, 200) });
    }
    const data = await res.json();
    const dataUrl = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!dataUrl) return JSON.stringify({ erro: "sem_imagem_retornada" });

    let b64 = dataUrl;
    let mime = "image/png";
    if (b64.startsWith("data:")) {
      const m = b64.match(/^data:(image\/\w+);base64,(.+)$/);
      if (m) { mime = m[1]; b64 = m[2]; }
    }
    const bytes = base64Decode(b64);
    const fileName = `whatsapp-ai/${ctx.userId}/edit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
    const { error: upErr } = await sb.storage.from("produtos").upload(fileName, bytes, { contentType: mime, upsert: true });
    if (upErr) return JSON.stringify({ erro: `upload_falhou: ${upErr.message}` });
    const { data: pub } = sb.storage.from("produtos").getPublicUrl(fileName);
    if (!pub?.publicUrl) return JSON.stringify({ erro: "sem_url_publica" });
    return JSON.stringify({ ok: true, image_url: pub.publicUrl, prompt: clean });
  } catch (e) {
    return JSON.stringify({ erro: String((e as Error).message) });
  }
}

// ---- consultar_clima: Open-Meteo (grátis, sem chave), com geocoding opcional ----
async function toolConsultarClima(cidadeOuLatLng: string, ctx: { userId: string; fromNumber: string }): Promise<string> {
  try {
    let lat: number | null = null, lng: number | null = null, nome = cidadeOuLatLng?.trim() || "";
    const latlng = nome.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (latlng) { lat = Number(latlng[1]); lng = Number(latlng[2]); nome = `${lat},${lng}`; }
    if (lat == null && nome) {
      const g = await fetch(`https://geocoding-api.open-meteo.com/v1/search?count=1&language=pt&name=${encodeURIComponent(nome)}`, { signal: AbortSignal.timeout(8000) });
      if (g.ok) {
        const gd = await g.json();
        const r0 = gd?.results?.[0];
        if (r0) { lat = r0.latitude; lng = r0.longitude; nome = `${r0.name}${r0.admin1 ? " - " + r0.admin1 : ""}${r0.country ? ", " + r0.country : ""}`; }
      }
    }
    if (lat == null && ctx.userId) {
      const { data: loc } = await sb.from("whatsapp_user_locations").select("latitude, longitude, address").eq("user_id", ctx.userId).eq("contact_number", ctx.fromNumber).maybeSingle();
      if (loc) { lat = Number(loc.latitude); lng = Number(loc.longitude); nome = loc.address || `${lat},${lng}`; }
    }
    if (lat == null || lng == null) return JSON.stringify({ erro: "cidade_nao_encontrada", instrucao: "Peça pra especificar a cidade (ex: 'clima em São Paulo')." });
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code&timezone=America/Sao_Paulo&forecast_days=3`;
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return JSON.stringify({ erro: `clima_api ${r.status}` });
    const d = await r.json();
    const codeMap: Record<number, string> = {0:"céu limpo",1:"predominante claro",2:"parcialmente nublado",3:"nublado",45:"neblina",48:"neblina com geada",51:"garoa leve",53:"garoa",55:"garoa forte",61:"chuva leve",63:"chuva",65:"chuva forte",71:"neve leve",73:"neve",75:"neve forte",80:"pancadas leves",81:"pancadas de chuva",82:"pancadas fortes",95:"trovoadas",96:"trovoadas com granizo",99:"trovoadas fortes com granizo"};
    return JSON.stringify({
      local: nome,
      agora: {
        temperatura_c: d.current?.temperature_2m,
        sensacao_c: d.current?.apparent_temperature,
        umidade_pct: d.current?.relative_humidity_2m,
        vento_kmh: d.current?.wind_speed_10m,
        condicao: codeMap[d.current?.weather_code] || `código ${d.current?.weather_code}`,
      },
      previsao: (d.daily?.time ?? []).map((t: string, i: number) => ({
        data: t,
        min_c: d.daily.temperature_2m_min[i],
        max_c: d.daily.temperature_2m_max[i],
        chuva_prob_pct: d.daily.precipitation_probability_max[i],
        condicao: codeMap[d.daily.weather_code[i]] || `código ${d.daily.weather_code[i]}`,
      })),
    });
  } catch (e) {
    return JSON.stringify({ erro: String((e as Error).message) });
  }
}

// ---- cotacao_moeda: AwesomeAPI + fallbacks (CoinGecko p/ cripto, open.er-api p/ fiat) ----
const CRYPTO_IDS: Record<string, string> = {
  BTC: "bitcoin", ETH: "ethereum", SOL: "solana", BNB: "binancecoin",
  XRP: "ripple", DOGE: "dogecoin", ADA: "cardano", LTC: "litecoin",
  MATIC: "polygon-ecosystem-token", AVAX: "avalanche-2", LINK: "chainlink",
  DOT: "polkadot", TRX: "tron", USDT: "tether", USDC: "usd-coin",
};

async function fetchAwesome(clean: string): Promise<any | null> {
  try {
    const r = await fetch(`https://economia.awesomeapi.com.br/last/${clean}`, {
      signal: AbortSignal.timeout(5000),
      headers: { "User-Agent": "JarvisBot/1.0" },
    });
    if (!r.ok) return null;
    const d = await r.json();
    const c = d[clean.replace("-", "")];
    if (!c) return null;
    return {
      par: clean,
      compra: Number(c.bid),
      venda: Number(c.ask),
      variacao_pct: Number(c.pctChange),
      maxima_dia: Number(c.high),
      minima_dia: Number(c.low),
      atualizado_em: c.create_date,
      nome: c.name,
      fonte: "AwesomeAPI",
    };
  } catch { return null; }
}

async function fetchCoinGecko(from: string, to: string): Promise<any | null> {
  const id = CRYPTO_IDS[from];
  if (!id) return null;
  const vs = to.toLowerCase();
  try {
    const r = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=${vs}&include_24hr_change=true&include_last_updated_at=true`,
      { signal: AbortSignal.timeout(6000), headers: { "User-Agent": "JarvisBot/1.0", "Accept": "application/json" } },
    );
    if (!r.ok) return null;
    const d = await r.json();
    const c = d[id];
    if (!c || c[vs] == null) return null;
    const price = Number(c[vs]);
    const ts = c.last_updated_at ? new Date(c.last_updated_at * 1000).toISOString() : new Date().toISOString();
    return {
      par: `${from}-${to}`,
      compra: price,
      venda: price,
      variacao_pct: Number(c[`${vs}_24h_change`] ?? 0),
      atualizado_em: ts,
      nome: `${from}/${to}`,
      fonte: "CoinGecko",
    };
  } catch { return null; }
}

// cache em memória para taxas fiat (1h)
const FIAT_CACHE: Record<string, { rates: Record<string, number>; ts: number }> = {};

async function fetchFiat(from: string, to: string): Promise<any | null> {
  try {
    const cached = FIAT_CACHE[from];
    let rates: Record<string, number> | null = null;
    let updated = "";
    if (cached && Date.now() - cached.ts < 3600_000) {
      rates = cached.rates;
      updated = new Date(cached.ts).toISOString();
    } else {
      const r = await fetch(`https://open.er-api.com/v6/latest/${from}`, {
        signal: AbortSignal.timeout(6000),
        headers: { "User-Agent": "JarvisBot/1.0" },
      });
      if (!r.ok) return null;
      const d = await r.json();
      if (d.result !== "success" || !d.rates) return null;
      rates = d.rates;
      updated = d.time_last_update_utc || new Date().toISOString();
      FIAT_CACHE[from] = { rates: rates!, ts: Date.now() };
    }
    const price = rates![to];
    if (price == null) return null;
    return {
      par: `${from}-${to}`,
      compra: Number(price),
      venda: Number(price),
      variacao_pct: null,
      atualizado_em: updated,
      nome: `${from}/${to}`,
      fonte: "ExchangeRate-API",
    };
  } catch { return null; }
}

async function toolCotacaoMoeda(par: string): Promise<string> {
  const clean = (par || "").toUpperCase().replace(/\s+/g, "").replace(/\//g, "-");
  if (!/^[A-Z]{3,5}-[A-Z]{3,5}$/.test(clean)) {
    return JSON.stringify({ erro: "par_invalido", exemplo: "USD-BRL, EUR-BRL, BTC-BRL" });
  }
  const [from, to] = clean.split("-");
  const isCrypto = !!CRYPTO_IDS[from];

  // 1) AwesomeAPI (tempo real, primária)
  const awesome = await fetchAwesome(clean);
  if (awesome) return JSON.stringify(awesome);

  // 2) fallback por tipo
  const fb = isCrypto ? await fetchCoinGecko(from, to) : await fetchFiat(from, to);
  if (fb) return JSON.stringify(fb);

  // 3) para cripto, tentar via USD e converter p/ BRL
  if (isCrypto && to === "BRL") {
    const usd = await fetchCoinGecko(from, "USD");
    const usdBrl = await fetchFiat("USD", "BRL");
    if (usd && usdBrl) {
      return JSON.stringify({
        par: clean,
        compra: usd.compra * usdBrl.compra,
        venda: usd.venda * usdBrl.venda,
        variacao_pct: usd.variacao_pct,
        atualizado_em: usd.atualizado_em,
        nome: `${from}/${to}`,
        fonte: "CoinGecko+ExchangeRate (cross)",
      });
    }
  }

  return JSON.stringify({ erro: "cotacao_indisponivel", par: clean, detalhe: "AwesomeAPI 429/limite; fallback tambem falhou" });
}

// ---- criar_lembrete: agenda notificação com escalonamento (30min antes, a cada 10min) ----
async function toolCriarLembrete(
  args: { titulo?: string; data_hora_sp?: string; minutos_a_partir_de_agora?: number },
  ctx: { userId: string; fromNumber: string },
): Promise<string> {
  const titulo = (args?.titulo || "").trim();
  if (!titulo) return JSON.stringify({ erro: "titulo_obrigatorio" });
  let meetingMs: number | null = null;
  if (args?.minutos_a_partir_de_agora && Number(args.minutos_a_partir_de_agora) > 0) {
    meetingMs = Date.now() + Number(args.minutos_a_partir_de_agora) * 60000;
  } else if (args?.data_hora_sp) {
    // "YYYY-MM-DD HH:MM" em horário de São Paulo (UTC-3, sem DST)
    const m = String(args.data_hora_sp).trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
    if (!m) return JSON.stringify({ erro: "formato_data_invalido", esperado: "YYYY-MM-DD HH:MM" });
    const [, y, mo, d, h, mi] = m;
    // SP = UTC-3 → adiciona 3h para converter para UTC
    meetingMs = Date.UTC(+y, +mo - 1, +d, +h + 3, +mi, 0);
  } else {
    return JSON.stringify({ erro: "informe data_hora_sp ou minutos_a_partir_de_agora" });
  }
  if (meetingMs <= Date.now()) return JSON.stringify({ erro: "data_no_passado" });

  const nowMs = Date.now();
  const diffMin = Math.round((meetingMs - nowMs) / 60000);
  // Primeiro aviso: 30min antes; se falta menos que isso, dispara já
  const firstNotifyMs = diffMin > 30 ? meetingMs - 30 * 60000 : nowMs;

  const { data, error } = await sb.from("whatsapp_reminders").insert({
    user_id: ctx.userId,
    contact_number: ctx.fromNumber,
    titulo,
    meeting_at: new Date(meetingMs).toISOString(),
    next_notify_at: new Date(firstNotifyMs).toISOString(),
    status: "active",
  }).select("id").single();
  if (error) return JSON.stringify({ erro: error.message });

  const quandoSP = new Date(meetingMs).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
  return JSON.stringify({
    ok: true,
    id: data.id,
    titulo,
    quando: quandoSP,
    primeiro_aviso_em_min: Math.max(0, Math.round((firstNotifyMs - nowMs) / 60000)),
    politica: "aviso 30min antes e a cada 10min até a hora",
  });
}

// ---- NOTAS (segunda memória) ----
async function toolSalvarNota(conteudo: string, tags: string[] | undefined, ctx: { userId: string; fromNumber: string }): Promise<string> {
  const c = (conteudo || "").trim();
  if (!c) return JSON.stringify({ erro: "conteudo_vazio" });
  const { data, error } = await sb.from("jarvis_notes").insert({
    user_id: ctx.userId, contact_number: ctx.fromNumber, content: c, tags: Array.isArray(tags) ? tags.slice(0, 10) : [],
  }).select("id, created_at").single();
  if (error) return JSON.stringify({ erro: error.message });
  return JSON.stringify({ ok: true, id: data.id, salva_em: data.created_at });
}

async function toolBuscarNotas(query: string, ctx: { userId: string; fromNumber: string }): Promise<string> {
  const q = (query || "").trim();
  let sel = sb.from("jarvis_notes").select("id, content, tags, created_at")
    .eq("user_id", ctx.userId).eq("contact_number", ctx.fromNumber)
    .order("created_at", { ascending: false }).limit(10);
  if (q) sel = sel.ilike("content", `%${q}%`);
  const { data, error } = await sel;
  if (error) return JSON.stringify({ erro: error.message });
  return JSON.stringify({ query: q, total: (data ?? []).length, notas: data ?? [] });
}

// ---- TAREFAS (to-do conversacional) ----
async function toolAdicionarTarefa(args: { titulo?: string; prazo_sp?: string }, ctx: { userId: string; fromNumber: string }): Promise<string> {
  const t = (args?.titulo || "").trim();
  if (!t) return JSON.stringify({ erro: "titulo_obrigatorio" });
  let dueIso: string | null = null;
  if (args?.prazo_sp) {
    const m = String(args.prazo_sp).match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
    if (m) dueIso = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4] + 3, +m[5])).toISOString();
  }
  const { data, error } = await sb.from("jarvis_tasks").insert({
    user_id: ctx.userId, contact_number: ctx.fromNumber, title: t, due_at: dueIso, status: "open",
  }).select("id").single();
  if (error) return JSON.stringify({ erro: error.message });
  return JSON.stringify({ ok: true, id: data.id, titulo: t, prazo: dueIso });
}

async function toolListarTarefas(status: string | undefined, ctx: { userId: string; fromNumber: string }): Promise<string> {
  const st = status || "open";
  const { data, error } = await sb.from("jarvis_tasks").select("id, title, status, due_at, created_at")
    .eq("user_id", ctx.userId).eq("contact_number", ctx.fromNumber)
    .eq("status", st).order("created_at", { ascending: false }).limit(30);
  if (error) return JSON.stringify({ erro: error.message });
  return JSON.stringify({ status: st, total: (data ?? []).length, tarefas: data ?? [] });
}

async function toolConcluirTarefa(id_ou_titulo: string, ctx: { userId: string; fromNumber: string }): Promise<string> {
  const q = (id_ou_titulo || "").trim();
  if (!q) return JSON.stringify({ erro: "id_ou_titulo_obrigatorio" });
  const uuid = /^[0-9a-f-]{36}$/i.test(q);
  let query = sb.from("jarvis_tasks").update({ status: "done", completed_at: new Date().toISOString() })
    .eq("user_id", ctx.userId).eq("contact_number", ctx.fromNumber).eq("status", "open");
  query = uuid ? query.eq("id", q) : query.ilike("title", `%${q}%`);
  const { data, error } = await query.select("id, title");
  if (error) return JSON.stringify({ erro: error.message });
  return JSON.stringify({ ok: true, concluidas: data ?? [] });
}

// ---- CONTATOS COMERCIAIS (Jarvis dispara WhatsApp humanizado sob ordem do dono) ----

function normalizePhoneBR(raw: string): string {
  let c = (raw || "").replace(/\D/g, "");
  if (!c) return "";
  if (c.startsWith("0")) c = c.substring(1);
  if (c.length === 10 || c.length === 11) c = "55" + c;
  return c;
}

function normalizeContactLookupText(raw: string): string {
  return (raw || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function inferContatoComercialFromText(text: string, userId: string): Promise<any | null> {
  const haystack = ` ${normalizeContactLookupText(text)} `;
  if (!haystack.trim()) return null;

  const { data } = await sb.from("contatos_comerciais")
    .select("*")
    .eq("user_id", userId)
    .eq("ativo", true)
    .limit(80);

  const matches = (data ?? []).filter((c: any) => {
    const nome = normalizeContactLookupText(c.nome || "");
    if (!nome) return false;
    const firstName = nome.split(" ")[0];
    return haystack.includes(` ${nome} `) || (firstName.length >= 4 && haystack.includes(` ${firstName} `));
  });

  if (matches.length === 1) return matches[0];
  return null;
}

async function toolListarContatosComerciais(
  args: { busca?: string },
  ctx: { userId: string },
): Promise<string> {
  let q = sb.from("contatos_comerciais")
    .select("id, nome, empresa, cargo, whatsapp, tipo_relacionamento, contexto, proximos_passos, permite_jarvis_contatar, ultima_interacao")
    .eq("user_id", ctx.userId)
    .eq("ativo", true)
    .order("nome", { ascending: true })
    .limit(50);
  const busca = (args?.busca || "").trim();
  if (busca) q = q.or(`nome.ilike.%${busca}%,empresa.ilike.%${busca}%`);
  const { data, error } = await q;
  if (error) return JSON.stringify({ erro: error.message });
  return JSON.stringify({ total: (data ?? []).length, contatos: data ?? [] });
}

async function toolEnviarMensagemContatoComercial(
  args: {
    contato_id?: string;
    nome_busca?: string;
    mensagem?: string;
    data_hora_sp?: string;
    minutos_a_partir_de_agora?: number;
    tipo_acao?: string;
  },
  ctx: { userId: string },
): Promise<string> {
  const mensagem = (args?.mensagem || "").trim();
  if (!mensagem) return JSON.stringify({ erro: "mensagem_obrigatoria", detalhe: "Componha o texto humanizado como o Jarvis falaria — gentil, se apresentando como 'Jarvis, assistente do Felício'." });
  if (mensagem.length < 20) return JSON.stringify({ erro: "mensagem_muito_curta", detalhe: "Texto humanizado mínimo 20 chars." });

  // 1) Localizar o contato
  let contato: any = null;
  if (args?.contato_id && /^[0-9a-f-]{36}$/i.test(args.contato_id)) {
    const { data } = await sb.from("contatos_comerciais")
      .select("*").eq("id", args.contato_id).eq("user_id", ctx.userId).maybeSingle();
    contato = data;
  }
  // Fallback: se contato_id não achou (AI inventou UUID) ou não veio, tenta por nome
  if (!contato && args?.nome_busca) {
    const { data } = await sb.from("contatos_comerciais")
      .select("*").eq("user_id", ctx.userId).eq("ativo", true)
      .ilike("nome", `%${args.nome_busca.trim()}%`).limit(5);
    if (data && data.length === 1) contato = data[0];
    else if (data && data.length > 1) {
      return JSON.stringify({
        erro: "ambiguidade",
        detalhe: "Vários contatos batem com esse nome. Confirme qual e chame de novo com contato_id.",
        candidatos: data.map((c: any) => ({ id: c.id, nome: c.nome, empresa: c.empresa })),
      });
    }
  }

  // Fallback extra: se o modelo ainda inventar UUID e não mandar nome_busca,
  // tenta inferir pelo nome presente no texto composto (ex: "Oi Renata...").
  if (!contato) {
    contato = await inferContatoComercialFromText(mensagem, ctx.userId);
  }

  if (!contato) {
    // Último fallback: devolve a lista pro AI escolher o UUID real (nunca inventar)
    const { data: todos } = await sb.from("contatos_comerciais")
      .select("id, nome, empresa, whatsapp")
      .eq("user_id", ctx.userId).eq("ativo", true).order("nome").limit(20);
    return JSON.stringify({
      erro: "contato_nao_encontrado",
      detalhe: "NUNCA invente contato_id. Escolha o UUID exato da lista abaixo e chame de novo.",
      contatos_disponiveis: todos ?? [],
    });
  }
  if (!contato.ativo) return JSON.stringify({ erro: "contato_inativo", nome: contato.nome });
  if (!contato.permite_jarvis_contatar) {
    return JSON.stringify({
      erro: "contato_bloqueado_para_jarvis",
      nome: contato.nome,
      detalhe: "Esse contato está com a permissão do Jarvis desligada. O dono precisa ativar em /pj/contatos-comerciais.",
    });
  }

  const phone = normalizePhoneBR(contato.whatsapp);
  if (!phone) return JSON.stringify({ erro: "whatsapp_invalido", nome: contato.nome, whatsapp: contato.whatsapp });

  // 2) Calcular scheduled_at
  let scheduledMs = Date.now();
  if (args?.minutos_a_partir_de_agora && Number(args.minutos_a_partir_de_agora) > 0) {
    scheduledMs = Date.now() + Number(args.minutos_a_partir_de_agora) * 60000;
  } else if (args?.data_hora_sp) {
    const m = String(args.data_hora_sp).trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
    if (!m) return JSON.stringify({ erro: "formato_data_invalido", esperado: "YYYY-MM-DD HH:MM" });
    const [, y, mo, d, h, mi] = m;
    scheduledMs = Date.UTC(+y, +mo - 1, +d, +h + 3, +mi, 0);
    if (scheduledMs <= Date.now() - 60000) return JSON.stringify({ erro: "data_no_passado" });
  }

  // 3) Enfileirar via RPC oficial (regra Core: só via inserir_campanha_fila)
  const { error: rpcErr } = await sb.rpc("inserir_campanha_fila", {
    p_user_id: ctx.userId,
    p_contatos: [{
      phone,
      name: contato.nome,
      mensagem,
      scheduled_at: new Date(scheduledMs).toISOString(),
      lead_source: "jarvis_contato_comercial",
      metadata: {
        contato_comercial_id: contato.id,
        tipo_acao: args?.tipo_acao || "mensagem_livre",
        via: "jarvis_command",
      },
    }],
    p_mensagem: mensagem,
    p_lead_source: "jarvis_contato_comercial",
    p_metadata: {
      contato_comercial_id: contato.id,
      tipo_acao: args?.tipo_acao || "mensagem_livre",
    },
  });
  if (rpcErr) return JSON.stringify({ erro: "falha_ao_enfileirar", detalhe: rpcErr.message });

  // 4) Atualizar última interação
  await sb.from("contatos_comerciais")
    .update({ ultima_interacao: new Date().toISOString() })
    .eq("id", contato.id);

  const quandoSP = new Date(scheduledMs).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
  const agora = Math.abs(scheduledMs - Date.now()) < 60000;

  return JSON.stringify({
    ok: true,
    contato: { nome: contato.nome, empresa: contato.empresa, whatsapp: phone },
    tipo_acao: args?.tipo_acao || "mensagem_livre",
    agendado_para: quandoSP,
    envio_imediato: agora,
    preview_mensagem: mensagem.slice(0, 200),
  });
}

// ---- NOTÍCIAS (Google News RSS, grátis) ----
async function toolConsultarNoticias(tema: string): Promise<string> {

  const t = (tema || "").trim();
  if (!t) return JSON.stringify({ erro: "tema_obrigatorio" });
  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(t)}&hl=pt-BR&gl=BR&ceid=BR:pt-419`;
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return JSON.stringify({ erro: `rss ${r.status}` });
    const xml = await r.text();
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 8).map((m) => {
      const b = m[1];
      const pick = (tag: string) => {
        const rx = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`);
        return b.match(rx)?.[1]?.trim() ?? "";
      };
      return { titulo: pick("title"), link: pick("link"), data: pick("pubDate"), fonte: pick("source") };
    });
    return JSON.stringify({ tema: t, total: items.length, noticias: items });
  } catch (e) { return JSON.stringify({ erro: String((e as Error).message) }); }
}

// ---- RASTREIO CORREIOS (LinkAndTrack, grátis) ----
async function toolRastrearCorreios(codigo: string): Promise<string> {
  const c = (codigo || "").toUpperCase().replace(/\s+/g, "");
  if (!/^[A-Z]{2}\d{9}[A-Z]{2}$/.test(c)) return JSON.stringify({ erro: "codigo_invalido", esperado: "13 chars ex AA123456789BR" });
  try {
    const r = await fetch(`https://api.linketrack.com/track/json?user=teste&token=1abcd00b2731640e886fb41a8a9671ad1434c599dbaa0a0de9a5aa619f29a83f&codigo=${c}`, { signal: AbortSignal.timeout(10000) });
    if (!r.ok) return JSON.stringify({ erro: `rastreio ${r.status}` });
    const d = await r.json();
    return JSON.stringify({
      codigo: c, servico: d.servico, quantidade: d.quantidade,
      eventos: (d.eventos ?? []).slice(0, 6).map((e: any) => ({ data: `${e.data} ${e.hora}`, status: e.status, local: e.local, subStatus: e.subStatus })),
    });
  } catch (e) { return JSON.stringify({ erro: String((e as Error).message) }); }
}

// ---- ROTA/TRÂNSITO (OSRM público, grátis) ----
async function toolCalcularRota(origem: string, destino: string, ctx: { userId: string; fromNumber: string }): Promise<string> {
  async function geocode(q: string): Promise<{ lat: number; lng: number; nome: string } | null> {
    if (!q) return null;
    const ll = q.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (ll) return { lat: +ll[1], lng: +ll[2], nome: q };
    if (q.toLowerCase().includes("aqui") || q.toLowerCase().includes("minha loc")) {
      const { data } = await sb.from("whatsapp_user_locations").select("latitude,longitude,address").eq("user_id", ctx.userId).eq("contact_number", ctx.fromNumber).maybeSingle();
      if (data) return { lat: +data.latitude, lng: +data.longitude, nome: data.address || "sua localização" };
    }
    const g = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`, {
      headers: { "User-Agent": "amz-jarvis/1.0" }, signal: AbortSignal.timeout(8000),
    });
    if (!g.ok) return null;
    const arr = await g.json();
    if (!arr?.[0]) return null;
    return { lat: +arr[0].lat, lng: +arr[0].lon, nome: arr[0].display_name };
  }
  try {
    const o = await geocode(origem); const d = await geocode(destino);
    if (!o || !d) return JSON.stringify({ erro: "endereco_nao_encontrado" });
    const url = `https://router.project-osrm.org/route/v1/driving/${o.lng},${o.lat};${d.lng},${d.lat}?overview=false&steps=false`;
    const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!r.ok) return JSON.stringify({ erro: `osrm ${r.status}` });
    const j = await r.json();
    const rt = j?.routes?.[0];
    if (!rt) return JSON.stringify({ erro: "rota_nao_encontrada" });
    return JSON.stringify({
      origem: o.nome, destino: d.nome,
      distancia_km: +(rt.distance / 1000).toFixed(1),
      duracao_min: Math.round(rt.duration / 60),
      mapa: `https://www.google.com/maps/dir/?api=1&origin=${o.lat},${o.lng}&destination=${d.lat},${d.lng}`,
    });
  } catch (e) { return JSON.stringify({ erro: String((e as Error).message) }); }
}

// ---- ADMIN (só Felicio) ----
function isOwner(ctx: { fromNumber: string }): boolean { return ctx.fromNumber === OWNER_PHONE; }

async function toolMetricasAmz(ctx: { fromNumber: string }): Promise<string> {
  if (!isOwner(ctx)) return JSON.stringify({ erro: "ferramenta_restrita_ao_dono" });
  try {
    const { count: totalClientes } = await sb.from("billing_customers").select("*", { count: "exact", head: true });
    const { count: ativas } = await sb.from("billing_subscriptions").select("*", { count: "exact", head: true }).eq("status", "authorized");
    const { count: pausadas } = await sb.from("billing_subscriptions").select("*", { count: "exact", head: true }).in("status", ["paused", "cancelled"]);
    const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
    const { data: txs } = await sb.from("billing_transactions").select("amount").eq("status", "approved").gte("payment_date", monthStart.toISOString());
    const faturamentoMes = (txs ?? []).reduce((s, t: any) => s + Number(t.amount || 0), 0);
    const yStart = new Date(Date.now() - 86400000); yStart.setUTCHours(0, 0, 0, 0);
    const yEnd = new Date(yStart.getTime() + 86400000);
    const { data: txsY } = await sb.from("billing_transactions").select("amount").eq("status", "approved").gte("payment_date", yStart.toISOString()).lt("payment_date", yEnd.toISOString());
    const faturamentoOntem = (txsY ?? []).reduce((s, t: any) => s + Number(t.amount || 0), 0);
    return JSON.stringify({ clientes_total: totalClientes, assinaturas_ativas: ativas, pausadas_ou_canceladas: pausadas, faturamento_mes_atual: faturamentoMes, faturamento_ontem: faturamentoOntem });
  } catch (e) { return JSON.stringify({ erro: String((e as Error).message) }); }
}

async function toolInadimplentesAmz(ctx: { fromNumber: string }): Promise<string> {
  if (!isOwner(ctx)) return JSON.stringify({ erro: "ferramenta_restrita_ao_dono" });
  try {
    const { data } = await sb.from("billing_subscriptions")
      .select("id, status, amount, next_billing_date, payment_fail_count, customer_id, billing_customers(name, trade_name, phone, email)")
      .or("status.eq.overdue,payment_fail_count.gte.1")
      .order("payment_fail_count", { ascending: false }).limit(20);
    return JSON.stringify({ total: (data ?? []).length, inadimplentes: (data ?? []).map((s: any) => ({
      nome: s.billing_customers?.trade_name || s.billing_customers?.name, telefone: s.billing_customers?.phone, email: s.billing_customers?.email,
      valor: s.amount, vencimento: s.next_billing_date, falhas: s.payment_fail_count, status: s.status,
    })) });
  } catch (e) { return JSON.stringify({ erro: String((e as Error).message) }); }
}

async function toolStatusPlataforma(ctx: { fromNumber: string }): Promise<string> {
  if (!isOwner(ctx)) return JSON.stringify({ erro: "ferramenta_restrita_ao_dono" });
  try {
    const { data } = await sb.from("edge_functions_health").select("function_name, status, last_check, last_error, consecutive_failures, is_critical")
      .order("consecutive_failures", { ascending: false }).limit(50);
    const problemas = (data ?? []).filter((f: any) => f.status !== "healthy" && f.status !== "online");
    return JSON.stringify({ total_monitoradas: (data ?? []).length, com_problema: problemas.length, criticas_offline: problemas.filter((p: any) => p.is_critical), avisos: problemas.slice(0, 15) });
  } catch (e) { return JSON.stringify({ erro: String((e as Error).message) }); }
}

async function toolCriarCobrancaAmz(args: { cliente: string; valor?: number }, ctx: { fromNumber: string }): Promise<string> {
  if (!isOwner(ctx)) return JSON.stringify({ erro: "ferramenta_restrita_ao_dono" });
  const nome = (args?.cliente || "").trim();
  if (!nome) return JSON.stringify({ erro: "cliente_obrigatorio" });
  try {
    const { data: customers } = await sb.from("billing_customers")
      .select("id, name, trade_name, email, phone")
      .or(`name.ilike.%${nome}%,trade_name.ilike.%${nome}%,email.ilike.%${nome}%`).limit(3);
    if (!customers?.length) return JSON.stringify({ erro: "cliente_nao_encontrado", busca: nome });
    if (customers.length > 1) return JSON.stringify({ erro: "multiplos_clientes", candidatos: customers.map((c: any) => c.trade_name || c.name) });
    const c = customers[0];
    const r = await fetch(`${SUPABASE_URL}/functions/v1/pietro-criar-cobranca`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SERVICE_KEY}`, "apikey": SERVICE_KEY },
      body: JSON.stringify({ customer_id: c.id, amount: args?.valor ?? 597 }),
    });
    const txt = await r.text();
    if (!r.ok) return JSON.stringify({ erro: `cobranca_falhou ${r.status}`, detalhe: txt.slice(0, 200) });
    return JSON.stringify({ ok: true, cliente: c.trade_name || c.name, valor: args?.valor ?? 597, resposta: txt.slice(0, 300) });
  } catch (e) { return JSON.stringify({ erro: String((e as Error).message) }); }
}


// ---- CONSCIÊNCIA DA PLATAFORMA (dono vê tudo, cliente só o próprio) ----
async function resolveScope(ctx: { userId: string; fromNumber: string }): Promise<{ scopeUserId: string | null; isAdmin: boolean }> {
  return { scopeUserId: isOwner(ctx) ? null : ctx.userId, isAdmin: isOwner(ctx) };
}

async function toolConsultarEstoque(query: string, ctx: { userId: string; fromNumber: string }): Promise<string> {
  const q = (query || "").trim();
  const { isAdmin } = await resolveScope(ctx);
  try {
    // SEMPRE filtra pelo user_id do próprio dono da conta.
    // Mesmo sendo admin, o Jarvis só enxerga o catálogo do Felicio — nunca mistura com clientes.
    let p = sb.from("produtos").select("nome, categoria, preco, estoque, ativo, link").eq("user_id", ctx.userId).limit(20);
    if (q) p = p.or(`nome.ilike.%${q}%,descricao.ilike.%${q}%,categoria.ilike.%${q}%,tags.ilike.%${q}%`);
    const { data: prods } = await p;

    let s = sb.from("products_stock").select("name, category, price, qty, active").eq("user_id", ctx.userId).limit(20);
    if (q) s = s.or(`name.ilike.%${q}%,category.ilike.%${q}%,sku.ilike.%${q}%`);
    const { data: stock } = await s;

    const { count: totalOwn } = await sb.from("produtos").select("*", { count: "exact", head: true }).eq("user_id", ctx.userId);
    const { count: ativosOwn } = await sb.from("produtos").select("*", { count: "exact", head: true }).eq("user_id", ctx.userId).eq("ativo", true);

    return JSON.stringify({
      escopo: "somente_meu_catalogo",
      busca: q || "(sem filtro)",
      meu_catalogo_total: totalOwn ?? 0,
      meu_catalogo_ativos: ativosOwn ?? 0,
      observacao: "Estes números refletem APENAS o catálogo do dono da conta (expo@atombrasildigital.com). Nunca inclua produtos de outros clientes da plataforma. Se o usuário perguntar 'quantos produtos temos', responda com meu_catalogo_total.",
      observacao_estoque: "Produtos afiliados não têm estoque físico rastreado. Não reporte 'estoque zerado' a menos que o usuário pergunte especificamente sobre um SKU físico em products_stock.",
      encontrados_produtos: (prods ?? []).map((r: any) => ({ nome: r.nome, categoria: r.categoria, preco: r.preco, ativo: r.ativo, link: r.link })),
      encontrados_stock_fisico: (stock ?? []).map((r: any) => ({ nome: r.name, categoria: r.category, preco: r.price, qtd: r.qty, ativo: r.active })),
    });
  } catch (e) { return JSON.stringify({ erro: String((e as Error).message) }); }
}



async function toolConsultarCampanhas(ctx: { userId: string; fromNumber: string }): Promise<string> {
  const { scopeUserId, isAdmin } = await resolveScope(ctx);
  try {
    let c = sb.from("campanhas_recorrentes").select("id, nome, ativa, frequencia, proxima_execucao, ultima_execucao, total_enviados, status").order("proxima_execucao", { ascending: true }).limit(15);
    if (scopeUserId) c = c.eq("user_id", scopeUserId);
    const { data: camps } = await c;

    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    let h = sb.from("historico_envios").select("*", { count: "exact", head: true }).gte("created_at", since);
    if (scopeUserId) h = h.eq("user_id", scopeUserId);
    const { count: envios24h } = await h;

    let f = sb.from("fila_atendimento_pj").select("status", { count: "exact", head: false }).limit(1000);
    if (scopeUserId) f = f.eq("user_id", scopeUserId);
    const { data: fila } = await f;
    const filaStats = { pendente: 0, processando: 0, enviado: 0, falhou: 0 };
    (fila ?? []).forEach((r: any) => { if (filaStats[r.status as keyof typeof filaStats] !== undefined) filaStats[r.status as keyof typeof filaStats]++; });

    return JSON.stringify({
      escopo: isAdmin ? "admin_global" : "usuario",
      total_campanhas: (camps ?? []).length,
      campanhas_ativas: (camps ?? []).filter((c: any) => c.ativa).length,
      envios_ultimas_24h: envios24h ?? 0,
      fila_whatsapp: filaStats,
      campanhas: camps ?? [],
    });
  } catch (e) { return JSON.stringify({ erro: String((e as Error).message) }); }
}

async function toolConsultarAutopilot(ctx: { userId: string; fromNumber: string }): Promise<string> {
  const { scopeUserId, isAdmin } = await resolveScope(ctx);
  try {
    let a = sb.from("autopilot_config").select("id, nome, ativo, posts_por_dia, postar_facebook, postar_instagram, horario_inicio, horario_fim, total_publicados, ultima_execucao, proxima_execucao");
    if (scopeUserId) a = a.eq("user_id", scopeUserId);
    const { data: cfgs } = await a;

    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    let q = sb.from("social_posts_queue").select("platform, status", { count: "exact", head: false }).gte("created_at", since).limit(1000);
    if (scopeUserId) q = q.eq("user_id", scopeUserId);
    const { data: posts } = await q;
    const stats: Record<string, { total: number; published: number; failed: number; pending: number }> = {};
    (posts ?? []).forEach((r: any) => {
      const p = r.platform || "unknown";
      if (!stats[p]) stats[p] = { total: 0, published: 0, failed: 0, pending: 0 };
      stats[p].total++;
      if (r.status === "published") stats[p].published++;
      else if (r.status === "failed") stats[p].failed++;
      else if (r.status === "pending" || r.status === "scheduled") stats[p].pending++;
    });

    return JSON.stringify({
      escopo: isAdmin ? "admin_global" : "usuario",
      total_configs: (cfgs ?? []).length,
      configs_ativas: (cfgs ?? []).filter((c: any) => c.ativo).length,
      posts_ultimas_24h_por_rede: stats,
      configuracoes: cfgs ?? [],
    });
  } catch (e) { return JSON.stringify({ erro: String((e as Error).message) }); }
}

async function toolConsultarClientesLeads(ctx: { userId: string; fromNumber: string }): Promise<string> {
  const { scopeUserId, isAdmin } = await resolveScope(ctx);
  try {
    let c = sb.from("clientes").select("*", { count: "exact", head: true }).eq("ativo", true);
    if (scopeUserId) c = c.eq("user_id", scopeUserId);
    const { count: clientesAtivos } = await c;

    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    let cn = sb.from("clientes").select("*", { count: "exact", head: true }).gte("created_at", since);
    if (scopeUserId) cn = cn.eq("user_id", scopeUserId);
    const { count: novos7d } = await cn;

    let lb = sb.from("leads_b2b").select("*", { count: "exact", head: true });
    if (scopeUserId) lb = lb.eq("user_id", scopeUserId);
    const { count: leadsB2b } = await lb;

    let lc = sb.from("leads_b2c").select("*", { count: "exact", head: true });
    if (scopeUserId) lc = lc.eq("user_id", scopeUserId);
    const { count: leadsB2c } = await lc;

    return JSON.stringify({
      escopo: isAdmin ? "admin_global" : "usuario",
      clientes_ativos: clientesAtivos ?? 0,
      novos_clientes_7d: novos7d ?? 0,
      leads_b2b: leadsB2b ?? 0,
      leads_b2c: leadsB2c ?? 0,
    });
  } catch (e) { return JSON.stringify({ erro: String((e as Error).message) }); }
}

async function toolResumoPlataforma(ctx: { userId: string; fromNumber: string }): Promise<string> {
  try {
    const [estoque, campanhas, autopilot, leads] = await Promise.all([
      toolConsultarEstoque("", ctx),
      toolConsultarCampanhas(ctx),
      toolConsultarAutopilot(ctx),
      toolConsultarClientesLeads(ctx),
    ]);
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      estoque: JSON.parse(estoque),
      campanhas: JSON.parse(campanhas),
      autopilot: JSON.parse(autopilot),
      clientes_leads: JSON.parse(leads),
    });
  } catch (e) { return JSON.stringify({ erro: String((e as Error).message) }); }
}


// ---- Visão: descreve o que aparece em uma imagem (produto, cena, cores, texto visível) ----
// Usado antes de gerar copy pra redes sociais, pra que a legenda case com a foto do dono.
async function descreverImagemVisao(imageUrl: string): Promise<string> {
  const prompt = "Você é um leitor de imagens PRECISO. Descreva EXATAMENTE o que aparece nesta imagem em 2-4 frases, como se estivesse instruindo um copywriter que NÃO vai ver a foto. OBRIGATÓRIO: 1) Se houver QUALQUER texto/palavra/número na imagem (títulos, marcas, preços, slogans, logos, cards, banners, prints de tela), TRANSCREVA literalmente as palavras principais entre aspas. 2) Diga o tipo de imagem (foto real de produto / print de tela / arte gráfica / banner / card promocional / meme / captura de app etc.). 3) Cite objeto/pessoa principal, cor dominante e cena. NUNCA invente detalhes. Se não tiver certeza, diga 'não identificado'. Português, sem markdown, sem introdução tipo 'A imagem mostra'.";
  const tryCall = async (model: string) => {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": LOVABLE_API_KEY },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          },
        ],
      }),
    });
    if (!res.ok) {
      console.warn("[visao] falhou model=", model, "status=", res.status, (await res.text()).slice(0, 200));
      return "";
    }
    const data = await res.json();
    return (data?.choices?.[0]?.message?.content || "").trim().slice(0, 800);
  };
  try {
    // Modelo novo primeiro (mais preciso em OCR/leitura de arte). Fallback pro 2.5-pro.
    let out = await tryCall("google/gemini-3-flash-preview");
    if (!out) out = await tryCall("google/gemini-2.5-pro");
    console.log("[visao] descricao=", out.slice(0, 200));
    return out;
  } catch (e) {
    console.warn("[visao] erro:", (e as Error).message);
    return "";
  }
}



// =========================================================
// Postagem em redes sociais (Facebook + Instagram) via Jarvis
// =========================================================
async function gerarScriptRedesSociais(
  produto: { nome: string; descricao?: string | null; preco?: number | null; link?: string | null; categoria?: string | null },
  tom: string,
  rede: "facebook" | "instagram",
  ajuste?: string,
): Promise<string> {
  const tomLabel = (tom || "urgencia").toLowerCase();
  const guia: Record<string, string> = {
    urgencia: "Tom de URGÊNCIA e escassez. Use gatilhos como '⚡ ÚLTIMAS UNIDADES', 'ACABA HOJE', 'estoque limitado', contagem regressiva. CTA forte: 'Corre no link!'",
    escassez: "Tom de escassez pura. Foque em 'poucas unidades', 'apenas hoje', 'antes que acabe'.",
    "black-friday": "Tom BLACK FRIDAY: desconto agressivo, 'menor preço do ano', 'oferta relâmpago'.",
    "prova-social": "Foque em prova social: 'milhares já compraram', 'avaliação 5 estrelas', 'top vendas'.",
    beneficio: "Foque nos benefícios reais e transformação que o produto entrega.",
  };
  const guiaTom = guia[tomLabel] ?? guia["urgencia"];
  const preco = produto.preco ? `R$ ${Number(produto.preco).toFixed(2).replace(".", ",")}` : "";
  const limite = rede === "instagram" ? 2200 : 1500;
  const temLink = !!(produto.link && /^https?:\/\//i.test(produto.link));
  const ctaRegra = temLink
    ? `- CTA claro no fim ("👉 Link na bio" para IG, "👉 Compre aqui: ${produto.link}" para FB).`
    : `- CTA de engajamento no fim (ex: "👉 Chama no direct pra garantir", "Comenta EU QUERO", "Manda mensagem"). NÃO invente link, NÃO escreva "link na bio" se não existir link — foque em contato direto/interesse.`;
  const prompt = `Você é copywriter de e-commerce. Crie um post para ${rede.toUpperCase()} vendendo/divulgando este produto.
${guiaTom}

PRODUTO: ${produto.nome}
${produto.descricao ? `CONTEXTO/CONTEÚDO DA IMAGEM: ${produto.descricao}\n(IMPORTANTE: a legenda DEVE conversar com o que está na imagem — nunca contrarie ou ignore o conteúdo visual descrito acima.)` : ""}
${preco ? `PREÇO: ${preco}` : "PREÇO: (não informar valor no post)"}
${produto.categoria ? `CATEGORIA: ${produto.categoria}` : ""}
${temLink ? "" : "OBS: este produto NÃO tem link de compra — é post institucional/lifestyle/engajamento."}

REGRAS:
- Máx ${limite} caracteres.
- Comece com 1 linha impactante e emoji.
- 2-4 bullets de benefício.
${ctaRegra}
- 6-10 hashtags no final (separadas por espaço), relevantes ao produto.
- NUNCA use markdown, aspas, colchetes ou "Aqui está seu post:". Devolva SÓ o texto pronto.
${ajuste ? `\n🎯 AJUSTE OBRIGATÓRIO DO DONO (aplique EXATAMENTE, mantendo o resto do post coerente): "${ajuste}"` : ""}`;

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.9,
      }),
    });
    const data = await res.json();
    const txt = data?.choices?.[0]?.message?.content?.trim() || "";
    return txt.slice(0, limite);
  } catch (e) {
    console.error("[postar_redes] gerar script falhou:", e);
    return `🔥 ${produto.nome}${preco ? ` — ${preco}` : ""}\n\n${produto.descricao ?? ""}\n\n${temLink ? `👉 ${produto.link}` : "👉 Chama no direct pra saber mais!"}`.slice(0, limite);
  }
}

// Cache em memória + persistência no banco para posts pendentes.
// Edge Functions podem trocar de instância entre o preview e a confirmação; só Map em memória perde o token.
const SOCIAL_CONFIRMATION_TTL_MS = 2 * 60 * 60 * 1000;
type PendingSocialPost = {
  produto: any;
  tom: string;
  redes: string[];
  scripts: Record<string, string>;
  userId: string;
  createdAt: number;
  formato?: "feed" | "story" | "reels";
  midiaTipo?: "foto" | "video";
  queueRows?: Array<{ id: string; platform: string }>;
};
const PENDING_POSTS = new Map<string, PendingSocialPost>();
function pendingCleanup() {
  const now = Date.now();
  for (const [k, v] of PENDING_POSTS) if (now - v.createdAt > SOCIAL_CONFIRMATION_TTL_MS) PENDING_POSTS.delete(k);
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function pendingPostMarker(
  token: string,
  productName?: string,
  formato: "feed" | "story" | "reels" = "feed",
  midiaTipo: "foto" | "video" = "foto",
): string {
  return `jarvis_token:${token};formato:${formato};midia:${midiaTipo};produto:${(productName || "produto").replace(/[\n\r]+/g, " ").slice(0, 160)}`;
}

function productNameFromPendingMarker(marker?: string | null): string {
  return marker?.match(/;produto:(.*)$/)?.[1]?.trim() || "produto";
}

function formatoFromPendingMarker(marker?: string | null): "feed" | "story" | "reels" {
  const m = marker?.match(/;formato:(feed|story|reels)/i);
  return (m?.[1]?.toLowerCase() as "feed" | "story" | "reels") || "feed";
}

function midiaTipoFromPendingMarker(marker?: string | null): "foto" | "video" {
  const m = marker?.match(/;midia:(foto|video)/i);
  return (m?.[1]?.toLowerCase() as "foto" | "video") || "foto";
}

async function persistPendingSocialPost(token: string, pending: PendingSocialPost): Promise<Array<{ id: string; platform: string }>> {
  const rows = pending.redes.map((rede) => ({
    user_id: pending.userId,
    produto_id: isUuid(pending.produto?.id) ? pending.produto.id : null,
    produto_source: pending.produto?.source || "produtos",
    platform: rede,
    post_text: pending.scripts[rede] || "",
    image_url: pending.produto?.imagem_url || null,
    link_url: pending.produto?.link || null,
    status: "aguardando_confirmacao",
    scheduled_at: null,
    error_message: pendingPostMarker(token, pending.produto?.nome, pending.formato || "feed", pending.midiaTipo || (pending.produto as any)?.midia_tipo || "foto"),
    updated_at: new Date().toISOString(),
  }));

  const { data, error } = await sb
    .from("social_posts_queue")
    .insert(rows)
    .select("id, platform");

  if (error) throw new Error(`não consegui salvar o token de confirmação: ${error.message}`);
  return (data ?? []).map((r: any) => ({ id: r.id, platform: r.platform }));
}

async function loadPendingSocialPost(token: string, userId: string): Promise<PendingSocialPost | null> {
  const { data, error } = await sb
    .from("social_posts_queue")
    .select("id, user_id, produto_id, produto_source, platform, post_text, image_url, link_url, status, error_message, created_at")
    .eq("user_id", userId)
    .eq("status", "aguardando_confirmacao")
    .like("error_message", `jarvis_token:${token}%`)
    .order("created_at", { ascending: true })
    .limit(10);

  if (error) {
    console.warn("[social_confirm][load_error]", error.message);
    return null;
  }
  const rows = data ?? [];
  if (rows.length === 0) return null;

  const createdAt = new Date(rows[0].created_at).getTime();
  if (Number.isFinite(createdAt) && Date.now() - createdAt > SOCIAL_CONFIRMATION_TTL_MS) {
    await sb.from("social_posts_queue")
      .update({ status: "cancelado", error_message: "token_expirado", updated_at: new Date().toISOString() })
      .in("id", rows.map((r: any) => r.id));
    return null;
  }

  const scripts: Record<string, string> = {};
  for (const row of rows as any[]) scripts[row.platform] = row.post_text || "";

  const midiaTipoReidratado = midiaTipoFromPendingMarker((rows[0] as any).error_message);

  return {
    produto: {
      id: (rows[0] as any).produto_id,
      source: (rows[0] as any).produto_source,
      nome: productNameFromPendingMarker((rows[0] as any).error_message),
      imagem_url: (rows[0] as any).image_url,
      link: (rows[0] as any).link_url,
      midia_tipo: midiaTipoReidratado,
    } as any,
    tom: "urgencia",
    redes: (rows as any[]).map((r) => r.platform),
    scripts,
    userId,
    createdAt: Number.isFinite(createdAt) ? createdAt : Date.now(),
    formato: formatoFromPendingMarker((rows[0] as any).error_message),
    midiaTipo: midiaTipoReidratado,
    queueRows: (rows as any[]).map((r) => ({ id: r.id, platform: r.platform })),
  };
}

async function updatePersistedSocialPostRows(pending: PendingSocialPost, resultados: Array<{ rede: string; ok: boolean; status: number; resposta: any }>) {
  const rows = pending.queueRows ?? [];
  await Promise.all(resultados.map(async (result) => {
    const row = rows.find((r) => r.platform === result.rede);
    if (!row?.id) return;
    await sb.from("social_posts_queue")
      .update({
        status: result.ok ? "publicado" : "erro",
        fb_post_id: result.ok ? (result.resposta?.post_id || result.resposta?.id || null) : null,
        published_at: result.ok ? new Date().toISOString() : null,
        error_message: result.ok ? null : (result.resposta?.error || result.resposta?.message || `falha_${result.status || "sem_status"}`),
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);
  }));
}

async function publicarEmRede(
  rede: string,
  script: string,
  produto: { nome: string; imagem_url: string; link?: string | null; descricao?: string | null; midia_tipo?: "foto" | "video" },
  userId: string,
  formato: "feed" | "story" | "reels" = "feed",
): Promise<{ rede: string; ok: boolean; status: number; resposta: any; nota?: string }> {
  try {
    const isVideo = produto.midia_tipo === "video";
    const mediaUrl = produto.imagem_url; // pode ser URL de vídeo quando isVideo
    const commonHeaders = { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY } as const;

    // === REELS (vídeo em IG/FB) ===
    if (formato === "reels") {
      if (!isVideo) return { rede, ok: false, status: 0, resposta: { error: "reels exige vídeo — envia um vídeo, não imagem" } };
      if (rede === "tiktok") {
        // TikTok trata vídeo direto — cai no branch tiktok abaixo
      } else if (rede === "facebook" || rede === "instagram") {
        console.log(`[social-router] rede=${rede} formato=reels → meta-publish-reels`);
        const res = await fetch(`${SUPABASE_URL}/functions/v1/meta-publish-reels`, {
          method: "POST", headers: commonHeaders,
          body: JSON.stringify({ platform: rede, video_url: mediaUrl, caption: script, user_id: userId }),
        });
        const txt = await res.text(); let j: any = {}; try { j = JSON.parse(txt); } catch {}
        return { rede, ok: res.ok && j?.success !== false, status: res.status, resposta: j };
      }
    }

    // === STORY ===
    if (formato === "story") {
      if (isVideo) {
        if (rede === "tiktok") return { rede, ok: false, status: 0, resposta: { error: "TikTok não tem formato story — ignorado" } };
        console.log(`[social-router] rede=${rede} formato=story tipo=video → meta-publish-story`);
        const res = await fetch(`${SUPABASE_URL}/functions/v1/meta-publish-story`, {
          method: "POST", headers: commonHeaders,
          body: JSON.stringify({ user_id: userId, video_url: mediaUrl, canais: [rede] }),
        });
        const txt = await res.text(); let j: any = {}; try { j = JSON.parse(txt); } catch {}
        const chanResult = j?.[rede];
        const chanOk = chanResult?.ok === true;
        return { rede, ok: res.ok && chanOk, status: res.status, resposta: chanOk ? chanResult : { error: chanResult?.error || j?.error || `falha_${res.status}` } };
      }
      // Foto — comportamento anterior
      if (rede === "instagram") {
        console.log(`[social-router] rede=instagram formato=story tipo=foto → meta-publish-story-image`);
        const res = await fetch(`${SUPABASE_URL}/functions/v1/meta-publish-story-image`, {
          method: "POST", headers: commonHeaders,
          body: JSON.stringify({ user_id: userId, image_url: mediaUrl }),
        });
        const txt = await res.text(); let j: any = {}; try { j = JSON.parse(txt); } catch {}
        if (!res.ok || j?.success === false) {
          const raw = String(j?.error || j?.message || `falha_${res.status}`);
          const amigavel = /9:16|aspect|proporç|vertical|format/i.test(raw) ? "a imagem precisa ser vertical 9:16 pra story do Instagram" : raw;
          return { rede, ok: false, status: res.status, resposta: { ...j, error: amigavel } };
        }
        return { rede, ok: true, status: res.status, resposta: j };
      }
      if (rede === "facebook") {
        console.log(`[social-router] rede=facebook formato=story tipo=foto → meta-publish-story-photo-fb`);
        const res = await fetch(`${SUPABASE_URL}/functions/v1/meta-publish-story-photo-fb`, {
          method: "POST", headers: commonHeaders,
          body: JSON.stringify({ user_id: userId, image_url: mediaUrl }),
        });
        const txt = await res.text(); let j: any = {}; try { j = JSON.parse(txt); } catch {}
        if (!res.ok || j?.success === false) {
          const raw = String(j?.error || j?.message || `falha_${res.status}`);
          const amigavel = /9:16|aspect|proporç|vertical|format/i.test(raw) ? "a imagem precisa ser vertical 9:16 pra story do Facebook" : raw;
          return { rede, ok: false, status: res.status, resposta: { ...j, error: amigavel } };
        }
        return { rede, ok: true, status: res.status, resposta: j };
      }
      if (rede === "tiktok") return { rede, ok: false, status: 0, resposta: { error: "TikTok não tem formato story — ignorado" } };
    }

    // === FEED ===
    if (rede === "facebook") {
      // FB aceita vídeo direto no feed via meta-publish-post (video_url).
      const body: any = { user_id: userId, message: script };
      if (isVideo) body.video_url = mediaUrl; else { body.image_url = mediaUrl; body.link_url = produto.link; }
      const res = await fetch(`${SUPABASE_URL}/functions/v1/meta-publish-post`, {
        method: "POST", headers: commonHeaders, body: JSON.stringify(body),
      });
      const txt = await res.text(); let j: any = {}; try { j = JSON.parse(txt); } catch {}
      return { rede, ok: res.ok && j?.success !== false, status: res.status, resposta: j };
    }
    if (rede === "instagram") {
      if (isVideo) {
        // ⚠️ IG feed de vídeo ≡ Reels na Graph API desde 2022. Redirecionamos internamente pra Reels com aviso.
        console.log(`[social-router] rede=instagram formato=feed tipo=video → redirecionado pra REELS (padrão Meta)`);
        const res = await fetch(`${SUPABASE_URL}/functions/v1/meta-publish-reels`, {
          method: "POST", headers: commonHeaders,
          body: JSON.stringify({ platform: "instagram", video_url: mediaUrl, caption: script, user_id: userId }),
        });
        const txt = await res.text(); let j: any = {}; try { j = JSON.parse(txt); } catch {}
        return {
          rede, ok: res.ok && j?.success !== false, status: res.status, resposta: j,
          nota: "No Instagram, vídeo no feed vira Reels (padrão da Meta) — publiquei como Reels.",
        };
      }
      const res = await fetch(`${SUPABASE_URL}/functions/v1/meta-publish-instagram`, {
        method: "POST", headers: commonHeaders,
        body: JSON.stringify({ user_id: userId, caption: script, image_url: mediaUrl }),
      });
      const txt = await res.text(); let j: any = {}; try { j = JSON.parse(txt); } catch {}
      return { rede, ok: res.ok && j?.success !== false, status: res.status, resposta: j };
    }
    if (rede === "tiktok") {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/tiktok-post-content`, {
        method: "POST", headers: commonHeaders,
        body: JSON.stringify({ user_id: userId, content_type: isVideo ? "video" : "image", content_url: mediaUrl, title: script.slice(0, 2200), post_mode: "direct" }),
      });
      const txt = await res.text(); let j: any = {}; try { j = JSON.parse(txt); } catch {}
      return { rede, ok: res.ok && j?.success !== false, status: res.status, resposta: j };
    }
    return { rede, ok: false, status: 0, resposta: { error: "rede desconhecida" } };
  } catch (e) {
    return { rede, ok: false, status: 0, resposta: { error: String((e as Error).message) } };
  }
}

const SOCIAL_POST_STOPWORDS = new Set(["de", "da", "do", "das", "dos", "para", "pra", "pro", "por", "com", "sem", "e", "a", "o", "os", "as", "um", "uma", "no", "na", "nos", "nas", "em"]);

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))];
}

function buildSocialProductTokens(query: string): { dbTokens: string[]; scoreTokens: string[] } {
  const rawTokens = (query || "")
    .toLowerCase()
    .split(/[^a-z0-9\u00c0-\u017f]+/i)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && !SOCIAL_POST_STOPWORDS.has(normalizePt(t)));

  const expansions: Record<string, string[]> = {
    xicara: ["xicara", "xícara", "caneca", "copo", "cup"],
    tabua: ["tabua", "tábua"],
    cortar: ["cortar", "corte"],
    corte: ["corte", "cortar"],
  };

  const expanded = rawTokens.flatMap((t) => {
    const n = normalizePt(t);
    return [t, n, ...(expansions[n] ?? [])];
  });

  return {
    dbTokens: uniqueStrings(expanded).slice(0, 16),
    scoreTokens: uniqueStrings(expanded.map(normalizePt)).slice(0, 20),
  };
}

function firstProductImage(row: any): string | null {
  if (typeof row?.imagem_url === "string" && row.imagem_url.trim()) return row.imagem_url.trim();
  if (typeof row?.img_url === "string" && row.img_url.trim()) return row.img_url.trim();
  if (Array.isArray(row?.imagens)) return row.imagens.find((img: any) => typeof img === "string" && img.trim()) ?? null;
  return null;
}

function toSocialProduct(row: any, source: "produtos" | "products_stock") {
  if (source === "products_stock") {
    return {
      source,
      id: row.id,
      nome: row.name,
      descricao: row.description_short || row.description_long || null,
      preco: row.price ?? null,
      imagem_url: firstProductImage(row),
      link: null,
      categoria: row.category ?? null,
      ativo: row.active !== false,
      tags: row.sku ? [row.sku] : [],
      sku: row.sku ?? null,
    };
  }

  return {
    source,
    id: row.id,
    nome: row.nome,
    descricao: row.descricao ?? null,
    preco: row.preco ?? null,
    imagem_url: firstProductImage(row),
    link: row.link || row.link_marketplace || null,
    categoria: row.categoria ?? null,
    ativo: row.ativo !== false,
    tags: row.tags ?? [],
    sku: row.sku ?? null,
  };
}

function scoreSocialProduct(row: any, query: string, scoreTokens: string[]): number {
  const hay = normalizePt(`${row.nome ?? ""} ${row.descricao ?? ""} ${row.categoria ?? ""} ${Array.isArray(row.tags) ? row.tags.join(" ") : row.tags ?? ""} ${row.sku ?? ""}`);
  const queryNorm = normalizePt(query);
  let score = hay.includes(queryNorm) ? 8 : 0;
  for (const token of scoreTokens) {
    if (!token) continue;
    if (hay.includes(token)) score += 3;
    else if (token.length > 4 && hay.includes(token.slice(0, -1))) score += 1;
  }
  if (normalizePt(row.nome ?? "").includes(scoreTokens[0] ?? "__never__")) score += 2;
  if (row.ativo) score += 1;
  if (row.imagem_url) score += 1;
  return score;
}

function sanitizeSocialProductText(text: string): string {
  let product = compactSpaces(text || "");
  product = product.replace(/\bcom\s+(?:um\s+)?script\b.*$/i, "");
  product = product.replace(/\b(?:script|copy|legenda)\s+(?:de\s+)?(?:urg[eê]ncia|escassez|benef[ií]cio|prova social|black\s*friday)\b.*$/i, "");
  product = product.replace(/\b(?:posta|poste|postar|publica|publique|publicar)\b/gi, " ");
  product = product.replace(/\b(?:no|na|nos|nas|em|para|pra|pro)\s+(?:o\s+|a\s+)?(?:face|facebook|fb|insta|instagram|ig|tiktok|tik\s*tok|redes sociais|stor(?:y|ies|ie)|reels?|feed)\b/gi, " ");
  product = product.replace(/\b(?:face|facebook|fb|insta|instagram|ig|tiktok|tik\s*tok|redes sociais|stor(?:y|ies|ie)|reels?|feed)\b/gi, " ");
  product = product.replace(/\b(?:e|de|do|da|dos|das|no|na|nos|nas|em|para|pra|pro|o|a|os|as|um|uma)\b/gi, " ");
  product = product.replace(/^\s*produtos?\s+/i, "");
  return compactSpaces(product.replace(/^[,.;:!\s-]+|[,.;:!\s-]+$/g, ""));
}

async function buscarProdutoParaPostagem(query: string, userId: string): Promise<{ produto: any | null; sugestoes: string[]; candidatos: any[] }> {
  const { dbTokens, scoreTokens } = buildSocialProductTokens(query);
  const produtoFilter = dbTokens
    .map((t) => `nome.ilike.%${t}%,descricao.ilike.%${t}%,categoria.ilike.%${t}%,tags.cs.{${t}},sku.ilike.%${t}%`)
    .join(",");
  const stockFilter = dbTokens
    .map((t) => `name.ilike.%${t}%,description_short.ilike.%${t}%,description_long.ilike.%${t}%,category.ilike.%${t}%,sku.ilike.%${t}%`)
    .join(",");

  const [produtosRes, stockRes] = await Promise.all([
    produtoFilter
      ? sb.from("produtos")
        .select("id, nome, descricao, preco, imagem_url, imagens, link, link_marketplace, categoria, ativo, tags, sku")
        .eq("user_id", userId)
        .or(produtoFilter)
        .limit(80)
      : sb.from("produtos")
        .select("id, nome, descricao, preco, imagem_url, imagens, link, link_marketplace, categoria, ativo, tags, sku")
        .eq("user_id", userId)
        .limit(80),
    stockFilter
      ? sb.from("products_stock")
        .select("id, name, description_short, description_long, price, img_url, category, active, sku")
        .eq("user_id", userId)
        .or(stockFilter)
        .limit(80)
      : sb.from("products_stock")
        .select("id, name, description_short, description_long, price, img_url, category, active, sku")
        .eq("user_id", userId)
        .limit(80),
  ]);

  if (produtosRes.error) console.warn("[social_post_search][produtos_error]", produtosRes.error.message);
  if (stockRes.error) console.warn("[social_post_search][stock_error]", stockRes.error.message);

  let candidatos = [
    ...(produtosRes.data ?? []).map((r: any) => toSocialProduct(r, "produtos")),
    ...(stockRes.data ?? []).map((r: any) => toSocialProduct(r, "products_stock")),
  ];

  // Fallback local: cobre acentos, singular/plural e pequenas diferenças como "cortar" vs "corte".
  if (candidatos.length === 0 || !candidatos.some((c) => scoreSocialProduct(c, query, scoreTokens) > 0)) {
    const [allProdutos, allStock] = await Promise.all([
      sb.from("produtos")
        .select("id, nome, descricao, preco, imagem_url, imagens, link, link_marketplace, categoria, ativo, tags, sku")
        .eq("user_id", userId)
        .limit(500),
      sb.from("products_stock")
        .select("id, name, description_short, description_long, price, img_url, category, active, sku")
        .eq("user_id", userId)
        .limit(500),
    ]);
    candidatos = [
      ...(allProdutos.data ?? []).map((r: any) => toSocialProduct(r, "produtos")),
      ...(allStock.data ?? []).map((r: any) => toSocialProduct(r, "products_stock")),
    ];
  }

  const ranked = candidatos
    .map((r) => ({ r, s: scoreSocialProduct(r, query, scoreTokens) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || Number(b.r.ativo) - Number(a.r.ativo) || Number(Boolean(b.r.imagem_url)) - Number(Boolean(a.r.imagem_url)) || (a.r.nome?.length ?? 999) - (b.r.nome?.length ?? 999));

  console.log("[social_post_search]", JSON.stringify({ query, dbTokens, total: candidatos.length, ranked: ranked.slice(0, 5).map((x) => ({ nome: x.r.nome, score: x.s, source: x.r.source })) }));

  return {
    produto: ranked[0]?.r ?? null,
    sugestoes: ranked.slice(0, 7).map((x) => x.r.nome),
    candidatos,
  };
}

function detectSocialPostFormat(text: string): "feed" | "story" | "reels" | undefined {
  const normalized = normalizePt(text || "");
  if (/\bstor(y|ies|ie)\b/.test(normalized)) return "story";
  if (/\breels?\b/.test(normalized)) return "reels";
  if (/\bfeed\b/.test(normalized)) return "feed";
  return undefined;
}

function cleanMediaPostLegenda(text: string): string | undefined {
  let legenda = compactSpaces(text || "").replace(/^jarvis[,.!\s-]*/i, "");
  legenda = sanitizeSocialProductText(legenda);
  const genericOnly = /^(?:isso|essa|esse|esta|este|foto|imagem|video|vídeo|midia|mídia|produto|ai|aí|la|lá|agora|hoje)$/i;
  if (!legenda || legenda.length < 3 || genericOnly.test(normalizePt(legenda))) return undefined;
  return legenda;
}

async function buscarMidiaRecenteParaPostagem(userId: string): Promise<{ id: string; tipo: string; created_at: string } | null> {
  const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { data, error } = await sb
    .from("midias_whatsapp")
    .select("id, tipo, created_at")
    .eq("user_id", userId)
    .in("tipo", ["foto", "video"])
    .gte("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) {
    console.warn("[pietro][forced_social_post][midia_recente_error]", error.message);
    return null;
  }
  return (data?.[0] as { id: string; tipo: string; created_at: string } | undefined) ?? null;
}

// ---- Estado pendente de escolha de FORMATO (feed/story) — Etapa 2 ----
// Quando o dono manda foto + "posta no Instagram" sem dizer formato, guardamos
// as redes/tom/legenda aqui e perguntamos "feed ou story?". Quando ele
// responder só "feed"/"story"/"no story", retomamos sem exigir reenvio da foto.
type PendingFormatChoice = {
  redes: string[];
  tom: string;
  legenda?: string;
  createdAt: number;
};
const PENDING_FORMAT_CHOICES = new Map<string, PendingFormatChoice>();
const PENDING_FORMAT_TTL_MS = 10 * 60 * 1000;

function setPendingFormatChoice(userId: string, p: Omit<PendingFormatChoice, "createdAt">) {
  PENDING_FORMAT_CHOICES.set(userId, { ...p, createdAt: Date.now() });
}
function getPendingFormatChoice(userId: string): PendingFormatChoice | null {
  const p = PENDING_FORMAT_CHOICES.get(userId);
  if (!p) return null;
  if (Date.now() - p.createdAt > PENDING_FORMAT_TTL_MS) {
    PENDING_FORMAT_CHOICES.delete(userId);
    return null;
  }
  return p;
}
function clearPendingFormatChoice(userId: string) { PENDING_FORMAT_CHOICES.delete(userId); }

// Detecta resposta curta só com o formato: "feed", "story", "reels", "no story", "nos stories" etc.
function detectStandaloneFormatReply(text: string): "feed" | "story" | "reels" | undefined {
  const n = normalizePt(compactSpaces(text || "")).replace(/[.!?]+$/g, "").trim();
  if (!n || n.length > 40) return undefined;
  if (/^(pode\s+postar\s+)?(no\s+|nos\s+|em\s+)?(o\s+|a\s+)?feed$/.test(n)) return "feed";
  if (/^(pode\s+postar\s+)?(no\s+|nos\s+|em\s+)?(o\s+|a\s+)?stor(y|ies|ie)$/.test(n)) return "story";
  if (/^(pode\s+postar\s+(em\s+|no\s+|nos\s+)?)?(no\s+|nos\s+|em\s+)?(o\s+|a\s+|um\s+)?reels?$/.test(n)) return "reels";
  return undefined;
}

function detectSocialPostIntent(text: string): { produto: string; tom: string; redes: string[]; temProduto: boolean; formato?: "feed" | "story" | "reels" } | null {
  const original = compactSpaces(text || "");
  const normalized = normalizePt(original);
  if (!/\b(posta|poste|postar|publica|publique|publicar)\b/.test(normalized)) return null;

  const redes: string[] = [];
  if (/\b(face|facebook|fb)\b/.test(normalized)) redes.push("facebook");
  if (/\b(insta|instagram|ig)\b/.test(normalized)) redes.push("instagram");
  if (/\b(tiktok|tik tok)\b/.test(normalized)) redes.push("tiktok");
  if (redes.length === 0 && /\bredes sociais\b/.test(normalized)) redes.push("facebook", "instagram", "tiktok");
  const formatoPedido = detectSocialPostFormat(original);
  if (redes.length === 0 && !formatoPedido) return null;

  const tom = /black\s*friday/i.test(original) ? "black-friday"
    : /prova social/i.test(normalized) ? "prova-social"
    : /benef/i.test(normalized) ? "beneficio"
    : /escassez/i.test(normalized) ? "escassez"
    : "urgencia";

  const withoutJarvis = original.replace(/^jarvis[,.!\s-]*/i, "");
  let produto = "";
  const direct = withoutJarvis.match(/\b(?:posta|poste|postar|publica|publique|publicar)\s+(?:o|a|os|as)?\s*(.+?)(?:\s+(?:no|na|nos|nas|em|para|pra|pro)\s+(?:o\s+|a\s+)?(?:face|facebook|fb|insta|instagram|ig|tiktok|tik\s*tok|redes sociais|stor(?:y|ies|ie)|reels?|feed)\b|\s+com\s+(?:um\s+)?script\b|$)/i);
  if (direct?.[1]) produto = direct[1];

  const afterNetworks = withoutJarvis.match(/\b(?:face|facebook|fb|insta|instagram|ig|tiktok|tik\s*tok|redes sociais|stor(?:y|ies|ie)|reels?|feed)\b(?:\s*(?:e|,|\/|\+|no|na|nos|nas|em|para|pra|pro)?\s*(?:face|facebook|fb|insta|instagram|ig|tiktok|tik\s*tok|redes sociais|stor(?:y|ies|ie)|reels?|feed)\b)*\s+(?:o|a|os|as)?\s*(.+?)(?:\s+com\s+(?:um\s+)?script\b|$)/i);
  if ((!produto || /^(nas?|nos?|em|para|pra|pro|face|facebook|insta|instagram|ig|fb|stor(y|ies|ie)|reels?|feed)\b/i.test(produto)) && afterNetworks?.[1]) produto = afterNetworks[1];

  const explicitProduct = withoutJarvis.match(/\bproduto\s+(.+?)(?:\s+com\s+(?:um\s+)?script\b|$)/i);
  if ((!produto || /^(nas?|nos?|em|para|pra|pro)\b/i.test(produto)) && explicitProduct?.[1]) produto = explicitProduct[1];

  produto = sanitizeSocialProductText(produto);
  const temProduto = !!produto && produto.length >= 3;
  return { produto: temProduto ? produto : "", tom, redes: uniqueStrings(redes), temProduto, formato: formatoPedido };
}

function formatSocialPostToolResult(raw: string): string {
  let data: any = null;
  try { data = JSON.parse(raw); } catch { return raw; }

  if (data?.status === "aguardando_confirmacao") {
    const scripts = Object.entries(data.preview ?? {})
      .map(([rede, script]) => `*${rede.toUpperCase()}*\n${script}`)
      .join("\n\n");
    const avisoReels = data?.aviso_reels ? `\n\n_ℹ️ ${data.aviso_reels}_` : "";
    // <<SPLIT>> marca quebra em MENSAGENS separadas no WhatsApp — o Felicio pediu o comando de confirmação isolado pra copiar/colar só o post.
    return `Perfeito, Felicio. Encontrei: *${data.produto?.nome ?? "produto"}*\n\n${scripts}${avisoReels}<<SPLIT>>pode postar ${data.token}`;
  }

  if (data?.status === "publicado") {
    const redesArr = Array.isArray(data.redes_publicadas) ? data.redes_publicadas : [];
    const redesFmt = redesArr.length
      ? redesArr.map((r: string) => `✅ *${String(r).toUpperCase()}*`).join("\n")
      : "⚠️ *nenhuma rede publicou*";
    const falhas = Array.isArray(data.redes_falharam) && data.redes_falharam.length
      ? `\n\n❌ *Falhas:*\n${data.redes_falharam.map((f: any) => `• ${f.rede}${f.erro ? ` — ${f.erro}` : ""}`).join("\n")}`
      : "";
    const notas = Array.isArray(data.notas) && data.notas.length
      ? `\n\n${data.notas.map((n: string) => `ℹ️ ${n}`).join("\n")}`
      : "";
    const header = redesArr.length ? "🎉 *POSTAGEM REALIZADA COM SUCESSO!* 🎉" : "⚠️ *POSTAGEM NÃO CONCLUÍDA*";
    return `${header}\n\n📢 *${data.produto?.nome ?? "produto"}*\n\n${redesFmt}${notas}${falhas}`;
  }

  if (data?.status === "cancelado") return "Preview cancelado. Não publiquei nada.";

  if (data?.erro) {
    const sugestoes = Array.isArray(data.sugestoes_do_catalogo) && data.sugestoes_do_catalogo.length
      ? `\n\nSugestões mais próximas:\n${data.sugestoes_do_catalogo.map((s: string) => `• ${s}`).join("\n")}`
      : "";
    return `Não consegui preparar o post: ${data.erro}.${sugestoes}`;
  }

  return raw;
}

function detectSocialPostConfirmation(text: string): { token: string; cancelar?: boolean } | null {
  const normalized = normalizePt(text || "");
  const token = (text || "").match(/\b[a-f0-9]{8}\b/i)?.[0];
  if (!token) return null;
  if (/\b(cancela|cancelar|nao posta|nao publicar|descarta)\b/.test(normalized)) return { token, cancelar: true };
  if (/\b(pode postar|confirma|confirmar|manda ver|publica|publique|sim|aprovado)\b/.test(normalized)) return { token };
  return null;
}

async function toolPostarRedesSociais(
  args: { produto: string; tom?: string; redes?: string[] },
  ctx: { userId: string; fromNumber: string },
): Promise<string> {
  try {
    if (!isOwner(ctx)) return JSON.stringify({ erro: "Publicação em redes sociais liberada apenas para o dono (Felicio) nesta fase. Em breve para todos os clientes PJ." });
    pendingCleanup();
    const q = (args?.produto || "").trim();
    if (!q) return JSON.stringify({ erro: "informe qual produto postar" });

    const redesValidas = ["facebook", "instagram", "tiktok"];
    const redes = (args?.redes && args.redes.length > 0 ? args.redes : ["facebook", "instagram", "tiktok"])
      .map((r) => r.toLowerCase())
      .filter((r) => redesValidas.includes(r));
    const tom = args?.tom || "urgencia";

    const { produto: prod, sugestoes, candidatos } = await buscarProdutoParaPostagem(q, ctx.userId);

    if (!prod) {
      return JSON.stringify({
        erro: `produto "${q}" não encontrado`,
        dica: "Tente uma palavra-chave do nome real ou escolha uma das sugestões abaixo.",
        sugestoes_do_catalogo: sugestoes.length ? sugestoes : (candidatos ?? []).slice(0, 7).map((r: any) => r.nome),
      });
    }

    if (prod.ativo === false) return JSON.stringify({ erro: `produto "${prod.nome}" foi encontrado, mas está inativo no catálogo`, sugestoes_do_catalogo: sugestoes });
    if (!prod.imagem_url && redes.some((r) => r === "instagram" || r === "tiktok")) {
      return JSON.stringify({ erro: `produto "${prod.nome}" não tem imagem cadastrada — Instagram/TikTok exigem imagem`, sugestoes_do_catalogo: sugestoes });
    }

    // Gera scripts em paralelo (uma vez só) para preview
    const scriptsEntries = await Promise.all(
      redes.map(async (r) => {
        const redeGen = r === "tiktok" ? "instagram" : (r as "facebook" | "instagram");
        return [r, await gerarScriptRedesSociais(prod, tom, redeGen)] as const;
      }),
    );
    const scripts: Record<string, string> = Object.fromEntries(scriptsEntries);

    const token = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
    const pending: PendingSocialPost = { produto: prod, tom, redes, scripts, userId: ctx.userId, createdAt: Date.now() };
    const queueRows = await persistPendingSocialPost(token, pending);
    PENDING_POSTS.set(token, { ...pending, queueRows });

    return JSON.stringify({
      status: "aguardando_confirmacao",
      token,
      produto: { nome: prod.nome, preco: prod.preco, imagem_url: prod.imagem_url, link: prod.link },
      tom,
      redes,
      preview: scripts,
      instrucoes: `Mostre ao usuário o produto, tom, redes e os scripts (um por rede). Peça confirmação clara. Se confirmar, chame confirmar_postagem_redes com token="${token}". Se pedir mudanças, gere novo preview.`,
    });
  } catch (e) {
    return JSON.stringify({ erro: String((e as Error).message) });
  }
}

async function toolConfirmarPostagemRedes(
  args: { token: string; cancelar?: boolean },
  ctx: { userId: string; fromNumber: string },
): Promise<string> {
  if (!isOwner(ctx)) return JSON.stringify({ erro: "ferramenta_restrita_ao_dono" });
  pendingCleanup();
  const token = (args?.token || "").trim().toLowerCase();
  if (!/^[a-f0-9]{8}$/.test(token)) return JSON.stringify({ erro: "token inválido" });
  const p = PENDING_POSTS.get(token) ?? (await loadPendingSocialPost(token, ctx.userId));
  if (!p) return JSON.stringify({ erro: "token não encontrado ou expirado. Refaça o pedido de postagem." });
  if (p.userId !== ctx.userId) return JSON.stringify({ erro: "token pertence a outro usuário" });
  if (args?.cancelar) {
    PENDING_POSTS.delete(token);
    if (p.queueRows?.length) {
      await sb.from("social_posts_queue")
        .update({ status: "cancelado", error_message: "cancelado_pelo_whatsapp", updated_at: new Date().toISOString() })
        .in("id", p.queueRows.map((r) => r.id));
    }
    return JSON.stringify({ status: "cancelado" });
  }

  const resultados = await Promise.all(p.redes.map((r) => publicarEmRede(r, p.scripts[r], p.produto, p.userId, p.formato || "feed")));
  await updatePersistedSocialPostRows(p, resultados);
  PENDING_POSTS.delete(token);
  return JSON.stringify({
    status: "publicado",
    produto: { nome: p.produto.nome },
    redes_publicadas: resultados.filter((r) => r.ok).map((r) => r.rede),
    redes_falharam: resultados.filter((r) => !r.ok).map((r) => ({ rede: r.rede, status: r.status, erro: r.resposta?.error || r.resposta?.message })),
    notas: resultados.filter((r) => r.ok && (r as any).nota).map((r) => (r as any).nota),
    detalhes: resultados,
  });
}


// ---- revisar_post_pendente: regenera o script com um ajuste solicitado pelo dono, MANTENDO token/mídia/formato ----
async function toolRevisarPostPendente(
  args: { token: string; ajuste: string },
  ctx: { userId: string; fromNumber: string },
): Promise<string> {
  if (!isOwner(ctx)) return JSON.stringify({ erro: "ferramenta_restrita_ao_dono" });
  pendingCleanup();
  const token = (args?.token || "").trim().toLowerCase();
  const ajuste = (args?.ajuste || "").toString().trim();
  if (!/^[a-f0-9]{8}$/.test(token)) return JSON.stringify({ erro: "token inválido" });
  if (ajuste.length < 2) return JSON.stringify({ erro: "ajuste vazio — descreva o que mudar" });

  const p = PENDING_POSTS.get(token) ?? (await loadPendingSocialPost(token, ctx.userId));
  if (!p) return JSON.stringify({ erro: "token não encontrado ou expirado. Refaça o pedido de postagem." });
  if (p.userId !== ctx.userId) return JSON.stringify({ erro: "token pertence a outro usuário" });

  // Reconstroi produtoLike com descrição/contexto atual — não repergunta contexto.
  let produtoLike: any = { ...p.produto };
  const source = p.produto?.source;
  try {
    if (source === "midias_whatsapp" && p.produto?.id) {
      const { data: midia } = await sb.from("midias_whatsapp").select("id, tipo, midia_url, contexto_original").eq("id", p.produto.id).single();
      if (midia) {
        const contextoRaw = (midia.contexto_original || "").toString();
        const mVisao = contextoRaw.match(/\[visão\]\s*([\s\S]+)/i);
        const descricaoVisual = mVisao ? mVisao[1].trim() : "";
        const contextoUsuario = contextoRaw.replace(/\n?\[visão\][\s\S]*/i, "").trim();
        const isVideo = midia.tipo === "video";
        const descricaoFinal = isVideo
          ? contextoUsuario
          : [contextoUsuario, descricaoVisual ? `Conteúdo da imagem: ${descricaoVisual}` : ""].filter(Boolean).join("\n").trim();
        produtoLike = {
          ...produtoLike,
          nome: p.produto.nome,
          descricao: descricaoFinal || null,
          imagem_url: midia.midia_url,
          midia_tipo: isVideo ? "video" : "foto",
        };
      }
    } else if (source === "produtos" && p.produto?.id) {
      const { data: prod } = await sb.from("produtos").select("*").eq("id", p.produto.id).single();
      if (prod) produtoLike = { ...prod, source: "produtos" };
    }
  } catch (e) {
    console.warn("[revisar_post] reload produto falhou:", (e as Error).message);
  }

  const tom = p.tom || "urgencia";
  const scriptsEntries = await Promise.all(
    p.redes.map(async (r) => {
      const redeGen = r === "tiktok" ? "instagram" : (r as "facebook" | "instagram");
      return [r, await gerarScriptRedesSociais(produtoLike, tom, redeGen, ajuste)] as const;
    }),
  );
  const scripts: Record<string, string> = Object.fromEntries(scriptsEntries);

  // Atualiza social_posts_queue (mantém error_message/marker/token e status intactos).
  if (p.queueRows?.length) {
    await Promise.all(p.queueRows.map((row) => {
      const novo = scripts[row.platform];
      if (!novo) return Promise.resolve();
      return sb.from("social_posts_queue")
        .update({ post_text: novo, updated_at: new Date().toISOString() })
        .eq("id", row.id);
    }));
  }

  // Atualiza cache em memória.
  const atualizado: PendingSocialPost = { ...p, scripts };
  PENDING_POSTS.set(token, atualizado);

  return JSON.stringify({
    status: "aguardando_confirmacao",
    revisado: true,
    token,
    formato: p.formato || "feed",
    redes: p.redes,
    preview: scripts,
    instrucoes: `Mostre o script REVISADO ao dono e pergunte "quer mais algum ajuste ou pode postar?". Se pedir novo ajuste, chame revisar_post_pendente de novo com o MESMO token="${token}". Se confirmar, chame confirmar_postagem_redes com token="${token}".`,
  });
}





// ---- salvar_midia_biblioteca: pega a mídia enviada pelo cliente (foto/vídeo/áudio) e salva na biblioteca de Mídias ----
async function salvarItemMidiaBiblioteca(
  media: MediaExtract,
  ctx: { userId: string; fromNumber?: string },
  contexto: string,
): Promise<{ id: string; tipo: "foto" | "video" | "audio"; url: string }> {
  const bytes = base64Decode(media.base64);
  const tipoMap = { image: "foto", video: "video", audio: "audio" } as const;
  const tipo = tipoMap[media.kind as keyof typeof tipoMap] || "foto";
  const ext = (media.mime.split("/")[1] || "bin").split(";")[0];
  const fileName = `midias/${ctx.userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error: upErr } = await sb.storage
    .from("produtos")
    .upload(fileName, bytes, { contentType: media.mime, upsert: false });
  if (upErr) throw new Error(`upload_falhou: ${upErr.message}`);

  const { data: pub } = sb.storage.from("produtos").getPublicUrl(fileName);
  const url = pub?.publicUrl;
  if (!url) throw new Error("sem_url_publica");

  const { data: novo, error: insErr } = await sb
    .from("midias_whatsapp")
    .insert({
      user_id: ctx.userId,
      origem: "whatsapp",
      telefone_origem: ctx.fromNumber ?? null,
      tipo,
      midia_url: url,
      mime_type: media.mime,
      tamanho_bytes: bytes.length,
      contexto_original: contexto || media.caption || null,
      status: "pendente",
    })
    .select("id")
    .single();

  if (insErr) throw new Error(`db_falhou: ${insErr.message}`);
  console.log("[salvar_midia] salvo id=", novo.id, "tipo=", tipo, "bytes=", bytes.length, "url=", url);
  return { id: novo.id, tipo, url };
}


function respostaMidiaSalva(salvos: Array<{ tipo: "foto" | "video" | "audio" }>, descricaoVisual?: string): string {
  const total = salvos.length;
  const tipos = salvos.reduce((acc, item) => {
    acc[item.tipo] = (acc[item.tipo] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const partes = [
    tipos.foto ? `${tipos.foto} foto${tipos.foto > 1 ? "s" : ""}` : "",
    tipos.video ? `${tipos.video} vídeo${tipos.video > 1 ? "s" : ""}` : "",
    tipos.audio ? `${tipos.audio} áudio${tipos.audio > 1 ? "s" : ""}` : "",
  ].filter(Boolean).join(", ");
  const temFoto = (tipos.foto ?? 0) > 0;
  const temVideo = (tipos.video ?? 0) > 0;
  // VÍDEO: como não temos visão de vídeo, coletar rede+formato+legenda numa pergunta só (evita loop de contexto).
  if (temVideo && !temFoto) {
    return `Salvei ${partes} na biblioteca /midias. Como não consigo assistir vídeo, me diga tudo numa mensagem só: **onde publicar** (Instagram / Facebook / ambos), **formato** (Feed, Story ou Reels) e uma **legenda/contexto** (do que se trata). Ex.: "Reels no Insta e Face — Interruptor touch-screen Tramontina, chique e prático".`;
  }
  if (temFoto && descricaoVisual?.trim()) {
    return `Oi chefe, salvei ${partes || "a mídia"} na biblioteca /midias. Estou vendo uma imagem que mostra: ${descricaoVisual.trim()}\n\nO que você quer que eu faça com ela? Posso preparar a legenda e o post para as redes.`;
  }
  const instrucao = temFoto
    ? " INSTRUÇÃO PRO ASSISTENTE: analise VISUALMENTE a(s) imagem(ns) que o cliente acabou de mandar (você as recebeu no conteúdo desta mensagem) e descreva em 1-2 frases o que aparece nela (produto, cena, cor, contexto). Depois confirme que salvou. NÃO responda genericamente — mostre que viu a foto."
    : "";
  return `${total === 1 ? "Salvei" : "Salvei"} ${partes || "a mídia"} na biblioteca /midias. Não usei produto do catálogo; publique/reuse por lá quando quiser.${instrucao}`;
}

async function descreverFotosSalvas(
  medias: MediaExtract[],
  salvos: Array<{ id: string; tipo: "foto" | "video" | "audio"; url: string }>,
  contexto: string,
): Promise<string> {
  const fotos = medias
    .map((m, i) => ({ m, id: salvos[i]?.id, tipo: salvos[i]?.tipo, url: salvos[i]?.url }))
    .filter((x) => x.tipo === "foto");
  if (fotos.length === 0) return "";

  const descricoes = await Promise.all(fotos.map(async (f) => {
    let d = f.url ? await descreverImagemVisao(f.url) : "";
    if (!d) {
      const dataUrl = `data:${f.m.mime};base64,${f.m.base64}`;
      d = await descreverImagemVisao(dataUrl);
    }
    if (d && f.id) {
      await sb
        .from("midias_whatsapp")
        .update({ contexto_original: contexto ? `${contexto}\n\n[visão] ${d}` : `[visão] ${d}` })
        .eq("id", f.id);
    }
    return d;
  }));
  return descricoes.filter(Boolean).join(" | ");
}

async function toolSalvarMidiaBiblioteca(
  args: { contexto?: string },
  ctx: { userId: string; fromNumber?: string; media?: MediaExtract[] },
): Promise<string> {
  const medias = (ctx.media || []).filter((m) => m.kind === "image" || m.kind === "video" || m.kind === "audio");
  if (medias.length === 0) {
    return JSON.stringify({
      erro: "sem_midia",
      mensagem: "Não encontrei nenhuma foto, vídeo ou áudio nessa conversa. Me manda a mídia e depois pede pra salvar.",
    });
  }

  try {
    const contexto = (args?.contexto || "").trim();
    const salvos = await Promise.all(medias.map((m) => salvarItemMidiaBiblioteca(m, ctx, contexto)));

    // Descreve a(s) foto(s) por visão pra Jarvis conseguir comentar o que viu e pra alimentar futura copy.
    let descricaoVisual = "";
    try {
      descricaoVisual = await descreverFotosSalvas(medias, salvos, contexto);
    } catch (e) {
      console.warn("[salvar_midia][visao] falhou:", (e as Error).message);
    }

    return JSON.stringify({
      ok: true,
      midia_id: salvos[0]?.id,
      midia_ids: salvos.map((s) => s.id),
      tipos: salvos.map((s) => s.tipo),
      descricao_visual: descricaoVisual || undefined,
      mensagem: respostaMidiaSalva(salvos, descricaoVisual),
      instrucao_assistente: descricaoVisual
        ? `Você VIU a imagem. Ela mostra: "${descricaoVisual}". Comente 1-2 linhas confirmando o que viu (produto/tema/cor/texto principal) antes de dizer que salvou em /midias. NÃO responda genérico.`
        : undefined,
    });
  } catch (e) {
    return JSON.stringify({ erro: String((e as Error).message) });
  }
}

// ---- postar_midia_biblioteca: gera preview de post usando a ÚLTIMA mídia salva em /midias (não busca catálogo) ----
async function toolPostarMidiaBiblioteca(
  args: { legenda?: string; nome?: string; preco?: number | string; tom?: string; redes?: string[]; midia_id?: string; formato?: string },
  ctx: { userId: string; fromNumber: string },
): Promise<string> {
  try {
    if (!isOwner(ctx)) return JSON.stringify({ erro: "Publicação em redes sociais liberada apenas para o dono (Felicio) nesta fase." });
    pendingCleanup();

    // Busca a última mídia salva pelo dono (foto/vídeo), ainda não publicada
    let query = sb
      .from("midias_whatsapp")
      .select("id, tipo, midia_url, contexto_original, created_at")
      .eq("user_id", ctx.userId)
      .in("tipo", ["foto", "video"])
      .order("created_at", { ascending: false })
      .limit(1);
    if (args?.midia_id) query = sb
      .from("midias_whatsapp")
      .select("id, tipo, midia_url, contexto_original, created_at")
      .eq("user_id", ctx.userId)
      .eq("id", args.midia_id)
      .limit(1);

    const { data: midias, error } = await query;
    if (error) return JSON.stringify({ erro: `db_falhou: ${error.message}` });
    const midia = midias?.[0];
    if (!midia) return JSON.stringify({ erro: "Não achei nenhuma mídia recente na biblioteca /midias. Peça pro cliente enviar a foto/vídeo primeiro." });

    // Etapa 3: story de foto e vídeo, reels (só vídeo), feed (foto/vídeo).
    const formatoRaw = (args?.formato || "feed").toString().toLowerCase();
    const formato: "feed" | "story" | "reels" =
      formatoRaw === "story" ? "story" : formatoRaw === "reels" ? "reels" : "feed";
    const isVideo = midia.tipo === "video";
    if (formato === "reels" && !isVideo) {
      return JSON.stringify({ erro: "Reels só aceita vídeo. Envia um vídeo curto vertical (ideal ≥3s, 9:16) e peça de novo." });
    }

    const redesValidas = ["facebook", "instagram", "tiktok"];
    let redes = (args?.redes && args.redes.length > 0 ? args.redes : ["facebook", "instagram", "tiktok"])
      .map((r) => r.toLowerCase())
      .filter((r) => redesValidas.includes(r));
    // TikTok não tem story — remove da lista pra story
    if (formato === "story") redes = redes.filter((r) => r !== "tiktok");
    // Reels só faz sentido em IG/FB
    if (formato === "reels") redes = redes.filter((r) => r !== "tiktok");
    if (redes.length === 0) return JSON.stringify({ erro: `nenhuma rede válida para formato ${formato}` });
    const tom = args?.tom || "urgencia";

    const precoNum = args?.preco != null ? Number(String(args.preco).replace(",", ".").replace(/[^\d.]/g, "")) : null;

    // Extrai descrição visual já salva (se veio de salvar_midia_biblioteca) ou gera agora por visão (SÓ FOTO — vídeo não tem visão).
    const contextoRaw = (midia.contexto_original || "").toString();
    let descricaoVisual = "";
    const mVisao = contextoRaw.match(/\[visão\]\s*([\s\S]+)/i);
    if (mVisao) descricaoVisual = mVisao[1].trim();
    if (!descricaoVisual && !isVideo) {
      descricaoVisual = await descreverImagemVisao(midia.midia_url);
      if (descricaoVisual) {
        await sb.from("midias_whatsapp").update({
          contexto_original: contextoRaw ? `${contextoRaw}\n\n[visão] ${descricaoVisual}` : `[visão] ${descricaoVisual}`,
        }).eq("id", midia.id);
      }
    }
    const contextoUsuario = contextoRaw.replace(/\n?\[visão\][\s\S]*/i, "").trim();

    // VÍDEO precisa de contexto do dono (não temos visão de vídeo — não inventar descrição).
    const legendaDono = (args?.legenda || contextoUsuario || "").toString().trim();
    if (isVideo && !legendaDono) {
      return JSON.stringify({
        erro: "video_sem_contexto",
        mensagem: "Não vejo o conteúdo do vídeo. Me manda a legenda/contexto (do que se trata?) que eu uso como texto do post.",
      });
    }

    const nome = (args?.nome || legendaDono || "Produto").toString().trim().slice(0, 120);
    const descricaoFinal = isVideo
      ? legendaDono  // vídeo: usa direto o texto do dono, sem alucinar
      : [legendaDono, descricaoVisual ? `Conteúdo da imagem: ${descricaoVisual}` : ""].filter(Boolean).join("\n").trim();

    const produtoLike = {
      nome,
      descricao: descricaoFinal || null,
      preco: precoNum && !isNaN(precoNum) ? precoNum : null,
      link: null,
      categoria: null,
      imagem_url: midia.midia_url,
      ativo: true,
      source: "midias_whatsapp",
      id: midia.id,
      midia_tipo: isVideo ? ("video" as const) : ("foto" as const),
    };

    // Foto E vídeo: gerar script vendedor por IA usando o contexto do dono como INSUMO
    // (não como legenda final). Vídeo sem visão automática usa apenas o contexto textual;
    // foto usa contexto + descrição visual. Isso restaura a copy rica pro vídeo sem reabrir
    // o loop de contexto (contexto já está persistido em midias_whatsapp.contexto_original).
    const scriptsEntries = await Promise.all(
      redes.map(async (r) => {
        const redeGen = r === "tiktok" ? "instagram" : (r as "facebook" | "instagram");
        return [r, await gerarScriptRedesSociais(produtoLike, tom, redeGen)] as const;
      }),
    );
    const scripts: Record<string, string> = Object.fromEntries(scriptsEntries);

    const token = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
    const pending: PendingSocialPost = { produto: produtoLike, tom, redes, scripts, userId: ctx.userId, createdAt: Date.now(), formato, midiaTipo: produtoLike.midia_tipo };
    const queueRows = await persistPendingSocialPost(token, pending);
    PENDING_POSTS.set(token, { ...pending, queueRows });

    const avisoFormato = formato === "story"
      ? `⚠️ Formato: STORY (${isVideo ? "vídeo" : "foto"} precisa ser vertical 9:16 em ${redes.join(" e ")}).`
      : formato === "reels"
        ? `Formato: REELS (vídeo vertical, ideal 9:16 ≥3s).`
        : `Formato: FEED.`;

    // Aviso IG-feed-vídeo≡Reels (transparência com o dono).
    const avisoReels = (formato === "feed" && isVideo && redes.includes("instagram"))
      ? "No Instagram, vídeo no feed é publicado como Reels (padrão da Meta) — vou postar como Reels."
      : undefined;

    return JSON.stringify({
      status: "aguardando_confirmacao",
      fonte: "biblioteca_midias",
      token,
      formato,
      midia: { id: midia.id, tipo: midia.tipo, url: midia.midia_url },
      produto: { nome: produtoLike.nome, preco: produtoLike.preco, imagem_url: produtoLike.imagem_url },
      tom,
      redes,
      preview: scripts,
      aviso_formato: avisoFormato,
      aviso_reels: avisoReels,
      instrucoes: `Mostre o preview, DEIXE CLARO o formato ("vou postar como ${formato.toUpperCase()}" — cite as redes) e no final pergunte EXPLICITAMENTE: "Quer ajustar algo antes de postar? (ex: tirar/incluir informação, mudar preço, deixar mais curto, mudar o tom) Ou responde 'pode postar' pra publicar já." Se o dono pedir AJUSTE no texto, chame revisar_post_pendente com token="${token}" e ajuste=<instrução literal do dono>. Se confirmar ('pode postar', 'manda', 'vai'), chame confirmar_postagem_redes com token="${token}".`,
    });
  } catch (e) {
    return JSON.stringify({ erro: String((e as Error).message) });
  }
}


const TOOLS = [
  {
    type: "function",
    function: {
      name: "consultar_cnpj",
      description: "Consulta dados oficiais de uma empresa brasileira pelo CNPJ na Receita Federal (via BrasilAPI). Retorna razão social, sócios, endereço, CNAE, capital social e situação cadastral.",
      parameters: {
        type: "object",
        properties: { cnpj: { type: "string", description: "CNPJ com ou sem formatação (14 dígitos)" } },
        required: ["cnpj"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "pesquisar_web",
      description: "Pesquisa no Google (pt-BR). Retorna títulos, links, resumos, datas E o conteúdo textual extraído das 3 primeiras páginas (campo 'conteudo_extraido'). USE 'conteudo_extraido' como fonte primária ao responder — cite valores/números/datas literalmente conforme aparecem. Ideal para notícias, eventos, resultados, greves, agenda, previsões, clima extremo, informações factuais recentes. NÃO use para cotação de moeda/cripto (chame cotacao_moeda). Inclua ano/mês atual na query e use 'recencia' pra janela temporal.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Termo de busca. Inclua ano/mês/data quando fizer sentido (ex: 'greve ônibus Rio Janeiro dezembro 2026')." },
          recencia: { type: "string", enum: ["d", "w", "m", "y"], description: "Janela: d=últimas 24h, w=última semana, m=último mês, y=último ano. Omita para busca geral." },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "buscar_lugares_proximos",
      description: "Busca lugares (cafeteria, farmácia, mercado, restaurante, posto, hospital, etc.) próximos à localização que o usuário compartilhou no WhatsApp. Retorna nome, endereço, distância, avaliação e se está aberto. Se o usuário nunca compartilhou localização, retorna erro pedindo pra ele mandar via 📎 → Localização.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Tipo de lugar em linguagem natural, ex: 'cafeteria', 'farmácia 24h', 'hamburgueria', 'mercado'" },
          radius_meters: { type: "number", description: "Raio de busca em metros (padrão 2000, máx 20000)" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "gerar_imagem",
      description: "Cria uma imagem ULTRA REALISTA por IA (padrão IA Marketing — fotorealista, iluminação profissional, qualidade editorial, SEM texto/letras) a partir de um prompt descritivo. Use SEMPRE que o usuário pedir 'faz uma imagem', 'gera uma arte', 'cria uma foto de X', 'desenha', 'me manda uma imagem', 'faz um banner/post/mockup'. A imagem é enviada automaticamente no WhatsApp E salva na biblioteca /midias — o usuário pode publicar direto nas redes sociais depois. Responda com legenda curta (1-2 linhas) descrevendo o que criou e avisando que já está pronta pra postar. NUNCA cole a URL na resposta.",
      parameters: {
        type: "object",
        properties: { prompt: { type: "string", description: "Descrição visual detalhada. Inclua estilo (fotorealista, cartoon, aquarela), enquadramento, iluminação, cores, elementos. Ex: 'foto profissional de um café expresso em mesa de madeira rústica, luz natural quente, estilo editorial'" } },
        required: ["prompt"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_clima",
      description: "Consulta clima atual e previsão de 3 dias para uma cidade (ou lat,lng). Se a cidade não for informada, usa a última localização compartilhada pelo usuário. Retorna temperatura, sensação, umidade, vento e previsão.",
      parameters: {
        type: "object",
        properties: { local: { type: "string", description: "Nome da cidade (ex: 'São Paulo'), ou coordenadas 'lat,lng'. Opcional se o usuário já compartilhou localização." } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "cotacao_moeda",
      description: "ÚNICA fonte válida para cotação AO VIVO de moedas e criptos (AwesomeAPI, atualiza a cada segundo). SEMPRE use esta ferramenta — NUNCA responda cotação a partir de pesquisar_web (que traz páginas defasadas). Pares aceitos: USD-BRL (dólar), EUR-BRL (euro), GBP-BRL (libra), JPY-BRL (iene), ARS-BRL (peso), BTC-BRL (bitcoin), ETH-BRL (ethereum), SOL-BRL (solana), BNB-BRL, XRP-BRL, DOGE-BRL, ADA-BRL. Para pares em USD use SUFIXO -USD (ex: BTC-USD, ETH-USD). Chame múltiplas vezes se o usuário pedir várias moedas.",
      parameters: {
        type: "object",
        properties: { par: { type: "string", description: "Par no formato ORIGEM-DESTINO, ex: USD-BRL" } },
        required: ["par"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "editar_imagem",
      description: "Edita/melhora uma FOTO que o usuário acabou de enviar no WhatsApp (mesma mensagem ou anterior recente). Use quando ele pedir 'melhora essa foto', 'deixa o ambiente mais bonito', 'troca o fundo', 'coloca luz natural', 'transforma em profissional', 'remove X'. NÃO use pra criar imagem do zero (use gerar_imagem). A imagem editada é enviada automaticamente — responda com legenda curta descrevendo o que ajustou.",
      parameters: {
        type: "object",
        properties: { prompt: { type: "string", description: "Descrição da edição desejada. Ex: 'deixa a cafeteria mais aconchegante, luz quente de fim de tarde, mais plantas, mesa de madeira rústica' — mantendo as pessoas/produto originais." } },
        required: ["prompt"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "criar_lembrete",
      description: "Cria um lembrete/aviso que a Jarvis vai disparar no WhatsApp do usuário automaticamente: 1º aviso 30 minutos antes e depois a cada 10 minutos até a hora combinada, além de um aviso final na hora exata. Use SEMPRE que o usuário pedir 'me lembra', 'me avisa', 'agenda um lembrete', 'não me deixa esquecer', 'me chama X minutos antes'. Você DEVE calcular a data/hora absoluta em horário de São Paulo a partir da 'Data/hora atual' informada no system prompt (ex: 'amanhã 15h' → soma 1 dia à data de hoje). Prefira o parâmetro data_hora_sp. Use minutos_a_partir_de_agora só quando o usuário disser algo como 'daqui 20 minutos'.",
      parameters: {
        type: "object",
        properties: {
          titulo: { type: "string", description: "Assunto curto do lembrete, ex: 'Reunião com Marcelo Martins'" },
          data_hora_sp: { type: "string", description: "Data/hora absoluta em horário de São Paulo no formato 'YYYY-MM-DD HH:MM'. Ex: '2026-07-03 15:00'." },
          minutos_a_partir_de_agora: { type: "number", description: "Alternativa: minutos até o evento a partir de agora. Ex: 20." },
        },
        required: ["titulo"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "listar_contatos_comerciais",
      description: "Lista os CONTATOS COMERCIAIS do dono (clientes, parceiros, prospects próximos com quem ele tem relação direta — Marcelo Martins, Renata, etc). Use ANTES de enviar mensagem quando o dono citar alguém pelo primeiro nome e você precisar confirmar quem é / achar o ID / ver o contexto do relacionamento. Também use pra responder 'quais são meus contatos comerciais', 'me lembra do Marcelo', 'qual o whats da Renata'.",
      parameters: {
        type: "object",
        properties: {
          busca: { type: "string", description: "Filtro opcional por nome ou empresa. Ex: 'marcelo', 'ademicon'. Vazio = lista tudo." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "enviar_mensagem_contato_comercial",
      description: "Envia uma MENSAGEM DE WHATSAPP TEXTO humanizada para um contato comercial (tabela contatos_comerciais), agora ou agendada. NUNCA faz ligação de voz — Jarvis só envia texto. Use quando o dono mandar comandos tipo 'manda mensagem pro Marcelo confirmando nossa reunião amanhã 10:30', 'avisa a Renata que...', 'faz follow-up com o cliente X', 'amanhã 9:30 chama o Marcelo pra confirmar reunião das 10:30'.\n\nVOCÊ (Jarvis) COMPÕE o texto da mensagem no parâmetro 'mensagem' — em nome do dono, gentil, humanizado, se apresentando como 'aqui é o Jarvis, assistente do Felício'. Use o campo 'contexto' do contato pra dar naturalidade (ex: se contexto diz 'parceiro há 12 anos', a abordagem é mais íntima). Nunca fecha negócio sozinho — coleta info e reporta.\n\nSempre passe 'contato_id' quando souber (chame listar_contatos_comerciais antes se precisar). Só use 'nome_busca' se o dono foi bem específico (nome único).\n\nAgendamento: use 'data_hora_sp' (YYYY-MM-DD HH:MM em SP) pra momento futuro; omita ambos os campos de tempo pra enviar AGORA. Calcule 'amanhã 9:30' a partir da 'Data/hora atual em São Paulo' do system prompt.",
      parameters: {
        type: "object",
        properties: {
          contato_id: { type: "string", description: "UUID do contato (obtido via listar_contatos_comerciais). Preferido." },
          nome_busca: { type: "string", description: "Alternativa: parte do nome pra buscar. Falha se houver ambiguidade." },
          mensagem: { type: "string", description: "Texto COMPLETO da mensagem WhatsApp já humanizado, em nome do dono. Mín 20 chars. Ex: 'Oi Marcelo, tudo bem? Aqui é o Jarvis, assistente do Felício. Ele me pediu pra confirmar com você a reunião marcada pra amanhã 10:30. Tá tudo certo do seu lado? 😊'" },
          data_hora_sp: { type: "string", description: "Opcional. Envio agendado em horário SP no formato 'YYYY-MM-DD HH:MM'. Omita pra enviar agora." },
          minutos_a_partir_de_agora: { type: "number", description: "Opcional. Alternativa a data_hora_sp: minutos até o envio." },
          tipo_acao: { type: "string", enum: ["confirmar_reuniao", "followup_proposta", "resposta_comercial", "checkin_relacionamento", "mensagem_livre"], description: "Categoria da ação pra log/analytics. Padrão: mensagem_livre." },
        },
        required: ["mensagem"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "salvar_nota",
      description: "Salva uma nota rápida / segunda memória do usuário. Use quando ele disser 'anota que…', 'lembra que…', 'guarda essa info', 'grava aí que…'.",
      parameters: { type: "object", properties: { conteudo: { type: "string" }, tags: { type: "array", items: { type: "string" }, description: "Palavras-chave opcionais pra facilitar busca depois" } }, required: ["conteudo"] },
    },
  },
  {
    type: "function",
    function: {
      name: "buscar_notas",
      description: "Busca notas salvas anteriormente. Use quando o usuário perguntar 'qual era o CNPJ da X?', 'o que eu tinha anotado sobre Y?', 'me lembra o que eu falei sobre Z'.",
      parameters: { type: "object", properties: { query: { type: "string", description: "Termo/palavra-chave. Vazio = últimas notas." } } },
    },
  },
  {
    type: "function",
    function: {
      name: "adicionar_tarefa",
      description: "Adiciona uma tarefa na to-do list do usuário. Use quando disser 'adiciona na minha lista', 'preciso fazer X', 'coloca X pra eu fazer amanhã'.",
      parameters: { type: "object", properties: { titulo: { type: "string" }, prazo_sp: { type: "string", description: "Opcional YYYY-MM-DD HH:MM em SP" } }, required: ["titulo"] },
    },
  },
  {
    type: "function",
    function: {
      name: "listar_tarefas",
      description: "Lista as tarefas do usuário. Use quando disser 'quais são minhas tarefas', 'o que eu tenho pra fazer', 'to-do'.",
      parameters: { type: "object", properties: { status: { type: "string", enum: ["open", "done"], description: "padrão: open" } } },
    },
  },
  {
    type: "function",
    function: {
      name: "concluir_tarefa",
      description: "Marca uma tarefa como concluída. Use quando disser 'já fiz X', 'concluí a tarefa X', 'pode marcar como feito'.",
      parameters: { type: "object", properties: { id_ou_titulo: { type: "string", description: "id UUID ou parte do título" } }, required: ["id_ou_titulo"] },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_noticias",
      description: "Busca notícias recentes sobre um tema (Google News). Use pra 'notícias sobre X', 'o que tá rolando sobre Y'.",
      parameters: { type: "object", properties: { tema: { type: "string" } }, required: ["tema"] },
    },
  },
  {
    type: "function",
    function: {
      name: "rastrear_correios",
      description: "Rastreia encomenda dos Correios pelo código (13 caracteres, ex: AA123456789BR).",
      parameters: { type: "object", properties: { codigo: { type: "string" } }, required: ["codigo"] },
    },
  },
  {
    type: "function",
    function: {
      name: "calcular_rota",
      description: "Calcula distância e tempo de carro entre origem e destino (OSRM). Aceita endereços, cidades, 'aqui'/'minha localização' pra usar a localização salva do usuário, ou 'lat,lng'.",
      parameters: { type: "object", properties: { origem: { type: "string" }, destino: { type: "string" } }, required: ["origem", "destino"] },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_metricas_amz",
      description: "[ADMIN — só Felicio] Retorna métricas gerais do negócio AMZ OFERTAS: total de clientes, assinaturas ativas/pausadas, faturamento do mês e de ontem.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "listar_inadimplentes_amz",
      description: "[ADMIN — só Felicio] Lista clientes AMZ inadimplentes ou com falha de pagamento recente.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "status_plataforma_amz",
      description: "[ADMIN — só Felicio] Retorna saúde das Edge Functions da plataforma (quais estão com problema, offline, com falhas críticas).",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "criar_cobranca_amz",
      description: "[ADMIN — só Felicio] Cria uma cobrança PIX para um cliente AMZ pelo nome/razão social. Valor padrão 597. Use quando Felicio disser 'gera cobrança de X pro cliente Y'.",
      parameters: { type: "object", properties: { cliente: { type: "string" }, valor: { type: "number" } }, required: ["cliente"] },
    },
  },
  {

    type: "function",
    function: {
      name: "consultar_estoque",
      description: "Consulta produtos/estoque da plataforma. Se query vazia, retorna totais. Se preenchida, busca por nome/categoria/tags/sku (ex.: 'chinelo', 'xícara chocolate'). Dono vê tudo; cliente só o próprio catálogo.",
      parameters: { type: "object", properties: { query: { type: "string", description: "termo de busca ou vazio para totais" } } },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_campanhas",
      description: "Status das campanhas WhatsApp: total, ativas, próximas execuções, envios nas últimas 24h e stats da fila (pendente/processando/enviado/falhou).",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_autopilot",
      description: "Status do Autopilot de redes sociais: configs ativas, quantos posts foram publicados/agendados/falhados nas últimas 24h por rede (Facebook/Instagram).",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_clientes_leads",
      description: "Contagens de clientes ativos, novos clientes nos últimos 7 dias e total de leads B2B/B2C.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "resumo_plataforma",
      description: "Snapshot completo da plataforma agora: estoque + campanhas + autopilot + clientes/leads. Use quando o usuário pedir 'resumo geral', 'como tá a plataforma', 'panorama'.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "postar_redes_sociais",
      description: "Gera PREVIEW COMPLETO de post para Facebook, Instagram e/ou TikTok a partir de um PRODUTO DO CATÁLOGO do dono (estoque cadastrado), com copywriting no TOM escolhido. NÃO publica direto — devolve token de confirmação. ⛔ NUNCA use esta tool quando o cliente ACABOU DE ENVIAR foto/vídeo/áudio nesta mensagem — nesse caso use salvar_midia_biblioteca. Esta tool é EXCLUSIVA pra produto do catálogo pedido POR NOME em texto (ex: 'posta a caneta delineadora', 'divulga o kit xícaras'). LINK NÃO É OBRIGATÓRIO: se o produto não tiver link de compra, gera post institucional/lifestyle/engajamento — NUNCA recuse por falta de link. Quando o usuário pedir por NOME 'posta X nas redes', CHAME IMEDIATAMENTE. A busca do produto é fuzzy. Se retornar 'não encontrado' com sugestoes_do_catalogo, mostre as sugestões. Depois de mostrar o preview, ao aprovar chame confirmar_postagem_redes. Restrito ao dono (Felicio).",
      parameters: {
        type: "object",
        properties: {
          produto: { type: "string", description: "Nome, categoria ou palavra-chave do produto." },
          tom: { type: "string", enum: ["urgencia", "escassez", "black-friday", "prova-social", "beneficio"], description: "Tom do copy. Padrão: urgencia." },
          redes: { type: "array", items: { type: "string", enum: ["facebook", "instagram", "tiktok"] }, description: "Redes. Padrão: todas as três." },
        },
        required: ["produto"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "confirmar_postagem_redes",
      description: "Confirma e PUBLICA de fato o post nas redes sociais usando o token devolvido por postar_redes_sociais. Chame SOMENTE após o usuário aprovar explicitamente o preview ('pode postar', 'confirma', 'manda ver', 'sim'). Se pedir cancelar, passe cancelar=true.",
      parameters: {
        type: "object",
        properties: {
          token: { type: "string", description: "Token de 8 chars devolvido por postar_redes_sociais." },
          cancelar: { type: "boolean", description: "Se true, descarta o preview sem publicar." },
        },
        required: ["token"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "revisar_post_pendente",
      description: "🛠️ USE quando houver um POST PENDENTE (aguardando 'pode postar') e o dono pedir AJUSTES NO TEXTO/SCRIPT antes de publicar. Ex: 'tira o ACABA HOJE', 'põe o preço 89,90', 'deixa mais curto', 'muda o tom pra profissional', 'adiciona que tem garantia', 'refaz mais leve'. Regenera o script aplicando o ajuste e MANTÉM o mesmo token, mídia, formato e redes — só o texto muda. NÃO reabre pergunta de contexto. NÃO use pra confirmar (use confirmar_postagem_redes) nem pra trocar rede/formato/mídia (aí é recriar via postar_midia_biblioteca).",
      parameters: {
        type: "object",
        properties: {
          token: { type: "string", description: "Token de 8 chars do post pendente." },
          ajuste: { type: "string", description: "Instrução literal do dono do que mudar no texto (ex: 'tira o preço e deixa mais curto')." },
        },
        required: ["token", "ajuste"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "salvar_midia_biblioteca",
      description: "🔴 USE SEMPRE E IMEDIATAMENTE quando o cliente ENVIAR foto, vídeo ou áudio nesta mensagem — mesmo sem legenda. É a ação PADRÃO pra qualquer mídia recebida. Salva o arquivo na biblioteca de Mídias (/midias) da plataforma pra ele publicar/reusar depois. NÃO tenta casar com produto do catálogo, NÃO publica direto, NÃO pergunta antes — só arquiva e confirma. Passe em 'contexto' o que o cliente falou junto, ou string vazia se não falou nada.",
      parameters: {
        type: "object",
        properties: {
          contexto: { type: "string", description: "Breve descrição do que a mídia mostra ou do que o cliente falou (ex: 'cliente João contemplou carta de 80k', 'produto novo chegou'). Ajuda a IA a gerar legenda depois." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "postar_midia_biblioteca",
      description: "🟢 USE quando o cliente pedir pra POSTAR/DIVULGAR nas redes usando a foto/vídeo que ele ACABOU DE ENVIAR. Pega a ÚLTIMA mídia salva em /midias. FORMATO: 'story' (foto ou vídeo 9:16), 'reels' (só vídeo, IG/FB), 'feed' (default). Se o dono disser 'reels' passe formato='reels'; 'story'/'stories' → 'story'; senão 'feed'. Para VÍDEO, sempre passe a legenda que o dono forneceu — não invente descrição de vídeo.",
      parameters: {
        type: "object",
        properties: {
          legenda: { type: "string", description: "Texto/legenda que o cliente falou junto." },
          nome: { type: "string", description: "Nome do produto/item, se informado." },
          preco: { type: "string", description: "Preço se informado (ex: '29,99')." },
          tom: { type: "string", enum: ["urgencia", "escassez", "black-friday", "prova-social", "beneficio"] },
          redes: { type: "array", items: { type: "string", enum: ["facebook", "instagram", "tiktok"] } },
          formato: { type: "string", enum: ["feed", "story", "reels"], description: "'feed' (default), 'story' (foto/vídeo 9:16) ou 'reels' (só vídeo)." },
        },
      },
    },
  },

];


async function runTool(
  name: string,
  args: any,
  ctx: { userId: string; fromNumber: string; media?: MediaExtract[] },
): Promise<{ result: string; imageUrl?: string }> {
  const hasFreshLibraryMedia = (ctx.media ?? []).some((m) => m.kind === "image" || m.kind === "video");
  if (hasFreshLibraryMedia && name !== "salvar_midia_biblioteca") {
    console.warn(`[pietro][media_guard] bloqueando tool ${name}; mídia nova deve ir para /midias`);
    const result = await toolSalvarMidiaBiblioteca({ contexto: args?.contexto ?? args?.produto ?? args?.query ?? "" }, ctx);
    return { result };
  }

  // Guard: se pediu postar_redes_sociais mas tem mídia RECENTE (últimos 15 min) em /midias,
  // redireciona pra postar_midia_biblioteca — evita buscar produto errado do catálogo
  // quando o cliente enviou foto antes e agora só mandou a legenda/preço em texto.
  // IMPORTANTE (Etapa 1 fix): vale TAMBÉM quando o pedido é story/reels — a FONTE
  // continua sendo a biblioteca /midias, nunca o catálogo. Só o formato muda.
  if (name === "postar_redes_sociais") {
    try {
      const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const { data: recentes } = await sb
        .from("midias_whatsapp")
        .select("id, created_at")
        .eq("user_id", ctx.userId)
        .in("tipo", ["foto", "video"])
        .gte("created_at", cutoff)
        .order("created_at", { ascending: false })
        .limit(1);
      if (recentes && recentes.length > 0) {
        // Detecta formato (story/reels/feed) a partir do que o agente pediu, mesmo
        // que ele tenha errado a tool. Story/reels keywords em qualquer arg de texto.
        const argBlob = JSON.stringify(args ?? {}).toLowerCase();
        let formatoDetectado: string | undefined = args?.formato;
        if (!formatoDetectado) {
          if (/\bstor(y|ies|ie)\b/.test(argBlob)) formatoDetectado = "story";
          else if (/\breels?\b/.test(argBlob)) formatoDetectado = "reels";
        }
        console.warn(`[pietro][postar_guard] mídia recente em /midias → redirecionando pra postar_midia_biblioteca (formato=${formatoDetectado ?? "feed"})`);
        const result = await toolPostarMidiaBiblioteca({
          legenda: args?.legenda ?? args?.produto,
          nome: args?.produto,
          tom: args?.tom,
          redes: args?.redes,
          formato: formatoDetectado,
        }, ctx);
        return { result };
      }
    } catch (e) {
      console.warn("[pietro][postar_guard] falhou ao checar /midias:", (e as Error).message);
    }
  }

  if (name === "consultar_cnpj") return { result: await toolConsultarCnpj(args?.cnpj ?? "") };
  if (name === "pesquisar_web") return { result: await toolPesquisarWeb(args?.query ?? "", args?.recencia) };
  if (name === "buscar_lugares_proximos") return { result: await toolBuscarLugaresProximos(ctx, args?.query ?? "", args?.radius_meters) };
  if (name === "gerar_imagem") {
    const r = await toolGerarImagem(args?.prompt ?? "", { userId: ctx.userId, fromNumber: ctx.fromNumber });
    let parsed: any = {}; try { parsed = JSON.parse(r); } catch {}
    return { result: r, imageUrl: parsed?.image_url };
  }
  if (name === "editar_imagem") {
    const r = await toolEditarImagem(args?.prompt ?? "", { userId: ctx.userId, media: ctx.media });
    let parsed: any = {}; try { parsed = JSON.parse(r); } catch {}
    return { result: r, imageUrl: parsed?.image_url };
  }
  if (name === "consultar_clima") return { result: await toolConsultarClima(args?.local ?? "", ctx) };
  if (name === "cotacao_moeda") return { result: await toolCotacaoMoeda(args?.par ?? "") };
  if (name === "criar_lembrete") return { result: await toolCriarLembrete(args ?? {}, ctx) };
  if (name === "listar_contatos_comerciais") return { result: await toolListarContatosComerciais(args ?? {}, ctx) };
  if (name === "enviar_mensagem_contato_comercial") return { result: await toolEnviarMensagemContatoComercial(args ?? {}, ctx) };
  if (name === "salvar_nota") return { result: await toolSalvarNota(args?.conteudo ?? "", args?.tags, ctx) };
  if (name === "buscar_notas") return { result: await toolBuscarNotas(args?.query ?? "", ctx) };
  if (name === "adicionar_tarefa") return { result: await toolAdicionarTarefa(args ?? {}, ctx) };
  if (name === "listar_tarefas") return { result: await toolListarTarefas(args?.status, ctx) };
  if (name === "concluir_tarefa") return { result: await toolConcluirTarefa(args?.id_ou_titulo ?? "", ctx) };
  if (name === "consultar_noticias") return { result: await toolConsultarNoticias(args?.tema ?? "") };
  if (name === "rastrear_correios") return { result: await toolRastrearCorreios(args?.codigo ?? "") };
  if (name === "calcular_rota") return { result: await toolCalcularRota(args?.origem ?? "", args?.destino ?? "", ctx) };
  if (name === "consultar_metricas_amz") return { result: await toolMetricasAmz(ctx) };
  if (name === "listar_inadimplentes_amz") return { result: await toolInadimplentesAmz(ctx) };
  if (name === "status_plataforma_amz") return { result: await toolStatusPlataforma(ctx) };
  if (name === "criar_cobranca_amz") return { result: await toolCriarCobrancaAmz(args ?? {}, ctx) };
  if (name === "consultar_estoque") return { result: await toolConsultarEstoque(args?.query ?? "", ctx) };
  if (name === "consultar_campanhas") return { result: await toolConsultarCampanhas(ctx) };
  if (name === "consultar_autopilot") return { result: await toolConsultarAutopilot(ctx) };
  if (name === "consultar_clientes_leads") return { result: await toolConsultarClientesLeads(ctx) };
  if (name === "resumo_plataforma") return { result: await toolResumoPlataforma(ctx) };
  if (name === "postar_redes_sociais") return { result: await toolPostarRedesSociais(args ?? {}, ctx) };
  if (name === "confirmar_postagem_redes") return { result: await toolConfirmarPostagemRedes(args ?? {}, ctx) };
  if (name === "revisar_post_pendente") return { result: await toolRevisarPostPendente(args ?? {}, ctx) };
  if (name === "salvar_midia_biblioteca") return { result: await toolSalvarMidiaBiblioteca(args ?? {}, ctx) };
  if (name === "postar_midia_biblioteca") return { result: await toolPostarMidiaBiblioteca(args ?? {}, ctx) };
  return { result: JSON.stringify({ erro: `ferramenta ${name} não existe` }) };
}


async function callGemini(
  systemPrompt: string,
  history: Array<{ role: string; content: string }>,
  userContent: any,
  hasMedia: boolean,
  toolCtx: { userId: string; fromNumber: string; media?: MediaExtract[] },
): Promise<{ text: string; imageUrl?: string }> {
  const nowSP = new Date().toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long", day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
  const timeHeader = `Data/hora atual em São Paulo: ${nowSP}. Use isto para resolver expressões como "hoje", "amanhã", "daqui a X min" ao chamar ferramentas de agendamento.`;
  const messages: any[] = [
    { role: "system", content: `${timeHeader}\n\n${systemPrompt}` },
    ...history,
    { role: "user", content: userContent },
  ];

  if (!hasMedia && typeof userContent === "string") {
    // 0) Postagem em redes sociais: atalho determinístico para não deixar o modelo "prometer" preview sem chamar a tool.
    const postConfirmation = detectSocialPostConfirmation(userContent);
    if (postConfirmation) {
      console.log("[pietro][forced_social_confirm]", postConfirmation);
      const confirmResult = await toolConfirmarPostagemRedes(postConfirmation, toolCtx);
      return { text: formatSocialPostToolResult(confirmResult) };
    }

    // Etapa 2: se o dono está respondendo APENAS o formato ("feed" / "story" / "no story"),
    // retoma o post pendente (redes/tom/legenda guardados) sem precisar reenviar a foto.
    const standaloneFormat = detectStandaloneFormatReply(userContent);
    const pendingChoice = getPendingFormatChoice(toolCtx.userId);
    if (standaloneFormat && pendingChoice) {
      const midiaRecenteResume = await buscarMidiaRecenteParaPostagem(toolCtx.userId);
      if (midiaRecenteResume) {
        // Reels só faz sentido pra vídeo — bloqueia foto+reels aqui.
        if (standaloneFormat === "reels" && midiaRecenteResume.tipo !== "video") {
          clearPendingFormatChoice(toolCtx.userId);
          return { text: "Reels só aceita vídeo — essa mídia é foto. Quer no *feed* ou no *story*?" };
        }
        console.log(`[pietro][pending_format_resume] formato=${standaloneFormat} redes=${pendingChoice.redes.join(",")} tipo=${midiaRecenteResume.tipo}`);
        clearPendingFormatChoice(toolCtx.userId);
        const postResult = await toolPostarMidiaBiblioteca({
          legenda: pendingChoice.legenda,
          tom: pendingChoice.tom,
          redes: pendingChoice.redes,
          formato: standaloneFormat,
        }, toolCtx);
        return { text: formatSocialPostToolResult(postResult) };
      }
      // mídia expirou/sumiu — descarta pending e deixa o fluxo normal seguir
      clearPendingFormatChoice(toolCtx.userId);
    }

    const socialPost = detectSocialPostIntent(userContent);
    if (socialPost) {
      console.log("[pietro][forced_social_post]", socialPost);
      const midiaRecente = await buscarMidiaRecenteParaPostagem(toolCtx.userId);
      if (midiaRecente) {
        const formatoDetectado = socialPost.formato;
        const isFoto = midiaRecente.tipo === "foto";
        const isVideo = midiaRecente.tipo === "video";

        // Etapa 2: FOTO sem formato explícito → pergunta feed OU story (2 opções).
        if (isFoto && !formatoDetectado) {
          const redesAsk = socialPost.redes.length > 0 ? socialPost.redes : ["instagram"];
          setPendingFormatChoice(toolCtx.userId, {
            redes: redesAsk,
            tom: socialPost.tom,
            legenda: cleanMediaPostLegenda(userContent),
          });
          const redeLabel = redesAsk.map((r) => r === "instagram" ? "Instagram" : r === "facebook" ? "Facebook" : r === "tiktok" ? "TikTok" : r).join(" e ");
          console.log("[pietro][pending_format_choice_set]", { redes: redesAsk, tipo: "foto" });
          return { text: `Quer no *feed* ou no *story* do ${redeLabel}?` };
        }

        // Etapa 3: VÍDEO sem formato explícito → pergunta feed / story / reels (3 opções).
        if (isVideo && !formatoDetectado) {
          const redesAsk = socialPost.redes.length > 0 ? socialPost.redes : ["instagram"];
          setPendingFormatChoice(toolCtx.userId, {
            redes: redesAsk,
            tom: socialPost.tom,
            legenda: cleanMediaPostLegenda(userContent),
          });
          const redeLabel = redesAsk.map((r) => r === "instagram" ? "Instagram" : r === "facebook" ? "Facebook" : r === "tiktok" ? "TikTok" : r).join(" e ");
          console.log("[pietro][pending_format_choice_set]", { redes: redesAsk, tipo: "video" });
          return { text: `Quer no *feed*, no *story* ou como *reels* do ${redeLabel}?` };
        }

        // Formato explícito → segue direto.
        const formato = formatoDetectado ?? "feed";
        console.warn(`[pietro][forced_social_post] mídia recente em /midias → usando postar_midia_biblioteca id=${midiaRecente.id} formato=${formato} tipo=${midiaRecente.tipo}`);
        const postResult = await toolPostarMidiaBiblioteca({
          legenda: cleanMediaPostLegenda(userContent),
          tom: socialPost.tom,
          redes: socialPost.redes,
          formato,
        }, toolCtx);
        return { text: formatSocialPostToolResult(postResult) };
      }

      if (!socialPost.temProduto) {
        return { text: "Qual produto você quer postar? Ou me envie a foto/vídeo primeiro que eu preparo pela biblioteca /midias." };
      }

      const postResult = await toolPostarRedesSociais(socialPost, toolCtx);
      return { text: formatSocialPostToolResult(postResult) };
    }

    // 1) Cotações em tempo real (AwesomeAPI) — antes de qualquer coisa
    const quotePairs = detectQuoteIntent(userContent);
    if (quotePairs.length > 0) {
      console.log("[pietro][forced_quote]", quotePairs);
      const quotes = await Promise.all(quotePairs.map((p) => toolCotacaoMoeda(p)));
      for (let i = 0; i < quotePairs.length; i++) {
        const id = `forced_quote_${i + 1}`;
        messages.push({
          role: "assistant",
          content: null,
          tool_calls: [{
            id,
            type: "function",
            function: { name: "cotacao_moeda", arguments: JSON.stringify({ par: quotePairs[i] }) },
          }],
        });
        messages.push({ role: "tool", tool_call_id: id, content: quotes[i] });
      }
    }

    // 2) Busca web (Google) para outras intenções de tempo real
    const forcedSearch = detectWebSearchIntent(userContent);
    if (forcedSearch) {
      console.log("[pietro][forced_web_search]", forcedSearch);
      const searchResult = await toolPesquisarWeb(forcedSearch.query, forcedSearch.recencia);
      messages.push({
        role: "assistant",
        content: null,
        tool_calls: [{
          id: "forced_web_search_1",
          type: "function",
          function: { name: "pesquisar_web", arguments: JSON.stringify(forcedSearch) },
        }],
      });
      messages.push({ role: "tool", tool_call_id: "forced_web_search_1", content: searchResult });
    }
  }


  // Modelo pro é mais confiável com áudio/imagem
  // Roteamento por tipo de fluxo (Feature 2): multimodal → DEEP, texto conversa → FAST.
  const model = escolherModelo({ kind: hasMedia ? "multimodal" : "conversation" });
  let pendingImageUrl: string | undefined;
  let pendingSocialToken: string | undefined; // token de post aguardando confirmação — anexa <<SPLIT>>pode postar {token} no fim

  const captureSocialToken = (raw: string) => {
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.status === "aguardando_confirmacao" && typeof parsed?.token === "string") {
        pendingSocialToken = parsed.token;
      }
    } catch { /* ignore */ }
  };

  const appendConfirmCommand = (text: string): string => {
    if (!pendingSocialToken) return text;
    const token = pendingSocialToken;
    const cmd = `pode postar ${token}`;
    // Limpa menções inline ao token (ex: "O token é *abc*") pra não poluir o preview,
    // já que o comando vai isolado na próxima mensagem pra copiar/colar.
    let cleaned = text
      .replace(new RegExp(`\\*?\\b${token}\\b\\*?`, "g"), "")
      .replace(/Posso publicar agora\??.*$/gim, "")
      .replace(/O token[^\n.]*\.?/gi, "")
      .replace(/Token[:\s]*\.?/gi, "")
      .replace(/pode postar\s*$/gim, "")
      .replace(/[ \t]{2,}/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    if (cleaned.includes(cmd)) return cleaned;
    return `${cleaned}<<SPLIT>>${cmd}`;
  };

  for (let step = 0; step < 4; step++) {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.7,
        tools: TOOLS,
      }),
    });

    if (!res.ok) {
      const t = await res.text();
      throw new Error(`gemini ${res.status}: ${t.slice(0, 200)}`);
    }
    const data = await res.json();
    const msg = data?.choices?.[0]?.message;
    const toolCalls = msg?.tool_calls;

    if (toolCalls && toolCalls.length > 0) {
      messages.push(msg);
      for (const tc of toolCalls) {
        const name = tc.function?.name;
        let args: any = {};
        try { args = JSON.parse(tc.function?.arguments ?? "{}"); } catch { /* ignore */ }
        console.log(`[pietro][tool] ${name}`, args);
        const { result, imageUrl } = await runTool(name, args, toolCtx);
        if (imageUrl) pendingImageUrl = imageUrl;
        if (name === "postar_midia_biblioteca" || name === "postar_redes_sociais") captureSocialToken(result);
        messages.push({ role: "tool", tool_call_id: tc.id, content: result });
      }
      continue;
    }

    return { text: appendConfirmCommand(msg?.content ?? ""), imageUrl: pendingImageUrl };
  }
  return { text: appendConfirmCommand("Desculpa, não consegui concluir a pesquisa agora."), imageUrl: pendingImageUrl };
}


async function sendWhatsApp(user_id: string, to: string, message: string, imageUrl?: string): Promise<string | null> {
  const body: any = { user_id, to, message };
  if (imageUrl) body.image_url = imageUrl;
  const res = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-send-message`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICE_KEY}`,
      "apikey": SERVICE_KEY,
    },
    body: JSON.stringify(body),
  });
  const txt = await res.text();
  if (!res.ok) throw new Error(`send ${res.status}: ${txt.slice(0, 200)}`);
  try {
    const j = JSON.parse(txt);
    return j?.message_id ?? j?.wamid ?? null;
  } catch {
    return null;
  }
}

async function processOne(queueId: string) {
  const { data: claimed, error: claimErr } = await sb
    .from("whatsapp_cloud_inbound_queue")
    .update({
      status: "processing",
      processing_started_at: new Date().toISOString(),
      attempts: undefined as any,
    })
    .eq("id", queueId)
    .eq("status", "received")
    .select("*")
    .maybeSingle();

  if (claimErr) throw claimErr;
  if (!claimed) return { skipped: true, queueId };

  await sb
    .from("whatsapp_cloud_inbound_queue")
    .update({ attempts: (claimed.attempts ?? 0) + 1 })
    .eq("id", queueId);

  const row = claimed as QueueRow;

  try {
    // PASSO 3 — Resolve tenant + access_token
    let userId = row.user_id;
    let waAccessToken: string | null = null;
    const { data: cfg } = await sb
      .from("whatsapp_config")
      .select("user_id, access_token, connection_method, phone_number_id")
      .eq("phone_number_id", row.phone_number_id)
      .eq("is_active", true)
      .maybeSingle();
    if (cfg) {
      if (!userId) userId = cfg.user_id;
      const isSystemUserTenant = cfg.connection_method === "system_user_permanent";
      waAccessToken = isSystemUserTenant && (WHATSAPP_PERMANENT_TOKEN || WHATSAPP_TEST_ACCESS_TOKEN)
        ? (WHATSAPP_PERMANENT_TOKEN || WHATSAPP_TEST_ACCESS_TOKEN)!
        : cfg.access_token ?? null;
    }
    if (!userId) {
      await failQueue(row.id, "tenant_not_found");
      return { ok: false, reason: "tenant_not_found" };
    }

    // PASSO 4 — Config do agente
    const { data: agent } = await sb
      .from("whatsapp_cloud_agent_config")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (!agent || !agent.is_active) {
      await failQueue(row.id, "agent_inactive");
      return { ok: false, reason: "agent_inactive" };
    }

    // PASSO 5 — Upsert conversa
    const { data: existingConv } = await sb
      .from("whatsapp_cloud_conversations")
      .select("*")
      .eq("user_id", userId)
      .eq("contact_number", row.from_number)
      .maybeSingle();

    const contactName =
      row.payload?.profile?.name ??
      row.payload?.contacts?.[0]?.profile?.name ??
      existingConv?.contact_name ??
      null;

    let conv = existingConv;
    if (!conv) {
      const { data: created, error: convErr } = await sb
        .from("whatsapp_cloud_conversations")
        .insert({
          user_id: userId,
          contact_number: row.from_number,
          contact_name: contactName,
          status: "active",
          last_message_at: new Date().toISOString(),
        })
        .select("*")
        .single();
      if (convErr) throw convErr;
      conv = created;
    } else {
      await sb
        .from("whatsapp_cloud_conversations")
        .update({ last_message_at: new Date().toISOString(), contact_name: contactName })
        .eq("id", conv.id);
    }

    const userText = extractText(row.payload);
    let inboundContent = userText || `(${row.message_type ?? "mídia"} sem legenda)`;
    const directNearbySearch = row.message_type === "text" ? detectNearbySearch(userText) : null;

    // Captura localização compartilhada
    const loc = row.payload?.location;
    if (loc?.latitude != null && loc?.longitude != null) {
      await sb.from("whatsapp_user_locations").upsert({
        user_id: userId,
        contact_number: row.from_number,
        latitude: Number(loc.latitude),
        longitude: Number(loc.longitude),
        name: loc.name ?? null,
        address: loc.address ?? null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,contact_number" });
      inboundContent = `📍 Localização compartilhada${loc.name ? ` (${loc.name})` : ""}${loc.address ? ` — ${loc.address}` : ""} [${loc.latitude}, ${loc.longitude}]`;
      console.log(`[processor] location saved for ${row.from_number}`);
    }

    // PASSO 6 — Grava inbound
    await sb.from("whatsapp_cloud_messages").insert({
      conversation_id: conv.id,
      user_id: userId,
      direction: "inbound",
      sender: "contact",
      content: inboundContent,
      message_type: row.message_type ?? "text",
      wamid: row.wamid,
    });

    if (conv.status === "handoff") {
      await doneQueue(row.id);
      return { ok: true, handoff: true };
    }

    // PASSO 6.5 — Modo AMZ: 3 níveis de acesso
    const isAmzMode =
      (agent as any).agent_mode === "amz" && userId === ADMIN_AMZ_USER_ID;
    let amzContextBlock: string | undefined;
    if (isAmzMode) {
      const amzCtx = await buildAmzContext(sb, row.from_number);
      console.log(`[processor][amz] from=${row.from_number} access=${amzCtx.access}`);

      if (amzCtx.access === "stranger") {
        try {
          await sendWhatsApp(userId, row.from_number, STRANGER_MSG);
          await sb.from("whatsapp_cloud_messages").insert({
            conversation_id: conv.id,
            user_id: userId,
            direction: "outbound",
            sender: "agent",
            content: STRANGER_MSG,
            message_type: "text",
          });
        } catch (e) {
          console.error("[processor][amz] stranger send falhou:", e);
        }
        await doneQueue(row.id);
        return { ok: true, amz_access: "stranger" };
      }
      amzContextBlock = amzCtx.block;
    }

    // Atalho determinístico: pedidos explícitos de lugar próximo não dependem da IA chamar tool.
    // Isso evita respostas falsas de "permissão bloqueada" quando a localização já está salva.
    if (directNearbySearch && userId) {
      console.log(`[processor][nearby-direct] from=${row.from_number} query=${directNearbySearch.query}`);
      const rawNearby = await toolBuscarLugaresProximos(
        { userId, fromNumber: row.from_number },
        directNearbySearch.query,
        directNearbySearch.radiusMeters,
      );
      const reply = formatNearbyReply(rawNearby, directNearbySearch.query);

      const { data: outMsg } = await sb
        .from("whatsapp_cloud_messages")
        .insert({
          conversation_id: conv.id,
          user_id: userId,
          direction: "outbound",
          sender: "agent",
          content: reply,
          message_type: "text",
        })
        .select("id")
        .single();

      let sendError: string | null = null;
      try {
        const sentId = await sendWhatsApp(userId, row.from_number, reply);
        if (sentId && outMsg?.id) {
          await sb.from("whatsapp_cloud_messages").update({ wamid: sentId }).eq("id", outMsg.id);
        }
      } catch (e) {
        sendError = String((e as Error).message ?? e);
      }

      await sb.from("whatsapp_cloud_conversations").update({ last_message_at: new Date().toISOString() }).eq("id", conv.id);

      if (sendError) {
        await failQueue(row.id, `send_failed: ${sendError}`);
        return { ok: false, reason: "send_failed", error: sendError };
      }

      await doneQueue(row.id);
      return { ok: true, direct_nearby: true, reply_preview: reply.slice(0, 120) };
    }

    // PASSO 8 — Janela 24h
    const { data: lastInbound } = await sb
      .from("whatsapp_cloud_messages")
      .select("created_at")
      .eq("conversation_id", conv.id)
      .eq("direction", "inbound")
      .order("created_at", { ascending: false })
      .limit(2);
    const previousInbound = lastInbound?.[1]?.created_at;
    if (previousInbound) {
      const ageMs = Date.now() - new Date(previousInbound).getTime();
      if (ageMs > 24 * 60 * 60 * 1000) {
        await failQueue(row.id, "outside_24h_window");
        return { ok: false, reason: "outside_24h_window" };
      }
    }

    // PASSO 4.5 — Quota
    let { data: quota } = await sb
      .from("ai_messages_quota")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (!quota) {
      const ins = await sb
        .from("ai_messages_quota")
        .insert({ user_id: userId })
        .select("*")
        .single();
      quota = ins.data;
    }

    if (quota && new Date(quota.reset_at).getTime() <= Date.now()) {
      const nextReset = new Date();
      nextReset.setUTCMonth(nextReset.getUTCMonth() + 1, 1);
      nextReset.setUTCHours(0, 0, 0, 0);
      const r = await sb
        .from("ai_messages_quota")
        .update({ used_count: 0, reset_at: nextReset.toISOString() })
        .eq("user_id", userId)
        .select("*")
        .single();
      quota = r.data;
    }

    if (!quota?.is_enabled) {
      await sb.from("whatsapp_cloud_conversations").update({ status: "handoff" }).eq("id", conv.id);
      await failQueue(row.id, "ai_disabled");
      return { ok: false, reason: "ai_disabled" };
    }
    if (quota.used_count >= quota.monthly_limit) {
      await sb.from("whatsapp_cloud_conversations").update({ status: "handoff" }).eq("id", conv.id);
      await failQueue(row.id, "quota_exceeded");
      return { ok: false, reason: "quota_exceeded" };
    }

    // PASSO 6.7 — Baixa mídias
    let media: MediaExtract[] = [];
    if (waAccessToken && ["image", "audio", "video", "document"].includes(row.message_type ?? "")) {
      media = await downloadAllMedia(row.payload, waAccessToken);
      console.log(`[processor] media baixadas: ${media.length}`);
    }

    // Regra determinística: foto/vídeo enviado no WhatsApp vira mídia livre em /midias.
    // Não deixa a IA buscar produto parecido no catálogo nem preparar post com imagem errada.
    const freshLibraryMedia = media.filter((m) => m.kind === "image" || m.kind === "video");
    if (freshLibraryMedia.length > 0) {
      const contexto = (userText || freshLibraryMedia.map((m) => m.caption).filter(Boolean).join(" ") || "").trim();
      const salvos = await Promise.all(freshLibraryMedia.map((m) => salvarItemMidiaBiblioteca(m, { userId, fromNumber: row.from_number }, contexto)));
      let descricaoVisual = "";
      try {
        descricaoVisual = await descreverFotosSalvas(freshLibraryMedia, salvos, contexto);
      } catch (e) {
        console.warn("[processor][fresh_media_visao] falhou:", (e as Error).message);
      }
      const reply = respostaMidiaSalva(salvos, descricaoVisual);

      const { data: outMsg } = await sb
        .from("whatsapp_cloud_messages")
        .insert({
          conversation_id: conv.id,
          user_id: userId,
          direction: "outbound",
          sender: "agent",
          content: reply,
          message_type: "text",
        })
        .select("id")
        .single();

      let sendError: string | null = null;
      try {
        const sentId = await sendWhatsApp(userId, row.from_number, reply);
        if (sentId && outMsg?.id) {
          await sb.from("whatsapp_cloud_messages").update({ wamid: sentId }).eq("id", outMsg.id);
        }
      } catch (e) {
        sendError = String((e as Error).message ?? e);
      }

      await sb.from("whatsapp_cloud_conversations").update({ last_message_at: new Date().toISOString() }).eq("id", conv.id);

      if (sendError) {
        await failQueue(row.id, `send_failed: ${sendError}`);
        return { ok: false, reason: "send_failed", error: sendError };
      }

      await doneQueue(row.id);
      return { ok: true, saved_to_midias: true, midia_ids: salvos.map((s) => s.id), reply_preview: reply.slice(0, 120) };
    }

    // PASSO 6.8 — DOCUMENTOS (.md, .txt, .json, .pdf) → ler e COMENTAR
    // Regra: nunca chamar tools, nunca buscar lugares, nunca postar. Só análise.
    const docMedia = media.filter((m) => m.kind === "document");
    if (docMedia.length > 0) {
      const doc = docMedia[0]; // trata 1 por vez (o mais comum no WhatsApp)
      const extracted = await extractDocumentText(doc.base64, doc.mime, doc.filename);
      const label = doc.filename || `arquivo ${doc.mime}`;

      let reply: string;
      if (!extracted.supported || !extracted.text) {
        reply = extracted.note
          ? `Recebi o arquivo *${label}*, mas ${extracted.note}`
          : `Recebi *${label}*, mas não consegui ler o conteúdo. Se puder, manda em .md, .txt, .json ou .pdf com texto.`;
      } else {
        const truncNote = extracted.truncated
          ? `\n\n(Obs: o documento é grande — analisei os primeiros ~60 mil caracteres.)`
          : "";
        const userComment = userText ? `\n\nContexto que o dono mandou junto: "${userText}"` : "";
        const docPrompt = [
          `O dono (Felício) te enviou um documento/projeto pelo WhatsApp para você COMENTAR.`,
          `Sua tarefa: LEIA o conteúdo abaixo e responda como o Jarvis — assistente do Felício —`,
          `com um comentário útil, honesto e direto: pontos fortes, riscos, o que falta, sugestões práticas.`,
          `Formato: WhatsApp (curto, parágrafos claros, sem tabelas ASCII). Máx ~250 palavras.`,
          `NÃO use nenhuma ferramenta (nada de busca de lugares, nada de pesquisar_web, nada de postar).`,
          `Só análise textual do que está aqui.${userComment}`,
          ``,
          `NOME DO ARQUIVO: ${label}`,
          `TIPO: ${extracted.kind}`,
          ``,
          `--- CONTEÚDO ---`,
          extracted.text,
          `--- FIM ---`,
        ].join("\n");

        try {
          const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${LOVABLE_API_KEY}`,
            },
            body: JSON.stringify({
              model: escolherModelo({ kind: "document" }),
              temperature: 0.5,
              messages: [
                { role: "system", content: "Você é o Jarvis, assistente pessoal do Felício. Leia o documento enviado e comente com franqueza técnica e prática. Nunca invente informação. Nunca peça localização. Nunca ofereça buscar lugares." },
                { role: "user", content: docPrompt },
              ],
            }),
          });
          if (!aiRes.ok) {
            const t = await aiRes.text();
            throw new Error(`gateway ${aiRes.status}: ${t.slice(0, 200)}`);
          }
          const aiJson = await aiRes.json();
          const aiText = aiJson?.choices?.[0]?.message?.content?.trim();
          reply = aiText || `Li o arquivo *${label}*, mas não consegui montar o comentário agora. Tenta reenviar em alguns segundos.`;
          if (extracted.truncated) reply += truncNote;
        } catch (e) {
          console.error("[processor][document] falha modelo:", (e as Error).message);
          reply = `Recebi e li *${label}*, mas travei ao gerar o comentário (${(e as Error).message.slice(0, 120)}). Tenta reenviar.`;
        }
      }

      // Grava outbound e envia — usa o mesmo split de mensagens longas
      const parts: string[] = [];
      const MAX = 3800;
      let rest = reply;
      while (rest.length > MAX) {
        let cut = rest.lastIndexOf("\n\n", MAX);
        if (cut < MAX * 0.5) cut = rest.lastIndexOf("\n", MAX);
        if (cut < MAX * 0.5) cut = MAX;
        parts.push(rest.slice(0, cut).trim());
        rest = rest.slice(cut).trim();
      }
      if (rest) parts.push(rest);

      const { data: outMsg } = await sb
        .from("whatsapp_cloud_messages")
        .insert({
          conversation_id: conv.id,
          user_id: userId,
          direction: "outbound",
          sender: "agent",
          content: reply,
          message_type: "text",
        })
        .select("id")
        .single();

      let sendError: string | null = null;
      try {
        const sentId = await sendWhatsApp(userId, row.from_number, parts[0]);
        if (sentId && outMsg?.id) {
          await sb.from("whatsapp_cloud_messages").update({ wamid: sentId }).eq("id", outMsg.id);
        }
        for (const part of parts.slice(1)) {
          await new Promise((r) => setTimeout(r, 600));
          await sendWhatsApp(userId, row.from_number, part);
        }
      } catch (e) {
        sendError = String((e as Error).message ?? e);
      }

      await sb.from("whatsapp_cloud_conversations").update({ last_message_at: new Date().toISOString() }).eq("id", conv.id);

      if (sendError) {
        await failQueue(row.id, `send_failed: ${sendError}`);
        return { ok: false, reason: "send_failed", error: sendError };
      }
      await doneQueue(row.id);
      return { ok: true, document_commented: true, filename: label, kind: extracted.kind, truncated: extracted.truncated };
    }


    // PASSO 6.9 — Memória por contato (read-only): se o número está em
    // contatos_comerciais, injeta contexto pra Jarvis personalizar a resposta.
    let contactMemoryBlock = "";
    try {
      const fromDigits = normalizePhoneBR(row.from_number);
      const fromTail = fromDigits.slice(-10); // DDD+8 (ignora 9º dígito e 55)
      if (fromTail.length >= 8) {
        const { data: contatos } = await sb
          .from("contatos_comerciais")
          .select("nome, empresa, tipo_relacionamento, contexto, proximos_passos, permite_jarvis_contatar, tags, whatsapp")
          .eq("user_id", userId)
          .eq("ativo", true);
        const match = (contatos ?? []).find((c: any) => {
          const cd = normalizePhoneBR(c.whatsapp || "");
          if (!cd) return false;
          return cd === fromDigits || cd.slice(-10) === fromTail || cd.slice(-8) === fromTail.slice(-8);
        });
        if (match) {
          const { data: recentMsgs } = await sb
            .from("whatsapp_cloud_messages")
            .select("direction, content, created_at")
            .eq("conversation_id", conv.id)
            .order("created_at", { ascending: false })
            .limit(6);
          const histLines = (recentMsgs ?? [])
            .slice(1) // exclui a mensagem atual recém-inserida
            .reverse()
            .map((m: any) => {
              const who = m.direction === "inbound" ? "Ele" : "Você";
              const txt = String(m.content || "").replace(/\s+/g, " ").slice(0, 140);
              return `  - ${who}: ${txt}`;
            })
            .join("\n");
          const tags = Array.isArray(match.tags) ? match.tags.join(", ") : (match.tags || "");
          const linhas = [
            `\n\nCONTEXTO DO CONTATO (uso INTERNO — personalize a resposta com naturalidade, NUNCA cite esses campos literalmente, nunca diga "seu tipo é X" ou "seus próximos passos são Y". É contexto pra VOCÊ, não pra recitar):`,
            match.nome ? `- Nome: ${match.nome}` : null,
            match.empresa ? `- Empresa: ${match.empresa}` : null,
            match.tipo_relacionamento ? `- Tipo de relacionamento: ${match.tipo_relacionamento}` : null,
            tags ? `- Tags: ${tags}` : null,
            match.contexto ? `- Sobre ele: ${match.contexto}` : null,
            match.proximos_passos ? `- Próximos passos combinados: ${match.proximos_passos}` : null,
            match.permite_jarvis_contatar === false ? `- IMPORTANTE: contato NÃO autorizou disparo proativo.` : null,
            histLines ? `- Últimas interações:\n${histLines}` : null,
            `- Regra: fale como quem já conhece a pessoa (use o primeiro nome quando fizer sentido), mas NÃO exponha esses dados crus.`,
          ].filter(Boolean).join("\n");
          contactMemoryBlock = linhas;
          console.log(`[processor][contact-memory] hit for ${row.from_number} -> ${match.nome}`);
        }
      }
    } catch (e) {
      console.warn("[processor][contact-memory] falhou:", (e as Error).message);
    }


    // PASSO 7 — System prompt (com contexto AMZ se aplicável)
    const { systemPrompt, mode } = await buildSystemPrompt(
      sb,
      {
        user_id: userId,
        agent_mode: (agent as any).agent_mode,
        agent_name: agent.agent_name,
        persona: agent.persona,
        tone: agent.tone,
        greeting: agent.greeting,
        knowledge_base: agent.knowledge_base,
        handoff_rules: agent.handoff_rules,
        is_active: agent.is_active,
      },
      userText || "",
      amzContextBlock,
    );
    // Injeta DATA/HORA atual (São Paulo) no system prompt — evita respostas desatualizadas
    const nowSP = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      weekday: "long", day: "2-digit", month: "long", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    }).format(new Date());
    const dateBlock = `\n\nCONTEXTO TEMPORAL (IMPORTANTE):\n- Data e hora atual em São Paulo: ${nowSP}.\n- Use SEMPRE esta data como referência de "hoje", "ontem", "esta semana", "este ano".\n- Para qualquer pergunta sobre notícias, eventos, cotações, clima, preços, jogos, agenda ou "o que está acontecendo", chame pesquisar_web com termos incluindo o ano/mês atual e passe recencia="d" (últimas 24h) ou "w" (última semana) quando fizer sentido. NUNCA responda de memória sobre fatos recentes.`;
    const mediaBlock = media.length > 0
      ? `\n\nMÍDIA RECEBIDA AGORA (REGRA CRÍTICA):\n- O cliente ENVIOU ${media.length} arquivo(s) (foto/vídeo/áudio) nesta mensagem.\n- Foto/vídeo/áudio enviado pelo cliente é MÍDIA LIVRE da biblioteca — NÃO é um produto do catálogo.\n- SEMPRE chame salvar_midia_biblioteca IMEDIATAMENTE. Passe em "contexto" o que o cliente falou (ou "sem contexto" se só mandou o arquivo).\n- É PROIBIDO chamar postar_redes_sociais quando há mídia nova enviada nesta mensagem — aquela tool é SÓ pra produtos do catálogo, nunca pra mídia recém-enviada pelo cliente.\n- É PROIBIDO buscar/casar essa mídia com produto do estoque/catálogo. Não invente produto.\n- Depois de salvar, responda curto: confirma que salvou na biblioteca /midias e diz que ele pode publicar/reusar por lá quando quiser. Não peça mais informação.`
      : "";

    // Detecta mídia recente em /midias (últimos 15 min) — se cliente pedir postar, usa ela em vez do catálogo
    let recentMediaBlock = "";
    try {
      const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const { data: recMid } = await sb
        .from("midias_whatsapp")
        .select("id, tipo, contexto_original, created_at")
        .eq("user_id", userId)
        .in("tipo", ["foto", "video"])
        .gte("created_at", cutoff)
        .order("created_at", { ascending: false })
        .limit(1);
      const m0 = recMid?.[0];
      if (m0 && media.length === 0) {
        recentMediaBlock = `\n\nMÍDIA RECENTE NA BIBLIOTECA /midias (últimos 15 min):\n- Tipo: ${m0.tipo}. Contexto salvo: "${m0.contexto_original ?? "sem contexto"}".\n- Se o dono pedir pra POSTAR/DIVULGAR agora em QUALQUER formato (feed, story, stories, reels), a mídia a publicar é ESTA que ele acabou de enviar — chame IMEDIATAMENTE postar_midia_biblioteca passando legenda/nome/preço do texto atual e formato='story' se ele citar story/stories (senão 'feed').\n- ⛔ NUNCA chame postar_redes_sociais nesse caso — aquela tool busca PRODUTO no CATÁLOGO e vai devolver item ERRADO (ex: pegar um "mop" aleatório quando a foto enviada era outra coisa). postar_redes_sociais é exclusiva pra quando o dono cita um PRODUTO do catálogo pelo nome SEM ter enviado mídia.\n- ⛔ NÃO chame buscar_estoque/consultar_estoque nesse caso.`;
      }
    } catch (e) {
      console.warn("[pietro][recent_media_hint] falhou:", (e as Error).message);
    }

    // FIX contexto perdido do vídeo: se dono mandou APENAS texto e há vídeo recente (~15min) sem legenda do dono,
    // persistir esse texto como contexto_original. Assim postar_midia_biblioteca vai achar contexto e não cair em video_sem_contexto.
    let pendingConfirmBlock = "";
    try {
      const isDono = row.from_number === OWNER_PHONE;
      if (isDono && media.length === 0 && (userText || "").trim().length > 0) {
        const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
        const { data: recVid } = await sb
          .from("midias_whatsapp")
          .select("id, tipo, contexto_original, created_at")
          .eq("user_id", userId)
          .eq("tipo", "video")
          .gte("created_at", cutoff)
          .order("created_at", { ascending: false })
          .limit(1);
        const v0 = recVid?.[0];
        const contextoAtual = (v0?.contexto_original || "").toString().trim();
        // Considera "sem legenda do dono" se contexto está vazio OU só tem bloco [visão] (vídeo não tem visão, mas por segurança).
        const semLegendaDono = !contextoAtual || /^\s*\[visão\]/i.test(contextoAtual);
        const texto = (userText || "").trim();
        // Evita gravar comandos puros de publicação como legenda.
        const ehComandoPublicar = /^(publica[rl]?|posta[rl]?|manda|pode postar|pode publicar|confirma|confirmar|ok|sim)\b/i.test(texto);
        if (v0 && semLegendaDono && !ehComandoPublicar && texto.length >= 3 && texto.length <= 400) {
          await sb
            .from("midias_whatsapp")
            .update({ contexto_original: contextoAtual ? `${texto}\n\n${contextoAtual}` : texto })
            .eq("id", v0.id);
          console.log(`[pietro][video_contexto_persist] midia=${v0.id} len=${texto.length}`);
        }
      }

      // FIX token não consumido: se há pending aguardando confirmação (últ 10min) e dono manda linguagem natural de publicar,
      // instruir o LLM a chamar confirmar_postagem_redes com o token JÁ existente em vez de recriar do zero.
      if (isDono) {
        const cutoffPend = new Date(Date.now() - 10 * 60 * 1000).toISOString();
        const { data: pendRows } = await sb
          .from("social_posts_queue")
          .select("platform, error_message, created_at")
          .eq("user_id", userId)
          .eq("status", "aguardando_confirmacao")
          .gte("created_at", cutoffPend)
          .order("created_at", { ascending: false })
          .limit(10);
        if (pendRows && pendRows.length > 0) {
          const marker = (pendRows[0] as any).error_message as string | null;
          const tokMatch = marker?.match(/jarvis_token:([a-f0-9]{8})/i);
          const token = tokMatch?.[1];
          if (token) {
            const formato = formatoFromPendingMarker(marker);
            const midiaTipo = midiaTipoFromPendingMarker(marker);
            const redes = [...new Set(pendRows.map((r: any) => r.platform))].join(", ");
            pendingConfirmBlock = `\n\nPOST PENDENTE AGUARDANDO CONFIRMAÇÃO (últimos 10 min):\n- token: ${token}\n- formato: ${formato}\n- mídia: ${midiaTipo}\n- redes: ${redes}\n- ⚡ Se o dono mandar QUALQUER comando de publicar em linguagem natural ("publica", "posta", "manda", "pode publicar", "pode postar", "vai", "confirma", "manda no reels", "posta no story", "sim"), chame IMEDIATAMENTE confirmar_postagem_redes com token="${token}". NÃO chame postar_midia_biblioteca de novo — o post já está preparado, só falta confirmar.\n- Se o dono pedir mudança clara (trocar rede, mudar formato, refazer legenda), aí sim recrie via postar_midia_biblioteca.`;
          }
        }
      }
    } catch (e) {
      console.warn("[pietro][video_ctx_or_pending] falhou:", (e as Error).message);
    }

    const systemPromptWithDate = systemPrompt + dateBlock + mediaBlock + recentMediaBlock + pendingConfirmBlock + contactMemoryBlock;
    console.log(`[processor] tenant=${userId} mode=${mode} promptLen=${systemPromptWithDate.length}`);

    // Histórico
    const { data: histRows } = await sb
      .from("whatsapp_cloud_messages")
      .select("direction, content")
      .eq("conversation_id", conv.id)
      .order("created_at", { ascending: false })
      .limit(11);
    const history = (histRows ?? [])
      .slice(1)
      .reverse()
      .filter((m) => m.content && !isStaleToolFailureMessage(m.content as string))
      .map((m) => ({
        role: m.direction === "inbound" ? "user" : "assistant",
        content: m.content as string,
      }));

    // PASSO 9 — IA (multimodal)
    const userContent = buildUserContent(userText, media);
    const { text: reply, imageUrl: generatedImageUrl } = await callGemini(systemPromptWithDate, history, userContent, media.length > 0, { userId, fromNumber: row.from_number, media });

    // Incrementa quota
    await sb
      .from("ai_messages_quota")
      .update({ used_count: quota.used_count + 1 })
      .eq("user_id", userId);

    // Splits reply em múltiplas mensagens separadas usando o sentinel <<SPLIT>>
    const replyParts = reply.split("<<SPLIT>>").map((p) => p.trim()).filter((p) => p.length > 0);
    const primaryReply = replyParts[0] ?? reply;
    const followUps = replyParts.slice(1);
    const loggedContent = replyParts.join("\n\n---\n\n");

    // PASSO 10 — Grava outbound
    const { data: outMsg } = await sb
      .from("whatsapp_cloud_messages")
      .insert({
        conversation_id: conv.id,
        user_id: userId,
        direction: "outbound",
        sender: "agent",
        content: generatedImageUrl ? `${loggedContent}\n\n[imagem: ${generatedImageUrl}]` : loggedContent,
        message_type: generatedImageUrl ? "image" : "text",
      })
      .select("id")
      .single();

    // PASSO 11 — Envia (mensagem principal + follow-ups separados)
    let sendError: string | null = null;
    try {
      const sentId = await sendWhatsApp(userId, row.from_number, primaryReply, generatedImageUrl);
      if (sentId && outMsg?.id) {
        await sb.from("whatsapp_cloud_messages").update({ wamid: sentId }).eq("id", outMsg.id);
      }
      for (const part of followUps) {
        try {
          await new Promise((r) => setTimeout(r, 600));
          await sendWhatsApp(userId, row.from_number, part);
        } catch (e) {
          console.error("[pietro][followup_send_failed]", (e as Error).message ?? e);
        }
      }
    } catch (e) {
      sendError = String((e as Error).message ?? e);
    }

    await sb
      .from("whatsapp_cloud_conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", conv.id);

    if (sendError) {
      await failQueue(row.id, `send_failed: ${sendError}`);
      return { ok: false, reason: "send_failed", error: sendError };
    }

    await doneQueue(row.id);
    return { ok: true, conversation_id: conv.id, reply_preview: reply.slice(0, 120) };
  } catch (e) {
    const msg = String((e as Error).message ?? e).slice(0, 500);
    await failQueue(row.id, msg);
    return { ok: false, reason: "exception", error: msg };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const queueId = body?.queue_id as string | undefined;

    if (queueId) {
      const result = await processOne(queueId);
      return Response.json(result, { headers: corsHeaders });
    }

    const { data: pending } = await sb
      .from("whatsapp_cloud_inbound_queue")
      .select("id")
      .eq("status", "received")
      .order("created_at", { ascending: true })
      .limit(20);

    const results: any[] = [];
    for (const p of pending ?? []) {
      results.push(await processOne(p.id));
    }
    return Response.json({ processed: results.length, results }, { headers: corsHeaders });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message ?? e) }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
