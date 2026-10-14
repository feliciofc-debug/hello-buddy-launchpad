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
