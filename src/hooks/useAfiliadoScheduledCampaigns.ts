import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const COOLDOWN_MINUTOS = 0; // teste: desabilitado (volte para 5 depois)

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

export function useAfiliadoScheduledCampaigns(userId: string | undefined) {
  const isExecuting = useRef(false);
  const lastExecutionTime = useRef<number>(0);

  useEffect(() => {
    if (!userId) return;

    console.log('🔄 [AFILIADO] Iniciando verificador de campanhas');

    const checkAndExecute = async () => {
      if (isExecuting.current) {
        return;
      }

      const now = Date.now();
      if (now - lastExecutionTime.current < 30000) {
        return;
      }

      isExecuting.current = true;
      lastExecutionTime.current = now;

      try {
        const agora = new Date();
        console.log('⏰ [AFILIADO] Verificando campanhas:', agora.toLocaleString('pt-BR'));

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

        console.log(`📋 [AFILIADO] Encontradas ${campanhas?.length || 0} campanhas para executar`);

        if (!campanhas || campanhas.length === 0) {
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
          isExecuting.current = false;
          return;
        }

        // EXECUTAR CADA CAMPANHA
        for (const campanha of campanhas) {
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

            const contatos = listas?.flatMap(l => l.phone_numbers || []) || [];
            console.log(`📱 [AFILIADO] Verificando ${contatos.length} contatos`);

            if (contatos.length === 0) {
              console.log('⚠️ [AFILIADO] Nenhum contato nas listas');
              continue;
            }

            let enviados = 0;
            let pulados = 0;
            const produto = campanha.afiliado_produtos;

            // ✅ RESOLVER IMAGEM: se não for URL direta (.jpg/.png), buscar og:image
            const rawImageUrl = produto?.imagem_url || null;
            let imageUrl: string | null = null;

            if (rawImageUrl && /\.(png|jpg|jpeg)$/i.test(rawImageUrl)) {
              // Já é URL direta de imagem
              imageUrl = rawImageUrl;
              console.log('🖼️ [AFILIADO] Imagem direta:', imageUrl);
            } else if (rawImageUrl) {
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
                  console.log('⚠️ [AFILIADO] Não conseguiu resolver imagem, enviando sem imagem');
                }
              } catch (resolveErr) {
                console.error('❌ [AFILIADO] Erro ao resolver imagem:', resolveErr);
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

                // ✅ Enviar via backend (evita CORS no navegador)
                const cleanPhone = phone.replace(/\D/g, '');

                const { data: sendData, error: sendError } = await supabase.functions.invoke('wuzapi-send', {
                  body: {
                    phone: cleanPhone,
                    message: mensagem,
                    imageUrl,
                  },
                });

                const ok = !sendError && sendData?.success === true;
                const wuzapiPayload: any = sendData?.payload ?? null;

                if (imageUrl) {
                  console.log(`📸 [AFILIADO] Envio com imagem para ${cleanPhone}:`, ok ? '✅' : '❌', wuzapiPayload);
                } else {
                  console.log(`💬 [AFILIADO] Envio texto para ${cleanPhone}:`, ok ? '✅' : '❌', wuzapiPayload);
                }

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
                  const errMsg =
                    (wuzapiPayload && (wuzapiPayload.error || wuzapiPayload.message)) ||
                    'Falha no envio (Wuzapi)';
                  await registrarEnvio(phone, 'campanha', mensagem, false, errMsg);
                  console.error(`❌ [AFILIADO] Falha ao enviar para ${cleanPhone}:`, wuzapiPayload);
                }

                // Delay entre envios
                await new Promise(r => setTimeout(r, 500));

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
                ativa: proximaExec ? true : false
              })
              .eq('id', campanha.id);

            console.log(`📅 [AFILIADO] Próxima execução: ${proximaExec ? new Date(proximaExec).toLocaleString('pt-BR') : 'Não repete'}`);

          } catch (err) {
            console.error(`❌ [AFILIADO] Erro na campanha ${campanha.nome}:`, err);
            toast.error(`Erro na campanha ${campanha.nome}`);
          }
        }

      } catch (error) {
        console.error('❌ [AFILIADO] Erro ao verificar campanhas:', error);
      } finally {
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
