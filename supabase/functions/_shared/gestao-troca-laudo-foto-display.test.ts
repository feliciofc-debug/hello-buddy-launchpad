import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { formatGestaoTrocaResumoAreaLinha } from "./gestao-troca-laudo-foto-display.ts";

Deno.test("resumo nao_fotografado — só um ⚪", () => {
  const linha = formatGestaoTrocaResumoAreaLinha({
    area: "estrutura_cofre",
    condicao: "nao_fotografado",
    texto: "✅ sem alteração (IA errada)",
    fotos: [],
  });
  assertEquals(linha.startsWith("⚪"), true);
  assertEquals(linha.includes("✅"), false);
});
