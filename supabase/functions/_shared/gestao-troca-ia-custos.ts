import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import type {
  GestaoTrocaIaCategoriaCusto,
  GestaoTrocaIaGravidade,
} from "./gestao-troca-ia-schema.ts";
import type { GestaoTrocaIaCustoRow } from "./gestao-troca-ia-rules.ts";

type Db = SupabaseClient;

export const GESTAO_TROCA_IA_CUSTOS_PADRAO: GestaoTrocaIaCustoRow[] = [
  { categoria: "funilaria_pintura", gravidade: "leve", valor: 350 },
  { categoria: "funilaria_pintura", gravidade: "moderada", valor: 900 },
  { categoria: "funilaria_pintura", gravidade: "grave", valor: 2800 },
  { categoria: "mecanica", gravidade: "leve", valor: 250 },
  { categoria: "mecanica", gravidade: "moderada", valor: 750 },
  { categoria: "mecanica", gravidade: "grave", valor: 3200 },
  { categoria: "pneus", gravidade: "leve", valor: 180 },
  { categoria: "pneus", gravidade: "moderada", valor: 450 },
  { categoria: "pneus", gravidade: "grave", valor: 1400 },
  { categoria: "estetica", gravidade: "leve", valor: 120 },
  { categoria: "estetica", gravidade: "moderada", valor: 380 },
  { categoria: "estetica", gravidade: "grave", valor: 950 },
  { categoria: "outros", gravidade: "leve", valor: 150 },
  { categoria: "outros", gravidade: "moderada", valor: 400 },
  { categoria: "outros", gravidade: "grave", valor: 1100 },
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
