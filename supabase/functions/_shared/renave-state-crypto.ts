import {
  decryptProcedenciaApiKey,
  encryptProcedenciaApiKey,
} from "./procedencia-enc-crypto.ts";

export type RenaveSensitiveState = {
  documentoProprietario: string;
  codigoSegurancaCrv: string;
  comprador?: {
    nome: string;
    cep: string;
    logradouro: string;
    numero: string;
    bairro: string;
  };
};

export async function encryptRenaveSensitiveState(
  value: RenaveSensitiveState,
): Promise<string> {
  return await encryptProcedenciaApiKey(JSON.stringify(value));
}

export async function decryptRenaveSensitiveState(
  ciphertext: string,
): Promise<RenaveSensitiveState> {
  const parsed = JSON.parse(
    await decryptProcedenciaApiKey(ciphertext),
  ) as Partial<RenaveSensitiveState>;
  if (
    typeof parsed.documentoProprietario !== "string" ||
    typeof parsed.codigoSegurancaCrv !== "string" ||
    (parsed.comprador !== undefined &&
      (
        !parsed.comprador ||
        typeof parsed.comprador !== "object" ||
        typeof parsed.comprador.nome !== "string" ||
        typeof parsed.comprador.cep !== "string" ||
        typeof parsed.comprador.logradouro !== "string" ||
        typeof parsed.comprador.numero !== "string" ||
        typeof parsed.comprador.bairro !== "string"
      ))
  ) {
    throw new Error("Estado sensível RENAVE inválido");
  }
  return {
    documentoProprietario: parsed.documentoProprietario,
    codigoSegurancaCrv: parsed.codigoSegurancaCrv,
    ...(parsed.comprador ? { comprador: parsed.comprador } : {}),
  };
}
