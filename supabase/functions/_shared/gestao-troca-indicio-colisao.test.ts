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

Deno.test("indício — parafuso + fresta moderado (não forte)", () => {
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
  assertEquals(r.dianteira.nivel, "moderado");
});

Deno.test("indício — falso positivo interior/pneus/risco não pontua", () => {
  const r = calcIndicioColisao([
    {
      tipo: "desgaste_interno",
      local: "banco",
      severidade: "moderada",
      confianca: "alta",
      evidencia: "banco gasto",
      foto: 1,
      slot: "bancos_dianteiros",
    },
    {
      tipo: "risco",
      local: "parte de cima do para-choque",
      severidade: "leve",
      confianca: "media",
      evidencia: "risquinho",
      foto: 2,
      slot: "frente",
    },
    {
      tipo: "mancha_interna",
      local: "tapete",
      severidade: "leve",
      confianca: "media",
      evidencia: "mancha",
      foto: 3,
      slot: "bancos_traseiros",
    },
    {
      tipo: "pneu_sulco_baixo",
      local: "pneu dd",
      severidade: "moderada",
      confianca: "media",
      evidencia: "meia-vida",
      foto: 4,
      slot: "pneu_dd",
    },
  ]);
  assertEquals(r.dianteira.nivel, "nenhum");
  assertEquals(r.traseira.nivel, "nenhum");
  assertEquals(r.lateral_esq.nivel, "nenhum");
  assertEquals(r.lateral_dir.nivel, "nenhum");
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
