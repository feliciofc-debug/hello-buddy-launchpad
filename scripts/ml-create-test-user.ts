/**
 * Cria usuário de teste Mercado Livre (MLB) para publicações invisíveis ao público.
 * Uso: deno run -A scripts/ml-create-test-user.ts <user_id_do_tenant>
 * Requer: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ML_TOKEN_KEY, ML_CLIENT_* e conta ML conectada.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { ML_API_BASE, ML_SITE_ID } from "../supabase/functions/_shared/ml-config.ts";
import { getMlAccessTokenForUser } from "../supabase/functions/_shared/ml-token.ts";

const tenantUserId = Deno.args[0]?.trim();
if (!tenantUserId) {
  console.error("Uso: deno run -A scripts/ml-create-test-user.ts <user_id_do_tenant>");
  Deno.exit(1);
}

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!supabaseUrl || !serviceKey) {
  console.error("Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente.");
  Deno.exit(1);
}

const admin = createClient(supabaseUrl, serviceKey);

let accessToken: string;
try {
  ({ accessToken } = await getMlAccessTokenForUser(admin as never, tenantUserId));
} catch (e) {
  console.error(`Não foi possível obter token ML do tenant: ${(e as Error).message}`);
  Deno.exit(1);
}

const res = await fetch(`${ML_API_BASE}/users/test_user`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${accessToken}`,
    accept: "application/json",
    "content-type": "application/json",
  },
  body: JSON.stringify({ site_id: ML_SITE_ID }),
});

const body = await res.json().catch(() => ({}));
if (!res.ok) {
  console.error(`Mercado Livre retornou HTTP ${res.status}.`);
  Deno.exit(1);
}

const id = body.id ?? body.user_id;
const nickname = body.nickname;
const password = body.password;

if (id == null || !nickname || !password) {
  console.error("Resposta inesperada da API de test user (campos id/nickname/password).");
  Deno.exit(1);
}

console.log("Usuário de teste Mercado Livre criado (não persista estes dados):");
console.log(`  id: ${id}`);
console.log(`  nickname: ${nickname}`);
console.log(`  password: ${password}`);
