// ============================================================
// video-produto-create
// Cria um job de vídeo de PRODUTO (template Remotion "template-produto").
//
// Custo zero por render: fila -> worker da VPS -> Remotion (+ rembg local).
// Nenhuma API paga é chamada aqui.
//
// FASE 2 (premium com IA de vídeo): quando existir, o corpo aceitará
// { nivel: "premium" } e ESTA função é o ponto único de controle —
// whitelist por e-mail, limite diário e checagem de saldo entram aqui,
// antes do insert. Hoje o nível é sempre forçado para "padrao".
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { corsHeaders } from "../_shared/cors.ts";
import {
  checarLimitesMotion,
  logoDoTenant,
  resolverTrilha,
} from "../_shared/video-motion-enfileirar.ts";
import { getTenantBusinessContext } from "../_shared/business-context.ts";
import {
  duracaoEstimadaProduto,
  normalizarPropsProduto,
  validarImagemProduto,
} from "../_shared/video-produto.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const PLATAFORMAS_OK = ["instagram", "facebook", "linkedin", "tiktok"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ success: false, error: "Não autenticado" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const anon = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    } as any);
    const { data: authData, error: authErr } = await anon.auth.getUser();
    const user = authData?.user;
    if (authErr || !user) return json({ success: false, error: "Sessão inválida" }, 401);

    const sb = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json().catch(() => ({}));

    const imagemUrl = validarImagemProduto(String(body?.imagem_url ?? ""), SUPABASE_URL);
    if (!imagemUrl) {
      return json({
        success: false,
        error: "Escolha uma foto de produto já hospedada na plataforma.",
      }, 400);
    }

    // Marca do CTA: o que o usuário digitou; senão o nome real da empresa do
    // tenant. Nunca deixamos o placeholder literal "Sua marca" ir para o vídeo.
    const marcaDigitada = String(body?.marca ?? "").trim();
    let marcaFinal = marcaDigitada;
    if (!marcaFinal) {
      try {
        const ctxTenant = await getTenantBusinessContext(sb, user.id, {});
        marcaFinal = String(ctxTenant?.nome ?? "").trim();
      } catch (_e) {
        marcaFinal = "";
      }
    }

    const props = normalizarPropsProduto(body?.props ?? {}, {
      marca: marcaFinal || undefined,
      imagemUrl,
    });
    if (!props.produto.nome) {
      return json({ success: false, error: "Informe o nome do produto." }, 400);
    }

    const tema = `Vídeo de produto: ${props.produto.nome}`;

    // Só devolve a prévia do roteiro, sem ocupar a fila.
    if (body?.apenas_roteiro) {
      return json({
        success: true,
        apenas_roteiro: true,
        props,
        duracao_estimada: duracaoEstimadaProduto(props),
      });
    }

    const bloqueio = await checarLimitesMotion(sb, user.id, "plataforma", tema);
    if (bloqueio) return json({ success: false, error: bloqueio.error, motivo: bloqueio.motivo }, bloqueio.status);

    const logoPath = await logoDoTenant(sb, user.id);
    const trilha = await resolverTrilha(sb, user.id, {
      sb,
      userId: user.id,
      tema,
      trilhaId: typeof body?.trilha_id === "string" ? body.trilha_id : null,
      semTrilha: body?.sem_trilha === true,
      trilhaVolume: typeof body?.trilha_volume === "number" ? body.trilha_volume : null,
    } as any);

    const propsFinal = {
      ...props,
      site: props.site || "",
      logo_path: logoPath,
      logoUrl: undefined,
      trilha_id: trilha?.id,
      trilha_path: trilha?.path,
      trilha_volume: trilha?.volume ?? 0.28,
      trilhaUrl: undefined,
    };

    const plataformas = Array.isArray(body?.plataformas)
      ? (body.plataformas as unknown[]).map((p) => String(p).toLowerCase()).filter((p) => PLATAFORMAS_OK.includes(p))
      : [];

    const { data: job, error: insErr } = await sb
      .from("video_motion_jobs")
      .insert({
        user_id: user.id,
        origem: "plataforma",
        template: "template-produto",
        titulo: tema.slice(0, 140),
        props: propsFinal,
        trilha_id: propsFinal.trilha_id ?? null,
        trilha_volume: propsFinal.trilha_volume ?? 0.28,
        legenda_post: String(body?.legenda_post ?? "").trim() || null,
        plataformas,
        formato: ["reels", "story", "feed"].includes(String(body?.formato)) ? String(body.formato) : "reels",
        metadata: {
          origem: "plataforma",
          tipo: "produto",
          nivel: "padrao",
          recortar_fundo: propsFinal.produto.recortar_fundo === true,
          produto_id: typeof body?.produto_id === "string" ? body.produto_id : null,
        },
      })
      .select()
      .single();

    if (insErr) return json({ success: false, error: insErr.message ?? "erro ao enfileirar" }, 500);

    const { data: pos } = await sb.rpc("video_motion_fila_posicao", { p_job_id: job.id });

    return json({
      success: true,
      job_id: job.id,
      props: propsFinal,
      duracao_estimada: duracaoEstimadaProduto(props),
      posicao_fila: pos ?? 1,
    });
  } catch (e) {
    console.error("[video-produto-create] erro:", e);
    return json({ success: false, error: e instanceof Error ? e.message : "erro desconhecido" }, 500);
  }
});
