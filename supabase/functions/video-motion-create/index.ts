// ============================================================
// video-motion-create
// Cria um job de vídeo MOTION (Remotion) para o usuário autenticado.
//
// Modos:
//   { tema }                  -> IA gera o roteiro e devolve para revisão
//   { tema, props }           -> usa o roteiro já editado pelo usuário
//   { tema, apenas_roteiro:1} -> só gera o roteiro, NÃO enfileira
//
// A lógica vive em _shared/video-motion-enfileirar.ts, compartilhada com o
// agente do WhatsApp. Aqui só resolvemos a identidade pela sessão.
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { corsHeaders } from "../_shared/cors.ts";
import { enfileirarVideoMotion } from "../_shared/video-motion-enfileirar.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ success: false, error: "Não autenticado" }, 401);

    const anon = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } } as any,
    );
    const { data: authData, error: authErr } = await anon.auth.getUser();
    const user = authData?.user;
    if (authErr || !user) return json({ success: false, error: "Sessão inválida" }, 401);

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));

    const r = await enfileirarVideoMotion({
      sb,
      userId: user.id,
      tema: String(body?.tema ?? ""),
       origem: body?.origem === "whatsapp" ? "whatsapp" : "plataforma",
       telefone: body?.telefone ?? null,
       props: body?.props ?? null,
       marca: body?.marca ?? null,
       cores: body?.cores ?? null,
       legendaPost: body?.legenda_post ?? null,
       formato: body?.formato ?? null,
       plataformas: body?.plataformas,
       nomeFallback: (user.user_metadata as any)?.nome ?? null,
       trilhaId: typeof body?.trilha_id === "string" ? body.trilha_id : null,
       semTrilha: body?.sem_trilha === true,
       trilhaVolume: typeof body?.trilha_volume === "number" ? body.trilha_volume : null,
       apenasRoteiro: Boolean(body?.apenas_roteiro),
    });

    if (!r.ok) return json({ success: false, error: r.error }, r.status);

    return json({ success: true, ...r, ok: undefined });
  } catch (e) {
    console.error("[video-motion-create] erro:", e);
    return json({ success: false, error: e instanceof Error ? e.message : "erro desconhecido" }, 500);
  }
});
