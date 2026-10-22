import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  parseVehicleBrandPosition,
  vehicleBrandPositionList,
} from "./vehicle-brand-actions.ts";

const MEDIA_ID = "12345678-1234-4123-8123-123456789abc";

Deno.test("FIX-VEIC-3.3 — marca oferece as três posições pedidas", () => {
  const list = vehicleBrandPositionList(MEDIA_ID);
  assertEquals(list.rows.map((row) => row.title), [
    "Canto inferior direito",
    "Canto superior esquerdo",
    "Centro embaixo",
  ]);
  assertEquals(
    parseVehicleBrandPosition(
      `<<INTERACTIVE_ID:${list.rows[2].id}>>`,
    ),
    { mediaId: MEDIA_ID, position: "bottom-center" },
  );
});
