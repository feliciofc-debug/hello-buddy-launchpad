// @ts-nocheck
import { assert, assertFalse } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { shouldShowGestaoLucroMenu } from "./gestao-lucro-menu.ts";
import { PREMIUM_VEHICLE_RETAIL_SEGMENT } from "../../supabase/functions/_shared/company-service-profile.ts";

Deno.test("Gestão Lucro no menu: revenda de veículos", () => {
  assert(shouldShowGestaoLucroMenu("revenda_veiculos", null, null, false));
});

Deno.test("Gestão Lucro no menu: vitrine demo (expo produtos)", () => {
  assert(
    shouldShowGestaoLucroMenu("empresa", "padaria", "doces", true),
  );
});

Deno.test("Gestão Lucro oculto: produtos sem demo", () => {
  assertFalse(
    shouldShowGestaoLucroMenu("empresa", "padaria", "doces", false),
  );
});

Deno.test("Gestão Lucro no menu: segmento premium revenda", () => {
  assert(
    shouldShowGestaoLucroMenu(
      "empresa",
      PREMIUM_VEHICLE_RETAIL_SEGMENT,
      "",
      false,
    ),
  );
});
