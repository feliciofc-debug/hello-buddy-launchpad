import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { OWNER_VITRINE_CLIENT_PREVIEW_MSG } from "./vehicle-stock-owner-inbound.ts";

Deno.test("mensagem fixa da vitrine do dono", () => {
  assertEquals(
    OWNER_VITRINE_CLIENT_PREVIEW_MSG,
    "Isso é o que o cliente vê 🙂",
  );
});
