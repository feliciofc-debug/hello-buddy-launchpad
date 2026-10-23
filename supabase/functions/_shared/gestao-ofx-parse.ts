import { hojeSaoPaulo } from "./gestao-date-br.ts";
export type GestaoExtratoLinha = {
  data: string;
  descricao: string;
  valor: number;
  sentido: "debito" | "credito";
  fitid: string | null;
};

function parseOfxDate(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length < 8) return hojeSaoPaulo();
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

/** Parser tolerante a OFX 1.x SGML (comum em bancos BR). */
export function parseGestaoOfx(content: string): GestaoExtratoLinha[] {
  const text = content.replace(/\r/g, "");
  const blocks = text.split(/<STMTTRN>/i).slice(1);
  const out: GestaoExtratoLinha[] = [];

  for (const block of blocks) {
    const chunk = block.split(/<\/STMTTRN>/i)[0] ?? block;
    const tag = (name: string) => {
      const m = chunk.match(new RegExp(`<${name}>([^<\\n]+)`, "i"));
      return m?.[1]?.trim() ?? "";
    };
    const trnamt = Number(tag("TRNAMT").replace(",", "."));
    if (!Number.isFinite(trnamt) || trnamt === 0) continue;
    const sentido = trnamt < 0 ? "debito" : "credito";
    const valor = Math.abs(trnamt);
    const descricao = tag("MEMO") || tag("NAME") || tag("CHECKNUM") || "Transação";
    out.push({
      data: parseOfxDate(tag("DTPOSTED") || tag("DTUSER")),
      descricao,
      valor: Math.round(valor * 100) / 100,
      sentido,
      fitid: tag("FITID") || null,
    });
  }
  return out;
}
