import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { isVitrineRetomadaOptOutText } from "./vitrine-crm-schedule.ts";

Deno.test("opt-out retomada: só mensagem inteira na lista fixa", () => {
  assert(isVitrineRetomadaOptOutText("parar"));
  assert(isVitrineRetomadaOptOutText("não quero mais"));
  assertEquals(isVitrineRetomadaOptOutText("não quero financiar"), false);
  assertEquals(isVitrineRetomadaOptOutText("cancelar"), false);
  assertEquals(isVitrineRetomadaOptOutText("quero financiar"), false);
});
