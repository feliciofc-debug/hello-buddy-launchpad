import { assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { isVitrineRetomadaOptOutText } from "./vitrine-crm-schedule.ts";

Deno.test("opt-out retomada reconhece parar e não quero", () => {
  assert(isVitrineRetomadaOptOutText("parar"));
  assert(isVitrineRetomadaOptOutText("não quero"));
  assert(!isVitrineRetomadaOptOutText("quero financiar"));
});
