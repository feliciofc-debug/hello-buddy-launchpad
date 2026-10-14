import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
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
