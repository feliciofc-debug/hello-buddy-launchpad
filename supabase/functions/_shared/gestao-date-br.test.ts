import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { formatYmdSaoPaulo, hojeSaoPaulo, competenciaFromYmdSaoPaulo } from "./gestao-date-br.ts";

Deno.test("23:30 em São Paulo permanece no mesmo dia civil", () => {
  // 2026-03-15 23:30 America/Sao_Paulo ≈ 2026-03-16 02:30 UTC
  const instant = new Date("2026-03-16T02:30:00.000Z");
  assertEquals(formatYmdSaoPaulo(instant), "2026-03-15");
  assertEquals(instant.toISOString().slice(0, 10), "2026-03-16");
});

Deno.test("31/10 23:59 em São Paulo ainda é outubro", () => {
  // 2026-10-31 23:59 BRT (UTC-3) = 2026-11-01 02:59 UTC
  const instant = new Date("2026-11-01T02:59:00.000Z");
  assertEquals(formatYmdSaoPaulo(instant), "2026-10-31");
  assertEquals(competenciaFromYmdSaoPaulo(instant), "2026-10");
});

Deno.test("hojeSaoPaulo retorna YYYY-MM-DD", () => {
  const h = hojeSaoPaulo();
  assertEquals(/^\d{4}-\d{2}-\d{2}$/.test(h), true);
});
