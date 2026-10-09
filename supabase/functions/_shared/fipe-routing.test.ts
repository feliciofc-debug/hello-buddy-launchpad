import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  fipeInputFromConfirmedVehicle,
  isExplicitFipeRequest,
  vehicleFipeTurn,
} from "./fipe-routing.ts";

const confirmedTank = {
  confirmed: true,
  confirmed_title: "GWM Tank 300",
  identification: { marca: "GWM", modelo: "Tank 300" },
  data: { titulo: "GWM Tank 300" },
};

Deno.test("FIPE explícita tem precedência sobre identificação de anúncio", () => {
  const request = "qual a fipe desse carro?";
  const input = fipeInputFromConfirmedVehicle(request, confirmedTank);
  assertEquals(input.marca, "GWM");
  assertEquals(input.modelo, "Tank 300");
  assertEquals(vehicleFipeTurn(request, input), "fipe_ask_year");
  assertEquals(vehicleFipeTurn("2025", input, true), "fipe_pending");
});

Deno.test("FIPE completa do GWM Tank 300 segue direto para consulta", () => {
  const request = "qual a FIPE do GWM Tank 300 2025?";
  const input = fipeInputFromConfirmedVehicle(request, null);
  assertEquals(input, {
    marca: "GWM",
    modelo: "Tank 300",
    ano_modelo: "2025",
    versao: undefined,
    combustivel: undefined,
    cambio: undefined,
    motor: undefined,
  });
  assertEquals(vehicleFipeTurn(request, input), "fipe_lookup");
});

Deno.test("variações explícitas de consulta FIPE não caem no anúncio", () => {
  for (
    const text of [
      "tabela fipe desse carro",
      "consulta a fipe",
      "cota a fipe",
      "quanto vale na fipe",
    ]
  ) {
    assertEquals(isExplicitFipeRequest(text), true, text);
  }
});
