import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  normalizeMolicarIdentity,
  parseMolicarResponse,
  sanitizeMolicarPii,
} from "./molicar-parser.ts";

Deno.test("MOLICAR-1 sanitiza PII recursivamente sem alterar os demais campos", () => {
  const value = sanitizeMolicarPii({
    marca: "Honda",
    nested: {
      ownerName: "Pessoa",
      financiado: [{ financedDocumentNumber: "123", banco: "X" }],
    },
  });
  assertEquals(value, {
    marca: "Honda",
    nested: { financiado: [{ banco: "X" }] },
  });
});

Deno.test("MOLICAR-1 parser defensivo aceita o contrato Decoder v3 completo", () => {
  const parsed = parseMolicarResponse({
    Decoder: {
      Plate: "abc-1d23",
      Vin: "9BWZZZ377VT004251",
      ModelYear: 2024,
      Status: "OK",
      MolicarId: 123,
    },
    VehicleData: {
      Brand: "Honda",
      Model: "City",
      Version: "Touring",
      ManufacturedYear: 2023,
      FuelType: "Flex",
      Transmission: "CVT",
      VehicleColor: "Prata",
      CC: "1498",
      Power: "126",
      NrDoors: 4,
      NrSeats: 5,
      BodyType: "Sedan",
      EngineNumber: "MOTOR123",
      UFCurrent: "SP",
    },
    Pricing: {
      MolicarPrice: "R$ 100.500,20",
      MolicarB2B: "90.000,00",
      Market: {
        Context: { UF: "SP", Grade: "A", MY: 2024, Mileage: 12000 },
        Prices: {
          NewVehicle: "130000",
          B2C: "105000",
          C2C: "99000",
          C2B: null,
          UCFP: "97000",
        },
      },
    },
    Renavam: "00000000000",
    FIPE: "001234-5",
    Restrictions: {
      hasGravame: true,
      FinancedName: "NÃO PERSISTIR",
      FinancedDocumentNumber: "00000000000",
    },
  });
  assertEquals(parsed.placa, "ABC1D23");
  assertEquals(parsed.molicarId, "123");
  assertEquals(parsed.dados.marca, "Honda");
  assertEquals(parsed.precos, {
    referencia: 100500.2,
    b2c: 105000,
    b2b: 90000,
    c2c: 99000,
    c2b: null,
    novo: 130000,
    contexto: { UF: "SP", Grade: "A", MY: 2024, Mileage: 12000 },
  });
  assertEquals(parsed.procedencia, {
    restrictions: { hasGravame: true },
  });
});

Deno.test("MOLICAR-1 aceita resposta parcial sem Pricing nem procedência", () => {
  const parsed = parseMolicarResponse({
    Decoder: { Plate: "ABC1D23", MolicarId: "M-1" },
    VehicleData: { Brand: "Fiat", Model: "Pulse" },
  });
  assertEquals(parsed.precos, {
    referencia: null,
    b2c: null,
    b2b: null,
    c2c: null,
    c2b: null,
    novo: null,
    contexto: {},
  });
  assertEquals(parsed.procedencia, null);
});

Deno.test("MOLICAR-1 normaliza placa/VIN e rejeita identidade inválida", () => {
  assertEquals(normalizeMolicarIdentity({ placa: "abc-1d23" }), {
    placa: "ABC1D23",
    vin: null,
  });
  assertThrows(
    () => normalizeMolicarIdentity({ placa: "123" }),
    Error,
    "Placa inválida",
  );
});
