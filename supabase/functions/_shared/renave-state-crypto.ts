import {
  decryptProcedenciaApiKey,
  encryptProcedenciaApiKey,
} from "./procedencia-enc-crypto.ts";

export type RenaveSensitiveState = {
  documentoProprietario: string;
  codigoSegurancaCrv: string;
  cpfOperadorResponsavel?: string;
  emailEstabelecimento?: string;
  emailVendedor?: string;
  comprador?: {
    nome?: string;
    cep?: string;
    logradouro?: string;
    numero?: string;
    bairro?: string;
    cidade?: string;
    uf?: string;
    email?: string;
  };
};

export type RenaveOperatorProfile = {
  cpfOperadorResponsavel?: string;
  emailEstabelecimento?: string;
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
    (parsed.cpfOperadorResponsavel !== undefined &&
      typeof parsed.cpfOperadorResponsavel !== "string") ||
    (parsed.emailEstabelecimento !== undefined &&
      typeof parsed.emailEstabelecimento !== "string") ||
    (parsed.emailVendedor !== undefined &&
      typeof parsed.emailVendedor !== "string") ||
    (parsed.comprador !== undefined &&
      (
        !parsed.comprador ||
        typeof parsed.comprador !== "object" ||
        Object.values(parsed.comprador).some((value) =>
          value !== undefined && typeof value !== "string"
        )
      ))
  ) {
    throw new Error("Estado sensível RENAVE inválido");
  }
  return {
    documentoProprietario: parsed.documentoProprietario,
    codigoSegurancaCrv: parsed.codigoSegurancaCrv,
    ...(typeof parsed.cpfOperadorResponsavel === "string"
      ? { cpfOperadorResponsavel: parsed.cpfOperadorResponsavel }
      : {}),
    ...(typeof parsed.emailEstabelecimento === "string"
      ? { emailEstabelecimento: parsed.emailEstabelecimento }
      : {}),
    ...(typeof parsed.emailVendedor === "string"
      ? { emailVendedor: parsed.emailVendedor }
      : {}),
    ...(parsed.comprador ? { comprador: parsed.comprador } : {}),
  };
}

export async function encryptRenaveOperatorProfile(
  value: RenaveOperatorProfile,
): Promise<string> {
  return await encryptProcedenciaApiKey(JSON.stringify(value));
}

export async function decryptRenaveOperatorProfile(
  ciphertext: string,
): Promise<RenaveOperatorProfile> {
  const parsed = JSON.parse(
    await decryptProcedenciaApiKey(ciphertext),
  ) as RenaveOperatorProfile;
  if (
    (parsed.cpfOperadorResponsavel !== undefined &&
      typeof parsed.cpfOperadorResponsavel !== "string") ||
    (parsed.emailEstabelecimento !== undefined &&
      typeof parsed.emailEstabelecimento !== "string")
  ) {
    throw new Error("Perfil RENAVE inválido");
  }
  return parsed;
}
