import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const COOLDOWN_MINUTOS = 0; // teste: desabilitado (volte para 5 depois)
const CONTABO_WUZAPI_URL = 'https://api2.amzofertas.com.br';

/**
 * Tenta reconectar sessão Wuzapi 1 vez
 */
async function tentarReconectar(token: string): Promise<boolean> {
  try {
    console.log('🔄 [AFILIADO] Tentando reconectar Wuzapi...');
    const resp = await fetch(`${CONTABO_WUZAPI_URL}/session/connect`, {
      method: 'POST',
      headers: { 
        'Token': token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });
    
    if (resp.ok) {
      console.log('✅ [AFILIADO] Reconexão bem-sucedida!');
      return true;
    }
    
    console.log('❌ [AFILIADO] Reconexão falhou, status:', resp.status);
    return false;
  } catch (err) {
    console.error('❌ [AFILIADO] Erro ao reconectar:', err);
    return false;
  }
}

/**
 * Verifica cooldown entre mensagens
 */
async function verificarCooldown(whatsapp: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('historico_envios')
    .select('timestamp')
    .eq('whatsapp', whatsapp)
    .order('timestamp', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return true; // Pode enviar
  }

  const ultimoEnvio = new Date(data.timestamp);
  const diffMinutos = (Date.now() - ultimoEnvio.getTime()) / 60000;

  return diffMinutos >= COOLDOWN_MINUTOS;
}

/**
 * Registra envio no histórico
 */
async function registrarEnvio(
  whatsapp: string, 
  tipo: 'campanha' | 'ia' | 'manual',
  mensagem: string,
  sucesso: boolean = true,
  erro?: string
): Promise<void> {
  const { error } = await supabase
    .from('historico_envios')
    .insert({
      whatsapp,
      tipo,
      mensagem: mensagem.substring(0, 500),
      sucesso,
      erro: erro || null,
      timestamp: new Date().toISOString()
    });

  if (error) {
    console.error('Erro ao registrar envio:', error);
  }
}

// Singleton para evitar múltiplas instâncias executando ao mesmo tempo
const globalExecutingLock = { current: false };
const globalLastExecution = { current: 0 };
const executedCampaignsToday = new Set<string>();

export function useAfiliadoScheduledCampaigns(userId: string | undefined) {
  const isExecuting = useRef(false);

  useEffect(() => {
    console.log('🔄 [HOOK] useAfiliadoScheduledCampaigns iniciado, userId:', userId);
    if (!userId) return;

    console.log('🔄 [AFILIADO] Iniciando verificador de campanhas');

    const checkAndExecute = async () => {
      // ✅ LOCK GLOBAL para evitar múltiplas instâncias (React Strict Mode)
      if (globalExecutingLock.current || isExecuting.current) {
        console.log('🔒 [AFILIADO] Já está executando, ignorando...');
        return;
      }

      const now = Date.now();
      if (now - globalLastExecution.current < 30000) {
        return;
      }

      globalExecutingLock.current = true;
      isExecuting.current = true;
      globalLastExecution.current = now;

      try {
        const agora = new Date();
        console.log('⏰ [AFILIADO] Verificando campanhas:', agora.toLocaleString('pt-BR'));

        // Limpar campanhas executadas de dias anteriores
        const hoje = agora.toDateString();
        if (!executedCampaignsToday.has(`_date_${hoje}`)) {
          executedCampaignsToday.clear();
          executedCampaignsToday.add(`_date_${hoje}`);
        }

        // Buscar campanhas de AFILIADO que devem executar
        const { data: campanhas, error } = await supabase
          .from('afiliado_campanhas')
          .select(`
            *,
            afiliado_produtos (*)
          `)
          .eq('user_id', userId)
          .eq('ativa', true)
          .lte('proxima_execucao', agora.toISOString());

        if (error) throw error;

        // ✅ FILTRAR campanhas já executadas nesta sessão
        const campanhasNaoExecutadas = (campanhas || []).filter(c => {
          const key = `${c.id}_${c.proxima_execucao}`;
          if (executedCampaignsToday.has(key)) {
            console.log(`⏭️ [AFILIADO] Campanha ${c.nome} já executada nesta sessão, pulando...`);
            return false;
          }
          return true;
        });

        console.log(`📋 [AFILIADO] Encontradas ${campanhasNaoExecutadas.length} campanhas para executar (${campanhas?.length || 0} total, ${(campanhas?.length || 0) - campanhasNaoExecutadas.length} já executadas)`);

        if (campanhasNaoExecutadas.length === 0) {
          globalExecutingLock.current = false;
          isExecuting.current = false;
          return;
        }

        // Buscar instância WhatsApp do afiliado
        const { data: afiliadoData } = await supabase
          .from('clientes_afiliados')
          .select('wuzapi_jid, wuzapi_token, wuzapi_instance_id')
          .eq('user_id', userId)
          .maybeSingle();

        if (!afiliadoData?.wuzapi_jid) {
          console.log('❌ [AFILIADO] Sem WhatsApp conectado');
          toast.error('Conecte seu WhatsApp para enviar campanhas');
          globalExecutingLock.current = false;
          isExecuting.current = false;
          return;
        }

        // EXECUTAR CADA CAMPANHA (usando lista filtrada!)
        for (const campanha of campanhasNaoExecutadas) {
          // ✅ CLAIM NO BACKEND: evita triplicar quando houver 2-3 abas/janelas abertas
          // Só 1 execução consegue marcar como "executando" para esse mesmo proxima_execucao.
          const { data: claimed, error: claimErr } = await supabase
            .from('afiliado_campanhas')
            .update({ status: 'executando', updated_at: new Date().toISOString() })
            .eq('id', campanha.id)
            .eq('proxima_execucao', campanha.proxima_execucao)
            .or('status.is.null,status.neq.executando')
            .select('id')
            .maybeSingle();

          if (claimErr) throw claimErr;
          if (!claimed?.id) {
            console.log(`🔒 [AFILIADO] Campanha ${campanha.nome} já foi capturada por outra sessão, pulando...`);
            continue;
          }

          // ✅ Marcar como executada ANTES de processar (evita duplicação na mesma aba)
          const campanhaKey = `${campanha.id}_${campanha.proxima_execucao}`;
          executedCampaignsToday.add(campanhaKey);

          console.log(`🚀 [AFILIADO] Executando: ${campanha.nome}`);
          toast.info(`🚀 Executando campanha: ${campanha.nome}`);

          try {
            // Buscar listas de transmissão
            const listasIds = (campanha as any).listas_ids || [];
            
            if (listasIds.length === 0) {
              console.log('⚠️ [AFILIADO] Campanha sem listas selecionadas');
              toast.warning(`Campanha ${campanha.nome} não tem listas de transmissão`);
              continue;
            }

            const { data: listas } = await supabase
              .from('whatsapp_groups')
              .select('phone_numbers, group_name')
              .in('id', listasIds);

            // ✅ DEDUPLICAR contatos usando Set para evitar mensagens duplicadas
            const contatosBrutos = listas?.flatMap(l => l.phone_numbers || []) || [];
            const contatosUnicos = [...new Set(contatosBrutos.map(p => p.replace(/\D/g, '')))];
            console.log(`📱 [AFILIADO] Verificando ${contatosUnicos.length} contatos únicos (${contatosBrutos.length} brutos)`);

            if (contatosUnicos.length === 0) {
              console.log('⚠️ [AFILIADO] Nenhum contato nas listas');
              continue;
            }
            
            const contatos = contatosUnicos;

            let enviados = 0;
            let pulados = 0;
            const produto = campanha.afiliado_produtos;

            // ✅ RESOLVER IMAGEM: verificar se é URL direta de imagem válida
            const rawImageUrl = produto?.imagem_url || null;
            let imageUrl: string | null = null;

            if (rawImageUrl) {
              // Verificar se é URL de imagem direta (incluindo webp e URLs do ML)
              const isDirectImageUrl = 
                /\.(png|jpg|jpeg|webp|gif)(\?.*)?$/i.test(rawImageUrl) ||
                rawImageUrl.includes('mlstatic.com') ||
                rawImageUrl.includes('http2.mlstatic.com');

              if (isDirectImageUrl) {
                imageUrl = rawImageUrl;
                console.log('🖼️ [AFILIADO] Imagem direta detectada:', imageUrl.substring(0, 60));
              } else if (rawImageUrl.includes('amazon.com') || rawImageUrl.includes('amzn.')) {
                // Tentar resolver via scraping Amazon
                console.log('🔍 [AFILIADO] Resolvendo imagem Amazon...');
                try {
                  const { data: imgData, error: imgErr } = await supabase.functions.invoke(
                    'resolve-amazon-image',
                    { body: { url: rawImageUrl } }
                  );
                  
                  if (!imgErr && imgData?.success && imgData?.imageUrl) {
                    imageUrl = imgData.imageUrl;
                    console.log('✅ [AFILIADO] Imagem resolvida:', imageUrl);
                  } else {
                    console.log('⚠️ [AFILIADO] Não conseguiu resolver imagem Amazon');
                  }
                } catch (resolveErr) {
                  console.error('❌ [AFILIADO] Erro ao resolver imagem:', resolveErr);
                }
              } else {
                // URL não reconhecida, usa como está
                imageUrl = rawImageUrl;
                console.log('🖼️ [AFILIADO] Usando imagem como está:', imageUrl.substring(0, 60));
              }
            }

            // ENVIAR PARA CADA CONTATO
            for (const phone of contatos) {
              try {
                // Verificar cooldown
                const podEnviar = await verificarCooldown(phone);
                
                if (!podEnviar) {
                  console.log(`⏰ [AFILIADO] COOLDOWN - Pulando ${phone}`);
                  pulados++;
                  continue;
                }

                // Buscar nome do contato
                const { data: contact } = await supabase
                  .from('whatsapp_contacts')
                  .select('nome')
                  .eq('phone', phone)
                  .maybeSingle();

                const nome = contact?.nome || 'Cliente';

                // Personalizar mensagem
                const mensagem = campanha.mensagem_template
                  .replace(/\{\{nome\}\}/gi, nome)
                  .replace(/\{\{produto\}\}/gi, produto?.titulo || 'Produto')
                  .replace(/\{\{preco\}\}/gi, produto?.preco?.toString() || '0');

                // ✅ ENVIAR VIA EDGE FUNCTION (evita CORS)
                const cleanPhone = phone.replace(/\D/g, '');
                console.log(`📞 [AFILIADO] Enviando para ${cleanPhone} via Edge Function...`);

                let ok = false;
                let sendResult: any = null;

                try {
                  const { data: sendData, error: sendError } = await supabase.functions.invoke(
                    'send-wuzapi-message-afiliado',
                    {
                      body: {
                        phoneNumbers: [cleanPhone],
                        message: mensagem,
                        imageUrl: imageUrl,
                        userId: userId
                      }
                    }
                  );

                  if (sendError) {
                    console.error(`❌ [AFILIADO] Erro na Edge Function:`, sendError);
                    sendResult = { error: sendError.message };
                    ok = false;
                  } else {
                    sendResult = sendData;
                    // Verificar se o primeiro resultado foi sucesso
                    ok = sendData?.success && sendData?.results?.[0]?.success;
                    console.log(`📊 [AFILIADO] Resultado Edge Function:`, sendData);
                  }

                  // Se falhou por erro de sessão, pausar campanha
                  if (!ok && sendResult) {
                    const errMsg = sendResult?.results?.[0]?.response?.error || 
                                   sendResult?.results?.[0]?.error ||
                                   sendResult?.error || '';
                    
                    const isSessionError =
                      errMsg.toLowerCase().includes('session') ||
                      errMsg.toLowerCase().includes('no session') ||
                      errMsg.toLowerCase().includes('not connected');

                    if (isSessionError) {
                      console.log('❌ [AFILIADO] Erro de sessão, pausando campanha...');
                      await supabase
                        .from('afiliado_campanhas')
                        .update({ ativa: false, status: 'erro_sessao' })
                        .eq('id', campanha.id);

                      toast.error('⚠️ WhatsApp desconectado! Campanha pausada — reconecte em Conectar Celular.');
                      break;
                    }
                  }

                } catch (invokeErr: any) {
                  console.error(`❌ [AFILIADO] Erro ao invocar Edge Function:`, invokeErr);
                  sendResult = { error: invokeErr.message };
                  ok = false;
                }

                // Log resultado final
                console.log(`${ok ? '✅' : '❌'} [AFILIADO] Resultado para ${cleanPhone}:`, sendResult);

                // Registrar resultado
                if (ok) {
                  enviados++;
                  await registrarEnvio(phone, 'campanha', mensagem, true);

                  // Registrar mensagem enviada
                  await supabase.from('whatsapp_messages').insert({
                    user_id: userId,
                    phone: phone,
                    direction: 'sent',
                    message: mensagem,
                    origem: 'afiliado'
                  });

                  // Salvar conversa com contexto
                  await supabase.from('whatsapp_conversations').upsert({
                    user_id: userId,
                    phone_number: phone,
                    origem: 'afiliado',
                    contact_name: nome,
                    metadata: {
                      produto_id: produto?.id,
                      produto_nome: produto?.titulo,
                      produto_preco: produto?.preco,
                      link_afiliado: produto?.link_afiliado,
                      data_envio: new Date().toISOString()
                    }
                  }, {
                    onConflict: 'user_id,phone_number'
                  });
                  
                  console.log(`✅ [AFILIADO] Enviado para ${phone}`);
                } else {
                  // Registrar erro final
                  const errFinal =
                    sendResult?.results?.[0]?.response?.error ||
                    sendResult?.results?.[0]?.error ||
                    sendResult?.error ||
                    'Falha no envio (Edge Function Afiliado)';
                  await registrarEnvio(phone, 'campanha', mensagem, false, errFinal);
                  console.error(`❌ [AFILIADO] Falha final para ${cleanPhone}:`, errFinal);
                }

                // Delay aleatório 5-8 segundos (compliance Meta)
                const delayMs = Math.floor(Math.random() * 3000) + 5000;
                await new Promise(r => setTimeout(r, delayMs));

              } catch (err) {
                console.error(`[AFILIADO] Erro ao enviar para ${phone}:`, err);
              }
            }

            console.log(`✅ [AFILIADO] Campanha ${campanha.nome}: ${enviados}/${contatos.length} enviados (${pulados} pulados)`);
            toast.success(`✅ Campanha: ${enviados} enviados, ${pulados} protegidos`);

            // Calcular próxima execução
            const proximaExec = calcularProxima(campanha);

            // Atualizar campanha
            await supabase
              .from('afiliado_campanhas')
              .update({
                ultima_execucao: agora.toISOString(),
                proxima_execucao: proximaExec,
                total_enviados: (campanha.total_enviados || 0) + enviados,
                ativa: proximaExec ? true : false,
                status: proximaExec ? 'ativa' : 'concluida'
              })
              .eq('id', campanha.id);

            console.log(`📅 [AFILIADO] Próxima execução: ${proximaExec ? new Date(proximaExec).toLocaleString('pt-BR') : 'Não repete'}`);

          } catch (err) {
            console.error(`❌ [AFILIADO] Erro na campanha ${campanha.nome}:`, err);
            // Evita ficar preso em "executando" caso dê erro no meio
            await supabase
              .from('afiliado_campanhas')
              .update({ status: 'erro_execucao' })
              .eq('id', campanha.id);
            toast.error(`Erro na campanha ${campanha.nome}`);
          }
        }

      } catch (error) {
        console.error('❌ [AFILIADO] Erro ao verificar campanhas:', error);
      } finally {
        // ✅ Liberar AMBOS os locks
        globalExecutingLock.current = false;
        isExecuting.current = false;
      }
    };

    // Executar imediatamente
    checkAndExecute();

    // Executar a cada 1 minuto
    const interval = setInterval(checkAndExecute, 60 * 1000);

    return () => clearInterval(interval);

  }, [userId]);
}

function calcularProxima(campanha: any): string | null {
  const agora = new Date();
  const horarios = campanha.horarios || ['09:00'];

  if (campanha.frequencia === 'uma_vez') {
    const dataInicio = new Date(campanha.data_inicio);
    
    if (dataInicio.toDateString() === agora.toDateString()) {
      for (const horario of horarios) {
        const [hora, minuto] = horario.split(':').map(Number);
        const proximaExec = new Date();
        proximaExec.setHours(hora, minuto, 0, 0);
        
        if (proximaExec > agora) {
          return proximaExec.toISOString();
        }
      }
    }
    
    return null;
  }

  if (campanha.frequencia === 'diario') {
    for (const horario of horarios) {
      const [hora, minuto] = horario.split(':').map(Number);
      const proximaExec = new Date();
      proximaExec.setHours(hora, minuto, 0, 0);
      
      if (proximaExec > agora) {
        return proximaExec.toISOString();
      }
    }
    
    const [hora, minuto] = horarios[0].split(':').map(Number);
    const amanha = new Date();
    amanha.setDate(amanha.getDate() + 1);
    amanha.setHours(hora, minuto, 0, 0);
    return amanha.toISOString();
  }

  if (campanha.frequencia === 'semanal') {
    const diasValidos = campanha.dias_semana || [];
    
    if (diasValidos.includes(agora.getDay())) {
      for (const horario of horarios) {
        const [hora, minuto] = horario.split(':').map(Number);
        const proximaExec = new Date();
        proximaExec.setHours(hora, minuto, 0, 0);
        
        if (proximaExec > agora) {
          return proximaExec.toISOString();
        }
      }
    }
    
    const proxima = new Date();
    do {
      proxima.setDate(proxima.getDate() + 1);
    } while (!diasValidos.includes(proxima.getDay()));
    
    const [hora, minuto] = horarios[0].split(':').map(Number);
    proxima.setHours(hora, minuto, 0, 0);
    return proxima.toISOString();
  }

  return null;
}
