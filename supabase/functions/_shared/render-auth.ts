// Autenticação do worker de render (VPS) → plataforma.
// O worker envia o token em header; nenhuma porta é exposta na VPS.

export const renderCors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-render-token",
};

/** Comparação em tempo constante (evita timing attack no token). */
function comparaSeguro(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Valida o header `x-render-token` contra o secret VPS_RENDER_TOKEN. */
export function autorizarWorker(req: Request): { ok: boolean; motivo?: string } {
  const esperado = Deno.env.get("VPS_RENDER_TOKEN");
  if (!esperado) return { ok: false, motivo: "VPS_RENDER_TOKEN não configurado" };

  const recebido =
    req.headers.get("x-render-token") ||
    (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");

  if (!recebido || !comparaSeguro(recebido, esperado)) {
    return { ok: false, motivo: "token inválido" };
  }
  return { ok: true };
}

export function respJson(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...renderCors, "Content-Type": "application/json" },
  });
}
