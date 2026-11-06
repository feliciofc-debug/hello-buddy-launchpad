const RENAVE_DOCUMENT_BUCKET = "gestao-os-documentos";
const RENAVE_DOCUMENT_RETENTION_MS = 30 * 60 * 1000;
export const RENAVE_DOCUMENT_REMOVAL_DELAY_MS = 15 * 60 * 1000;

type StorageFile = {
  name?: string;
  created_at?: string;
};

export type RenaveDocumentStorage = {
  from: (bucket: string) => {
    list: (
      path: string,
      options: {
        limit: number;
        sortBy: { column: string; order: "asc" | "desc" };
      },
    ) => Promise<{
      data: StorageFile[] | null;
      error: { message?: string } | null;
    }>;
    remove: (paths: string[]) => Promise<{
      error: { message?: string } | null;
    }>;
  };
};

function logCleanupFailure(operation: string, started: number): void {
  console.warn("[renave-documento] falha", {
    operacao: operation,
    status: 500,
    duracaoMs: Math.round(performance.now() - started),
  });
}

export async function removeRenaveDocument(
  storage: RenaveDocumentStorage,
  path: string,
): Promise<boolean> {
  const started = performance.now();
  try {
    const { error } = await storage.from(RENAVE_DOCUMENT_BUCKET).remove([path]);
    if (error) throw error;
    return true;
  } catch {
    logCleanupFailure("removerDocumentoTemporario", started);
    return false;
  }
}

export async function cleanupStaleRenaveDocuments(
  storage: RenaveDocumentStorage,
  userId: string,
  nowMs = Date.now(),
): Promise<number> {
  const started = performance.now();
  try {
    const prefix = `${userId}/renave`;
    const { data, error } = await storage.from(RENAVE_DOCUMENT_BUCKET).list(
      prefix,
      {
        limit: 100,
        sortBy: { column: "created_at", order: "asc" },
      },
    );
    if (error) throw error;
    const stalePaths = (data ?? []).flatMap((file) => {
      const createdAt = Date.parse(String(file.created_at ?? ""));
      const name = String(file.name ?? "").trim();
      return name &&
          Number.isFinite(createdAt) &&
          nowMs - createdAt > RENAVE_DOCUMENT_RETENTION_MS
        ? [`${prefix}/${name}`]
        : [];
    });
    if (!stalePaths.length) return 0;
    const removal = await storage.from(RENAVE_DOCUMENT_BUCKET).remove(
      stalePaths,
    );
    if (removal.error) throw removal.error;
    return stalePaths.length;
  } catch {
    logCleanupFailure("limparDocumentosExpirados", started);
    return 0;
  }
}

export function scheduleRenaveDocumentRemoval(
  storage: RenaveDocumentStorage,
  path: string,
  setTimer: (callback: () => void, delayMs: number) => unknown = setTimeout,
): void {
  setTimer(() => {
    void removeRenaveDocument(storage, path);
  }, RENAVE_DOCUMENT_REMOVAL_DELAY_MS);
}
