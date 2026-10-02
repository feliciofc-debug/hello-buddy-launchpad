const META_ADS_APP_ID = "1254152493364240";
const META_ADS_SCOPES = [
  "ads_read",
  "ads_management",
  "business_management",
].join(",");

export const META_ADS_REDIRECT_URI =
  "https://www.amzofertas.com.br/auth/callback/meta-ads";

export function buildMetaAdsAuthUrl(state: string): string {
  const url = new URL("https://www.facebook.com/v25.0/dialog/oauth");
  url.searchParams.set("client_id", META_ADS_APP_ID);
  url.searchParams.set("redirect_uri", META_ADS_REDIRECT_URI);
  url.searchParams.set("scope", META_ADS_SCOPES);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);
  return url.toString();
}
