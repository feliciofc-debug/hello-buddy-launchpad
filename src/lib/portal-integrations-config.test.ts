import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { PLANNED_PORTAL_INTEGRATIONS } from "./portal-integrations-config.ts";

Deno.test("G0: iCarros removido dos portais planejados", () => {
  assertEquals(
    PLANNED_PORTAL_INTEGRATIONS.some((p) => /icarros/i.test(p.id + p.name)),
    false,
  );
});
