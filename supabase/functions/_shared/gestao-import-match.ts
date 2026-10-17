export type GestaoImportVehicleRef = {
  id: string;
  placa: string | null;
  codigo_origem: string | null;
  marca: string;
  modelo: string;
  ano_modelo: number | null;
  ano_fabricacao: number | null;
};

export type GestaoImportRow = {
  placa?: string | null;
  codigo?: string | null;
  marca?: string | null;
  modelo?: string | null;
  ano?: number | null;
};

function normPlaca(p: string | null | undefined): string {
  return (p ?? "").replace(/\W/g, "").toUpperCase();
}

function normText(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

export function matchGestaoImportRow(
  row: GestaoImportRow,
  vehicles: GestaoImportVehicleRef[],
): GestaoImportVehicleRef | null {
  const placa = normPlaca(row.placa);
  if (placa.length >= 7) {
    const hit = vehicles.find((v) => normPlaca(v.placa) === placa);
    if (hit) return hit;
  }

  const codigo = normText(row.codigo);
  if (codigo) {
    const hit = vehicles.find((v) => normText(v.codigo_origem) === codigo);
    if (hit) return hit;
  }

  const marca = normText(row.marca);
  const modelo = normText(row.modelo);
  const ano = row.ano ?? null;
  if (marca && modelo) {
    const candidates = vehicles.filter((v) =>
      normText(v.marca) === marca && normText(v.modelo) === modelo
    );
    if (candidates.length === 1) return candidates[0];
    if (ano != null && candidates.length > 1) {
      const byAno = candidates.filter((v) =>
        v.ano_modelo === ano || v.ano_fabricacao === ano
      );
      if (byAno.length === 1) return byAno[0];
    }
  }

  return null;
}
