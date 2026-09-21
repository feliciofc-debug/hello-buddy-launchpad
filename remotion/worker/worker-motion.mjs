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
const limiteConfigurado = Number(process.env.WHATSAPP_VIDEO_MAX_BYTES);
const MAX_VIDEO_BYTES = Number.isFinite(limiteConfigurado) && limiteConfigurado >= 1024 * 1024
  ? limiteConfigurado
  : 15 * 1024 * 1024;
const TARGET_VIDEO_BYTES = Math.min(MAX_VIDEO_BYTES * 0.88, 13.5 * 1024 * 1024);

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

const tamanhoMb = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

async function executarFfmpeg(args) {
  await exec("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], {
    timeout: 12 * 60 * 1000,
    maxBuffer: 1024 * 1024 * 16,
  });
}

const substituirArquivo = (origem, destino) => {
  fs.rmSync(destino, { force: true });
  fs.renameSync(origem, destino);
};

async function otimizarVideoParaWhatsApp(outPath, dir) {
  const tamanhoInicial = fs.statSync(outPath).size;
  const fastPath = path.join(dir, "out-faststart.mp4");

  if (tamanhoInicial <= MAX_VIDEO_BYTES) {
    await executarFfmpeg([
      "-i", outPath,
      "-map", "0",
      "-c", "copy",
      "-movflags", "+faststart",
      fastPath,
    ]);
    substituirArquivo(fastPath, outPath);
    const tamanhoRemux = fs.statSync(outPath).size;
    if (tamanhoRemux <= MAX_VIDEO_BYTES) {
      console.log(`[motion] faststart aplicado (${tamanhoMb(tamanhoRemux)})`);
      return;
    }
  }

  console.warn(
    `[motion] arquivo acima do limite (${tamanhoMb(tamanhoInicial)}); recomprimindo antes do upload`,
  );
  const crfPath = path.join(dir, "out-crf30.mp4");
  await executarFfmpeg([
    "-i", outPath,
    "-map", "0:v:0",
    "-map", "0:a?",
    "-c:v", "libx264",
    "-preset", "medium",
    "-crf", "30",
    "-pix_fmt", "yuv420p",
    "-c:a", "aac",
    "-b:a", "128k",
    "-ac", "2",
    "-movflags", "+faststart",
    crfPath,
  ]);

  let escolhido = crfPath;
  let tamanhoFinal = fs.statSync(crfPath).size;
  if (tamanhoFinal > MAX_VIDEO_BYTES) {
    const duracao = await duracaoSegundos(outPath);
    if (!duracao || duracao <= 0) {
      throw new Error(`vídeo ainda tem ${tamanhoMb(tamanhoFinal)} e não foi possível medir a duração`);
    }
    const totalKbps = Math.floor((TARGET_VIDEO_BYTES * 8) / duracao / 1000);
    const videoKbps = Math.max(300, totalKbps - 128);
    const adaptivePath = path.join(dir, "out-adaptive.mp4");
    console.warn(
      `[motion] CRF 30 ainda gerou ${tamanhoMb(tamanhoFinal)}; limitando vídeo a ${videoKbps} kbps`,
    );
    await executarFfmpeg([
      "-i", outPath,
      "-map", "0:v:0",
      "-map", "0:a?",
      "-c:v", "libx264",
      "-preset", "medium",
      "-b:v", `${videoKbps}k`,
      "-maxrate", `${Math.round(videoKbps * 1.15)}k`,
      "-bufsize", `${videoKbps * 2}k`,
      "-pix_fmt", "yuv420p",
      "-c:a", "aac",
      "-b:a", "128k",
      "-ac", "2",
      "-movflags", "+faststart",
      adaptivePath,
    ]);
    escolhido = adaptivePath;
    tamanhoFinal = fs.statSync(adaptivePath).size;
  }

  if (tamanhoFinal > MAX_VIDEO_BYTES) {
    throw new Error(
      `recompressão terminou com ${tamanhoMb(tamanhoFinal)}, acima do limite de ${tamanhoMb(MAX_VIDEO_BYTES)}`,
    );
  }
  substituirArquivo(escolhido, outPath);
  console.log(`[motion] vídeo otimizado: ${tamanhoMb(tamanhoInicial)} -> ${tamanhoMb(tamanhoFinal)}`);
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

    await otimizarVideoParaWhatsApp(outPath, dir);
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
