const STALE_MS = 10 * 60 * 1000;

export type JobRetrySnapshot = {
  status: string;
  claimed_at?: string | null;
  progresso_atualizado_em?: string | null;
  created_at?: string | null;
};

export function heartbeatMs(job: JobRetrySnapshot): number {
  const t = job.progresso_atualizado_em || job.claimed_at || job.created_at;
  return t ? new Date(t).getTime() : 0;
}

export function jobMotionStale(job: JobRetrySnapshot, nowMs = Date.now()): boolean {
  const hb = heartbeatMs(job);
  if (!hb) return false;
  return nowMs - hb > STALE_MS;
}

export function jobPermiteRetry(job: JobRetrySnapshot, nowMs = Date.now()): boolean {
  const st = String(job.status ?? "").toLowerCase();
  if (st === "falha" || st === "falha_definitiva") return true;
  if (st === "pendente" || st === "processando") return jobMotionStale(job, nowMs);
  return false;
}

export function jobAindaAtivo(job: JobRetrySnapshot, nowMs = Date.now()): boolean {
  const st = String(job.status ?? "").toLowerCase();
  if (st !== "pendente" && st !== "processando") return false;
  return !jobMotionStale(job, nowMs);
}

/** Antes de inserir job novo, cancelar o antigo se ainda estiver na fila/VPS. */
export function retryDeveMarcarAntigoComoSubstituido(job: JobRetrySnapshot): boolean {
  const st = String(job.status ?? "").toLowerCase();
  return st === "pendente" || st === "processando";
}
