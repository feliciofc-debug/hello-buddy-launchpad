import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  runWebmotorsVehicleSync,
  webmotorsPhotoOrderChanged,
} from "./webmotors-vehicle-sync-run.ts";
import { runWebmotorsVehicleUnpublish } from "./webmotors-vehicle-unpublish-run.ts";

function unmanagedSb() {
  return {
    from(table: string) {
      const chain = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => {
          if (table === "veiculos_estoque") {
            return { data: { id: "v1", segmento: "carro" } };
          }
          if (table === "veiculos_portais") {
            return {
              data: {
                external_id: "external-created-elsewhere",
                managed_by_platform: false,
              },
            };
          }
          return { data: null };
        },
      };
      return chain;
    },
  };
}

Deno.test("sync não altera anúncio que não foi criado pela plataforma", async () => {
  const result = await runWebmotorsVehicleSync(
    unmanagedSb() as any,
    { userId: "u1", veiculoId: "v1" },
  );
  assertEquals(result.ok, false);
  assertEquals(result.error?.includes("não foi criado pela plataforma"), true);
});

Deno.test("exclusão não remove anúncio que não foi criado pela plataforma", async () => {
  const result = await runWebmotorsVehicleUnpublish(
    unmanagedSb() as any,
    { userId: "u1", veiculoId: "v1" },
  );
  assertEquals(result.ok, false);
  assertEquals(result.error?.includes("não foi criado pela plataforma"), true);
});

Deno.test("mudança na ordem das fotos exige reconciliação", () => {
  const links = [
    { url_amz: "segunda.jpg", ordem: 1 },
    { url_amz: "primeira.jpg", ordem: 0 },
  ];
  assertEquals(
    webmotorsPhotoOrderChanged(["primeira.jpg", "segunda.jpg"], links),
    false,
  );
  assertEquals(
    webmotorsPhotoOrderChanged(["segunda.jpg", "primeira.jpg"], links),
    true,
  );
});
