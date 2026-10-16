import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  shouldFireSilvesterExtractHook,
  silvesterDossieEnabledForTenant,
} from "./silvester-dossie-gate.ts";

Deno.test("silvesterDossieEnabledForTenant — false quando coluna false", async () => {
  const sb = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { silvester_dossie_ativo: false },
          }),
        }),
      }),
    }),
  };
  assertEquals(await silvesterDossieEnabledForTenant(sb, "u1"), false);
});

Deno.test("silvesterDossieEnabledForTenant — true só quando explícito", async () => {
  const sb = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { silvester_dossie_ativo: true },
          }),
        }),
      }),
    }),
  };
  assertEquals(await silvesterDossieEnabledForTenant(sb, "u1"), true);
});

Deno.test("shouldFireSilvesterExtractHook — exige flag e cliente", () => {
  assertEquals(
    shouldFireSilvesterExtractHook({
      inboundFromOwner: false,
      tenantOwnerPhone: "5511999999999",
      silvesterEnabled: true,
    }),
    true,
  );
  assertEquals(
    shouldFireSilvesterExtractHook({
      inboundFromOwner: false,
      tenantOwnerPhone: "5511999999999",
      silvesterEnabled: false,
    }),
    false,
  );
  assertEquals(
    shouldFireSilvesterExtractHook({
      inboundFromOwner: true,
      tenantOwnerPhone: "5511999999999",
      silvesterEnabled: true,
    }),
    false,
  );
});
