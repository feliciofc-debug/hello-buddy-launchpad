import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  isOlxOAuthStateExpired,
  maskOlxEmail,
  validateOlxOAuthStateRow,
} from "./olx-oauth-state.ts";

Deno.test("OLX state expira após expires_at", () => {
  const now = Date.parse("2026-10-19T12:00:00.000Z");
  assert(!isOlxOAuthStateExpired("2026-10-19T12:05:00.000Z", now));
  assert(isOlxOAuthStateExpired("2026-10-19T11:59:59.000Z", now));
});

Deno.test("OLX state inválido/expirado/reusado", () => {
  const now = Date.parse("2026-10-19T12:00:00.000Z");
  assertEquals(validateOlxOAuthStateRow(null, now), { ok: false, reason: "invalid" });
  assertEquals(
    validateOlxOAuthStateRow({
      user_id: "u",
      expires_at: "2026-10-19T13:00:00.000Z",
      used_at: "2026-10-19T11:00:00.000Z",
    }, now),
    { ok: false, reason: "reused" },
  );
  assertEquals(
    validateOlxOAuthStateRow({
      user_id: "u",
      expires_at: "2026-10-19T11:00:00.000Z",
      used_at: null,
    }, now),
    { ok: false, reason: "expired" },
  );
  assertEquals(
    validateOlxOAuthStateRow({
      user_id: "u",
      expires_at: "2026-10-19T13:00:00.000Z",
      used_at: null,
    }, now),
    { ok: true },
  );
});

Deno.test("maskOlxEmail mascara e-mail", () => {
  assertEquals(maskOlxEmail("jose.silva@sample.com"), "j***@sample.com");
});
