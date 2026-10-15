import { normalizeCep } from "./contact-validators.ts";

export type ViaCepAddress = {
  cep: string;
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
};

export const VIACEP_TIMEOUT_MS = 5_000;

export async function fetchViaCep(
  cepInput: string,
  fetchFn: typeof fetch = fetch,
  timeoutMs = VIACEP_TIMEOUT_MS,
): Promise<ViaCepAddress | null> {
  const cep = normalizeCep(cepInput);
  if (cep.length !== 8) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchFn(
      `https://viacep.com.br/ws/${cep}/json/`,
      { signal: controller.signal },
    );
    if (!res.ok) return null;
    const data = await res.json() as {
      erro?: boolean;
      logradouro?: string;
      bairro?: string;
      localidade?: string;
      uf?: string;
    };
    if (data.erro) return null;
    return {
      cep,
      logradouro: String(data.logradouro || "").trim(),
      bairro: String(data.bairro || "").trim(),
      localidade: String(data.localidade || "").trim(),
      uf: String(data.uf || "").trim().toUpperCase(),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
