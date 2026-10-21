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

Deno.test("lista pós-FIPE traz cinco ações pedidas", () => {
  const list = vehiclePostFipeMenuList();
  assertEquals(list.rows.length, 5);
  assertEquals(
    list.rows.map((row) => row.title),
    [
      "Arte de anúncio",
      "Anúncio pago (Meta)",
      "Vídeo",
      "Cadastrar no estoque",
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
