/**
 * ==============================================================
 * legendarVideo — legenda QUEIMADA no vídeo (pt-BR)
 * ==============================================================
 * Estratégia "Canvas + FFmpeg" (mesma do useGerarReel):
 * - Cada bloco de legenda é desenhado no Canvas como PNG transparente
 *   (fonte do navegador → nenhuma dependência de fonte no FFmpeg).
 * - O FFmpeg.wasm só faz `overlay` de cada PNG na janela de tempo do bloco.
 *
 * Resultado: MP4 (H.264 + AAC) aceito pela Meta em Reels/Stories/Feed.
 */
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";

const FFMPEG_CDNS = [
  "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm",
  "https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm",
  "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm",
];

export interface LegendaSegmento {
  start: number;
  end: number;
  text: string;
}

export interface ProgressoLegenda {
  etapa: "carregando" | "preparando" | "renderizando" | "queimando" | "pronto";
  pct: number;
  mensagem: string;
}

/** Máximo de blocos sobrepostos (protege o filtro do FFmpeg de ficar gigante). */
const MAX_SEGMENTOS = 80;

let ffmpegRef: FFmpeg | null = null;
let carregado = false;

async function carregarFFmpeg(onProgress?: (p: ProgressoLegenda) => void) {
  if (!ffmpegRef) ffmpegRef = new FFmpeg();
  if (carregado) return ffmpegRef;

  onProgress?.({
    etapa: "carregando",
    pct: 5,
    mensagem: "Carregando o motor de legendas (1ª vez leva ~30s)...",
  });

  let ultimoErro: unknown = null;
  for (const cdn of FFMPEG_CDNS) {
    try {
      const coreURL = await toBlobURL(`${cdn}/ffmpeg-core.js`, "text/javascript");
      const wasmURL = await toBlobURL(`${cdn}/ffmpeg-core.wasm`, "application/wasm");
      await ffmpegRef.load({ coreURL, wasmURL });
      carregado = true;
      return ffmpegRef;
    } catch (err) {
      console.warn("[LEGENDA] CDN falhou:", cdn, err);
      ultimoErro = err;
    }
  }
  throw new Error(
    `Não consegui carregar o motor de legendas: ${
      ultimoErro instanceof Error ? ultimoErro.message : "erro desconhecido"
    }`,
  );
}

/** Descobre largura/altura do vídeo pelo próprio navegador. */
export function dimensoesDoVideo(
  src: string,
): Promise<{ width: number; height: number; duration: number }> {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () =>
      resolve({
        width: v.videoWidth || 1080,
        height: v.videoHeight || 1920,
        duration: v.duration || 0,
      });
    v.onerror = () => reject(new Error("Não consegui ler o vídeo"));
    v.src = src;
  });
}

function quebrarLinhas(
  ctx: CanvasRenderingContext2D,
  texto: string,
  maxWidth: number,
): string[] {
  const linhas: string[] = [];
  for (const bruta of texto.split("\n")) {
    let atual = "";
    for (const palavra of bruta.split(/\s+/).filter(Boolean)) {
      const teste = atual ? `${atual} ${palavra}` : palavra;
      if (ctx.measureText(teste).width > maxWidth && atual) {
        linhas.push(atual);
        atual = palavra;
      } else {
        atual = teste;
      }
    }
    if (atual) linhas.push(atual);
  }
  return linhas.slice(0, 3);
}

/** Desenha um bloco de legenda como PNG transparente na largura do vídeo. */
async function pngDoSegmento(
  texto: string,
  videoW: number,
  videoH: number,
): Promise<{ bytes: Uint8Array; height: number }> {
  const fontSize = Math.round(Math.max(28, videoW * 0.052));
  const padX = Math.round(videoW * 0.05);
  const lineHeight = Math.round(fontSize * 1.28);

  const medidor = document.createElement("canvas").getContext("2d")!;
  medidor.font = `700 ${fontSize}px Arial, Helvetica, sans-serif`;
  const linhas = quebrarLinhas(medidor, texto, videoW - padX * 2);

  const altura = linhas.length * lineHeight + Math.round(fontSize * 0.8);
  const canvas = document.createElement("canvas");
  canvas.width = videoW;
  canvas.height = altura;
  const ctx = canvas.getContext("2d")!;

  ctx.font = `700 ${fontSize}px Arial, Helvetica, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Caixa escura semi-transparente atrás do texto (legibilidade em qualquer cena)
  linhas.forEach((linha, i) => {
    const w = ctx.measureText(linha).width;
    const y = Math.round(fontSize * 0.4) + i * lineHeight + lineHeight / 2;
    const boxW = w + fontSize * 0.7;
    const boxH = lineHeight * 0.98;
    const x = videoW / 2 - boxW / 2;
    ctx.fillStyle = "rgba(0,0,0,0.62)";
    const r = Math.round(boxH * 0.22);
    ctx.beginPath();
    ctx.moveTo(x + r, y - boxH / 2);
    ctx.arcTo(x + boxW, y - boxH / 2, x + boxW, y + boxH / 2, r);
    ctx.arcTo(x + boxW, y + boxH / 2, x, y + boxH / 2, r);
    ctx.arcTo(x, y + boxH / 2, x, y - boxH / 2, r);
    ctx.arcTo(x, y - boxH / 2, x + boxW, y - boxH / 2, r);
    ctx.closePath();
    ctx.fill();

    ctx.lineWidth = Math.max(3, fontSize * 0.11);
    ctx.strokeStyle = "rgba(0,0,0,0.9)";
    ctx.strokeText(linha, videoW / 2, y);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(linha, videoW / 2, y);
  });

  const blob = await new Promise<Blob>((r) =>
    canvas.toBlob((b) => r(b!), "image/png"),
  );
  return { bytes: new Uint8Array(await blob.arrayBuffer()), height: altura };
}

/**
 * Queima os segmentos no vídeo e devolve um MP4 novo.
 * `fonte` pode ser um File (upload) ou uma URL pública/assinada.
 */
export async function queimarLegendas(
  fonte: File | Blob | string,
  segmentos: LegendaSegmento[],
  onProgress?: (p: ProgressoLegenda) => void,
): Promise<Blob> {
  const segs = segmentos
    .filter((s) => s.text?.trim() && s.end > s.start)
    .slice(0, MAX_SEGMENTOS);

  if (segs.length === 0) throw new Error("Nenhuma legenda para aplicar");

  const ffmpeg = await carregarFFmpeg(onProgress);

  onProgress?.({ etapa: "preparando", pct: 20, mensagem: "Preparando o vídeo..." });

  let bytesVideo: Uint8Array;
  let objectUrl: string | null = null;
  if (typeof fonte === "string") {
    const res = await fetch(fonte);
    if (!res.ok) throw new Error("Não consegui baixar o vídeo para legendar");
    const blob = await res.blob();
    bytesVideo = new Uint8Array(await blob.arrayBuffer());
    objectUrl = URL.createObjectURL(blob);
  } else {
    bytesVideo = new Uint8Array(await fonte.arrayBuffer());
    objectUrl = URL.createObjectURL(fonte);
  }

  const { width, height } = await dimensoesDoVideo(objectUrl);
  URL.revokeObjectURL(objectUrl);

  await ffmpeg.writeFile("entrada.mp4", bytesVideo);

  onProgress?.({
    etapa: "renderizando",
    pct: 35,
    mensagem: `Desenhando ${segs.length} legenda(s)...`,
  });

  // Y da legenda: ~12% acima da base (não conflita com a UI do Reels)
  const filtros: string[] = [];
  let ultimo = "[0:v]";
  for (let i = 0; i < segs.length; i++) {
    const { bytes, height: hSeg } = await pngDoSegmento(segs[i].text, width, height);
    await ffmpeg.writeFile(`leg_${i}.png`, bytes);
    const y = Math.max(0, Math.round(height * 0.8 - hSeg / 2));
    const saida = i === segs.length - 1 ? "[vout]" : `[v${i}]`;
    filtros.push(
      `${ultimo}[${i + 1}:v]overlay=0:${y}:enable='between(t,${segs[i].start.toFixed(
        2,
      )},${segs[i].end.toFixed(2)})'${saida}`,
    );
    ultimo = `[v${i}]`;
    onProgress?.({
      etapa: "renderizando",
      pct: 35 + ((i + 1) / segs.length) * 15,
      mensagem: `Desenhando legenda ${i + 1}/${segs.length}...`,
    });
  }

  onProgress?.({
    etapa: "queimando",
    pct: 55,
    mensagem: "Gravando as legendas no vídeo (pode levar alguns minutos)...",
  });

  const args = ["-i", "entrada.mp4"];
  for (let i = 0; i < segs.length; i++) args.push("-i", `leg_${i}.png`);
  args.push(
    "-filter_complex",
    filtros.join(";"),
    "-map",
    "[vout]",
    "-map",
    "0:a?",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-preset",
    "ultrafast",
    "-crf",
    "24",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-movflags",
    "+faststart",
    "saida.mp4",
  );

  await ffmpeg.exec(args);

  const data = await ffmpeg.readFile("saida.mp4");
  const buf = new Uint8Array(data as Uint8Array);

  // Limpeza
  try {
    await ffmpeg.deleteFile("entrada.mp4");
    await ffmpeg.deleteFile("saida.mp4");
    for (let i = 0; i < segs.length; i++) await ffmpeg.deleteFile(`leg_${i}.png`);
  } catch { /* ignora */ }

  onProgress?.({ etapa: "pronto", pct: 100, mensagem: "Legenda pronta!" });

  return new Blob([buf.buffer as ArrayBuffer], { type: "video/mp4" });
}

/** Formata os segmentos como texto editável (1 bloco por linha). */
export function segmentosParaTexto(segs: LegendaSegmento[]): string {
  return segs
    .map((s) => `[${s.start.toFixed(1)}-${s.end.toFixed(1)}] ${s.text.replace(/\n/g, " / ")}`)
    .join("\n");
}

/** Lê de volta o texto editado pelo usuário. */
export function textoParaSegmentos(
  texto: string,
  original: LegendaSegmento[],
): LegendaSegmento[] {
  const linhas = texto.split("\n").map((l) => l.trim()).filter(Boolean);
  const segs: LegendaSegmento[] = [];
  linhas.forEach((linha, i) => {
    const m = linha.match(/^\[(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)\]\s*(.+)$/);
    if (m) {
      segs.push({
        start: parseFloat(m[1]),
        end: parseFloat(m[2]),
        text: m[3].replace(/\s*\/\s*/g, "\n"),
      });
    } else if (original[i]) {
      segs.push({ ...original[i], text: linha.replace(/\s*\/\s*/g, "\n") });
    }
  });
  return segs.filter((s) => s.end > s.start && s.text.trim());
}
