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

async function processar(job) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "motion-"));
  const propsPath = path.join(dir, "props.json");
  const outPath = path.join(dir, "out.mp4");

  try {
    fs.writeFileSync(propsPath, JSON.stringify(job.props));

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
