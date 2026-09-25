import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  extractClientNameFromLogoRequest,
  findClientBrandIdentity,
  normalizeClientBrandName,
  saveClientBrandIdentity,
} from "./client-brand-identity.ts";

Deno.test("extrai cliente citado no pedido de guardar logo", () => {
  assertEquals(
    extractClientNameFromLogoRequest(
      "esse e o logo do Casarao Lustres, guarda ele para usar nos videos e posts desse cliente",
    ),
    "Casarao Lustres",
  );
  assertEquals(
    extractClientNameFromLogoRequest("Salva esta logomarca da Clínica São José para os vídeos"),
    "Clínica São José",
  );
  assertEquals(
    extractClientNameFromLogoRequest("Guarde como logo do Casarão Lustres."),
    "Casarão Lustres",
  );
  assertEquals(
    extractClientNameFromLogoRequest("Use essa como logo oficial da Loja Central"),
    "Loja Central",
  );
});

Deno.test("não inventa cliente quando o pedido de logo não informa nome", () => {
  assertEquals(extractClientNameFromLogoRequest("guarda esse logo do cliente"), null);
  assertEquals(extractClientNameFromLogoRequest("guarda esta imagem"), null);
});

Deno.test("normaliza nome para correspondência com domínio", () => {
  assertEquals(normalizeClientBrandName("Casarão Lustres"), "casaraolustres");
});

Deno.test("persiste logo por cliente e recupera antes pelo domínio", async () => {
  const rows: Array<Record<string, unknown>> = [];
  const sb = {
    from: () => ({
      select: () => {
        const query = {
          eq: () => query,
          limit: async () => ({ data: rows, error: null }),
        };
        return query;
      },
      upsert: (payload: Record<string, unknown>) => {
        const index = rows.findIndex((row) =>
          row.user_id === payload.user_id && row.normalized_name === payload.normalized_name
        );
        const saved = { id: "identity-1", ...payload };
        if (index >= 0) rows[index] = saved;
        else rows.push(saved);
        return {
          select: () => ({
            single: async () => ({ data: saved, error: null }),
          }),
        };
      },
    }),
  };

  await saveClientBrandIdentity(sb, {
    userId: "tenant-1",
    clientName: "Casarão Lustres",
    siteUrl: "https://www.casaraolustres.com.br",
    logoPath: "tenant-1/client-brands/casarao-logo.png",
  });

  const found = await findClientBrandIdentity(sb, "tenant-1", {
    site: "casaraolustres.com.br",
  });
  assertEquals(found?.client_name, "Casarão Lustres");
  assertEquals(found?.logo_path, "tenant-1/client-brands/casarao-logo.png");
});
