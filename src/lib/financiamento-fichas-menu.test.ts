// @ts-nocheck
import { assert, assertEquals, assertFalse } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  formatFinanciamentoPendingBadge,
  shouldShowFinanciamentosMenu,
} from "./financiamento-fichas-menu.ts";
import { PREMIUM_VEHICLE_RETAIL_SEGMENT } from "../../supabase/functions/_shared/company-service-profile.ts";

Deno.test("badge oculto sem pendentes; 9+ acima de 9", () => {
  assertEquals(formatFinanciamentoPendingBadge(0), null);
  assertEquals(formatFinanciamentoPendingBadge(3), "3");
  assertEquals(formatFinanciamentoPendingBadge(9), "9");
  assertEquals(formatFinanciamentoPendingBadge(10), "9+");
  assertEquals(formatFinanciamentoPendingBadge(99), "9+");
});

Deno.test("Financiamentos no menu: revenda de veículos", () => {
  assert(
    shouldShowFinanciamentosMenu(
      "revenda_veiculos",
      null,
      null,
      false,
    ),
  );
});

Deno.test("Financiamentos no menu: segmento premium revenda", () => {
  assert(
    shouldShowFinanciamentosMenu(
      "empresa",
      PREMIUM_VEHICLE_RETAIL_SEGMENT,
      "",
      false,
    ),
  );
});

Deno.test("Financiamentos no menu: vitrine demo em conta produtos", () => {
  assert(
    shouldShowFinanciamentosMenu(
      "empresa",
      "padaria",
      "doces",
      true,
    ),
  );
});

Deno.test("Financiamentos oculto: produtos sem demo", () => {
  assertFalse(
    shouldShowFinanciamentosMenu(
      "empresa",
      "padaria",
      "doces",
      false,
    ),
  );
});
