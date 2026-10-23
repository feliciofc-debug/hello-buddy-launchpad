/** Espelha supabase/functions/_shared/webmotors-anuncio-sn.ts (sem import cross-root). */
export const WEBMOTORS_ANUNCIO_SN_FIELDS = [
  { key: "AdaptadoDeficientesFisicos", label: "Adaptado para deficientes físicos" },
  { key: "UnicoDono", label: "Único dono" },
  { key: "Alienado", label: "Alienado (financiado)" },
  { key: "IpvaPago", label: "IPVA pago" },
  { key: "NaoAceitaTroca", label: "Não aceita troca" },
  { key: "RevisadoOficinaAgendaDoCarro", label: "Revisado em oficina autorizada" },
  { key: "RevisoesEmConcessionaria", label: "Revisões em concessionária" },
  { key: "GarantiaDeFabrica", label: "Garantia de fábrica" },
  { key: "Licenciado", label: "Licenciado" },
  { key: "Leilao", label: "Passagem por leilão" },
] as const;

export type WebmotorsAnuncioSnKey =
  typeof WEBMOTORS_ANUNCIO_SN_FIELDS[number]["key"];

export type WebmotorsAnuncioSnForm = Record<WebmotorsAnuncioSnKey, boolean>;

export function emptyWebmotorsAnuncioSnForm(): WebmotorsAnuncioSnForm {
  return Object.fromEntries(
    WEBMOTORS_ANUNCIO_SN_FIELDS.map(({ key }) => [key, false]),
  ) as WebmotorsAnuncioSnForm;
}
