// ============================================================================
// Logo do tenant — MULTI-TENANT
// Cada tenant tem UMA logo ativa (tabela tenant_logos, escopada por user_id).
// Bucket PRIVADO tenant-logos, sempre em pasta {user_id}/...
// SEM FALLBACK: tenant sem logo => retorna null e NENHUMA logo é aplicada.
// Jamais usar a logo de outro tenant (nem a da conta admin).
// ============================================================================

export interface TenantLogo {
  id: string;
  storage_path: string;
  file_name: string | null;
  mime_type: string | null;
}

const BUCKET = "tenant-logos";

/** Logo ativa do tenant, ou null se ele não configurou (feature opcional). */
export async function getTenantLogo(sb: any, userId: string): Promise<TenantLogo | null> {
  if (!userId) return null;
  const { data, error } = await sb
    .from("tenant_logos")
    .select("id, storage_path, file_name, mime_type, ativo, user_id")
    .eq("user_id", userId)
    .eq("ativo", true)
    .maybeSingle();

  if (error) {
    console.error("[tenant-logo] erro ao buscar logo:", error.message);
    return null;
  }
  if (!data?.storage_path) return null;
  // Trava extra de isolamento: o path SEMPRE começa com o user_id do tenant.
  if (!String(data.storage_path).startsWith(`${userId}/`)) {
    console.error("[tenant-logo] path fora do escopo do tenant — ignorando");
    return null;
  }
  return {
    id: data.id,
    storage_path: data.storage_path,
    file_name: data.file_name ?? null,
    mime_type: data.mime_type ?? null,
  };
}

/** URL assinada de curta duração (bucket privado). null se não houver logo. */
export async function getTenantLogoSignedUrl(
  sb: any,
  userId: string,
  ttlSeconds = 60 * 10,
): Promise<string | null> {
  const logo = await getTenantLogo(sb, userId);
  if (!logo) return null;
  const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(logo.storage_path, ttlSeconds);
  if (error) {
    console.error("[tenant-logo] signed url falhou:", error.message);
    return null;
  }
  return data?.signedUrl ?? null;
}

/**
 * Logo do tenant como data URL base64 — formato aceito como imagem de
 * REFERÊNCIA na geração de imagem. null quando o tenant não tem logo.
 */
export async function getTenantLogoDataUrl(sb: any, userId: string): Promise<string | null> {
  const logo = await getTenantLogo(sb, userId);
  if (!logo) return null;
  const { data, error } = await sb.storage.from(BUCKET).download(logo.storage_path);
  if (error || !data) {
    console.error("[tenant-logo] download falhou:", error?.message);
    return null;
  }
  const buf = new Uint8Array(await data.arrayBuffer());
  let bin = "";
  const CHUNK = 8192;
  for (let i = 0; i < buf.length; i += CHUNK) {
    bin += String.fromCharCode(...buf.subarray(i, i + CHUNK));
  }
  const mime = logo.mime_type || (data as any)?.type || "image/png";
  return `data:${mime};base64,${btoa(bin)}`;
}

/** Salva/substitui a logo ativa do tenant (usado pela tela e pelo agente). */
export async function setTenantLogo(
  sb: any,
  userId: string,
  params: { storagePath: string; fileName?: string | null; mimeType?: string | null },
): Promise<boolean> {
  if (!userId || !params.storagePath.startsWith(`${userId}/`)) return false;
  try {
    const anterior = await getTenantLogo(sb, userId);

    await sb.from("tenant_logos").delete().eq("user_id", userId);
    const { error } = await sb.from("tenant_logos").insert({
      user_id: userId,
      storage_path: params.storagePath,
      file_name: params.fileName ?? null,
      mime_type: params.mimeType ?? null,
      ativo: true,
    });
    if (error) throw error;

    if (anterior?.storage_path && anterior.storage_path !== params.storagePath) {
      await sb.storage.from(BUCKET).remove([anterior.storage_path]);
    }
    return true;
  } catch (e) {
    console.error("[tenant-logo] setTenantLogo falhou:", (e as Error).message);
    return false;
  }
}

export const TENANT_LOGO_BUCKET = BUCKET;
