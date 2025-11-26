import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("🚀 Iniciando execução de campanhas agendadas...");
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5); // HH:MM
    const currentDay = now.getDay(); // 0-6

    console.log(`⏰ Hora atual: ${currentTime}, Dia da semana: ${currentDay}`);

    // Buscar campanhas ativas que devem ser executadas agora
    const { data: campanhas, error: fetchError } = await supabase
      .from("campanhas_recorrentes")
      .select(`
        *,
        produtos(id, nome, descricao, preco, imagem_url),
        whatsapp_groups(id, group_name, phone_numbers)
      `)
      .eq("ativa", true)
      .lte("data_inicio", now.toISOString().split('T')[0])
      .not("horarios", "is", null);

    if (fetchError) throw fetchError;

    console.log(`📋 Encontradas ${campanhas?.length || 0} campanhas ativas`);

    let executadas = 0;
    let erros = 0;

    for (const campanha of campanhas || []) {
      try {
        // Verificar se o horário atual está nos horários configurados
        const horarioMatch = campanha.horarios?.some((h: string) => h === currentTime);
        if (!horarioMatch) {
          console.log(`⏭️ Campanha ${campanha.nome} - Horário não corresponde`);
          continue;
        }

        // Para campanhas diárias/semanais, verificar dia da semana
        if ((campanha.frequencia === 'diario' || campanha.frequencia === 'semanal') && campanha.dias_semana) {
          if (!campanha.dias_semana.includes(currentDay)) {
            console.log(`⏭️ Campanha ${campanha.nome} - Dia da semana não corresponde`);
            continue;
          }
        }

        // Para campanhas "uma_vez", verificar se já foi executada
        if (campanha.frequencia === 'uma_vez' && campanha.proxima_execucao) {
          const proximaExec = new Date(campanha.proxima_execucao);
          if (proximaExec < now) {
            console.log(`⏭️ Campanha ${campanha.nome} - Já foi executada`);
            continue;
          }
        }

        console.log(`✅ Executando campanha: ${campanha.nome}`);

        // Buscar todos os contatos das listas
        const { data: listas } = await supabase
          .from("whatsapp_groups")
          .select("phone_numbers")
          .in("id", campanha.listas_ids);

        const todosContatos = listas?.flatMap((l: any) => l.phone_numbers || []) || [];
        console.log(`📞 Total de contatos: ${todosContatos.length}`);

        let enviados = 0;
        let errosEnvio = 0;

        // Enviar para cada contato
        for (const phone of todosContatos) {
          try {
            // Buscar nome do contato
            const { data: contact } = await supabase
              .from("whatsapp_contacts")
              .select("nome")
              .eq("phone", phone)
              .eq("user_id", campanha.user_id)
              .maybeSingle();

            const nome = contact?.nome || "Cliente";

            // Personalizar mensagem
            const mensagemPersonalizada = campanha.mensagem_template
              .replace(/\{\{nome\}\}/gi, nome)
              .replace(/\{\{produto\}\}/gi, campanha.produtos?.nome || "")
              .replace(/\{\{preco\}\}/gi, campanha.produtos?.preco?.toString() || "");

            // Enviar via Wuzapi
            const wuzapiUrl = Deno.env.get("WUZAPI_URL")!;
            const wuzapiToken = Deno.env.get("WUZAPI_TOKEN")!;
            const baseUrl = wuzapiUrl.endsWith("/") ? wuzapiUrl.slice(0, -1) : wuzapiUrl;

            const body: any = {
              Phone: phone,
              Body: mensagemPersonalizada
            };

            if (campanha.produtos?.imagem_url) {
              body.Image = campanha.produtos.imagem_url;
              body.Caption = mensagemPersonalizada;
            }

            const sendResponse = await fetch(`${baseUrl}/chat/send/${campanha.produtos?.imagem_url ? 'image' : 'text'}`, {
              method: "POST",
              headers: {
                "Token": wuzapiToken,
                "Content-Type": "application/json"
              },
              body: JSON.stringify(body)
            });

            if (!sendResponse.ok) throw new Error(`Erro ao enviar: ${sendResponse.status}`);

            enviados++;
            await new Promise(r => setTimeout(r, 500)); // Delay entre mensagens
          } catch (error) {
            console.error(`Erro ao enviar para ${phone}:`, error);
            errosEnvio++;
          }
        }

        console.log(`📊 Campanha ${campanha.nome}: ${enviados} enviados, ${errosEnvio} erros`);

        // Calcular próxima execução
        const proximaExecucao = calcularProximaExecucao(
          campanha.frequencia,
          campanha.horarios,
          campanha.dias_semana
        );

        // Atualizar campanha
        const updateData: any = {
          ultima_execucao: now.toISOString(),
          total_enviados: (campanha.total_enviados || 0) + enviados,
          proxima_execucao: proximaExecucao
        };

        // Se for uma_vez, desativar
        if (campanha.frequencia === 'uma_vez') {
          updateData.ativa = false;
          updateData.status = 'encerrada';
        } else {
          updateData.status = 'ativa';
        }

        await supabase
          .from("campanhas_recorrentes")
          .update(updateData)
          .eq("id", campanha.id);

        executadas++;
      } catch (error) {
        console.error(`❌ Erro ao executar campanha ${campanha.nome}:`, error);
        erros++;
      }
    }

    console.log(`✅ Execução concluída: ${executadas} campanhas executadas, ${erros} erros`);

    return new Response(
      JSON.stringify({
        success: true,
        executadas,
        erros,
        total: campanhas?.length || 0
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200
      }
    );

  } catch (error: any) {
    console.error("❌ Erro geral:", error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});

// Função auxiliar para calcular próxima execução
function calcularProximaExecucao(
  frequencia: string,
  horarios: string[],
  diasSemana: number[]
): string | null {
  const now = new Date();
  const primeiroHorario = horarios[0] || '09:00';
  const [hora, minuto] = primeiroHorario.split(':');

  if (frequencia === 'uma_vez') {
    return null; // Campanha única não repete
  }

  if (frequencia === 'diario') {
    const amanha = new Date(now);
    amanha.setDate(amanha.getDate() + 1);
    amanha.setHours(parseInt(hora), parseInt(minuto), 0, 0);
    return amanha.toISOString();
  }

  if (frequencia === 'semanal') {
    const proxima = new Date(now);
    proxima.setDate(proxima.getDate() + 1);
    
    // Encontrar próximo dia da semana válido
    let tentativas = 0;
    while (!diasSemana.includes(proxima.getDay()) && tentativas < 7) {
      proxima.setDate(proxima.getDate() + 1);
      tentativas++;
    }
    
    proxima.setHours(parseInt(hora), parseInt(minuto), 0, 0);
    return proxima.toISOString();
  }

  if (frequencia === 'personalizado') {
    // Para personalizado, assumir diário
    const amanha = new Date(now);
    amanha.setDate(amanha.getDate() + 1);
    amanha.setHours(parseInt(hora), parseInt(minuto), 0, 0);
    return amanha.toISOString();
  }

  return null;
}
