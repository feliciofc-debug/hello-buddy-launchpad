export type CrlvConfianca = "alta" | "media" | "baixa";
export type CrlvCampo<T> = { valor: T | null; confianca: CrlvConfianca };
export type CrlvFonte = "pdf_texto" | "ocr";

export type CrlvParserResultado = {
  veiculo: {
    placa: CrlvCampo<string>;
    renavam: CrlvCampo<string>;
    chassi: CrlvCampo<string>;
    numero_motor: CrlvCampo<string>;
    marca_modelo_versao: CrlvCampo<string>;
    ano_fabricacao: CrlvCampo<number>;
    ano_modelo: CrlvCampo<number>;
    cor: CrlvCampo<string>;
    combustivel: CrlvCampo<string>;
    especie_tipo: CrlvCampo<string>;
    categoria: CrlvCampo<string>;
    carroceria: CrlvCampo<string>;
    potencia_cv: CrlvCampo<number>;
    cilindrada_cc: CrlvCampo<number>;
    capacidade: CrlvCampo<number>;
    lotacao: CrlvCampo<number>;
    pbt: CrlvCampo<number>;
    cmt: CrlvCampo<number>;
  };
  documento: {
    numero_crv: CrlvCampo<string>;
    codigo_seguranca_cla: CrlvCampo<string>;
    exercicio: CrlvCampo<number>;
    data_emissao: CrlvCampo<string>;
    municipio: CrlvCampo<string>;
    uf: CrlvCampo<string>;
  };
  proprietario: {
    nome: CrlvCampo<string>;
    cpf_cnpj: CrlvCampo<string>;
  };
  observacoes: {
    texto: CrlvCampo<string>;
    alienacao_fiduciaria: CrlvCampo<boolean>;
    financeira: CrlvCampo<string>;
    restricoes: CrlvCampo<string[]>;
  };
  fonte: CrlvFonte;
  leitura_fraca: boolean;
};

const vazio = <T>(): CrlvCampo<T> => ({ valor: null, confianca: "baixa" });

function confidence(source: CrlvFonte, corrected = false): CrlvConfianca {
  if (corrected) return "media";
  return source === "pdf_texto" ? "alta" : "media";
}

function normalize(raw: string): string {
  return String(raw || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .toUpperCase()
    .trim();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function afterLabel(text: string, labels: string[]): string | null {
  const pattern = labels.map(escapeRegex).join("|");
  const match = text.match(
    new RegExp(
      `(?:^|\\n)(?:${pattern})\\s*(?::|-)?\\s*(?:\\n\\s*)?([^\\n]+)`,
      "i",
    ),
  );
  return match?.[1]?.trim() || null;
}

function afterLabelToEnd(text: string, labels: string[]): string | null {
  const pattern = labels.map(escapeRegex).join("|");
  const match = text.match(
    new RegExp(
      `(?:^|\\n)(?:${pattern})\\s*(?::|-)?\\s*(?:\\n\\s*)?([\\s\\S]+)$`,
      "i",
    ),
  );
  return match?.[1]?.trim().replace(/\n+/g, "; ") || null;
}

function cleanCode(value: string | null): string | null {
  const clean = String(value ?? "").replace(/[^A-Z0-9]/g, "");
  return clean || null;
}

function fieldString(
  text: string,
  labels: string[],
  source: CrlvFonte,
): CrlvCampo<string> {
  const value = afterLabel(text, labels);
  return value
    ? { valor: value.trim(), confianca: confidence(source) }
    : vazio();
}

function codeField(
  text: string,
  labels: string[],
  source: CrlvFonte,
  minLength = 4,
): CrlvCampo<string> {
  const value = cleanCode(afterLabel(text, labels));
  return value && value.length >= minLength
    ? { valor: value, confianca: confidence(source) }
    : vazio();
}

function numericField(
  text: string,
  labels: string[],
  source: CrlvFonte,
): CrlvCampo<number> {
  const raw = afterLabel(text, labels);
  const match = raw?.match(/\d+(?:[.,]\d+)?/);
  if (!match) return vazio();
  const value = Number(match[0].replace(",", "."));
  return Number.isFinite(value)
    ? { valor: value, confianca: confidence(source) }
    : vazio();
}

export function validarRenavam(value: string): boolean {
  const digits = value.replace(/\D/g, "").padStart(11, "0");
  if (!/^\d{11}$/.test(digits) || /^(\d)\1{10}$/.test(digits)) return false;
  const weights = [3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const sum = weights.reduce(
    (total, weight, index) => total + Number(digits[index]) * weight,
    0,
  );
  const remainder = (sum * 10) % 11;
  const digit = remainder === 10 ? 0 : remainder;
  return digit === Number(digits[10]);
}

function renavamField(
  text: string,
  source: CrlvFonte,
): CrlvCampo<string> {
  const raw = afterLabel(text, ["RENAVAM", "CODIGO RENAVAM"]);
  if (!raw) return vazio();
  const original = raw.replace(/[^A-Z0-9]/g, "").slice(0, 11);
  const corrected = original.replace(/[OQD]/g, "0").replace(/[IL]/g, "1")
    .replace(/S/g, "5").replace(/B/g, "8");
  if (!validarRenavam(corrected)) return vazio();
  return {
    valor: corrected.padStart(11, "0"),
    confianca: confidence(source, corrected !== original),
  };
}

function plateField(text: string, source: CrlvFonte): CrlvCampo<string> {
  const labeled = cleanCode(afterLabel(text, ["PLACA", "PLACA ANTERIOR/UF"]));
  const fallback = text.match(/\b[A-Z]{3}[0-9][A-Z0-9][0-9]{2}\b/)?.[0] ??
    null;
  const value = labeled?.match(/^[A-Z]{3}(?:\d{4}|\d[A-Z]\d{2})$/)?.[0] ??
    fallback;
  return value
    ? {
      valor: value,
      confianca: labeled ? confidence(source) : "baixa",
    }
    : vazio();
}

function chassisField(text: string, source: CrlvFonte): CrlvCampo<string> {
  const raw = cleanCode(afterLabel(text, ["CHASSI"]));
  if (!raw) return vazio();
  const corrected = raw.replace(/I/g, "1").replace(/[OQ]/g, "0");
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(corrected)) return vazio();
  return {
    valor: corrected,
    confianca: confidence(source, corrected !== raw),
  };
}

function yearField(
  text: string,
  labels: string[],
  source: CrlvFonte,
): CrlvCampo<number> {
  const year = Number(
    afterLabel(text, labels)?.match(/\b(?:19|20)\d{2}\b/)?.[0],
  );
  const max = new Date().getUTCFullYear() + 2;
  return year >= 1900 && year <= max
    ? { valor: year, confianca: confidence(source) }
    : vazio();
}

function mapFuel(raw: string | null): string | null {
  if (!raw) return null;
  const value = normalize(raw);
  if (/ALCOOL|ETANOL/.test(value) && /GASOLINA/.test(value)) return "flex";
  if (/FLEX/.test(value)) return "flex";
  if (/GASOLINA/.test(value)) return "gasolina";
  if (/ALCOOL|ETANOL/.test(value)) return "etanol";
  if (/DIESEL/.test(value)) return "diesel";
  if (/ELETRIC/.test(value)) return "eletrico";
  if (/HIBRID/.test(value)) return "hibrido";
  if (/GNV|GAS NATURAL/.test(value)) return "gnv";
  return value.toLowerCase();
}

function fuelField(text: string, source: CrlvFonte): CrlvCampo<string> {
  const mapped = mapFuel(afterLabel(text, ["COMBUSTIVEL"]));
  return mapped ? { valor: mapped, confianca: confidence(source) } : vazio();
}

function dateField(text: string, source: CrlvFonte): CrlvCampo<string> {
  const raw = afterLabel(text, ["DATA DE EMISSAO", "EMISSAO"]);
  const match = raw?.match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/);
  if (!match) return vazio();
  const date = new Date(`${match[3]}-${match[2]}-${match[1]}T12:00:00Z`);
  if (
    date.getUTCFullYear() !== Number(match[3]) ||
    date.getUTCMonth() + 1 !== Number(match[2]) ||
    date.getUTCDate() !== Number(match[1])
  ) return vazio();
  return {
    valor: `${match[3]}-${match[2]}-${match[1]}`,
    confianca: confidence(source),
  };
}

function cpfValid(value: string): boolean {
  if (!/^\d{11}$/.test(value) || /^(\d)\1{10}$/.test(value)) return false;
  const calc = (length: number) => {
    let sum = 0;
    for (let i = 0; i < length; i++) sum += Number(value[i]) * (length + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return calc(9) === Number(value[9]) && calc(10) === Number(value[10]);
}

function cnpjValid(value: string): boolean {
  if (!/^\d{14}$/.test(value) || /^(\d)\1{13}$/.test(value)) return false;
  const digit = (length: number, weights: number[]) => {
    const sum = weights.reduce(
      (total, weight, index) => total + Number(value[index]) * weight,
      0,
    );
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  return digit(12, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) ===
      Number(value[12]) &&
    digit(13, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) ===
      Number(value[13]);
}

function ownerDocumentField(
  text: string,
  source: CrlvFonte,
): CrlvCampo<string> {
  const raw = afterLabel(text, [
    "CPF/CNPJ",
    "CPF CNPJ",
    "CPF",
    "CNPJ",
  ]);
  const value = raw?.replace(/\D/g, "") ?? "";
  return cpfValid(value) || cnpjValid(value)
    ? { valor: value, confianca: confidence(source) }
    : vazio();
}

function municipalityFields(
  text: string,
  source: CrlvFonte,
): { municipio: CrlvCampo<string>; uf: CrlvCampo<string> } {
  const raw = afterLabel(text, [
    "MUNICIPIO/UF",
    "MUNICIPIO UF",
    "LOCAL",
  ]);
  if (raw) {
    const match = raw.match(/^(.+?)[\s/-]+([A-Z]{2})$/);
    return match
      ? {
        municipio: { valor: match[1].trim(), confianca: confidence(source) },
        uf: { valor: match[2], confianca: confidence(source) },
      }
      : { municipio: { valor: raw, confianca: "baixa" }, uf: vazio() };
  }
  const municipio = afterLabel(text, ["MUNICIPIO"]);
  const uf = afterLabel(text, ["UF"])?.match(/\b[A-Z]{2}\b/)?.[0] ?? null;
  return {
    municipio: municipio
      ? { valor: municipio, confianca: confidence(source) }
      : vazio(),
    uf: uf ? { valor: uf, confianca: confidence(source) } : vazio(),
  };
}

function observations(text: string, source: CrlvFonte) {
  const raw = afterLabelToEnd(text, [
    "OBSERVACOES",
    "OBSERVACOES DO VEICULO",
    "INFORMACOES COMPLEMENTARES",
  ]);
  const value = raw?.trim() || null;
  const alienation = Boolean(
    value && /ALIENACAO FIDUCIARIA|ALIENADO|GRAVAME/.test(value),
  );
  const restrictionMatches = value?.match(
    /RESTRICAO[^;|]*|BLOQUEIO[^;|]*|RESERVA DE DOMINIO[^;|]*|ARRENDAMENTO[^;|]*|SINISTRO[^;|]*/g,
  ) ?? [];
  let financeira: string | null = null;
  if (alienation && value) {
    financeira = value.match(
      /(?:ALIENACAO FIDUCIARIA|ALIENADO|GRAVAME)\s*(?:A|AO|EM|:|-)?\s*([^;|]+)/,
    )?.[1]?.trim() ?? null;
    if (financeira && /^(SEM|NAO|NENHUM)$/i.test(financeira)) financeira = null;
  }
  return {
    texto: value
      ? { valor: value, confianca: confidence(source) }
      : vazio<string>(),
    alienacao_fiduciaria: {
      valor: alienation,
      confianca: value ? confidence(source) : "baixa" as CrlvConfianca,
    },
    financeira: financeira
      ? { valor: financeira, confianca: confidence(source) }
      : vazio<string>(),
    restricoes: {
      valor: [...new Set(restrictionMatches.map((x) => x.trim()))],
      confianca: value ? confidence(source) : "baixa" as CrlvConfianca,
    },
  };
}

export function parseCrlvText(
  rawText: string,
  fonte: CrlvFonte = "pdf_texto",
): CrlvParserResultado {
  const text = normalize(rawText);
  const municipio = municipalityFields(text, fonte);
  const potenciaCilindrada = afterLabel(text, [
    "POTENCIA/CILINDRADA",
    "POTENCIA CILINDRADA",
  ]);
  const capacidadeLotacao = afterLabel(text, [
    "CAPACIDADE/LOTACAO",
    "CAPACIDADE LOTACAO",
  ]);
  const pbtCmt = afterLabel(text, ["PBT/CMT", "PBT CMT"]);
  const numberPair = (value: string | null) =>
    value?.match(/\d+(?:[.,]\d+)?/g)?.map((x) => Number(x.replace(",", "."))) ??
      [];
  const [potencia, cilindrada] = numberPair(potenciaCilindrada);
  const [capacidade, lotacao] = numberPair(capacidadeLotacao);
  const [pbt, cmt] = numberPair(pbtCmt);
  const obs = observations(text, fonte);
  const combinedYears = numberPair(afterLabel(text, [
    "ANO FAB/ANO MOD",
    "ANO FAB / ANO MOD",
    "ANO FABRICACAO/ANO MODELO",
    "ANO FABRICACAO / ANO MODELO",
  ])).filter((value) =>
    value >= 1900 && value <= new Date().getUTCFullYear() + 2
  );
  const anoFabricacao = yearField(
    text,
    ["ANO FABRICACAO", "ANO FAB"],
    fonte,
  );
  const anoModelo = yearField(text, ["ANO MODELO", "ANO MOD"], fonte);
  if (anoFabricacao.valor == null && combinedYears[0]) {
    anoFabricacao.valor = combinedYears[0];
    anoFabricacao.confianca = confidence(fonte);
  }
  if (anoModelo.valor == null && combinedYears[1]) {
    anoModelo.valor = combinedYears[1];
    anoModelo.confianca = confidence(fonte);
  }

  const result: CrlvParserResultado = {
    veiculo: {
      placa: plateField(text, fonte),
      renavam: renavamField(text, fonte),
      chassi: chassisField(text, fonte),
      numero_motor: codeField(
        text,
        ["NUMERO DO MOTOR", "N DO MOTOR", "MOTOR"],
        fonte,
      ),
      marca_modelo_versao: fieldString(
        text,
        [
          "MARCA/MODELO/VERSAO",
          "MARCA / MODELO / VERSAO",
          "MARCA MODELO VERSAO",
          "MARCA/MODELO",
          "MARCA / MODELO",
        ],
        fonte,
      ),
      ano_fabricacao: anoFabricacao,
      ano_modelo: anoModelo,
      cor: fieldString(text, ["COR PREDOMINANTE", "COR"], fonte),
      combustivel: fuelField(text, fonte),
      especie_tipo: fieldString(text, ["ESPECIE/TIPO", "ESPECIE TIPO"], fonte),
      categoria: fieldString(text, ["CATEGORIA"], fonte),
      carroceria: fieldString(text, ["CARROCERIA"], fonte),
      potencia_cv: Number.isFinite(potencia)
        ? { valor: potencia, confianca: confidence(fonte) }
        : vazio(),
      cilindrada_cc: Number.isFinite(cilindrada)
        ? { valor: cilindrada, confianca: confidence(fonte) }
        : vazio(),
      capacidade: Number.isFinite(capacidade)
        ? { valor: capacidade, confianca: confidence(fonte) }
        : vazio(),
      lotacao: Number.isFinite(lotacao)
        ? { valor: lotacao, confianca: confidence(fonte) }
        : vazio(),
      pbt: Number.isFinite(pbt)
        ? { valor: pbt, confianca: confidence(fonte) }
        : vazio(),
      cmt: Number.isFinite(cmt)
        ? { valor: cmt, confianca: confidence(fonte) }
        : vazio(),
    },
    documento: {
      numero_crv: codeField(text, ["NUMERO CRV", "N CRV", "CRV"], fonte),
      codigo_seguranca_cla: codeField(
        text,
        [
          "CODIGO DE SEGURANCA DO CLA",
          "CODIGO SEGURANCA CLA",
          "CLA",
        ],
        fonte,
      ),
      exercicio: yearField(text, ["EXERCICIO"], fonte),
      data_emissao: dateField(text, fonte),
      municipio: municipio.municipio,
      uf: municipio.uf,
    },
    proprietario: {
      nome: fieldString(
        text,
        ["NOME DO PROPRIETARIO", "PROPRIETARIO", "NOME"],
        fonte,
      ),
      cpf_cnpj: ownerDocumentField(text, fonte),
    },
    observacoes: obs,
    fonte,
    leitura_fraca: false,
  };
  const core = [
    result.veiculo.placa,
    result.veiculo.renavam,
    result.veiculo.chassi,
    result.veiculo.marca_modelo_versao,
    result.veiculo.ano_modelo,
  ];
  const found = core.filter((field) => field.valor != null).length;
  result.leitura_fraca = found < 3 ||
    core.filter((field) => field.confianca === "baixa").length >= 3;
  return result;
}
