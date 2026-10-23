import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  effectiveOwnerMediaRoute,
  getOwnerMediaRoute,
  mergeOwnerMediaRoute,
  ownerMediaRouteFromDecision,
  resolveVehiclePhotoBatchAdAction,
} from "./owner-media-route.ts";

Deno.test("revenda + visão tapete → rota geral", () => {
  assertEquals(
    ownerMediaRouteFromDecision({
      decision: { route: "geral", needsConfirmation: false },
      vision: { route: "geral", confidence: 0.99, reason: "tapetes" },
    }),
    "geral",
  );
  assertEquals(
    resolveVehiclePhotoBatchAdAction("geral"),
    "product_ad",
  );
});

Deno.test("revenda + visão carro → rota veículo", () => {
  assertEquals(
    ownerMediaRouteFromDecision({
      decision: { route: "veiculo", needsConfirmation: false },
      vision: { route: "veiculo", confidence: 0.98 },
    }),
    "veiculo",
  );
  assertEquals(
    resolveVehiclePhotoBatchAdAction("veiculo"),
    "vehicle_identification",
  );
});

Deno.test("incerto → confirmação antes de anúncio", () => {
  assertEquals(
    ownerMediaRouteFromDecision({
      decision: { route: "geral", needsConfirmation: true },
      vision: { route: "veiculo", confidence: 0.4 },
    }),
    "incerto",
  );
  assertEquals(
    resolveVehiclePhotoBatchAdAction("incerto"),
    "uncertain_confirm",
  );
});

Deno.test("foto repetida reaproveita rota salva confirmada", () => {
  const router = {
    media_routes: mergeOwnerMediaRoute({}, "midia-tapete", {
      route: "geral",
      origin: "botao_dono",
      vision_description: "tapetes automotivos e capas",
      confirmed: true,
    }),
  };
  assertEquals(getOwnerMediaRoute(router, "midia-tapete")?.route, "geral");
  assertEquals(
    effectiveOwnerMediaRoute({
      stored: getOwnerMediaRoute(router, "midia-tapete"),
      decision: { route: "veiculo", needsConfirmation: false },
      vision: { route: "veiculo", confidence: 0.99 },
      automotiveTenant: true,
    }),
    "geral",
  );
});

Deno.test("tenant não automotivo permanece geral", () => {
  assertEquals(
    effectiveOwnerMediaRoute({
      stored: null,
      decision: { route: "veiculo", needsConfirmation: false },
      vision: { route: "veiculo", confidence: 0.99 },
      automotiveTenant: false,
    }),
    "geral",
  );
});
