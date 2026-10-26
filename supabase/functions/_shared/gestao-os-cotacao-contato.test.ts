import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  deveExibirMotivoRejeicaoMetaTemplate,
  formatWhatsAppDisplayPhoneBr,
  resolveLojaContatoParaPdf,
} from "./gestao-os-cotacao-contato.ts";

Deno.test("COTACAO-WPP-1.5 — motivo NONE não aparece fora de rejeitado real", () => {
  assertEquals(deveExibirMotivoRejeicaoMetaTemplate("aprovado", "NONE"), false);
  assertEquals(deveExibirMotivoRejeicaoMetaTemplate("pendente", "NONE"), false);
  assertEquals(deveExibirMotivoRejeicaoMetaTemplate("rejeitado", "NONE"), false);
  assertEquals(deveExibirMotivoRejeicaoMetaTemplate("rejeitado", "none"), false);
  assertEquals(deveExibirMotivoRejeicaoMetaTemplate("rejeitado", "POLICY"), true);
});

Deno.test("COTACAO-WPP-1.5 — contato PDF usa WhatsApp e cai no e-mail", async () => {
  assertEquals(
    formatWhatsAppDisplayPhoneBr("5521987654321"),
    "+55 21 98765-4321",
  );

  const sbWa = {
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => (table === "whatsapp_config"
            ? { data: { display_phone: "+55 21 98765-4321" }, error: null }
            : { data: null, error: null }),
        }),
      }),
    }),
    auth: { admin: { getUserById: async () => ({ data: { user: null }, error: null }) } },
  };
  assertEquals(
    await resolveLojaContatoParaPdf(sbWa as never, "user-1"),
    "+55 21 98765-4321",
  );

  const sbEmail = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: null }),
        }),
      }),
    }),
    auth: {
      admin: {
        getUserById: async () => ({
          data: { user: { email: "loja@example.com" } },
          error: null,
        }),
      },
    },
  };
  assertEquals(
    await resolveLojaContatoParaPdf(sbEmail as never, "user-2"),
    "loja@example.com",
  );
});
