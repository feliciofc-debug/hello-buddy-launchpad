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

function jwtFor(userId: string, expiresAt = Math.floor(Date.now() / 1000) + 3600): string {
  const payload = btoa(JSON.stringify({
    sub: userId,
    role: "authenticated",
    exp: expiresAt,
  })).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
  return `header.${payload}.signature`;
}

async function clientWithUserResponse(
  userResponse: unknown,
  options: {
    token?: string;
    expiresIn?: number;
    userStatus?: number;
  } = {},
) {
  const userId = crypto.randomUUID();
  const email = `${userId}@example.com`;
  const originalFetch = globalThis.fetch;
  let request = 0;

  globalThis.fetch = async () => {
    request += 1;
    if (request === 1) {
      return Response.json({
        access_token: options.token ?? jwtFor(userId),
        token_type: "bearer",
        expires_in: options.expiresIn ?? 3600,
        user: { id: userId, email },
      });
    }
    return Response.json(userResponse, { status: options.userStatus ?? 200 });
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

Deno.test("login normal calcula expiração pelo relógio local e expires_in", async () => {
  const originalNow = Date.now;
  const localLoginMs = 1_800_000_000_000;
  Date.now = () => localLoginMs;
  const fixture = await clientWithUserResponse(
    { id: crypto.randomUUID(), email: "normal@example.com" },
    {
      token: jwtFor(crypto.randomUUID(), 1_000),
      expiresIn: 3600,
    },
  );
  try {
    const session = await fixture.client.getSession();
    assertEquals(fixture.login.error, null);
    assertEquals(
      session.data.session?.expires_at,
      Math.floor(localLoginMs / 1000) + 3600 - 60,
    );
  } finally {
    fixture.restore();
    Date.now = originalNow;
  }
});

Deno.test("relógio do cliente duas horas adiantado não descarta o token", async () => {
  const originalNow = Date.now;
  const serverNowMs = 1_800_000_000_000;
  Date.now = () => serverNowMs + 2 * 60 * 60 * 1000;
  const token = jwtFor(
    crypto.randomUUID(),
    Math.floor(serverNowMs / 1000) + 3600,
  );
  const fixture = await clientWithUserResponse(
    { id: crypto.randomUUID(), email: "ahead@example.com" },
    { token },
  );
  try {
    assertEquals(fixture.client.getAccessToken(), token);
    assertEquals((await fixture.client.getSession()).data.session?.access_token, token);
  } finally {
    fixture.restore();
    Date.now = originalNow;
  }
});

Deno.test("relógio do cliente duas horas atrasado não descarta o token", async () => {
  const originalNow = Date.now;
  const serverNowMs = 1_800_000_000_000;
  Date.now = () => serverNowMs - 2 * 60 * 60 * 1000;
  const token = jwtFor(
    crypto.randomUUID(),
    Math.floor(serverNowMs / 1000) + 3600,
  );
  const fixture = await clientWithUserResponse(
    { id: crypto.randomUUID(), email: "behind@example.com" },
    { token },
  );
  try {
    assertEquals(fixture.client.getAccessToken(), token);
    assertEquals((await fixture.client.getSession()).data.session?.access_token, token);
  } finally {
    fixture.restore();
    Date.now = originalNow;
  }
});

Deno.test("401 real do servidor descarta a sessão e registra o motivo", async () => {
  const originalWarn = console.warn;
  const warnings: string[] = [];
  console.warn = (...args: unknown[]) => warnings.push(args.map(String).join(" "));
  const fixture = await clientWithUserResponse(
    { message: "Token inválido" },
    { userStatus: 401 },
  );
  try {
    const result = await fixture.client.getUser();
    assertEquals((result.error as Error & { status?: number })?.status, 401);
    assertEquals(fixture.client.getAccessToken(), null);
    assertEquals((await fixture.client.getSession()).data.session, null);
    assertEquals(
      warnings.some((warning) =>
        warning.includes("servidor rejeitou o token em /auth/v1/user")
      ),
      true,
    );
  } finally {
    fixture.restore();
    console.warn = originalWarn;
  }
});

Deno.test("login tenta perfil vazio duas vezes antes de bloquear assinatura", async () => {
  const source = await Deno.readTextFile("src/pages/Login.tsx");
  const firstProfileLoad = source.indexOf("await loadProfile()");
  const retryProfileLoad = source.indexOf("await loadProfile()", firstProfileLoad + 1);
  const missingProfileGuard = source.indexOf("if (!profile)", retryProfileLoad);
  const subscriptionCheck = source.indexOf(
    "supabase.functions.invoke('check-subscription')",
  );

  assertEquals(firstProfileLoad >= 0, true);
  assertEquals(retryProfileLoad > firstProfileLoad, true);
  assertEquals(missingProfileGuard > retryProfileLoad, true);
  assertEquals(subscriptionCheck > missingProfileGuard, true);
  assertStringIncludes(
    source.slice(missingProfileGuard, subscriptionCheck),
    "não foi possível validar seu perfil",
  );
  assertStringIncludes(
    source.slice(missingProfileGuard, subscriptionCheck),
    "return;",
  );
});
