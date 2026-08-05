// ============================================================
// meta-media.ts — blindagem de MÍDIA para a Meta Cloud API.
//
// PROBLEMA (multi-tenant, todos os clientes):
// imagens de produto importadas de marketplaces (Shopee, etc.) vêm em .avif
// (ou .webp/.heic). A Meta Cloud API aceita SOMENTE image/jpeg e image/png.
// Resultado: a Meta responde 200 + wamid, mas a mensagem NUNCA é entregue.
//
// SOLUÇÃO: toda URL de imagem que não seja JPEG/PNG é reescrita para passar
// pelo nosso proxy `media-para-meta`, que baixa, converte para JPEG e serve
// (com cache em Storage). Nada de tocar produto por produto no catálogo.
// ============================================================

const SAFE_EXT = /\.(jpe?g|png)(\?|#|$)/i;
const UNSAFE_EXT = /\.(avif|webp|heic|heif|bmp|tiff?|gif)(\?|#|$)/i;

/** Detecta extensões que a Meta não entrega. */
export function isFormatoInseguroParaMeta(url: string): boolean {
  if (!url) return false;
  if (UNSAFE_EXT.test(url)) return true;
  // Sem extensão reconhecível → passa pelo proxy por segurança
  // (o proxy só converte de fato se o content-type não for jpeg/png).
  return !SAFE_EXT.test(url);
}

/**
 * Devolve uma URL que a Meta consegue baixar (JPEG/PNG).
 * Idempotente: URLs já em JPEG/PNG ou já proxiadas voltam iguais.
 */
export function toMetaSafeImageUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  const u = String(url).trim();
  if (!/^https?:\/\//i.test(u)) return u;
  if (u.includes("/functions/v1/media-para-meta")) return u; // já convertido
  if (!isFormatoInseguroParaMeta(u)) return u;

  const base = (Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
  if (!base) return u;
  return `${base}/functions/v1/media-para-meta?url=${encodeURIComponent(u)}`;
}
