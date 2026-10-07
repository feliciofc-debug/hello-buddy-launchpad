import {
  deriveLogoVariant,
  removeSolidLogoBackground,
} from "./logo-background.ts";

export type ClientBrandIdentity = {
  id?: string;
  user_id: string;
  client_name: string;
  normalized_name: string;
  site_url?: string | null;
  logo_path?: string | null;
  identity?: Record<string, unknown> | null;
};

export type ClientLogoVariant =
  | "default"
  | "light_background"
  | "dark_background"
  | "video";

async function processClientLogo(
  sb: any,
  userId: string,
  path: string,
  variant: ClientLogoVariant,
): Promise<{
  path: string;
  warning: string | null;
  width?: number;
  height?: number;
  bytes: Uint8Array;
}> {
  if (!path.startsWith(`${userId}/`)) throw new Error("logo fora do tenant");
  const { data, error } = await sb.storage.from("tenant-logos").download(path);
  if (error || !data) throw error ?? new Error("logo não encontrada");
  const bytes = new Uint8Array(await data.arrayBuffer());
  const processed = await removeSolidLogoBackground(
    bytes,
    (data as any)?.type || "application/octet-stream",
  );
  if (!processed.changed) {
    return {
      path,
      warning: processed.warning,
      width: processed.width,
      height: processed.height,
      bytes: processed.bytes,
    };
  }
  const processedPath = `${userId}/client-brands/${Date.now()}-${
    crypto.randomUUID().slice(0, 8)
  }-${variant}-sem-fundo.png`;
  const { error: uploadError } = await sb.storage.from("tenant-logos").upload(
    processedPath,
    processed.bytes,
    { contentType: "image/png", upsert: false },
  );
  if (uploadError) throw uploadError;
  await sb.storage.from("tenant-logos").remove([path]);
  return {
    path: processedPath,
    warning: null,
    width: processed.width,
    height: processed.height,
    bytes: processed.bytes,
  };
}

export function clientLogoPath(
  identity: ClientBrandIdentity | null | undefined,
  background?: "light" | "dark" | "video",
  allowAutomaticallyGeneratedDark = true,
): string | null {
  if (!identity) return null;
  if (background === "video") {
    return String(identity.identity?.logo_video_path || "") ||
      identity.logo_path ||
      null;
  }
  const automaticDark = background === "dark" &&
    identity.identity?.logo_fundo_escuro_gerada_automaticamente === true;
  const key = background === "light"
    ? "logo_fundo_claro_path"
    : background === "dark"
      && (!automaticDark || allowAutomaticallyGeneratedDark)
    ? "logo_fundo_escuro_path"
    : null;
  const darkFallback = !automaticDark || allowAutomaticallyGeneratedDark
    ? String(identity.identity?.logo_fundo_escuro_path || "")
    : "";
  return (key ? String(identity.identity?.[key] || "") : "")
    || identity.logo_path
    || darkFallback
    || String(identity.identity?.logo_fundo_claro_path || "")
    || null;
}

export function normalizeClientBrandName(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function siteKey(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    return normalizeClientBrandName(url.hostname.replace(/^www\./i, "").replace(/\.(com|net|org)(\.br)?$/i, ""));
  } catch {
    return normalizeClientBrandName(raw);
  }
}

export function extractClientNameFromLogoRequest(text: string): string | null {
  const input = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!/\b(?:logo|logomarca|logotipo)\b/i.test(input)) return null;
  const match = input.match(
    /\b(?:logo|logomarca|logotipo)(?:\s+oficial)?(?:\s+para\s+fundo\s+(?:claro|escuro|branco|preto))?\s+(?:(?:e|é)\s+)?(?:d[oa]|de)\s+(?:cliente\s+)?(.+?)(?=,|[.;]|\s+(?:guard[ae]|salv[ae]|registr[ae]|cadastr[ae]|use|usa|vou usar|para usar)\b|$)/i,
  );
  const name = String(match?.[1] ?? "")
    .replace(/^(?:o|a|um|uma|cliente|empresa|marca)\s+/i, "")
    .replace(/\s+(?:para|pra)\s+(?:os\s+)?(?:videos?|vídeos?|posts?).*$/i, "")
    .trim();
  if (name.length < 2 || /^(?:cliente|empresa|marca|ele|ela|isso|esse|essa)$/i.test(name)) return null;
  return name.slice(0, 100);
}

export async function findClientBrandIdentity(
  sb: any,
  userId: string,
  input: { name?: string | null; site?: string | null },
): Promise<ClientBrandIdentity | null> {
  const { data, error } = await sb
    .from("client_brand_identities")
    .select("id, user_id, client_name, normalized_name, site_url, logo_path, identity")
    .eq("user_id", userId)
    .limit(200);
  if (error) {
    console.warn("[client-brand][lookup]", error.message);
    return null;
  }
  const name = normalizeClientBrandName(input.name);
  const site = siteKey(input.site);
  const scored = (data ?? []).map((row: ClientBrandIdentity) => {
    const rowName = normalizeClientBrandName(row.normalized_name || row.client_name);
    const rowSite = siteKey(row.site_url);
    let score = 0;
    if (name && rowName === name) score = Math.max(score, 120);
    if (site && rowSite === site) score = Math.max(score, 110);
    if (name.length >= 6 && rowName.length >= 6 && (name.includes(rowName) || rowName.includes(name))) {
      score = Math.max(score, 70);
    }
    if (site.length >= 6 && rowName.length >= 6 && (site.includes(rowName) || rowName.includes(site))) {
      score = Math.max(score, 65);
    }
    return { row, score };
  }).filter((item: { score: number }) => item.score > 0)
    .sort((a: { score: number }, b: { score: number }) => b.score - a.score);
  if (!scored[0]) return null;
  if (scored[1] && scored[0].score === scored[1].score) return null;
  return scored[0].row;
}

export async function listClientBrandIdentityMatches(
  sb: any,
  userId: string,
  name: string,
): Promise<ClientBrandIdentity[]> {
  const target = normalizeClientBrandName(name);
  if (!target) return [];
  const { data, error } = await sb
    .from("client_brand_identities")
    .select("id, user_id, client_name, normalized_name, site_url, logo_path, identity")
    .eq("user_id", userId)
    .limit(200);
  if (error) {
    console.warn("[client-brand][match-list]", error.message);
    return [];
  }
  const exact = (data ?? []).filter((row: ClientBrandIdentity) =>
    normalizeClientBrandName(row.normalized_name || row.client_name) === target
  );
  if (exact.length) return exact;
  if (target.length < 3) return [];
  return (data ?? []).filter((row: ClientBrandIdentity) => {
    const rowName = normalizeClientBrandName(row.normalized_name || row.client_name);
    return rowName.includes(target) || target.includes(rowName);
  });
}

export async function saveClientBrandIdentity(
  sb: any,
  input: {
    userId: string;
    clientName: string;
    siteUrl?: string | null;
    logoPath?: string | null;
    logoVariant?: ClientLogoVariant;
    identity?: Record<string, unknown> | null;
  },
): Promise<ClientBrandIdentity> {
  const clientName = String(input.clientName || "").replace(/\s+/g, " ").trim().slice(0, 100);
  const normalizedName = normalizeClientBrandName(clientName);
  if (!normalizedName) throw new Error("nome do cliente ausente");

  const existing = await findClientBrandIdentity(sb, input.userId, {
    name: clientName,
    site: input.siteUrl,
  });
  const existingOrigin = String(existing?.identity?.logo_origem || "");
  const incomingOrigin = String(input.identity?.logo_origem || "");
  const incomingTemporary = String(input.logoPath || "").includes("/video-site/");
  const preserveManualLogo = existingOrigin === "whatsapp_manual" && incomingOrigin !== "whatsapp_manual";
  const logoVariant = input.logoVariant ?? "default";
  const shouldProcessLogo = input.logoPath &&
    (logoVariant !== "default" || (!incomingTemporary && !preserveManualLogo));
  const processedLogo = shouldProcessLogo
    ? await processClientLogo(
      sb,
      input.userId,
      input.logoPath!,
      logoVariant,
    )
    : null;
  const mergedIdentity = {
    ...((existing?.identity && typeof existing.identity === "object") ? existing.identity : {}),
    ...((input.identity && typeof input.identity === "object") ? input.identity : {}),
  };
  if (processedLogo) {
    mergedIdentity.logo_background_warning = processedLogo.warning;
    if (processedLogo.width && processedLogo.height) {
      mergedIdentity.logo_width = processedLogo.width;
      mergedIdentity.logo_height = processedLogo.height;
      mergedIdentity.logo_aspect_ratio =
        processedLogo.width / processedLogo.height;
    }
  }
  if (processedLogo && logoVariant === "light_background") {
    mergedIdentity.logo_fundo_claro_path = processedLogo.path;
    mergedIdentity.logo_fundo_claro_gerada_automaticamente = false;
  }
  if (processedLogo && logoVariant === "dark_background") {
    mergedIdentity.logo_fundo_escuro_path = processedLogo.path;
    mergedIdentity.logo_fundo_escuro_gerada_automaticamente = false;
  }
  if (processedLogo && logoVariant === "video") {
    mergedIdentity.logo_video_path = processedLogo.path;
    mergedIdentity.logo_video_gerada_automaticamente = false;
  }
  const logoPath = logoVariant === "default"
    ? (incomingTemporary || preserveManualLogo
      ? existing?.logo_path || null
      : processedLogo?.path || existing?.logo_path || null)
    : existing?.logo_path || null;
  if (
    processedLogo &&
    logoVariant === "default" &&
    !preserveManualLogo
  ) {
    const targets = [
      {
        variant: "light_background" as const,
        pathKey: "logo_fundo_claro_path",
        automaticKey: "logo_fundo_claro_gerada_automaticamente",
      },
      {
        variant: "dark_background" as const,
        pathKey: "logo_fundo_escuro_path",
        automaticKey: "logo_fundo_escuro_gerada_automaticamente",
      },
      {
        variant: "video" as const,
        pathKey: "logo_video_path",
        automaticKey: "logo_video_gerada_automaticamente",
      },
    ];
    for (const target of targets) {
      const existingPath = String(existing?.identity?.[target.pathKey] || "");
      const existingAutomatic =
        existing?.identity?.[target.automaticKey] === true;
      if (existingPath && !existingAutomatic) continue;
      if (existingPath.startsWith(`${input.userId}/`)) {
        await sb.storage.from("tenant-logos").remove([existingPath]);
      }
      delete mergedIdentity[target.pathKey];
      delete mergedIdentity[target.automaticKey];
      if (processedLogo.warning) continue;
      const derived = await deriveLogoVariant(
        processedLogo.bytes,
        target.variant,
      );
      if (!derived.generated) continue;
      const generatedPath = `${input.userId}/client-brands/${Date.now()}-${
        crypto.randomUUID().slice(0, 8)
      }-${target.variant}-automatica.png`;
      const { error: uploadError } = await sb.storage.from("tenant-logos")
        .upload(generatedPath, derived.bytes, {
          contentType: "image/png",
          upsert: false,
        });
      if (uploadError) throw uploadError;
      mergedIdentity[target.pathKey] = generatedPath;
      mergedIdentity[target.automaticKey] = true;
    }
  }
  if (preserveManualLogo) mergedIdentity.logo_origem = "whatsapp_manual";
  const payload = {
    user_id: input.userId,
    client_name: existing?.client_name || clientName,
    normalized_name: existing?.normalized_name || normalizedName,
    site_url: input.siteUrl || existing?.site_url || null,
    logo_path: logoPath,
    identity: mergedIdentity,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await sb
    .from("client_brand_identities")
    .upsert(payload, { onConflict: "user_id,normalized_name" })
    .select("id, user_id, client_name, normalized_name, site_url, logo_path, identity")
    .single();
  if (error) throw new Error(`não consegui registrar a identidade do cliente: ${error.message}`);
  return data as ClientBrandIdentity;
}
