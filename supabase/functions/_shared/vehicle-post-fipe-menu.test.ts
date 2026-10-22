import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  parseVehiclePostFipeInteractiveId,
  shouldOfferVehiclePostFipeMenu,
  vehiclePostFipeMenuList,
  vehiclePostFipeMetaTriggerText,
} from "./vehicle-post-fipe-menu.ts";

Deno.test("menu pós-FIPE só aparece com identificação confirmada", () => {
  assertEquals(shouldOfferVehiclePostFipeMenu({}), false);
  assertEquals(
    shouldOfferVehiclePostFipeMenu({
      pending_vehicle_identification: { confirmed: true },
    }),
    true,
  );
});

Deno.test("FIX-VEIC-3-A — lista pós-FIPE só Meta e troca", () => {
  const list = vehiclePostFipeMenuList();
  assertEquals(list.rows.length, 2);
  assertEquals(
    list.rows.map((row) => row.title),
    [
      "Anúncio pago (Meta)",
      "Avaliar como troca",
    ],
  );
});

Deno.test("parser de botão vehicle_post_fipe", () => {
  assertEquals(
    parseVehiclePostFipeInteractiveId(
      "<<INTERACTIVE_ID:vehicle_post_fipe:meta>>",
    ),
    "meta",
  );
  assertEquals(
    vehiclePostFipeMetaTriggerText().includes("Meta Ads"),
    true,
  );
});
