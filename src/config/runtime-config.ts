export type AuthProvider = "supabase" | "custom";

export type RuntimeConfig = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  authProvider: AuthProvider;
};

const DEFAULT_CONFIG: RuntimeConfig = {
  supabaseUrl: "https://api.amzofertas.com.br",
  supabaseAnonKey:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6ImFteiIsImV4cCI6MjEwNDU5NzQ4Mn0.uDJENCSmbcEvxXoYP0wcI2KffkU7VT8cdK0nkqQ2sGw",
  authProvider: "custom",
};

let runtimeConfig: RuntimeConfig | null = null;

const normalizeUrl = (value: string) => value.replace(/\/+$/, "");

const validateConfig = (value: unknown): RuntimeConfig => {
  if (!value || typeof value !== "object") {
    throw new Error("config.json precisa conter um objeto JSON");
  }

  const config = value as Record<string, unknown>;
  if (typeof config.supabaseUrl !== "string" || !config.supabaseUrl.trim()) {
    throw new Error("config.json: supabaseUrl é obrigatório");
  }
  if (typeof config.supabaseAnonKey !== "string" || !config.supabaseAnonKey.trim()) {
    throw new Error("config.json: supabaseAnonKey é obrigatório");
  }
  if (config.authProvider !== "supabase" && config.authProvider !== "custom") {
    throw new Error('config.json: authProvider deve ser "supabase" ou "custom"');
  }

  return {
    supabaseUrl: normalizeUrl(config.supabaseUrl.trim()),
    supabaseAnonKey: config.supabaseAnonKey.trim(),
    authProvider: config.authProvider,
  };
};

export async function loadRuntimeConfig(): Promise<RuntimeConfig> {
  if (runtimeConfig) return runtimeConfig;

  try {
    const response = await fetch(`${import.meta.env.BASE_URL}config.json`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(`config.json respondeu HTTP ${response.status}`);
    }

    runtimeConfig = validateConfig(await response.json());
  } catch (error) {
    console.warn("[runtime-config] Usando configuração padrão:", error);
    runtimeConfig = DEFAULT_CONFIG;
  }

  return runtimeConfig;
}

export function getRuntimeConfig(): RuntimeConfig {
  if (!runtimeConfig) {
    throw new Error("Configuração de runtime ainda não foi carregada");
  }
  return runtimeConfig;
}

export const isCustomAuth = () => getRuntimeConfig().authProvider === "custom";
