import { buildGestaoEstoqueSnapshot, type GestaoEstoqueSnapshot } from "../../supabase/functions/_shared/gestao-estoque-snapshot.ts";
import { supabase } from "@/integrations/supabase/client";

export async function loadGestaoEstoqueSnapshot(
  userId: string,
): Promise<GestaoEstoqueSnapshot> {
  const [{ data: veiculos }, { data: compras }, { data: despesas }] = await Promise.all([
    supabase.from("veiculos_estoque")
      .select("id, marca, preco, status, created_at")
      .eq("user_id", userId),
    supabase.from("veiculo_compra" as "veiculos_estoque")
      .select("veiculo_id, valor_compra, data_compra")
      .eq("user_id", userId),
    supabase.from("veiculo_despesas" as "veiculos_estoque")
      .select("veiculo_id, valor")
      .eq("user_id", userId)
      .is("deleted_at", null),
  ]);

  const compraBy = new Map(
    (compras ?? []).map((c: { veiculo_id: string; valor_compra: number; data_compra: string }) => [
      c.veiculo_id,
      c,
    ]),
  );
  const despesasBy = new Map<string, number>();
  for (const d of despesas ?? []) {
    const row = d as { veiculo_id: string; valor: number };
    despesasBy.set(row.veiculo_id, (despesasBy.get(row.veiculo_id) ?? 0) + Number(row.valor));
  }

  const lines = (veiculos ?? []).map((v) => {
    const row = v as {
      id: string;
      marca: string;
      preco: number | null;
      status: string;
      created_at: string;
    };
    const compra = compraBy.get(row.id);
    return {
      id: row.id,
      marca: row.marca,
      preco: row.preco,
      status: row.status,
      created_at: row.created_at,
      dataCompra: compra?.data_compra ?? null,
      valorCompra: compra ? Number(compra.valor_compra) : null,
      despesasTotal: despesasBy.get(row.id) ?? 0,
    };
  });

  return buildGestaoEstoqueSnapshot(lines);
}

export type { GestaoEstoqueSnapshot };
