import { describe, expect, test } from "bun:test";
import { contraste } from "../agente/contraste";
import { aplicarFundoPaleta, type Paleta } from ".";

const original: Paleta = {
  bg: "#123456",
  bg2: "#234567",
  panel: "#345678",
  line: "#456789",
  destaque: "#ff7a1a",
  destaqueSoft: "#ff9e56",
  texto: "#abcdef",
  suave: "#bcdef0",
};

describe("fundo dos templates", () => {
  test("mantém a paleta exatamente igual quando o parâmetro é omitido", () => {
    expect(aplicarFundoPaleta(original)).toBe(original);
  });

  test("preserva as cores da marca e garante contraste nos dois fundos", () => {
    for (const fundo of ["claro", "escuro"] as const) {
      const paleta = aplicarFundoPaleta(original, fundo);
      expect(paleta.destaque).toBe(original.destaque);
      expect(paleta.destaqueSoft).toBe(original.destaqueSoft);
      expect(contraste(paleta.bg, paleta.texto)).toBeGreaterThanOrEqual(4.5);
      expect(contraste(paleta.panel, paleta.texto)).toBeGreaterThanOrEqual(4.5);
      expect(contraste(paleta.bg, paleta.suave)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
