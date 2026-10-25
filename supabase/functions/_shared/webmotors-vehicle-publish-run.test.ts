import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import type { WmCatalogBundle } from "./webmotors-map-car.ts";
import { runWebmotorsVehiclePublish } from "./webmotors-vehicle-publish-run.ts";

const catalogStub: WmCatalogBundle = {
  marcas: [{ codigo: 1, nome: "Toyota" }],
  modelos: [{ codigo: 10, nome: "Corolla" }],
  versoes: [{ codigo: 100, nome: "X" }],
  cores: [{ codigo: 5, nome: "Preto" }],
  combustiveis: [{ codigo: 3, nome: "Flex" }],
  cambios: [{ codigo: 2, nome: "Auto" }],
  portas: [4],
  modalidades: [{ codigo: 7, nome: "Premium" }],
  opcionais: [],
};

const vehicleRow = {
  id: "v1",
  user_id: "u1",
  marca: "Toyota",
  modelo: "Corolla",
  versao: "X",
  ano_fabricacao: 2020,
  ano_modelo: 2021,
  km: 1000,
  preco: 80000,
  cor: "Preto",
  combustivel: "Flex",
  cambio: "Auto",
  portas: 4,
  blindado: false,
  opcionais: [],
  descricao: "Sem avarias, acabamento interno impecável.",
  fotos: ["https://cdn/f1.jpg"],
  status: "disponivel",
};

function mockSb(portalStore: Record<string, unknown>) {
  return {
    from(table: string) {
      const chain = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => {
          if (table === "veiculos_estoque") return { data: vehicleRow, error: null };
          if (table === "webmotors_veiculo_map") return { data: null, error: null };
          if (table === "veiculos_portais") {
            return { data: portalStore["u1:v1"] ?? null, error: null };
          }
          return { data: null, error: null };
        },
        upsert: (row: Record<string, unknown>) => {
          if (table === "veiculos_portais") {
            portalStore["u1:v1"] = { ...(portalStore["u1:v1"] as object ?? {}), ...row };
          }
          return chain;
        },
        update: (patch: Record<string, unknown>) => ({
          eq: () => ({
            eq: () => ({
              eq: async () => {
                portalStore["u1:v1"] = { ...(portalStore["u1:v1"] as object ?? {}), ...patch };
                return { error: null };
              },
            }),
          }),
        }),
      };
      return chain;
    },
  };
}

const authStub = async () => ({
  hash: "hash-test",
  ambiente: "homolog" as const,
  conta: {
    user_id: "u1",
    cnpj: "00000000000000",
    integration_email: "a@b.c",
    password_enc: "x",
    ambiente: "homolog" as const,
    status: "active",
    default_codigo_modalidade: 7,
  },
});

const catalogLoader = async () => catalogStub;

Deno.test("IncluirCarro ok + foto falha: external_id salvo; segunda publicação não inclui de novo", async () => {
  const portalStore: Record<string, unknown> = {};
  let incluirCalls = 0;
  let portalUpsertsBeforeFoto = 0;

  const sb = mockSb(portalStore);

  const first = await runWebmotorsVehiclePublish(
    sb as any,
    { userId: "u1", veiculoId: "v1" },
    {
      hashForUser: authStub,
      loadCatalog: catalogLoader,
      api: {
        incluirCarro: async () => {
          incluirCalls++;
          return { codigoAnuncio: 5555, codigoRetorno: "0" };
        },
        incluirFotoUrl: async () => {
          portalUpsertsBeforeFoto = (portalStore["u1:v1"] as { external_id?: string })?.external_id
            ? 1
            : 0;
          throw new Error("foto fail");
        },
      },
    },
  );

  assertEquals(first.ok, true);
  assertEquals(first.external_id, "5555");
  assertEquals(portalUpsertsBeforeFoto, 1);
  assertEquals((portalStore["u1:v1"] as { external_id?: string; status?: string }).external_id, "5555");
  assertEquals((portalStore["u1:v1"] as { status?: string }).status, "published");
  assertEquals(incluirCalls, 1);

  incluirCalls = 0;
  const second = await runWebmotorsVehiclePublish(
    sb as any,
    { userId: "u1", veiculoId: "v1" },
    {
      hashForUser: authStub,
      loadCatalog: catalogLoader,
      api: {
        incluirCarro: async () => {
          incluirCalls++;
          return { codigoAnuncio: 9999, codigoRetorno: "0" };
        },
        incluirFotoUrl: async () => 1,
      },
    },
  );

  assertEquals(second.ok, false);
  assertEquals(incluirCalls, 0);
});

Deno.test("TROCA-VENDA-1.1 — Webmotors bloqueia veículo em preparação", async () => {
  const previous = vehicleRow.status;
  vehicleRow.status = "em_preparacao";
  try {
    const result = await runWebmotorsVehiclePublish(
      mockSb({}),
      { userId: "u1", veiculoId: "v1" },
      { hashForUser: authStub, loadCatalog: catalogLoader },
    );
    assertEquals(result.ok, false);
    assertEquals(result.error?.includes("em preparação"), true);
  } finally {
    vehicleRow.status = previous;
  }
});
