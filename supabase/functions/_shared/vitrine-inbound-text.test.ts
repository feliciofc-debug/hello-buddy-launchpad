import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { stripAudioTranscriptPrefix } from "./vitrine-inbound-text.ts";

Deno.test("stripAudioTranscriptPrefix remove prefixo do processor", () => {
  assertEquals(
    stripAudioTranscriptPrefix("🎙️ Áudio transcrito: quero um civic"),
    "quero um civic",
  );
  assertEquals(stripAudioTranscriptPrefix("texto normal"), "texto normal");
});
