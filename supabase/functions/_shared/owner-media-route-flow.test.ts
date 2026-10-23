import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  mergeOwnerMediaRoute,
  resolveVehiclePhotoBatchAdAction,
} from "./owner-media-route.ts";
import {
  ownerProductAdDataReply,
  ownerProductPhotoPendingFromRoute,
} from "./owner-media-route-flow.ts";

Deno.test("revenda + foto repetida de tapete + Anúncio → fluxo produto", () => {
  const routes = mergeOwnerMediaRoute({}, "tapete-1", {
    route: "geral",
    origin: "visao",
    vision_description: "tapetes automotivos e capas de banco",
    confirmed: true,
  });
  assertEquals(resolveVehiclePhotoBatchAdAction(routes["tapete-1"]?.route), "product_ad");
  const pending = ownerProductPhotoPendingFromRoute({
    mediaId: "tapete-1",
    visionDescription: routes["tapete-1"]?.vision_description,
    stage: "ad_data",
    confirmed: true,
  });
  assertEquals(pending.confirmed_product_title, "tapetes automotivos e capas de banco");
  assertEquals(
    ownerProductAdDataReply(pending).includes("tapetes automotivos"),
    true,
  );
});

Deno.test("revenda + foto repetida de carro + Anúncio → identificação veículo", () => {
  const routes = mergeOwnerMediaRoute({}, "carro-1", {
    route: "veiculo",
    origin: "visao",
    vision_description: "SUV cinza em pátio",
    confirmed: true,
  });
  assertEquals(
    resolveVehiclePhotoBatchAdAction(routes["carro-1"]?.route),
    "vehicle_identification",
  );
});
