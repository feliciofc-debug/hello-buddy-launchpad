import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  formatPrecoVeiculoVideo,
  formatTelefoneBR,
  normalizarPropsProdutoVeiculo,
  quebrarTituloVeiculo,
  tamanhoFonteTituloVeiculo,
} from "./video-produto-veiculo.ts";
import { normalizarPropsProduto, PALETA_PADRAO_PRODUTO } from "./video-produto.ts";

Deno.test("formatTelefoneBR formata 11 dígitos", () => {
  assertEquals(formatTelefoneBR("21980804901"), "(21) 98080-4901");
});

Deno.test("formatPrecoVeiculoVideo omite centavos ,00", () => {
  assertEquals(formatPrecoVeiculoVideo("269900"), "R$ 269.900");
  assertEquals(formatPrecoVeiculoVideo("269900,00"), "R$ 269.900");
});

Deno.test("quebrarTituloVeiculo não parte palavra", () => {
  const linhas = quebrarTituloVeiculo("Range Rover Evoque P300 Gasolina");
  assertEquals(linhas.length, 2);
  assertEquals(linhas.join(" "), "Range Rover Evoque P300 Gasolina");
});

Deno.test("tamanhoFonteTituloVeiculo reduz título longo", () => {
  const linhas = quebrarTituloVeiculo("Range Rover Evoque P300 Gasolina");
  assertEquals(tamanhoFonteTituloVeiculo(linhas) <= 52, true);
});

Deno.test("normalizarPropsProduto produto mantém paleta escura AMZ", () => {
  const props = normalizarPropsProduto(
    { produto: { nome: "Relógio" } },
    { imagemUrl: "https://x.supabase.co/storage/v1/object/public/a/b.jpg" },
  );
  assertEquals(props.cores.bg, PALETA_PADRAO_PRODUTO.bg);
  assertEquals(props.cores.destaque, PALETA_PADRAO_PRODUTO.destaque);
});

Deno.test("normalizarPropsProdutoVeiculo usa paleta estúdio", () => {
  const props = normalizarPropsProdutoVeiculo(
    {
      produto: { nome: "Range Rover Evoque", preco: "269900" },
      cta: { telefone: "21980804901" },
    },
    { imagemUrl: "https://x.supabase.co/storage/v1/object/public/a/b.jpg" },
  );
  assertEquals(props.cores.bg, "#F8F9FA");
  assertEquals(props.cta.telefone, "(21) 98080-4901");
  assertEquals(props.produto.preco, "R$ 269.900");
});
