import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { getTenantLogo } from "./tenant-logo.ts";

function tenantLogoClient(storagePath: string) {
  const query = {
    select: () => query,
    eq: () => query,
    maybeSingle: async () => ({
      data: {
        id: "logo-1",
        storage_path: storagePath,
        file_name: "logo.png",
        mime_type: "image/png",
        variant: "default",
        ativo: true,
        user_id: "tenant-a",
        generated_automatically: false,
        background_warning: null,
      },
      error: null,
    }),
  };
  return { from: () => query };
}

Deno.test("FIX-VEIC-3.3 — marca aceita somente path do tenant atual", async () => {
  const own = await getTenantLogo(
    tenantLogoClient("tenant-a/default/logo.png"),
    "tenant-a",
  );
  assertEquals(own?.storage_path, "tenant-a/default/logo.png");
  const leaked = await getTenantLogo(
    tenantLogoClient("tenant-b/default/logo.png"),
    "tenant-a",
  );
  assertEquals(leaked, null);
});
