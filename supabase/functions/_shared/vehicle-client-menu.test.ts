import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  CLIENT_MENU_ROUTES,
  clientTypeLabel,
} from "../../../src/lib/client-menu-routes.ts";

Deno.test("rota de estoque usa menu exclusivo de veículos", () => {
  assertEquals(CLIENT_MENU_ROUTES["/veiculos"], "veiculos");
  assertEquals(CLIENT_MENU_ROUTES["/meus-produtos"], "produtos");
});

Deno.test("tipo de revenda aparece com nome amigável no admin", () => {
  assertEquals(clientTypeLabel("revenda_veiculos"), "Revenda de veículos");
  assertEquals(clientTypeLabel("empresa"), "empresa");
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
