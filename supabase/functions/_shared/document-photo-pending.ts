export const DOCUMENT_PHOTO_PENDING_TTL_MS = 2 * 60 * 60 * 1000;

type Pending = Record<string, unknown> | null | undefined;
type State = Record<string, unknown> & {
  general?: Record<string, unknown>;
  vehicle?: Record<string, unknown>;
  vertical_router?: Record<string, unknown>;
};

function normalize(value: string): string {
  return String(value || "").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.!?,;:]+$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function isDocumentPhotoCancellation(text: string): boolean {
  return /^(?:cancelar|cancela|esquece|deixa pra la|nao e nada)$/.test(
    normalize(text),
  );
}

export function isUnrelatedPhotoConfirmationMessage(text: string): boolean {
  return /^(?:oi|ola|bom dia|boa tarde|boa noite|obrigad[oa]|valeu|tudo bem)(?:\s.*)?$/
    .test(normalize(text));
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function expired(value: Pending, nowMs: number): boolean {
  const createdAt = Date.parse(String(value?.created_at ?? ""));
  return Number.isFinite(createdAt) &&
    nowMs - createdAt > DOCUMENT_PHOTO_PENDING_TTL_MS;
}

function removedDocument(value: Pending): boolean {
  return /\[documento removido/i.test(
    String(value?.vision_description ?? ""),
  );
}

function mediaIds(value: Pending): string[] {
  const ids = [
    value?.media_id,
    ...(Array.isArray(value?.media_ids) ? value.media_ids : []),
    ...(Array.isArray(value?.photos)
      ? value.photos.map((photo) => record(photo)?.id ?? photo)
      : []),
  ];
  return ids.filter((value) => value != null && value !== "").map(String);
}

export type DocumentPhotoPendingCleanup = {
  state: State;
  changed: boolean;
  hadPending: boolean;
  cancelled: boolean;
};

export function cleanupDocumentPhotoPending(
  input: State,
  options: {
    text?: string;
    nowMs?: number;
    documentDetected?: boolean;
  } = {},
): DocumentPhotoPendingCleanup {
  const state = structuredClone(input ?? {}) as State;
  const nowMs = options.nowMs ?? Date.now();
  const cancelled = isDocumentPhotoCancellation(options.text ?? "");
  const general = record(state.general) ?? {};
  const vehicle = record(state.vehicle) ?? {};
  const router = record(state.vertical_router) ?? {};
  const locations: Array<{
    bucket: Record<string, unknown>;
    key: "pending_single_photo" | "pending_vehicle_photo_batch";
  }> = [
    { bucket: state, key: "pending_single_photo" },
    { bucket: general, key: "pending_single_photo" },
    { bucket: state, key: "pending_vehicle_photo_batch" },
    { bucket: vehicle, key: "pending_vehicle_photo_batch" },
  ];
  const pendingChoice = record(router.pending_choice);
  const values = [
    ...locations.map(({ bucket, key }) => record(bucket[key])),
    pendingChoice,
  ].filter((value): value is Record<string, unknown> => !!value);
  const hadPending = values.length > 0;
  const documentInPending = values.some(removedDocument);
  const clearAll = cancelled || options.documentDetected === true ||
    documentInPending;
  const removedMediaIds = new Set<string>();
  let changed = false;

  for (const { bucket, key } of locations) {
    const value = record(bucket[key]);
    if (!value) continue;
    if (clearAll || expired(value, nowMs)) {
      mediaIds(value).forEach((id) => removedMediaIds.add(id));
      bucket[key] = null;
      changed = true;
    }
  }
  if (
    pendingChoice &&
    (clearAll || expired(pendingChoice, nowMs) || removedDocument(pendingChoice))
  ) {
    mediaIds(pendingChoice).forEach((id) => removedMediaIds.add(id));
    router.pending_choice = null;
    changed = true;
  }

  const routes = record(router.media_routes);
  if (routes) {
    const nextRoutes = { ...routes };
    for (const [id, routeValue] of Object.entries(routes)) {
      if (
        removedMediaIds.has(id) ||
        (clearAll && removedDocument(record(routeValue)))
      ) {
        delete nextRoutes[id];
        changed = true;
      }
    }
    router.media_routes = nextRoutes;
  }

  if (state.general || changed) state.general = general;
  if (state.vehicle || changed) state.vehicle = vehicle;
  if (state.vertical_router || changed) {
    state.vertical_router = {
      ...router,
      ...(changed ? { updated_at: new Date(nowMs).toISOString() } : {}),
    };
  }
  return { state, changed, hadPending, cancelled };
}

export function nextPhotoConfirmationReprompt(
  pending: Record<string, unknown>,
): { pending: Record<string, unknown> | null; reprompt: boolean } {
  const count = Math.max(0, Number(pending.reprompt_count ?? 0));
  if (count >= 1) return { pending: null, reprompt: false };
  return {
    pending: { ...pending, reprompt_count: 1 },
    reprompt: true,
  };
}
