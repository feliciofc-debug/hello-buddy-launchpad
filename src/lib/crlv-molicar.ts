export type CrlvMolicarPrices = {
  referencia: number | null;
  b2c: number | null;
  b2b: number | null;
  c2c: number | null;
  c2b: number | null;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

const positiveNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export function normalizeCrlvMolicarResponse(raw: unknown): {
  completion: Record<string, string | number>;
  prices: CrlvMolicarPrices;
} {
  const row = asRecord(raw);
  const details = asRecord(row.dados);
  const prices = asRecord(row.precos);
  return {
    completion: Object.fromEntries(
      Object.entries({
        placa: String(row.placa ?? ""),
        chassi: String(row.vin ?? ""),
        marca: String(details.marca ?? ""),
        modelo: String(details.modelo ?? ""),
        versao: String(details.versao ?? ""),
        ano_fabricacao: positiveNumber(details.ano_fabricacao) ?? "",
        ano_modelo: positiveNumber(details.ano_modelo) ?? "",
        cor: String(details.cor ?? ""),
        combustivel: String(details.combustivel ?? ""),
        cilindrada_cc: positiveNumber(details.cilindrada_cc) ?? "",
      }).filter(([, value]) => value !== ""),
    ),
    prices: {
      referencia: positiveNumber(prices.referencia),
      b2c: positiveNumber(prices.b2c),
      b2b: positiveNumber(prices.b2b),
      c2c: positiveNumber(prices.c2c),
      c2b: positiveNumber(prices.c2b),
    },
  };
}

export function fillOnlyEmptyCrlvValues(
  current: Record<string, string | number>,
  completion: Record<string, string | number>,
): Record<string, string | number> {
  return {
    ...current,
    ...Object.fromEntries(
      Object.entries(completion).filter(([key]) =>
        current[key] == null || current[key] === ""
      ),
    ),
  };
}
