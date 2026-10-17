export async function hashGestaoContadorToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function generateGestaoContadorToken(): string {
  return crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
}

export const GESTAO_CONTADOR_AVISO =
  "Documento gerencial — a apuração fiscal deve ser validada pelo contador.";

export const GESTAO_CONTADOR_TOKEN_TTL_DAYS = 14;
