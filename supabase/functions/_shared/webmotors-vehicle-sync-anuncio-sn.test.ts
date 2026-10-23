import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import type { WmAnuncioPayload } from "./webmotors-car-api.ts";
import type { WmCatalogBundle } from "./webmotors-map-car.ts";
import { runWebmotorsVehicleSync } from "./webmotors-vehicle-sync-run.ts";

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
  placa: "ABC1D23",
  segmento: "carro",
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
  descricao: "Sem avarias.",
  fotos: ["https://cdn/f1.jpg"],
  status: "disponivel",
};

function syncSb(portalRow: Record<string, unknown>) {
  let lastPortalUpdate: Record<string, unknown> | null = null;
  const fotoLinks = [{
    url_amz: "https://cdn/f1.jpg",
    ordem: 0,
    codigo_foto_wm: 1,
  }];
  return {
    sb: {
      from(table: string) {
        const chain = {
          select: () => chain,
          eq: (_col?: string, _val?: unknown) => {
            if (table === "webmotors_foto_vinculo") {
              return {
                eq: async () => ({ data: fotoLinks, error: null }),
              };
            }
            return chain;
          },
          maybeSingle: async () => {
            if (table === "veiculos_estoque") {
              return { data: vehicleRow, error: null };
            }
            if (table === "veiculos_portais") {
              return { data: portalRow, error: null };
            }
            if (table === "webmotors_veiculo_map") {
              return { data: null, error: null };
            }
            return { data: null, error: null };
          },
          update: (patch: Record<string, unknown>) => ({
            eq: () => ({
              eq: () => ({
                eq: async () => {
                  if (table === "veiculos_portais") {
                    lastPortalUpdate = patch;
                    Object.assign(portalRow, patch);
                  }
                  return { error: null };
                },
              }),
            }),
          }),
        };
        return chain;
      },
    },
    getLastUpdate: () => lastPortalUpdate,
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

Deno.test("WEBMOTORS-1.2 — AlterarCarro no sync usa anuncio_sn salvo", async () => {
  const payloads: WmAnuncioPayload[] = [];
  const portal = {
    external_id: "123",
    managed_by_platform: true,
    anuncio_sn: { IpvaPago: "S", UnicoDono: "N" },
  };
  const { sb } = syncSb(portal);
  const result = await runWebmotorsVehicleSync(
    sb as any,
    { userId: "u1", veiculoId: "v1" },
    {
      hashForUser: authStub,
      loadCatalog: async () => catalogStub,
      alterarCarro: async (_a, _h, payload) => {
        payloads.push(payload);
      },
    },
  );
  assertEquals(result.ok, true);
  const sent = payloads[0] as WmAnuncioPayload;
  assertEquals(sent.IpvaPago, "S");
});

Deno.test("WEBMOTORS-1.2 — sync com anuncio_sn no request persiste jsonb", async () => {
  const payloads: WmAnuncioPayload[] = [];
  const portal = {
    external_id: "123",
    managed_by_platform: true,
    anuncio_sn: { IpvaPago: "S" },
  };
  const { sb, getLastUpdate } = syncSb(portal);
  const result = await runWebmotorsVehicleSync(
    sb as any,
    { userId: "u1", veiculoId: "v1", anuncioSn: { UnicoDono: true } },
    {
      hashForUser: authStub,
      loadCatalog: async () => catalogStub,
      alterarCarro: async (_a, _h, payload) => {
        payloads.push(payload);
      },
    },
  );
  assertEquals(result.ok, true);
  const sent = payloads[0] as WmAnuncioPayload;
  assertEquals(sent.UnicoDono, "S");
  assertEquals(sent.IpvaPago, "N");
  assertEquals((getLastUpdate()?.anuncio_sn as { UnicoDono: string }).UnicoDono, "S");
});
