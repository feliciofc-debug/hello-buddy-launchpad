import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

/** Espelha o early-return do handler quando a flag está off. */
function silvesterExtractSkippedResponse(
  flag: boolean | null | undefined,
): { status: number; body: Record<string, unknown> } | null {
  if (flag !== true) {
    return { status: 200, body: { ok: true, skipped: "flag_off" } };
  }
  return null;
}

Deno.test("silvester-extract-document — flag off não processa", () => {
  const res = silvesterExtractSkippedResponse(false);
  assertEquals(res?.status, 200);
  assertEquals(res?.body.skipped, "flag_off");
});

Deno.test("silvester-extract-document — flag on continua fluxo", () => {
  assertEquals(silvesterExtractSkippedResponse(true), null);
});
