import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  CANONICAL_AMZ_TENANT_ID,
  resolveAmzTenantId,
} from "./amz-tenant.ts";

Deno.test("usa AMZ_TENANT_ID válido no runtime", () => {
  const previous = Deno.env.get("AMZ_TENANT_ID");
  try {
    Deno.env.set("AMZ_TENANT_ID", "11111111-1111-4111-8111-111111111111");
    assertEquals(resolveAmzTenantId(), "11111111-1111-4111-8111-111111111111");
  } finally {
    if (previous == null) Deno.env.delete("AMZ_TENANT_ID");
    else Deno.env.set("AMZ_TENANT_ID", previous);
  }
});

Deno.test("nunca recua para o UUID Lovable legado", () => {
  const previous = Deno.env.get("AMZ_TENANT_ID");
  try {
    Deno.env.delete("AMZ_TENANT_ID");
    assertEquals(resolveAmzTenantId(), CANONICAL_AMZ_TENANT_ID);
    assertEquals(CANONICAL_AMZ_TENANT_ID, "561e0ccc-3eda-4dc1-a315-c86a51623fc3");
  } finally {
    if (previous != null) Deno.env.set("AMZ_TENANT_ID", previous);
  }
});
