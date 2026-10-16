import {
  assert,
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  sanitizeVehiclePostsResult,
  stripInventedUrlsFromVehicleCaption,
} from "./vehicle-post-caption.ts";

Deno.test("remove link inventado da legenda veículo", () => {
  const raw =
    "Presença imponente.\nhttps://seusite.com.br/defender\nAgende sua visita.";
  const out = stripInventedUrlsFromVehicleCaption(raw);
  assertEquals(out.includes("https://"), false);
  assertEquals(out.includes("seusite.com.br"), false);
  assertStringIncludes(out, "Presença imponente");
  assertStringIncludes(out, "Agende sua visita");
});

Deno.test("texto produto sem URL permanece igual", () => {
  const text = "Oferta especial na loja hoje.";
  assertEquals(stripInventedUrlsFromVehicleCaption(text), text);
});

Deno.test("sanitizeVehiclePostsResult limpa todas as opções", () => {
  const posts = {
    instagram: {
      opcaoA: "Veja www.exemplo.com.br",
      opcaoB: "Ok",
      opcaoC: "Ok",
    },
  };
  sanitizeVehiclePostsResult(posts);
  assertEquals(posts.instagram.opcaoA.includes("exemplo.com"), false);
});
