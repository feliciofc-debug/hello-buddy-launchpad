import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  cleanupStaleRenaveDocuments,
  RENAVE_DOCUMENT_REMOVAL_DELAY_MS,
  type RenaveDocumentStorage,
  scheduleRenaveDocumentRemoval,
} from "./renave-document-storage.ts";

function fakeStorage(input: {
  files?: { name: string; created_at: string }[];
  removed: string[][];
}): RenaveDocumentStorage {
  return {
    from: () => ({
      list: async () => ({ data: input.files ?? [], error: null }),
      remove: async (paths) => {
        input.removed.push(paths);
        return { error: null };
      },
    }),
  };
}

Deno.test("RENAVE-3.1 — limpeza remove somente PDFs com mais de 30 minutos", async () => {
  const removed: string[][] = [];
  const now = Date.parse("2026-11-06T15:00:00Z");
  const storage = fakeStorage({
    removed,
    files: [
      {
        name: "antigo.pdf",
        created_at: "2026-11-06T14:29:59Z",
      },
      {
        name: "recente.pdf",
        created_at: "2026-11-06T14:30:01Z",
      },
    ],
  });
  assertEquals(
    await cleanupStaleRenaveDocuments(storage, "tenant-1", now),
    1,
  );
  assertEquals(removed, [["tenant-1/renave/antigo.pdf"]]);
});

Deno.test("RENAVE-3.1 — remoção após envio é agendada para 15 minutos", async () => {
  const removed: string[][] = [];
  const storage = fakeStorage({ removed });
  const callbacks: Array<() => void> = [];
  let delay = 0;
  scheduleRenaveDocumentRemoval(
    storage,
    "tenant-1/renave/documento.pdf",
    (scheduled, delayMs) => {
      callbacks.push(scheduled);
      delay = delayMs;
      return 1;
    },
  );
  assertEquals(removed, []);
  assertEquals(delay, RENAVE_DOCUMENT_REMOVAL_DELAY_MS);
  assertEquals(delay, 15 * 60 * 1000);
  callbacks[0]();
  await Promise.resolve();
  assertEquals(removed, [["tenant-1/renave/documento.pdf"]]);
});
