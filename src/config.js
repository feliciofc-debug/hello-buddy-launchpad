import { getRuntimeConfig } from "./config/runtime-config";

export const API_URL = `${getRuntimeConfig().supabaseUrl}/functions/v1`;
