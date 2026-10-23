import type {
  InboundVertical,
  VerticalDecision,
  VerticalVisionResult,
} from "./vertical-router.ts";

export type OwnerMediaVerticalRoute = "veiculo" | "geral" | "incerto";
export type OwnerMediaRouteOrigin = "visao" | "botao_dono";

export type OwnerMediaRouteEntry = {
  route: OwnerMediaVerticalRoute;
  origin: OwnerMediaRouteOrigin;
  vision_description?: string;
  confirmed?: boolean;
  updated_at: string;
};

export type OwnerMediaRoutesMap = Record<string, OwnerMediaRouteEntry>;

export type VerticalRouterMediaState = {
  media_routes?: OwnerMediaRoutesMap | null;
};

const MAX_MEDIA_ROUTES = 40;

export function ownerMediaRoutesFromRouter(
  router: VerticalRouterMediaState | null | undefined,
): OwnerMediaRoutesMap {
  const raw = router?.media_routes;
  if (!raw || typeof raw !== "object") return {};
  return { ...raw };
}

export function getOwnerMediaRoute(
  router: VerticalRouterMediaState | null | undefined,
  mediaId: string,
): OwnerMediaRouteEntry | null {
  const id = String(mediaId || "").trim();
  if (!id) return null;
  const entry = ownerMediaRoutesFromRouter(router)[id];
  return entry && entry.route ? entry : null;
}

function visionOwnerRoute(
  vision?: VerticalVisionResult | null,
): OwnerMediaVerticalRoute | null {
  if (!vision || vision.confidence < 0.65) return null;
  return vision.route === "veiculo" ? "veiculo" : "geral";
}

export function ownerMediaRouteFromDecision(input: {
  decision: Pick<VerticalDecision, "route" | "needsConfirmation">;
  vision?: VerticalVisionResult | null;
}): OwnerMediaVerticalRoute {
  const fromVision = visionOwnerRoute(input.vision);
  if (fromVision) return fromVision;
  if (input.decision.needsConfirmation) return "incerto";
  return input.decision.route === "veiculo" ? "veiculo" : "geral";
}

export function effectiveOwnerMediaRoute(input: {
  stored: OwnerMediaRouteEntry | null;
  decision: Pick<VerticalDecision, "route" | "needsConfirmation">;
  vision?: VerticalVisionResult | null;
  automotiveTenant: boolean;
}): OwnerMediaVerticalRoute {
  if (!input.automotiveTenant) return "geral";
  if (input.stored?.confirmed && input.stored.route) {
    return input.stored.route;
  }
  if (input.stored?.route && input.stored.origin === "botao_dono") {
    return input.stored.route;
  }
  if (input.stored?.route && !input.decision.needsConfirmation) {
    return input.stored.route;
  }
  return ownerMediaRouteFromDecision({
    decision: input.decision,
    vision: input.vision,
  });
}

export function mergeOwnerMediaRoute(
  current: OwnerMediaRoutesMap,
  mediaId: string,
  patch: {
    route: OwnerMediaVerticalRoute;
    origin: OwnerMediaRouteOrigin;
    vision_description?: string;
    confirmed?: boolean;
  },
  nowIso = new Date().toISOString(),
): OwnerMediaRoutesMap {
  const id = String(mediaId || "").trim();
  if (!id) return current;
  const next: OwnerMediaRoutesMap = {
    ...current,
    [id]: {
      route: patch.route,
      origin: patch.origin,
      vision_description: patch.vision_description ??
        current[id]?.vision_description,
      confirmed: patch.confirmed ?? current[id]?.confirmed,
      updated_at: nowIso,
    },
  };
  const keys = Object.keys(next);
  if (keys.length <= MAX_MEDIA_ROUTES) return next;
  const sorted = keys.sort((a, b) =>
    String(next[b]?.updated_at || "").localeCompare(
      String(next[a]?.updated_at || ""),
    )
  );
  const trimmed: OwnerMediaRoutesMap = {};
  for (const key of sorted.slice(0, MAX_MEDIA_ROUTES)) {
    trimmed[key] = next[key];
  }
  return trimmed;
}

export function ownerMediaRouteToInboundVertical(
  route: OwnerMediaVerticalRoute,
): InboundVertical {
  return route === "veiculo" ? "veiculo" : "geral";
}

export type VehiclePhotoBatchAdAction =
  | "vehicle_identification"
  | "product_ad"
  | "uncertain_confirm";

export function resolveVehiclePhotoBatchAdAction(
  route: OwnerMediaVerticalRoute | null | undefined,
): VehiclePhotoBatchAdAction {
  if (route === "geral") return "product_ad";
  if (route === "incerto") return "uncertain_confirm";
  return "vehicle_identification";
}

export type VehiclePhotoBatchCarouselAction =
  | "vehicle_carousel"
  | "product_actions"
  | "uncertain_confirm";

export function resolveVehiclePhotoBatchCarouselAction(
  route: OwnerMediaVerticalRoute | null | undefined,
): VehiclePhotoBatchCarouselAction {
  if (route === "geral") return "product_actions";
  if (route === "incerto") return "uncertain_confirm";
  return "vehicle_carousel";
}
