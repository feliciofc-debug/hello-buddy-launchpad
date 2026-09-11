import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { mensagemCotaMotion, STATUS_QUE_CONSOMEM_COTA } from "./video-motion-enfileirar.ts";

Deno.test("administrador ou conta ilimitada recebe aviso ilimitado", () => {
  assertEquals(mensagemCotaMotion({ limite: -1, origem: "administrador", usado: 30 }), "Vídeos ilimitados nesta conta.");
});

Deno.test("avisa o número do vídeo antes de acabar", () => {
  assertEquals(mensagemCotaMotion({ limite: 5, origem: "plano", usado: 3 }), "Este é seu 4º de 5 vídeos hoje. Restará 1.");
});

Deno.test("falhas e cancelamentos não consomem cota", () => {
  assertEquals(STATUS_QUE_CONSOMEM_COTA.includes("falha_definitiva"), false);
  assertEquals(STATUS_QUE_CONSOMEM_COTA.includes("cancelado"), false);
  assertEquals(STATUS_QUE_CONSOMEM_COTA.includes("concluido"), true);
});