export type ClientBrandIdentity = {
  id?: string;
  user_id: string;
  client_name: string;
  normalized_name: string;
  site_url?: string | null;
  logo_path?: string | null;
  identity?: Record<string, unknown> | null;
};

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
    /\b(?:logo|logomarca|logotipo)(?:\s+oficial)?\s+(?:(?:e|é)\s+)?(?:d[oa]|de)\s+(.+?)(?=,|[.;]|\s+(?:guard[ae]|salv[ae]|registr[ae]|cadastr[ae]|use|usa|vou usar|para usar)\b|$)/i,
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
  const payload = {
    user_id: input.userId,
    client_name: existing?.client_name || clientName,
    normalized_name: existing?.normalized_name || normalizedName,
    site_url: input.siteUrl || existing?.site_url || null,
    logo_path: input.logoPath || existing?.logo_path || null,
    identity: {
      ...((existing?.identity && typeof existing.identity === "object") ? existing.identity : {}),
      ...((input.identity && typeof input.identity === "object") ? input.identity : {}),
    },
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
