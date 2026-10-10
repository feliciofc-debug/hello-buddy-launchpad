export interface VideoTranscriptSegment {
  start: number;
  end: number;
  text: string;
}

export type VideoTranscriptionAction = {
  action: "retry" | "write";
  mediaId: string;
};

const MEDIA_ID_RE =
  /^[0-9a-f]{8}(?:-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})?$/i;

export function normalizeVideoTranscriptSegments(
  raw: unknown,
): VideoTranscriptSegment[] {
  if (!Array.isArray(raw)) return [];
  const segments: VideoTranscriptSegment[] = [];
  for (const item of raw) {
    const start = Number(item?.start ?? item?.inicio ?? 0);
    const end = Number(item?.end ?? item?.fim ?? 0);
    const text = String(item?.text ?? item?.texto ?? "").trim();
    if (!text || !Number.isFinite(start) || !Number.isFinite(end)) continue;
    if (end <= start) continue;
    segments.push({ start: Math.max(0, start), end, text });
  }
  segments.sort((a, b) => a.start - b.start);
  for (let index = 1; index < segments.length; index++) {
    if (segments[index].start < segments[index - 1].end) {
      segments[index].start = segments[index - 1].end;
    }
  }
  return segments.filter((segment) => segment.end - segment.start >= 0.3);
}

export function parseVideoTranscriptContent(content: unknown): {
  validJson: boolean;
  segments: VideoTranscriptSegment[];
} {
  const raw = String(content ?? "");
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return { validJson: false, segments: [] };
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      return { validJson: false, segments: [] };
    }
  }
  return {
    validJson: true,
    segments: normalizeVideoTranscriptSegments(
      parsed?.segments ?? parsed?.segmentos,
    ),
  };
}

export async function transcribeVideoWithFallback(input: {
  fetcher?: typeof fetch;
  endpoint: string;
  apiKey: string;
  prompt: string;
  videoUrl: string;
  models?: string[];
  logger?: (entry: {
    attempt: number;
    model: string;
    contentLength: number;
    segmentCount: number;
    validJson: boolean;
    status: number;
  }) => void;
}): Promise<VideoTranscriptSegment[]> {
  const fetcher = input.fetcher ?? fetch;
  const models = input.models ?? [
    "google/gemini-3.6-flash",
    "google/gemini-3.1-pro-preview",
  ];
  let lastError: Error | null = null;
  let receivedSuccessfulResponse = false;
  for (let index = 0; index < models.length; index++) {
    const model = models[index];
    try {
      const response = await fetcher(input.endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${input.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [{
            role: "user",
            content: [
              { type: "text", text: input.prompt },
              {
                type: "video_url",
                video_url: { url: input.videoUrl },
              },
            ],
          }],
          response_format: { type: "json_object" },
        }),
      });
      if (!response.ok) {
        lastError = new Error(`gateway_${response.status}`);
        input.logger?.({
          attempt: index + 1,
          model,
          contentLength: 0,
          segmentCount: 0,
          validJson: false,
          status: response.status,
        });
        continue;
      }
      receivedSuccessfulResponse = true;
      const json = await response.json();
      const content = String(json?.choices?.[0]?.message?.content ?? "");
      const parsed = parseVideoTranscriptContent(content);
      input.logger?.({
        attempt: index + 1,
        model,
        contentLength: Array.from(content).length,
        segmentCount: parsed.segments.length,
        validJson: parsed.validJson,
        status: response.status,
      });
      if (parsed.segments.length > 0) return parsed.segments;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      input.logger?.({
        attempt: index + 1,
        model,
        contentLength: 0,
        segmentCount: 0,
        validJson: false,
        status: 0,
      });
    }
  }
  if (!receivedSuccessfulResponse && lastError) throw lastError;
  return [];
}

export function videoTranscriptionRecoveryButtons(mediaId: string) {
  return {
    body: "Como você quer continuar?",
    buttons: [
      {
        id: `video_transcription:retry:${mediaId}`,
        title: "🔄 Tentar de novo",
      },
      {
        id: `video_transcription:write:${mediaId}`,
        title: "✍️ Vou escrever o tema",
      },
    ],
  };
}

export function parseVideoTranscriptionAction(
  text: string,
): VideoTranscriptionAction | null {
  const match = String(text || "").match(
    /<<INTERACTIVE_ID:video_transcription:(retry|write):([0-9a-f-]+)>>/i,
  );
  if (!match || !MEDIA_ID_RE.test(match[2])) return null;
  return {
    action: match[1].toLowerCase() as "retry" | "write",
    mediaId: match[2].toLowerCase(),
  };
}

export function selectCachedVideoTranscript(
  rows: Array<{
    video_path?: string | null;
    segmentos?: unknown;
    metadata?: { midia_id?: unknown } | null;
  }>,
  input: { videoPath: string; mediaId?: string },
): VideoTranscriptSegment[] | null {
  for (const row of rows) {
    const sameMedia = input.mediaId &&
      String(row.metadata?.midia_id || "").toLowerCase() ===
        input.mediaId.toLowerCase();
    const samePath = String(row.video_path || "") === input.videoPath;
    if (!sameMedia && !samePath) continue;
    const segments = normalizeVideoTranscriptSegments(row.segmentos);
    if (segments.length > 0) return segments;
  }
  return null;
}

export async function cachedOrTranscribedVideoSegments(input: {
  rows: Parameters<typeof selectCachedVideoTranscript>[0];
  videoPath: string;
  mediaId?: string;
  transcribe: () => Promise<VideoTranscriptSegment[]>;
}): Promise<{ segments: VideoTranscriptSegment[]; source: "cache" | "gateway" }> {
  const cached = selectCachedVideoTranscript(input.rows, {
    videoPath: input.videoPath,
    mediaId: input.mediaId,
  });
  if (cached) return { segments: cached, source: "cache" };
  return { segments: await input.transcribe(), source: "gateway" };
}
