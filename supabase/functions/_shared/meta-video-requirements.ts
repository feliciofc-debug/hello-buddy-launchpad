export type MetaVideoOutput = {
  width?: unknown;
  height?: unknown;
  video_codec?: unknown;
  audio_codec?: unknown;
  has_audio?: unknown;
  size_bytes?: unknown;
};

export type MetaVideoValidation = {
  ok: boolean;
  message?: string;
};

export function initialCaptionVideoFormat(
  requestText: unknown,
): "feed" | "story" | "reels" {
  const text = String(requestText || "");
  if (/\bstor(y|ies|ie)\b/i.test(text)) return "story";
  if (/\bfeed\b/i.test(text)) return "feed";
  return "reels";
}

export function metaVideoTarget(
  format: unknown,
): { width: 1080; height: 1920 | 1350; ratio: number } {
  const vertical = /^(story|reels)$/i.test(String(format || ""));
  return vertical
    ? { width: 1080, height: 1920, ratio: 1080 / 1920 }
    : { width: 1080, height: 1350, ratio: 1080 / 1350 };
}

export function renderedMetaVideoFormat(
  jobFormat: unknown,
  output?: MetaVideoOutput | null,
): "feed" | "story" | "reels" {
  const width = Number(output?.width);
  const height = Number(output?.height);
  if (Number.isFinite(width) && Number.isFinite(height) && height > 0) {
    const ratio = width / height;
    if (Math.abs(ratio - 1080 / 1350) <= 0.01) return "feed";
    if (Math.abs(ratio - 1080 / 1920) <= 0.01) {
      return /^story$/i.test(String(jobFormat || "")) ? "story" : "reels";
    }
  }
  if (/^story$/i.test(String(jobFormat || ""))) return "story";
  if (/^feed$/i.test(String(jobFormat || ""))) return "feed";
  return "reels";
}

export function shouldNotifyVideoPublishCaller(
  notifyWhatsapp: unknown,
): boolean {
  return notifyWhatsapp !== false;
}

export function validateMetaVideoForPublishing(input: {
  format?: unknown;
  path?: unknown;
  durationSeconds?: unknown;
  output?: MetaVideoOutput | null;
  sizeBytes?: unknown;
}): MetaVideoValidation {
  if (!/\.mp4$/i.test(String(input.path || ""))) {
    return { ok: false, message: "O vídeo final precisa estar em MP4." };
  }
  const duration = Number(input.durationSeconds);
  const isStory = /^story$/i.test(String(input.format || ""));
  const maxDuration = isStory ? 60 : 90;
  if (!Number.isFinite(duration) || duration < 1 || duration > maxDuration) {
    return {
      ok: false,
      message:
        `O vídeo precisa ter entre 1 e ${maxDuration} segundos para esse formato.`,
    };
  }
  const output = input.output;
  if (!output) {
    return {
      ok: false,
      message:
        "O vídeo ainda não foi validado para publicação. Renderize novamente após atualizar o worker.",
    };
  }
  if (String(output.video_codec || "").toLowerCase() !== "h264") {
    return { ok: false, message: "O vídeo final precisa usar H.264." };
  }
  const hasAudio = output.has_audio === true;
  if (
    hasAudio &&
    String(output.audio_codec || "").toLowerCase() !== "aac"
  ) {
    return { ok: false, message: "O áudio do vídeo precisa usar AAC." };
  }
  const width = Number(output.width);
  const height = Number(output.height);
  const target = metaVideoTarget(input.format);
  if (
    !Number.isFinite(width) || !Number.isFinite(height) ||
    Math.abs(width / height - target.ratio) > 0.01
  ) {
    return {
      ok: false,
      message: `O vídeo precisa estar em ${target.width}x${target.height}.`,
    };
  }
  const size = Number(input.sizeBytes ?? output.size_bytes);
  if (!Number.isFinite(size) || size <= 0 || size > 1024 * 1024 * 1024) {
    return {
      ok: false,
      message: "O vídeo final precisa ter até 1 GB.",
    };
  }
  return { ok: true };
}

export function friendlyMetaVideoPublishError(
  platform: string,
  error: unknown,
): string {
  const network = platform === "instagram" ? "Instagram" : "Facebook";
  const message = error instanceof Error ? error.message : String(error || "");
  if (/processamento ainda não terminou|timeout/i.test(message)) {
    return `${network}: o vídeo ainda está processando. Vou manter para tentar novamente.`;
  }
  return `${network}: não consegui publicar o vídeo. Tente novamente.`;
}
