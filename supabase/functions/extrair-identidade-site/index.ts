// ============================================================
// EXTRAIR IDENTIDADE DO SITE
//  - Camada A: HTML/CSS, sem IA (imediata).
//  - Camada B: quando a A devolve pouco conteúdo/nenhuma cor, entra
//    na fila do navegador da VPS (Playwright). A tela faz polling em
//    `site-identidade-status`.
// Nunca salva no cadastro — quem salva é o usuário depois de aprovar.
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { corsHeaders } from "../_shared/cors.ts";
import { lerIdentidadeDoSite, precisaCamadaB } from "../_shared/site-identidade.ts";

const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { url, camada_b } = await req.json();
    if (!url || typeof url !== "string" || url.trim().length < 4) {
      return json({ success: false, error: "Informe o endereço do site." });
    }

    const identidade = await lerIdentidadeDoSite(url);

    // Leitura avançada (navegador na VPS) só quando faz falta.
    let camadaB: { job_id: string } | null = null;
    if (camada_b !== false && precisaCamadaB(identidade)) {
      try {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        );
        let userId: string | null = null;
        const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
        if (token) {
          const { data } = await supabase.auth.getUser(token);
          userId = data?.user?.id ?? null;
        }
        const { data: job, error } = await supabase
          .from("site_render_jobs")
          .insert({ user_id: userId, url: identidade.url, identidade_a: identidade })
          .select("id")
          .single();
        if (error) throw error;
        camadaB = { job_id: job.id as string };
      } catch (e) {
        console.error("[identidade] falha ao enfileirar camada B", (e as Error)?.message);
      }
    }

    return json({ success: true, identidade, camada_b: camadaB });
  } catch (e) {
    return json({ success: false, error: (e as Error)?.message || "Falha ao ler o site." });
  }
});
