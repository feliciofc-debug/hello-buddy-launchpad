import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  cleanupDocumentPhotoPending,
  isDocumentPhotoCancellation,
  isUnrelatedPhotoConfirmationMessage,
  nextPhotoConfirmationReprompt,
} from "./document-photo-pending.ts";

const NOW = Date.parse("2026-10-26T23:00:00.000Z");

Deno.test("DOC-0.3 — cancelar limpa todas as pendências da foto", () => {
  for (
    const text of [
      "cancelar",
      "cancela",
      "esquece",
      "deixa pra lá",
      "não é nada",
    ]
  ) {
    assertEquals(isDocumentPhotoCancellation(text), true);
  }
  const result = cleanupDocumentPhotoPending({
    pending_single_photo: {
      media_id: "root",
      created_at: "2026-10-26T22:50:00.000Z",
      awaiting_correction: true,
    },
    pending_vehicle_photo_batch: {
      photos: [{ id: "vehicle" }],
      created_at: "2026-10-26T22:50:00.000Z",
    },
    general: {
      pending_single_photo: {
        media_id: "general",
        created_at: "2026-10-26T22:50:00.000Z",
      },
    },
    vertical_router: {
      pending_choice: {
        media_id: "choice",
        awaiting_correction: true,
        created_at: "2026-10-26T22:50:00.000Z",
      },
      media_routes: {
        root: { route: "geral" },
        general: { route: "geral" },
        vehicle: { route: "veiculo" },
        choice: { route: "incerto" },
        keep: { route: "geral" },
      },
    },
  }, { text: "Cancelar", nowMs: NOW });

  assertEquals(result.cancelled, true);
  assertEquals(result.state.pending_single_photo, null);
  assertEquals(result.state.general?.pending_single_photo, null);
  assertEquals(result.state.pending_vehicle_photo_batch, null);
  assertEquals(result.state.vertical_router?.pending_choice, null);
  assertEquals(result.state.vertical_router?.media_routes, {
    keep: { route: "geral" },
  });
});

Deno.test("DOC-0.3 — pendência de foto expira após duas horas", () => {
  const result = cleanupDocumentPhotoPending({
    general: {
      pending_single_photo: {
        media_id: "old",
        created_at: "2026-10-26T20:59:59.000Z",
      },
    },
    vertical_router: {
      pending_choice: {
        media_id: "fresh",
        created_at: "2026-10-26T22:30:00.000Z",
      },
    },
  }, { nowMs: NOW });
  assertEquals(result.state.general?.pending_single_photo, null);
  assertEquals(
    (result.state.vertical_router?.pending_choice as { media_id: string })
      .media_id,
    "fresh",
  );
});

Deno.test("DOC-0.3 — descrição removida ou portão de documento nunca reaparece", () => {
  const marked = cleanupDocumentPhotoPending({
    general: {
      pending_single_photo: {
        media_id: "doc",
        vision_description: "[documento removido por segurança]",
        created_at: "2026-10-26T22:55:00.000Z",
      },
    },
  }, { nowMs: NOW });
  assertEquals(marked.state.general?.pending_single_photo, null);

  const gated = cleanupDocumentPhotoPending({
    vertical_router: {
      pending_choice: {
        media_id: "gate",
        created_at: "2026-10-26T22:55:00.000Z",
      },
    },
  }, { documentDetected: true, nowMs: NOW });
  assertEquals(gated.state.vertical_router?.pending_choice, null);
});

Deno.test("DOC-0.3 — mensagem alheia repete confirmação no máximo uma vez", () => {
  assertEquals(isUnrelatedPhotoConfirmationMessage("Boa noite"), true);
  const first = nextPhotoConfirmationReprompt({
    media_id: "photo",
    stage: "confirm_vision",
  });
  assertEquals(first.reprompt, true);
  assertEquals(first.pending?.reprompt_count, 1);
  const second = nextPhotoConfirmationReprompt(first.pending!);
  assertEquals(second, { pending: null, reprompt: false });
});

Deno.test("DOC-0.3 — processor limpa antes de re-perguntar e antes de tratar documento", async () => {
  const source = await Deno.readTextFile(
    new URL("../whatsapp-cloud-inbound-processor/index.ts", import.meta.url),
  );
  const earlyCleanup = source.indexOf(
    "// DOC-0.3 — limpa foto presa antes de qualquer atalho ou re-pergunta.",
  );
  const confirmation = source.indexOf(
    'pendingSinglePhoto?.stage === "confirm_vision"',
  );
  assertEquals(earlyCleanup >= 0, true);
  assertEquals(earlyCleanup < confirmation, true);
  assertEquals(source.includes('const reply = "Ok, cancelado."'), true);
  assertEquals(
    source.includes(
      "if (fromIsOwner && (detectedDocument || possibleDocument))",
    ),
    true,
  );
});
