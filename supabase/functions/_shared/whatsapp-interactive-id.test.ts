import {
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  extractWhatsAppInteractiveId,
  isGestaoInteractiveId,
  stripWhatsAppInteractiveMarkers,
} from "./whatsapp-interactive-id.ts";

Deno.test("ESTAB-1 — extrai o ID bruto de todos os formatos interativos", () => {
  assertEquals(
    extractWhatsAppInteractiveId({
      interactive: { button_reply: { id: "cofre_possivel_guardar:doc-1" } },
    }),
    "cofre_possivel_guardar:doc-1",
  );
  assertEquals(
    extractWhatsAppInteractiveId({
      interactive: { list_reply: { id: "cofre_doc_guardar:doc-1" } },
    }),
    "cofre_doc_guardar:doc-1",
  );
  assertEquals(
    extractWhatsAppInteractiveId({
      button: { payload: "veiculo_vitrine:detalhe:v-1" },
    }),
    "veiculo_vitrine:detalhe:v-1",
  );
});

Deno.test("ESTAB-1 — texto livre nunca contém marcador nem ID", () => {
  assertEquals(
    stripWhatsAppInteractiveMarkers(
      "Não é documento\n<<INTERACTIVE_ID:cofre_possivel_liberar:8222abcd-1111-2222-3333-444455556666>>",
    ),
    "Não é documento",
  );
});

Deno.test("ESTAB-1 — somente IDs da Gestão podem chegar a intenção mutável", () => {
  assertEquals(isGestaoInteractiveId("gestao_troca_wa:pick:1"), true);
  assertEquals(isGestaoInteractiveId("molicar_wa:confirmar:1"), true);
  assertEquals(
    isGestaoInteractiveId(
      "cofre_possivel_liberar:8222abcd-1111-2222-3333-444455556666",
    ),
    false,
  );
});
