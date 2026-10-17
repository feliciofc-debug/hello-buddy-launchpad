import { supabase } from "@/integrations/supabase/client";
import type { GestaoContratoTipo } from "../../supabase/functions/_shared/gestao-contrato-template.ts";

export type GestaoContratoModelo = {
  id: string;
  tipo: GestaoContratoTipo;
  titulo: string;
  corpo: string;
  is_exemplo: boolean;
};

export type GestaoContratoRow = {
  id: string;
  veiculo_id: string | null;
  modelo_id: string | null;
  tipo: GestaoContratoTipo;
  status: string;
  titulo: string;
  corpo_renderizado: string;
  cliente_nome: string;
  cliente_cpf: string | null;
  cliente_endereco: string | null;
  cliente_email: string | null;
  cliente_telefone: string | null;
  zapsign_sign_url: string | null;
  created_at: string;
};

export async function loadContratoModelos(userId: string): Promise<GestaoContratoModelo[]> {
  const { data } = await supabase.from("gestao_contrato_modelo" as "veiculos_estoque")
    .select("id, tipo, titulo, corpo, is_exemplo")
    .eq("user_id", userId)
    .order("tipo");
  return (data ?? []) as GestaoContratoModelo[];
}

export async function saveContratoModelo(
  userId: string,
  row: { id?: string; tipo: GestaoContratoTipo; titulo: string; corpo: string },
): Promise<void> {
  if (row.id) {
    await supabase.from("gestao_contrato_modelo" as "veiculos_estoque").update({
      titulo: row.titulo,
      corpo: row.corpo,
      is_exemplo: false,
    }).eq("id", row.id).eq("user_id", userId);
    return;
  }
  await supabase.from("gestao_contrato_modelo" as "veiculos_estoque").insert({
    user_id: userId,
    tipo: row.tipo,
    titulo: row.titulo,
    corpo: row.corpo,
    is_exemplo: false,
  });
}

export async function loadContratos(userId: string, statusFilter?: string): Promise<GestaoContratoRow[]> {
  let q = supabase.from("gestao_contrato" as "veiculos_estoque")
    .select("id, veiculo_id, modelo_id, tipo, status, titulo, corpo_renderizado, cliente_nome, cliente_cpf, cliente_endereco, cliente_email, cliente_telefone, zapsign_sign_url, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (statusFilter && statusFilter !== "todos") {
    q = q.eq("status", statusFilter);
  }
  const { data } = await q;
  return (data ?? []) as GestaoContratoRow[];
}

export async function insertContrato(
  userId: string,
  row: Omit<GestaoContratoRow, "id" | "created_at" | "zapsign_sign_url"> & { corpo_renderizado: string },
): Promise<string> {
  const { data, error } = await supabase.from("gestao_contrato" as "veiculos_estoque").insert({
    user_id: userId,
    veiculo_id: row.veiculo_id,
    modelo_id: row.modelo_id,
    tipo: row.tipo,
    status: "rascunho",
    titulo: row.titulo,
    corpo_renderizado: row.corpo_renderizado,
    cliente_nome: row.cliente_nome,
    cliente_cpf: row.cliente_cpf,
    cliente_endereco: row.cliente_endereco,
    cliente_email: row.cliente_email,
    cliente_telefone: row.cliente_telefone,
  }).select("id").single();
  if (error || !data?.id) throw new Error(error?.message ?? "insert_failed");
  return String(data.id);
}
