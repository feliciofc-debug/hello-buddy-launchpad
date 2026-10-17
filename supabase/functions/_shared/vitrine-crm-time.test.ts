import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  shouldRunDailyResumoWindow,
  isRetomadaAllowedHour,
} from "./vitrine-crm-time.ts";

Deno.test("resumo: 19h–23h SP e uma vez por dia", () => {
  const evening = new Date("2026-10-16T22:30:00.000Z");
  assert(shouldRunDailyResumoWindow(evening, null));
  assertEquals(shouldRunDailyResumoWindow(evening, "2026-10-16"), false);
  const afternoon = new Date("2026-10-16T15:00:00.000Z");
  assertEquals(shouldRunDailyResumoWindow(afternoon, null), false);
});

Deno.test("retomada: horário comercial SP", () => {
  const noon = new Date("2026-10-16T15:00:00.000Z");
  assert(isRetomadaAllowedHour(noon));
});
