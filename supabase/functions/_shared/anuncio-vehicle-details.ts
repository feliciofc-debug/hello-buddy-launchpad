export type VehicleAdDetails = {
  versao?: unknown;
  motor?: unknown;
  cambio?: unknown;
  quilometragem?: unknown;
  cor?: unknown;
  donos?: unknown;
  documentacao?: unknown;
  revisoes?: unknown;
  pneus?: unknown;
  opcionais?: unknown;
  condicoes?: unknown;
  itens?: unknown;
};

export type VehicleAdContent = {
  subtitle: string | null;
  highlights: string[];
  ficha: string[];
};

function values(value: unknown): string[] {
  const source = Array.isArray(value) ? value : value == null ? [] : [value];
  return source
    .flatMap((item) => String(item || "").split(","))
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function unique(items: string[]): string[] {
  const keys = new Set<string>();
  return items.filter((item) => {
    const key = item.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase().replace(/[^a-z0-9]+/g, "");
    if (!key || keys.has(key)) return false;
    keys.add(key);
    return true;
  });
}

export function buildVehicleAdContent(
  details: VehicleAdDetails,
): VehicleAdContent {
  const versao = values(details.versao);
  const motor = values(details.motor);
  const prioritized = [
    ...values(details.quilometragem),
    ...values(details.cambio),
    ...motor,
    ...values(details.donos),
    ...values(details.documentacao),
    ...values(details.revisoes),
    ...values(details.opcionais),
    ...values(details.condicoes),
    ...values(details.itens),
  ];
  const secondary = [
    ...values(details.cor),
    ...values(details.pneus),
  ];
  const all = unique([...prioritized, ...secondary]);
  const highlights: string[] = [];
  for (const item of prioritized) {
    if (highlights.length >= 8) break;
    if (item.length > 26) continue;
    if (!all.includes(item) || highlights.includes(item)) continue;
    highlights.push(item);
  }
  const ficha = all
    .filter((item) => !highlights.includes(item))
    .map((item) => item.toUpperCase());
  return {
    subtitle: unique([...versao, ...motor]).join(" • ") || null,
    highlights,
    ficha,
  };
}
