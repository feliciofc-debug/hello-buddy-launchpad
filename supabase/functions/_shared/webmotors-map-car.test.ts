import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  assertWebmotorsPayloadPublicOnly,
  mapVehicleToWebmotorsCar,
  webmotorsPricesFromEstoque,
} from "./webmotors-map-car.ts";
import type { VeiculoEstoqueRow } from "./webmotors-vehicle-types.ts";
import { webmotorsPublicObservacao } from "./webmotors-text.ts";

const baseVehicle: VeiculoEstoqueRow = {
  id: "v1",
  user_id: "u1",
  placa: "abc-1d23",
  marca: "Toyota",
  modelo: "Corolla",
  versao: "XEi",
  ano_fabricacao: 2022,
  ano_modelo: 2023,
  km: 10000,
  preco: 120000,
  cor: "Prata",
  combustivel: "Flex",
  cambio: "Automatico",
  portas: 4,
  blindado: false,
  opcionais: [],
  descricao: "Veículo revisado, pronto para uso.",
  fotos: ["https://cdn.example.com/foto.jpg"],
  status: "disponivel",
};

const catalog = {
  marcas: [{ codigo: 1, nome: "Toyota" }],
  modelos: [{ codigo: 10, nome: "Corolla" }],
  versoes: [{ codigo: 100, nome: "XEi 2.0" }],
  cores: [{ codigo: 5, nome: "Prata" }],
  combustiveis: [{ codigo: 3, nome: "Flex" }],
  cambios: [{ codigo: 2, nome: "Automatico" }],
  portas: [4],
  modalidades: [{ codigo: 7, nome: "Premium" }],
  opcionais: [],
};

Deno.test("Observacao usa somente descricao publica do veiculo", () => {
  const r = mapVehicleToWebmotorsCar({
    vehicle: baseVehicle,
    manualMap: {
      codigo_marca: 1,
      codigo_modelo: 10,
      codigo_versao: 100,
      codigo_cor: 5,
      codigo_combustivel: 3,
      codigo_cambio: 2,
      codigo_modalidade: 7,
      nr_portas: 4,
      opcionais: [],
      mapping_source: "manual",
    },
    catalog,
    defaultModalidade: 7,
  });
  if (!r.ok) throw new Error(JSON.stringify(r.blocking));
  assertEquals(r.payload.Observacao, baseVehicle.descricao);
  assertEquals(r.payload.Observacao.includes("Ano 2022"), false);
  assertWebmotorsPayloadPublicOnly(r.payload);
});

Deno.test("Observacao rejeita FIPE com mensagem clara", () => {
  assertThrows(
    () => webmotorsPublicObservacao("Carro abaixo da tabela FIPE"),
    Error,
    "A descrição contém 'FIPE'",
  );
});

Deno.test("PrecoVenda vem do estoque AMZ e PrecoReal padrão zero", () => {
  const p = webmotorsPricesFromEstoque(99990.5);
  assertEquals(p?.precoVenda, 99990.5);
  assertEquals(p?.precoReal, 0);
});

Deno.test("PrecoReal usa preço de promocional quando maior que venda", () => {
  const p = webmotorsPricesFromEstoque(100000, 110000);
  assertEquals(p?.precoVenda, 100000);
  assertEquals(p?.precoReal, 110000);
});

Deno.test("WEBMOTORS-1.1 — placa obrigatória e S/N só com checkbox marcado", () => {
  const semPlaca = mapVehicleToWebmotorsCar({
    vehicle: { ...baseVehicle, placa: null },
    manualMap: {
      codigo_marca: 1,
      codigo_modelo: 10,
      codigo_versao: 100,
      codigo_cor: 5,
      codigo_combustivel: 3,
      codigo_cambio: 2,
      codigo_modalidade: 7,
      nr_portas: 4,
      opcionais: [],
      mapping_source: "manual",
    },
    catalog,
    defaultModalidade: 7,
  });
  assertEquals(semPlaca.ok, false);
  if (semPlaca.ok) throw new Error("esperado bloqueio");
  assertEquals(semPlaca.blocking.some((b) => b.field === "placa"), true);

  const comSn = mapVehicleToWebmotorsCar({
    vehicle: baseVehicle,
    manualMap: {
      codigo_marca: 1,
      codigo_modelo: 10,
      codigo_versao: 100,
      codigo_cor: 5,
      codigo_combustivel: 3,
      codigo_cambio: 2,
      codigo_modalidade: 7,
      nr_portas: 4,
      opcionais: [],
      mapping_source: "manual",
    },
    catalog,
    defaultModalidade: 7,
    anuncioSn: { UnicoDono: true, IpvaPago: false },
  });
  if (!comSn.ok) throw new Error(JSON.stringify(comSn.blocking));
  assertEquals(comSn.payload.Placa, "ABC1D23");
  assertEquals(comSn.payload.PrecoReal, 0);
  assertEquals(comSn.payload.UnicoDono, "S");
  assertEquals(comSn.payload.IpvaPago, "N");
});

Deno.test("catálogo não aceita correspondência parcial nem escolhe opção arbitrária", () => {
  const result = mapVehicleToWebmotorsCar({
    vehicle: {
      ...baseVehicle,
      versao: "XEi",
      portas: null,
    },
    manualMap: null,
    catalog,
    defaultModalidade: 7,
  });
  assertEquals(result.ok, false);
  if (result.ok) throw new Error("resultado deveria bloquear de/para inexato");
  assertEquals(result.blocking.some((item) => item.field === "versao"), true);
  assertEquals(result.blocking.some((item) => item.field === "portas"), true);
});
