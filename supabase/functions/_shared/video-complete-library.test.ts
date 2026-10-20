import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { persistMotionVideoToLibrary } from "./video-complete-library.ts";

Deno.test("produto: sync produto_videos falhando ainda retorna midiaId", async () => {
  const result = await persistMotionVideoToLibrary(
    {},
    { user_id: "u1", metadata: { library: "produto", tipo: "produto" } },
    "https://cdn.example/p.mp4",
    12,
    async () => "mid-abc",
    "video-motion-complete",
    {
      syncProdutoFromMidia: async () => {
        throw new Error("sync quebrado");
      },
    },
  );

  assertEquals(result.midiaId, "mid-abc");
  assertEquals(result.veiculoVideoId, null);
});
