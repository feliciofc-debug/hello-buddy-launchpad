import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  resolveWebmotorsAnuncioSnForVehicle,
  webmotorsAnuncioSnFromBooleans,
} from "./webmotors-anuncio-sn.ts";
import { mapVehicleToWebmotorsCar } from "./webmotors-map-car.ts";
import type { VeiculoEstoqueRow } from "./webmotors-vehicle-types.ts";

const catalog = {
  marcas: [{ codigo: 1, nome: "Toyota" }],
  modelos: [{ codigo: 10, nome: "Corolla" }],
  versoes: [{ codigo: 100, nome: "XEi" }],
  cores: [{ codigo: 5, nome: "Prata" }],
  combustiveis: [{ codigo: 3, nome: "Flex" }],
  cambios: [{ codigo: 2, nome: "Auto" }],
  portas: [4],
  modalidades: [{ codigo: 7, nome: "Premium" }],
  opcionais: [],
};

const vehicle: VeiculoEstoqueRow = {
  id: "v1",
  user_id: "u1",
  placa: "ABC1D23",
  marca: "Toyota",
  modelo: "Corolla",
  versao: "XEi",
  ano_fabricacao: 2022,
  ano_modelo: 2023,
  km: 1000,
  preco: 90000,
  cor: "Prata",
  combustivel: "Flex",
  cambio: "Auto",
  portas: 4,
  blindado: false,
  opcionais: [],
  descricao: "Ok",
  fotos: ["https://cdn.example.com/f.jpg"],
  status: "disponivel",
};

const manualMap = {
  codigo_marca: 1,
  codigo_modelo: 10,
  codigo_versao: 100,
  codigo_cor: 5,
  codigo_combustivel: 3,
  codigo_cambio: 2,
  codigo_modalidade: 7,
  nr_portas: 4,
  opcionais: [],
  mapping_source: "manual" as const,
};

Deno.test("WEBMOTORS-1.2 — sem request e sem salvo → todas N", () => {
  const r = resolveWebmotorsAnuncioSnForVehicle({});
  assertEquals(r.shouldPersist, false);
  assertEquals(r.values.IpvaPago, "N");
});

Deno.test("WEBMOTORS-1.2 — sync sem request preserva valores salvos", () => {
  const stored = webmotorsAnuncioSnFromBooleans({ IpvaPago: true });
  const r = resolveWebmotorsAnuncioSnForVehicle({ stored });
  assertEquals(r.shouldPersist, false);
  assertEquals(r.values.IpvaPago, "S");
  assertEquals(r.values.UnicoDono, "N");

  const mapped = mapVehicleToWebmotorsCar({
    vehicle,
    manualMap,
    catalog,
    defaultModalidade: 7,
    existingCodigoAnuncio: 99,
    anuncioSn: r.booleans,
  });
  if (!mapped.ok) throw new Error(JSON.stringify(mapped.blocking));
  assertEquals(mapped.payload.IpvaPago, "S");
});

Deno.test("WEBMOTORS-1.2 — request explícito sobrescreve salvo e persiste", () => {
  const stored = webmotorsAnuncioSnFromBooleans({ IpvaPago: true });
  const r = resolveWebmotorsAnuncioSnForVehicle({
    request: { UnicoDono: true },
    stored,
  });
  assertEquals(r.shouldPersist, true);
  assertEquals(r.values.IpvaPago, "N");
  assertEquals(r.values.UnicoDono, "S");
});
