import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { calcIndicioColisao } from "./gestao-troca-indicio-colisao.ts";

Deno.test("indício — nada", () => {
  const r = calcIndicioColisao([]);
  assertEquals(r.dianteira.nivel, "nenhum");
});

Deno.test("indício — farol divergente sozinho fraco", () => {
  const r = calcIndicioColisao([{
    tipo: "farol_lanterna_divergente",
    local: "farol",
    severidade: "leve",
    confianca: "media",
    evidencia: "tonalidade diferente",
    foto: 1,
    slot: "frente",
  }]);
  assertEquals(r.dianteira.nivel, "fraco");
});

Deno.test("indício — parafuso + fresta moderado", () => {
  const r = calcIndicioColisao([
    {
      tipo: "parafuso_mexido",
      local: "paralama",
      severidade: "moderada",
      confianca: "media",
      evidencia: "marca ferramenta",
      foto: 2,
      slot: "cofre_motor",
    },
    {
      tipo: "fresta_desalinhada",
      local: "capô",
      severidade: "leve",
      confianca: "media",
      evidencia: "folga",
      foto: 2,
      slot: "cofre_motor",
    },
  ]);
  assertEquals(["moderado", "forte"].includes(r.dianteira.nivel), true);
});

Deno.test("indício — solda longarina forte", () => {
  const r = calcIndicioColisao([{
    tipo: "solda_aparente",
    local: "longarina",
    severidade: "grave",
    confianca: "alta",
    evidencia: "cordão de solda",
    foto: 3,
    slot: "cofre_longarina_esq",
  }]);
  assertEquals(r.dianteira.nivel, "forte");
});

Deno.test("indício — descartado não conta", () => {
  const r = calcIndicioColisao([{
    tipo: "solda_aparente",
    local: "longarina",
    severidade: "grave",
    confianca: "alta",
    evidencia: "x",
    foto: 1,
    descartado: true,
  }]);
  assertEquals(r.dianteira.nivel, "nenhum");
});
