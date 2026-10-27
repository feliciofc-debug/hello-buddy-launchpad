import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import type { CrlvParserResultado } from "./crlv-parser.ts";
import { auditGestaoDocumento } from "./gestao-cofre-upload.ts";
import {
  brazilianPlatesEquivalent,
  normalizeBrazilianPlate,
} from "./vehicle-plate.ts";

export type CrlvStockLink = {
  id: string;
  label: string;
};

export async function autoLinkCrlvToStock(
  sb: SupabaseClient,
  userId: string,
  documentoId: string,
  parser: CrlvParserResultado,
): Promise<CrlvStockLink | null> {
  const plate = normalizeBrazilianPlate(parser.veiculo.placa.valor);
  if (!plate) return null;
  const { data, error } = await sb.from("veiculos_estoque")
    .select("id,marca,modelo,versao,placa")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error("Falha ao procurar o veículo no estoque");
  const vehicle = (data ?? []).find((row: Record<string, unknown>) =>
    brazilianPlatesEquivalent(row.placa, plate)
  ) as Record<string, unknown> | undefined;
  if (!vehicle?.id) return null;
  const { error: linkError } = await sb.from("gestao_documento").update({
    veiculo_id: String(vehicle.id),
  }).eq("id", documentoId).eq("user_id", userId);
  if (linkError) throw new Error("Falha ao vincular o CRLV ao estoque");
  await auditGestaoDocumento(sb, documentoId, userId, "vincular_automatico", {
    veiculo_id: String(vehicle.id),
    origem: "whatsapp",
  });
  const label = `${String(vehicle.marca ?? "").trim()} ${
    String(vehicle.modelo ?? "").trim()
  } ${String(vehicle.versao ?? "").trim()}`.replace(/\s+/g, " ").trim();
  return {
    id: String(vehicle.id),
    label: label || "veículo do estoque",
  };
}

export function crlvWhatsappActionButtons(
  documentoId: string,
  linkedVehicleId?: string | null,
) {
  return {
    body: "O que você quer fazer com este CRLV?",
    buttons: linkedVehicleId
      ? [
        {
          id: `cofre_doc_desvincular:${documentoId}:${linkedVehicleId}`,
          title: "Desfazer vínculo",
        },
        { id: `cofre_doc_troca:${documentoId}`, title: "Usar na troca" },
        { id: `cofre_doc_guardar:${documentoId}`, title: "Só guardar" },
      ]
      : [
        {
          id: `cofre_doc_cadastrar:${documentoId}`,
          title: "Cadastrar estoque",
        },
        { id: `cofre_doc_troca:${documentoId}`, title: "Usar na troca" },
        { id: `cofre_doc_guardar:${documentoId}`, title: "Só guardar" },
      ],
  };
}
