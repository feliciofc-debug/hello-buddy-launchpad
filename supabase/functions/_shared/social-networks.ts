export type SupportedSocialNetwork = "facebook" | "instagram" | "tiktok" | "linkedin";

export const SUPPORTED_SOCIAL_NETWORKS: SupportedSocialNetwork[] = [
  "facebook",
  "instagram",
  "tiktok",
  "linkedin",
];

export const DEFAULT_SOCIAL_NETWORKS: SupportedSocialNetwork[] = [
  "facebook",
  "instagram",
  "tiktok",
];

export function canonicalSocialNetwork(value: unknown): SupportedSocialNetwork | null {
  const normalized = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  if (/^(?:facebook|face|fb)$/.test(normalized)) return "facebook";
  if (/^(?:instagram|insta|ig)$/.test(normalized)) return "instagram";
  if (/^(?:tiktok|tik tok)$/.test(normalized)) return "tiktok";
  if (/^(?:linkedin|linked in|lkd)$/.test(normalized)) return "linkedin";
  return null;
}

export function detectRequestedSocialNetworks(text: string): SupportedSocialNetwork[] {
  const normalized = String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const networks: SupportedSocialNetwork[] = /\bredes sociais\b/.test(normalized)
    ? [...DEFAULT_SOCIAL_NETWORKS]
    : [];
  if (/\b(?:facebook|face|fb)\b/.test(normalized)) networks.push("facebook");
  if (/\b(?:instagram|insta|ig)\b/.test(normalized)) networks.push("instagram");
  if (/\b(?:tiktok|tik\s*tok)\b/.test(normalized)) networks.push("tiktok");
  if (/\b(?:linkedin|linked\s*in|lkd)\b/.test(normalized)) networks.push("linkedin");
  return [...new Set(networks)];
}
