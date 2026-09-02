// ============================================================
// video-motion-create
// Cria um job de vídeo MOTION (Remotion) para o usuário autenticado.
//
// Modos:
//   { tema }                  -> IA gera o roteiro e devolve para revisão
//   { tema, props }           -> usa o roteiro já editado pelo usuário
//   { tema, apenas_roteiro:1} -> só gera o roteiro, NÃO enfileira
//
// Isolamento: o user_id vem sempre da sessão, nunca do body.
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { corsHeaders } from "../_shared/cors.ts";
import {
  gerarRoteiroMotion,
  normalizarProps,
  nomesOficiais,
  duracaoEstimada,
  type MotionProps,
} from "../_shared/video-motion.ts";


const PLATAFORMAS_OK = ["instagram", "facebook", "linkedin", "tiktok"];
const LIMITE_FILA_POR_USUARIO = 3;

async function logoDoTenant(sb: any, userId: string): Promise<string | undefined> {
  const { data } = await sb
    .from("tenant_logos")
    .select("storage_path")
    .eq("user_id", userId)
    .eq("ativo", true)
    .maybeSingle();
  const path = typeof data?.storage_path === "string" ? data.storage_path : "";
  return path.startsWith(`${userId}/`) ? path : undefined;
}

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
    const tema = String(body?.tema ?? "").trim();
    if (!tema || tema.length < 4) {
      return json({ success: false, error: "Descreva o tema do vídeo (mín. 4 caracteres)" }, 400);
    }

    // 1. Roteiro: usa o que veio editado, senão gera com IA.
    // A identidade visual é sempre controlada pelo tenant, não pela IA.
    const logoPath = await logoDoTenant(sb, user.id);
    let props: MotionProps;
    let legendaPost = String(body?.legenda_post ?? "").trim();
    let usouIA = false;

    if (body?.props) {
      const nomes = nomesOficiais(
        String(body?.props?.marca ?? (user.user_metadata as any)?.nome ?? ""),
        tema,
      );
      props = normalizarProps(
        { ...body.props, cores: body.props?.cores },
        {
          marca: String(body.props?.marca ?? ""),
          site: String(body.props?.site ?? ""),
          telefone: String(body.props?.cta?.telefone ?? "") || undefined,
          consultor: String(body.props?.cta?.consultor ?? "") || undefined,
          nomes,
        },
      );
    } else {
      const r = await gerarRoteiroMotion(sb, user.id, tema, {
        nomeFallback: (user.user_metadata as any)?.nome ?? null,
        marca: String(body?.marca ?? "").trim() || null,
      });
      props = normalizarProps(
        { ...r.props, cores: body?.cores ?? r.props.cores },
        { marca: r.props.marca, site: r.props.site, nomes: r.nomes },
      );
      usouIA = r.usouIA;
      if (!legendaPost) legendaPost = r.legendaPost;
    }


    // O worker recebe um caminho interno e transforma-o em URL assinada curta no claim.
    // Assim a logo continua protegida e não expira enquanto o job aguarda na fila.
    // `site` precisa existir até quando vazio para sobrescrever qualquer
    // defaultProps antigo no bundle Remotion mantido pela VPS.
    props = { ...props, site: props.site || "", logo_path: logoPath, logoUrl: undefined };

    if (body?.apenas_roteiro) {
      return json({
        success: true,
        apenas_roteiro: true,
        props,
        legenda_post: legendaPost,
        duracao_estimada: duracaoEstimada(props),
        usou_ia: usouIA,
      });
    }

    // 2. Limite de fila por usuário — protege o worker compartilhado.
    const { count } = await sb
      .from("video_motion_jobs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .in("status", ["pendente", "processando"]);

    if ((count ?? 0) >= LIMITE_FILA_POR_USUARIO) {
      return json({
        success: false,
        error: `Você já tem ${count} vídeo(s) na fila. Aguarde terminar para enviar outro.`,
      }, 429);
    }

    const plataformas = Array.isArray(body?.plataformas)
      ? body.plataformas.map((p: unknown) => String(p).toLowerCase()).filter((p: string) => PLATAFORMAS_OK.includes(p))
      : [];

    const { data: job, error: insErr } = await sb
      .from("video_motion_jobs")
      .insert({
        user_id: user.id,
        telefone: String(body?.telefone ?? "").replace(/\D/g, "") || null,
        origem: body?.origem === "whatsapp" ? "whatsapp" : "plataforma",
        template: "template-agente",
        titulo: tema.slice(0, 140),
        props,
        legenda_post: legendaPost || null,
        plataformas,
        formato: ["reels", "story", "feed"].includes(String(body?.formato)) ? String(body.formato) : "reels",
        metadata: { usou_ia: usouIA },
      })
      .select()
      .single();

    if (insErr) throw insErr;

    const { data: pos } = await sb.rpc("video_motion_fila_posicao", { p_job_id: job.id });

    return json({
      success: true,
      job_id: job.id,
      props,
      legenda_post: legendaPost,
      duracao_estimada: duracaoEstimada(props),
      posicao_fila: pos ?? 1,
      usou_ia: usouIA,
    });
  } catch (e) {
    console.error("[video-motion-create] erro:", e);
    return json({ success: false, error: e instanceof Error ? e.message : "erro desconhecido" }, 500);
  }
});
