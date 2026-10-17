import { applyGestaoComissaoSync, estornarComissaoAuto } from "../../supabase/functions/_shared/gestao-comissao-sync.ts";
import { loadComissaoRegra, loadGestaoVendedores } from "./gestao-equipe-load.ts";
import { calcGestaoLucro } from "../../supabase/functions/_shared/gestao-lucro-calc.ts";
import { supabase } from "@/integrations/supabase/client";

export type ApplyComissaoParams = {
  userId: string;
  veiculoId: string;
  vendedorId: string | null;
  valorVenda: number;
  dataVenda: string;
  valorComissaoOverride?: number | null;
  statusVeiculo: string;
};

export async function syncComissaoAfterVenda(params: ApplyComissaoParams): Promise<number> {
  if (!params.vendedorId) {
    await estornarComissaoAuto(supabase as never, params.userId, params.veiculoId);
    return 0;
  }

  const vendedores = await loadGestaoVendedores(params.userId);
  const vendedor = vendedores.find((v) => v.id === params.vendedorId);
  const gerente = vendedores.find((v) => v.is_gerente && v.ativo);

  const [{ data: compra }, { data: despesas }] = await Promise.all([
    supabase.from("veiculo_compra" as "veiculos_estoque").select("valor_compra, data_compra")
      .eq("user_id", params.userId).eq("veiculo_id", params.veiculoId).maybeSingle(),
    supabase.from("veiculo_despesas" as "veiculos_estoque").select("valor, categoria")
      .eq("user_id", params.userId).eq("veiculo_id", params.veiculoId).is("deleted_at", null),
  ]);

  const dList = (despesas ?? []).map((d: { valor: number; categoria: string }) => ({
    valor: Number(d.valor),
    categoria: d.categoria,
  }));

  const lucro = calcGestaoLucro({
    valorCompra: compra ? Number(compra.valor_compra) : null,
    despesas: dList,
    valorVenda: params.valorVenda,
    precoAnunciado: null,
    dataCompra: compra?.data_compra ?? null,
    dataVenda: params.dataVenda,
    statusVeiculo: params.statusVeiculo,
  });

  const regraVendedor = await loadComissaoRegra(params.userId, params.vendedorId);
  const regraGerente = gerente ? await loadComissaoRegra(params.userId, gerente.id) : null;

  const result = await applyGestaoComissaoSync(supabase as never, {
    userId: params.userId,
    veiculoId: params.veiculoId,
    vendedorId: params.vendedorId,
    vendedorNome: vendedor?.nome ?? "Vendedor",
    gerenteId: gerente?.id ?? null,
    valorVenda: params.valorVenda,
    lucroLiquido: lucro.lucroLiquido,
    margemPct: lucro.margemPct,
    regraVendedor,
    regraGerente,
    valorComissaoOverride: params.valorComissaoOverride ?? null,
    dataDespesa: params.dataVenda,
  });

  return result.comissaoTotal;
}

export async function estornarComissaoVeiculo(userId: string, veiculoId: string): Promise<void> {
  await estornarComissaoAuto(supabase as never, userId, veiculoId);
}
