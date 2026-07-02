// WhatsApp Cloud — Inbound Processor (Fase 1.2 — Pietro Multimodal)
// Modo AMZ: reconhece Felicio (dono), filtra clientes AMZ, lê imagens e áudios.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { decode as base64Decode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { buildSystemPrompt, ADMIN_AMZ_USER_ID } from "../_shared/agent-soul.ts";
import { buildAmzContext, STRANGER_MSG, OWNER_PHONE } from "../_shared/amz-context.ts";
import { downloadAllMedia, type MediaExtract } from "../_shared/whatsapp-media.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
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

async function toolPesquisarWeb(query: string, recencia?: string): Promise<string> {
  if (!GOOGLE_API_KEY || !GOOGLE_CX) return JSON.stringify({ erro: "Busca web não configurada" });
  try {
    const params = new URLSearchParams({
      key: GOOGLE_API_KEY, cx: GOOGLE_CX, q: query, num: "8", hl: "pt-BR", gl: "br", lr: "lang_pt",
    });
    // recencia: d=24h, w=7d, m=30d, y=365d (Google CSE dateRestrict)
    const r2 = (recencia || "").toLowerCase().trim();
    if (["d", "w", "m", "y"].includes(r2)) {
      params.set("dateRestrict", `${r2}1`);
      params.set("sort", "date");
    }
    const url = `https://www.googleapis.com/customsearch/v1?${params.toString()}`;
    const r = await fetch(url);
    if (!r.ok) return JSON.stringify({ erro: `busca falhou (${r.status})`, detalhe: await r.text().catch(() => "") });
    const d = await r.json();
    const items = (d.items ?? []).map((it: any) => ({
      titulo: it.title,
      link: it.link,
      resumo: it.snippet,
      fonte: it.displayLink,
      data: it.pagemap?.metatags?.[0]?.["article:published_time"] || it.pagemap?.metatags?.[0]?.["og:updated_time"] || null,
    }));
    return JSON.stringify({ query, recencia: recencia || "qualquer", total: items.length, resultados: items });
  } catch (e) {
    return JSON.stringify({ erro: String((e as Error).message) });
  }
}

function normalizePt(text: string): string {
  return (text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function detectNearbySearch(text: string): { query: string; radiusMeters: number } | null {
  const t = normalizePt(text);
  if (!t.trim()) return null;

  const placePatterns: Array<{ re: RegExp; query: string; radiusMeters?: number }> = [
    { re: /\b(supermercado|mercado|hortifruti|mercearia|grocery)\b/, query: "supermercado", radiusMeters: 2500 },
    { re: /\b(farmacia|drogaria|remedio)\b/, query: "farmácia", radiusMeters: 2500 },
    { re: /\b(cafe|cafeteria)\b/, query: "cafeteria", radiusMeters: 2000 },
    { re: /\b(restaurante|almoco|jantar|comida)\b/, query: "restaurante", radiusMeters: 2500 },
    { re: /\b(posto|gasolina|combustivel)\b/, query: "posto de gasolina", radiusMeters: 3000 },
    { re: /\b(hospital|emergencia|upa|pronto socorro)\b/, query: "hospital", radiusMeters: 5000 },
    { re: /\b(padaria|pao)\b/, query: "padaria", radiusMeters: 2000 },
    { re: /\b(banco|caixa eletronico|atm)\b/, query: "banco", radiusMeters: 2500 },
    { re: /\b(shopping|loja)\b/, query: "shopping", radiusMeters: 5000 },
  ];

  const hasLocationIntent = /\b(perto|proximo|proxima|localize|localizar|ache|achar|encontre|encontrar|mais perto|redondeza|ao redor|novamente)\b/.test(t);
  const found = placePatterns.find((p) => p.re.test(t));
  if (!found) return null;

  // Se citou um tipo de lugar junto de verbos de busca/proximidade, força a busca.
  // Também cobre frases curtas como "supermercado novamente".
  if (hasLocationIntent || t.split(/\s+/).length <= 5) {
    return { query: found.query, radiusMeters: found.radiusMeters ?? 2500 };
  }

  return null;
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
        signal: AbortSignal.timeout(15000),
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
  return await toolBuscarLugaresOpenStreetMap(locRow, query, radiusMeters, null);
}

// ---- gerar_imagem: cria imagem por IA (Nano Banana) e sobe pro storage público ----
async function toolGerarImagem(prompt: string, userId: string): Promise<string> {
  const clean = (prompt || "").trim();
  if (!clean) return JSON.stringify({ erro: "prompt vazio" });
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${LOVABLE_API_KEY}` },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-image-preview",
        messages: [{ role: "user", content: clean }],
        modalities: ["image", "text"],
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      return JSON.stringify({ erro: `image_gen ${res.status}`, detalhe: t.slice(0, 200) });
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
    const fileName = `whatsapp-ai/${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
    const { error: upErr } = await sb.storage.from("produtos").upload(fileName, bytes, { contentType: mime, upsert: true });
    if (upErr) return JSON.stringify({ erro: `upload_falhou: ${upErr.message}` });
    const { data: pub } = sb.storage.from("produtos").getPublicUrl(fileName);
    if (!pub?.publicUrl) return JSON.stringify({ erro: "sem_url_publica" });
    return JSON.stringify({ ok: true, image_url: pub.publicUrl, prompt: clean });
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
        model: "google/gemini-3.1-flash-image-preview",
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

// ---- cotacao_moeda: AwesomeAPI (grátis, sem chave). Ex: USD-BRL, EUR-BRL, BTC-BRL ----
async function toolCotacaoMoeda(par: string): Promise<string> {
  const clean = (par || "").toUpperCase().replace(/\s+/g, "").replace(/\//g, "-");
  if (!/^[A-Z]{3,5}-[A-Z]{3,5}$/.test(clean)) return JSON.stringify({ erro: "par_invalido", exemplo: "USD-BRL, EUR-BRL, BTC-BRL" });
  try {
    const r = await fetch(`https://economia.awesomeapi.com.br/last/${clean}`, { signal: AbortSignal.timeout(6000) });
    if (!r.ok) return JSON.stringify({ erro: `cotacao_api ${r.status}` });
    const d = await r.json();
    const key = clean.replace("-", "");
    const c = d[key];
    if (!c) return JSON.stringify({ erro: "par_nao_encontrado" });
    return JSON.stringify({
      par: clean,
      compra: Number(c.bid),
      venda: Number(c.ask),
      variacao_pct: Number(c.pctChange),
      maxima_dia: Number(c.high),
      minima_dia: Number(c.low),
      atualizado_em: c.create_date,
      nome: c.name,
    });
  } catch (e) {
    return JSON.stringify({ erro: String((e as Error).message) });
  }
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
      description: "Pesquisa no Google (pt-BR) e retorna títulos, links, resumos e data quando disponível. Use SEMPRE para notícias, eventos, cotações, clima, preços, resultados esportivos, greves, agenda — qualquer coisa que dependa de data. Inclua o ano/mês atual na query e use 'recencia' pra restringir a janela temporal.",
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
      description: "Cria uma imagem por IA a partir de um prompt descritivo (arte, foto realista, ilustração, banner, story, meme, mockup). Use SEMPRE que o usuário pedir 'faz uma imagem', 'gera uma arte', 'cria um post', 'desenha', 'me manda uma foto de X', 'faz um banner'. A imagem é enviada automaticamente no WhatsApp — você só precisa responder com uma legenda curta (1-2 linhas) descrevendo o que criou. NUNCA cole a URL na resposta, apenas comente.",
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
      description: "Consulta cotação em tempo real de moedas e cripto (fonte: AwesomeAPI). Exemplos: USD-BRL, EUR-BRL, BTC-BRL, ETH-BRL, GBP-BRL.",
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
];

async function runTool(
  name: string,
  args: any,
  ctx: { userId: string; fromNumber: string; media?: MediaExtract[] },
): Promise<{ result: string; imageUrl?: string }> {
  if (name === "consultar_cnpj") return { result: await toolConsultarCnpj(args?.cnpj ?? "") };
  if (name === "pesquisar_web") return { result: await toolPesquisarWeb(args?.query ?? "", args?.recencia) };
  if (name === "buscar_lugares_proximos") return { result: await toolBuscarLugaresProximos(ctx, args?.query ?? "", args?.radius_meters) };
  if (name === "gerar_imagem") {
    const r = await toolGerarImagem(args?.prompt ?? "", ctx.userId);
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

  // Modelo pro é mais confiável com áudio/imagem
  const model = hasMedia ? "google/gemini-2.5-pro" : "google/gemini-2.5-flash";
  let pendingImageUrl: string | undefined;

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
        messages.push({ role: "tool", tool_call_id: tc.id, content: result });
      }
      continue;
    }

    return { text: msg?.content ?? "", imageUrl: pendingImageUrl };
  }
  return { text: "Desculpa, não consegui concluir a pesquisa agora.", imageUrl: pendingImageUrl };
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
    const systemPromptWithDate = systemPrompt + dateBlock;
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
      .filter((m) => m.content)
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

    // PASSO 10 — Grava outbound
    const { data: outMsg } = await sb
      .from("whatsapp_cloud_messages")
      .insert({
        conversation_id: conv.id,
        user_id: userId,
        direction: "outbound",
        sender: "agent",
        content: generatedImageUrl ? `${reply}\n\n[imagem: ${generatedImageUrl}]` : reply,
        message_type: generatedImageUrl ? "image" : "text",
      })
      .select("id")
      .single();

    // PASSO 11 — Envia
    let sendError: string | null = null;
    try {
      const sentId = await sendWhatsApp(userId, row.from_number, reply, generatedImageUrl);
      if (sentId && outMsg?.id) {
        await sb.from("whatsapp_cloud_messages").update({ wamid: sentId }).eq("id", outMsg.id);
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
