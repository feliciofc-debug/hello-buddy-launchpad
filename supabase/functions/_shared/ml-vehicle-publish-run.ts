import {
  mlCreateItem,
  mlFetchCategoryAttributes,
  mlPickListingPackType,
  mlValidateItem,
  ML_LISTING_PACK_PREFERENCE_DEFAULT,
  type MlListingPackPreference,
} from "./ml-api.ts";
import { mapVehicleToMlItem, resolveMlCategoryId } from "./ml-map-vehicle.ts";
import { buildMlSellerContact } from "./ml-seller-contact.ts";
import type { VeiculoEstoqueRow } from "./ml-vehicle-types.ts";
import { mlFindPossibleDuplicateListings, type MlDuplicateCandidate } from "./ml-duplicate-check.ts";
import { getMlAccessTokenForUser } from "./ml-token.ts";

export async function runMlVehiclePublish(
  sb: any,
  input: { userId: string; veiculoId: string; confirm_duplicate?: boolean },
): Promise<{
  ok: boolean;
  external_id?: string;
  permalink?: string;
  error?: string;
  blocking?: unknown[];
  duplicate_warning?: boolean;
  duplicate_candidates?: MlDuplicateCandidate[];
}> {
  const { data: vehicle, error: vErr } = await sb.from("veiculos_estoque")
    .select("*")
    .eq("user_id", input.userId)
    .eq("id", input.veiculoId)
    .maybeSingle();
  if (vErr || !vehicle) return { ok: false, error: "Veículo não encontrado" };

  const { data: cfg } = await sb.from("empresa_config")
    .select("ml_location_json, ml_listing_pack_preference")
    .eq("user_id", input.userId)
    .maybeSingle();

  const sellerContact = await buildMlSellerContact(sb, input.userId);
  if (!sellerContact) {
    return { ok: false, error: "Cadastre o telefone/WhatsApp da loja no perfil." };
  }

  let accessToken: string;
  let mlUserId: number;
  try {
    const tok = await getMlAccessTokenForUser(sb, input.userId);
    accessToken = tok.accessToken;
    mlUserId = tok.mlUserId;
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const categoryId = await resolveMlCategoryId(accessToken, vehicle as VeiculoEstoqueRow);
  const packPref = (cfg?.ml_listing_pack_preference ?? ML_LISTING_PACK_PREFERENCE_DEFAULT) as MlListingPackPreference;
  const listingTypeId = await mlPickListingPackType(
    accessToken,
    mlUserId,
    categoryId,
    packPref,
  );
  if (!listingTypeId) {
    return {
      ok: false,
      error: "Sua conta ML não tem pacote de anúncios de veículos disponível (Clássico/Destaque).",
    };
  }

  const { data: ownedRows } = await sb.from("veiculos_portais")
    .select("external_id")
    .eq("user_id", input.userId)
    .eq("portal", "mercadolivre");
  const ownedIds = new Set(
    (ownedRows ?? []).map((r: { external_id: string }) => String(r.external_id)),
  );
  const duplicateCandidates = await mlFindPossibleDuplicateListings(
    accessToken,
    mlUserId,
    vehicle as VeiculoEstoqueRow,
    ownedIds,
  );
  if (duplicateCandidates.length && !input.confirm_duplicate) {
    return {
      ok: false,
      duplicate_warning: true,
      duplicate_candidates: duplicateCandidates,
      error:
        "Este carro pode já estar anunciado por outro sistema. Confirme para publicar mesmo assim.",
    };
  }

  const categoryAttributes = await mlFetchCategoryAttributes(accessToken, categoryId);
  const mapped = mapVehicleToMlItem({
    vehicle: vehicle as VeiculoEstoqueRow,
    categoryId,
    categoryAttributes,
    mlLocationJson: cfg?.ml_location_json,
    sellerContact,
    listingTypeId,
  });
  if (!mapped.ok) {
    return { ok: false, blocking: mapped.blocking, error: "Complete os campos obrigatórios." };
  }

  const validated = await mlValidateItem(accessToken, mapped.body);
  if (!validated.ok) {
    return { ok: false, error: validated.error ?? "Validação ML rejeitou o anúncio." };
  }

  const created = await mlCreateItem(accessToken, mapped.body);
  if (!created.ok || !created.item?.id) {
    return { ok: false, error: created.error ?? "Falha ao publicar" };
  }

  const external_id = String(created.item.id);
  const permalink = String(created.item.permalink ?? "");
  await sb.from("veiculos_portais").upsert({
    user_id: input.userId,
    veiculo_id: input.veiculoId,
    portal: "mercadolivre",
    external_id,
    permalink,
    category_id: categoryId,
    status: "published",
    last_error: null,
    last_synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,veiculo_id,portal" });

  return { ok: true, external_id, permalink };
}
