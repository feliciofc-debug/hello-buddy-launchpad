// ============================================================
// TEXTO COMPLETO — regra única de "nunca vai ao ar frase cortada".
//
// Módulo leve de propósito (sem supabase, sem IA): qualquer função de
// publicação pode importá-lo para validar legenda, roteiro ou campanha.
//
// Regras:
//  - nunca reticências, nunca palavra partida;
//  - se precisar encurtar, corta em frase/oração completa;
//  - texto suspeito BLOQUEIA a publicação (quem chama decide a mensagem).
// ============================================================

/** Vírgula/conjunção órfã que sobra depois de qualquer limpeza. */
export const arrumarPontuacao = (t: string) =>
  t
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/,\s*(?=[,.;:!?])/g, "")
    .replace(/^[\s,;:—–-]+/, "")
    .replace(/\s+(e|ou|com|para|de|da|do|em|no|na)\s*$/i, "")
    .replace(/[\s,;:]+$/, "")
    .trim();

/**
 * Ajusta o texto ao limite SEM deixar frase pela metade:
 * 1) mantém as frases completas que couberem;
 * 2) senão descarta a última oração (vírgula/conjunção) e fecha com ponto;
 * 3) último recurso: corta em limite de palavra.
 */
export const cortarFrase = (s: string, max: number): string => {
  const t = arrumarPontuacao(String(s ?? "").replace(/\s+/g, " ").trim()).replace(/…|\.\.\./g, "");
  if (t.length <= max) return t;

  const frases = t.split(/(?<=[.!?])\s+/);
  if (frases.length > 1) {
    let acc = "";
    for (const f of frases) {
      const teste = acc ? `${acc} ${f}` : f;
      if (teste.length > max) break;
      acc = teste;
    }
    if (acc) return arrumarPontuacao(acc);
  }

  const parcial = t.slice(0, max);
  const corte = Math.max(
    parcial.lastIndexOf(","),
    parcial.lastIndexOf(";"),
    parcial.lastIndexOf(" e "),
    parcial.lastIndexOf(" com "),
    parcial.lastIndexOf(" para "),
    parcial.lastIndexOf(" que "),
    parcial.lastIndexOf(" sem "),
  );
  const oracao = corte > max * 0.5 ? arrumarPontuacao(parcial.slice(0, corte)) : "";
  const base = oracao ||
    arrumarPontuacao(parcial.slice(0, Math.max(0, parcial.lastIndexOf(" "))) || parcial);
  const fechado = /[.!?]$/.test(base) || base.length < 18 ? base : `${base}.`;
  return fechado.length <= max ? fechado : base.slice(0, max);
};

/** Motivo pelo qual o texto NÃO pode ir ao ar, ou null quando está íntegro. */
export const textoIncompleto = (s: unknown): string | null => {
  const t = String(s ?? "").trim();
  if (!t) return null;
  if (/(…|\.\.\.)\s*$/.test(t)) return "termina em reticências";
  if (/[\s,;:]$/.test(t)) return "termina em vírgula ou sinal solto";
  if (/,\s*,|\s,/.test(t)) return "vírgula solta no meio";
  if (/\b(e|ou|com|para|de|da|do|em|no|na|que|sem)$/i.test(t)) return "frase interrompida";
  if (/\{\{|\}\}|\[\s*\]/.test(t)) return "placeholder não preenchido";
  return null;
};
