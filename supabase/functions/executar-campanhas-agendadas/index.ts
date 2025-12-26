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
        produtos(id, nome, descricao, preco, imagem_url, imagens)
      `)
      .eq("ativa", true)
      .lte("data_inicio", now.toISOString().split('T')[0])
      .not("horarios", "is", null);

    if (fetchError) {
      console.error("❌ Erro ao buscar campanhas:", fetchError);
      throw fetchError;
    }

    console.log(`📋 Encontradas ${campanhas?.length || 0} campanhas ativas`);

    let executadas = 0;
    let erros = 0;

    for (const campanha of campanhas || []) {
      try {
        // ✅ VERIFICAR HORÁRIO COM TOLERÂNCIA ±3 MINUTOS
        const horariosNormalizados = (campanha.horarios || []).map((h: string) =>
          typeof h === "string" ? h.slice(0, 5) : h
        );
        
        // Converter hora atual e configurada para minutos totais
        const [horaAtual, minutoAtual] = currentTime.split(':').map(Number);
        const minutosTotaisAgora = horaAtual * 60 + minutoAtual;
        
        let horarioMatch = false;
        let horarioEncontrado = '';
        
        for (const horarioConfig of horariosNormalizados) {
          const [horaConfig, minutoConfig] = horarioConfig.split(':').map(Number);
          const minutosTotaisConfig = horaConfig * 60 + minutoConfig;
          const diferencaMinutos = Math.abs(minutosTotaisAgora - minutosTotaisConfig);
          
          // ✅ Tolerância de 3 minutos
          if (diferencaMinutos <= 3) {
            horarioMatch = true;
            horarioEncontrado = horarioConfig;
            console.log(`✅ Horário encontrado: ${horarioConfig} (diferença: ${diferencaMinutos}min)`);
            break;
          }
        }
        
        if (!horarioMatch) {
          console.log(
            `⏭️ Campanha ${campanha.nome} - Horário não corresponde (agora=${currentTime}, horarios=${JSON.stringify(horariosNormalizados)})`
          );
          continue;
        }

        // Para campanhas diárias/semanais, verificar dia da semana
        if ((campanha.frequencia === 'diario' || campanha.frequencia === 'semanal') && campanha.dias_semana) {
          if (!campanha.dias_semana.includes(currentDay)) {
            console.log(`⏭️ Campanha ${campanha.nome} - Dia da semana não corresponde`);
            continue;
          }
        }

        // ✅ VERIFICAR SE JÁ EXECUTOU NESTE HORÁRIO (última hora)
        if (campanha.ultima_execucao) {
          const ultimaExecucao = new Date(campanha.ultima_execucao);
          const diferencaMinutos = (now.getTime() - ultimaExecucao.getTime()) / 60000;
          
          if (diferencaMinutos < 55) {
            console.log(`⏭️ Campanha ${campanha.nome} - Já executou há ${Math.round(diferencaMinutos)} minutos`);
            continue;
          }
        }

        console.log(`✅ Executando campanha: ${campanha.nome} (horário: ${horarioEncontrado})`);

        // Buscar todos os contatos das listas
        const { data: listas } = await supabase
          .from("whatsapp_groups")
          .select("phone_numbers")
          .in("id", campanha.listas_ids);

        const todosContatos = listas?.flatMap((l: any) => l.phone_numbers || []) || [];
        console.log(`📞 Total de contatos: ${todosContatos.length}`);

        let enviados = 0;
        let errosEnvio = 0;

        // ✅ ENVIAR PARA CADA CONTATO VIA EDGE FUNCTION
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

            const imagemUrl = campanha.produtos?.imagem_url || campanha.produtos?.imagens?.[0];

            // ✅ ENVIAR VIA EDGE FUNCTION (não fetch direto!)
            const { data: sendResult, error: sendError } = await supabase.functions.invoke('send-wuzapi-message', {
              body: {
                phoneNumbers: [phone],
                message: mensagemPersonalizada,
                imageUrl: imagemUrl,
                userId: campanha.user_id, // ✅ CRÍTICO para achar instância certa
                skipProtection: true // ✅ Ignora cooldown entre campanhas
              }
            });

            if (!sendError && sendResult?.success) {
              enviados++;
              console.log(`✅ Enviado para ${phone}`);
            } else {
              console.error(`❌ Erro ao enviar para ${phone}:`, sendError || sendResult);
              errosEnvio++;
            }

            // Delay entre mensagens
            await new Promise(r => setTimeout(r, 500));

          } catch (error) {
            console.error(`❌ Erro ao processar ${phone}:`, error);
            errosEnvio++;
          }
        }

        console.log(`📊 Campanha ${campanha.nome}: ${enviados} enviados, ${errosEnvio} erros`);

        // ✅ CALCULAR PRÓXIMA EXECUÇÃO (suporta múltiplos horários)
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

// ✅ FUNÇÃO CORRIGIDA - SUPORTA MÚLTIPLOS HORÁRIOS NO MESMO DIA
function calcularProximaExecucao(
  frequencia: string,
  horarios: string[],
  diasSemana: number[]
): string | null {
  const now = new Date();

  // Normalizar horários para HH:MM
  const horariosNormalizados = (horarios || []).map((h: string) =>
    typeof h === "string" ? h.slice(0, 5) : h
  );

  const horariosOrdenados = [...horariosNormalizados].sort();
  const horaAtual = now.toTimeString().slice(0, 5);

  if (frequencia === 'uma_vez') {
    return null; // Campanha única não repete
  }

  // ✅ VERIFICAR SE HÁ MAIS HORÁRIOS HOJE
  const proximoHorarioHoje = horariosOrdenados.find((h: string) => h > horaAtual);

  if (proximoHorarioHoje) {
    // Se for semanal, verificar se hoje é dia válido
    if (frequencia === 'semanal' && diasSemana && !diasSemana.includes(now.getDay())) {
      // Hoje não é válido, ir para próximo dia
      return calcularProximoDiaExecucao(frequencia, horariosOrdenados[0], diasSemana);
    }

    // ✅ AINDA HÁ HORÁRIO HOJE!
    const [hora, minuto] = proximoHorarioHoje.split(':');
    const proxima = new Date();
    proxima.setHours(parseInt(hora), parseInt(minuto), 0, 0);
    console.log(`📅 Próximo horário HOJE: ${proximoHorarioHoje}`);
    return proxima.toISOString();
  }

  // Não há mais horários hoje, ir para próximo dia
  return calcularProximoDiaExecucao(frequencia, horariosOrdenados[0], diasSemana);
}

function calcularProximoDiaExecucao(
  frequencia: string,
  primeiroHorario: string,
  diasSemana: number[]
): string | null {
  const now = new Date();
  const [hora, minuto] = primeiroHorario.split(':');

  if (frequencia === 'diario' || frequencia === 'personalizado') {
    const amanha = new Date(now);
    amanha.setDate(amanha.getDate() + 1);
    amanha.setHours(parseInt(hora), parseInt(minuto), 0, 0);
    return amanha.toISOString();
  }

  if (frequencia === 'semanal') {
    const proxima = new Date(now);
    let tentativas = 0;
    
    do {
      proxima.setDate(proxima.getDate() + 1);
      tentativas++;
    } while (diasSemana && !diasSemana.includes(proxima.getDay()) && tentativas < 8);
    
    proxima.setHours(parseInt(hora), parseInt(minuto), 0, 0);
    return proxima.toISOString();
  }

  return null;
}
