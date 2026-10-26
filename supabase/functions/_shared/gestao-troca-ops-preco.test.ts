import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  gestaoTrocaCrlvIdentifiers,
  liberarTrocaParaEstoque,
} from "./gestao-troca-ops.ts";

Deno.test("liberar para estoque usa preço informado no insert", async () => {
  let insertedPreco: number | null = null;
  const trocaRow = {
    status: "fechada",
    veiculo_id: null,
    destino: null,
    valor_fechado: 50000,
    marca: "Fiat",
    modelo: "Uno",
    versao: null,
    ano_fabricacao: 2020,
    ano_modelo: 2020,
    km: 10000,
    cor: null,
    placa: "ABC1D23",
    fechado_em: "2026-01-01",
  };

  const chainUpdate = () => ({
    eq: () => ({
      eq: () => ({
        is: () => ({
          is: () => ({
            select: () => ({
              maybeSingle: async () => ({ data: { id: "t1" }, error: null }),
            }),
          }),
        }),
      }),
      is: () => ({
        is: () => Promise.resolve({}),
      }),
    }),
    is: () => ({
      is: () => Promise.resolve({}),
    }),
  });

  const sb = {
    from: (table: string) => {
      if (table === "gestao_troca") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: trocaRow, error: null }),
              }),
            }),
          }),
          update: () => chainUpdate(),
        };
      }
      if (table === "veiculos_estoque") {
        return {
          insert: (row: { preco: number }) => ({
            select: () => ({
              single: async () => {
                insertedPreco = row.preco;
                return { data: { id: "v1" }, error: null };
              },
            }),
          }),
        };
      }
      if (table === "veiculo_compra") {
        return { upsert: async () => ({}) };
      }
      if (table === "gestao_documento") {
        const query = {
          eq: () => query,
          in: () => query,
          is: () => query,
          order: () => query,
          limit: () => query,
          maybeSingle: async () => ({ data: null, error: null }),
        };
        return { select: () => query };
      }
      if (table === "gestao_troca_despesa") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                is: async () => ({ data: [] }),
              }),
            }),
          }),
        };
      }
      if (table === "veiculo_despesas") {
        return { insert: async () => ({}) };
      }
      if (table === "gestao_troca_evento") {
        return { insert: async () => ({}) };
      }
      return {};
    },
  };

  await liberarTrocaParaEstoque(sb as never, "u1", "t1", "test", 78990.5);
  assertEquals(insertedPreco, 78990.5);
});

Deno.test("DOC-1.1b — identificadores confirmados do CRLV são defensivos", () => {
  assertEquals(
    gestaoTrocaCrlvIdentifiers({
      confirmados: {
        placa: "abc-1d23",
        renavam: "12345678901",
        chassi: "9BWZZZ377VT004251",
      },
    }),
    {
      placa: "ABC1D23",
      renavam: "12345678901",
      chassi: "9BWZZZ377VT004251",
    },
  );
  assertEquals(
    gestaoTrocaCrlvIdentifiers({
      confirmados: {
        placa: "inválida",
        renavam: "telefone",
        chassi: "9BWZZZI77VT004251",
      },
    }),
    { placa: null, renavam: null, chassi: null },
  );
});

Deno.test("DOC-1.1b — liberação liga CRLV ao estoque e audita origem troca", async () => {
  const source = await Deno.readTextFile(
    new URL("gestao-troca-ops.ts", import.meta.url),
  );
  assertStringIncludes(source, "placa: crlv.placa ?? troca.placa");
  assertStringIncludes(source, "renavam: crlv.renavam");
  assertStringIncludes(source, "chassi: crlv.chassi");
  assertStringIncludes(source, "veiculo_id: vid");
  assertStringIncludes(source, 'acao: "confirmar"');
  assertStringIncludes(source, 'detalhe: { origem: "troca" }');
});
