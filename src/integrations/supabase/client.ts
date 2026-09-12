import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getRuntimeConfig } from "@/config/runtime-config";
import { CustomAuthClient } from "./custom-auth";
import type { Database } from "./types";

const config = getRuntimeConfig();

const createTokenFetch = (auth: CustomAuthClient): typeof fetch => {
  return async (input, init) => {
    const requestUrl =
      typeof input === "string"
        ? new URL(input, window.location.origin)
        : input instanceof URL
          ? input
          : new URL(input.url);
    const apiUrl = new URL(config.supabaseUrl);
    const shouldAuthenticate =
      requestUrl.origin === apiUrl.origin &&
      (requestUrl.pathname.startsWith("/rest/v1/") ||
        requestUrl.pathname === "/rest/v1" ||
        requestUrl.pathname.startsWith("/functions/v1/") ||
        requestUrl.pathname === "/functions/v1");

    if (!shouldAuthenticate) return fetch(input, init);

    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    new Headers(init?.headers).forEach((value, key) => headers.set(key, value));
    headers.set("apikey", config.supabaseAnonKey);
    headers.set("Authorization", `Bearer ${auth.getAccessToken() || config.supabaseAnonKey}`);

    return fetch(input, { ...init, headers });
  };
};

const createCustomClient = (): SupabaseClient<Database> => {
  const auth = new CustomAuthClient(config.supabaseUrl, config.supabaseAnonKey);
  const client = createClient<Database>(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: createTokenFetch(auth),
    },
  });

  return new Proxy(client, {
    get(target, property, receiver) {
      if (property === "auth") return auth;
      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
};

export const supabase =
  config.authProvider === "custom"
    ? createCustomClient()
    : createClient<Database>(config.supabaseUrl, config.supabaseAnonKey);
