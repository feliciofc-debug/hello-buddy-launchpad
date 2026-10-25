import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  alertasGestaoOs,
  decidirSincronizacaoOs,
  exigeDecisaoConsignante,
  podeTransicionarOs,
  validarLiberacaoComOs,
} from "./gestao-os-domain.ts";

Deno.test("OS-1 — máquina de estados não pula aprovação ou check-out", () => {
  assertEquals(podeTransicionarOs("rascunho", "orcamento"), true);
  assertEquals(podeTransicionarOs("orcamento", "aprovada"), false);
  assertEquals(podeTransicionarOs("checkout", "concluida"), true);
  assertEquals(podeTransicionarOs("concluida", "rascunho"), false);
  assertEquals(podeTransicionarOs("em_execucao", "aguardando_aprovacao"), true);
});

Deno.test("OS-1 — consignado exige decisão explícita", () => {
  assertEquals(exigeDecisaoConsignante({
    consignadoAtivo: true,
    descontarDoConsignante: null,
  }), true);
  assertEquals(exigeDecisaoConsignante({
    consignadoAtivo: true,
    descontarDoConsignante: false,
  }), false);
});

Deno.test("OS-1 — carro em preparação não libera com OS aberta", () => {
  const bloqueado = validarLiberacaoComOs({
    fotos: ["foto.jpg"],
    preco: 50_000,
    osPreparacao: [{ status: "em_execucao" }],
  });
  assertEquals(bloqueado.ok, false);
  if (!bloqueado.ok) assertStringIncludes(bloqueado.motivo, "todas as OS");
  assertEquals(validarLiberacaoComOs({
    fotos: ["foto.jpg"],
    preco: 50_000,
    osPreparacao: [{ status: "concluida" }, { status: "cancelada" }],
  }), { ok: true });
});

Deno.test("OS-1 — alertas internos respeitam 7 e 15 dias", () => {
  assertEquals(alertasGestaoOs([{
    status: "em_execucao",
    tipo: "preparacao",
    ultimaMovimentacaoEm: "2026-10-01T00:00:00Z",
    entradaVeiculoEm: "2026-09-20T00:00:00Z",
    veiculoStatus: "em_preparacao",
  }], { osParadaDias: 7, preparacaoParadaDias: 15 }, new Date("2026-10-20T00:00:00Z")), {
    osParadas: 1,
    preparacoesParadas: 1,
  });
});

Deno.test("OS-1 — financeiro preserva apagado, baixado e editado", () => {
  assertEquals(decidirSincronizacaoOs({ novoValor: 100 }), "criar");
  assertEquals(decidirSincronizacaoOs({
    registro: { valor: 100, deletedAt: "2026-10-01" },
    ultimoValorSincronizado: 100,
    novoValor: 120,
  }), "preservar_apagado");
  assertEquals(decidirSincronizacaoOs({
    registro: { valor: 100, pagoEm: "2026-10-01" },
    ultimoValorSincronizado: 100,
    novoValor: 120,
  }), "preservar_baixado");
  assertEquals(decidirSincronizacaoOs({
    registro: { valor: 150 },
    ultimoValorSincronizado: 100,
    novoValor: 120,
  }), "preservar_editado");
});
