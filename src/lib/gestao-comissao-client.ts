import { applyGestaoComissaoSync, estornarComissaoAuto } from "../../supabase/functions/_shared/gestao-comissao-sync.ts";
import { loadComissaoRegra, loadGestaoVendedores } from "./gestao-equipe-load.ts";
import { supabase } from "@/integrations/supabase/client";
import { comissaoLucroBase } from "./gestao-comissao-lucro.ts";

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
    supabase.from("veiculo_despesas" as "veiculos_estoque")
      .select("valor, categoria, origem_lancamento")
      .eq("user_id", params.userId).eq("veiculo_id", params.veiculoId).is("deleted_at", null),
  ]);

  const dList = (despesas ?? []).map((d: {
    valor: number;
    categoria: string;
    origem_lancamento: string;
  }) => ({
    valor: Number(d.valor),
    categoria: d.categoria,
    origem_lancamento: d.origem_lancamento,
  }));

  const { lucroLiquido, margemPct } = comissaoLucroBase({
    valorCompra: compra ? Number(compra.valor_compra) : null,
    valorVenda: params.valorVenda,
    despesas: dList,
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
    lucroLiquido,
    margemPct,
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
