import { existsSync } from "fs";
// Renderiza uma composição paramétrica a partir de um JSON de props.
// Uso: node scripts/render-template.mjs <composicao> <props.json> <saida.mp4>
// É este script que o worker da VPS chama para cada job da fila.

import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition, openBrowser } from "@remotion/renderer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const [compId = "template-agente", propsPath, outPath = "/mnt/documents/template.mp4"] =
  process.argv.slice(2);

if (!propsPath) {
  console.error("uso: node scripts/render-template.mjs <composicao> <props.json> <saida.mp4>");
  process.exit(1);
}

const inputProps = JSON.parse(fs.readFileSync(propsPath, "utf8"));

/** Fire-and-forget: nunca bloqueia renderMedia (timeout 5s). */
function reportarProgresso(pct, etapa) {
  const jobId = process.env.MOTION_JOB_ID;
  const base = process.env.SUPABASE_FUNCTIONS_URL
    || process.env.MOTION_PROGRESS_URL?.replace(/\/video-motion-progress$/, "");
  const token = process.env.VPS_RENDER_TOKEN;
  if (!jobId || !base || !token) return;
  fetch(`${base}/video-motion-progress`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-render-token": token,
    },
    body: JSON.stringify({
      job_id: jobId,
      progresso_pct: Math.min(99, Math.max(0, Math.round(pct))),
      etapa,
    }),
    signal: AbortSignal.timeout(5000),
  }).catch((e) => {
    console.warn("[render] progresso:", e?.message || e);
  });
}

function pctRenderizando(progress0to1) {
  const p = Math.min(1, Math.max(0, Number(progress0to1)));
  return Math.min(90, Math.max(10, Math.round(10 + p * 80)));
}

let ultimoPctRender = 9;

// Detecta o navegador disponível. Se nada existir, deixa null: o Remotion baixa um.
function acharChromium() {
  const candidatos = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/snap/bin/chromium",
  ].filter(Boolean);
  for (const c of candidatos) if (existsSync(c)) return c;
  return null;
}

const serveUrl = await bundle({
  entryPoint: path.resolve(__dirname, "../src/index.ts"),
  webpackOverride: (c) => c,
});

const browser = await openBrowser("chrome", {
  browserExecutable: acharChromium(),
  chromiumOptions: { args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"] },
  chromeMode: "chrome-for-testing",
});

const composition = await selectComposition({
  serveUrl,
  id: compId,
  inputProps,
  puppeteerInstance: browser,
});
const alvoSegundos = Number(inputProps?.duracao_alvo_segundos);
const alvoFrames = Number.isFinite(alvoSegundos) && alvoSegundos >= 20 && alvoSegundos <= 95
  ? Math.round(alvoSegundos * composition.fps)
  : null;
const compositionFinal = alvoFrames
  ? { ...composition, durationInFrames: alvoFrames }
  : composition;
if (alvoFrames && composition.durationInFrames !== alvoFrames) {
  console.warn(
    `[duration] composição calculou ${composition.durationInFrames} frames; ` +
    `ajustando para ${alvoFrames} (${alvoSegundos}s)`,
  );
}

await renderMedia({
  composition: compositionFinal,
  serveUrl,
  codec: "h264",
  // Perfil inicial adequado para WhatsApp: reduz bastante o arquivo sem
  // sacrificar a legibilidade de tipografia e logos.
  crf: 27,
  x264Preset: "medium",
  audioBitrate: "128k",
  pixelFormat: "yuv420p",
  inputProps,
  outputLocation: outPath,
  puppeteerInstance: browser,
  muted: !inputProps?.trilhaUrl,
  concurrency: 1,
  onProgress: ({ progress }) => {
    const pct = pctRenderizando(progress);
    if (pct > ultimoPctRender) {
      ultimoPctRender = pct;
      reportarProgresso(pct, "renderizando");
    }
  },
});

reportarProgresso(90, "renderizando");

await browser.close({ silent: false });
console.log("ok", compId, "->", outPath, `${compositionFinal.durationInFrames} frames`);
