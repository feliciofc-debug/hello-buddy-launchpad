import { expect, test } from "@playwright/test";

const API_ORIGIN = "https://api.amzofertas.com.br";
const USER_ID = "44d92bd4-3456-4f23-9689-75602fa718bd";
const TOKEN = `header.${
  Buffer.from(JSON.stringify({
    sub: USER_ID,
    role: "authenticated",
    exp: Math.floor(Date.now() / 1000) + 3600,
  })).toString("base64url")
}.signature`;

const vehicle = {
  id: "984e459d-260f-4b0e-bba2-ff9579459c40",
  user_id: USER_ID,
  codigo_origem: "ROYAL-1",
  marca: "Land Rover",
  modelo: "Defender",
  versao: "110",
  ano_fabricacao: 2024,
  ano_modelo: 2025,
  km: 9000,
  preco: 799900,
  cor: "Preta",
  combustivel: "Gasolina",
  cambio: "Automático",
  portas: 4,
  blindado: true,
  nivel_blindagem: "III-A",
  opcionais: ["Teto panorâmico"],
  caracteristicas: ["Único dono"],
  descricao: "Procedência verificada.",
  fotos: [
    "https://cdn.example.com/defender-1.jpg",
    "https://cdn.example.com/defender-2.jpg",
    "https://cdn.example.com/defender-3.jpg",
  ],
  status: "disponivel",
  destaque: true,
  origem: "site",
  url_origem: "https://royal4x4.com.br/defender",
  incluir_cta_whatsapp: false,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  vendido_at: null,
};

test("estoque mostra carrossel e ferramentas sem consultar produtos", async ({
  page,
}) => {
  const productRequests: string[] = [];
  let ctaPayload: Record<string, unknown> | null = null;

  await page.addInitScript(({ userId, token }) => {
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
          email: "royal@example.com",
          aud: "authenticated",
          role: "authenticated",
          app_metadata: { provider: "email" },
          user_metadata: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      }),
    );
  }, { userId: USER_ID, token: TOKEN });

  await page.route(`${API_ORIGIN}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.pathname === "/auth/v1/user") {
      await route.fulfill({
        json: {
          id: USER_ID,
          email: "royal@example.com",
          user_metadata: {},
          app_metadata: { provider: "email" },
        },
      });
      return;
    }

    if (url.pathname === "/rest/v1/produtos") {
      productRequests.push(request.url());
      await route.fulfill({ status: 500, json: { message: "consulta proibida" } });
      return;
    }

    if (url.pathname === "/rest/v1/veiculos_estoque") {
      if (request.method() === "PATCH") {
        ctaPayload = request.postDataJSON();
        await route.fulfill({
          status: 200,
          headers: { "content-type": "application/json" },
          body: "[]",
        });
      } else {
        await route.fulfill({
          status: 200,
          headers: { "content-type": "application/json" },
          body: JSON.stringify([vehicle]),
        });
      }
      return;
    }

    if (url.pathname === "/rest/v1/meta_connections") {
      await route.fulfill({
        status: 200,
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      return;
    }

    await route.fulfill({
      status: 200,
      headers: { "content-type": "application/json" },
      body: "[]",
    });
  });

  await page.goto("/veiculos");

  await expect(page.getByText("Land Rover Defender")).toBeVisible();
  await expect(page.getByText("1/3")).toBeVisible();
  await expect(page.getByRole("button", { name: "Facebook + Instagram" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Facebook", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Instagram", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Campanha WhatsApp" })).toBeVisible();

  await page.getByRole("switch").click();
  await expect.poll(() => ctaPayload).toEqual({ incluir_cta_whatsapp: true });

  await page.getByRole("button", { name: "Facebook + Instagram" }).click();
  await expect(
    page.getByRole("heading", { name: "Publicar no Facebook + Instagram" }),
  ).toBeVisible();
  await expect(page.getByText("3 fotos — carrossel na publicação imediata")).toBeVisible();

  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Campanha WhatsApp" }).click();
  await expect(
    page.getByRole("heading", {
      name: "🚀 Criar Campanha WhatsApp - Land Rover Defender 110",
    }),
  ).toBeVisible();
  expect(productRequests).toEqual([]);
});
