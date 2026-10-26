import { decryptWebmotorsSecret } from "./webmotors-token-crypto.ts";
import { webmotorsAutenticar } from "./webmotors-auth.ts";
import type { WebmotorsAmbiente } from "./webmotors-endpoints.ts";
import {
  loadWebmotorsHomologCredentials,
  webmotorsServerEnvironmentForUser,
} from "./webmotors-config.ts";

export type WebmotorsContaRow = {
  user_id: string;
  cnpj: string;
  integration_email: string;
  password_enc: string;
  ambiente: WebmotorsAmbiente;
  status: string;
  default_codigo_modalidade: number | null;
  updated_at?: string;
};

export async function loadWebmotorsConta(
  sb: any,
  userId: string,
): Promise<WebmotorsContaRow | null> {
  const { data } = await sb.from("webmotors_contas")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  return data as WebmotorsContaRow | null;
}

export async function webmotorsHashForUser(sb: any, userId: string): Promise<{
  hash: string;
  ambiente: WebmotorsAmbiente;
  conta: WebmotorsContaRow;
}> {
  if (webmotorsServerEnvironmentForUser(userId) === "homologacao") {
    const credentials = loadWebmotorsHomologCredentials();
    const hash = await webmotorsAutenticar({
      ambiente: "homolog",
      ...credentials,
    });
    return {
      hash,
      ambiente: "homolog",
      conta: {
        user_id: userId,
        cnpj: credentials.cnpj,
        integration_email: credentials.email,
        password_enc: "",
        ambiente: "homolog",
        status: "active",
        default_codigo_modalidade: null,
      },
    };
  }

  const conta = await loadWebmotorsConta(sb, userId);
  if (!conta || conta.status === "disconnected") {
    throw new Error("Conecte a Webmotors em Configurações → Integrações.");
  }
  const senha = await decryptWebmotorsSecret(conta.password_enc);
  const hash = await webmotorsAutenticar({
    ambiente: "producao",
    cnpj: conta.cnpj,
    email: conta.integration_email,
    senha,
  });
  return { hash, ambiente: "producao", conta };
}

export function maskCnpj(cnpj: string): string {
  const d = cnpj.replace(/\D/g, "");
  if (d.length !== 14) return "***";
  return `${d.slice(0, 2)}.***.***/${d.slice(8, 12)}-${d.slice(12)}`;
}
