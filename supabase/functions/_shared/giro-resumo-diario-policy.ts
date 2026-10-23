import type { GiroResumoSendResult } from "./giro-resumo-whatsapp.ts";

export type GiroResumoUltimoStatus = "enviado" | "parcial" | "bloqueado_24h" | "falha";

export function isErroTecnicoEnvio(result: Pick<GiroResumoSendResult, "ok" | "error">): boolean {
  if (result.ok) return false;
  const err = String(result.error ?? "").toLowerCase();
  if (err.includes("janela 24h")) return false;
  if (err.includes("telefone inválido")) return false;
  return true;
}

export function classificarStatusResumo(input: {
  ownerOk: boolean;
  ownerBlocked24h: boolean;
  algumOk: boolean;
}): GiroResumoUltimoStatus {
  if (input.ownerOk) return "enviado";
  if (input.ownerBlocked24h && input.algumOk) return "parcial";
  if (input.ownerBlocked24h) return "bloqueado_24h";
  if (input.algumOk) return "parcial";
  return "falha";
}

export function deveProcessarResumoHoje(input: {
  hojeYmd: string;
  resumoUltimoEnvio: string | null;
  resumoUltimoStatus: GiroResumoUltimoStatus | null;
  tentativasTecnico: number;
}): "primeira_tentativa" | "retentativa_tecnica" | "nao" {
  if (input.resumoUltimoEnvio !== input.hojeYmd) return "primeira_tentativa";
  if (input.resumoUltimoStatus === "falha" && input.tentativasTecnico < 2) {
    return "retentativa_tecnica";
  }
  return "nao";
}

export function filtrarPhonesSemEnvio(
  phones: string[],
  phonesOk: string[],
): string[] {
  const ok = new Set(phonesOk);
  return phones.filter((p) => !ok.has(p));
}

export function mergePhonesOk(anteriores: string[], novosOk: string[]): string[] {
  return [...new Set([...anteriores, ...novosOk])];
}

export function todosFalharamTecnico(
  envios: Array<Pick<GiroResumoSendResult, "ok" | "error">>,
): boolean {
  if (!envios.length) return false;
  return envios.every((e) => isErroTecnicoEnvio(e));
}
