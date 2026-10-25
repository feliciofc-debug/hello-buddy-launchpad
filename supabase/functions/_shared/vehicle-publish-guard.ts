type VehiclePublishReference = {
  item_tipo?: string | null;
  veiculo_id?: string | null;
  user_id?: string | null;
};

type VehicleRowLookup = {
  data: {
    id: string;
    user_id: string;
    status: string;
  } | null;
  error: { message?: string } | null;
};

type VehicleFilterBuilder = {
  eq: (column: string, value: string) => VehicleFilterBuilder;
  maybeSingle: () => PromiseLike<VehicleRowLookup>;
};

type VehicleLookupClient = {
  from: (table: string) => {
    select: (columns: string) => VehicleFilterBuilder;
  };
};

export async function fetchOwnedVehicleRow<T extends Record<string, unknown>>(
  supabaseClient: unknown,
  veiculoId: string,
  ownerUserId: string,
  selectColumns: string,
): Promise<{ data: T | null; errorMessage: string | null }> {
  const supabase = supabaseClient as VehicleLookupClient;
  const { data, error } = await supabase
    .from("veiculos_estoque")
    .select(selectColumns)
    .eq("id", veiculoId)
    .eq("user_id", ownerUserId)
    .maybeSingle() as {
      data: T | null;
      error: { message?: string } | null;
    };

  if (error) {
    return {
      data: null,
      errorMessage: error.message || "erro desconhecido",
    };
  }
  return { data, errorMessage: null };
}

export async function assertVehicleCanPublish(
  supabaseClient: unknown,
  reference: VehiclePublishReference,
): Promise<void> {
  if (reference.item_tipo !== "veiculo") return;
  if (!reference.veiculo_id || !reference.user_id) {
    throw new Error("Referência de veículo incompleta");
  }

  const supabase = supabaseClient as VehicleLookupClient;
  const { data: vehicle, error } = await supabase
    .from("veiculos_estoque")
    .select("id, user_id, status")
    .eq("id", reference.veiculo_id)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Não foi possível validar o veículo: ${error.message || "erro desconhecido"}`,
    );
  }
  if (!vehicle) throw new Error("Veículo removido; publicação cancelada");
  if (vehicle.user_id !== reference.user_id) {
    throw new Error("Veículo pertence a outro tenant; publicação bloqueada");
  }
  if (vehicle.status === "vendido") {
    throw new Error("Veículo vendido; publicação cancelada");
  }
  if (vehicle.status === "em_preparacao") {
    throw new Error(
      "Veículo em preparação; complete foto e preço e libere na vitrine antes de publicar",
    );
  }
}
