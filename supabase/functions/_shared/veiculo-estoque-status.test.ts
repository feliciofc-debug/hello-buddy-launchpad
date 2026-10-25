import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  isVeiculoEstoqueAtivoInterno,
  statusInicialEntradaVeiculo,
  validarLiberacaoVitrine,
} from "./veiculo-estoque-status.ts";

Deno.test("TROCA-VENDA-1.1 — entrada sem foto fica em preparação", () => {
  assertEquals(
    statusInicialEntradaVeiculo({ fotos: [], preco: 100_000 }),
    "em_preparacao",
  );
});

Deno.test("TROCA-VENDA-1.1 — entrada com foto e preço fica disponível", () => {
  assertEquals(
    statusInicialEntradaVeiculo({ fotos: ["foto.jpg"], preco: 100_000 }),
    "disponivel",
  );
});

Deno.test("TROCA-VENDA-1.1 — em preparação conta como estoque interno ativo", () => {
  assertEquals(isVeiculoEstoqueAtivoInterno("em_preparacao"), true);
  assertEquals(isVeiculoEstoqueAtivoInterno("vendido"), false);
});

Deno.test("TROCA-VENDA-1.1 — liberar exige foto e preço", () => {
  assertEquals(validarLiberacaoVitrine({ fotos: [], preco: null }), {
    ok: false,
    faltantes: ["foto", "preco"],
  });
  assertEquals(validarLiberacaoVitrine({ fotos: ["foto.jpg"], preco: null }), {
    ok: false,
    faltantes: ["preco"],
  });
  assertEquals(validarLiberacaoVitrine({ fotos: [], preco: 100_000 }), {
    ok: false,
    faltantes: ["foto"],
  });
  assertEquals(validarLiberacaoVitrine({ fotos: ["foto.jpg"], preco: 100_000 }), {
    ok: true,
  });
});
