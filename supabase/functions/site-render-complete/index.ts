// ============================================================
// site-render-complete
// O worker devolve o que leu da página renderizada (cores exatas do
// DOM, texto, fontes, logo) + uma captura do topo. Aqui a IA lê a
// captura + o texto e devolve APENAS interpretação (tom de voz,
// segmento, proposta de valor). As cores nunca vêm da IA.
// Auth: header `x-render-token`.
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { autorizarWorker, renderCors, respJson } from "../_shared/render-auth.ts";
import {
  mesclarCamadaB,
  type AnaliseIA,
  type DadosCamadaB,
  type IdentidadeSite,
} from "../_shared/site-identidade.ts";

const MODELO = "google/gemini-3.8-flash";

async function analisar(
  texto: string,
  capturaDataUrl: string | null,
): Promise<AnaliseIA> {
  const chave = Deno.env.get("LOVABLE_API_KEY");
  if (!chave || (!texto && !capturaDataUrl)) return {};

  const conteudo: unknown[] = [{
    type: "text",
    text:
      `Analise este site de empresa brasileira e responda SOMENTE JSON com as chaves ` +
      `nome_empresa, tagline, descricao, diferenciais, publico_alvo, tom_de_voz, segmento.\n` +
      `Regras: nunca invente cores nem dados que não estejam no material; ` +
      `descricao em 1-3 frases sobre o que o negócio faz; diferenciais separados por " • "; ` +
      `tom_de_voz com 2 a 4 adjetivos; se não souber uma chave, devolva "".\n\n` +
      `Texto lido da página:\n${texto.slice(0, 4000)}`,
  }];
  if (capturaDataUrl) {
    conteudo.push({ type: "image_url", image_url: { url: capturaDataUrl } });
  }

  try {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODELO,
        messages: [{ role: "user", content: conteudo }],
      }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!r.ok) {
      console.error("[identidade] IA falhou", r.status, (await r.text()).slice(0, 300));
      return {};
    }
    const dados = await r.json();
    const bruto = String(dados?.choices?.[0]?.message?.content ?? "");
    const jsonTxt = bruto.match(/\{[\s\S]*\}/)?.[0];
    if (!jsonTxt) return {};
    const p = JSON.parse(jsonTxt);
    return {
      nome_empresa: String(p.nome_empresa ?? ""),
      tagline: String(p.tagline ?? ""),
      descricao: String(p.descricao ?? ""),
      diferenciais: Array.isArray(p.diferenciais) ? p.diferenciais.join(" • ") : String(p.diferenciais ?? ""),
      publico_alvo: String(p.publico_alvo ?? ""),
      tom_de_voz: Array.isArray(p.tom_de_voz) ? p.tom_de_voz.join(", ") : String(p.tom_de_voz ?? ""),
      segmento: String(p.segmento ?? ""),
    };
  } catch (e) {
    console.error("[identidade] IA erro", (e as Error)?.message);
    return {};
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: renderCors });

  const auth = autorizarWorker(req);
  if (!auth.ok) return respJson({ success: false, error: auth.motivo }, 401);

  try {
    const body = await req.json();
    const jobId = String(body?.job_id ?? "");
    if (!jobId) return respJson({ success: false, error: "job_id obrigatório" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: job, error } = await supabase
      .from("site_render_jobs")
      .select("id, identidade_a")
      .eq("id", jobId)
      .maybeSingle();
    if (error) throw error;
    if (!job) return respJson({ success: false, error: "job inexistente" }, 404);

    if (body?.success === false) {
      await supabase.from("site_render_jobs").update({
        status: "erro",
        erro: String(body?.erro ?? "falha no navegador").slice(0, 500),
        updated_at: new Date().toISOString(),
      }).eq("id", jobId);
      return respJson({ success: true });
    }

    const dadosB: DadosCamadaB = {
      cores: Array.isArray(body?.cores) ? body.cores.slice(0, 40) : [],
      texto: String(body?.texto ?? "").slice(0, 6000),
      titulo: String(body?.titulo ?? ""),
      site_name: String(body?.site_name ?? ""),
      fontes: Array.isArray(body?.fontes) ? body.fontes.slice(0, 4).map(String) : [],
      logo_url: body?.logo_url ? String(body.logo_url) : null,
      logo_data_url: body?.logo_data_url ? String(body.logo_data_url) : null,
    };

    const captura = typeof body?.captura_data_url === "string" && body.captura_data_url.startsWith("data:image/")
      ? body.captura_data_url
      : null;

    const ia = await analisar(dadosB.texto ?? "", captura);
    const identidade = mesclarCamadaB(job.identidade_a as IdentidadeSite, dadosB, ia);

    await supabase.from("site_render_jobs").update({
      status: "concluido",
      identidade,
      erro: null,
      updated_at: new Date().toISOString(),
    }).eq("id", jobId);

    return respJson({ success: true });
  } catch (e) {
    return respJson({ success: false, error: (e as Error)?.message }, 500);
  }
});
