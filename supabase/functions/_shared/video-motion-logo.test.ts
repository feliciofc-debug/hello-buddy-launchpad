import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { resolverLogoMotion } from "./video-motion-enfileirar.ts";
import { normalizarSiteMotion } from "./video-motion.ts";

const USER_ID = "11111111-1111-4111-8111-111111111111";

Deno.test("normaliza site em Markdown para URL limpa", () => {
  assertEquals(
    normalizarSiteMotion("[www.casaraolustres.com.br](https://www.casaraolustres.com.br)"),
    "www.casaraolustres.com.br",
  );
  assertEquals(normalizarSiteMotion("https://cliente.com.br/catalogo/"), "cliente.com.br/catalogo");
});

function fakeSupabase(rows: Record<string, unknown>) {
  const queried: string[] = [];
  const from = (table: string) => {
    queried.push(table);
    const builder = {
      select: () => builder,
      eq: () => builder,
      maybeSingle: async () => ({ data: rows[table] ?? null, error: null }),
    };
    return builder;
  };
  const storage = {
    from: (_bucket: string) => ({
      createSignedUrl: async (path: string) => ({
        data: { signedUrl: `https://cdn.example.com/${path}` },
        error: null,
      }),
      list: async () => ({ data: [], error: null }),
      getPublicUrl: (path: string) => ({ data: { publicUrl: `https://cdn.example.com/${path}` } }),
    }),
  };
  return { client: { from, storage }, queried };
}

Deno.test("logo explícita vence identidade e perfil", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(new Uint8Array([1]), {
      status: 200,
      headers: { "content-type": "image/png" },
    });
  try {
    const { client, queried } = fakeSupabase({
      empresa_config: { identidade_site: { logo_url: "https://brand.example.com/logo.png" } },
      profiles: { logo_reel_url: `https://cdn.example.com/${USER_ID}/logo.png` },
    });
    const result = await resolverLogoMotion(client, USER_ID, {
      explicitPath: `${USER_ID}/pedido/logo.png`,
    });
    assertEquals(result?.origem, "explicit_path");
    assertEquals(result?.path, `${USER_ID}/pedido/logo.png`);
    assertEquals(queried, []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("identidade de cliente nunca cai na logo do tenant", async () => {
  const { client, queried } = fakeSupabase({
    empresa_config: { identidade_site: { logo_url: "https://amz.example.com/logo.png" } },
    profiles: { logo_reel_url: `https://cdn.example.com/${USER_ID}/logo.png` },
  });
  const result = await resolverLogoMotion(client, USER_ID, { clientIdentity: true });
  assertEquals(result, null);
  assertEquals(queried, []);
});

Deno.test("usa identidade do site e depois profile como fallback", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    return new Response(new Uint8Array([1]), {
      status: url.includes("quebrada") ? 404 : 200,
      headers: { "content-type": "image/png" },
    });
  };
  try {
    const profileUrl = `https://cdn.example.com/${USER_ID}/logo.png`;
    const { client } = fakeSupabase({
      empresa_config: { identidade_site: { logo_url: "https://brand.example.com/quebrada.png" } },
      profiles: { logo_reel_url: profileUrl },
    });
    const result = await resolverLogoMotion(client, USER_ID, {});
    assertExists(result);
    assertEquals(result.origem, "profile");
    assertEquals(result.url, profileUrl);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
