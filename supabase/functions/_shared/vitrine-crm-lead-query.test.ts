import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildLeadMornoOwnerMessage,
  formatVehicleListPt,
  pickWarmLeadVehicleIds,
} from "./vitrine-crm-lead-query.ts";

Deno.test("pickWarmLeadVehicleIds exclui após conversão", () => {
  const ids = pickWarmLeadVehicleIds([
    { veiculo_id: "v1", evento: "detalhe", created_at: "2026-10-16T10:00:00Z" },
    { veiculo_id: "v1", evento: "interesse", created_at: "2026-10-16T10:05:00Z" },
    { veiculo_id: "v2", evento: "fotos", created_at: "2026-10-16T10:00:00Z" },
  ]);
  assertEquals(ids, ["v2"]);
});

Deno.test("formatVehicleListPt até 3 veículos", () => {
  assertEquals(formatVehicleListPt(["BMW X6", "Defender"]), "o BMW X6 e o Defender");
});

Deno.test("buildLeadMornoOwnerMessage consolidado", () => {
  const msg = buildLeadMornoOwnerMessage({
    contactName: "João",
    vehicleTitles: ["BMW X6", "Defender"],
  });
  assertEquals(
    msg.includes("João olhou o BMW X6 e o Defender"),
    true,
  );
});
