import { parseGestaoMoneyField } from "./gestao-money-parse.ts";

export type GestaoCsvColumnMap = {
  data: number;
  descricao: number;
  valor: number;
  /** Coluna opcional: 'debito' | 'credito' | número com sinal */
  debitoCredito?: number;
};

export function parseGestaoExtratoCsv(
  content: string,
  map: GestaoCsvColumnMap,
  delimiter = ";",
): Array<{
  data: string;
  descricao: string;
  valor: number;
  sentido: "debito" | "credito";
}> {
  const lines = content.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const out: ReturnType<typeof parseGestaoExtratoCsv> = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(delimiter);
    const rawData = cols[map.data]?.trim() ?? "";
    const data = normalizeCsvDate(rawData);
    const descricao = cols[map.descricao]?.trim() ?? "";
    let valor = parseGestaoMoneyField(cols[map.valor] ?? "") ?? 0;
    let sentido: "debito" | "credito" = valor < 0 ? "debito" : "credito";
    valor = Math.abs(valor);

    if (map.debitoCredito != null) {
      const dc = (cols[map.debitoCredito] ?? "").toLowerCase();
      if (dc.includes("deb") || dc === "d" || dc === "-") sentido = "debito";
      if (dc.includes("cred") || dc === "c" || dc === "+") sentido = "credito";
    }

    if (!data || valor <= 0) continue;
    out.push({ data, descricao, valor, sentido });
  }
  return out;
}

function normalizeCsvDate(raw: string): string {
  const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return "";
}
