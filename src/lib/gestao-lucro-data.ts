import { calcGestaoLucro } from "../../supabase/functions/_shared/gestao-lucro-calc.ts";
import { daysInStock } from "../../supabase/functions/_shared/gestao-estoque-snapshot.ts";
import { supabase } from "@/integrations/supabase/client";
import type {
  GestaoDespesaRow,
  GestaoLucroBundle,
  GestaoVeiculoEnriched,
} from "./gestao-lucro-types.ts";

export async function loadGestaoLucroBundle(userId: string): Promise<GestaoLucroBundle> {
  const [{ data: veiculos }, { data: compras }, { data: despesas }, { data: vendas }] =
    await Promise.all([
      supabase.from("veiculos_estoque")
        .select(
          "id, marca, modelo, versao, preco, status, placa, fotos, codigo_origem, ano_modelo, ano_fabricacao, combustivel, created_at",
        )
        .eq("user_id", userId),
      supabase.from("veiculo_compra" as "veiculos_estoque")
        .select("veiculo_id, valor_compra, data_compra")
        .eq("user_id", userId),
      supabase.from("veiculo_despesas" as "veiculos_estoque")
        .select(
          "id, veiculo_id, data, categoria, valor, descricao, origem_lancamento, lancado_por, comprovante_path",
        )
        .eq("user_id", userId)
        .is("deleted_at", null)
        .order("data", { ascending: false }),
      supabase.from("veiculo_venda" as "veiculos_estoque")
        .select("veiculo_id, valor_venda, data_venda, vendedor, vendedor_id")
        .eq("user_id", userId),
    ]);

  const compraBy = new Map(
    (compras ?? []).map((c: { veiculo_id: string; valor_compra: number; data_compra: string }) => [
      c.veiculo_id,
      c,
    ]),
  );
  const vendaBy = new Map(
    (vendas ?? []).map((v: {
      veiculo_id: string;
      valor_venda: number;
      data_venda: string;
      vendedor: string | null;
    }) => [v.veiculo_id, v]),
  );
  const despesasBy = new Map<string, GestaoDespesaRow[]>();
  const despesasFlat: GestaoDespesaRow[] = [];
  for (const d of despesas ?? []) {
    const row = d as GestaoDespesaRow;
    despesasFlat.push(row);
    const list = despesasBy.get(row.veiculo_id) ?? [];
    list.push(row);
    despesasBy.set(row.veiculo_id, list);
  }

  const enriched: GestaoVeiculoEnriched[] = (veiculos ?? []).map((raw) => {
    const v = raw as GestaoVeiculoEnriched & { placa?: string | null };
    const compra = compraBy.get(v.id);
    const venda = vendaBy.get(v.id) as {
      valor_venda: number;
      data_venda: string;
      vendedor: string | null;
      vendedor_id?: string | null;
    } | undefined;
    const dList = despesasBy.get(v.id) ?? [];
    const lucro = calcGestaoLucro({
      valorCompra: compra ? Number(compra.valor_compra) : null,
      despesas: dList.map((x) => ({ valor: Number(x.valor), categoria: x.categoria })),
      valorVenda: venda ? Number(venda.valor_venda) : null,
      precoAnunciado: v.preco,
      dataCompra: compra?.data_compra ?? null,
      dataVenda: venda?.data_venda ?? null,
      statusVeiculo: v.status,
    });
    return {
      id: v.id,
      marca: v.marca,
      modelo: v.modelo,
      versao: v.versao,
      preco: v.preco,
      status: v.status,
      placa: v.placa ?? null,
      fotos: v.fotos ?? [],
      codigo_origem: v.codigo_origem,
      ano_modelo: v.ano_modelo,
      ano_fabricacao: v.ano_fabricacao,
      combustivel: (v as { combustivel?: string | null }).combustivel ?? null,
      created_at: v.created_at,
      valorCompra: compra ? Number(compra.valor_compra) : null,
      dataCompra: compra?.data_compra ?? null,
      valorVenda: venda ? Number(venda.valor_venda) : null,
      dataVenda: venda?.data_venda ?? null,
      vendedor: venda?.vendedor ?? null,
      vendedor_id: venda?.vendedor_id ?? null,
      despesas: dList,
      lucro,
    };
  });

  return { veiculos: enriched, despesasFlat };
}

export function isActiveStock(v: GestaoVeiculoEnriched): boolean {
  return v.status === "disponivel" || v.status === "reservado";
}

export function vehicleLabel(v: GestaoVeiculoEnriched): string {
  return [v.marca, v.modelo, v.versao].filter(Boolean).join(" ");
}

export function vehicleDays(v: GestaoVeiculoEnriched): number {
  return daysInStock(v.dataCompra, v.created_at);
}
