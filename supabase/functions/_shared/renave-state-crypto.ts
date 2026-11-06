import {
  decryptProcedenciaApiKey,
  encryptProcedenciaApiKey,
} from "./procedencia-enc-crypto.ts";

export type RenaveSensitiveState = {
  documentoProprietario: string;
  codigoSegurancaCrv: string;
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
    typeof parsed.codigoSegurancaCrv !== "string"
  ) {
    throw new Error("Estado sensível RENAVE inválido");
  }
  return {
    documentoProprietario: parsed.documentoProprietario,
    codigoSegurancaCrv: parsed.codigoSegurancaCrv,
  };
}
