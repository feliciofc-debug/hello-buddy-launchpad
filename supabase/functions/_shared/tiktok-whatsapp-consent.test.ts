import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  parseTikTokDisclosure,
  privacyChoiceText,
  tiktokInteractiveListFromToolResult,
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

Deno.test("resultado de agendamento por texto anexa lista de privacidade", () => {
  const list = tiktokInteractiveListFromToolResult(JSON.stringify({
    status: "aguardando_privacidade_tiktok",
    mensagem: "Escolha quem poderá ver o vídeo.",
    privacy_options: ["PUBLIC_TO_EVERYONE", "SELF_ONLY"],
  }));
  assertEquals(list?.rows, [
    {
      id: "tiktok_privacy:PUBLIC_TO_EVERYONE",
      title: "Todos",
      description: "PUBLIC_TO_EVERYONE",
    },
    {
      id: "tiktok_privacy:SELF_ONLY",
      title: "Somente eu",
      description: "SELF_ONLY",
    },
  ]);
});

Deno.test("resultado após privacidade anexa lista de declaração", () => {
  const list = tiktokInteractiveListFromToolResult(JSON.stringify({
    status: "aguardando_declaracao_tiktok",
    mensagem: "Este vídeo é comercial?",
  }));
  assertEquals(list?.rows.map((row) => row.id), [
    "tiktok_disclosure:non_commercial",
    "tiktok_disclosure:brand_organic",
    "tiktok_disclosure:branded_content",
  ]);
});
