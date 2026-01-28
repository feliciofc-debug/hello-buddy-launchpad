import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOCAWEB_WUZAPI_URL = Deno.env.get("WUZAPI_URL") || "https://wuzapi.amzofertas.com.br";
const LOCAWEB_WUZAPI_TOKEN = Deno.env.get("WUZAPI_TOKEN") || "";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("⏰ [PJ-SCHEDULER] Iniciando verificação de envios programados...");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const agora = new Date();
    const horaAtual = agora.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
    const diaSemana = agora.getDay();

    console.log(`📅 [PJ-SCHEDULER] Hora: ${horaAtual}, Dia: ${diaSemana}`);

    // Buscar programações que precisam ser executadas
    const { data: programacoes, error: fetchError } = await supabase
      .from("pj_envios_programados")
      .select("*")
      .eq("ativo", true)
      .eq("pausado", false)
      .lte("proximo_envio", agora.toISOString());

    if (fetchError) {
      console.error("❌ [PJ-SCHEDULER] Erro ao buscar programações:", fetchError);
      throw fetchError;
    }

    if (!programacoes || programacoes.length === 0) {
      console.log("✅ [PJ-SCHEDULER] Nenhuma programação para executar agora");
      return new Response(
        JSON.stringify({ success: true, executadas: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`📬 [PJ-SCHEDULER] ${programacoes.length} programações para executar`);

    let executadas = 0;
    let erros = 0;

    for (const prog of programacoes) {
      try {
        console.log(`🔄 [PJ-SCHEDULER] Processando programação ${prog.id} para grupo ${prog.grupo_nome}...`);

        // Verificar horário permitido
        const horaAtualNum = parseInt(horaAtual.replace(":", ""));
        const horaInicioNum = parseInt(prog.horario_inicio?.replace(":", "") || "0800");
        const horaFimNum = parseInt(prog.horario_fim?.replace(":", "") || "2200");

        if (horaAtualNum < horaInicioNum || horaAtualNum > horaFimNum) {
          console.log(`⏰ [PJ-SCHEDULER] Fora do horário permitido (${prog.horario_inicio} - ${prog.horario_fim})`);
          continue;
        }

        // Verificar dia da semana
        if (prog.dias_ativos && !prog.dias_ativos.includes(diaSemana)) {
          console.log(`📅 [PJ-SCHEDULER] Dia ${diaSemana} não está ativo`);
          continue;
        }

        // Buscar produto para enviar
        const { data: produtos, error: prodError } = await supabase
          .from("produtos")
          .select("*")
          .eq("user_id", prog.user_id)
          .neq("id", prog.ultimo_produto_id || "00000000-0000-0000-0000-000000000000")
          .order("created_at", { ascending: false })
          .limit(10);

        if (prodError || !produtos || produtos.length === 0) {
          console.log("⚠️ [PJ-SCHEDULER] Nenhum produto encontrado");
          continue;
        }

        // Filtrar por categorias se definido
        let produtosFiltrados = produtos;
        if (prog.categorias && prog.categorias.length > 0) {
          produtosFiltrados = produtos.filter((p: any) =>
            prog.categorias.some((cat: string) =>
              p.categoria?.toLowerCase().includes(cat.toLowerCase())
            )
          );
        }

        if (produtosFiltrados.length === 0) {
          produtosFiltrados = produtos; // Fallback para todos
        }

        // Selecionar produto (rotativo ou aleatório)
        const produto = produtosFiltrados[Math.floor(Math.random() * produtosFiltrados.length)];

        console.log(`📦 [PJ-SCHEDULER] Produto selecionado: ${produto.titulo?.substring(0, 40)}...`);

        // Buscar token do usuário
        let wuzapiToken = LOCAWEB_WUZAPI_TOKEN;
        const { data: config } = await supabase
          .from("pj_clientes_config")
          .select("wuzapi_token")
          .eq("user_id", prog.user_id)
          .maybeSingle();

        if (config?.wuzapi_token) {
          wuzapiToken = config.wuzapi_token;
        }

        // Montar mensagem
        const preco = produto.preco ? `R$ ${Number(produto.preco).toFixed(2)}` : "";
        const mensagem = `🔥 *${produto.titulo}*\n\n💰 *${preco}*\n\n🛒 *Compre aqui:* ${produto.link_afiliado || produto.url || ""}`;

        // Enviar para o grupo
        let response: Response;
        let payload: any;

        if (produto.imagem_url || produto.imagem) {
          response = await fetch(`${LOCAWEB_WUZAPI_URL}/chat/send/image`, {
            method: "POST",
            headers: {
              "Token": wuzapiToken,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              Phone: prog.grupo_jid,
              Caption: mensagem,
              Image: produto.imagem_url || produto.imagem,
            }),
          });

          payload = await response.json();

          // Fallback se imagem falhar
          if (!response.ok || payload?.success === false) {
            console.log("🧯 [PJ-SCHEDULER] Fallback para texto...");
            response = await fetch(`${LOCAWEB_WUZAPI_URL}/chat/send/text`, {
              method: "POST",
              headers: {
                "Token": wuzapiToken,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                Phone: prog.grupo_jid,
                Body: mensagem,
              }),
            });
            payload = await response.json();
          }
        } else {
          response = await fetch(`${LOCAWEB_WUZAPI_URL}/chat/send/text`, {
            method: "POST",
            headers: {
              "Token": wuzapiToken,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              Phone: prog.grupo_jid,
              Body: mensagem,
            }),
          });
          payload = await response.json();
        }

        const success = response.ok && payload?.success !== false;

        if (success) {
          console.log(`✅ [PJ-SCHEDULER] Enviado para ${prog.grupo_nome}`);

          // Calcular próximo envio
          const proximoEnvio = new Date(agora.getTime() + prog.intervalo_minutos * 60 * 1000);

          // Atualizar programação
          await supabase
            .from("pj_envios_programados")
            .update({
              ultimo_envio: agora.toISOString(),
              proximo_envio: proximoEnvio.toISOString(),
              ultimo_produto_id: produto.id,
              total_enviados: (prog.total_enviados || 0) + 1,
            })
            .eq("id", prog.id);

          // Registrar no histórico
          await supabase.from("pj_historico_envios").insert({
            user_id: prog.user_id,
            programacao_id: prog.id,
            grupo_jid: prog.grupo_jid,
            grupo_nome: prog.grupo_nome,
            produto_id: produto.id,
            produto_titulo: produto.titulo,
            mensagem,
            imagem_url: produto.imagem_url || produto.imagem,
            status: "enviado",
            enviado_em: new Date().toISOString(),
          });

          executadas++;
        } else {
          console.error(`❌ [PJ-SCHEDULER] Falha para ${prog.grupo_nome}:`, payload);

          // Registrar erro
          await supabase.from("pj_historico_envios").insert({
            user_id: prog.user_id,
            programacao_id: prog.id,
            grupo_jid: prog.grupo_jid,
            grupo_nome: prog.grupo_nome,
            produto_id: produto.id,
            produto_titulo: produto.titulo,
            status: "erro",
            erro: payload?.error || "Erro desconhecido",
            enviado_em: new Date().toISOString(),
          });

          erros++;
        }

        // Delay anti-bloqueio entre envios
        await new Promise((r) => setTimeout(r, 5000));

      } catch (progError: any) {
        console.error(`❌ [PJ-SCHEDULER] Erro na programação ${prog.id}:`, progError);
        erros++;
      }
    }

    console.log(`📊 [PJ-SCHEDULER] Resultado: ${executadas} executadas, ${erros} erros`);

    return new Response(
      JSON.stringify({
        success: true,
        executadas,
        erros,
        total: programacoes.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("❌ [PJ-SCHEDULER] Erro geral:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
