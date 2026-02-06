import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

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
    }).format(now);

    const currentTime = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(now);

    const spNow = new Date(`${currentDate}T${currentTime}:00-03:00`);
    const currentDay = spNow.getDay();

    console.log(`⏰ Hora atual (SP): ${currentTime}, Dia da semana (SP): ${currentDay}`);

    // Buscar campanhas ativas
    const { data: campanhas, error: fetchError } = await supabase
      .from("campanhas_recorrentes")
      .select(`
        *,
        produtos(id, nome, descricao, preco, imagem_url, imagens)
      `)
      .eq("ativa", true)
      .lte("data_inicio", currentDate);

    if (fetchError) {
      console.error("❌ Erro ao buscar campanhas:", fetchError);
      throw fetchError;
    }

    console.log(`📋 Encontradas ${campanhas?.length || 0} campanhas ativas`);

    let executadas = 0;
    let erros = 0;

    for (const campanha of campanhas || []) {
      try {
        // ✅ MODO INTERVALO: frequencia = 'intervalo' + intervalo_minutos definido
        const isIntervaloMode = campanha.frequencia === 'intervalo' && campanha.intervalo_minutos > 0;
        
        let shouldExecute = false;
        let horarioEncontrado = currentTime;

        if (isIntervaloMode) {
          // ✅ VERIFICAR SE JÁ PASSOU O INTERVALO DESDE A ÚLTIMA EXECUÇÃO
          if (!campanha.ultima_execucao) {
            shouldExecute = true;
            console.log(`🆕 Campanha ${campanha.nome} - Primeira execução (intervalo: ${campanha.intervalo_minutos}min)`);
          } else {
            const ultimaExecucao = new Date(campanha.ultima_execucao);
            const diffMs = now.getTime() - ultimaExecucao.getTime();
            const diffMinutos = Math.floor(diffMs / 60000);
            
            if (diffMinutos >= campanha.intervalo_minutos) {
              shouldExecute = true;
              console.log(`✅ Campanha ${campanha.nome} - Intervalo atingido (${diffMinutos}min >= ${campanha.intervalo_minutos}min)`);
            } else {
              console.log(`⏭️ Campanha ${campanha.nome} - Aguardando intervalo (${diffMinutos}min < ${campanha.intervalo_minutos}min)`);
              continue;
            }
          }
          
          // Para modo intervalo, verificar dia da semana
          if (campanha.dias_semana && campanha.dias_semana.length > 0) {
            if (!campanha.dias_semana.includes(currentDay)) {
              console.log(`⏭️ Campanha ${campanha.nome} - Dia da semana não permitido`);
              continue;
            }
          }
        } else {
          // ✅ MODO HORÁRIOS FIXOS (comportamento original)
          if (!campanha.horarios || campanha.horarios.length === 0) {
            console.log(`⏭️ Campanha ${campanha.nome} - Sem horários configurados`);
            continue;
          }
          
          const horariosNormalizados = (campanha.horarios || []).map((h: string) =>
            typeof h === "string" ? h.slice(0, 5) : h
          );
          
          const [horaAtual, minutoAtual] = currentTime.split(':').map(Number);
          const minutosTotaisAgora = horaAtual * 60 + minutoAtual;
          
          let horarioMatch = false;
          let menorAtraso = 999;
          
          for (const horarioConfig of horariosNormalizados) {
            const [horaConfig, minutoConfig] = horarioConfig.split(':').map(Number);
            const minutosTotaisConfig = horaConfig * 60 + minutoConfig;
            const diferencaMinutos = minutosTotaisAgora - minutosTotaisConfig;
            
            if (diferencaMinutos >= 0 && diferencaMinutos <= 3) {
              if (diferencaMinutos < menorAtraso) {
                menorAtraso = diferencaMinutos;
                horarioMatch = true;
                horarioEncontrado = horarioConfig;
              }
            }
          }
          
          if (!horarioMatch) {
            console.log(`⏭️ Campanha ${campanha.nome} - Horário não corresponde (agora=${currentTime})`);
            continue;
          }

          // Verificar dia da semana para campanhas diárias/semanais
          if ((campanha.frequencia === 'diario' || campanha.frequencia === 'semanal') && campanha.dias_semana) {
            if (!campanha.dias_semana.includes(currentDay)) {
              console.log(`⏭️ Campanha ${campanha.nome} - Dia da semana não corresponde`);
              continue;
            }
          }

          // Verificar se já executou este slot hoje
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
                3
              );

              if (ultimoSlotExecutado && ultimoSlotExecutado === horarioEncontrado) {
                console.log(`⏭️ Campanha ${campanha.nome} - Já executou HOJE no mesmo horário (${horarioEncontrado})`);
                continue;
              }
            }
          }
          
          shouldExecute = true;
        }

        if (!shouldExecute) continue;

        console.log(`✅ Executando campanha: ${campanha.nome} (modo: ${isIntervaloMode ? 'intervalo' : 'horário fixo'})`);

        let enviados = 0;
        let errosEnvio = 0;
        
        // ✅ OBTER PRODUTO (rotação ou fixo)
        let produtoParaEnviar = campanha.produtos;
        let imagemUrl = produtoParaEnviar?.imagem_url || produtoParaEnviar?.imagens?.[0];
        
        // Se modo intervalo com rotação de produtos
        if (isIntervaloMode && (campanha.produtos_ids?.length > 0 || campanha.categoria_rotacao)) {
          const produtoRotacionado = await obterProximoProduto(supabase, campanha);
          if (produtoRotacionado) {
            produtoParaEnviar = produtoRotacionado;
            imagemUrl = produtoRotacionado.imagem_url || produtoRotacionado.imagens?.[0];
            console.log(`🔄 Produto rotacionado: ${produtoRotacionado.nome}`);
          }
        }

        // ✅ ENVIAR PARA GRUPOS PJ (pj_grupos_ids ou listas_ids que são grupos PJ)
        const gruposIdsParaBuscar = campanha.pj_grupos_ids?.length > 0 
          ? campanha.pj_grupos_ids 
          : campanha.listas_ids || [];

        const { data: gruposPJ } = await supabase
          .from("pj_grupos_whatsapp")
          .select("id, grupo_jid, nome")
          .in("id", gruposIdsParaBuscar);

        if (gruposPJ && gruposPJ.length > 0) {
          console.log(`👥 Enviando para ${gruposPJ.length} grupos PJ`);
          
          for (const grupo of gruposPJ) {
            try {
              console.log(`📱 Enviando para grupo PJ: ${grupo.nome} (${grupo.grupo_jid})`);
              
              const mensagemGrupo = campanha.mensagem_template
                .replace(/\{\{nome\}\}/gi, 'pessoal')
                .replace(/Olá\s+,/gi, 'Olá pessoal,')
                .replace(/Oi\s+,/gi, 'Oi pessoal,')
                .replace(/\{\{produto\}\}/gi, produtoParaEnviar?.nome || "")
                .replace(/\{\{preco\}\}/gi, produtoParaEnviar?.preco?.toString() || "");
              
              const { data: sendResult, error: sendError } = await supabase.functions.invoke('send-wuzapi-group-message-pj', {
                body: {
                  userId: campanha.user_id,
                  groupJid: grupo.grupo_jid,
                  message: mensagemGrupo,
                  imageUrl: imagemUrl
                }
              });

              if (!sendError && sendResult?.success) {
                enviados++;
                console.log(`✅ Enviado para grupo PJ ${grupo.nome}`);
              } else {
                console.error(`❌ Erro ao enviar para grupo PJ ${grupo.nome}:`, sendError || sendResult);
                errosEnvio++;
              }

              // Delay aleatório entre 3-7 segundos (simula comportamento humano)
              const delayGrupo = Math.floor(Math.random() * (7000 - 3000 + 1)) + 3000;
              console.log(`⏱️ Aguardando ${delayGrupo}ms antes do próximo envio...`);
              await new Promise(r => setTimeout(r, delayGrupo));

            } catch (error) {
              console.error(`❌ Erro ao processar grupo PJ ${grupo.nome}:`, error);
              errosEnvio++;
            }
          }
        }

        // ✅ PROCESSAR LISTAS NORMAIS (whatsapp_groups) - excluir IDs que são grupos PJ
        const gruposPJIds = (gruposPJ || []).map(g => g.id);
        const listasNormaisIds = (campanha.listas_ids || []).filter((id: string) => !gruposPJIds.includes(id));
        
        if (listasNormaisIds.length > 0) {
          const { data: listas } = await supabase
            .from("whatsapp_groups")
            .select("phone_numbers")
            .in("id", listasNormaisIds);

          const todosContatos = listas?.flatMap((l: any) => l.phone_numbers || []) || [];
          console.log(`📞 Total de contatos em listas normais: ${todosContatos.length}`);

          for (const phone of todosContatos) {
            try {
              const { data: contact } = await supabase
                .from("whatsapp_contacts")
                .select("nome")
                .eq("phone", phone)
                .eq("user_id", campanha.user_id)
                .maybeSingle();

              const nome = contact?.nome || "Cliente";

              const mensagemPersonalizada = campanha.mensagem_template
                .replace(/\{\{nome\}\}/gi, nome)
                .replace(/\{\{produto\}\}/gi, produtoParaEnviar?.nome || "")
                .replace(/\{\{preco\}\}/gi, produtoParaEnviar?.preco?.toString() || "");

              const { data: sendResult, error: sendError } = await supabase.functions.invoke('send-wuzapi-message-pj', {
                body: {
                  phoneNumbers: [phone],
                  message: mensagemPersonalizada,
                  imageUrl: imagemUrl,
                  userId: campanha.user_id,
                  skipProtection: true
                }
              });

              if (!sendError && sendResult?.success) {
                enviados++;
                console.log(`✅ Enviado para ${phone}`);
              } else {
                console.error(`❌ Erro ao enviar para ${phone}:`, sendError || sendResult);
                errosEnvio++;
              }

              // Delay aleatório entre 3-7 segundos (simula comportamento humano)
              const delayContato = Math.floor(Math.random() * (7000 - 3000 + 1)) + 3000;
              console.log(`⏱️ Aguardando ${delayContato}ms antes do próximo envio...`);
              await new Promise(r => setTimeout(r, delayContato));

            } catch (error) {
              console.error(`❌ Erro ao processar ${phone}:`, error);
              errosEnvio++;
            }
          }
        }

        console.log(`📊 Campanha ${campanha.nome}: ${enviados} enviados, ${errosEnvio} erros`);

        // ✅ SÓ ATUALIZA SE ENVIOU PELO MENOS 1 MENSAGEM
        const totalAlvos = (gruposPJ?.length || 0) + (listasNormaisIds.length > 0 ? 1 : 0);
        if (enviados === 0 && totalAlvos > 0) {
          console.log(`⚠️ Campanha ${campanha.nome} - Nenhuma mensagem enviada, NÃO atualizando ultima_execucao`);
          continue;
        }

        // ✅ CALCULAR PRÓXIMA EXECUÇÃO
        let proximaExecucao: string | null = null;
        
        if (isIntervaloMode) {
          // Para modo intervalo, próxima execução é agora + intervalo
          const proxima = new Date(now.getTime() + campanha.intervalo_minutos * 60000);
          proximaExecucao = proxima.toISOString();
        } else {
          proximaExecucao = calcularProximaExecucao(
            campanha.frequencia,
            campanha.horarios,
            campanha.dias_semana
          );
        }

        // Atualizar campanha
        const updateData: any = {
          ultima_execucao: now.toISOString(),
          total_enviados: (campanha.total_enviados || 0) + enviados,
          proxima_execucao: proximaExecucao,
          status: 'ativa'
        };

        if (campanha.frequencia === 'uma_vez') {
          updateData.ativa = false;
          updateData.status = 'encerrada';
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

    // ✅ TAMBÉM DISPARA O ENVIO PROGRAMADO DE AFILIADOS
    let envioProgramadoResult = null;
    try {
      console.log('📤 [AFILIADO] Disparando executar-envio-programado...');
      const { data, error } = await supabase.functions.invoke('executar-envio-programado', {
        body: {}
      });
      
      if (error) {
        console.error('❌ [AFILIADO] Erro no envio programado:', error);
      } else {
        envioProgramadoResult = data;
        console.log('✅ [AFILIADO] Envio programado executado:', data);
      }
    } catch (epError) {
      console.error('❌ [AFILIADO] Erro ao chamar envio programado:', epError);
    }

    // ✅ PROCESSAR FILA DE ATENDIMENTO ANTI-BLOQUEIO
    let filaAtendimentoResult = null;
    try {
      console.log('📤 [FILA] Processando fila de atendimento anti-bloqueio...');
      const { data, error } = await supabase.functions.invoke('processar-fila-afiliado', {
        body: {}
      });
      
      if (error) {
        console.error('❌ [FILA] Erro ao processar fila:', error);
      } else {
        filaAtendimentoResult = data;
        console.log('✅ [FILA] Fila processada:', data);
      }
    } catch (filaError) {
      console.error('❌ [FILA] Erro ao chamar processar-fila-afiliado:', filaError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        executadas,
        erros,
        total: campanhas?.length || 0,
        envioProgramado: envioProgramadoResult,
        filaAtendimento: filaAtendimentoResult
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

// ✅ FUNÇÃO PARA OBTER PRÓXIMO PRODUTO (rotação)
async function obterProximoProduto(supabase: any, campanha: any): Promise<any> {
  try {
    let query = supabase
      .from("produtos")
      .select("id, nome, descricao, preco, imagem_url, imagens, categoria")
      .eq("user_id", campanha.user_id)
      .eq("ativo", true);

    // Se tem lista específica de produtos
    if (campanha.produtos_ids && campanha.produtos_ids.length > 0) {
      query = query.in("id", campanha.produtos_ids);
    }
    
    // Se tem filtro de categoria
    if (campanha.categoria_rotacao) {
      query = query.eq("categoria", campanha.categoria_rotacao);
    }

    const { data: produtos, error } = await query;

    if (error || !produtos || produtos.length === 0) {
      console.log(`⚠️ Nenhum produto encontrado para rotação`);
      return null;
    }

    // Calcular próximo índice
    const ultimoIndex = campanha.ultimo_produto_index || 0;
    const proximoIndex = (ultimoIndex + 1) % produtos.length;
    
    const produtoSelecionado = produtos[proximoIndex];

    // Atualizar índice na campanha
    await supabase
      .from("campanhas_recorrentes")
      .update({ ultimo_produto_index: proximoIndex })
      .eq("id", campanha.id);

    console.log(`🔄 Produto ${proximoIndex + 1}/${produtos.length}: ${produtoSelecionado.nome}`);
    
    return produtoSelecionado;
  } catch (error) {
    console.error("❌ Erro ao obter próximo produto:", error);
    return null;
  }
}

function resolveExecutedSlot(
  executedTimeHHMM: string,
  scheduleHHMMList: string[],
  toleranceMinutes: number
): string | null {
  const [eh, em] = executedTimeHHMM.split(':').map(Number);
  if (Number.isNaN(eh) || Number.isNaN(em)) return null;
  const executedTotal = eh * 60 + em;

  const schedule = (scheduleHHMMList || [])
    .map((h) => (typeof h === 'string' ? h.slice(0, 5) : String(h)))
    .filter((h) => /^\d{2}:\d{2}$/.test(h))
    .sort();

  let best: { h: string; diff: number } | null = null;
  for (const h of schedule) {
    const [sh, sm] = h.split(':').map(Number);
    const scheduledTotal = sh * 60 + sm;
    const diff = executedTotal - scheduledTotal;
    if (diff < 0) continue;
    if (diff <= toleranceMinutes) {
      if (!best || diff < best.diff) best = { h, diff };
    }
  }

  return best?.h ?? null;
}

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
  }).format(now);

  const horaAtual = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(now);

  const horariosNormalizados = (horarios || []).map((h: string) =>
    typeof h === 'string' ? h.slice(0, 5) : h
  );

  const horariosOrdenados = [...horariosNormalizados].sort();

  if (frequencia === 'uma_vez') return null;

  const proximoHorarioHoje = horariosOrdenados.find((h: string) => h > horaAtual);

  if (proximoHorarioHoje) {
    const spNow = new Date(`${currentDate}T${horaAtual}:00-03:00`);
    if (frequencia === 'semanal' && diasSemana && !diasSemana.includes(spNow.getDay())) {
      return calcularProximoDiaExecucao(frequencia, horariosOrdenados[0], diasSemana);
    }

    return new Date(`${currentDate}T${proximoHorarioHoje}:00-03:00`).toISOString();
  }

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
  }).format(now);

  const base = new Date(`${currentDate}T12:00:00-03:00`);

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
