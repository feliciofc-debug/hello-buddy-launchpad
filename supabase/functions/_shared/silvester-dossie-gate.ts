export async function silvesterDossieEnabledForTenant(
  sb: {
    from: (table: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          maybeSingle: () => Promise<{ data: { silvester_dossie_ativo?: boolean } | null }>;
        };
      };
    };
  },
  userId: string,
): Promise<boolean> {
  const { data } = await sb.from("empresa_config")
    .select("silvester_dossie_ativo")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.silvester_dossie_ativo === true;
}

export function shouldFireSilvesterExtractHook(input: {
  inboundFromOwner: boolean;
  tenantOwnerPhone: string | null | undefined;
  silvesterEnabled: boolean;
}): boolean {
  return !input.inboundFromOwner &&
    !!input.tenantOwnerPhone &&
    input.silvesterEnabled;
}
