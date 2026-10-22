import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  parseVehiclePostFipeInteractiveId,
  shouldOfferVehiclePostFipeMenu,
  vehiclePostFipeMenuList,
  vehiclePostFipeMetaTriggerText,
} from "./vehicle-post-fipe-menu.ts";

Deno.test("FIX-VEIC-3-B5 — menu pós-FIPE com identificação confirmada ou alta", () => {
  assertEquals(shouldOfferVehiclePostFipeMenu({}), false);
  assertEquals(
    shouldOfferVehiclePostFipeMenu({
      pending_vehicle_identification: { confirmed: true },
    }),
    true,
  );
});

Deno.test("FIX-VEIC-3-B9 — lista pós-FIPE completa filtrada", () => {
  const list = vehiclePostFipeMenuList();
  assertEquals(list.rows.length, 6);
  assertEquals(
    list.rows.map((row) => row.id.replace("vehicle_post_fipe:", "")),
    ["ad", "post", "meta", "troca", "correct", "edit"],
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
