import { supabase } from "@/integrations/supabase/client";
import {
  parseGestaoTrocaIaAnaliseRow,
  parseGestaoTrocaIaItemRow,
  type GestaoTrocaIaAnalise,
  type GestaoTrocaIaCustoRow,
  type GestaoTrocaIaItem,
} from "@/lib/gestao-troca-ia-types.ts";

export async function fetchLatestGestaoTrocaLaudo(
  trocaId: string,
): Promise<{ analise: GestaoTrocaIaAnalise | null; itens: GestaoTrocaIaItem[] }> {
  const { data: analise } = await supabase
    .from("gestao_troca_analise_ia" as "veiculos_estoque")
    .select("*")
    .eq("troca_id", trocaId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!analise) return { analise: null, itens: [] };
  const parsed = parseGestaoTrocaIaAnaliseRow(analise as Record<string, unknown>);
  const { data: itens } = await supabase
    .from("gestao_troca_ia_item" as "veiculos_estoque")
    .select("*")
    .eq("analise_id", parsed.id)
    .order("ordem", { ascending: true });
  return {
    analise: parsed,
    itens: (itens ?? []).map((r) => parseGestaoTrocaIaItemRow(r as Record<string, unknown>)),
  };
}

async function loadGestaoTrocaAnaliseById(analiseId: string): Promise<{
  analise: GestaoTrocaIaAnalise | null;
  itens: GestaoTrocaIaItem[];
}> {
  const { data: analise } = await supabase
    .from("gestao_troca_analise_ia" as "veiculos_estoque")
    .select("*")
    .eq("id", analiseId)
    .maybeSingle();
  if (!analise) return { analise: null, itens: [] };
  const parsed = parseGestaoTrocaIaAnaliseRow(analise as Record<string, unknown>);
  const { data: itens } = await supabase
    .from("gestao_troca_ia_item" as "veiculos_estoque")
    .select("*")
    .eq("analise_id", analiseId)
    .order("ordem", { ascending: true });
  return {
    analise: parsed,
    itens: (itens ?? []).map((r) => parseGestaoTrocaIaItemRow(r as Record<string, unknown>)),
  };
}

export async function invokeGestaoTrocaStatusAnalise(
  analiseId: string,
): Promise<{
  analise: GestaoTrocaIaAnalise | null;
  itens: GestaoTrocaIaItem[];
  error?: string;
  notFound?: boolean;
}> {
  const { data, error } = await supabase.functions.invoke("gestao-troca", {
    body: { action: "status_analise", analise_id: analiseId },
  });
  if (error) {
    return { analise: null, itens: [], error: error.message };
  }
  if (data?.success === false) {
    return {
      analise: null,
      itens: [],
      error: String(data.error ?? "Falha ao consultar análise."),
      notFound: /não encontrada/i.test(String(data.error ?? "")),
    };
  }
  if (data?.success) {
    const analise = data.analise
      ? parseGestaoTrocaIaAnaliseRow(data.analise as Record<string, unknown>)
      : null;
    const itens = Array.isArray(data.itens)
      ? data.itens.map((r: Record<string, unknown>) => parseGestaoTrocaIaItemRow(r))
      : [];
    return { analise, itens };
  }
  return loadGestaoTrocaAnaliseById(analiseId);
}

export async function invokeGestaoTrocaStatusAnalisePorTroca(trocaId: string): Promise<{
  analise: GestaoTrocaIaAnalise | null;
  itens: GestaoTrocaIaItem[];
  error?: string;
}> {
  const { data, error } = await supabase.functions.invoke("gestao-troca", {
    body: { action: "status_analise", troca_id: trocaId },
  });
  if (error || data?.success === false) {
    return {
      analise: null,
      itens: [],
      error: data?.error ?? error?.message ?? "Falha ao consultar análise.",
    };
  }
  const analise = data.analise
    ? parseGestaoTrocaIaAnaliseRow(data.analise as Record<string, unknown>)
    : null;
  const itens = Array.isArray(data.itens)
    ? data.itens.map((r: Record<string, unknown>) => parseGestaoTrocaIaItemRow(r))
    : [];
  return { analise, itens };
}

export async function invokeGestaoTrocaAnalisarFotos(trocaId: string): Promise<{
  analise_id?: string;
  error?: string;
}> {
  const { data, error } = await supabase.functions.invoke("gestao-troca", {
    body: { action: "analisar_fotos", troca_id: trocaId },
  });
  if (error || !data?.success) {
    return { error: data?.error ?? error?.message ?? "Não foi possível iniciar a análise." };
  }
  return { analise_id: String(data.analise_id ?? "") };
}

export async function invokeGestaoTrocaDecidirItemIa(input: {
  item_id: string;
  decisao: "confirmado" | "descartado";
  valor_final?: number | null;
}): Promise<{ success: boolean; error?: string; preparacao_estimada?: number }> {
  const { data, error } = await supabase.functions.invoke("gestao-troca", {
    body: {
      action: "decidir_item_ia",
      item_id: input.item_id,
      decisao: input.decisao,
      valor_final: input.valor_final ?? undefined,
    },
  });
  if (error || !data?.success) {
    return { success: false, error: data?.error ?? error?.message ?? "Falha ao registrar decisão." };
  }
  return { success: true, preparacao_estimada: data.preparacao_estimada };
}

export async function invokeGestaoTrocaConfirmarKm(trocaId: string): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await supabase.functions.invoke("gestao-troca", {
    body: { action: "confirmar_km", troca_id: trocaId },
  });
  if (error || !data?.success) {
    return { success: false, error: data?.error ?? error?.message ?? "Falha ao confirmar KM." };
  }
  return { success: true };
}

export async function invokeGestaoTrocaCustosListar(): Promise<{
  custos: GestaoTrocaIaCustoRow[];
  error?: string;
}> {
  const { data, error } = await supabase.functions.invoke("gestao-troca", {
    body: { action: "custos_listar" },
  });
  if (error || !data?.success) {
    return { custos: [], error: data?.error ?? error?.message ?? "Falha ao listar custos." };
  }
  const custos = Array.isArray(data.custos)
    ? data.custos.map((r: Record<string, unknown>) => ({
      categoria: String(r.categoria),
      gravidade: String(r.gravidade),
      valor: Number(r.valor),
    }))
    : [];
  return { custos };
}

export async function invokeGestaoTrocaCustosSalvar(
  custos: GestaoTrocaIaCustoRow[],
): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await supabase.functions.invoke("gestao-troca", {
    body: { action: "custos_salvar", custos },
  });
  if (error || !data?.success) {
    return { success: false, error: data?.error ?? error?.message ?? "Falha ao salvar custos." };
  }
  return { success: true };
}
