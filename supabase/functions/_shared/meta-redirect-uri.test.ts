import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildMetaAuthUrl,
  META_REDIRECT_URI,
  metaRedirectUri,
} from "../../../src/config/meta.ts";

Deno.test("OAuth da Meta sempre usa o callback canônico da AMZ", () => {
  assertEquals(
    META_REDIRECT_URI,
    "https://www.amzofertas.com.br/auth/callback/meta",
  );
  assertEquals(metaRedirectUri(), META_REDIRECT_URI);

  const authUrl = new URL(buildMetaAuthUrl("tenant-state"));
  assertEquals(authUrl.searchParams.get("redirect_uri"), META_REDIRECT_URI);
  assertEquals(authUrl.searchParams.get("state"), "tenant-state");
});
