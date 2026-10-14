import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { CustomAuthClient } from "../../../src/integrations/supabase/custom-auth.ts";

type UserPayload = {
  id?: string;
  email: string;
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
};

function jwtFor(userId: string): string {
  const payload = btoa(JSON.stringify({
    sub: userId,
    role: "authenticated",
    exp: Math.floor(Date.now() / 1000) + 3600,
  })).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
  return `header.${payload}.signature`;
}

async function clientWithUserResponse(userResponse: unknown) {
  const userId = crypto.randomUUID();
  const email = `${userId}@example.com`;
  const originalFetch = globalThis.fetch;
  let request = 0;

  globalThis.fetch = async () => {
    request += 1;
    if (request === 1) {
      return Response.json({
        access_token: jwtFor(userId),
        token_type: "bearer",
        expires_in: 3600,
        user: { id: userId, email },
      });
    }
    return Response.json(userResponse);
  };

  const client = new CustomAuthClient(
    `https://${userId}.example.com`,
    "anon-key",
  );
  const login = await client.signInWithPassword({ email, password: "secret" });

  return {
    client,
    email,
    login,
    restore: () => {
      globalThis.fetch = originalFetch;
      localStorage.clear();
    },
  };
}

Deno.test("custom auth aceita usuário no nível raiz", async () => {
  const id = crypto.randomUUID();
  const fixture = await clientWithUserResponse({
    id,
    email: "root@example.com",
    user_metadata: { origem: "raiz" },
  });
  try {
    const result = await fixture.client.getUser();
    assertEquals(fixture.login.error, null);
    assertEquals(result.error, null);
    assertEquals(result.data.user?.id, id);
    assertEquals(result.data.user?.email, "root@example.com");
  } finally {
    fixture.restore();
  }
});

Deno.test("custom auth mantém compatibilidade com payload envelopado", async () => {
  const id = crypto.randomUUID();
  const payload: { user: UserPayload } = {
    user: {
      id,
      email: "wrapped@example.com",
      app_metadata: { provider: "email" },
    },
  };
  const fixture = await clientWithUserResponse(payload);
  try {
    const result = await fixture.client.getUser();
    assertEquals(result.error, null);
    assertEquals(result.data.user?.id, id);
    assertEquals(result.data.user?.email, "wrapped@example.com");
  } finally {
    fixture.restore();
  }
});

Deno.test("payload sem id retorna erro e preserva a sessão", async () => {
  const fixture = await clientWithUserResponse({
    email: "invalid@example.com",
  });
  try {
    const result = await fixture.client.getUser();
    assertEquals(result.data.user, null);
    assertStringIncludes(result.error?.message || "", "campo id ausente");

    const session = await fixture.client.getSession();
    assertEquals(session.data.session?.user.email, fixture.email);
  } finally {
    fixture.restore();
  }
});
