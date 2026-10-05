import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  assertSafePublicUrl,
  cleanSiteBrandName,
  extractBrandIdentityFromHtml,
  fetchBrandSiteIdentity,
  isPrivateOrLocalAddress,
  prioritizeSiteIdentityColors,
  readLimited,
  SITE_IDENTITY_READ_FAILURE_MESSAGE,
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

Deno.test("detecta logo lazy-load VTEX fora de header", () => {
  const identity = extractBrandIdentityFromHtml(
    `<img width="160" alt="Bom pastor Logo"
      class="lazyload vtex-store-components-3-x-logoImage"
      data-src="https://lojabompastor.vtexassets.com/assets/b33c5a3b.png"
      loading="lazy">`,
    "https://www.lojabompastor.com.br/",
  );
  assertEquals(
    identity.logo_url,
    "https://lojabompastor.vtexassets.com/assets/b33c5a3b.png",
  );
  assertEquals(identity.logo_confidence, "high");
});

Deno.test("detecta primeiro candidato de data-srcset e srcset", () => {
  const lazy = extractBrandIdentityFromHtml(
    `<img alt="Marca logo" data-srcset="/logo-320.png 320w, /logo-640.png 640w">`,
    "https://marca.example/",
  );
  const regular = extractBrandIdentityFromHtml(
    `<a href="/"><img srcset="/brand-1x.png 1x, /brand-2x.png 2x"></a>`,
    "https://marca.example/",
  );
  assertEquals(lazy.logo_url, "https://marca.example/logo-320.png");
  assertEquals(regular.logo_url, "https://marca.example/brand-1x.png");
});

Deno.test("usa favicon grande como fallback de confiança média", () => {
  const identity = extractBrandIdentityFromHtml(
    `<link rel="icon" sizes="512x512" href="/arquivos/favicon-bom-pastor.png">`,
    "https://www.lojabompastor.com.br/",
  );
  assertEquals(
    identity.logo_url,
    "https://www.lojabompastor.com.br/arquivos/favicon-bom-pastor.png",
  );
  assertEquals(identity.logo_confidence, "medium");
});

Deno.test("extrai logo de alta confiança do JSON-LD de organização", () => {
  const identity = extractBrandIdentityFromHtml(
    `<script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": ["AutoDealer", "LocalBusiness"],
            "name": "Loja Premium",
            "logo": { "@type": "ImageObject", "url": "/assets/logo-loja.webp" }
          }
        ]
      }
    </script>`,
    "https://loja.example/veiculos",
  );
  assertEquals(identity.logo_url, "https://loja.example/assets/logo-loja.webp");
  assertEquals(identity.logo_confidence, "high");
});

Deno.test("extrai og:logo como alta confiança", () => {
  const identity = extractBrandIdentityFromHtml(
    `<meta property="og:logo" content="/marca/logo.svg">
     <link rel="apple-touch-icon" href="/favicon.png">`,
    "https://loja.example/",
  );
  assertEquals(identity.logo_url, "https://loja.example/marca/logo.svg");
  assertEquals(identity.logo_confidence, "high");
});

Deno.test("favicon isolado nunca é promovido a logo de alta confiança", () => {
  const identity = extractBrandIdentityFromHtml(
    `<meta name="theme-color" content="#E05220">
     <link rel="apple-touch-icon" href="/icone-quadrado.png">`,
    "https://loja.example/",
  );
  assertEquals(identity.logo_url, "https://loja.example/icone-quadrado.png");
  assertEquals(identity.logo_confidence, "medium");
});

Deno.test("prioriza cores da logo e descarta paleta genérica ausente nela", () => {
  assertEquals(
    prioritizeSiteIdentityColors(
      ["#f87171", "#fecaca", "#9333ea", "#0ea5e9", "#f59e0b"],
      ["#164e63", "#f59e0b"],
    ),
    ["#164e63", "#f59e0b", "#0ea5e9"],
  );
  assertEquals(
    prioritizeSiteIdentityColors(["#9333ea", "#0ea5e9"], ["#9333ea"]),
    ["#9333ea", "#0ea5e9"],
  );
});

Deno.test("extrai nome da marca declarado pelo site", () => {
  const identity = extractBrandIdentityFromHtml(
    `<meta property="og:site_name" content="AMZ Ofertas">
     <title>Produto em oferta | AMZ Ofertas</title>`,
    "https://amz.example/produto",
  );
  assertEquals(identity.brand_name, "AMZ Ofertas");
  assertEquals(cleanSiteBrandName("Ademicon | Consórcio de imóveis"), "Ademicon");
  assertEquals(cleanSiteBrandName("Ademicon - Consórcio de imóveis"), "Ademicon");
  assertEquals(cleanSiteBrandName("Ademicon – Consórcio"), "Ademicon");
  assertEquals(cleanSiteBrandName("Ademicon — Investimentos"), "Ademicon");
  assertEquals(cleanSiteBrandName("Ademicon: Consórcio"), "Ademicon");
});

Deno.test("HTML acima do limite preserva identidade encontrada no início", async () => {
  const head = `<meta property="og:site_name" content="Loja Bom Pastor">
    <meta name="theme-color" content="#164E63">
    <header><img class="site-logo" src="/logo.png"></header>`;
  const oversized = `${head}${"x".repeat(2_100_000)}`;
  const bytes = await readLimited(
    new Response(oversized, {
      headers: { "content-length": String(new TextEncoder().encode(oversized).length) },
    }),
    2_000_000,
    true,
  );
  assertEquals(bytes.length, 2_000_000);
  const identity = extractBrandIdentityFromHtml(
    new TextDecoder().decode(bytes),
    "https://www.lojabompastor.com.br/",
  );
  assertEquals(identity.brand_name, "Loja Bom Pastor");
  assertEquals(identity.colors, ["#164e63"]);
  assertEquals(identity.logo_url, "https://www.lojabompastor.com.br/logo.png");
});

Deno.test("logo acima do limite continua sendo rejeitada", async () => {
  await assertRejects(
    () =>
      readLimited(
        new Response(new Uint8Array(12), { headers: { "content-length": "12" } }),
        10,
      ),
    Error,
    "maior que o limite",
  );
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

Deno.test("domínio sem DNS tenta www uma vez e preserva a segurança", async () => {
  const resolvedHosts: string[] = [];
  const identity = await fetchBrandSiteIdentity(
    "https://lojabompastor.com.br/produtos?x=1",
    {
      resolver: async (hostname, type) => {
        resolvedHosts.push(`${hostname}:${type}`);
        if (hostname === "www.lojabompastor.com.br" && type === "A") {
          return ["93.184.216.34"];
        }
        return [];
      },
      fetcher: async (input) => {
        const url = new URL(String(input));
        assertEquals(url.hostname, "www.lojabompastor.com.br");
        assertEquals(url.pathname, "/produtos");
        assertEquals(url.search, "?x=1");
        return new Response(
          `<meta name="theme-color" content="#ee3124"><title>Bom Pastor</title>`,
          { headers: { "content-type": "text/html; charset=utf-8" } },
        );
      },
    },
  );
  assertEquals(identity.url, "https://www.lojabompastor.com.br/produtos?x=1");
  assertEquals(identity.colors, ["#ee3124"]);
  assertEquals(resolvedHosts, [
    "lojabompastor.com.br:A",
    "lojabompastor.com.br:AAAA",
    "www.lojabompastor.com.br:A",
    "www.lojabompastor.com.br:AAAA",
  ]);
});

Deno.test("endereço privado é bloqueado sem tentar fallback www", async () => {
  const resolvedHosts: string[] = [];
  await assertRejects(
    () =>
      fetchBrandSiteIdentity("https://intranet.example/", {
        resolver: async (hostname, type) => {
          resolvedHosts.push(`${hostname}:${type}`);
          return type === "A" ? ["10.0.0.8"] : [];
        },
        fetcher: () => {
          throw new Error("fetch não deveria rodar");
        },
      }),
    Error,
    "público seguro",
  );
  assertEquals(resolvedHosts, [
    "intranet.example:A",
    "intranet.example:AAAA",
  ]);
});

Deno.test("www sem DNS mantém falha e mensagem determinística orienta o endereço", async () => {
  await assertRejects(
    () =>
      fetchBrandSiteIdentity("https://www.inexistente.example/", {
        resolver: async () => [],
      }),
    Error,
    "público seguro",
  );
  assertEquals(
    SITE_IDENTITY_READ_FAILURE_MESSAGE,
    "Não consegui abrir esse endereço. Me manda o site do jeito que aparece no navegador, por exemplo: www.suaempresa.com.br\nSe preferir, me diga as cores da sua marca que eu crio a demonstração com elas.",
  );
});
