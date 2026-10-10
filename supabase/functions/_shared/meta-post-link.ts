export function facebookPostFallbackUrl(postId: string): string | null {
  const id = String(postId || "").trim();
  return id ? `https://www.facebook.com/${encodeURIComponent(id)}` : null;
}

export async function fetchMetaPostLink(input: {
  postId: string;
  accessToken: string;
  platform: "facebook" | "instagram";
  fetcher?: typeof fetch;
}): Promise<string | null> {
  const postId = String(input.postId || "").trim();
  if (!postId) return null;
  const field = input.platform === "instagram" ? "permalink" : "permalink_url";
  try {
    const url = new URL(
      `https://graph.facebook.com/v25.0/${encodeURIComponent(postId)}`,
    );
    url.searchParams.set("fields", field);
    url.searchParams.set("access_token", input.accessToken);
    const response = await (input.fetcher || fetch)(url);
    const data = await response.json();
    const link = String(data?.[field] || "").trim();
    if (response.ok && link) return link;
  } catch {
    // A publicação já aconteceu; a consulta do permalink não deve revertê-la.
  }
  return input.platform === "facebook"
    ? facebookPostFallbackUrl(postId)
    : null;
}
