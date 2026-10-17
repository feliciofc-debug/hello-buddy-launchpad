import type { GestaoComissaoRegraJson } from "../../supabase/functions/_shared/gestao-comissao-calc.ts";
import { DEFAULT_COMISSAO_REGRA, normalizeComissaoRegra } from "../../supabase/functions/_shared/gestao-comissao-calc.ts";
import type { GestaoMetaConfigJson } from "../../supabase/functions/_shared/gestao-meta-calc.ts";
import { competenciaFromDate } from "../../supabase/functions/_shared/gestao-meta-calc.ts";
import { supabase } from "@/integrations/supabase/client";

export type GestaoVendedor = {
  id: string;
  nome: string;
  whatsapp_e164: string | null;
  ativo: boolean;
  is_gerente: boolean;
};

export async function loadGestaoVendedores(userId: string): Promise<GestaoVendedor[]> {
  const { data } = await supabase.from("gestao_vendedores" as "veiculos_estoque")
    .select("id, nome, whatsapp_e164, ativo, is_gerente")
    .eq("user_id", userId)
    .order("nome");
  return (data ?? []) as GestaoVendedor[];
}

export async function loadComissaoRegra(
  userId: string,
  vendedorId: string | null,
): Promise<GestaoComissaoRegraJson> {
  const q = supabase.from("gestao_comissao_regra" as "veiculos_estoque")
    .select("regra_json")
    .eq("user_id", userId);
  const { data } = vendedorId
    ? await q.eq("vendedor_id", vendedorId).maybeSingle()
    : await q.is("vendedor_id", null).maybeSingle();
  const row = data as { regra_json?: GestaoComissaoRegraJson } | null;
  return normalizeComissaoRegra(row?.regra_json ?? DEFAULT_COMISSAO_REGRA);
}

export async function vendedorTemRegraPropria(
  userId: string,
  vendedorId: string,
): Promise<boolean> {
  const { data } = await supabase.from("gestao_comissao_regra" as "veiculos_estoque")
    .select("id")
    .eq("user_id", userId)
    .eq("vendedor_id", vendedorId)
    .maybeSingle();
  return !!data?.id;
}

export async function saveComissaoRegra(
  userId: string,
  vendedorId: string | null,
  regra: GestaoComissaoRegraJson,
): Promise<void> {
  const { data: existing } = vendedorId
    ? await supabase.from("gestao_comissao_regra" as "veiculos_estoque").select("id")
      .eq("user_id", userId).eq("vendedor_id", vendedorId).maybeSingle()
    : await supabase.from("gestao_comissao_regra" as "veiculos_estoque").select("id")
      .eq("user_id", userId).is("vendedor_id", null).maybeSingle();
  if (existing?.id) {
    await supabase.from("gestao_comissao_regra" as "veiculos_estoque").update({ regra_json: regra })
      .eq("id", existing.id);
  } else {
    await supabase.from("gestao_comissao_regra" as "veiculos_estoque").insert({
      user_id: userId,
      vendedor_id: vendedorId,
      regra_json: regra,
    });
  }
}

export async function loadMetaMensal(
  userId: string,
  competencia: string,
  vendedorId: string | null,
): Promise<GestaoMetaConfigJson | null> {
  const q = supabase.from("gestao_meta_mensal" as "veiculos_estoque")
    .select("config_json")
    .eq("user_id", userId)
    .eq("competencia", competencia);
  const { data } = vendedorId
    ? await q.eq("vendedor_id", vendedorId).maybeSingle()
    : await q.is("vendedor_id", null).maybeSingle();
  const row = data as { config_json?: GestaoMetaConfigJson } | null;
  return row?.config_json ?? null;
}

export async function saveMetaMensal(
  userId: string,
  competencia: string,
  vendedorId: string | null,
  config: GestaoMetaConfigJson,
): Promise<void> {
  const { data: existing } = vendedorId
    ? await supabase.from("gestao_meta_mensal" as "veiculos_estoque").select("id")
      .eq("user_id", userId).eq("competencia", competencia).eq("vendedor_id", vendedorId).maybeSingle()
    : await supabase.from("gestao_meta_mensal" as "veiculos_estoque").select("id")
      .eq("user_id", userId).eq("competencia", competencia).is("vendedor_id", null).maybeSingle();
  if (existing?.id) {
    await supabase.from("gestao_meta_mensal" as "veiculos_estoque").update({ config_json: config })
      .eq("id", existing.id);
  } else {
    await supabase.from("gestao_meta_mensal" as "veiculos_estoque").insert({
      user_id: userId,
      competencia,
      vendedor_id: vendedorId,
      config_json: config,
    });
  }
}

export async function loadComissaoAutoMes(
  userId: string,
  competencia: string,
): Promise<Map<string, number>> {
  const [y, m] = competencia.split("-").map(Number);
  const start = `${competencia}-01`;
  const end = new Date(y, m, 0).toISOString().slice(0, 10);
  const { data: vendas } = await supabase.from("veiculo_venda" as "veiculos_estoque")
    .select("veiculo_id, data_venda")
    .eq("user_id", userId)
    .gte("data_venda", start)
    .lte("data_venda", end);
  const ids = (vendas ?? []).map((v: { veiculo_id: string }) => v.veiculo_id);
  if (!ids.length) return new Map();

  const { data: autos } = await supabase.from("gestao_comissao_auto" as "veiculos_estoque")
    .select("vendedor_id, valor, veiculo_id")
    .eq("user_id", userId)
    .in("veiculo_id", ids);

  const map = new Map<string, number>();
  for (const a of autos ?? []) {
    const row = a as { vendedor_id: string; valor: number };
    map.set(row.vendedor_id, (map.get(row.vendedor_id) ?? 0) + Number(row.valor));
  }
  return map;
}

export { competenciaFromDate, DEFAULT_COMISSAO_REGRA };
