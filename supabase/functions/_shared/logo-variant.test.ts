import {
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  detectLogoVariantRequest,
  logoBackgroundFromLuminance,
  logoVariantForBackground,
  pickLogoVariant,
} from "./logo-variant.ts";
import {
  clientLogoPath,
  extractClientNameFromLogoRequest,
} from "./client-brand-identity.ts";

Deno.test("anúncio e vídeo escolhem a logo correspondente ao fundo", () => {
  const logos = {
    default: "padrao",
    light_background: "texto-escuro",
    dark_background: "texto-claro",
  };
  assertEquals(pickLogoVariant(logos, "light"), "texto-escuro");
  assertEquals(pickLogoVariant(logos, "dark"), "texto-claro");
  assertEquals(logoVariantForBackground("light"), "light_background");
  assertEquals(logoVariantForBackground("dark"), "dark_background");
});

Deno.test("arte escolhe variante pela luminância da região da logo", () => {
  assertEquals(logoBackgroundFromLuminance(0.82), "light");
  assertEquals(logoBackgroundFromLuminance(0.18), "dark");
  assertEquals(logoBackgroundFromLuminance(0.54), "dark");
  assertEquals(logoBackgroundFromLuminance(0.55), "light");
});

Deno.test("vídeo do cliente prefere variante própria e cai na principal", () => {
  const identity = {
    user_id: "tenant",
    client_name: "Loja",
    normalized_name: "loja",
    logo_path: "default.png",
    identity: { logo_video_path: "video.png" },
  };
  assertEquals(clientLogoPath(identity, "video"), "video.png");
  assertEquals(
    clientLogoPath({ ...identity, identity: {} }, "video"),
    "default.png",
  );
});

Deno.test("sem variantes mantém a logo atual", () => {
  assertEquals(pickLogoVariant({ default: "atual" }, "light"), "atual");
  assertEquals(pickLogoVariant({ default: "atual" }, "dark"), "atual");
});

Deno.test("cadastro pelo WhatsApp reconhece as duas versões", () => {
  assertEquals(
    detectLogoVariantRequest("essa é minha logo para fundo claro"),
    "light_background",
  );
  assertEquals(
    detectLogoVariantRequest("logo para fundo escuro do cliente Loja X"),
    "dark_background",
  );
  assertEquals(
    extractClientNameFromLogoRequest(
      "essa é a logo para fundo escuro do cliente Loja X",
    ),
    "Loja X",
  );
});

Deno.test("cliente usa variante e cai na logo atual quando ausente", () => {
  const identity = {
    user_id: "tenant",
    client_name: "Loja",
    normalized_name: "loja",
    logo_path: "default.png",
    identity: {
      logo_fundo_claro_path: "light.png",
      logo_fundo_escuro_path: "dark.png",
    },
  };
  assertEquals(clientLogoPath(identity, "light"), "light.png");
  assertEquals(clientLogoPath(identity, "dark"), "dark.png");
  assertEquals(
    clientLogoPath({ ...identity, identity: {} }, "dark"),
    "default.png",
  );
});

Deno.test("variante escura automática é usada em imagens", () => {
  const identity = {
    user_id: "tenant",
    client_name: "Loja",
    normalized_name: "loja",
    logo_path: "default.png",
    identity: {
      logo_fundo_escuro_path: "dark-auto.png",
      logo_fundo_escuro_gerada_automaticamente: true,
    },
  };
  assertEquals(clientLogoPath(identity, "dark"), "dark-auto.png");
  assertEquals(clientLogoPath(identity, "dark", true), "dark-auto.png");
});
