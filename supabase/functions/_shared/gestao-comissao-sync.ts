import {
  calcComissaoGerente,
  calcGestaoComissao,
  type GestaoComissaoRegraJson,
  DEFAULT_COMISSAO_REGRA,
} from "./gestao-comissao-calc.ts";
import { validateGestaoComissaoValor } from "./gestao-comissao-guard.ts";

export type GestaoComissaoSyncInput = {
  userId: string;
  veiculoId: string;
  vendedorId: string | null;
  vendedorNome: string;
  gerenteId: string | null;
  valorVenda: number;
  lucroLiquido: number | null;
  margemPct: number | null;
  regraVendedor: GestaoComissaoRegraJson;
  regraGerente: GestaoComissaoRegraJson | null;
  valorComissaoOverride: number | null;
  dataDespesa: string;
};

export type GestaoComissaoSyncPlan = {
  estornarDespesaIds: string[];
  lancamentos: Array<{
    vendedorId: string;
    papel: "vendedor" | "gerente";
    valor: number;
    descricao: string;
  }>;
};

export function planGestaoComissaoSync(input: GestaoComissaoSyncInput): GestaoComissaoSyncPlan {
  const lancamentos: GestaoComissaoSyncPlan["lancamentos"] = [];

  if (input.vendedorId && input.valorVenda > 0) {
    let valor = input.valorComissaoOverride;
    if (valor == null) {
      valor = calcGestaoComissao({
        valorVenda: input.valorVenda,
        lucroLiquido: input.lucroLiquido,
        margemPct: input.margemPct,
        regra: input.regraVendedor ?? DEFAULT_COMISSAO_REGRA,
      }).total;
    }
    const guard = validateGestaoComissaoValor(valor, input.valorVenda, { allowAbove10Pct: true });
    if (valor > 0 && guard.ok) {
      lancamentos.push({
        vendedorId: input.vendedorId,
        papel: "vendedor",
        valor,
        descricao: `Comissão ${input.vendedorNome} (automática)`,
      });

      if (input.gerenteId && input.regraGerente) {
        const g = calcComissaoGerente(valor, input.valorVenda, input.regraGerente);
        if (g > 0) {
          lancamentos.push({
            vendedorId: input.gerenteId,
            papel: "gerente",
            valor: g,
            descricao: "Comissão gerente sobre equipe (automática)",
          });
        }
      }
    }
  }

  return { estornarDespesaIds: [], lancamentos };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from: (t: string) => any };

export async function estornarComissaoAuto(
  client: Db,
  userId: string,
  veiculoId: string,
): Promise<string[]> {
  const { data: autos } = await client.from("gestao_comissao_auto")
    .select("despesa_id")
    .eq("user_id", userId)
    .eq("veiculo_id", veiculoId);
  const ids = (autos ?? []).map((a: { despesa_id: string }) => a.despesa_id);
  if (!ids.length) return [];

  const now = new Date().toISOString();
  await client.from("veiculo_despesas").update({
    deleted_at: now,
    deleted_by: "comissao_auto_estorno",
  }).eq("user_id", userId).in("id", ids);

  await client.from("gestao_comissao_auto").delete()
    .eq("user_id", userId)
    .eq("veiculo_id", veiculoId);

  return ids;
}

export async function applyGestaoComissaoSync(
  client: Db,
  input: GestaoComissaoSyncInput,
): Promise<{ comissaoTotal: number; lancamentos: number }> {
  await estornarComissaoAuto(client, input.userId, input.veiculoId);
  const plan = planGestaoComissaoSync(input);
  let total = 0;

  for (const l of plan.lancamentos) {
    const { data: desp, error } = await client.from("veiculo_despesas").insert({
      user_id: input.userId,
      veiculo_id: input.veiculoId,
      valor: l.valor,
      data: input.dataDespesa,
      categoria: "comissao",
      descricao: l.descricao,
      origem_lancamento: "automatica",
      lancado_por: "sistema",
    }).select("id").single();
    if (error) throw new Error(error.message);

    await client.from("gestao_comissao_auto").insert({
      user_id: input.userId,
      veiculo_id: input.veiculoId,
      vendedor_id: l.vendedorId,
      despesa_id: desp.id,
      papel: l.papel,
      valor: l.valor,
    });
    total += l.valor;
  }

  return { comissaoTotal: total, lancamentos: plan.lancamentos.length };
}
