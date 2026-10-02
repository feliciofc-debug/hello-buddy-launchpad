import {
  assertEquals,
  assertFalse,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  isExactMetaAdsApproval,
  META_ADS_APPROVAL_TTL_MS,
  metaAdsApprovalContext,
  metaAdsDraftMatchesApproval,
} from "./meta-ads-whatsapp-approval.ts";

Deno.test("accepts only literal SIM from the owner", () => {
  assertEquals(isExactMetaAdsApproval("SIM", true), true);
  for (const value of ["sim", " SIM", "SIM ", "sim!", "OK"]) {
    assertFalse(isExactMetaAdsApproval(value, true));
  }
  assertFalse(isExactMetaAdsApproval("SIM", false));
});

Deno.test("ties approval to phone, conversation and a 24-hour draft", () => {
  const now = Date.parse("2026-10-02T18:00:00.000Z");
  const expected = metaAdsApprovalContext("+55 (11) 99999-0000", "conv-1");
  const row = {
    created_at: new Date(now - META_ADS_APPROVAL_TTL_MS + 1).toISOString(),
    draft_json: { _whatsapp_approval: expected },
  };
  assertEquals(metaAdsDraftMatchesApproval(row, expected, now), true);
  assertFalse(metaAdsDraftMatchesApproval({
    ...row,
    created_at: new Date(now - META_ADS_APPROVAL_TTL_MS - 1).toISOString(),
  }, expected, now));
  assertFalse(metaAdsDraftMatchesApproval(row, {
    ...expected,
    conversation_id: "conv-2",
  }, now));
  assertFalse(metaAdsDraftMatchesApproval(row, {
    ...expected,
    owner_phone: "5511888880000",
  }, now));
});
