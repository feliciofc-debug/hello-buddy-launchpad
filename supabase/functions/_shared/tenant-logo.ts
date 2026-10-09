// ============================================================================
// Logo do tenant — MULTI-TENANT
// Cada tenant tem UMA logo ativa (tabela tenant_logos, escopada por user_id).
// Bucket PRIVADO tenant-logos, sempre em pasta {user_id}/...
// SEM FALLBACK: tenant sem logo => retorna null e NENHUMA logo é aplicada.
// Jamais usar a logo de outro tenant (nem a da conta admin).
// ============================================================================
import {
  type LogoBackground,
  type LogoVariant,
  logoVariantForBackground,
} from "./logo-variant.ts";
import {
  deriveLogoVariant,
  removeSolidLogoBackground,
} from "./logo-background.ts";

export interface TenantLogo {
  id: string;
  storage_path: string;
  file_name: string | null;
  mime_type: string | null;
  variant: LogoVariant;
  generated_automatically: boolean;
  background_warning: string | null;
}

const BUCKET = "tenant-logos";

export interface TenantLogoStorageLocation {
  bucket: string;
  path: string;
  lightBackgroundPath?: string;
  darkBackgroundPath?: string;
  videoPath?: string;
}

/** Logo ativa do tenant, ou null se ele não configurou (feature opcional). */
export async function getTenantLogo(
  sb: any,
  userId: string,
  variant: LogoVariant = "default",
): Promise<TenantLogo | null> {
  if (!userId) return null;
  const { data, error } = await sb
    .from("tenant_logos")
    .select(
      "id, storage_path, file_name, mime_type, variant, ativo, user_id, generated_automatically, background_warning",
    )
    .eq("user_id", userId)
    .eq("variant", variant)
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
    variant: (data.variant || "default") as LogoVariant,
    generated_automatically: data.generated_automatically === true,
    background_warning: data.background_warning ?? null,
  };
}

export async function getTenantLogoForBackground(
  sb: any,
  userId: string,
  background: LogoBackground,
  allowAutomaticallyGeneratedDark = true,
): Promise<TenantLogo | null> {
  const variantName = logoVariantForBackground(background);
  let variant = await getTenantLogo(
    sb,
    userId,
    variantName,
  );
  if (!variant) {
    const source = await getTenantLogo(sb, userId);
    if (source) {
      try {
        const { data, error } = await sb.storage.from(BUCKET).download(
          source.storage_path,
        );
        if (!error && data) {
          const derived = await deriveLogoVariant(
            new Uint8Array(await data.arrayBuffer()),
            variantName,
          );
          if (derived.generated) {
            const targetPath = `${userId}/${variantName}/${Date.now()}-${
              crypto.randomUUID().slice(0, 8)
            }-automatica.png`;
            const { error: uploadError } = await sb.storage.from(BUCKET).upload(
              targetPath,
              derived.bytes,
              { contentType: "image/png", upsert: false },
            );
            if (!uploadError) {
              const { error: insertError } = await sb.from("tenant_logos")
                .insert({
                  user_id: userId,
                  storage_path: targetPath,
                  file_name: source.file_name,
                  mime_type: "image/png",
                  variant: variantName,
                  ativo: true,
                  generated_automatically: true,
                  background_warning: null,
                });
              if (insertError) {
                await sb.storage.from(BUCKET).remove([targetPath]);
              }
              variant = await getTenantLogo(sb, userId, variantName);
            }
          }
        }
      } catch (error) {
        console.warn(
          `[tenant-logo] não gerou variante ${variantName}:`,
          error instanceof Error ? error.message : String(error),
        );
      }
    }
  }
  return (variant?.generated_automatically &&
      background === "dark" &&
      !allowAutomaticallyGeneratedDark
    ? null
    : variant) ??
    await getTenantLogo(sb, userId);
}

/** URL assinada de curta duração (bucket privado). null se não houver logo. */
export async function getTenantLogoSignedUrl(
  sb: any,
  userId: string,
  ttlSeconds = 60 * 10,
): Promise<string | null> {
  const logo = await getTenantLogo(sb, userId);
  if (!logo) return null;
  const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(
    logo.storage_path,
    ttlSeconds,
  );
  if (error) {
    console.error("[tenant-logo] signed url falhou:", error.message);
    return null;
  }
  return data?.signedUrl ?? null;
}

/**
 * Localização persistente da logo usada em renders assíncronos.
 * Prefere tenant_logos e aceita a logo legada do próprio tenant quando ela
 * também está no Storage. URLs externas não são repassadas ao worker.
 */
export async function getTenantLogoStorageLocation(
  sb: any,
  userId: string,
  background?: LogoBackground | "video",
): Promise<TenantLogoStorageLocation | null> {
  const logo = background === "video"
    ? await getTenantLogo(sb, userId, "video") ??
      await getTenantLogo(sb, userId)
    : background
    ? await getTenantLogoForBackground(sb, userId, background)
    : await getTenantLogo(sb, userId);
  if (logo) return { bucket: BUCKET, path: logo.storage_path };

  const { data, error } = await sb
    .from("profiles")
    .select("logo_reel_url")
    .eq("id", userId)
    .maybeSingle();
  const url = String(data?.logo_reel_url || "");
  if (error || !url || !url.includes(`/${userId}/`)) return null;
  const match = url.match(
    /\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+?)(?:\?|$)/,
  );
  if (!match) return null;
  return { bucket: match[1], path: decodeURIComponent(match[2]) };
}

/** Logo legada do próprio tenant (tela Configurações → Marca): profiles.logo_reel_url. */
async function getProfileLogoDataUrl(
  sb: any,
  userId: string,
): Promise<string | null> {
  if (!userId) return null;
  const { data, error } = await sb
    .from("profiles")
    .select("logo_reel_url")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data?.logo_reel_url) return null;
  // Isolamento: a URL precisa pertencer à pasta do próprio tenant.
  const url = String(data.logo_reel_url);
  if (!url.includes(`/${userId}/`)) {
    console.error(
      "[tenant-logo] logo_reel_url fora do escopo do tenant — ignorando",
    );
    return null;
  }
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const buf = new Uint8Array(await resp.arrayBuffer());
    let bin = "";
    const CHUNK = 8192;
    for (let i = 0; i < buf.length; i += CHUNK) {
      bin += String.fromCharCode(...buf.subarray(i, i + CHUNK));
    }
    const mime = resp.headers.get("content-type") || "image/png";
    return `data:${mime};base64,${btoa(bin)}`;
  } catch (e) {
    console.error(
      "[tenant-logo] fetch logo_reel_url falhou:",
      (e as Error).message,
    );
    return null;
  }
}

/**
 * Logo do tenant como data URL base64 — formato aceito como imagem de
 * REFERÊNCIA na geração de imagem. null quando o tenant não tem logo.
 * Fonte 1: tenant_logos (tela "Minha Marca"). Fonte 2 (fallback do MESMO
 * tenant): profiles.logo_reel_url (tela Configurações → Marca).
 */
export async function getTenantLogoDataUrl(
  sb: any,
  userId: string,
): Promise<string | null> {
  const logo = await getTenantLogo(sb, userId);
  if (!logo) return await getProfileLogoDataUrl(sb, userId);
  const { data, error } = await sb.storage.from(BUCKET).download(
    logo.storage_path,
  );
  if (error || !data) {
    console.error("[tenant-logo] download falhou:", error?.message);
    return await getProfileLogoDataUrl(sb, userId);
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

export async function getTenantLogoDataUrlForBackground(
  sb: any,
  userId: string,
  background: LogoBackground,
  allowAutomaticallyGeneratedDark = true,
): Promise<string | null> {
  const logo = await getTenantLogoForBackground(
    sb,
    userId,
    background,
    allowAutomaticallyGeneratedDark,
  );
  if (!logo) return await getProfileLogoDataUrl(sb, userId);
  const { data, error } = await sb.storage.from(BUCKET).download(
    logo.storage_path,
  );
  if (error || !data) return await getTenantLogoDataUrl(sb, userId);
  const bytes = new Uint8Array(await data.arrayBuffer());
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  }
  return `data:${logo.mime_type || (data as any)?.type || "image/png"};base64,${
    btoa(binary)
  }`;
}

/** Salva/substitui a logo ativa do tenant (usado pela tela e pelo agente). */
export async function setTenantLogo(
  sb: any,
  userId: string,
  params: {
    storagePath: string;
    fileName?: string | null;
    mimeType?: string | null;
    variant?: LogoVariant;
  },
): Promise<boolean> {
  if (!userId || !params.storagePath.startsWith(`${userId}/`)) return false;
  try {
    const variant = params.variant ?? "default";
    const anterior = await getTenantLogo(sb, userId, variant);
    const { data: source, error: downloadError } = await sb.storage
      .from(BUCKET)
      .download(params.storagePath);
    if (downloadError || !source) {
      throw downloadError ?? new Error("logo ausente");
    }
    const originalBytes = new Uint8Array(await source.arrayBuffer());
    const processed = await removeSolidLogoBackground(
      originalBytes,
      params.mimeType || (source as any)?.type || "application/octet-stream",
    );
    let storagePath = params.storagePath;
    if (processed.changed) {
      storagePath = `${userId}/${variant}/${Date.now()}-${
        crypto.randomUUID().slice(0, 8)
      }-sem-fundo.png`;
      const { error: uploadError } = await sb.storage.from(BUCKET).upload(
        storagePath,
        processed.bytes,
        { contentType: "image/png", upsert: false },
      );
      if (uploadError) throw uploadError;
    }

    await sb.from("tenant_logos").delete().eq("user_id", userId)
      .eq("variant", variant);
    const { error } = await sb.from("tenant_logos").insert({
      user_id: userId,
      storage_path: storagePath,
      file_name: params.fileName ?? null,
      mime_type: processed.changed ? "image/png" : params.mimeType ?? null,
      variant,
      ativo: true,
      generated_automatically: false,
      background_warning: processed.warning,
    });
    if (error) throw error;

    if (anterior?.storage_path && anterior.storage_path !== storagePath) {
      await sb.storage.from(BUCKET).remove([anterior.storage_path]);
    }
    if (storagePath !== params.storagePath) {
      await sb.storage.from(BUCKET).remove([params.storagePath]);
    }

    if (variant === "default" && !processed.warning) {
      for (
        const targetVariant of [
          "light_background",
          "dark_background",
          "video",
        ] as const
      ) {
        const existingVariant = await getTenantLogo(
          sb,
          userId,
          targetVariant,
        );
        if (!existingVariant || existingVariant.generated_automatically) {
          if (existingVariant?.storage_path) {
            await sb.from("tenant_logos").delete().eq("user_id", userId)
              .eq("variant", targetVariant);
            await sb.storage.from(BUCKET).remove([
              existingVariant.storage_path,
            ]);
          }
          const derived = await deriveLogoVariant(
            processed.bytes,
            targetVariant,
          );
          if (!derived.generated) continue;
          const targetPath = `${userId}/${targetVariant}/${Date.now()}-${
            crypto.randomUUID().slice(0, 8)
          }-automatica.png`;
          const { error: targetUploadError } = await sb.storage.from(BUCKET)
            .upload(targetPath, derived.bytes, {
              contentType: "image/png",
              upsert: false,
            });
          if (targetUploadError) throw targetUploadError;
          const { error: targetInsertError } = await sb.from("tenant_logos")
            .insert({
              user_id: userId,
              storage_path: targetPath,
              file_name: params.fileName ?? null,
              mime_type: "image/png",
              variant: targetVariant,
              ativo: true,
              generated_automatically: true,
              background_warning: null,
            });
          if (targetInsertError) throw targetInsertError;
        }
      }
    }
    return true;
  } catch (e) {
    console.error("[tenant-logo] setTenantLogo falhou:", (e as Error).message);
    return false;
  }
}

export const TENANT_LOGO_BUCKET = BUCKET;
