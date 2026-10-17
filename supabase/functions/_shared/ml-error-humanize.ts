export function humanizeMlApiError(payload: unknown): string {
  const p = payload as { message?: string; error?: string; cause?: unknown[] };
  const causes = Array.isArray(p?.cause) ? p.cause : [];
  const parts = causes.map((c) => {
    if (typeof c === "string") return c;
    const o = c as Record<string, unknown>;
    return String(o.message ?? o.code ?? JSON.stringify(o)).slice(0, 200);
  });
  if (parts.length) return parts.join("; ");
  return String(p?.message ?? p?.error ?? "Erro na API do Mercado Livre").slice(0, 500);
}
