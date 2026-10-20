export async function assertVeiculoEstoqueOwnedByUser(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
  userId: string,
  veiculoId: string,
): Promise<boolean> {
  const id = String(veiculoId || "").trim();
  if (!id || !userId) return false;
  const { data, error } = await sb
    .from("veiculos_estoque")
    .select("id")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("[veiculo-estoque-owner] consulta falhou:", error.message);
    return false;
  }
  return !!data?.id;
}
