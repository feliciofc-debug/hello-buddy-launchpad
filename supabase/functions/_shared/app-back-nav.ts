/** Caminho interno seguro para botão voltar (?voltar= / state.from). */
export function resolveBackPath(
  voltarParam: string | null,
  stateFrom: unknown,
  fallback: string,
): string {
  const safe = (raw: string | null | undefined): string | null => {
    if (!raw || typeof raw !== "string") return null;
    const t = raw.trim();
    if (!t.startsWith("/") || t.startsWith("//") || t.includes("://")) return null;
    return t;
  };
  const fromParam = safe(voltarParam);
  if (fromParam) return fromParam;
  const fromState = typeof stateFrom === "string" ? safe(stateFrom) : null;
  if (fromState) return fromState;
  return fallback;
}
