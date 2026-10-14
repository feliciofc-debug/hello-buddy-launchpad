type VehiclePublishReference = {
  item_tipo?: string | null;
  veiculo_id?: string | null;
  user_id?: string | null;
};

type VehicleLookupClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => PromiseLike<{
          data: {
            id: string;
            user_id: string;
            status: string;
          } | null;
          error: { message?: string } | null;
        }>;
      };
    };
  };
};

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
}
