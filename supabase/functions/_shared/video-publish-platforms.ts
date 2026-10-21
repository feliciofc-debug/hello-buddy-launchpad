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

export type ConnectedPublishPlatforms = {
  facebook: boolean;
  instagram: boolean;
  linkedin: boolean;
  tiktok: boolean;
};

export async function loadConnectedPublishPlatforms(
  sb: {
    from: (table: string) => {
      select: (cols: string) => {
        eq: (col: string, val: unknown) => {
          eq?: (col: string, val: unknown) => {
            maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
          };
          maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
        };
      };
    };
  },
  userId: string,
): Promise<ConnectedPublishPlatforms> {
  const [
    { data: meta, error: metaError },
    { data: linkedin, error: linkedinError },
    { data: tiktok, error: tiktokError },
  ] = await Promise.all([
    sb.from("meta_connections")
      .select("page_id, ig_account_id")
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle(),
    sb.from("linkedin_connections")
      .select("id")
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle(),
    sb.from("integrations")
      .select("id")
      .eq("user_id", userId)
      .eq("platform", "tiktok")
      .eq("is_active", true)
      .maybeSingle(),
  ]);
  if (metaError || linkedinError || tiktokError) {
    throw new Error("nao_consegui_consultar_redes_conectadas");
  }
  const metaRow = meta as { page_id?: string; ig_account_id?: string } | null;
  return {
    facebook: !!metaRow?.page_id,
    instagram: !!metaRow?.ig_account_id,
    linkedin: !!(linkedin as { id?: string } | null)?.id,
    tiktok: !!(tiktok as { id?: string } | null)?.id,
  };
}

export function notConnectedPublishMessage(platform: string): string {
  const label = metaVideoPlatformLabel(platform);
  return `${label} não conectado — conecte em Configurações.`;
}

export function resolveVideoPublisher(
  platform: string,
  formato: "feed" | "story" | "reels",
): { kind: "meta-story" | "meta-post" | "meta-instagram" | "meta-reels" | "linkedin" | "tiktok" | "skip"; reason?: string } {
  const p = platform.toLowerCase();
  if (formato === "story") {
    if (p === "tiktok") {
      return { kind: "skip", reason: "TikTok não tem formato story — ignorado" };
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
      ? { kind: "meta-reels" }
      : { kind: "meta-reels" };
  }
  if (p === "linkedin") {
    return formato === "feed" || formato === "reels"
      ? { kind: "linkedin" }
      : { kind: "skip", reason: "LinkedIn não publica story de vídeo" };
  }
  if (p === "tiktok") {
    return formato === "reels" || formato === "feed"
      ? { kind: "tiktok" }
      : { kind: "skip", reason: "TikTok não tem formato story — ignorado" };
  }
  return { kind: "skip", reason: "rede desconhecida" };
}
