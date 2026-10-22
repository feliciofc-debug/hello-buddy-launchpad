import type { WebmotorsAmbiente } from "./webmotors-endpoints.ts";

export type WebmotorsServerEnvironment = "homologacao" | "producao";

type EnvReader = { get(name: string): string | undefined };

export function normalizeWebmotorsServerEnvironment(
  value: string | undefined,
): WebmotorsServerEnvironment {
  return value?.trim().toLowerCase() === "producao"
    ? "producao"
    : "homologacao";
}

export function webmotorsServerEnvironment(
  env: EnvReader = Deno.env,
): WebmotorsServerEnvironment {
  return normalizeWebmotorsServerEnvironment(env.get("WEBMOTORS_ENV"));
}

export function webmotorsAmbienteFromServer(
  env: EnvReader = Deno.env,
): WebmotorsAmbiente {
  return webmotorsServerEnvironment(env) === "producao"
    ? "producao"
    : "homolog";
}

export type WebmotorsHomologCredentials = {
  cnpj: string;
  email: string;
  senha: string;
};

export function loadWebmotorsHomologCredentials(
  env: EnvReader = Deno.env,
): WebmotorsHomologCredentials {
  const cnpj = (env.get("WEBMOTORS_HML_CNPJ") ?? "").replace(/\D/g, "");
  const email = (env.get("WEBMOTORS_HML_USER") ?? "").trim();
  const senha = env.get("WEBMOTORS_HML_PASSWORD") ?? "";
  const missing: string[] = [];
  if (cnpj.length !== 14) missing.push("WEBMOTORS_HML_CNPJ");
  if (!email) missing.push("WEBMOTORS_HML_USER");
  if (!senha) missing.push("WEBMOTORS_HML_PASSWORD");
  if (missing.length) {
    throw new Error(
      `Homologação Webmotors não configurada no servidor (${
        missing.join(", ")
      }).`,
    );
  }
  return { cnpj, email, senha };
}

export function isWebmotorsHomologConfigured(
  env: EnvReader = Deno.env,
): boolean {
  try {
    loadWebmotorsHomologCredentials(env);
    return true;
  } catch {
    return false;
  }
}
