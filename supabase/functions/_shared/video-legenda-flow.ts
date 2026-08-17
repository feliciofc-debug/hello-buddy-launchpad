// ============================================================
// Fluxo "vídeo pelo WhatsApp → legenda queimada → publicação"
//
//  1. dono manda o vídeo  → transcreve (video-transcrever-legendas)
//  2. IA gera 3 copies    → manda A/B/C no WhatsApp
//  3. dono escolhe A/B/C  → pergunta se pode publicar
//  4. dono confirma       → enfileira em video_render_jobs (worker da VPS)
//
// O estado do fluxo vive na própria fila (`video_render_jobs.status`),
// então nada se perde entre invocações da edge function.
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

export interface SegmentoLegenda {
  start: number;
  end: number;
  text: string;
}

/** Extrai bucket/path de uma URL pública ou assinada do Storage. */
export function bucketPathDeUrl(url: string): { bucket: string; path: string } | null {
  const m = url.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+?)(?:\?|$)/);
  if (!m) return null;
  return { bucket: m[1], path: decodeURIComponent(m[2]) };
}

/**
 * Nome da empresa do cliente, usando o dado que já existe na plataforma.
 * Ordem: empresa_config.nome_empresa → profiles.nome_fantasia → profiles.nome.
 */
export async function resolverNomeEmpresa(userId: string): Promise<string> {
  try {
    const { data: cfg } = await sb
      .from("empresa_config")
      .select("nome_empresa")
      .eq("user_id", userId)
      .maybeSingle();
    const doCfg = String((cfg as any)?.nome_empresa || "").trim();
    if (doCfg) return doCfg;

    const { data: prof } = await sb
      .from("profiles")
      .select("nome_fantasia, nome")
      .eq("id", userId)
      .maybeSingle();
    return String((prof as any)?.nome_fantasia || (prof as any)?.nome || "").trim();
  } catch (e) {
    console.warn("[video-legenda-flow] nome da empresa indisponível:", (e as Error).message);
    return "";
  }
}

async function transcrever(videoUrl: string, nomeEmpresa?: string): Promise<SegmentoLegenda[]> {
  const { data, error } = await sb.functions.invoke("video-transcrever-legendas", {
    body: { video_url: videoUrl, nome_empresa: nomeEmpresa || undefined },
  });
  if (error) throw error;
  if (!data?.success) throw new Error(data?.error || "transcrição falhou");
  return (data.segments || []) as SegmentoLegenda[];
}


function textoDaTranscricao(segs: SegmentoLegenda[]): string {
  return segs.map((s) => s.text.replace(/\n/g, " ")).join(" ").trim();
}

/** Gera 3 opções de copy a partir da transcrição do vídeo. */
async function gerarTresCopies(
  transcricao: string,
  contexto: string,
  nomeEmpresa: string,
): Promise<string[]> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) throw new Error("LOVABLE_API_KEY ausente");

  const prompt = `Você é o social media da empresa "${nomeEmpresa}".

FALA DO VÍDEO (transcrição real, use como fonte principal):
"""
${transcricao}
"""

${contexto ? `CONTEXTO EXTRA DO DONO: "${contexto}"` : ""}

Crie 3 opções de legenda (copy) para publicar esse vídeo em Instagram/Facebook.

REGRAS:
- Baseie-se SOMENTE no que é dito no vídeo. Não invente produto, preço ou promessa.
- Cada opção com no máximo 500 caracteres, tom natural, sem clichê corporativo.
- Termine cada opção com um convite claro (CTA).
- Inclua de 6 a 10 hashtags relevantes no fim de cada opção.
- Não cite nomes de pessoas da equipe nem se dirija ao dono.
- Sem emojis em excesso (no máximo 3 por opção).

Responda SOMENTE com JSON válido:
{"opcoes":["copy A","copy B","copy C"]}`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) throw new Error(`IA falhou: ${res.status}`);
  const json = await res.json();
  let parsed: any = {};
  try {
    parsed = JSON.parse(json?.choices?.[0]?.message?.content || "{}");
  } catch {
    const m = String(json?.choices?.[0]?.message?.content || "").match(/\{[\s\S]*\}/);
    if (m) parsed = JSON.parse(m[0]);
  }
  const opcoes = (parsed?.opcoes || parsed?.options || [])
    .map((o: any) => String(o || "").trim())
    .filter(Boolean)
    .slice(0, 3);
  if (opcoes.length === 0) throw new Error("IA não devolveu opções");
  return opcoes;
}

function montarMensagemOpcoes(opcoes: string[]): string {
  const letras = ["A", "B", "C"];
  const blocos = opcoes
    .map((o, i) => `*Opção ${letras[i]}*\n${o}`)
    .join("\n\n———\n\n");
  return `🎬 Assisti seu vídeo e transcrevi a fala. Fiz 3 legendas:\n\n${blocos}\n\nResponda *A*, *B* ou *C* para escolher.`;
}

/**
 * Passo 1+2: transcreve o vídeo, gera as 3 copies e cria o job aguardando escolha.
 * Retorna a mensagem a enviar ao dono (ou null se não conseguiu transcrever).
 */
export async function iniciarFluxoLegendaVideo(params: {
  userId: string;
  telefone: string;
  videoUrl: string;
  contexto?: string;
  nomeEmpresa?: string;
  midiaId?: string;
}): Promise<string | null> {
  const loc = bucketPathDeUrl(params.videoUrl);
  if (!loc) {
    console.warn("[video-legenda-flow] URL do vídeo fora do Storage:", params.videoUrl);
    return null;
  }

  // Nome da empresa entra no prompt da transcrição para não sair "Ademicom".
  const nomeEmpresa =
    (params.nomeEmpresa || "").trim() || (await resolverNomeEmpresa(params.userId));

  let segmentos: SegmentoLegenda[] = [];
  try {
    segmentos = await transcrever(params.videoUrl, nomeEmpresa);
  } catch (e) {
    console.error("[video-legenda-flow] transcrição falhou:", (e as Error).message);
    return null;
  }

  const transcricao = textoDaTranscricao(segmentos);
  if (!transcricao) {
    console.log("[video-legenda-flow] vídeo sem fala — fluxo de legenda não se aplica");
    return null;
  }

  let opcoes: string[];
  try {
    opcoes = await gerarTresCopies(
      transcricao,
      params.contexto || "",
      nomeEmpresa || "Sua empresa",
    );

  } catch (e) {
    console.error("[video-legenda-flow] copies falharam:", (e as Error).message);
    return null;
  }

  // Descarta fluxos antigos ainda abertos deste usuário (evita ambiguidade no "A/B/C")
  await sb
    .from("video_render_jobs")
    .update({ status: "cancelado" })
    .eq("user_id", params.userId)
    .in("status", ["aguardando_escolha", "aguardando_confirmacao"]);

  const { error } = await sb.from("video_render_jobs").insert({
    user_id: params.userId,
    telefone: params.telefone,
    origem: "whatsapp",
    video_bucket: loc.bucket,
    video_path: loc.path,
    segmentos,
    status: "aguardando_escolha",
    formato: "reels",
    // Padrão seguro: NÃO publica. Só publica se o dono pedir "PUBLICAR".
    plataformas: [],
    metadata: {
      opcoes,
      transcricao,
      contexto: params.contexto || null,
      midia_id: params.midiaId || null,
    },
  });
  if (error) {
    console.error("[video-legenda-flow] insert do job falhou:", error.message);
    return null;
  }

  return montarMensagemOpcoes(opcoes);
}

function detectarEscolha(texto: string): number | null {
  const t = (texto || "").trim().toLowerCase();
  if (/^(a|op[çc][ãa]o a|1)\b/.test(t) || /\bop[çc][ãa]o a\b/.test(t)) return 0;
  if (/^(b|op[çc][ãa]o b|2)\b/.test(t) || /\bop[çc][ãa]o b\b/.test(t)) return 1;
  if (/^(c|op[çc][ãa]o c|3)\b/.test(t) || /\bop[çc][ãa]o c\b/.test(t)) return 2;
  return null;
}

function ehConfirmacao(texto: string): boolean {
  return /\b(sim|pode|publica(r)?|posta(r)?|manda(r)?|envia(r)?|autorizo|confirmo|vai|bora|ok)\b/i.test(
    texto || "",
  );
}

/**
 * Decide se a confirmação autoriza PUBLICAR ou apenas ENVIAR o vídeo pronto.
 * Padrão seguro: enviar (sem publicar) — só publica se o dono pedir explicitamente.
 */
function querPublicar(texto: string): boolean {
  const t = texto || "";
  if (/\bn[ãa]o\s+publica/i.test(t) || /\bsem\s+publicar\b/i.test(t)) return false;
  if (/\b(s[óo]\s+(me\s+)?(manda|mandar|envia|enviar)|conferir|confiro|revisar)\b/i.test(t)) {
    return false;
  }
  return /\b(publica(r)?|posta(r)?|publique|no\s+ar|instagram|facebook)\b/i.test(t);
}

function ehNegativa(texto: string): boolean {
  return /\b(n[ãa]o|nao|cancela(r)?|espera|depois|para)\b/i.test(texto || "");
}

/**
 * Passos 3 e 4: interpreta a resposta do dono para um fluxo já aberto.
 * Retorna a mensagem a enviar, ou null se a mensagem não pertence a este fluxo
 * (aí o roteador normal do agente segue).
 */
export async function tratarRespostaFluxoLegenda(params: {
  userId: string;
  telefone: string;
  texto: string;
}): Promise<string | null> {
  const { data: job } = await sb
    .from("video_render_jobs")
    .select("*")
    .eq("user_id", params.userId)
    .in("status", ["aguardando_escolha", "aguardando_confirmacao"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!job) return null;

  // ---- aguardando escolha da copy ----
  if (job.status === "aguardando_escolha") {
    const idx = detectarEscolha(params.texto);
    if (idx === null) {
      if (ehNegativa(params.texto)) {
        await sb.from("video_render_jobs").update({ status: "cancelado" }).eq("id", job.id);
        return "Beleza, deixei esse vídeo de lado. Quando quiser, me manda de novo.";
      }
      return null; // não é resposta do fluxo — deixa o agente responder
    }
    const opcoes: string[] = job.metadata?.opcoes || [];
    const caption = opcoes[idx];
    if (!caption) return null;

    await sb
      .from("video_render_jobs")
      .update({ caption, status: "aguardando_confirmacao" })
      .eq("id", job.id);

    return `Escolha registrada ✅\n\n*Legenda do post:*\n${caption}\n\nA legenda também vai aparecer *na tela do vídeo*, acompanhando a fala.\n\nPosso publicar no Instagram e no Facebook agora? Responda *SIM*.`;
  }

  // ---- aguardando confirmação de publicação ----
  if (job.status === "aguardando_confirmacao") {
    // troca de opção depois de escolher
    const idx = detectarEscolha(params.texto);
    if (idx !== null) {
      const opcoes: string[] = job.metadata?.opcoes || [];
      if (opcoes[idx]) {
        await sb
          .from("video_render_jobs")
          .update({ caption: opcoes[idx] })
          .eq("id", job.id);
        return `Troquei para a opção escolhida ✅\n\n${opcoes[idx]}\n\nPosso publicar agora? Responda *SIM*.`;
      }
    }
    if (ehNegativa(params.texto)) {
      await sb.from("video_render_jobs").update({ status: "cancelado" }).eq("id", job.id);
      return "Sem problema, não publiquei nada. Quando quiser, me avise.";
    }
    if (ehConfirmacao(params.texto)) {
      await sb
        .from("video_render_jobs")
        .update({ status: "pendente", tentativas: 0, erro_mensagem: null })
        .eq("id", job.id);
      return "Perfeito! 🎬 Estou gravando a legenda no vídeo e publico em seguida. Te aviso aqui quando estiver no ar — pode fechar o WhatsApp, isso roda no servidor.";
    }
    return null;
  }

  return null;
}
