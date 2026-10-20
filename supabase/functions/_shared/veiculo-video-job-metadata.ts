export type VeiculoVideoJobMetadata = {
  library: "veiculo";
  tipo: "veiculo";
  veiculo_id: string;
};

export function isVeiculoVideoJobMetadata(
  metadata: unknown,
): metadata is VeiculoVideoJobMetadata {
  if (!metadata || typeof metadata !== "object") return false;
  const m = metadata as Record<string, unknown>;
  if (m.library === "veiculo") return true;
  if (m.tipo === "veiculo") return true;
  return false;
}

export function veiculoIdFromJobMetadata(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const id = (metadata as Record<string, unknown>).veiculo_id;
  return typeof id === "string" && id.trim().length > 0 ? id.trim() : null;
}

/** Aceita só library + veiculo_id do cliente; demais campos são ignorados. */
export function sanitizeVeiculoMetadataExtra(
  raw: unknown,
): VeiculoVideoJobMetadata | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.library !== "veiculo") return null;
  const veiculoId = typeof o.veiculo_id === "string" ? o.veiculo_id.trim() : "";
  if (!veiculoId) return null;
  return { library: "veiculo", tipo: "veiculo", veiculo_id: veiculoId };
}
