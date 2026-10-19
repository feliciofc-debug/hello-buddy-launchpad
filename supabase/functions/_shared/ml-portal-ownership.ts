/**
 * INTEG-1 §10 — Nenhuma rotina ML/OLX da AMZ pode alterar, pausar ou remover anúncio
 * cujo id não esteja vinculado em veiculos_portais / olx_vehicle_listing do próprio user_id.
 */

export async function mlPortalRowForExternalId(
  sb: { from: (t: string) => unknown },
  userId: string,
  externalId: string,
): Promise<{ veiculo_id: string; external_id: string } | null> {
  const { data } = await (sb.from("veiculos_portais") as {
    select: (c: string) => {
      eq: (a: string, v: string) => {
        eq: (a: string, v: string) => {
          eq: (a: string, v: string) => {
            maybeSingle: () => Promise<{ data: { veiculo_id: string; external_id: string } | null }>;
          };
        };
      };
    };
  })
    .select("veiculo_id, external_id")
    .eq("user_id", userId)
    .eq("portal", "mercadolivre")
    .eq("external_id", externalId)
    .maybeSingle();
  return data ?? null;
}

export async function assertMlItemOwnedByAmz(
  sb: { from: (t: string) => unknown },
  userId: string,
  externalId: string,
): Promise<boolean> {
  const row = await mlPortalRowForExternalId(sb, userId, externalId);
  return !!row?.external_id;
}

export async function olxListingRowForVehicle(
  sb: { from: (t: string) => unknown },
  userId: string,
  veiculoId: string,
): Promise<{ olx_ad_ref: string; veiculo_id: string } | null> {
  const { data } = await (sb.from("olx_vehicle_listing") as {
    select: (c: string) => {
      eq: (a: string, v: string) => {
        eq: (a: string, v: string) => {
          maybeSingle: () => Promise<{ data: { olx_ad_ref: string; veiculo_id: string } | null }>;
        };
      };
    };
  })
    .select("olx_ad_ref, veiculo_id")
    .eq("user_id", userId)
    .eq("veiculo_id", veiculoId)
    .maybeSingle();
  return data ?? null;
}
