import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  parseTikTokDisclosure,
  privacyChoiceText,
} from "./tiktok-whatsapp-consent.ts";

const disclosureCases: Array<[string, string]> = [
  ["Não é comercial", "non_commercial"],
  ["Promove minha marca", "brand_organic"],
  ["Promove outra marca", "branded_content"],
  ["Não é comercial\n<<INTERACTIVE_ID:tiktok_disclosure:non_commercial>>", "non_commercial"],
  ["Promove minha marca\n<<INTERACTIVE_ID:tiktok_disclosure:brand_organic>>", "brand_organic"],
  ["Promove outra marca\n<<INTERACTIVE_ID:tiktok_disclosure:branded_content>>", "branded_content"],
];

for (const [input, expected] of disclosureCases) {
  Deno.test(`reconhece declaração TikTok: ${input.split("\n")[0]} (${input.includes("INTERACTIVE") ? "id" : "título"})`, () => {
    assertEquals(parseTikTokDisclosure(input), expected);
  });
}

Deno.test("privacidade usa o id da lista e remove o marcador", () => {
  assertEquals(
    privacyChoiceText("Todos\n<<INTERACTIVE_ID:tiktok_privacy:PUBLIC_TO_EVERYONE>>"),
    "PUBLIC_TO_EVERYONE",
  );
  assertEquals(privacyChoiceText("Somente eu"), "Somente eu");
});
