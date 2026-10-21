export type VideoPublishPlatform =
  | "facebook"
  | "instagram"
  | "linkedin"
  | "tiktok"
  | string;

export type PublishedPlatformRecord = {
  post_id?: string;
  post_url?: string;
  post_urn?: string;
};

/** true = conectado; false = consulta ok e desconectado; null = consulta falhou — tentar publicar como antes */
export type PlatformConnectionState = boolean | null;

export type ConnectedPublishPlatforms = {
  facebook: PlatformConnectionState;
  instagram: PlatformConnectionState;
  linkedin: PlatformConnectionState;
  tiktok: PlatformConnectionState;
};

const PLATFORM_LABELS: Record<string, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  story: "Story",
};

export function metaVideoPlatformLabel(platform: string): string {
  const key = String(platform || "").toLowerCase();
  return PLATFORM_LABELS[key] || key.charAt(0).toUpperCase() + key.slice(1);
}

export function uniqueVideoPublishPlatforms(
  platforms: unknown,
): VideoPublishPlatform[] {
  const seen = new Set<string>();
  const out: VideoPublishPlatform[] = [];
  for (const raw of Array.isArray(platforms) ? platforms : []) {
    const p = String(raw || "").trim().toLowerCase();
    if (!p || seen.has(p)) continue;
    seen.add(p);
    out.push(p);
  }
  return out;
}

export function readJobPublishedPosts(
  metadata: unknown,
): Record<string, PublishedPlatformRecord> {
  const root = metadata && typeof metadata === "object"
    ? metadata as Record<string, unknown>
    : {};
  const posts = root.publicados;
  if (!posts || typeof posts !== "object") return {};
  const out: Record<string, PublishedPlatformRecord> = {};
  for (const [platform, value] of Object.entries(posts)) {
    if (!value || typeof value !== "object") continue;
    const row = value as Record<string, unknown>;
    const postId = String(row.post_id || row.post_urn || "").trim();
    const postUrl = String(row.post_url || "").trim();
    if (postId || postUrl) {
      out[platform.toLowerCase()] = {
        post_id: postId || undefined,
        post_url: postUrl || undefined,
        post_urn: String(row.post_urn || "").trim() || undefined,
      };
    }
  }
  return out;
}

export function mergePublishedPosts(
  current: Record<string, PublishedPlatformRecord>,
  platform: string,
  patch: PublishedPlatformRecord,
): Record<string, PublishedPlatformRecord> {
  const key = platform.toLowerCase();
  return {
    ...current,
    [key]: { ...(current[key] ?? {}), ...patch },
  };
}

export function sanitizePublishApiDetail(error: unknown): {
  code?: string;
  message: string;
} {
  const raw = error instanceof Error ? error.message : String(error || "");
  const codeMatch = raw.match(/\b(?:code|error_code)[=:\s]+([A-Za-z0-9_/-]+)/i);
  const message = raw
    .replace(/\b(?:access[_\s-]?token|bearer)\s+[A-Za-z0-9._-]{20,}/gi, "[token]")
    .replace(/\b\d{10,}\b/g, "[id]")
    .slice(0, 500)
    .trim() || "erro_desconhecido";
  return {
    code: codeMatch?.[1],
    message,
  };
}

export function formatPublishErrorLogEntry(
  platform: string,
  friendly: string,
  detail: { code?: string; message: string },
): string {
  const label = metaVideoPlatformLabel(platform);
  const code = detail.code ? `[${detail.code}] ` : "";
  return `${label}: ${friendly} | api=${code}${detail.message}`;
}

type QueryChain = {
  eq: (col: string, val: unknown) => QueryChain;
  limit: (n: number) => Promise<{ data: unknown; error: unknown }>;
};

function connectionQuery(
  sb: {
    from: (table: string) => {
      select: (cols: string) => { eq: (col: string, val: unknown) => QueryChain };
    };
  },
  table: string,
  cols: string,
  filters: Array<[string, unknown]>,
): Promise<{ row: Record<string, unknown> | null; error: unknown }> {
  let query = sb.from(table).select(cols).eq(filters[0][0], filters[0][1]);
  for (let i = 1; i < filters.length; i++) {
    query = query.eq(filters[i][0], filters[i][1]);
  }
  return firstRow(query.limit(1));
}

async function firstRow(
  promise: Promise<{ data: unknown; error: unknown }>,
): Promise<{ row: Record<string, unknown> | null; error: unknown }> {
  try {
    const { data, error } = await promise;
    if (error) return { row: null, error };
    if (Array.isArray(data)) {
      return { row: (data[0] as Record<string, unknown>) ?? null, error: null };
    }
    return { row: (data as Record<string, unknown>) ?? null, error: null };
  } catch (error) {
    return { row: null, error };
  }
}

export async function loadConnectedPublishPlatforms(
  sb: {
    from: (table: string) => {
      select: (cols: string) => {
        eq: (col: string, val: unknown) => QueryChain;
      };
    };
  },
  userId: string,
): Promise<ConnectedPublishPlatforms> {
  const metaProbe = connectionQuery(sb, "meta_connections", "page_id, ig_account_id", [
    ["user_id", userId],
    ["is_active", true],
  ]);
  const linkedinProbe = connectionQuery(sb, "linkedin_connections", "id", [
    ["user_id", userId],
    ["is_active", true],
  ]);
  const tiktokProbe = connectionQuery(sb, "integrations", "id", [
    ["user_id", userId],
    ["platform", "tiktok"],
    ["is_active", true],
  ]);

  const [meta, linkedin, tiktok] = await Promise.all([
    metaProbe,
    linkedinProbe,
    tiktokProbe,
  ]);

  const metaRow = meta.error ? null : meta.row;
  return {
    facebook: meta.error
      ? null
      : metaRow
      ? !!String(metaRow.page_id || "").trim()
      : false,
    instagram: meta.error
      ? null
      : metaRow
      ? !!String(metaRow.ig_account_id || "").trim()
      : false,
    linkedin: linkedin.error
      ? null
      : linkedin.row
      ? !!String(linkedin.row.id || "").trim()
      : false,
    tiktok: tiktok.error
      ? null
      : tiktok.row
      ? !!String(tiktok.row.id || "").trim()
      : false,
  };
}

export function platformConnectionState(
  connected: ConnectedPublishPlatforms,
  platform: string,
): PlatformConnectionState {
  const p = platform.toLowerCase();
  if (p === "facebook") return connected.facebook;
  if (p === "instagram") return connected.instagram;
  if (p === "linkedin") return connected.linkedin;
  if (p === "tiktok") return connected.tiktok;
  return null;
}

/** false = bloquear; true/null = tentar publicar */
export function shouldAttemptPublish(
  connected: ConnectedPublishPlatforms,
  platform: string,
): boolean {
  return platformConnectionState(connected, platform) !== false;
}

export function notConnectedPublishMessage(platform: string): string {
  const label = metaVideoPlatformLabel(platform);
  return `${label}: não conectado — conecte em Configurações.`;
}

export function skipPublishMessage(platform: string, reason: string): string {
  const label = metaVideoPlatformLabel(platform);
  return `${label}: ${reason}`;
}

export function resolveVideoPublisher(
  platform: string,
  formato: "feed" | "story" | "reels",
): { kind: "meta-story" | "meta-post" | "meta-instagram" | "meta-reels" | "linkedin" | "tiktok" | "skip"; reason?: string } {
  const p = platform.toLowerCase();
  if (formato === "story") {
    if (p === "tiktok") {
      return { kind: "skip", reason: "não tem formato story — ignorado" };
    }
    return { kind: "meta-story" };
  }
  if (p === "facebook") {
    return formato === "feed"
      ? { kind: "meta-post" }
      : { kind: "meta-reels" };
  }
  if (p === "instagram") {
    return formato === "feed"
      ? { kind: "meta-instagram" }
      : { kind: "meta-reels" };
  }
  if (p === "linkedin") {
    return formato === "feed" || formato === "reels"
      ? { kind: "linkedin" }
      : { kind: "skip", reason: "não publica story de vídeo" };
  }
  if (p === "tiktok") {
    return formato === "reels" || formato === "feed"
      ? { kind: "tiktok" }
      : { kind: "skip", reason: "não tem formato story — ignorado" };
  }
  return { kind: "skip", reason: "rede desconhecida" };
}
