import { placaFinalLabel } from "./gestao-lucro-calc.ts";
import { stripGestaoOpaqueTokens } from "./gestao-text-sanitize.ts";

export type GestaoVeiculoRow = {
  id: string;
  marca: string;
  modelo: string;
  versao?: string | null;
  ano_modelo?: number | null;
  cor?: string | null;
  placa?: string | null;
  status?: string;
  preco?: number | null;
};

function normalize(text: string): string {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(text: string): string[] {
  return normalize(text).split(" ").filter((t) => t.length >= 2);
}

export function formatGestaoVeiculoLabel(v: GestaoVeiculoRow): string {
  const parts = [v.marca, v.modelo, v.versao, v.ano_modelo?.toString()].filter(Boolean);
  const placa = placaFinalLabel(v.placa);
  if (placa) parts.push(`placa …${placa}`);
  if (v.cor) parts.push(v.cor);
  return parts.join(" · ");
}

export function rankGestaoVeiculoMatches(
  query: string,
  rows: GestaoVeiculoRow[],
): GestaoVeiculoRow[] {
  const q = normalize(query);
  if (!q) return [];

  const placaFinal = q.replace(/\s/g, "").slice(-4);
  const scored = rows.map((row) => {
    let score = 0;
    const blob = normalize(
      [row.marca, row.modelo, row.versao, row.cor, row.placa].filter(Boolean).join(" "),
    );
    for (const tok of tokens(query)) {
      if (blob.includes(tok)) score += 3;
    }
    const final = placaFinalLabel(row.placa);
    if (final && placaFinal.length === 4 && final.toLowerCase() === placaFinal) {
      score += 10;
    }
    if (normalize(`${row.marca} ${row.modelo}`) === q) score += 8;
    return { row, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((s) => s.row);
}

export function vehicleHintFromText(text: string): string {
  const t = normalize(stripGestaoOpaqueTokens(text));
  const semValor = t
    .replace(/\br\$\s*[\d.,]+/g, " ")
    .replace(/\b[\d.,]+\s*mil\b/g, " ")
    .replace(/\bmeio\s+milhao\b/g, " ")
    .replace(/\b\d+(?:[.,]\d+)?\b/g, " ");
  return semValor
    .replace(
      /\b(gastei|paguei|comprei|vendi|quanto|lucrei|lucro|despesas?|desfazer|ultimo|no|na|do|da|de|por|carro|veiculo)\b/g,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
}
