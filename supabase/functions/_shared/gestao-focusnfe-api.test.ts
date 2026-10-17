import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  focusNfeApiBase,
  focusNfeAbsoluteUrl,
  mapFocusStatusToGestao,
} from "./gestao-focusnfe-api.ts";

Deno.test("focusNfeApiBase homolog vs prod", () => {
  assertEquals(focusNfeApiBase("homolog").includes("homologacao"), true);
  assertEquals(focusNfeApiBase("producao").includes("api.focusnfe"), true);
});

Deno.test("focusNfeAbsoluteUrl resolve path", () => {
  const url = focusNfeAbsoluteUrl("homolog", "/arquivos/x.xml");
  assertEquals(url?.endsWith("/arquivos/x.xml"), true);
});

Deno.test("mapFocusStatusToGestao", () => {
  assertEquals(mapFocusStatusToGestao("autorizado"), "autorizada");
  assertEquals(mapFocusStatusToGestao("cancelado"), "cancelada");
});
