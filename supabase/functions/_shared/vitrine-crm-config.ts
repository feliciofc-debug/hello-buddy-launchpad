import { loadTenantVehicleStockGate } from "./vehicle-inventory-tenant.ts";

export type VitrineCrmTenantConfig = {
  usesVehicleStock: boolean;
  leadMornoAtivo: boolean;
  resumoDiarioAtivo: boolean;
  retomadaAtiva: boolean;
  resumoUltimoDiaSp: string | null;
};

export async function loadVitrineCrmTenantConfig(
  sb: { from: (t: string) => unknown },
  userId: string,
): Promise<VitrineCrmTenantConfig> {
  const gate = await loadTenantVehicleStockGate(sb, userId);
  const client = sb as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (col: string, val: string) => {
          maybeSingle: () => Promise<{ data: Record<string, unknown> | null }>;
        };
      };
    };
  };
  const { data } = await client.from("empresa_config").select(
    "vitrine_lead_morno_ativo, vitrine_resumo_diario_ativo, vitrine_retomada_ativa, vitrine_resumo_ultimo_dia_sp",
  ).eq("user_id", userId).maybeSingle();
  return {
    usesVehicleStock: gate.usesVehicleStock,
    leadMornoAtivo: data?.vitrine_lead_morno_ativo !== false,
    resumoDiarioAtivo: data?.vitrine_resumo_diario_ativo !== false,
    retomadaAtiva: data?.vitrine_retomada_ativa === true,
    resumoUltimoDiaSp: data?.vitrine_resumo_ultimo_dia_sp
      ? String(data.vitrine_resumo_ultimo_dia_sp)
      : null,
  };
}
