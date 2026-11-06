import { MasterKeyring } from "./envelope.js";

export type RenaveConfig = {
  token: string;
  keyring: MasterKeyring;
  prodEnabled: boolean;
  host: string;
  port: number;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): RenaveConfig {
  const token = env.AMZ_RENAVE_TOKEN?.trim();
  if (!token) throw new Error("AMZ_RENAVE_TOKEN é obrigatório");

  const currentVersion = env.AMZ_RENAVE_KEY_VERSION?.trim();
  if (!currentVersion) throw new Error("AMZ_RENAVE_KEY_VERSION é obrigatório");

  const configuredHost = env.AMZ_RENAVE_HOST?.trim();
  const host = configuredHost === "0.0.0.0" ? configuredHost : "127.0.0.1";

  return {
    token,
    keyring: MasterKeyring.fromEnvironment({
      currentVersion,
      currentKeyBase64: env.AMZ_RENAVE_MASTER_KEY,
      previousKeyBase64: env.AMZ_RENAVE_MASTER_KEY_PREV,
    }),
    prodEnabled: env.AMZ_RENAVE_PROD_ENABLED === "true",
    host,
    port: 3012,
  };
}
