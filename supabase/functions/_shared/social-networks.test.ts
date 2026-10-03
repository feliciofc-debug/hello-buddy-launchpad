import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  canonicalSocialNetwork,
  detectRequestedSocialNetworks,
} from "./social-networks.ts";

Deno.test("detecta aliases do LinkedIn", () => {
  assertEquals(detectRequestedSocialNetworks("posta no LinkedIn"), ["linkedin"]);
  assertEquals(detectRequestedSocialNetworks("publica no linked in"), ["linkedin"]);
  assertEquals(detectRequestedSocialNetworks("manda pro lkd"), ["linkedin"]);
  assertEquals(canonicalSocialNetwork("Linked In"), "linkedin");
});

Deno.test("detecta LinkedIn junto com Instagram", () => {
  assertEquals(
    detectRequestedSocialNetworks("posta no Instagram e LinkedIn"),
    ["instagram", "linkedin"],
  );
});

Deno.test("redes sociais preserva o padrão e só inclui LinkedIn quando explícito", () => {
  assertEquals(
    detectRequestedSocialNetworks("posta nas redes sociais"),
    ["facebook", "instagram", "tiktok"],
  );
  assertEquals(
    detectRequestedSocialNetworks("posta nas redes sociais e no LinkedIn"),
    ["facebook", "instagram", "tiktok", "linkedin"],
  );
});
