const PII_KEY =
  /^(?:cpf|cnpj|documento|documentnumber|ownerdocument|ownerdocumentnumber|ownername|nomeproprietario|proprietario|proprietarydocumenttype|financedname|financeddocumentnumber|nomefinanciado|telefone|phone|email|endereco|address)$/i;

export function sanitizeMolicarPii(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeMolicarPii);
  if (!value || typeof value !== "object") return value;
  const clean: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (!PII_KEY.test(key.replace(/[_\s-]/g, ""))) {
      clean[key] = sanitizeMolicarPii(child);
    }
  }
  return clean;
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function first(root: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (root[key] !== undefined && root[key] !== null && root[key] !== "") {
      return root[key];
    }
  }
  return null;
}

function text(value: unknown, max = 200): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const out = String(value).trim();
  return out ? out.slice(0, max) : null;
}

function price(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? value : null;
  }
  const raw = text(value);
  if (!raw) return null;
  const digits = raw.replace(/[^\d,.-]/g, "");
  const normalized = digits.includes(",")
    ? digits.replace(/\./g, "").replace(",", ".")
    : digits;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0
    ? Math.round(parsed * 100) / 100
    : null;
}

function normalizedPrice(
  root: Record<string, unknown>,
  keys: string[],
): number | null {
  return price(first(root, keys));
}

export type MolicarPrices = {
  referencia: number | null;
  b2c: number | null;
  b2b: number | null;
  c2c: number | null;
  c2b: number | null;
  novo: number | null;
  contexto: Record<string, unknown>;
};

export type MolicarParsed = {
  molicarId: string | null;
  placa: string | null;
  vin: string | null;
  renavam: string | null;
  fipeCodigo: string | null;
  dados: Record<string, unknown>;
  procedencia: Record<string, unknown> | null;
  precos: MolicarPrices;
};

/** Accepts both wrapped and flat Molicar payload versions without retaining owner/finance PII. */
export function parseMolicarResponse(payload: unknown): MolicarParsed {
  const outer = object(payload);
  const candidate = first(outer, ["data", "result", "vehicle", "veiculo"]);
  const root = Array.isArray(candidate)
    ? object(candidate[0])
    : Object.keys(object(candidate)).length
    ? object(candidate)
    : outer;
  const decoder = object(first(root, ["Decoder", "decoder"]));
  const vehicle = object(
    first(root, ["VehicleData", "vehicleData", "vehicle_data", "veiculo"]),
  );
  const pricing = object(first(root, ["Pricing", "pricing", "precos"]));
  const market = object(first(pricing, ["Market", "market"]));
  const marketPrices = object(first(market, ["Prices", "prices"]));
  const values = {
    ...object(root.prices),
    ...object(root.precos),
    ...object(root.price),
    ...marketPrices,
    ...pricing,
    ...root,
  };
  const context = object(
    sanitizeMolicarPii(first(market, ["Context", "context"])),
  );
  const provenanceBlocks = [
    "Restrictions",
    "restrictions",
    "Gravame",
    "gravame",
    "Renajud",
    "renajud",
    "Leilao",
    "Leilão",
    "leilao",
    "Debitos",
    "Débitos",
    "debitos",
  ];
  const procedencia: Record<string, unknown> = {};
  for (const key of provenanceBlocks) {
    if (root[key] == null || procedencia[key.toLowerCase()] != null) continue;
    procedencia[key.toLowerCase()] = sanitizeMolicarPii(root[key]);
  }
  const explicitProvenance = first(root, ["procedencia", "origin", "provenance"]);
  if (explicitProvenance != null) {
    procedencia.dados = sanitizeMolicarPii(explicitProvenance);
  }
  const dados = object(sanitizeMolicarPii({
    decoder: {
      placa: first(decoder, ["Plate", "plate"]),
      vin: first(decoder, ["Vin", "VIN", "vin"]),
      ano_modelo: first(decoder, ["ModelYear", "modelYear"]),
      status: first(decoder, ["Status", "status"]),
      molicar_id: first(decoder, ["MolicarId", "molicarId"]),
    },
    marca: first(vehicle, ["Brand", "brand", "marca"]),
    modelo: first(vehicle, ["Model", "model", "modelo"]),
    versao: first(vehicle, ["Version", "version", "versao"]),
    ano_fabricacao: first(vehicle, [
      "ManufacturedYear",
      "manufacturedYear",
      "anoFabricacao",
    ]),
    ano_modelo: first(root, ["ModelYear", "modelYear"]) ??
      first(decoder, ["ModelYear", "modelYear"]),
    combustivel: first(vehicle, ["FuelType", "fuelType", "combustivel"]),
    cambio: first(vehicle, ["Transmission", "transmission", "cambio"]),
    cor: first(vehicle, ["VehicleColor", "vehicleColor", "cor"]),
    cilindrada_cc: first(vehicle, ["CC", "cc", "cilindrada"]),
    potencia: first(vehicle, ["Power", "power", "potencia"]),
    portas: first(vehicle, ["NrDoors", "nrDoors", "portas"]),
    lugares: first(vehicle, ["NrSeats", "nrSeats", "lugares"]),
    carroceria: first(vehicle, ["BodyType", "bodyType", "carroceria"]),
    numero_motor: first(vehicle, ["EngineNumber", "engineNumber"]),
    uf_atual: first(vehicle, ["UFCurrent", "ufCurrent"]),
    contexto_mercado: context,
    relacionados_molicar: first(root, ["RelatedsMolicar", "relatedsMolicar"]),
    outras_versoes_molicar: first(root, [
      "OtherVersionsMolicar",
      "otherVersionsMolicar",
    ]),
    pacotes_molicar: first(root, ["MolicarPackages", "molicarPackages"]),
  }));

  return {
    molicarId: text(
      first(decoder, ["MolicarId", "molicarId"]) ??
        first(root, ["MolicarId", "molicarId", "molicar_id", "id", "vehicleId"]),
    ),
    placa: text(
      first(decoder, ["Plate", "plate"]) ??
        first(root, ["Plate", "placa", "plate", "licensePlate"]),
      8,
    )?.replace(
      /[^A-Z0-9]/gi,
      "",
    ).toUpperCase() ?? null,
    vin: text(
      first(decoder, ["Vin", "VIN", "vin"]) ??
        first(root, ["Vin", "VIN", "vin", "chassi", "chassis"]),
      32,
    )?.replace(/\s/g, "").toUpperCase() ?? null,
    renavam: text(first(root, ["Renavam", "renavam"]), 20),
    fipeCodigo: text(
      first(root, ["FIPE", "Fipe", "fipe", "fipeCodigo", "codigoFipe", "fipe_code", "fipeCode"]),
      20,
    ),
    dados,
    procedencia: Object.keys(procedencia).length ? procedencia : null,
    precos: {
      referencia: normalizedPrice(values, [
        "MolicarPrice",
        "molicarPrice",
        "referencia",
        "referencePrice",
      ]),
      b2c: normalizedPrice(values, [
        "B2C",
        "b2c",
        "retailPrice",
        "precoB2c",
        "preco_b2c",
      ]),
      b2b: normalizedPrice(values, [
        "MolicarB2B",
        "molicarB2B",
        "B2B",
        "b2b",
        "tradePrice",
        "precoB2b",
        "preco_b2b",
      ]),
      c2c: normalizedPrice(values, ["C2C", "c2c"]),
      c2b: normalizedPrice(values, [
        "C2B",
        "c2b",
        "purchasePrice",
        "precoC2b",
        "preco_c2b",
      ]),
      novo: normalizedPrice(values, [
        "NewVehicle",
        "newVehicle",
        "novo",
        "newPrice",
      ]),
      contexto: context,
    },
  };
}

export function normalizeMolicarIdentity(
  input: { placa?: unknown; vin?: unknown },
) {
  const placa =
    text(input.placa, 8)?.replace(/[^A-Z0-9]/gi, "").toUpperCase() ?? null;
  const vin = text(input.vin, 32)?.replace(/[^A-Z0-9]/gi, "").toUpperCase() ??
    null;
  if (placa && !/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(placa)) {
    throw new Error("Placa inválida.");
  }
  if (vin && !/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) {
    throw new Error("Chassi/VIN inválido.");
  }
  if (!placa && !vin) throw new Error("Informe placa ou chassi/VIN.");
  return { placa, vin };
}
