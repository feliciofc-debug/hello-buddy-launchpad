import { assertEquals, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  assertTrocaDisponivel,
  calcularComposicaoTrocaVenda,
  calcularSobreAvaliacaoTroca,
  simularTransacaoTrocaVenda,
} from "./troca-venda-calc.ts";

Deno.test("TROCA-VENDA-1 — venda 100k e troca 120k gera troco 20k", () => {
  assertEquals(
    calcularComposicaoTrocaVenda({
      precoVenda: 100_000,
      entrada: 0,
      financiamentoValor: 0,
      trocaValor: 120_000,
    }),
    {
      saldo: -20_000,
      tipoFinanceiro: "pagar",
      valorFinanceiro: 20_000,
      efeitoCaixaHoje: -20_000,
    },
  );
});

Deno.test("TROCA-VENDA-1 — entrada 10k + financiamento 30k + troca 60k quita 100k", () => {
  assertEquals(
    calcularComposicaoTrocaVenda({
      precoVenda: 100_000,
      entrada: 10_000,
      financiamentoValor: 30_000,
      trocaValor: 60_000,
    }).saldo,
    0,
  );
});

Deno.test("TROCA-VENDA-1 — sobre-avaliação reduz lucro real", () => {
  const r = calcularSobreAvaliacaoTroca({
    valorTroca: 120_000,
    teto: 114_000,
    lucroContabil: 15_000,
  });
  assertEquals(r.excesso, 6_000);
  assertEquals(r.lucroReal, 9_000);
  assertEquals(
    r.aviso,
    "Troca fechada R$ 6.000 acima do teto — lucro real desta operação: R$ 9.000",
  );
});

Deno.test("TROCA-VENDA-1 — troca usada em outra venda é bloqueada", () => {
  assertThrows(
    () =>
      assertTrocaDisponivel({
        trocaId: "troca-1",
        vendaExistenteId: "venda-2",
        vendaAtualId: "venda-1",
      }),
    Error,
    "já foi usada",
  );
});

Deno.test("TROCA-VENDA-1 — falha no meio descarta todas as etapas", () => {
  let staged: unknown[] | undefined;
  try {
    simularTransacaoTrocaVenda([
      () => ({ vehicle: "criado" }),
      () => {
        throw new Error("falha");
      },
      () => ({ finance: "criado" }),
    ]);
  } catch (error) {
    staged = (error as Error & { staged: unknown[] }).staged;
  }
  assertEquals(staged, []);
});
