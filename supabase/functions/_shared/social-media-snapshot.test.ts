import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  exactSocialMedia,
  hasDuplicatedPrompt,
} from "./social-media-snapshot.ts";

Deno.test("aprovação usa somente a URL de foto gravada no token", () => {
  assertEquals(
    exactSocialMedia({
      midiaTipo: "foto",
      produto: {
        source: "ia_whatsapp",
        imagem_url: "https://cdn.example/garrafa.png",
        image_urls: ["https://cdn.example/citroen-1.png"],
      },
    }),
    {
      ok: true,
      urls: ["https://cdn.example/garrafa.png"],
      mediaType: "foto",
      flow: "ia_whatsapp",
    },
  );
});

Deno.test("token sem mídia é bloqueado sem fallback", () => {
  const result = exactSocialMedia({
    midiaTipo: "foto",
    produto: { source: "ia_whatsapp" },
  });
  assertEquals(result.ok, false);
  assertEquals(result.urls, []);
});

Deno.test("carrossel exige e preserva exatamente o álbum do token", () => {
  const urls = [
    "https://cdn.example/garrafa-1.png",
    "https://cdn.example/garrafa-2.png",
  ];
  assertEquals(
    exactSocialMedia({
      midiaTipo: "carrossel",
      produto: {
        source: "carrossel_whatsapp",
        imagem_url: "https://cdn.example/citroen-antigo.png",
        image_urls: urls,
      },
    }),
    {
      ok: true,
      urls,
      mediaType: "carrossel",
      flow: "carrossel_whatsapp",
    },
  );
  assertEquals(
    exactSocialMedia({
      midiaTipo: "carrossel",
      produto: { image_urls: [urls[0]] },
    }).ok,
    false,
  );
});

Deno.test("detecta corpo interativo que repete a pergunta", () => {
  assert(
    hasDuplicatedPrompt(
      "Em qual formato?",
      "Em qual formato?",
    ),
  );
  assertEquals(
    hasDuplicatedPrompt(
      "Escolha onde o criativo será usado.",
      "Selecione uma opção.",
    ),
    false,
  );
});
