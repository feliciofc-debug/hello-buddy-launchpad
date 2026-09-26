const EMOJI_CHARS =
  /[\p{Extended_Pictographic}\p{Emoji_Presentation}\p{Emoji_Modifier}\u{1F1E6}-\u{1F1FF}\uFE0E\uFE0F\u200D\u20E3]/gu;
const LEADING_EMOJI_CHARS =
  /^\s*[\p{Extended_Pictographic}\p{Emoji_Presentation}\p{Emoji_Modifier}\u{1F1E6}-\u{1F1FF}\uFE0E\uFE0F\u200D\u20E3]+/u;

export function requestedCarouselSlideCount(text: string, demonstration = false): number {
  const match = String(text || "").match(
    /\b(?:com\s+|de\s+)?(\d{1,2})\s*(?:cards?|slides?|p[aá]ginas?)\b/i,
  );
  const requested = match ? Number(match[1]) : 7;
  const bounded = Math.max(3, Math.min(10, Number.isFinite(requested) ? requested : 7));
  return demonstration ? Math.min(5, bounded) : bounded;
}

export function carouselBodyLines(value: unknown): string[] {
  return String(value ?? "")
    .replace(/\\n/g, "\n")
    .split("\n")
    .map((line) => {
      const hadEmojiMarker = LEADING_EMOJI_CHARS.test(line);
      const withoutEmoji = line.replace(EMOJI_CHARS, "").trim().replace(/^[•·\-–—]\s*/, "");
      return withoutEmoji ? `${hadEmojiMarker ? "• " : ""}${withoutEmoji}` : "";
    })
    .filter(Boolean);
}

export function sanitizeCarouselSlides(slides: unknown[]): Array<Record<string, unknown>> {
  return slides.map((raw) => {
    const slide = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
    const title = String(slide.title ?? "").replace(EMOJI_CHARS, "").trim();
    const bodyLines = carouselBodyLines(slide.body);
    return {
      ...slide,
      title,
      ...(bodyLines.length ? { body: bodyLines.join("\n") } : { body: undefined }),
    };
  });
}

function stripDemoBrandAndContact(value: unknown): string {
  return String(value ?? "")
    .replace(/https?:\/\/\S+|\bwa\.me\/\S+/gi, "")
    .replace(/#?amz(?:\s+ofertas)?\b/gi, "")
    .replace(/@[a-z0-9._-]+/gi, "")
    .replace(/\+?55\s*\(?\d{2}\)?[\s-]*\d{4,5}[\s-]*\d{4}/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .trim();
}

export function sanitizeProspectDemoSlides(slides: unknown[]): Array<Record<string, unknown>> {
  return sanitizeCarouselSlides(slides).map((slide) => ({
    ...slide,
    title: stripDemoBrandAndContact(slide.title),
    ...(slide.body ? { body: stripDemoBrandAndContact(slide.body) } : {}),
  }));
}

export function sanitizeProspectDemoCaption(value: unknown, tema: string): string {
  const clean = stripDemoBrandAndContact(value)
    .replace(/#\s+/g, "")
    .trim();
  return clean || `Exemplo de legenda: conheça os principais benefícios de ${tema}.`;
}

export async function sendCarouselCardsInOrder(params: {
  imageUrls: string[];
  send: (url: string, index: number, total: number) => Promise<void>;
  startIndex?: number;
  maxCards?: number;
  pause?: (milliseconds: number) => Promise<void>;
  logger?: (message: string) => void;
}): Promise<number> {
  const start = Math.max(0, params.startIndex ?? 0);
  const end = Math.min(
    params.imageUrls.length,
    start + Math.max(0, params.maxCards ?? params.imageUrls.length),
  );
  let sent = 0;

  for (let index = start; index < end; index++) {
    let lastError: unknown;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        await params.send(params.imageUrls[index], index, params.imageUrls.length);
        sent++;
        params.logger?.(
          `[carrossel-preview] card=${index + 1}/${params.imageUrls.length} tentativa=${attempt} enviado`,
        );
        lastError = null;
        break;
      } catch (error) {
        lastError = error;
        params.logger?.(
          `[carrossel-preview] card=${index + 1}/${params.imageUrls.length} tentativa=${attempt} falhou`,
        );
        if (attempt === 1) await params.pause?.(350);
      }
    }
    if (lastError) throw lastError;
    if (index + 1 < end) await params.pause?.(250);
  }

  params.logger?.(`[carrossel-preview] enviados=${sent}/${end - start}`);
  return sent;
}
