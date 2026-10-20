// @ts-nocheck
import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  PRODUTO_REELS_GRID_SELECT,
  videoLibraryTable,
  videoSourceForModal,
} from "./video-library-source.ts";

Deno.test("caminho produto usa produto_videos e join produtos", () => {
  assertEquals(videoLibraryTable("produto"), "produto_videos");
  assertStringIncludes(PRODUTO_REELS_GRID_SELECT, "produtos(");
  assertEquals(videoSourceForModal("produto"), "produto_videos");
});

Deno.test("caminho veículo usa veiculo_videos — grade tradicional não consulta", () => {
  assertEquals(videoLibraryTable("veiculo"), "veiculo_videos");
  assertEquals(videoSourceForModal("veiculo"), "veiculo_videos");
  assertEquals(PRODUTO_REELS_GRID_SELECT.includes("veiculo"), false);
});
