// Teste sintético do reconhecimento de dono multi-tenant.
// Roda buildAmzContext nos 4 cenários e devolve o access resolvido.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildAmzContext, resolveTenantOwner } from "../_shared/amz-context.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AMZ_USER   = "b7af0118-c506-4f87-8ac3-a0a11fd621fe";
const MARC_USER  = "d2ca3f33-777b-465d-9961-59ce2eae393d";
const FELICIO    = "5521967520706";
const MARCELO    = "5521964641312";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const cases = [
    { label: "(a) Felicio → JARVIS (AMZ)",       tenant: AMZ_USER,  from: FELICIO, expect: "owner" },
    { label: "(b) Marcelo → Silvester",           tenant: MARC_USER, from: MARCELO, expect: "owner" },
    { label: "(c) Marcelo → JARVIS (isolamento)", tenant: AMZ_USER,  from: MARCELO, expect: "partner|client|stranger (NÃO owner)" },
    { label: "(d) Felicio → Silvester (isolam.)", tenant: MARC_USER, from: FELICIO, expect: "client ou stranger (NÃO owner)" },
  ];

  const results = [];
  for (const c of cases) {
    const owner = await resolveTenantOwner(sb, c.tenant);
    const ctx = await buildAmzContext(sb, c.from, c.tenant);
    results.push({
      caso: c.label,
      tenant: c.tenant,
      from: c.from,
      tenant_owner_phone: owner.phone,
      tenant_owner_name:  owner.name,
      access_resolvido:   ctx.access,
      contato_nome:       ctx.contact?.name ?? null,
      esperado:           c.expect,
      OK:                 c.label.startsWith("(a)") || c.label.startsWith("(b)")
                             ? ctx.access === "owner"
                             : ctx.access !== "owner",
      bloco_preview:      (ctx.block || "").split("\n").slice(0, 3).join(" | "),
    });
  }

  return new Response(JSON.stringify({ ok: true, results }, null, 2), {
    headers: { ...cors, "content-type": "application/json" },
  });
});
