export function hashExtratoDedupe(data: string, descricao: string, valor: number, sentido: string): string {
  const norm = `${data}|${sentido}|${valor.toFixed(2)}|${descricao.trim().toLowerCase().slice(0, 120)}`;
  return norm;
}

export function dedupeKeyFromFitid(userId: string, fitid: string): string {
  return `fitid:${userId}:${fitid}`;
}

export function dedupeKeyFromHash(userId: string, hash: string): string {
  return `hash:${userId}:${hash}`;
}
