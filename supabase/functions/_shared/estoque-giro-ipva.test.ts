import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  classificarIpvaCombustivelAuto,
  resolverIpvaVeiculo,
} from "./estoque-giro-ipva.ts";
import { calcularEstoqueGiro, DEFAULT_ESTOQUE_GIRO_CONFIG } from "./estoque-giro-calc.ts";
import { DEFAULT_COMISSAO_REGRA } from "./gestao-comissao-calc.ts";

const configBase = {
  ...DEFAULT_ESTOQUE_GIRO_CONFIG,
  ipvaAliquotaPct: 4,
  ipvaAliquotaHibridoPct: 1.5,
  ipvaAliquotaEletricoPct: 0.5,
  ipvaLojaPagaVirada: true,
  uf: "RJ",
};

Deno.test("G90-2.2 — Evoque P300 GASOLINA MHEV → híbrido + conferir documento", () => {
  const c = classificarIpvaCombustivelAuto({
    combustivel: "Gasolina",
    versao: "P300 GASOLINA MHEV",
    modelo: "Range Rover Evoque",
  });
  assertEquals(c.categoria, "hibrido");
  assertEquals(c.conferirDocumento, true);
});

Deno.test("G90-2.2 — E-HYBRID na versão → híbrido", () => {
  const c = classificarIpvaCombustivelAuto({
    combustivel: "Gasolina",
    versao: "3.0 E-HYBRID",
    modelo: "Cayenne",
  });
  assertEquals(c.categoria, "hibrido");
});

Deno.test("G90-2.2 — combustível Elétrico → elétrico", () => {
  const c = classificarIpvaCombustivelAuto({
    combustivel: "Elétrico",
    versao: null,
    modelo: "Model 3",
  });
  assertEquals(c.categoria, "eletrico");
});

Deno.test("G90-2.3 — GASOLINA/ELETRICO no CRLV → híbrido", () => {
  const c = classificarIpvaCombustivelAuto({
    combustivel: "GASOLINA/ELETRICO",
    versao: null,
    modelo: "Cayenne E-Hybrid",
  });
  assertEquals(c.categoria, "hibrido");
  assertEquals(c.conferirDocumento, false);
});

Deno.test("G90-2.3 — Flex/Elétrico → híbrido", () => {
  const c = classificarIpvaCombustivelAuto({
    combustivel: "Flex/Elétrico",
    versao: null,
    modelo: "Corolla",
  });
  assertEquals(c.categoria, "hibrido");
});

Deno.test("G90-2.2 — flex → geral", () => {
  const c = classificarIpvaCombustivelAuto({
    combustivel: "Flex",
    versao: "1.0",
    modelo: "Onix",
  });
  assertEquals(c.categoria, "geral");
  assertEquals(c.conferirDocumento, false);
});

Deno.test("G90-2.2 — alíquota específica NULL → geral", () => {
  const r = resolverIpvaVeiculo({
    ajuste: { ipvaTipo: "auto", ipvaAliquotaManualPct: null },
    combustivel: "Híbrido",
    versao: null,
    modelo: null,
    config: {
      ipvaAliquotaPct: 4,
      ipvaAliquotaHibridoPct: null,
      ipvaAliquotaEletricoPct: null,
    },
  });
  assertEquals(r.aliquotaPct, 4);
});

Deno.test("G90-2.2 — ajuste isento → IPVA 0", () => {
  const r = calcularEstoqueGiro({
    hoje: "2026-10-23",
    dataCompra: "2026-01-01",
    createdAt: "2026-01-01",
    valorCompra: 100_000,
    despesas: [],
    precoAnunciado: 120_000,
    referencias: [{ fonte: "fipe", valor: 100_000 }],
    config: configBase,
    regraComissao: DEFAULT_COMISSAO_REGRA,
    ipvaAjuste: { ipvaTipo: "isento", ipvaAliquotaManualPct: null },
  });
  assertEquals(r.ipvaAliquotaEfetivaPct, 0);
  assertEquals(r.ipvaViradaValor, null);
  assertEquals(r.ipvaProjetado, 0);
});

Deno.test("G90-2.2 — ajuste manual 2% → 2% na virada", () => {
  const r = calcularEstoqueGiro({
    hoje: "2026-10-23",
    dataCompra: "2026-01-01",
    createdAt: "2026-01-01",
    valorCompra: 100_000,
    despesas: [],
    precoAnunciado: 120_000,
    referencias: [{ fonte: "fipe", valor: 100_000 }],
    config: configBase,
    regraComissao: DEFAULT_COMISSAO_REGRA,
    ipvaAjuste: { ipvaTipo: "manual", ipvaAliquotaManualPct: 2 },
  });
  assertEquals(r.ipvaAliquotaEfetivaPct, 2);
  assertEquals(r.ipvaViradaValor, 2_000);
});

Deno.test("G90-2.2 — MHEV auto usa híbrido 1,5% (Evoque ~4050 vs 4%)", () => {
  const r = calcularEstoqueGiro({
    hoje: "2026-10-23",
    dataCompra: "2026-01-01",
    createdAt: "2026-01-01",
    valorCompra: 270_000,
    despesas: [],
    precoAnunciado: 300_000,
    referencias: [{ fonte: "fipe", valor: 270_000 }],
    config: configBase,
    regraComissao: DEFAULT_COMISSAO_REGRA,
    combustivel: "Gasolina",
    versao: "P300 GASOLINA MHEV",
    modelo: "Range Rover Evoque",
    ipvaAjuste: { ipvaTipo: "auto", ipvaAliquotaManualPct: null },
  });
  assertEquals(r.ipvaAliquotaEfetivaPct, 1.5);
  assertEquals(r.ipvaViradaValor, 4_050);
  assert(r.ipvaConferirDocumento);
});
