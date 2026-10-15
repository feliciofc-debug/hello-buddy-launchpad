import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  CLIENT_MENU_ROUTES,
  clientTypeLabel,
  menusForBusinessSegment,
  usesVehicleInventoryMenu,
} from "../../../src/lib/client-menu-routes.ts";

Deno.test("rota de estoque usa menu exclusivo de veículos", () => {
  assertEquals(CLIENT_MENU_ROUTES["/veiculos"], "veiculos");
  assertEquals(CLIENT_MENU_ROUTES["/meus-produtos"], "produtos");
});

Deno.test("tipo legado mantém nome amigável, mas não é oferecido no cadastro", async () => {
  assertEquals(clientTypeLabel("revenda_veiculos"), "Revenda de veículos");
  assertEquals(clientTypeLabel("empresa"), "empresa");
  const admin = await Deno.readTextFile("src/pages/AdminCriarCliente.tsx");
  assert(admin.includes('.neq("tipo_cliente", "revenda_veiculos")'));
});

Deno.test("dashboard posiciona Veículos no lugar de Produtos", async () => {
  const source = await Deno.readTextFile("src/pages/DashboardMetricas.tsx");
  const productsItem = source.indexOf(
    "{ id: 'produtos', icon: Package",
  );
  const vehiclesItem = source.indexOf(
    "{ id: 'veiculos', icon: CarFront",
  );
  assert(productsItem >= 0);
  assert(vehiclesItem > productsItem);
  assertEquals(
    source.slice(productsItem, vehiclesItem).includes("id: 'dashboard'"),
    false,
  );
});

Deno.test("estoque de veículos volta para o painel", async () => {
  const source = await Deno.readTextFile("src/pages/vehicle-inventory.tsx");
  assert(source.includes('onClick={() => navigate("/dashboard")}'));
});

Deno.test("empresa com segmento de revenda troca Produtos por Veículos", () => {
  const menus = menusForBusinessSegment(
    ["dashboard", "produtos", "whatsapp", "configuracoes"],
    "empresa",
    "revenda-veiculos-premium",
    "",
  );
  assertEquals(
    menus,
    ["dashboard", "veiculos", "whatsapp", "configuracoes"],
  );
});

Deno.test("automotivo só usa Veículos quando o texto descreve revenda", () => {
  assertEquals(
    usesVehicleInventoryMenu(
      "empresa",
      "automotivo",
      "Compra e venda de veículos seminovos com avaliação na troca.",
    ),
    true,
  );
  assertEquals(
    usesVehicleInventoryMenu(
      "empresa",
      "automotivo",
      "Loja de peças, acessórios e oficina para carros.",
    ),
    false,
  );
});

Deno.test("trocar segmento restaura Produtos sem mudar os demais menus", () => {
  const dealerMenus = menusForBusinessSegment(
    ["dashboard", "produtos", "ia-marketing"],
    "empresa",
    "revenda-veiculos-premium",
    "",
  );
  const partsMenus = menusForBusinessSegment(
    dealerMenus,
    "empresa",
    "automotivo",
    "Venda de autopeças e acessórios com instalação.",
  );
  assertEquals(partsMenus, ["dashboard", "produtos", "ia-marketing"]);
});

Deno.test("tipo legado mantém menu de veículos por compatibilidade", () => {
  assertEquals(
    menusForBusinessSegment(
      ["dashboard", "produtos", "whatsapp"],
      "revenda_veiculos",
      "outros",
      "",
    ),
    ["dashboard", "veiculos", "whatsapp"],
  );
});

Deno.test("hook central aplica segmento a todos os consumidores de menu", async () => {
  const hook = await Deno.readTextFile("src/hooks/useClientMenus.ts");
  const legacyDashboard = await Deno.readTextFile("src/pages/Dashboard.tsx");
  assert(hook.includes(".from('empresa_config')"));
  assert(hook.includes(".select('segmento, sobre_negocio, vitrine_veiculos_demo')"));
  assert(hook.includes("shouldShowFinanciamentosMenu"));
  assert(hook.includes("menusForBusinessSegment("));
  assert(hook.includes("userTipo === VEHICLE_DEALER_TENANT_TYPE"));
  assert(legacyDashboard.includes("isMenuAllowed('veiculos')"));
  assert(legacyDashboard.includes('href="/veiculos"'));
});
