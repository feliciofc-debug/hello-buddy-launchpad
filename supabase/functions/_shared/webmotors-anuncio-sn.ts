/** Campos Sim/Não obrigatórios do IncluirCarro/AlterarCarro (ordem do XML). */
export const WEBMOTORS_ANUNCIO_SN_FIELDS = [
  "AdaptadoDeficientesFisicos",
  "UnicoDono",
  "Alienado",
  "IpvaPago",
  "NaoAceitaTroca",
  "RevisadoOficinaAgendaDoCarro",
  "RevisoesEmConcessionaria",
  "GarantiaDeFabrica",
  "Licenciado",
  "Leilao",
] as const;

export type WebmotorsAnuncioSnField = typeof WEBMOTORS_ANUNCIO_SN_FIELDS[number];

export type WebmotorsAnuncioSnValues = Record<WebmotorsAnuncioSnField, "S" | "N">;

export type WebmotorsAnuncioSnBooleans = Partial<
  Record<WebmotorsAnuncioSnField, boolean>
>;

export const WEBMOTORS_ANUNCIO_SN_LABELS: Record<WebmotorsAnuncioSnField, string> = {
  AdaptadoDeficientesFisicos: "Adaptado para deficientes físicos",
  UnicoDono: "Único dono",
  Alienado: "Alienado (financiado)",
  IpvaPago: "IPVA pago",
  NaoAceitaTroca: "Não aceita troca",
  RevisadoOficinaAgendaDoCarro: "Revisado em oficina autorizada",
  RevisoesEmConcessionaria: "Revisões em concessionária",
  GarantiaDeFabrica: "Garantia de fábrica",
  Licenciado: "Licenciado",
  Leilao: "Passagem por leilão",
};

/** Converte checkboxes do request (true = Sim). Ausente ou false → N. */
export function webmotorsAnuncioSnFromBooleans(
  input: WebmotorsAnuncioSnBooleans | null | undefined,
): WebmotorsAnuncioSnValues {
  const src = input ?? {};
  const out = {} as WebmotorsAnuncioSnValues;
  for (const field of WEBMOTORS_ANUNCIO_SN_FIELDS) {
    out[field] = src[field] === true ? "S" : "N";
  }
  return out;
}

export function parseWebmotorsAnuncioSnBody(
  raw: unknown,
): WebmotorsAnuncioSnBooleans | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== "object") return undefined;
  const obj = raw as Record<string, unknown>;
  const out: WebmotorsAnuncioSnBooleans = {};
  for (const field of WEBMOTORS_ANUNCIO_SN_FIELDS) {
    if (field in obj) out[field] = obj[field] === true;
  }
  return Object.keys(out).length ? out : undefined;
}

/** Lê jsonb salvo em veiculos_portais.anuncio_sn. */
export function parseStoredWebmotorsAnuncioSnValues(
  raw: unknown,
): WebmotorsAnuncioSnValues | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  let hasAny = false;
  const out = {} as WebmotorsAnuncioSnValues;
  for (const field of WEBMOTORS_ANUNCIO_SN_FIELDS) {
    const v = obj[field];
    if (v === "S" || v === "N") {
      out[field] = v;
      hasAny = true;
    } else {
      out[field] = "N";
    }
  }
  return hasAny ? out : null;
}

export function webmotorsAnuncioSnBooleansFromValues(
  values: WebmotorsAnuncioSnValues,
): WebmotorsAnuncioSnBooleans {
  const out: WebmotorsAnuncioSnBooleans = {};
  for (const field of WEBMOTORS_ANUNCIO_SN_FIELDS) {
    out[field] = values[field] === "S";
  }
  return out;
}

/**
 * Request explícito → usar e persistir. Sem request → valores salvos. Sem salvo → tudo N.
 */
export function resolveWebmotorsAnuncioSnForVehicle(input: {
  request?: WebmotorsAnuncioSnBooleans;
  stored?: unknown;
}): {
  booleans: WebmotorsAnuncioSnBooleans;
  values: WebmotorsAnuncioSnValues;
  shouldPersist: boolean;
} {
  if (input.request !== undefined) {
    const values = webmotorsAnuncioSnFromBooleans(input.request);
    return {
      booleans: input.request,
      values,
      shouldPersist: true,
    };
  }
  const storedValues = parseStoredWebmotorsAnuncioSnValues(input.stored);
  if (storedValues) {
    return {
      booleans: webmotorsAnuncioSnBooleansFromValues(storedValues),
      values: storedValues,
      shouldPersist: false,
    };
  }
  const values = webmotorsAnuncioSnFromBooleans({});
  return { booleans: {}, values, shouldPersist: false };
}

export function webmotorsAnuncioSnValuesFromPayload(
  payload: Record<WebmotorsAnuncioSnField, string>,
): WebmotorsAnuncioSnValues {
  const out = {} as WebmotorsAnuncioSnValues;
  for (const field of WEBMOTORS_ANUNCIO_SN_FIELDS) {
    out[field] = payload[field] === "S" ? "S" : "N";
  }
  return out;
}
