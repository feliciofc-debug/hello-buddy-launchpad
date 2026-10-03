import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  clearTenantOwnerCache,
  resolveTenantOwner,
  tenantOwnerMatchesPhone,
} from "./amz-context.ts";
import {
  brazilianPhoneKey,
  brazilianPhoneLookupVariants,
  normalizeOwnerPhone,
  ownerPhonesEquivalent,
} from "./owner-phone.ts";

Deno.test("normaliza telefone brasileiro com ou sem DDI 55", () => {
  assertEquals(normalizeOwnerPhone("(21) 96752-0706"), "5521967520706");
  assertEquals(normalizeOwnerPhone("+55 21 96752-0706"), "5521967520706");
  assertEquals(normalizeOwnerPhone("21 6752-0706"), "552167520706");
  assertEquals(normalizeOwnerPhone("55 21 6752-0706"), "552167520706");
});

Deno.test("considera equivalentes celulares com e sem o nono dígito", () => {
  assertEquals(
    ownerPhonesEquivalent("5521967520706", "552167520706"),
    true,
  );
  assertEquals(
    ownerPhonesEquivalent("(21) 96752-0706", "21 6752-0706"),
    true,
  );
  assertEquals(
    ownerPhonesEquivalent("5521967520706", "5511999999999"),
    false,
  );
});

Deno.test("gera chave e variantes estáveis para bloqueio por telefone", () => {
  assertEquals(
    brazilianPhoneKey("+55 (21) 96752-0706"),
    brazilianPhoneKey("21 6752-0706"),
  );
  assertEquals(brazilianPhoneLookupVariants("5521967520706"), [
    "5521967520706",
    "21967520706",
    "552167520706",
    "2167520706",
  ]);
});

Deno.test("tenant sem owner_phone não reconhece nenhum remetente como dono", async () => {
  clearTenantOwnerCache("tenant-sem-owner");
  const sb = mockOwnerClient({
    owner_phone: null,
    owner_name: null,
    owner_alt_phones: [],
  });
  const owner = await resolveTenantOwner(sb as never, "tenant-sem-owner", {
    fresh: true,
  });
  assertEquals(owner.phone, null);
  assertEquals(tenantOwnerMatchesPhone(owner, "5521967520706"), false);
});

Deno.test("leitura nova por mensagem reconhece o dono logo após salvar", async () => {
  clearTenantOwnerCache("tenant-atualizado");
  let row = {
    owner_phone: null as string | null,
    owner_name: null as string | null,
    owner_alt_phones: [] as string[],
  };
  const sb = mockOwnerClient(() => row);

  const before = await resolveTenantOwner(sb as never, "tenant-atualizado", {
    fresh: true,
  });
  assertEquals(before.phone, null);

  row = {
    owner_phone: "(21) 96752-0706",
    owner_name: "Marcelo",
    owner_alt_phones: [],
  };
  const after = await resolveTenantOwner(sb as never, "tenant-atualizado", {
    fresh: true,
  });
  assertEquals(after.phone, "5521967520706");
  assertEquals(tenantOwnerMatchesPhone(after, "552167520706"), true);
});

function mockOwnerClient(
  value:
    | Record<string, unknown>
    | (() => Record<string, unknown>),
) {
  return {
    from: () => ({
      select: () => {
        const query = {
          eq: () => query,
          maybeSingle: async () => ({
            data: typeof value === "function" ? value() : value,
            error: null,
          }),
        };
        return query;
      },
    }),
  };
}
