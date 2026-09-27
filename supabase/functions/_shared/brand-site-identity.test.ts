import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  assertSafePublicUrl,
  extractBrandIdentityFromHtml,
  isPrivateOrLocalAddress,
} from "./brand-site-identity.ts";

Deno.test("extrai theme-color e variáveis CSS e ignora cinzas", () => {
  const identity = extractBrandIdentityFromHtml(
    `<!doctype html>
      <meta name="theme-color" content="#E63946">
      <style>
        :root { --brand-primary: #164E63; --surface: #f4f4f4; }
        .button-primary { background: #F59E0B; color: #ffffff; }
      </style>`,
    "https://marca.example/",
  );
  assertEquals(identity.colors, ["#e63946", "#164e63", "#f59e0b"]);
});

Deno.test("aceita somente logo de alta confiança no header e nunca og:image", () => {
  const identity = extractBrandIdentityFromHtml(
    `<meta property="og:image" content="/banner.jpg">
     <header><img class="site-logo" alt="Logo da marca" src="/assets/logo.svg"></header>`,
    "https://marca.example/produto",
  );
  assertEquals(identity.logo_url, "https://marca.example/assets/logo.svg");
  assertEquals(identity.logo_confidence, "high");

  const withoutHeaderLogo = extractBrandIdentityFromHtml(
    `<meta property="og:image" content="/banner.jpg">`,
    "https://marca.example/",
  );
  assertEquals(withoutHeaderLogo.logo_url, null);
  assertEquals(withoutHeaderLogo.logo_confidence, "none");
});

Deno.test("bloqueia localhost e faixas privadas contra SSRF", async () => {
  for (
    const hostname of [
      "localhost",
      "127.0.0.1",
      "10.0.0.8",
      "172.20.0.2",
      "192.168.1.1",
      "169.254.169.254",
      "::1",
      "fd00::1",
    ]
  ) {
    assertEquals(isPrivateOrLocalAddress(hostname), true, hostname);
  }
  await assertRejects(
    () => assertSafePublicUrl("http://localhost/admin"),
    Error,
    "privada",
  );
  await assertRejects(
    () => assertSafePublicUrl("https://public.example/", async () => ["10.1.2.3"]),
    Error,
    "público seguro",
  );
  assertEquals(
    (
      await assertSafePublicUrl(
        "https://public.example/",
        async (_hostname, type) => type === "A" ? ["203.0.113.10"] : [],
      )
    ).hostname,
    "public.example",
  );
});
