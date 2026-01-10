import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Configuração Pietro Eugenio - Instância Afiliado-01 (porta 8081)
const PIETRO_TOKEN = "WjRi4tis2XrGUmLImu3wjwHLN3dn4uE";
const WUZAPI_BASE_URL = "https://api2.amzofertas.com.br:8081";

// Link do grupo para convidar
const GRUPO_CONVITE = "https://chat.whatsapp.com/IH8qQB9h9krIvNlA3l5i7L";

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { userId, action } = body;

    console.log("[PIETRO] request", { action, userId, bodyKeys: Object.keys(body || {}) });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // AÇÃO: Carregar próximo lote de contatos para a fila
    if (action === "carregar_lote") {
      // Verificar quantos já foram carregados
      const { count: jaCarregados } = await supabase
        .from("fila_prospeccao_pietro")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);

      // Buscar próximos 200 contatos que ainda não estão na fila
      const { data: fila } = await supabase
        .from("fila_prospeccao_pietro")
        .select("phone")
        .eq("user_id", userId);

      const phonesNaFila = new Set((fila || []).map(f => f.phone));

      // Buscar contatos de whatsapp_contacts (onde estão os 1522 opt-ins validados)
      const { data: leads, error } = await supabase
        .from("whatsapp_contacts")
        .select("id, phone, nome")
        .eq("user_id", userId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      // Filtrar os que ainda não estão na fila
      const leadsDisponiveis = (leads || []).filter(l => !phonesNaFila.has(l.phone));

      // Pegar próximos 200
      const proximoLote = leadsDisponiveis.slice(0, 200);

      if (proximoLote.length === 0) {
        return new Response(JSON.stringify({
          success: true,
          message: "Todos os contatos já foram carregados na fila",
          totalNaFila: jaCarregados || 0
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Calcular número do lote
      const { data: ultimoLote } = await supabase
        .from("fila_prospeccao_pietro")
        .select("lote")
        .eq("user_id", userId)
        .order("lote", { ascending: false })
        .limit(1);

      const numeroLote = ((ultimoLote?.[0]?.lote || 0) + 1);

      // Inserir na fila
      const novosItens = proximoLote.map(lead => ({
        user_id: userId,
        lead_id: lead.id,
        phone: lead.phone,
        nome: lead.nome,
        status: "pendente",
        lote: numeroLote
      }));

      const { error: insertError } = await supabase
        .from("fila_prospeccao_pietro")
        .insert(novosItens);

      if (insertError) throw insertError;

      return new Response(JSON.stringify({
        success: true,
        message: `${proximoLote.length} contatos carregados no lote ${numeroLote}`,
        lote: numeroLote,
        carregados: proximoLote.length,
        totalRestante: leadsDisponiveis.length - proximoLote.length
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // AÇÃO: Executar envio do lote atual (processa apenas 20 contatos por vez)
    if (action === "executar_lote") {
      // Buscar itens pendentes do lote mais antigo
      const { data: loteAtual } = await supabase
        .from("fila_prospeccao_pietro")
        .select("lote")
        .eq("user_id", userId)
        .eq("status", "pendente")
        .order("lote", { ascending: true })
        .limit(1);

      if (!loteAtual || loteAtual.length === 0) {
        return new Response(JSON.stringify({
          success: true,
          message: "Não há itens pendentes para enviar",
          enviados: 0,
          pendentesRestantes: 0
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const numeroLote = loteAtual[0].lote;

      // Usar a função SQL para fazer claim de apenas 20 contatos (evita envios paralelos)
      const { data: pendentes, error } = await supabase.rpc("claim_prospeccao_pietro_batch", {
        p_user_id: userId,
        p_lote: numeroLote,
        p_limit: 20
      });

      if (error) {
        console.error("[PIETRO] Erro ao fazer claim:", error);
        throw error;
      }

      if (!pendentes || pendentes.length === 0) {
        // Verificar se há pendentes restantes (outro processo pode estar processando)
        const { count } = await supabase
          .from("fila_prospeccao_pietro")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("status", "pendente")
          .eq("lote", numeroLote);

        return new Response(JSON.stringify({
          success: true,
          message: count && count > 0 
            ? "Outro processo está enviando. Aguarde..." 
            : "Não há itens pendentes para enviar",
          enviados: 0,
          pendentesRestantes: count || 0
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      console.log(`[PIETRO] Processando ${pendentes.length} contatos do lote ${numeroLote}`);

      let enviados = 0;
      let erros = 0;
      const resultados: any[] = [];

      for (const item of pendentes) {
        try {
          // Formatar telefone
          let phone = item.phone.replace(/\D/g, "");
          if (phone.length === 11) phone = `55${phone}`;
          else if (phone.length === 10) phone = `55${phone}`;

          // Mensagem genérica do Pietro (sem nome pois maioria está como "contato")
          const mensagem = `Oi! Tudo bem? 👋

Sou o *Pietro Eugenio*, assistente virtual da AMZ Ofertas! 🤖

Quero te convidar para um grupo EXCLUSIVO onde enviamos as *melhores ofertas* com até *90% de desconto* + *2% de cashback* em todas as compras!

🎁 *BÔNUS*: Ao entrar, você recebe nosso eBook de *50 Receitas para Air Fryer* totalmente GRÁTIS!

👉 Entre agora: ${GRUPO_CONVITE}

Te espero lá! 🚀`;

          // Enviar via Wuzapi
          const response = await fetch(`${WUZAPI_BASE_URL}/chat/send/text`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Token": PIETRO_TOKEN
            },
            body: JSON.stringify({
              Phone: phone,
              Body: mensagem
            })
          });

          const result = await response.text();
          console.log(`[PIETRO] Enviado para ${phone}: ${response.status}`);

          // Atualizar status
          await supabase
            .from("fila_prospeccao_pietro")
            .update({
              status: response.ok ? "enviado" : "erro",
              enviado_em: new Date().toISOString(),
              erro: response.ok ? null : result
            })
            .eq("id", item.id);

          if (response.ok) {
            enviados++;
            resultados.push({ phone, success: true });
          } else {
            erros++;
            resultados.push({ phone, success: false, error: result });
          }

          // Delay humanizado entre mensagens (5-10 segundos para evitar bloqueio)
          await sleep(5000 + Math.random() * 5000);

        } catch (err: any) {
          console.error(`[PIETRO] Erro ao enviar para ${item.phone}:`, err);
          
          await supabase
            .from("fila_prospeccao_pietro")
            .update({
              status: "erro",
              erro: err.message
            })
            .eq("id", item.id);

          erros++;
          resultados.push({ phone: item.phone, success: false, error: err.message });
        }
      }

      // Contar quantos pendentes ainda restam
      const { count: pendentesRestantes } = await supabase
        .from("fila_prospeccao_pietro")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "pendente")
        .eq("lote", numeroLote);

      return new Response(JSON.stringify({
        success: true,
        lote: numeroLote,
        enviados,
        erros,
        processados: pendentes.length,
        pendentesRestantes: pendentesRestantes || 0,
        resultados: resultados.slice(0, 5)
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // AÇÃO: Obter estatísticas
    if (action === "stats") {
      const [totalResult, pendentesResult, enviadosResult, errosResult, lotesResult] = await Promise.all([
        supabase.from("fila_prospeccao_pietro").select("*", { count: "exact", head: true }).eq("user_id", userId),
        supabase.from("fila_prospeccao_pietro").select("*", { count: "exact", head: true }).eq("user_id", userId).eq("status", "pendente"),
        supabase.from("fila_prospeccao_pietro").select("*", { count: "exact", head: true }).eq("user_id", userId).eq("status", "enviado"),
        supabase.from("fila_prospeccao_pietro").select("*", { count: "exact", head: true }).eq("user_id", userId).eq("status", "erro"),
        supabase.from("fila_prospeccao_pietro").select("lote").eq("user_id", userId).order("lote", { ascending: false }).limit(1),
      ]);

      // Contatos disponíveis (fonte real do "Modal WhatsApp")
      const [wcCountRes, leadsCountRes] = await Promise.all([
        supabase.from("whatsapp_contacts").select("*", { count: "exact", head: true }).eq("user_id", userId),
        supabase.from("leads_ebooks").select("*", { count: "exact", head: true }).eq("user_id", userId),
      ]);

      const totalLeads = wcCountRes.count || 0;
      console.log("[PIETRO] counts", { userId, whatsapp_contacts: wcCountRes.count, leads_ebooks: leadsCountRes.count });

      return new Response(
        JSON.stringify({
          success: true,
          stats: {
            totalNaFila: totalResult.count || 0,
            pendentes: pendentesResult.count || 0,
            enviados: enviadosResult.count || 0,
            erros: errosResult.count || 0,
            loteAtual: lotesResult.data?.[0]?.lote || 0,
            totalLeadsDisponiveis: totalLeads,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // AÇÃO: Limpar fila (reset)
    if (action === "limpar") {
      const { error } = await supabase
        .from("fila_prospeccao_pietro")
        .delete()
        .eq("user_id", userId);

      if (error) throw error;

      return new Response(JSON.stringify({
        success: true,
        message: "Fila limpa com sucesso"
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({
      error: "Ação inválida. Use: carregar_lote, executar_lote, stats, limpar"
    }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: any) {
    console.error("[PIETRO] Erro:", error);
    return new Response(JSON.stringify({
      error: error.message,
      stack: error.stack
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
