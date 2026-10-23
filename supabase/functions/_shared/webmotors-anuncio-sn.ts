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
  if (!raw || typeof raw !== "object") return undefined;
  const obj = raw as Record<string, unknown>;
  const out: WebmotorsAnuncioSnBooleans = {};
  for (const field of WEBMOTORS_ANUNCIO_SN_FIELDS) {
    if (field in obj) out[field] = obj[field] === true;
  }
  return Object.keys(out).length ? out : undefined;
}
