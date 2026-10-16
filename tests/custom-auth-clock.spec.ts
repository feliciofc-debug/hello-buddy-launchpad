import { expect, test } from "@playwright/test";

const API_ORIGIN = "https://api.amzofertas.com.br";
const USER_ID = "6ae3867f-50fa-44db-9346-c76f0495c43a";
const ACCESS_TOKEN = jwt({
  sub: USER_ID,
  role: "authenticated",
  exp: Math.floor(Date.now() / 1000) + 3600,
});

function jwt(payload: Record<string, unknown>) {
  return `header.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.signature`;
}

test("login mantém Authorization com relógio do navegador duas horas adiantado", async ({
  page,
}) => {
  const profileAuthorizations: string[] = [];

  await page.clock.install({ time: Date.now() + 2 * 60 * 60 * 1000 });
  await page.route(`${API_ORIGIN}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.pathname === "/auth/v1/login" && request.method() === "POST") {
      await route.fulfill({
        json: {
          access_token: ACCESS_TOKEN,
          token_type: "bearer",
          expires_in: 3600,
          user: {
            id: USER_ID,
            email: "relogio@example.com",
          },
        },
      });
      return;
    }

    if (url.pathname === "/rest/v1/profiles") {
      const authorization = request.headers().authorization || "";
      profileAuthorizations.push(authorization);
      await route.fulfill({
        status: 200,
        headers: { "content-type": "application/json" },
        body: authorization === `Bearer ${ACCESS_TOKEN}`
          ? JSON.stringify({ tipo: "empresa", validade_acesso: null })
          : "[]",
      });
      return;
    }

    if (url.pathname === "/auth/v1/user") {
      await route.fulfill({
        json: {
          id: USER_ID,
          email: "relogio@example.com",
          user_metadata: {},
          app_metadata: { provider: "email" },
        },
      });
      return;
    }

    await route.fulfill({
      status: 200,
      headers: { "content-type": "application/json" },
      body: "[]",
    });
  });

  await page.goto("/login");
  await page.locator('input[type="email"]').fill("relogio@example.com");
  await page.locator('input[type="password"]').fill("senha-segura");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  expect(profileAuthorizations).toEqual([`Bearer ${ACCESS_TOKEN}`]);
});

test("401 de função preserva sessão e 401 do REST desloga", async ({ page }) => {
  const warnings: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "warning") warnings.push(message.text());
  });

  await page.addInitScript(({ token, userId }) => {
    localStorage.setItem(
      "amz-custom-auth-session-v1:https://api.amzofertas.com.br",
      JSON.stringify({
        access_token: token,
        refresh_token: "",
        token_type: "bearer",
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3540,
        user: {
          id: userId,
          email: "auth-test@example.com",
          aud: "authenticated",
          role: "authenticated",
          app_metadata: { provider: "email" },
          user_metadata: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      }),
    );
  }, { token: ACCESS_TOKEN, userId: USER_ID });

  await page.route(`${API_ORIGIN}/functions/v1/linkedin-publish`, async (route) => {
    await route.fulfill({
      status: 401,
      json: { message: "Token do LinkedIn expirado" },
    });
  });
  await page.route(`${API_ORIGIN}/rest/v1/produtos**`, async (route) => {
    await route.fulfill({
      status: 401,
      json: { message: "JWT da plataforma inválido" },
    });
  });

  await page.goto("/login");

  const sessionAfterFunction = await page.evaluate(async () => {
    const { supabase } = await import("/src/integrations/supabase/client.ts");
    await supabase.functions.invoke("linkedin-publish", { body: {} });
    return (await supabase.auth.getSession()).data.session?.access_token ?? null;
  });
  expect(sessionAfterFunction).toBe(ACCESS_TOKEN);
  expect(
    warnings.some((warning) =>
      warning.includes(
        "401 não encerrou a sessão em endpoint não autoritativo /functions/v1/linkedin-publish",
      )
    ),
  ).toBe(true);

  const sessionAfterRest = await page.evaluate(async () => {
    const { supabase } = await import("/src/integrations/supabase/client.ts");
    await supabase.from("produtos").select("id");
    return (await supabase.auth.getSession()).data.session?.access_token ?? null;
  });
  expect(sessionAfterRest).toBeNull();
});
