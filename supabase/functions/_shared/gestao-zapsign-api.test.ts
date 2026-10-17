import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { mapZapsignWebhookStatus, zapsignApiBase } from "./gestao-zapsign-api.ts";

Deno.test("base URL sandbox vs produção", () => {
  assertEquals(zapsignApiBase("sandbox").includes("sandbox"), true);
  assertEquals(zapsignApiBase("producao").includes("sandbox"), false);
});

Deno.test("map webhook status", () => {
  assertEquals(mapZapsignWebhookStatus("signed"), "assinado");
  assertEquals(mapZapsignWebhookStatus("cancelled"), "cancelado");
});
