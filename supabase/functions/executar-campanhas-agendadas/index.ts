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
    const currentDay = now.getDay();

    console.log(`⏰ Hora atual: ${currentTime}, Dia: ${currentDay}`);

    // ✅ BUSCAR CAMPANHAS QUE DEVEM RODAR AGORA
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
      console.error("❌ Erro buscar campanhas:", fetchError);
      throw fetchError;
    }

    console.log(`📋 ${campanhas?.length || 0} campanhas ativas`);

    let executadas = 0;
    let erros = 0;

    for (const campanha of campanhas || []) {
      try {
        // ✅ VERIFICAR HORÁRIO (tolerância ±2 min)
        const horariosNormalizados = (campanha.horarios || []).map((h: string) =>
          typeof h === "string" ? h.slice(0, 5) : h
        );
        
        const [horaAtual, minutoAtual] = currentTime.split(':').map(Number);
        const minutosTotaisAgora = horaAtual * 60 + minutoAtual;
        
        let horarioMatch = false;
        
        for (const h of horariosNormalizados) {
          const [horaConfig, minutoConfig] = h.split(':').map(Number);
          const minutosTotaisConfig = horaConfig * 60 + minutoConfig;
          const diff = Math.abs(minutosTotaisAgora - minutosTotaisConfig);
          
          if (diff <= 2) { // ✅ Tolerância 2 minutos
            horarioMatch = true;
            console.log(`✅ Horário match: ${h} (diff: ${diff}min)`);
            break;
          }
        }
        
        if (!horarioMatch) {
          console.log(`⏭️ ${campanha.nome} - Fora do horário (${currentTime} vs ${JSON.stringify(horariosNormalizados)})`);
          continue;
        }

        // ✅ VERIFICAR DIA SEMANA
        if ((campanha.frequencia === 'diario' || campanha.frequencia === 'semanal') && campanha.dias_semana) {
          if (!campanha.dias_semana.includes(currentDay)) {
            console.log(`⏭️ ${campanha.nome} - Dia inválido`);
            continue;
          }
        }

        // ✅ VERIFICAR SE JÁ EXECUTOU (última 1h)
        if (campanha.ultima_execucao) {
          const ultimaExec = new Date(campanha.ultima_execucao);
          const diffMinutos = (now.getTime() - ultimaExec.getTime()) / 60000;
          
          if (diffMinutos < 60) {
            console.log(`⏭️ ${campanha.nome} - Já executou há ${Math.round(diffMinutos)}min`);
            continue;
          }
        }

        console.log(`✅ EXECUTANDO: ${campanha.nome}`);

        // ✅ BUSCAR CONTATOS
        const { data: listas } = await supabase
          .from("whatsapp_groups")
          .select("phone_numbers")
          .in("id", campanha.listas_ids || []);

        const todosContatos = listas?.flatMap((l: any) => l.phone_numbers || []) || [];
        console.log(`📞 ${todosContatos.length} contatos`);

        let enviados = 0;
        let pulados = 0;

        // ✅ ENVIAR CADA CONTATO
        for (const phone of todosContatos) {
          try {
            // Buscar nome
            const { data: contact } = await supabase
              .from("whatsapp_contacts")
              .select("nome")
              .eq("phone", phone)
              .eq("user_id", campanha.user_id)
              .maybeSingle();

            const nome = contact?.nome || "Cliente";

            // Personalizar mensagem
            const mensagem = campanha.mensagem_template
              .replace(/\{\{nome\}\}/gi, nome)
              .replace(/\{\{produto\}\}/gi, campanha.produtos?.nome || "")
              .replace(/\{\{preco\}\}/gi, campanha.produtos?.preco?.toString() || "");

            // ✅ ENVIAR VIA EDGE FUNCTION
            const { data: result, error: sendError } = await supabase.functions.invoke('send-wuzapi-message', {
              body: {
                phoneNumbers: [phone],
                message: mensagem,
                imageUrl: campanha.produtos?.imagem_url || campanha.produtos?.imagens?.[0],
                userId: campanha.user_id,
                skipProtection: true // ✅ Ignora cooldown
              }
            });

            if (!sendError && result?.success) {
              enviados++;
              console.log(`✅ ${phone}`);
            } else {
              console.error(`❌ ${phone}:`, sendError || result);
              pulados++;
            }

            await new Promise(r => setTimeout(r, 800)); // Delay

          } catch (err) {
            console.error(`❌ Erro ${phone}:`, err);
            pulados++;
          }
        }

        console.log(`📊 ${campanha.nome}: ${enviados}/${todosContatos.length} (${pulados} erros)`);

        // ✅ CALCULAR PRÓXIMA EXECUÇÃO
        const proximaExec = calcularProxima(campanha);

        // ✅ ATUALIZAR CAMPANHA
        const updateData: any = {
          ultima_execucao: now.toISOString(),
          total_enviados: (campanha.total_enviados || 0) + enviados,
          proxima_execucao: proximaExec
        };

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
        console.error(`❌ Erro executar ${campanha.nome}:`, error);
        erros++;
      }
    }

    console.log(`✅ Concluído: ${executadas} executadas, ${erros} erros`);

    return new Response(
      JSON.stringify({ success: true, executadas, erros }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("❌ Erro geral:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ✅ CALCULAR PRÓXIMA EXECUÇÃO
function calcularProxima(campanha: any): string | null {
  const now = new Date();
  const horarios = campanha.horarios || ['09:00'];
  const horariosOrdenados = [...horarios].map((h: string) => h.slice(0, 5)).sort();
  const horaAtual = now.toTimeString().slice(0, 5);

  if (campanha.frequencia === 'uma_vez') return null;

  // ✅ Verificar se há PRÓXIMO horário hoje
  const proximoHoje = horariosOrdenados.find((h: string) => h > horaAtual);

  if (proximoHoje) {
    // Se semanal, verificar dia válido
    if (campanha.frequencia === 'semanal' && campanha.dias_semana) {
      if (!campanha.dias_semana.includes(now.getDay())) {
        return calcularProximoDia(campanha, horariosOrdenados[0]);
      }
    }

    const [hora, minuto] = proximoHoje.split(':').map(Number);
    const proxima = new Date();
    proxima.setHours(hora, minuto, 0, 0);
    console.log(`📅 Próximo horário hoje: ${proximoHoje}`);
    return proxima.toISOString();
  }

  // Não há mais horários hoje
  return calcularProximoDia(campanha, horariosOrdenados[0]);
}

function calcularProximoDia(campanha: any, primeiroHorario: string): string | null {
  const [hora, minuto] = primeiroHorario.split(':').map(Number);

  if (campanha.frequencia === 'diario') {
    const proxima = new Date();
    proxima.setDate(proxima.getDate() + 1);
    proxima.setHours(hora, minuto, 0, 0);
    return proxima.toISOString();
  }

  if (campanha.frequencia === 'semanal') {
    const proxima = new Date();
    const diasValidos = campanha.dias_semana || [];
    let tentativas = 0;

    do {
      proxima.setDate(proxima.getDate() + 1);
      tentativas++;
    } while (!diasValidos.includes(proxima.getDay()) && tentativas < 8);

    proxima.setHours(hora, minuto, 0, 0);
    return proxima.toISOString();
  }

  return null;
}
