export type MolicarProcedenciaServico = "debts" | "gravame" | "renajud";
export type MolicarProcedenciaRow = {
  id?: string;
  servico: MolicarProcedenciaServico;
  status: string;
  resultado: Record<string, unknown> | null;
  erro: string | null;
  created_at?: string;
};

const record = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v)
    ? v as Record<string, unknown>
    : {};

export function molicarProcedenciaResult(
  value: Record<string, unknown> | null,
): Record<string, unknown> {
  let current = record(value);
  for (const key of ["Result", "result", "Data", "data", "Response", "response"]) {
    const nested = record(current[key]);
    if (Object.keys(nested).length) {
      current = nested;
      break;
    }
  }
  return current;
}

export function normalizeMolicarProcedenciaRows(
  raw: unknown,
): MolicarProcedenciaRow[] {
  const envelope = record(raw);
  const source = Array.isArray(raw)
    ? raw
    : Array.isArray(envelope.records)
    ? envelope.records
    : Array.isArray(envelope.consultas)
    ? envelope.consultas
    : Array.isArray(envelope.data)
    ? envelope.data
    : [];
  return source.map((item) => {
    const row = record(item);
    const servicos = Array.isArray(row.servicos) ? row.servicos : [];
    const servico = String(
      servicos[0] ?? row.servico ?? row.service ?? row.tipo ?? "debts",
    ).toLowerCase();
    return {
      id: row.id == null ? undefined : String(row.id),
      servico: (["debts", "gravame", "renajud"].includes(servico)
        ? servico
        : "debts") as MolicarProcedenciaServico,
      status: String(row.status ?? row.state ?? "pending").toLowerCase(),
      resultado:
        Object.keys(record(row.resultado ?? row.result ?? row.dados)).length
          ? record(row.resultado ?? row.result ?? row.dados)
          : null,
      erro: row.erro || row.error || row.message
        ? String(row.erro ?? row.error ?? row.message)
        : null,
      created_at: row.solicitado_em == null && row.created_at == null
        ? undefined
        : String(row.solicitado_em ?? row.created_at),
    };
  });
}

export function molicarDebtTotal(rows: MolicarProcedenciaRow[]): number | null {
  const envelope = rows.find((r) => r.servico === "debts")?.resultado;
  if (!envelope) return null;
  const result = molicarProcedenciaResult(envelope);
  const debts = record(result.Debts ?? result.debts);
  const summary = record(debts.Summary ?? debts.summary);
  const direct = result.total ?? debts.Total ?? debts.total ?? summary.Total ??
    summary.total;
  const n = Number(direct);
  if (Number.isFinite(n)) return n;
  const values = ["Licensing", "Ipva", "Fines"].map((key) =>
    Number(summary[key] ?? summary[key.toLowerCase()] ?? 0)
  );
  return values.some((value) => value > 0)
    ? values.reduce((a, b) => a + b, 0)
    : null;
}
