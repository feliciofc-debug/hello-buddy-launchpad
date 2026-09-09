// ============================================================
// WORKER DE LEITURA DE SITE — "Camada B" (roda na VPS, só saída)
//
// Loop: site-render-claim -> abre a página no Chromium (Playwright)
//       -> lê cores REAIS do DOM renderizado + texto + fontes + logo
//       -> captura o topo da página -> site-render-complete
//
// Nunca inventa cor: tudo vem de getComputedStyle da página pronta.
//
// .env necessário na VPS:
//   SUPABASE_FUNCTIONS_URL=https://<ref>.supabase.co/functions/v1
//   VPS_RENDER_TOKEN=<mesmo secret do Supabase>
//
// Instalar (uma vez):  cd /opt/amz/remotion && npm i playwright \
//                      && npx playwright install --with-deps chromium
// Rodar com pm2:      pm2 start worker/worker-site-render.mjs --name amz-site
// ============================================================

import { chromium } from "playwright";

const BASE = process.env.SUPABASE_FUNCTIONS_URL;
const TOKEN = process.env.VPS_RENDER_TOKEN;
const INTERVALO_MS = 10_000;
const TIMEOUT_PAGINA_MS = 25_000;
const LARGURA = 1280;
const ALTURA = 900;

if (!BASE || !TOKEN) {
  console.error("faltam SUPABASE_FUNCTIONS_URL ou VPS_RENDER_TOKEN");
  process.exit(1);
}

const chamar = async (rota, body) => {
  const r = await fetch(`${BASE}/${rota}`, {
    method: "POST",
    headers: { "x-render-token": TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  return r.json();
};

// Roda DENTRO da página: pesa a cor por onde ela aparece (topo, botões,
// cabeçalho e links valem mais), igual à regra da Camada A.
const LEITOR = `(() => {
  const acc = new Map();
  const add = (cor, peso) => {
    if (!cor) return;
    const m = String(cor).match(/^rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)(?:,\\s*([\\d.]+))?\\)$/);
    if (!m) return;
    if (m[4] !== undefined && Number(m[4]) < 0.5) return;
    const hex = "#" + [m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, "0")).join("");
    if (hex === "#000000" && peso < 3) return;
    acc.set(hex, (acc.get(hex) || 0) + peso);
  };

  const vh = window.innerHeight || 900;
  const elementos = Array.from(document.querySelectorAll("body *")).slice(0, 4000);
  for (const el of elementos) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    if (r.top > vh * 1.5) continue;                    // só a dobra de cima
    const area = Math.min(r.width * r.height, 400000);
    const s = getComputedStyle(el);
    if (s.visibility === "hidden" || s.opacity === "0") continue;

    const tag = el.tagName.toLowerCase();
    const marcador = ((el.className || "") + " " + (el.id || "")).toString().toLowerCase();
    let mult = 1;
    if (tag === "header" || /header|navbar|topo|hero|banner/.test(marcador)) mult = 3;
    if (tag === "button" || tag === "a" || /btn|button|cta|comprar|primary|principal|brand|marca/.test(marcador)) mult = 3;
    if (tag === "footer" || /footer|rodape|cookie/.test(marcador)) mult = 0.3;
    if (r.top < vh * 0.5) mult *= 1.5;

    add(s.backgroundColor, (area / 20000) * 6 * mult);
    add(s.color, 2 * mult);
    if (tag === "svg" || tag === "path") { add(s.fill, 3 * mult); add(s.stroke, 2 * mult); }
    const bg = s.backgroundImage || "";
    for (const c of bg.match(/rgba?\\([^)]+\\)/g) || []) add(c, 3 * mult);
  }
  const body = getComputedStyle(document.body);
  add(body.backgroundColor, 40);

  const cores = [...acc.entries()]
    .map(([hex, peso]) => ({ hex, peso: Math.round(peso * 10) / 10 }))
    .sort((a, b) => b.peso - a.peso)
    .slice(0, 30);

  const lixo = /pol[ií]tica de privacidade|termos de uso|cookies?|aceitar|menu|entrar|cadastre|carregando|newsletter/i;
  const blocos = [];
  for (const el of document.querySelectorAll("h1,h2,h3,p,li")) {
    if (el.closest("nav,footer")) continue;
    const t = (el.innerText || "").replace(/\\s+/g, " ").trim();
    if (t.length < 25 || t.length > 400) continue;
    if (lixo.test(t)) continue;
    if (!blocos.includes(t)) blocos.push(t);
    if (blocos.length >= 14) break;
  }

  const fontes = [...new Set([
    getComputedStyle(document.body).fontFamily,
    getComputedStyle(document.querySelector("h1") || document.body).fontFamily,
  ].filter(Boolean).map((f) => String(f).split(",")[0].replace(/["']/g, "").trim()))];

  let logo = null;
  const cand = document.querySelector(
    'header img[alt*="logo" i], header img[src*="logo" i], img[alt*="logo" i], img[src*="logo" i], header img, img[class*="logo" i]'
  );
  if (cand && cand.currentSrc) logo = cand.currentSrc;

  const meta = (n) => (document.querySelector('meta[property="' + n + '"], meta[name="' + n + '"]') || {}).content || "";

  return {
    cores,
    texto: [meta("description"), ...blocos].filter(Boolean).join("\\n").slice(0, 6000),
    titulo: document.title || "",
    site_name: meta("og:site_name"),
    fontes: fontes.slice(0, 4),
    logo_url: logo,
  };
})()`;

async function baixarLogo(pagina, url) {
  if (!url) return null;
  try {
    const resp = await pagina.request.get(url, { timeout: 10_000 });
    if (!resp.ok()) return null;
    const tipo = (resp.headers()["content-type"] || "").split(";")[0].trim();
    if (!/^image\//.test(tipo)) return null;
    const buf = await resp.body();
    if (!buf.length || buf.length > 900_000) return null;
    return `data:${tipo};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

async function processar(navegador, job) {
  const contexto = await navegador.newContext({
    viewport: { width: LARGURA, height: ALTURA },
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    locale: "pt-BR",
  });
  const pagina = await contexto.newPage();
  try {
    await pagina.goto(job.url, { waitUntil: "domcontentloaded", timeout: TIMEOUT_PAGINA_MS });
    await pagina.waitForTimeout(3500); // deixa o JavaScript montar a tela
    const dados = await pagina.evaluate(LEITOR);
    const captura = await pagina.screenshot({ type: "jpeg", quality: 70 });
    const logoDataUrl = await baixarLogo(pagina, dados.logo_url);

    await chamar("site-render-complete", {
      job_id: job.id,
      success: true,
      ...dados,
      logo_data_url: logoDataUrl,
      captura_data_url: `data:image/jpeg;base64,${captura.toString("base64")}`,
    });
    console.log("[site] ok", job.url, dados.cores.length, "cores");
  } catch (e) {
    console.error("[site] falhou", job.url, e.message);
    await chamar("site-render-complete", {
      job_id: job.id,
      success: false,
      erro: String(e.message || e).slice(0, 500),
    });
  } finally {
    await contexto.close().catch(() => {});
  }
}

console.log("[site] worker iniciado");
const navegador = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
for (;;) {
  try {
    const r = await chamar("site-render-claim");
    if (r?.job) {
      await processar(navegador, r.job);
      continue;
    }
  } catch (e) {
    console.error("[site] claim erro:", e.message);
  }
  await new Promise((r) => setTimeout(r, INTERVALO_MS));
}
