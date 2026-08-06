// Fase 2 · Bloco B — Disparo de convite de opt-in via Meta Cloud API
// Entrada: { lista_id: uuid, template_id: uuid, dry_run?: boolean, limite?: number }
// Autenticação: JWT do usuário (RLS via user_id).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RECONVITE_COOLDOWN_DIAS = 30;
const BATCH_SIZE = 50;
const META_API = "https://graph.facebook.com/v25.0";

function ok(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}
function refuse(reason: string, extra: Record<string, unknown> = {}) {
  return ok({ success: false, reason, ...extra });
}

function envioDiaSP(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

function normalizePhone(raw: string): string | null {
  const only = (raw || "").replace(/\D/g, "");
  if (only.length < 10) return null;
  return only.startsWith("55") ? only : `55${only}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) return refuse("nao_autenticado");

    const { lista_id, template_id, dry_run = false, limite } = await req.json();
    if (!lista_id || !template_id) return refuse("parametros_invalidos");

    // ---------- 1. Guardrails de configuração ----------
    const { data: cfg } = await supabase
      .from("whatsapp_config")
      .select("waba_id, phone_number_id, access_token, is_active")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!cfg?.is_active || !cfg.waba_id || !cfg.phone_number_id || !cfg.access_token) {
      return refuse("whatsapp_nao_conectado");
    }

    const { data: tpl } = await supabase
      .from("whatsapp_templates")
      .select("id, nome_meta, idioma, tipo_uso, status_meta, body_text, variaveis_map")
      .eq("id", template_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!tpl) return refuse("template_nao_encontrado");
    if (!["convite", "convite_optin"].includes(tpl.tipo_uso ?? "")) {
      return refuse("template_nao_e_convite", { tipo_uso: tpl.tipo_uso });
    }
    if (tpl.status_meta !== "aprovado") {
      return refuse("template_nao_aprovado", { status_meta: tpl.status_meta });
    }

    // Flag informativa apenas — convite é SEMPRE Meta oficial.
    const { data: flag } = await supabase
      .from("feature_flags")
      .select("is_enabled")
      .eq("flag_key", "usar_meta_oficial")
      .maybeSingle();
    const flagOn = !!flag?.is_enabled;

    // ---------- 1.b Dados para preencher as variáveis do template ----------
    const [{ data: ebookCfg }, { data: empresaCfg }, { data: perfil }] = await Promise.all([
      supabase.from("tenant_ebooks").select("nome").eq("user_id", user.id).maybeSingle(),
      supabase.from("empresa_config").select("nome_empresa").eq("user_id", user.id).maybeSingle(),
      supabase.from("profiles").select("nome_fantasia").eq("id", user.id).maybeSingle(),
    ]);

    const nomeNegocio =
      empresaCfg?.nome_empresa || perfil?.nome_fantasia || "nossa equipe";
    const nomeEbook = ebookCfg?.nome || "nosso ebook exclusivo";

    // Quantas variáveis {{n}} o template exige (ordem importa para a Meta)
    const varIdx = Array.from(
      new Set(
        [...String(tpl.body_text || "").matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]))
      )
    ).sort((a, b) => a - b);

    const varMap = (tpl.variaveis_map || {}) as Record<string, { campo?: string }>;

    function buildParams(nomeContato: string) {
      return varIdx.map((i) => {
        const campo = varMap[String(i)]?.campo || "";
        let valor: string;
        if (campo === "negocio" || campo === "empresa") valor = nomeNegocio;
        else if (campo === "ebook") valor = nomeEbook;
        else if (campo === "nome" || campo === "" ) valor = nomeContato;
        else valor = nomeContato;
        return { type: "text", text: (valor || "Cliente").slice(0, 120) };
      });
    }



    // ---------- 2. Teto diário (mesmo contador do executor) ----------
    const { data: clienteCfg } = await supabase
      .from("pj_clientes_config")
      .select("max_envios_dia_numero")
      .eq("user_id", user.id)
      .maybeSingle();

    const tetoDia = clienteCfg?.max_envios_dia_numero ?? 300;
    const diaSP = envioDiaSP();

    const { count: enviadosHoje } = await supabase
      .from("historico_envios")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("envio_dia_sp", diaSP)
      .eq("sucesso", true)
      .in("tipo", ["campanha", "convite_optin"]);

    const restanteTeto = Math.max(0, tetoDia - (enviadosHoje ?? 0));
    if (restanteTeto === 0) {
      return ok({ success: true, enviados: 0, motivo: "teto_diario_atingido", teto: tetoDia });
    }

    // ---------- 3. STOP universal — busca telefones deste tenant com opt-out ----------
    // O optInGate do inbound-processor cria/atualiza pj_lista_membros com
    // opt_in_status='recusado' e opt_in_origem IN ('stop_universal','stop_universal_sem_membro').
    // Qualquer telefone com ao menos UMA linha 'recusado' está proibido de receber convite.
    const { data: recusadosRows } = await supabase
      .from("pj_lista_membros")
      .select("telefone")
      .eq("user_id", user.id)
      .eq("opt_in_status", "recusado");

    const blockedPhones = new Set<string>(
      (recusadosRows || [])
        .map(r => normalizePhone(r.telefone))
        .filter((p): p is string => !!p)
    );

    // ---------- 4. Seleção de destinatários elegíveis (por lista) ----------
    const cutoffReconvite = new Date(
      Date.now() - RECONVITE_COOLDOWN_DIAS * 24 * 60 * 60 * 1000
    ).toISOString();

    const { data: elegiveis, error: elegErr } = await supabase
      .from("pj_lista_membros")
      .select("id, telefone, nome, opt_in_status, convite_enviado_em")
      .eq("lista_id", lista_id)
      .or(`opt_in_status.eq.pendente,and(opt_in_status.eq.expirado,convite_enviado_em.lt.${cutoffReconvite})`)
      .limit(Math.min(limite ?? BATCH_SIZE, restanteTeto, BATCH_SIZE) * 2); // margem p/ descartar STOP

    if (elegErr) return refuse("erro_query_elegiveis", { detail: elegErr.message });

    // Filtra os que estão no STOP list, e trunca no limite real.
    const cap = Math.min(limite ?? BATCH_SIZE, restanteTeto, BATCH_SIZE);
    const filtrados = (elegiveis || [])
      .filter(m => {
        const p = normalizePhone(m.telefone);
        return p && !blockedPhones.has(p);
      })
      .slice(0, cap);

    const bloqueadosStop = (elegiveis?.length ?? 0) - filtrados.length;

    if (!filtrados.length) {
      return ok({
        success: true, enviados: 0,
        motivo: "nenhum_pendente_elegivel",
        candidatos_brutos: elegiveis?.length ?? 0,
        bloqueados_stop_universal: bloqueadosStop,
        flag_meta_oficial: flagOn,
      });
    }

    if (dry_run) {
      return ok({
        success: true, dry_run: true,
        candidatos: filtrados.length,
        bloqueados_stop_universal: bloqueadosStop,
        teto_restante: restanteTeto,
        preview: filtrados.slice(0, 5).map(e => ({ tel: e.telefone, status: e.opt_in_status })),
      });
    }

    // ---------- 5. Loop SEQUENCIAL com idempotência ----------
    // A única proteção real de concorrência é o UPDATE FINAL condicional
    // (WHERE opt_in_status IN ('pendente','expirado')). Se retornar 0 linhas,
    // outra chamada já marcou o contato — a Meta pode ter recebido este POST,
    // então registramos como "enviado_mas_corrida" para não sumir da auditoria.
    let enviados = 0, pulados = 0, falhas = 0, corridas = 0;
    const erros: Array<{ telefone: string; erro: string }> = [];

    for (const m of filtrados) {
      if (enviados >= restanteTeto) break;

      const tel = normalizePhone(m.telefone);
      if (!tel) { pulados++; continue; }

      // POST Meta
      let messageId: string | null = null;
      let metaErro: string | null = null;
      try {
        const r = await fetch(`${META_API}/${cfg.phone_number_id}/messages`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${cfg.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: tel,
            type: "template",
            template: { name: tpl.nome_meta, language: { code: tpl.idioma || "pt_BR" } },
          }),
        });
        const j = await r.json();
        if (r.ok && j?.messages?.[0]?.id) {
          messageId = j.messages[0].id;
        } else {
          metaErro = j?.error?.message || `http_${r.status}`;
        }
      } catch (e) {
        metaErro = (e as Error).message;
      }

      if (!messageId) {
        falhas++;
        erros.push({ telefone: tel, erro: metaErro || "sem_message_id" });
        continue;
      }

      // UPDATE condicional = lock real. Só marca se ainda está elegível.
      const { data: updated } = await supabase
        .from("pj_lista_membros")
        .update({
          opt_in_status: "convite_enviado",
          convite_enviado_em: new Date().toISOString(),
          convite_template_id: tpl.id,
        })
        .eq("id", m.id)
        .in("opt_in_status", ["pendente", "expirado"])
        .select("id");

      const winner = (updated?.length ?? 0) === 1;

      await supabase.from("historico_envios").insert({
        user_id: user.id,
        whatsapp: tel,
        tipo: "convite_optin",
        mensagem: `convite:${tpl.nome_meta}`,
        sucesso: true,
        envio_dia_sp: diaSP,
      });

      await supabase.from("opt_in_log").insert({
        user_id: user.id,
        telefone: tel,
        status_anterior: m.opt_in_status,
        status_novo: winner ? "convite_enviado" : "enviado_mas_corrida",
        origem: "enviar-convite-optin",
        message_id: messageId,
        metadata: { template_id: tpl.id, lista_id, race: !winner },
      });

      if (winner) enviados++;
      else corridas++;
    }

    return ok({
      success: true, enviados, pulados, falhas, corridas,
      bloqueados_stop_universal: bloqueadosStop,
      teto_diario: tetoDia,
      restante_apos_batch: Math.max(0, restanteTeto - enviados),
      total_no_batch: filtrados.length,
      erros: erros.slice(0, 10),
      flag_meta_oficial: flagOn,
    });
  } catch (e) {
    return ok({ success: false, reason: "erro_interno", detail: (e as Error).message });
  }
});
