import {
  assertEquals,
  assert,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  containsForbiddenProviderBranding,
  isDeferredTikTokCode,
  isRetryableTikTokCode,
  publishScheduledTikTok,
  resolveTikTokInteractionSettings,
  resolveTikTokDeliveryMode,
  tiktokWaitExpired,
  validateTikTokDuration,
} from "./tiktok-scheduled-publish.ts";
import { AMZ_TENANT_ID } from "./amz-tenant.ts";

Deno.test("agendamento com privacidade e consentimento usa Direct Post", () => {
  assertEquals(resolveTikTokDeliveryMode({
    source: "scheduled",
    privacyLevel: "PUBLIC_TO_EVERYONE",
    consentedAt: "2026-09-26T12:00:00.000Z",
  }), "direct");
});

Deno.test("agendamento sem consentimento ou privacidade usa rascunho", () => {
  assertEquals(resolveTikTokDeliveryMode({
    source: "scheduled",
    privacyLevel: "PUBLIC_TO_EVERYONE",
  }), "draft");
  assertEquals(resolveTikTokDeliveryMode({
    source: "scheduled",
    consentedAt: "2026-09-26T12:00:00.000Z",
  }), "draft");
});

Deno.test("piloto automático sempre usa rascunho mesmo com consentimento", () => {
  assertEquals(resolveTikTokDeliveryMode({
    source: "autopilot",
    privacyLevel: "PUBLIC_TO_EVERYONE",
    consentedAt: "2026-09-26T12:00:00.000Z",
  }), "draft");
});

Deno.test("duração é comparada com creator_info", () => {
  assertEquals(validateTikTokDuration(59, 60), null);
  assert(validateTikTokDuration(61, 60)?.includes("60s"));
});

Deno.test("bloqueia marca inserida pelo provedor, não a marca genérica do cliente", () => {
  const otherTenant = "11111111-1111-4111-8111-111111111111";
  assert(containsForbiddenProviderBranding("AMZ Ofertas - Tech Provider verificado", otherTenant));
  assert(containsForbiddenProviderBranding({ watermark: "amzofertas.com.br" }, otherTenant));
  assertEquals(containsForbiddenProviderBranding("Logo do próprio cliente"), false);
});

Deno.test("tenant AMZ pode usar a própria marca", () => {
  assertEquals(
    containsForbiddenProviderBranding("AMZ Ofertas - Tech Provider verificado", AMZ_TENANT_ID),
    false,
  );
});

Deno.test("classifica rate limit para retry e riscos para adiamento", () => {
  assert(isRetryableTikTokCode("rate_limit_exceeded"));
  assert(isDeferredTikTokCode("spam_risk_too_many_posts"));
  assert(isDeferredTikTokCode("reached_active_user_cap"));
  assertEquals(isRetryableTikTokCode("invalid_param"), false);
});

Deno.test("retry expira em 24h e processamento em 2h", () => {
  const now = new Date("2026-09-27T12:00:00.000Z");
  assertEquals(tiktokWaitExpired("retry", "2026-09-26T12:01:00.000Z", now), false);
  assertEquals(tiktokWaitExpired("retry", "2026-09-26T12:00:00.000Z", now), true);
  assertEquals(tiktokWaitExpired("processing", "2026-09-27T10:01:00.000Z", now), false);
  assertEquals(tiktokWaitExpired("processing", "2026-09-27T10:00:00.000Z", now), true);
});

Deno.test("interações ficam desligadas por padrão e respeitam escolha do site", () => {
  assertEquals(resolveTikTokInteractionSettings({}), {
    disable_comment: true,
    disable_duet: true,
    disable_stitch: true,
  });
  assertEquals(resolveTikTokInteractionSettings({
    disableComment: false,
    disableDuet: false,
    disableStitch: true,
  }), {
    disable_comment: false,
    disable_duet: false,
    disable_stitch: true,
  });
});

Deno.test("indisponibilidade transitória no refresh agenda retry", async () => {
  const countQuery = {
    select() { return this; },
    eq() { return this; },
    gte() { return this; },
    neq() { return this; },
    then(resolve: (value: unknown) => unknown) {
      return Promise.resolve({ count: 0 }).then(resolve);
    },
  };
  const result = await publishScheduledTikTok({
    supabase: { from: () => ({ ...countQuery }) },
    supabaseUrl: "https://example.supabase.co",
    serviceKey: "service-key",
    now: new Date("2026-09-27T12:00:00.000Z"),
    fetcher: (() => Promise.resolve(new Response(JSON.stringify({
      success: false,
      error: "tiktok_temporarily_unavailable",
    }), { status: 400 }))) as typeof fetch,
  }, {
    userId: "user-1",
    videoUrl: "https://cdn.example.com/video.mp4",
    title: "Teste",
    source: "scheduled",
    privacyLevel: "PUBLIC_TO_EVERYONE",
    consentedAt: "2026-09-27T11:00:00.000Z",
    providerBranding: "marca do cliente",
    scheduledAt: "2026-09-27T11:55:00.000Z",
    recordTable: "social_posts_queue",
    recordId: "queue-1",
  });
  assertEquals(result.state, "retry");
  assertEquals(result.retryAt, "2026-09-27T12:15:00.000Z");
});
