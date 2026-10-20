import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  isVeiculoVideoJobMetadata,
  sanitizeVeiculoMetadataExtra,
  veiculoIdFromJobMetadata,
} from "./veiculo-video-job-metadata.ts";
import { syncVeiculoVideoFromUrl } from "./sync-veiculo-video.ts";

Deno.test("metadata veículo: sanitiza extras do cliente", () => {
  assertEquals(
    sanitizeVeiculoMetadataExtra({
      library: "veiculo",
      veiculo_id: "abc",
      hack: "drop-me",
      produto_id: "x",
    }),
    { library: "veiculo", tipo: "veiculo", veiculo_id: "abc" },
  );
  assertEquals(sanitizeVeiculoMetadataExtra({ library: "produto" }), null);
});

Deno.test("job veículo concluído: syncVeiculoVideoFromUrl não usa produto_videos", async () => {
  const inserts: { table: string; row: Record<string, unknown> }[] = [];
  const sb = {
    from(table: string) {
      return {
        select() {
          return {
            eq(_c: string, _v: string) {
              return {
                limit(_n: number) {
                  return {
                    maybeSingle: async () => ({ data: null, error: null }),
                  };
                },
              };
            },
          };
        },
        insert(row: Record<string, unknown>) {
          inserts.push({ table, row });
          return {
            select() {
              return {
                single: async () => ({ data: { id: "vv1" }, error: null }),
              };
            },
          };
        },
      };
    },
  };

  const meta = { library: "veiculo", tipo: "veiculo", veiculo_id: "v1" };
  assertEquals(isVeiculoVideoJobMetadata(meta), true);
  assertEquals(veiculoIdFromJobMetadata(meta), "v1");

  await syncVeiculoVideoFromUrl(sb, {
    userId: "u1",
    veiculoId: "v1",
    videoUrl: "https://cdn.example/v.mp4",
    titulo: "BMW",
  });

  assertEquals(inserts.length, 1);
  assertEquals(inserts[0].table, "veiculo_videos");
  assertEquals(inserts.some((i) => i.table === "produto_videos"), false);
  assertEquals(inserts.some((i) => i.table === "midias_whatsapp"), false);
});

Deno.test("job produto: metadata não é biblioteca veículo", () => {
  assertEquals(isVeiculoVideoJobMetadata({ library: "produto" }), false);
  assertEquals(isVeiculoVideoJobMetadata({ tipo: "produto" }), false);
});
