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

    const timeZone = 'America/Sao_Paulo';

    const now = new Date();
    const currentDate = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now); // YYYY-MM-DD (no fuso de SP)

    const currentTime = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(now); // HH:MM (no fuso de SP)

    const spNow = new Date(`${currentDate}T${currentTime}:00-03:00`);
    const currentDay = spNow.getDay(); // 0-6 (no fuso de SP)

    console.log(`⏰ Hora atual (SP): ${currentTime}, Dia da semana (SP): ${currentDay}`);

    // Buscar campanhas ativas que devem ser executadas agora
    const { data: campanhas, error: fetchError } = await supabase
      .from("campanhas_recorrentes")
      .select(`
        *,
        produtos(id, nome, descricao, preco, imagem_url, imagens)
      `)
      .eq("ativa", true)
      .lte("data_inicio", currentDate)
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
        // ✅ VERIFICAR HORÁRIO - SÓ EXECUTA NO HORÁRIO EXATO OU ATÉ 3MIN DEPOIS (nunca antes!)
        const horariosNormalizados = (campanha.horarios || []).map((h: string) =>
          typeof h === "string" ? h.slice(0, 5) : h
        );
        
        // Converter hora atual para minutos totais
        const [horaAtual, minutoAtual] = currentTime.split(':').map(Number);
        const minutosTotaisAgora = horaAtual * 60 + minutoAtual;
        
        let horarioMatch = false;
        let horarioEncontrado = '';
        
        for (const horarioConfig of horariosNormalizados) {
          const [horaConfig, minutoConfig] = horarioConfig.split(':').map(Number);
          const minutosTotaisConfig = horaConfig * 60 + minutoConfig;
          
          // ✅ CRÍTICO: Hora atual DEVE ser >= horário configurado (nunca antes!)
          // E tolerância máxima de 3 minutos de ATRASO (para cobrir delays do cron)
          const diferencaMinutos = minutosTotaisAgora - minutosTotaisConfig;
          
          // Só dispara se: horário passou (diferença >= 0) E atraso <= 3 minutos
          if (diferencaMinutos >= 0 && diferencaMinutos <= 3) {
            horarioMatch = true;
            horarioEncontrado = horarioConfig;
            console.log(`✅ Horário OK: ${horarioConfig} (atraso: ${diferencaMinutos}min)`);
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

        // ✅ VERIFICAR SE JÁ EXECUTOU ESTE *SLOT* (mesmo horário agendado) HOJE (SP)
        // (evita bloquear um horário 11:20 só porque executou 11:18, por exemplo)
        if (campanha.ultima_execucao) {
          const ultimaExecucao = new Date(campanha.ultima_execucao);

          const ultimaDateSP = new Intl.DateTimeFormat('en-CA', {
            timeZone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          }).format(ultimaExecucao);

          const ultimaTimeSP = new Intl.DateTimeFormat('en-GB', {
            timeZone,
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          }).format(ultimaExecucao);

          if (ultimaDateSP === currentDate) {
            const ultimoSlotExecutado = resolveExecutedSlot(
              ultimaTimeSP,
              horariosNormalizados,
              3 // mesma tolerância do cron
            );

            if (ultimoSlotExecutado && ultimoSlotExecutado === horarioEncontrado) {
              console.log(
                `⏭️ Campanha ${campanha.nome} - Já executou HOJE no mesmo horário (${horarioEncontrado}) (ultima=${ultimaTimeSP})`
              );
              continue;
            }
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

function resolveExecutedSlot(
  executedTimeHHMM: string,
  scheduleHHMMList: string[],
  toleranceMinutes: number
): string | null {
  const [eh, em] = executedTimeHHMM.split(':').map(Number);
  if (Number.isNaN(eh) || Number.isNaN(em)) return null;
  const executedTotal = eh * 60 + em;

  // Normaliza e ordena
  const schedule = (scheduleHHMMList || [])
    .map((h) => (typeof h === 'string' ? h.slice(0, 5) : String(h)))
    .filter((h) => /^\d{2}:\d{2}$/.test(h))
    .sort();

  // Heurística: o slot executado é o mais próximo (em até tolerance) cujo horário <= executedTime
  let best: { h: string; diff: number } | null = null;
  for (const h of schedule) {
    const [sh, sm] = h.split(':').map(Number);
    const scheduledTotal = sh * 60 + sm;
    const diff = executedTotal - scheduledTotal;
    if (diff < 0) continue; // executou antes do slot
    if (diff <= toleranceMinutes) {
      if (!best || diff < best.diff) best = { h, diff };
    }
  }

  return best?.h ?? null;
}

// ✅ FUNÇÃO CORRIGIDA - SUPORTA MÚLTIPLOS HORÁRIOS NO MESMO DIA (FUSO SP)
function calcularProximaExecucao(
  frequencia: string,
  horarios: string[],
  diasSemana: number[]
): string | null {
  const timeZone = 'America/Sao_Paulo';
  const now = new Date();

  const currentDate = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now); // YYYY-MM-DD (SP)

  const horaAtual = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(now); // HH:MM (SP)

  // Normalizar horários para HH:MM
  const horariosNormalizados = (horarios || []).map((h: string) =>
    typeof h === 'string' ? h.slice(0, 5) : h
  );

  const horariosOrdenados = [...horariosNormalizados].sort();

  if (frequencia === 'uma_vez') return null;

  // ✅ VERIFICAR SE HÁ MAIS HORÁRIOS HOJE
  const proximoHorarioHoje = horariosOrdenados.find((h: string) => h > horaAtual);

  if (proximoHorarioHoje) {
    // Se for semanal, verificar se hoje é dia válido
    const spNow = new Date(`${currentDate}T${horaAtual}:00-03:00`);
    if (frequencia === 'semanal' && diasSemana && !diasSemana.includes(spNow.getDay())) {
      return calcularProximoDiaExecucao(frequencia, horariosOrdenados[0], diasSemana);
    }

    console.log(`📅 Próximo horário HOJE (SP): ${proximoHorarioHoje}`);
    return new Date(`${currentDate}T${proximoHorarioHoje}:00-03:00`).toISOString();
  }

  // Não há mais horários hoje, ir para próximo dia
  return calcularProximoDiaExecucao(frequencia, horariosOrdenados[0], diasSemana);
}

function calcularProximoDiaExecucao(
  frequencia: string,
  primeiroHorario: string,
  diasSemana: number[]
): string | null {
  const timeZone = 'America/Sao_Paulo';
  const now = new Date();

  const currentDate = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now); // YYYY-MM-DD (SP)

  // Criar um Date “SP” para fazer contas de dia com segurança
  const base = new Date(`${currentDate}T12:00:00-03:00`); // meio-dia evita edge cases

  if (frequencia === 'diario' || frequencia === 'personalizado') {
    const proxima = new Date(base);
    proxima.setDate(proxima.getDate() + 1);

    const ymd = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(proxima);

    return new Date(`${ymd}T${primeiroHorario.slice(0, 5)}:00-03:00`).toISOString();
  }

  if (frequencia === 'semanal') {
    const proxima = new Date(base);
    let tentativas = 0;

    do {
      proxima.setDate(proxima.getDate() + 1);
      tentativas++;
    } while (diasSemana && !diasSemana.includes(proxima.getDay()) && tentativas < 8);

    const ymd = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(proxima);

    return new Date(`${ymd}T${primeiroHorario.slice(0, 5)}:00-03:00`).toISOString();
  }

  return null;
}
