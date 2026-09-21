// ============================================================
// video-render-complete
// O worker da VPS avisa o fim do encode (sucesso ou erro).
// Em caso de sucesso: publica nas redes e avisa o cliente no WhatsApp.
// Em caso de erro: retenta até 3 vezes; depois avisa o cliente com a
// opção de publicar sem legenda.
//
// Auth: header `x-render-token` = secret VPS_RENDER_TOKEN.
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { autorizarWorker, renderCors, respJson } from "../_shared/render-auth.ts";
import { linhaCodigoMidia } from "../_shared/publicacao-por-id.ts";

const MAX_TENTATIVAS = 3;

async function avisarCliente(
  supabase: any,
  job: any,
  message: string,
  videoUrl?: string,
) {
  if (!job.telefone) return;
  try {
    await supabase.functions.invoke("whatsapp-send-message", {
      body: {
        user_id: job.user_id,
        to: job.telefone,
        message,
        ...(videoUrl ? { video_url: videoUrl } : {}),
      },
    });
  } catch (e) {
    console.error("[video-render-complete] aviso WhatsApp falhou:", e);
  }
}

async function registrarVideoLegendado(
  supabase: any,
  job: any,
  videoUrl: string,
  duracao?: number | null,
): Promise<string> {
  const { data: existente } = await supabase
    .from("midias_whatsapp")
    .select("id")
    .eq("user_id", job.user_id)
    .eq("midia_url", videoUrl)
    .limit(1)
    .maybeSingle();
  if (existente?.id) return existente.id;

  const midiaPaiId = typeof job.metadata?.midia_id === "string" ? job.metadata.midia_id : null;
  const legenda = job.copy_escolhida || job.caption || "Vídeo com legenda queimada";
  const duracaoNumero = duracao == null ? Number.NaN : Number(duracao);
  const duracaoInteira = Number.isFinite(duracaoNumero) ? Math.round(duracaoNumero) : null;
  const { data, error } = await supabase
    .from("midias_whatsapp")
    .insert({
      user_id: job.user_id,
      origem: "video_legendado",
      telefone_origem: job.telefone || null,
      tipo: "video",
      midia_url: videoUrl,
      mime_type: "video/mp4",
      duracao_segundos: duracaoInteira,
      contexto_original: String(legenda).slice(0, 1500),
      midia_pai_id: midiaPaiId,
      status: "pendente",
    })
    .select("id")
    .single();
  if (error || !data?.id) throw new Error(`não consegui registrar o vídeo legendado em /midias: ${error?.message || "id ausente"}`);
  return data.id;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: renderCors });

  const auth = autorizarWorker(req);
  if (!auth.ok) return respJson({ success: false, error: auth.motivo }, 401);

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json();
    const {
      job_id,
      success: encodeOk,
      resultado_bucket,
      resultado_path,
      duracao_segundos,
      erro,
    } = body || {};

    if (!job_id) throw new Error("job_id obrigatório");

    const { data: job, error: jErr } = await supabase
      .from("video_render_jobs")
      .select("*")
      .eq("id", job_id)
      .maybeSingle();
    if (jErr || !job) throw new Error("job não encontrado");

    // ---------- FALHA NO ENCODE ----------
    if (!encodeOk) {
      const tentativas = (job.tentativas || 0) + 1;
      const definitivo = tentativas >= MAX_TENTATIVAS;

      await supabase
        .from("video_render_jobs")
        .update({
          status: definitivo ? "falha_definitiva" : "pendente",
          tentativas,
          claimed_at: null,
          erro_mensagem: String(erro || "erro no encode"),
        })
        .eq("id", job.id);

      if (definitivo) {
        await avisarCliente(
          supabase,
          job,
          "Não consegui gerar a legenda no seu vídeo desta vez. 😕\n\nQuer que eu publique o vídeo *sem legenda*? Responda *SIM* para publicar assim, ou envie o vídeo novamente para eu tentar de novo.",
        );
      }

      return respJson({ success: true, retentativa: !definitivo });
    }

    // ---------- SUCESSO ----------
    if (!resultado_path) throw new Error("resultado_path obrigatório no sucesso");
    const bucket = resultado_bucket || "videos";

    const { data: pub } = supabase.storage.from(bucket).getPublicUrl(resultado_path);
    const videoUrl = pub?.publicUrl;
    if (!videoUrl) throw new Error("não consegui montar a URL pública do vídeo");

    const plataformas: string[] = Array.isArray(job.plataformas) ? job.plataformas : [];
    const querPublicar = plataformas.length > 0;

    // NUNCA publicamos direto após o encode: o dono precisa ver o vídeo e aprovar.
    await supabase
      .from("video_render_jobs")
      .update({
        status: querPublicar ? "aguardando_aprovacao" : "concluido",
        resultado_bucket: bucket,
        resultado_path,
        duracao_segundos: duracao_segundos ?? null,
        concluido_at: new Date().toISOString(),
        erro_mensagem: null,
      })
      .eq("id", job.id);

    // Única mensagem do fluxo que mostra a legenda completa.
    const legenda = job.copy_escolhida || job.caption;
    const blocoLegenda = legenda ? `\n\n*Legenda escolhida:*\n${legenda}` : "";
    let midiaId: string | null = null;
    let codigoMidia = "";
    let bibliotecaErro: string | null = null;
    try {
      midiaId = await registrarVideoLegendado(supabase, job, videoUrl, duracao_segundos ?? null);
      codigoMidia = linhaCodigoMidia(midiaId, "video");
    } catch (e) {
      bibliotecaErro = e instanceof Error ? e.message : String(e);
      console.error("[video-render-complete] registro em /midias falhou; entregando MP4 mesmo assim:", bibliotecaErro);
    }
    const blocoCodigo = codigoMidia ? `\n\n${codigoMidia}` : "";

    if (!querPublicar) {
      // Modo "só me devolve": manda o MP4 legendado no WhatsApp, sem publicar nada.
      await avisarCliente(
        supabase,
        job,
        `🎬 Pronto! Legenda queimada na tela. *Não publiquei em lugar nenhum.*${blocoCodigo}${blocoLegenda}`,
        videoUrl,
      );
    } else {
      const nomes = plataformas
        .map((p) => (p === "instagram" ? "Instagram" : p === "facebook" ? "Facebook" : p))
        .join(" e ");
      const fmt = String(job.formato || "feed").toLowerCase();
      const nomeFormato = fmt === "story" ? "STORY" : fmt === "reels" ? "REELS" : "FEED";
      await avisarCliente(
        supabase,
        job,
        `🎬 Vídeo pronto com a legenda na tela. *Ainda não publiquei nada.*${blocoCodigo}${blocoLegenda}\n\nResponda *APROVAR* que eu publico como *${nomeFormato}* no ${nomes}, ou *CANCELAR* e nada vai ao ar.`,
        videoUrl,
      );
    }


    return respJson({
      success: true,
      aguardando_aprovacao: querPublicar,
      video_url: videoUrl,
      midia_id: midiaId,
      biblioteca_erro: bibliotecaErro,
    });

  } catch (e) {
    console.error("[video-render-complete] erro:", e);
    return respJson({
      success: false,
      error: e instanceof Error ? e.message : "erro desconhecido",
    });
  }
});
