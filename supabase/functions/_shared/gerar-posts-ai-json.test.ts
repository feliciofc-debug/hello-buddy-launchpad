import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  extractFirstJsonObject,
  GERAR_POSTS_FRIENDLY_ERROR,
  parseAiJsonObject,
  stripAiJsonFences,
} from "./gerar-posts-ai-json.ts";

Deno.test("FIX-COPY-PAINEL — remove cercas markdown e extrai objeto", () => {
  const raw = 'Intro\n```json\n{"instagram":{"opcaoA":"a"}}\n```\nfim';
  assertEquals(stripAiJsonFences(raw).includes("```"), false);
  const obj = extractFirstJsonObject(raw);
  assertEquals(obj, '{"instagram":{"opcaoA":"a"}}');
});

Deno.test("FIX-COPY-PAINEL — repara vírgula final e texto ao redor", () => {
  const raw = 'Ok:\n{"facebook":{"opcaoA":"linha 1",}, "story":{"opcaoB":"x"}}';
  const parsed = parseAiJsonObject<{ facebook: { opcaoA: string } }>(raw);
  assertEquals(parsed.ok, true);
  if (parsed.ok) {
    assertEquals(parsed.value.facebook.opcaoA, "linha 1");
  }
});

Deno.test("FIX-COPY-PAINEL — JSON inválido retorna reason invalid", () => {
  const parsed = parseAiJsonObject('{"instagram":{"opcaoA": quebrado sem aspas}}');
  assertEquals(parsed.ok, false);
  if (!parsed.ok) assertEquals(parsed.reason, "invalid");
});

Deno.test("FIX-COPY-PAINEL — mensagem amigável definida", () => {
  assertEquals(
    GERAR_POSTS_FRIENDLY_ERROR.includes("tente de novo"),
    true,
  );
});
