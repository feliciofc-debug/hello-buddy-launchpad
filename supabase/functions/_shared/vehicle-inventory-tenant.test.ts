import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  PREMIUM_VEHICLE_RETAIL_SEGMENT,
} from "./company-service-profile.ts";
import { usesVehicleInventoryMenu } from "./vehicle-inventory-tenant.ts";

Deno.test("usesVehicleInventoryMenu — revenda premium e legado", () => {
  assertEquals(
    usesVehicleInventoryMenu("revenda_veiculos", null, ""),
    true,
  );
  assertEquals(
    usesVehicleInventoryMenu("empresa", PREMIUM_VEHICLE_RETAIL_SEGMENT, ""),
    true,
  );
});

Deno.test("usesVehicleInventoryMenu — conta produto comum", () => {
  assertEquals(
    usesVehicleInventoryMenu("empresa", "restaurante", "Padaria artesanal"),
    false,
  );
  assertEquals(
    usesVehicleInventoryMenu(
      "empresa",
      "automotivo",
      "Loja de peças e oficina.",
    ),
    false,
  );
});
