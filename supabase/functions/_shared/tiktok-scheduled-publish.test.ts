import {
  assertEquals,
  assert,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  containsForbiddenProviderBranding,
  isDeferredTikTokCode,
  isRetryableTikTokCode,
  resolveTikTokDeliveryMode,
  validateTikTokDuration,
} from "./tiktok-scheduled-publish.ts";

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
  assert(containsForbiddenProviderBranding("AMZ Ofertas - Tech Provider verificado"));
  assert(containsForbiddenProviderBranding({ watermark: "amzofertas.com.br" }));
  assertEquals(containsForbiddenProviderBranding("Logo do próprio cliente"), false);
});

Deno.test("classifica rate limit para retry e riscos para adiamento", () => {
  assert(isRetryableTikTokCode("rate_limit_exceeded"));
  assert(isDeferredTikTokCode("spam_risk_too_many_posts"));
  assert(isDeferredTikTokCode("reached_active_user_cap"));
  assertEquals(isRetryableTikTokCode("invalid_param"), false);
});
