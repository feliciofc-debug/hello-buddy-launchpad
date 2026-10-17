export function hashExtratoDedupe(data: string, descricao: string, valor: number, sentido: string): string {
  const norm = `${data}|${sentido}|${valor.toFixed(2)}|${descricao.trim().toLowerCase().slice(0, 120)}`;
  return norm;
}

export function dedupeKeyFromFitid(userId: string, fitid: string): string {
  return `fitid:${userId}:${fitid}`;
}

export function dedupeKeyFromHash(userId: string, hash: string, occurrence = 0): string {
  return `hash:${userId}:${hash}@${occurrence}`;
}

/** Numera ocorrências iguais dentro do mesmo arquivo (sem FITID). */
export function assignExtratoDedupeOccurrences<
  T extends { data: string; descricao: string; valor: number; sentido: string; fitid?: string | null },
>(linhas: T[]): Array<T & { dedupeOccurrence: number }> {
  const counts = new Map<string, number>();
  return linhas.map((l) => {
    const hash = hashExtratoDedupe(l.data, l.descricao, l.valor, l.sentido);
    const occurrence = counts.get(hash) ?? 0;
    counts.set(hash, occurrence + 1);
    return { ...l, dedupeOccurrence: occurrence };
  });
}
