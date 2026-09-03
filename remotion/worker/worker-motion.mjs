// ============================================================
// WORKER REMOTION (roda na VPS, só chamadas de saída)
// Loop: claim -> render -> upload -> complete
//
// .env necessário na VPS:
//   SUPABASE_FUNCTIONS_URL=https://<ref>.supabase.co/functions/v1
//   VPS_RENDER_TOKEN=<mesmo secret do Supabase>
//   PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium   (opcional)
//
// Pré-requisitos: Node 20+, Chromium, ffmpeg e `npm i` nesta pasta remotion/.
// Rodar com pm2:  pm2 start worker/worker-motion.mjs --name amz-motion
// ============================================================

import fs from "fs";
import os from "os";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";

const exec = promisify(execFile);
const BASE = process.env.SUPABASE_FUNCTIONS_URL;
const TOKEN = process.env.VPS_RENDER_TOKEN;
const INTERVALO_MS = 15000;

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

async function duracaoSegundos(arquivo) {
  try {
    const { stdout } = await exec("ffprobe", [
      "-v", "error", "-show_entries", "format=duration",
      "-of", "default=nw=1:nk=1", arquivo,
    ]);
    return Math.round(parseFloat(stdout.trim()) * 10) / 10;
  } catch {
    return null;
  }
}

// ------------------------------------------------------------
// REMOÇÃO DE FUNDO (rembg local, custo zero)
//
// Roda SEMPRE EM SÉRIE, antes do render: o Chromium do Remotion é
// pesado e não pode competir por CPU com o modelo.
//
// Usa o BINÁRIO do rembg (`rembg i`). O modo serviço (`rembg s`)
// não é utilizável: sobe uma UI Gradio que tenta abrir Chromium e,
// rodando como root sem --no-sandbox, derruba o servidor.
//
// Se o recorte falhar, o vídeo continua saindo: cai no fallback de
// fundo desfocado do próprio template.
// ------------------------------------------------------------
const REMBG_BIN = process.env.REMBG_BIN || "/opt/rembg-env/bin/rembg";
const REMBG_MODELO = process.env.REMBG_MODELO || "u2netp";
const REMBG_TIMEOUT_MS = Number(process.env.REMBG_TIMEOUT_MS || 90000);
const RECORTE_MAX_BYTES = 8 * 1024 * 1024;

async function recortarFundo(imagemUrl) {
  const baixar = await fetch(imagemUrl, { signal: AbortSignal.timeout(REMBG_TIMEOUT_MS) });
  if (!baixar.ok) throw new Error(`download da foto falhou: ${baixar.status}`);
  const entrada = Buffer.from(await baixar.arrayBuffer());
  if (entrada.length > 15 * 1024 * 1024) throw new Error("foto maior que 15MB");

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rembg-"));
  const src = path.join(dir, "entrada.png");
  const dst = path.join(dir, "saida.png");
  try {
    fs.writeFileSync(src, entrada);
    // execFile: sem shell, sem risco de injeção pelos argumentos.
    await exec(REMBG_BIN, ["i", "-m", REMBG_MODELO, src, dst], {
      timeout: REMBG_TIMEOUT_MS,
      maxBuffer: 1024 * 1024 * 8,
    });
    if (!fs.existsSync(dst)) throw new Error("rembg não gerou arquivo de saída");
    const saida = fs.readFileSync(dst);
    if (!saida.length) throw new Error("rembg devolveu arquivo vazio");
    if (saida.length > RECORTE_MAX_BYTES) throw new Error("PNG recortado grande demais");
    return `data:image/png;base64,${saida.toString("base64")}`;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}


/** Aplica o recorte quando pedido. Nunca derruba o job. */
async function prepararProps(job) {
  const props = job.props ? JSON.parse(JSON.stringify(job.props)) : {};
  const produto = props.produto;
  if (!produto || produto.recortar_fundo !== true || !produto.imagemUrl) return props;

  try {
    const t0 = Date.now();
    produto.imagemUrl = await recortarFundo(produto.imagemUrl);
    produto.recortado = true;
    console.log(`[motion] recorte ok em ${Math.round((Date.now() - t0) / 1000)}s`);
  } catch (e) {
    produto.recortado = false;
    console.warn("[motion] recorte falhou, seguindo com fundo desfocado:", e.message);
  }
  return props;
}

async function processar(job) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "motion-"));
  const propsPath = path.join(dir, "props.json");
  const outPath = path.join(dir, "out.mp4");

  try {
    fs.writeFileSync(propsPath, JSON.stringify(await prepararProps(job)));


    await exec(
      process.execPath,
      [path.resolve("scripts/render-template.mjs"), job.template, propsPath, outPath],
      { maxBuffer: 1024 * 1024 * 32, timeout: 15 * 60 * 1000 },
    );

    const bytes = fs.readFileSync(outPath);
    const up = await fetch(job.upload.url, {
      method: "PUT",
      headers: { "Content-Type": job.upload.content_type, "x-upsert": "true" },
      body: bytes,
    });
    if (!up.ok) throw new Error(`upload falhou: ${up.status} ${(await up.text()).slice(0, 200)}`);

    await chamar("video-motion-complete", {
      job_id: job.id,
      success: true,
      resultado_bucket: job.upload.bucket,
      resultado_path: job.upload.path,
      duracao_segundos: await duracaoSegundos(outPath),
    });
    console.log("[motion] ok", job.id);
  } catch (e) {
    console.error("[motion] falhou", job.id, e.message);
    await chamar("video-motion-complete", {
      job_id: job.id,
      success: false,
      erro: String(e.message || e).slice(0, 500),
    });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

console.log("[motion] worker iniciado");
for (;;) {
  try {
    const r = await chamar("video-motion-claim");
    if (r?.job) {
      await processar(r.job);
      continue; // sem espera: pode ter mais fila
    }
  } catch (e) {
    console.error("[motion] claim erro:", e.message);
  }
  await new Promise((r) => setTimeout(r, INTERVALO_MS));
}
