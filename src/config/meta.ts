const META_APP_ID = "1254152493364240";
const META_SCOPES = [
  "pages_show_list",
  "pages_manage_posts",
  "pages_read_engagement",
  "instagram_basic",
  "instagram_content_publish",
  "business_management",
].join(",");

export const META_REDIRECT_URI =
  "https://www.amzofertas.com.br/auth/callback/meta";

export const metaRedirectUri = () => META_REDIRECT_URI;

export function buildMetaAuthUrl(state: string): string {
  const url = new URL("https://www.facebook.com/v25.0/dialog/oauth");
  url.searchParams.set("client_id", META_APP_ID);
  url.searchParams.set("redirect_uri", META_REDIRECT_URI);
  url.searchParams.set("scope", META_SCOPES);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);
  return url.toString();
}
