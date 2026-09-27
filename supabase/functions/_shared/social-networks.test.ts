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
