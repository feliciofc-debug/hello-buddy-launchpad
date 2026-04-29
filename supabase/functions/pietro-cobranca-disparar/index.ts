// Edge Function: pietro-cobranca-disparar
// Dispara mensagem da régua de cobrança (D-5, D-2, D-0, D+1, D+5)
// via gateway WuzAPI da instância 'pietro-cobranca' (porta 8082).
// Modos:
//   A) cliente real:  { cliente_id: uuid, tipo: 'D-5' }
//   B) teste manual:  { tipo: 'D-2', test: { nome, whatsapp, valor, data_vencimento } }
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-billing-token",
};

const INSTANCE_NAME = "pietro-cobranca";
const TIPOS_VALIDOS = ["D-5", "D-2", "D-0", "D+1", "D+5"] as const;
type TipoRegua = typeof TIPOS_VALIDOS[number];

const TEMPLATES: Record<TipoRegua, string> = {
  "D-5":
    "Olá {nome}, tudo bem? Aqui é o Pietro da AMZ Ofertas. Passando pra lembrar com carinho que sua mensalidade de R$ {valor} vence dia {data}.\n\n💳 Link pra pagar (PIX, cartão ou boleto):\n{link}\n\nQualquer dúvida, é só chamar! 😊",
  "D-2":
    "Oi {nome}! Pietro aqui novamente. Faltam 2 diazinhos pro vencimento da sua mensalidade ({data} - R$ {valor}).\n\n💳 Pra adiantar, segue o link:\n{link}\n\nPosso te ajudar com algo?",
  "D-0":
    "Olá {nome}, bom dia! Hoje é o dia do vencimento da sua mensalidade AMZ Ofertas (R$ {valor}).\n\n💳 Link pra pagamento imediato:\n{link}\n\nJá efetuou o pagamento? Qualquer coisa me chama!",
  "D+1":
    "Oi {nome}, tudo bem? Notei que sua mensalidade de ontem ainda não consta como paga.\n\n💳 Se quiser regularizar agora:\n{link}\n\nAconteceu algo? Posso te ajudar.",
  "D+5":
    "Olá {nome}. Pietro aqui. Estou um pouco preocupado, sua mensalidade está com 5 dias de atraso.\n\n💳 Pra regularizar é só clicar:\n{link}\n\nPor favor, entre em contato pra conversarmos. Tenho certeza que conseguimos uma solução juntos.",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha256Hex(value: string): Promise<string> {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(value));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function verifyBillingToken(token: string): Promise<boolean> {
  const adminPassword = Deno.env.get("BILLING_ADMIN_PASSWORD");
  if (!adminPassword) return false;
  const currentDay = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
  const days = [currentDay, currentDay - 1, currentDay + 1];
  const hashes = await Promise.all(
    days.map((d) => sha256Hex(`${adminPassword}:${d}`)),
  );
  if (hashes.includes(token)) return true;
  if (token === adminPassword) return true;
  return false;
}

function formatValor(v: number): string {
  return v.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatData(iso: string): string {
  // iso esperado YYYY-MM-DD
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}`;
}

function renderTemplate(
  tipo: TipoRegua,
  ctx: { nome: string; valor: number; data: string; link: string },
): string {
  return TEMPLATES[tipo]
    .replaceAll("{nome}", ctx.nome || "amigo(a)")
    .replaceAll("{valor}", formatValor(ctx.valor))
    .replaceAll("{data}", ctx.data)
    .replaceAll("{link}", ctx.link || "(link indisponível)");
}

function normalizePhone(raw: string): string {
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return "";
  // se já vier com 55, usa; senão prefixa
  return digits.startsWith("55") ? digits : `55${digits}`;
}

async function tentarEnviarWuzapi(
  baseUrl: string,
  token: string,
  phone: string,
  body: string,
): Promise<{ ok: boolean; status: number; data: any; endpoint: string; raw: string }> {
  const endpoints = ["/chat/send/text", "/sendtext", "/send/text"];
  let last: any = null;
  for (const ep of endpoints) {
    const url = `${baseUrl.replace(/\/+$/, "")}${ep}`;
    const payload = { Phone: phone, Body: body };
    console.log(`[pietro-cobranca-disparar] tentando ${ep} → ${url}`);
    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          token,
        },
        body: JSON.stringify(payload),
      });
      const raw = await resp.text();
      console.log(`[pietro-cobranca-disparar] ${ep} status=${resp.status} body=${raw.slice(0, 200)}`);
      let data: any = null;
      try { data = JSON.parse(raw); } catch { data = raw; }

      if (resp.status === 404) {
        last = { ok: false, status: 404, data, endpoint: ep, raw };
        continue; // tenta próximo
      }
      // 2xx → sucesso (ou erro lógico do wuzapi, devolvemos pro caller decidir)
      return { ok: resp.ok, status: resp.status, data, endpoint: ep, raw };
    } catch (e) {
      console.log(`[pietro-cobranca-disparar] ${ep} EXCEPTION: ${(e as Error).message}`);
      last = { ok: false, status: 0, data: { error: (e as Error).message }, endpoint: ep, raw: "" };
    }
  }
  return last ?? { ok: false, status: 0, data: { error: "no-endpoint-worked" }, endpoint: "", raw: "" };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // ---- Auth ----
    const billingToken = req.headers.get("x-billing-token") || "";
    if (!billingToken) {
      return json({ success: false, error: "missing x-billing-token" }, 401);
    }
    const tokenOk = await verifyBillingToken(billingToken);
    if (!tokenOk) {
      return json({ success: false, error: "invalid billing token" }, 401);
    }

    // ---- Body ----
    const body = await req.json().catch(() => ({}));
    const tipo = body?.tipo as TipoRegua;
    if (!TIPOS_VALIDOS.includes(tipo)) {
      return json({ success: false, error: `tipo inválido. esperado: ${TIPOS_VALIDOS.join(", ")}` }, 400);
    }

    let nome = "";
    let whatsappRaw = "";
    let valor = 0;
    let dataVenc = "";
    let clienteId: string | null = null;
    let paymentLink = "";

    if (body?.cliente_id) {
      clienteId = body.cliente_id;
      // Busca cliente em billing_customers + última subscription
      const { data: cli, error } = await supabase
        .from("billing_customers")
        .select("id, name, responsible_name, phone, payment_link")
        .eq("id", clienteId)
        .maybeSingle();
      if (error || !cli) {
        return json({ success: false, error: `cliente não encontrado: ${error?.message || "null"}` }, 404);
      }
      const { data: sub } = await supabase
        .from("billing_subscriptions")
        .select("amount, dia_vencimento, next_billing_date")
        .eq("customer_id", clienteId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Nome: prioriza responsible_name, depois name. Ignora se for e-mail.
      const isEmail = (s: string) => /\S+@\S+\.\S+/.test(s);
      const rawName = cli.responsible_name || cli.name || "";
      const cleanName = rawName && !isEmail(rawName) ? rawName : "";
      // Pega só o primeiro nome pra ficar mais natural
      nome = cleanName ? cleanName.trim().split(/\s+/)[0] : "amigo(a)";
      whatsappRaw = cli.phone || "";
      valor = Number(sub?.amount ?? 0);
      if (sub?.next_billing_date) {
        dataVenc = String(sub.next_billing_date).slice(0, 10);
      } else if (sub?.dia_vencimento) {
        const now = new Date();
        const yyyy = now.getUTCFullYear();
        const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
        const dd = String(sub.dia_vencimento).padStart(2, "0");
        dataVenc = `${yyyy}-${mm}-${dd}`;
      } else {
        dataVenc = new Date().toISOString().slice(0, 10);
      }

      // Buscar subscription_id pra montar link da página bonita /pagar/:subscriptionId
      try {
        const { data: subForLink } = await supabase
          .from("billing_subscriptions")
          .select("id")
          .eq("customer_id", clienteId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const appUrl = Deno.env.get("APP_URL") || "https://amzofertas.com.br";
        if (subForLink?.id) {
          paymentLink = `${appUrl}/pagar/${subForLink.id}`;
        } else {
          paymentLink = cli.payment_link || "";
        }
      } catch (e) {
        console.warn("[pietro-cobranca-disparar] exceção ao montar link público:", (e as Error).message);
        paymentLink = cli.payment_link || "";
      }
    } else if (body?.test) {
      nome = String(body.test.nome || "Teste");
      whatsappRaw = String(body.test.whatsapp || "");
      valor = Number(body.test.valor ?? 0);
      dataVenc = String(body.test.data_vencimento || new Date().toISOString().slice(0, 10));
      paymentLink = String(body.test.payment_link || "");
    } else {
      return json({ success: false, error: "informe cliente_id ou test{...}" }, 400);
    }

    const phone = normalizePhone(whatsappRaw);
    if (!phone) return json({ success: false, error: "whatsapp inválido" }, 400);

    const mensagem = renderTemplate(tipo, { nome, valor, data: formatData(dataVenc), link: paymentLink });

    // ---- Busca instância WuzAPI Pietro ----
    const { data: instance, error: instErr } = await supabase
      .from("wuzapi_instances")
      .select("wuzapi_url, wuzapi_token")
      .eq("instance_name", INSTANCE_NAME)
      .maybeSingle();

    if (instErr || !instance?.wuzapi_url || !instance?.wuzapi_token) {
      return json({
        success: false,
        error: `instância ${INSTANCE_NAME} não configurada: ${instErr?.message || "sem url/token"}`,
      }, 500);
    }

    console.log(`[pietro-cobranca-disparar] tipo=${tipo} phone=${phone} url=${instance.wuzapi_url}`);

    // ---- Envia ----
    const send = await tentarEnviarWuzapi(
      instance.wuzapi_url,
      instance.wuzapi_token,
      phone,
      mensagem,
    );

    const status = send.ok ? "enviado" : "erro";
    const wuzapiMessageId =
      send.data?.data?.Id || send.data?.id || send.data?.Id || null;
    const erroDetalhe = send.ok ? null : (send.raw?.slice(0, 500) || "envio falhou");

    const { data: log, error: logErr } = await supabase
      .from("cobranca_envios_log")
      .insert({
        cliente_id: clienteId,
        tipo,
        mensagem_enviada: mensagem,
        whatsapp_destino: phone,
        status,
        wuzapi_message_id: wuzapiMessageId,
        erro_detalhe: erroDetalhe,
      })
      .select("id")
      .single();

    if (logErr) {
      console.log(`[pietro-cobranca-disparar] erro log: ${logErr.message}`);
    }

    return json({
      success: send.ok,
      log_id: log?.id ?? null,
      mensagem,
      whatsapp: phone,
      tipo,
      wuzapi: {
        endpoint: send.endpoint,
        status: send.status,
        response: send.data,
      },
    }, 200);
  } catch (e) {
    console.error("[pietro-cobranca-disparar] FATAL", e);
    return json({ success: false, error: (e as Error).message }, 200);
  }
});
