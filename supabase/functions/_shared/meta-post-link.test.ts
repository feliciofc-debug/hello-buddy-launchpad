import {
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  facebookPostFallbackUrl,
  fetchMetaPostLink,
} from "./meta-post-link.ts";

Deno.test("confirmação usa permalink retornado pela rede", async () => {
  const calls: string[] = [];
  const link = await fetchMetaPostLink({
    postId: "ig-123",
    accessToken: "token",
    platform: "instagram",
    fetcher: ((input: URL | RequestInfo) => {
      calls.push(String(input));
      return Promise.resolve(
        new Response(
          JSON.stringify({ permalink: "https://www.instagram.com/p/abc/" }),
          { status: 200 },
        ),
      );
    }) as typeof fetch,
  });
  assertEquals(link, "https://www.instagram.com/p/abc/");
  assertEquals(calls.length, 1);
});

Deno.test("Facebook mantém link útil se consulta do permalink falhar", async () => {
  const link = await fetchMetaPostLink({
    postId: "page_456",
    accessToken: "token",
    platform: "facebook",
    fetcher: (() =>
      Promise.resolve(
        new Response(JSON.stringify({ error: { message: "no fields" } }), {
          status: 400,
        }),
      )) as typeof fetch,
  });
  assertEquals(link, facebookPostFallbackUrl("page_456"));
});
