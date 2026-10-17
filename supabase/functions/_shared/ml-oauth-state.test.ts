import { assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { isMlOAuthStateExpired } from "./ml-oauth-state.ts";

Deno.test("state OAuth expira após 10 minutos", () => {
  const now = Date.parse("2026-10-17T12:00:00.000Z");
  assert(!isMlOAuthStateExpired("2026-10-17T11:51:00.000Z", now));
  assert(isMlOAuthStateExpired("2026-10-17T11:49:59.000Z", now));
});
