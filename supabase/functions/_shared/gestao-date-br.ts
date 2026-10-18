/** Datas de negócio da Gestão (fuso America/Sao_Paulo). Timestamps técnicos continuam ISO UTC. */

export const GESTAO_TZ = "America/Sao_Paulo";

export function formatYmdSaoPaulo(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: GESTAO_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function hojeSaoPaulo(): string {
  return formatYmdSaoPaulo(new Date());
}

export function competenciaFromYmdSaoPaulo(date: Date = new Date()): string {
  return formatYmdSaoPaulo(date).slice(0, 7);
}

export function ultimoDiaCompetencia(competencia: string): string {
  const parts = competencia.split("-");
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${parts[0]}-${parts[1]}-${String(days).padStart(2, "0")}`;
}

export function intervaloCompetencia(competencia: string): { start: string; end: string } {
  const [ys, ms] = competencia.split("-");
  return { start: `${ys}-${ms}-01`, end: ultimoDiaCompetencia(competencia) };
}

export function intervaloMesAtualSaoPaulo(now = new Date()): { start: string; end: string } {
  return intervaloCompetencia(competenciaFromYmdSaoPaulo(now));
}

/** Soma dias em calendário YYYY-MM-DD (sem deslocamento UTC). */
export function addDiasYmd(ymd: string, dias: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const t = Date.UTC(y, m - 1, d + dias);
  const dt = new Date(t);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}
