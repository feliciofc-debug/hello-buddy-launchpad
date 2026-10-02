import {
  assertEquals,
  assertRejects,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  assertPublishConfirmed,
  buildSafePayloads,
  enforceMonthlyCap,
  publishMetaCampaign,
  validateDraft,
} from "./meta-ads-create.ts";
import { redactSecrets } from "./meta-ads-report.ts";

const draft = validateDraft({
  name: "Campanha segura",
  message: "Fale conosco",
  mediaUrl: "https://cdn.example.com/ad.jpg",
  mediaType: "image",
  dailyBudget: 10,
  maxSpend: 100,
  cityKeys: ["123"],
  interestIds: ["456"],
});
const ready = {
  accountStatus: 1,
  fundingSource: "funding",
  pageId: "page",
  instagramId: "ig",
  whatsappPhone: "5521999999999",
};

Deno.test("validates campaign input and rejects unsafe media", () => {
  assertEquals(draft.dailyBudget, 10);
  assertThrows(() =>
    validateDraft({ ...draft, mediaUrl: "http://unsafe.test/a.jpg" })
  );
  assertThrows(() => validateDraft({ ...draft, dailyBudget: 0 }));
  assertThrows(() => validateDraft({ ...draft, minAge: 17 }));
});

Deno.test("enforces default and explicit monthly caps", () => {
  enforceMonthlyCap(100, 100);
  assertThrows(() => enforceMonthlyCap(100, 100.01), Error, "R$ 200.00");
  assertThrows(() => enforceMonthlyCap(40, 11, 50));
});

Deno.test("builds fixed click-to-WhatsApp safe payload", () => {
  const payload = buildSafePayloads(draft, ready, "hash");
  assertEquals(payload.campaign.objective, "OUTCOME_ENGAGEMENT");
  assertEquals(payload.adset.optimization_goal, "CONVERSATIONS");
  assertEquals(payload.adset.destination_type, "WHATSAPP");
  assertEquals(payload.adset.targeting.publisher_platforms, [
    "facebook",
    "instagram",
  ]);
  assertEquals(
    payload.creative.degrees_of_freedom_spec.creative_features_spec
      .standard_enhancements.enroll_status,
    "OPT_OUT",
  );
  assertEquals(
    payload.creative.degrees_of_freedom_spec.creative_features_spec
      .multi_advertiser_ads.enroll_status,
    "OPT_OUT",
  );
});

Deno.test("creates paused entities then activates child-to-parent", async () => {
  const calls: Array<{ path: string; method: string; status?: string }> = [];
  const request = async (
    path: string,
    _token: string,
    init: RequestInit = {},
  ) => {
    const status = init.body instanceof URLSearchParams
      ? init.body.get("status") ?? undefined
      : undefined;
    calls.push({ path, method: init.method || "GET", status });
    if (path.endsWith("/adimages")) {
      return { images: { file: { hash: "image-hash" } } };
    }
    if (path.endsWith("/campaigns")) return { id: "campaign" };
    if (path.endsWith("/adsets")) return { id: "adset" };
    if (path.endsWith("/adcreatives")) return { id: "creative" };
    if (path.endsWith("/ads")) return { id: "ad" };
    return { success: true };
  };
  const fetcher = () =>
    Promise.resolve(new Response(new Uint8Array([1]), { status: 200 }));
  const ids = await publishMetaCampaign("act_1", "secret", draft, ready, {
    request: request as any,
    fetcher: fetcher as any,
  });
  assertEquals(ids, {
    campaign_id: "campaign",
    adset_id: "adset",
    creative_id: "creative",
    ad_id: "ad",
  });
  assertEquals(
    calls.filter((call) => call.status === "ACTIVE").map((call) => call.path),
    ["ad", "adset", "campaign"],
  );
});

Deno.test("rolls Graph entities back in reverse order after failure", async () => {
  const deleted: string[] = [];
  const request = async (
    path: string,
    _token: string,
    init: RequestInit = {},
  ) => {
    if (init.method === "DELETE") {
      deleted.push(path);
      return { success: true };
    }
    if (path.endsWith("/adimages")) {
      return { images: { file: { hash: "hash" } } };
    }
    if (path.endsWith("/campaigns")) return { id: "campaign" };
    if (path.endsWith("/adsets")) return { id: "adset" };
    if (path.endsWith("/adcreatives")) throw new Error("creative failed");
    return {};
  };
  await assertRejects(() =>
    publishMetaCampaign("act_1", "secret", draft, ready, {
      request: request as any,
      fetcher: (() => Promise.resolve(new Response("x"))) as any,
    })
  );
  assertEquals(deleted, ["adset", "campaign"]);
});

Deno.test("redacts tokens and requires literal confirmation", () => {
  const sanitized = redactSecrets(
    "access_token=abc123 Authorization: Bearer top-secret",
  );
  assertEquals(sanitized.includes("abc123"), false);
  assertEquals(sanitized.includes("top-secret"), false);
  assertPublishConfirmed(true);
  for (const value of [false, "true", 1, null, undefined]) {
    assertThrows(() => assertPublishConfirmed(value));
  }
});
