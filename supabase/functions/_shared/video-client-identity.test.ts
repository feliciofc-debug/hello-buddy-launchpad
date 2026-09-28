import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  canRunClientLogoRegistrationShortcut,
  extractVideoClientName,
  resolveAutomaticVideoSiteIdentity,
} from "./video-client-identity.ts";

Deno.test("vídeo do cliente usa nome pedido, logo confiável e cores automaticamente", () => {
  assertEquals(
    extractVideoClientName(
      "Faça um vídeo institucional da Ademicon usando https://ademicon.com.br",
    ),
    "Ademicon",
  );
  assertEquals(
    resolveAutomaticVideoSiteIdentity({
      requestedClientName: "Ademicon",
      siteBrandName: "Ademicon Consórcio",
      siteUrl: "https://ademicon.com.br",
      colors: ["#ee3124", "#ffffff", "#ee3124"],
      logoConfidence: "high",
      logoDataUrl: "data:image/png;base64,bG9nbw==",
    }),
    {
      clientName: "Ademicon",
      colors: ["#ee3124", "#ffffff"],
      useSiteLogo: true,
      summary: "Ademicon — logo do site + cores #ee3124 · #ffffff",
    },
  );
});

Deno.test("site sem logo confiável segue somente com cores e nome do site", () => {
  assertEquals(
    resolveAutomaticVideoSiteIdentity({
      siteBrandName: "Marca do Site",
      siteUrl: "https://marca.example",
      colors: ["#123456", "#abcdef"],
      logoConfidence: "none",
      logoDataUrl: null,
    }),
    {
      clientName: "Marca do Site",
      colors: ["#123456", "#abcdef"],
      useSiteLogo: false,
      summary: "Marca do Site — cores #123456 · #abcdef",
    },
  );
});

Deno.test("atalho de cadastro não captura fluxo de vídeo nem respostas interativas", () => {
  assertEquals(
    canRunClientLogoRegistrationShortcut({
      text: "Usar esta logo",
      hasPendingVideoSetup: true,
    }),
    false,
  );
  for (const id of [
    "video_site_logo_use",
    "brand_image_logo",
    "social_publish:12345678",
  ]) {
    assertEquals(
      canRunClientLogoRegistrationShortcut({
        text: `Usar esta logo\n<<INTERACTIVE_ID:${id}>>`,
        hasPendingVideoSetup: false,
      }),
      false,
    );
  }
  assertEquals(
    canRunClientLogoRegistrationShortcut({
      text: "Salve essa logo como logo da Ademicon",
      hasPendingVideoSetup: false,
    }),
    true,
  );
});
