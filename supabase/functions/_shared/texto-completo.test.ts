import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { cortarFrase, textoIncompleto } from "./texto-completo.ts";

Deno.test("nunca devolve reticências nem palavra partida", () => {
  const casos = [
    ["Seu assistente de IA no WhatsApp oficial, com linguagem humana e resposta imediata", 62],
    ["Imagens ultra-realistas, vídeos, reels e carrosséis com a identidade da sua marca", 62],
    ["Do WhatsApp para Instagram, Facebook e TikTok. Sem automação paralela", 62],
    ["A IA cuida do operacional repetitivo, liberando tempo para a sua equipe", 30],
  ] as const;
  for (const [frase, max] of casos) {
    const out = cortarFrase(frase, max);
    assertEquals(out.length <= max, true, `estourou o limite: ${out}`);
    assertEquals(/…|\.\.\./.test(out), false, `saiu com reticências: ${out}`);
    assertEquals(textoIncompleto(out), null, `saiu incompleto: ${out}`);
    // não corta no meio de palavra
    const palavras = frase.split(" ");
    for (const p of out.replace(/[.,;:!?]/g, "").split(" ")) {
      assertEquals(palavras.some((w) => w.replace(/[.,;:!?]/g, "") === p), true, `palavra partida: ${p}`);
    }
  }
});

Deno.test("mantém frases completas quando cabem", () => {
  assertEquals(
    cortarFrase("Tudo pelo WhatsApp. Sem aprender ferramenta nenhuma.", 25),
    "Tudo pelo WhatsApp.",
  );
});

Deno.test("texto curto passa intacto", () => {
  assertEquals(cortarFrase("Fale com a gente.", 44), "Fale com a gente.");
});

Deno.test("detecta texto que não pode ir ao ar", () => {
  assertEquals(textoIncompleto("com linguagem humana…") !== null, true);
  assertEquals(textoIncompleto("a publicação sai ao mesmo tempo , Facebook") !== null, true);
  assertEquals(textoIncompleto("Do WhatsApp para Instagram, Facebook e") !== null, true);
  assertEquals(textoIncompleto("Olá {{nome}}") !== null, true);
  assertEquals(textoIncompleto("Publicação em todas as redes, com aprovação do dono."), null);
});
