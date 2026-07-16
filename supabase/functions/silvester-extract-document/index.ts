// silvester-extract-document
// Recebe mídia/texto de um cliente do Silvester, extrai dados via Gemini Vision
// e monta/atualiza o dossiê. Notifica o dono (Marcelo) quando parcial/completo.
//
// Body: {
//   user_id: string,               // dono do agente (Marcelo)
//   telefone_cliente: string,      // número WhatsApp do cliente
//   nome_cliente?: string,
//   owner_phone?: string,          // Marcelo's phone para notificar
//   media?: Array<{ url: string; mime?: string; wamid?: string; caption?: string }>,
//   texto_conversa?: string,       // últimas mensagens do cliente pra extrair dados
// }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const WHATSAPP_TOKEN = Deno.env.get("WHATSAPP_TOKEN") ?? Deno.env.get("META_ACCESS_TOKEN") ?? "";
const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

// ---- Prompt de classificação + extração ----------------------------------
const VISION_PROMPT = `Você é o Silvester, assistente de consultor de consórcio. Analise a imagem/PDF abaixo e devolva um JSON puro (sem markdown, sem comentário) no formato:

{
  "tipo": "rg" | "cnh" | "comprovante_residencia" | "comprovante_renda" | "ir" | "foto_bem" | "outro",
  "legivel": true | false,
  "observacao_curta": "1 frase sobre o que foi visto",
  "dados": {
    "nome_completo": "...",
    "cpf": "...",
    "rg": "...",
    "data_nascimento": "YYYY-MM-DD",
    "profissao": "...",
    "renda_mensal": 0,
    "endereco_logradouro": "...",
    "endereco_numero": "...",
    "endereco_bairro": "...",
    "endereco_cidade": "...",
    "endereco_estado": "UF",
    "endereco_cep": "..."
  }
}

Regras:
- Se algum campo não aparecer no documento, OMITA a chave (não invente).
- CPF: só dígitos (11).
- Datas no formato ISO YYYY-MM-DD.
- renda_mensal: número (sem R$, sem pontos, use ponto decimal).
- Se for uma foto de veículo/imóvel/objeto, tipo="foto_bem" e observação descrevendo (marca/modelo/cor se dá pra ver).
- Se não for documento nem bem, tipo="outro".
- Se estiver borrada/ilegível, legivel=false e explique em observacao_curta.
- Devolva JSON PURO. Nada mais.`;

const TEXT_EXTRACTION_PROMPT = `Analise a conversa abaixo (cliente falando com o Silvester sobre consórcio) e extraia SÓ os dados que o CLIENTE mencionou explicitamente. Devolva JSON puro:

{
  "nome_completo": "...",
  "cpf": "...",
  "data_nascimento": "YYYY-MM-DD",
  "estado_civil": "solteiro|casado|divorciado|viuvo|uniao_estavel",
  "profissao": "...",
  "renda_mensal": 0,
  "email": "...",
  "telefone_alternativo": "...",
  "endereco_cidade": "...",
  "endereco_estado": "UF",
  "interesse_bem": "auto|imovel|servico|moto|caminhao",
  "interesse_valor_carta": 0,
  "interesse_prazo_meses": 0,
  "interesse_aceita_lance": true|false,
  "interesse_observacoes": "..."
}

Regras:
- OMITA chaves que o cliente não mencionou (não invente, não deduza).
- renda_mensal e interesse_valor_carta em número puro (sem R$).
- Devolva JSON PURO. Nada mais.

CONVERSA:
`;

// ---- Helpers -------------------------------------------------------------

async function fetchAsBase64(url: string): Promise<{ base64: string; mime: string }> {
  // Se for WhatsApp media ID URL (graph.facebook.com), precisa header Auth
  const headers: Record<string, string> = {};
  if (url.includes("graph.facebook.com") && WHATSAPP_TOKEN) {
    headers["Authorization"] = `Bearer ${WHATSAPP_TOKEN}`;
  }
  const r = await fetch(url, { headers });
  if (!r.ok) throw new Error(`fetch media ${r.status}`);
  const mime = r.headers.get("content-type") ?? "image/jpeg";
  const buf = new Uint8Array(await r.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
  return { base64: btoa(bin), mime };
}

async function uploadToStorage(userId: string, dossieId: string, base64: string, mime: string): Promise<string> {
  const ext = mime.includes("pdf") ? "pdf" : mime.includes("png") ? "png" : "jpg";
  const path = `${userId}/${dossieId}/${crypto.randomUUID()}.${ext}`;
  const bin = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const { error } = await sb.storage.from("silvester-docs").upload(path, bin, { contentType: mime, upsert: false });
  if (error) throw error;
  return path;
}

async function callVision(base64: string, mime: string): Promise<any> {
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-pro",
      messages: [{
        role: "user",
        content: [
          { type: "text", text: VISION_PROMPT },
          { type: "image_url", image_url: { url: `data:${mime};base64,${base64}` } },
        ],
      }],
    }),
  });
  if (!r.ok) throw new Error(`vision ${r.status}: ${await r.text()}`);
  const data = await r.json();
  const raw = data?.choices?.[0]?.message?.content ?? "{}";
  const cleaned = raw.replace(/```json\s*|\s*```/g, "").trim();
  try { return JSON.parse(cleaned); } catch { return { tipo: "outro", legivel: false, observacao_curta: "IA não retornou JSON válido" }; }
}

async function extractFromText(texto: string): Promise<any> {
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${LOVABLE_API_KEY}` },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "user", content: TEXT_EXTRACTION_PROMPT + texto }],
    }),
  });
  if (!r.ok) return {};
  const data = await r.json();
  const raw = data?.choices?.[0]?.message?.content ?? "{}";
  const cleaned = raw.replace(/```json\s*|\s*```/g, "").trim();
  try { return JSON.parse(cleaned); } catch { return {}; }
}

async function getOrCreateDossie(userId: string, telefone: string, nomeCliente?: string) {
  const { data: existing } = await sb
    .from("silvester_dossies")
    .select("*")
    .eq("user_id", userId)
    .eq("telefone_cliente", telefone)
    .maybeSingle();
  if (existing) return existing;
  const { data, error } = await sb
    .from("silvester_dossies")
    .insert({ user_id: userId, telefone_cliente: telefone, nome_completo: nomeCliente || null, status: "coletando" })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

async function updateDossieFields(dossieId: string, patch: Record<string, any>) {
  // remove chaves vazias/null
  const clean: Record<string, any> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (v === null || v === undefined) continue;
    if (typeof v === "string" && v.trim() === "") continue;
    clean[k] = v;
  }
  if (Object.keys(clean).length === 0) return;
  await sb.from("silvester_dossies").update(clean).eq("id", dossieId);
}

async function sendWhatsAppText(toPhone: string, body: string) {
  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) return;
  try {
    await fetch(`https://graph.facebook.com/v20.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${WHATSAPP_TOKEN}` },
      body: JSON.stringify({ messaging_product: "whatsapp", to: toPhone, type: "text", text: { body } }),
    });
  } catch (e) {
    console.warn("[silvester] notify owner failed", (e as Error).message);
  }
}

function mapTipoToLabel(tipo: string) {
  return {
    rg: "RG",
    cnh: "CNH",
    comprovante_residencia: "comprovante de residência",
    comprovante_renda: "comprovante de renda",
    ir: "declaração de IR",
    foto_bem: "foto do bem",
    outro: "documento",
  }[tipo] ?? "documento";
}

// ---- Handler -------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const { user_id, telefone_cliente, nome_cliente, owner_phone, media = [], texto_conversa } = body ?? {};
    if (!user_id || !telefone_cliente) {
      return new Response(JSON.stringify({ ok: false, error: "missing user_id/telefone_cliente" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const dossie = await getOrCreateDossie(user_id, telefone_cliente, nome_cliente);
    console.log("[silvester] dossie", dossie.id, "score inicial", dossie.completeness_score);

    const resumoDocs: string[] = [];

    // 1) Extração de texto (dados que o cliente escreveu)
    if (texto_conversa && texto_conversa.trim().length > 20) {
      try {
        const extracted = await extractFromText(texto_conversa);
        console.log("[silvester] texto extracted", Object.keys(extracted));
        await updateDossieFields(dossie.id, extracted);
      } catch (e) {
        console.warn("[silvester] extractFromText failed", (e as Error).message);
      }
    }

    // 2) Extração de cada mídia
    for (const m of media) {
      try {
        const { base64, mime } = await fetchAsBase64(m.url);
        const isImageOrPdf = mime.startsWith("image/") || mime.includes("pdf");
        if (!isImageOrPdf) {
          console.log("[silvester] pulando mime não suportado:", mime);
          continue;
        }
        const storagePath = await uploadToStorage(user_id, dossie.id, base64, mime);
        const vision = await callVision(base64, mime);
        const tipo = vision?.tipo ?? "outro";
        const legivel = vision?.legivel !== false;
        const dados = vision?.dados ?? {};

        await sb.from("silvester_documentos").insert({
          dossie_id: dossie.id,
          user_id,
          tipo,
          storage_path: storagePath,
          mime_type: mime,
          ocr_texto: vision?.observacao_curta ?? null,
          dados_extraidos: dados,
          status_validacao: legivel ? "validado" : "ilegivel",
          observacoes_ia: vision?.observacao_curta ?? null,
          wamid: m.wamid ?? null,
          processed_at: new Date().toISOString(),
        });

        // aplica dados extraídos no dossiê
        if (dados && Object.keys(dados).length > 0) {
          await updateDossieFields(dossie.id, dados);
        }

        resumoDocs.push(`${mapTipoToLabel(tipo)}${legivel ? " ✅" : " ⚠️ ilegível"}`);
      } catch (e) {
        console.warn("[silvester] media processing failed", (e as Error).message);
      }
    }

    // 3) Recarrega dossiê pra pegar score atualizado
    const { data: updated } = await sb.from("silvester_dossies").select("*").eq("id", dossie.id).single();
    if (!updated) return new Response(JSON.stringify({ ok: true, dossie_id: dossie.id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // 4) Notifica Marcelo em 2 momentos: parcial (>=30 e sem parcial_notified) / completo (>=80 e sem completo_notified)
    const nome = updated.nome_completo || nome_cliente || "cliente";
    const interesse = updated.interesse_bem
      ? `${updated.interesse_bem}${updated.interesse_valor_carta ? ` R$${Number(updated.interesse_valor_carta).toLocaleString("pt-BR")}` : ""}`
      : "consórcio (interesse não detalhado)";

    if (owner_phone && updated.completeness_score >= 30 && !updated.parcial_notified_at) {
      const msg = `🟡 *Silvester — dossiê iniciado*\n\n👤 ${nome}\n📱 ${telefone_cliente}\n🎯 Interesse: ${interesse}\n📊 Completude: ${updated.completeness_score}%\n${resumoDocs.length ? `📎 Docs: ${resumoDocs.join(", ")}\n` : ""}\nAbra em /dossies pra ver a ficha.`;
      await sendWhatsAppText(owner_phone, msg);
      await sb.from("silvester_dossies").update({ parcial_notified_at: new Date().toISOString() }).eq("id", dossie.id);
    }

    if (owner_phone && updated.completeness_score >= 80 && !updated.completo_notified_at) {
      const msg = `🟢 *Silvester — dossiê COMPLETO*\n\n👤 ${nome}\n📱 ${telefone_cliente}\n🎯 Interesse: ${interesse}\n📊 Completude: ${updated.completeness_score}%\n💰 Renda declarada: ${updated.renda_mensal ? `R$ ${Number(updated.renda_mensal).toLocaleString("pt-BR")}` : "—"}\n📎 Documentos anexados prontos pra proposta.\n\nAbra /dossies pra baixar tudo em .zip.`;
      await sendWhatsAppText(owner_phone, msg);
      await sb.from("silvester_dossies").update({ completo_notified_at: new Date().toISOString(), status: "aguardando_proposta" }).eq("id", dossie.id);
    }

    return new Response(
      JSON.stringify({ ok: true, dossie_id: dossie.id, score: updated.completeness_score, docs_processados: resumoDocs }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[silvester-extract-document] error", (e as Error).message);
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
