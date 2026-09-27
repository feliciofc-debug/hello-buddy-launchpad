export type TikTokScheduledSource = "scheduled" | "autopilot";
export type TikTokDeliveryMode = "direct" | "draft";
export type TikTokScheduledState = "processing" | "published" | "draft" | "failed" | "retry";

export type TikTokScheduledInput = {
  userId: string;
  videoUrl: string;
  title: string;
  source: TikTokScheduledSource;
  privacyLevel?: string | null;
  consentedAt?: string | null;
  isCommercialContent?: boolean;
  brandOrganic?: boolean;
  brandedContent?: boolean;
  videoDurationSec?: number | null;
  publishId?: string | null;
  postRowId?: string | null;
  providerBranding?: unknown;
  recordTable: "social_posts_queue" | "videos_agendados";
  recordId: string;
};

export type TikTokScheduledResult = {
  state: TikTokScheduledState;
  mode: TikTokDeliveryMode;
  publishId?: string | null;
  postRowId?: string | null;
  publishStatus?: string | null;
  failReason?: string | null;
  message: string;
  retryAt?: string;
};

type TikTokDependencies = {
  supabase: any;
  supabaseUrl: string;
  serviceKey: string;
  fetcher?: typeof fetch;
  now?: Date;
};

export const TIKTOK_MAX_POSTS_PER_24H = 5;
const RETRY_DELAY_MS = 15 * 60 * 1000;
const DEFER_DELAY_MS = 60 * 60 * 1000;

export function resolveTikTokDeliveryMode(input: {
  source: TikTokScheduledSource;
  privacyLevel?: string | null;
  consentedAt?: string | null;
}): TikTokDeliveryMode {
  if (input.source === "autopilot") return "draft";
  return input.privacyLevel && input.consentedAt ? "direct" : "draft";
}

export function isRetryableTikTokCode(code: unknown): boolean {
  return String(code || "") === "rate_limit_exceeded";
}

export function isDeferredTikTokCode(code: unknown): boolean {
  return [
    "spam_risk_too_many_posts",
    "spam_risk_too_many_pending_share",
    "reached_active_user_cap",
  ].includes(String(code || ""));
}

export function containsForbiddenProviderBranding(value: unknown): boolean {
  if (!value) return false;
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return /\btech\s*provider\b|amzofertas\.com\.br|\bamz\s+ofertas\b/i.test(text);
}

export function validateTikTokDuration(
  durationSec: number | null | undefined,
  maxDurationSec: number | null | undefined,
): string | null {
  if (durationSec == null || maxDurationSec == null) return null;
  if (!Number.isFinite(durationSec) || durationSec <= 0) return "Não foi possível validar a duração do vídeo.";
  if (durationSec > maxDurationSec) {
    return `O vídeo tem ${Math.ceil(durationSec)}s, mas esta conta TikTok aceita no máximo ${maxDurationSec}s.`;
  }
  return null;
}

export function friendlyTikTokFailure(value: unknown): string {
  const raw = String(value || "").toLowerCase();
  if (raw.includes("duration") || raw.includes("duração") || raw.includes("too_long")) {
    return "o vídeo é mais longo do que esta conta permite";
  }
  if (raw.includes("privacy") || raw.includes("privacidade")) {
    return "a privacidade escolhida não está mais disponível";
  }
  if (raw.includes("token") || raw.includes("scope") || raw.includes("authoriz")) {
    return "a conexão com o TikTok precisa ser renovada";
  }
  if (raw.includes("spam") || raw.includes("too_many") || raw.includes("active_user_cap")) {
    return "o TikTok pediu para aguardar antes de um novo envio";
  }
  if (raw.includes("brand") || raw.includes("marca") || raw.includes("watermark")) {
    return "o vídeo contém uma marca do provedor que não pode ser enviada ao TikTok";
  }
  return "o TikTok não concluiu o envio";
}

async function invokeJson(
  deps: TikTokDependencies,
  functionName: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; data: any }> {
  const response = await (deps.fetcher ?? fetch)(`${deps.supabaseUrl}/functions/v1/${functionName}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${deps.serviceKey}`,
      apikey: deps.serviceKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
}

function retryResult(
  mode: TikTokDeliveryMode,
  now: Date,
  message: string,
  deferred = false,
): TikTokScheduledResult {
  return {
    state: "retry",
    mode,
    message,
    retryAt: new Date(now.getTime() + (deferred ? DEFER_DELAY_MS : RETRY_DELAY_MS)).toISOString(),
  };
}

export async function publishScheduledTikTok(
  deps: TikTokDependencies,
  input: TikTokScheduledInput,
): Promise<TikTokScheduledResult> {
  const now = deps.now ?? new Date();
  const mode = resolveTikTokDeliveryMode(input);

  let providerBranding = input.providerBranding;
  if (!providerBranding) {
    try {
      const parsed = new URL(input.videoUrl);
      const marker = "/storage/v1/object/public/";
      const stored = decodeURIComponent(parsed.pathname.split(marker)[1] || "");
      const resultPath = stored.split("/").slice(1).join("/");
      if (resultPath) {
        const { data: motionJob } = await deps.supabase
          .from("video_motion_jobs")
          .select("props")
          .eq("user_id", input.userId)
          .eq("resultado_path", resultPath)
          .maybeSingle();
        providerBranding = motionJob?.props;
      }
    } catch {
      // Vídeos externos ou antigos podem não ter origem rastreável; as demais
      // validações continuam e o TikTok ainda aplica as regras de conteúdo.
    }
  }
  if (containsForbiddenProviderBranding(providerBranding)) {
    return {
      state: "failed",
      mode,
      message: "O vídeo contém marca do provedor e não pode ser enviado ao TikTok.",
      failReason: "provider_branding_not_allowed",
    };
  }

  if (input.publishId) {
    const statusResponse = await invokeJson(deps, "tiktok-post-status", {
      user_id: input.userId,
      publish_id: input.publishId,
    });
    if (!statusResponse.ok || statusResponse.data?.success === false) {
      const code = statusResponse.data?.tiktok_error?.code;
      if (isRetryableTikTokCode(code) || isDeferredTikTokCode(code)) {
        return retryResult(mode, now, friendlyTikTokFailure(code), isDeferredTikTokCode(code));
      }
      return retryResult(mode, now, "O TikTok ainda não respondeu ao acompanhamento do envio.");
    }
    const status = String(statusResponse.data?.status || "PROCESSING_UPLOAD");
    if (status === "PUBLISH_COMPLETE") {
      return {
        state: "published",
        mode,
        publishId: input.publishId,
        postRowId: input.postRowId,
        publishStatus: status,
        message: "Publicado no TikTok.",
      };
    }
    if (status === "SEND_TO_USER_INBOX") {
      return {
        state: "draft",
        mode: "draft",
        publishId: input.publishId,
        postRowId: input.postRowId,
        publishStatus: status,
        message: "Enviado para os rascunhos do seu TikTok, é só abrir o app e publicar.",
      };
    }
    if (status === "FAILED") {
      const failReason = statusResponse.data?.fail_reason || "tiktok_publish_failed";
      return {
        state: "failed",
        mode,
        publishId: input.publishId,
        postRowId: input.postRowId,
        publishStatus: status,
        failReason,
        message: friendlyTikTokFailure(failReason),
      };
    }
    return {
      state: "processing",
      mode,
      publishId: input.publishId,
      postRowId: input.postRowId,
      publishStatus: status,
      message: "Enviado ao TikTok, está processando.",
    };
  }

  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const [{ count: recentCount }, { count: processingCount }] = await Promise.all([
    deps.supabase
      .from("tiktok_posts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", input.userId)
      .gte("created_at", since)
      .neq("status", "failed"),
    deps.supabase
      .from("tiktok_posts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", input.userId)
      .eq("status", "processing"),
  ]);
  if ((processingCount ?? 0) >= 1) {
    return retryResult(mode, now, "Já existe um vídeo deste cliente sendo processado pelo TikTok.");
  }
  if ((recentCount ?? 0) >= TIKTOK_MAX_POSTS_PER_24H) {
    return retryResult(mode, now, "O limite conservador de envios ao TikTok nas últimas 24 horas foi atingido.", true);
  }

  const creatorResponse = await invokeJson(deps, "tiktok-creator-info", { user_id: input.userId });
  if (!creatorResponse.ok || creatorResponse.data?.success !== true) {
    const code = creatorResponse.data?.tiktok_error?.code;
    if (isRetryableTikTokCode(code) || isDeferredTikTokCode(code)) {
      return retryResult(mode, now, friendlyTikTokFailure(code), isDeferredTikTokCode(code));
    }
    return {
      state: "failed",
      mode,
      failReason: creatorResponse.data?.error || "creator_info_failed",
      message: friendlyTikTokFailure(creatorResponse.data?.error),
    };
  }

  const durationError = validateTikTokDuration(
    input.videoDurationSec,
    creatorResponse.data?.max_video_post_duration_sec,
  );
  if (durationError) {
    return { state: "failed", mode, failReason: "video_duration_exceeded", message: durationError };
  }

  if (
    mode === "direct"
    && !creatorResponse.data.privacy_level_options?.includes(input.privacyLevel)
  ) {
    return {
      state: "failed",
      mode,
      failReason: "privacy_level_unavailable",
      message: "A privacidade escolhida não está mais disponível nesta conta TikTok.",
    };
  }

  const postResponse = await invokeJson(deps, "tiktok-post-content", {
    user_id: input.userId,
    content_type: "video",
    content_url: input.videoUrl,
    title: input.title,
    post_mode: mode,
    privacy_level: mode === "direct" ? input.privacyLevel : undefined,
    disable_comment: true,
    disable_duet: true,
    disable_stitch: true,
    is_commercial_content: !!input.isCommercialContent,
    brand_organic: !!input.brandOrganic,
    branded_content: !!input.brandedContent,
    source: input.source,
    consented_at: input.consentedAt,
    scheduled_record_table: input.recordTable,
    scheduled_record_id: input.recordId,
  });
  if (!postResponse.ok || postResponse.data?.success === false) {
    const code = postResponse.data?.tiktok_error?.code;
    if (isRetryableTikTokCode(code) || isDeferredTikTokCode(code)) {
      return retryResult(mode, now, friendlyTikTokFailure(code), isDeferredTikTokCode(code));
    }
    const failReason = postResponse.data?.error || "tiktok_upload_failed";
    return { state: "failed", mode, failReason, message: friendlyTikTokFailure(failReason) };
  }

  return {
    state: "processing",
    mode,
    publishId: postResponse.data?.publish_id ?? null,
    postRowId: postResponse.data?.post_row_id ?? null,
    publishStatus: "PROCESSING_UPLOAD",
    message: mode === "direct"
      ? "Enviado ao TikTok, está processando."
      : "Enviado ao TikTok; o rascunho está sendo preparado.",
  };
}
