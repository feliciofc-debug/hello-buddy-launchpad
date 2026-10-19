import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import type {
  GestaoTrocaIaCategoriaCusto,
  GestaoTrocaIaGravidade,
} from "./gestao-troca-ia-schema.ts";
import type { GestaoTrocaIaCustoRow } from "./gestao-troca-ia-rules.ts";

type Db = SupabaseClient;

/** Tabela padrão inicial (editável por loja). */
export const GESTAO_TROCA_IA_CUSTOS_PADRAO: GestaoTrocaIaCustoRow[] = [
  { categoria: "risco", gravidade: "leve", valor: 300 },
  { categoria: "risco", gravidade: "moderada", valor: 600 },
  { categoria: "risco", gravidade: "grave", valor: 1000 },
  { categoria: "amassado", gravidade: "leve", valor: 500 },
  { categoria: "amassado", gravidade: "moderada", valor: 1200 },
  { categoria: "amassado", gravidade: "grave", valor: 2500 },
  { categoria: "pintura_divergente", gravidade: "leve", valor: 900 },
  { categoria: "pintura_divergente", gravidade: "moderada", valor: 1400 },
  { categoria: "pintura_divergente", gravidade: "grave", valor: 2000 },
  { categoria: "para_choque", gravidade: "leve", valor: 600 },
  { categoria: "para_choque", gravidade: "moderada", valor: 1500 },
  { categoria: "para_choque", gravidade: "grave", valor: 2800 },
  { categoria: "farol_lanterna", gravidade: "leve", valor: 400 },
  { categoria: "farol_lanterna", gravidade: "moderada", valor: 1200 },
  { categoria: "farol_lanterna", gravidade: "grave", valor: 3500 },
  { categoria: "pneu", gravidade: "leve", valor: 0 },
  { categoria: "pneu", gravidade: "moderada", valor: 900 },
  { categoria: "pneu", gravidade: "grave", valor: 1400 },
  { categoria: "vidro", gravidade: "leve", valor: 300 },
  { categoria: "vidro", gravidade: "moderada", valor: 900 },
  { categoria: "vidro", gravidade: "grave", valor: 2200 },
  { categoria: "interior", gravidade: "leve", valor: 300 },
  { categoria: "interior", gravidade: "moderada", valor: 800 },
  { categoria: "interior", gravidade: "grave", valor: 2000 },
  { categoria: "outro", gravidade: "leve", valor: 300 },
  { categoria: "outro", gravidade: "moderada", valor: 800 },
  { categoria: "outro", gravidade: "grave", valor: 1500 },
];

export async function ensureGestaoTrocaIaCustosSeeded(sb: Db, userId: string): Promise<void> {
  const { count } = await sb.from("gestao_troca_custo_reparo")
    .select("categoria", { count: "exact", head: true })
    .eq("user_id", userId);
  if ((count ?? 0) > 0) return;
  const now = new Date().toISOString();
  const rows = GESTAO_TROCA_IA_CUSTOS_PADRAO.map((r) => ({
    user_id: userId,
    categoria: r.categoria,
    gravidade: r.gravidade,
    valor: r.valor,
    updated_at: now,
  }));
  const { error } = await sb.from("gestao_troca_custo_reparo").insert(rows);
  if (error) throw new Error("Não foi possível inicializar custos de reparo.");
}

export async function listGestaoTrocaIaCustos(
  sb: Db,
  userId: string,
): Promise<GestaoTrocaIaCustoRow[]> {
  await ensureGestaoTrocaIaCustosSeeded(sb, userId);
  const { data, error } = await sb.from("gestao_troca_custo_reparo")
    .select("categoria, gravidade, valor")
    .eq("user_id", userId)
    .order("categoria")
    .order("gravidade");
  if (error) throw new Error("Não foi possível listar custos.");
  return (data ?? []).map((r: { categoria: string; gravidade: string; valor: number }) => ({
    categoria: r.categoria as GestaoTrocaIaCategoriaCusto,
    gravidade: r.gravidade as GestaoTrocaIaGravidade,
    valor: Number(r.valor),
  }));
}

export async function saveGestaoTrocaIaCustos(
  sb: Db,
  userId: string,
  rows: GestaoTrocaIaCustoRow[],
): Promise<void> {
  const now = new Date().toISOString();
  for (const r of rows) {
    if (!Number.isFinite(r.valor) || r.valor < 0) {
      throw new Error("Valor de custo inválido.");
    }
    const { error } = await sb.from("gestao_troca_custo_reparo").upsert({
      user_id: userId,
      categoria: r.categoria,
      gravidade: r.gravidade,
      valor: Math.round(r.valor * 100) / 100,
      updated_at: now,
    }, { onConflict: "user_id,categoria,gravidade" });
    if (error) throw new Error("Não foi possível salvar custos.");
  }
}
