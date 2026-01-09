import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const COOLDOWN_MINUTOS = 0; // teste: desabilitado (volte para 5 depois)
const CONTABO_WUZAPI_URL = 'https://api2.amzofertas.com.br';

/**
 * Formata preço corretamente para Shopee
 * O banco armazena 2.399 (número) que deve ser R$ 2.399,00 (milhar)
 * Regra: se número tem 3 casas "decimais" E parte inteira < 100, é milhar
 */
function formatarPrecoAfiliado(preco: number | string | null): string {
  if (preco == null) return 'Consulte';
  
  let valor: number;
  const precoNum = typeof preco === 'number' ? preco : parseFloat(String(preco).replace(',', '.'));
  
  if (isNaN(precoNum) || precoNum <= 0) return 'Consulte';
  
  // Detectar padrão Shopee: valores como 2.399 que deveriam ser 2399
  // Se o valor é X.YYY onde X < 100 e YYY tem 3 dígitos, multiplica por 1000
  const precoStr = precoNum.toString();
  if (precoStr.includes('.')) {
    const [inteiro, decimal] = precoStr.split('.');
    // Se tem exatamente 3 decimais e parte inteira é pequena, é milhar
    if (decimal && decimal.length === 3 && parseInt(inteiro) < 100) {
      valor = precoNum * 1000; // 2.399 -> 2399
    } else {
      valor = precoNum;
    }
  } else {
    valor = precoNum;
  }
  
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

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
// ✅ Deduplicação de envios para grupos (evita duplicados em campanhas simultâneas)
const recentGroupSends = new Map<string, number>(); // groupJid -> timestamp

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
          // ✅ Execução protegida por leader-election (CampaignScheduler) + lock local
          // Evitamos depender da coluna `status` aqui para não quebrar quando o cache do schema estiver desatualizado.
          const { error: touchErr } = await supabase
            .from('afiliado_campanhas')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', campanha.id)
            .eq('proxima_execucao', campanha.proxima_execucao);

          if (touchErr) throw touchErr;

          // ✅ Marcar como executada ANTES de processar (evita duplicação na mesma aba)
          const campanhaKey = `${campanha.id}_${campanha.proxima_execucao}`;
          executedCampaignsToday.add(campanhaKey);

          console.log(`🚀 [AFILIADO] Executando: ${campanha.nome}`);
          toast.info(`🚀 Executando campanha: ${campanha.nome}`);

          try {
            // Buscar listas de transmissão (manuais + automáticas por categoria + grupos WhatsApp reais)
            const listasIds = (campanha as any).listas_ids || [];

            if (listasIds.length === 0) {
              console.log('⚠️ [AFILIADO] Campanha sem listas selecionadas');
              toast.warning(`Campanha ${campanha.nome} não tem listas de transmissão`);
              continue;
            }

            // Grupos WhatsApp reais (envio 1x por grupo)
            const { data: gruposSelecionados, error: gruposErr } = await supabase
              .from('whatsapp_grupos_afiliado')
              .select('id, group_jid, group_name')
              .eq('user_id', userId)
              .eq('ativo', true)
              .in('id', listasIds);

            if (gruposErr) {
              console.error('❌ [AFILIADO] Erro ao buscar grupos WhatsApp:', gruposErr);
            }

            // Buscar listas manuais (whatsapp_groups)
            const { data: listasManuais } = await supabase
              .from('whatsapp_groups')
              .select('phone_numbers, group_name')
              .in('id', listasIds);

            // Buscar listas automáticas por categoria (afiliado_listas_categoria -> afiliado_lista_membros -> leads_ebooks)
            const { data: listasAuto } = await supabase
              .from('afiliado_lista_membros')
              .select('lead_id, lista_id, leads_ebooks(phone)')
              .in('lista_id', listasIds);

            // Coletar telefones das listas manuais
            const contatosManuais = listasManuais?.flatMap(l => l.phone_numbers || []) || [];

            // Coletar telefones das listas automáticas (via leads_ebooks)
            const contatosAuto = listasAuto?.map(m => (m.leads_ebooks as any)?.phone).filter(Boolean) || [];

            console.log(
              `📋 [AFILIADO] Listas manuais: ${contatosManuais.length} | Auto: ${contatosAuto.length} | Grupos: ${gruposSelecionados?.length || 0}`
            );

            // ✅ DEDUPLICAR contatos usando Set para evitar mensagens duplicadas
            const contatosBrutos = [...contatosManuais, ...contatosAuto];
            const contatosUnicos = [...new Set(contatosBrutos.map(p => p.replace(/\D/g, '')))];
            console.log(`📱 [AFILIADO] Verificando ${contatosUnicos.length} contatos únicos (${contatosBrutos.length} brutos)`);

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

            let enviadosGrupos = 0;
            let errosGrupos = 0;

            // ✅ ENVIAR PARA GRUPOS (1x por grupo com deduplicação PERSISTENTE no banco)
            if ((gruposSelecionados || []).length > 0) {
              for (const g of (gruposSelecionados || [])) {
                // ✅ DEDUPLICAÇÃO LOCAL: verificar cache em memória (30s)
                const now = Date.now();
                const lastSend = recentGroupSends.get(g.group_jid) || 0;
                if (now - lastSend < 30000) {
                  console.log(`⏭️ [AFILIADO] Grupo ${g.group_name} já recebeu mensagem há ${Math.round((now - lastSend) / 1000)}s, pulando...`);
                  continue;
                }
                
                // ✅ DEDUPLICAÇÃO PERSISTENTE: verificar no banco se já enviamos nos últimos 2 min
                const twoMinutesAgo = new Date(Date.now() - 120000).toISOString();
                const { data: recentEnvio } = await supabase
                  .from('historico_envios')
                  .select('timestamp')
                  .eq('whatsapp', g.group_jid)
                  .eq('tipo', 'grupo')
                  .gte('timestamp', twoMinutesAgo)
                  .limit(1);
                
                if (recentEnvio && recentEnvio.length > 0) {
                  console.log(`⏭️ [AFILIADO] Grupo ${g.group_name} já recebeu mensagem nos últimos 2min (DB), pulando...`);
                  continue;
                }
                
                // Marcar cache local ANTES de enviar (evita race condition entre abas)
                
                // Marcar como enviado ANTES de enviar (evita race condition)
                recentGroupSends.set(g.group_jid, now);
                
                try {
                // Formatar preço corretamente (Shopee usa ponto como separador de milhar)
                const precoFormatado = produto?.preco 
                  ? formatarPrecoAfiliado(produto.preco)
                  : 'Consulte';

                const mensagemGrupo = campanha.mensagem_template
                    .replace(/\{\{nome\}\}/gi, 'pessoal')
                    .replace(/\{\{produto\}\}/gi, produto?.titulo || 'Produto')
                    .replace(/\{\{preco\}\}/gi, precoFormatado);

                  console.log(`👥 [AFILIADO] Enviando para grupo ${g.group_name}...`);

                  const { data: groupData, error: groupErr } = await supabase.functions.invoke(
                    'send-wuzapi-group-message',
                    {
                      body: {
                        groupJid: g.group_jid,
                        message: mensagemGrupo,
                        imageUrl,
                        userId,
                      },
                    }
                  );

                  if (groupErr || !groupData?.success) {
                    errosGrupos++;
                    console.error('❌ [AFILIADO] Falha ao enviar para grupo:', groupErr || groupData);
                    // Remover do cache se falhou (permite retry)
                    recentGroupSends.delete(g.group_jid);
                  } else {
                    enviadosGrupos++;
                    console.log('✅ [AFILIADO] Grupo enviado:', g.group_name);
                  }

                  // Delay curto entre grupos
                  await new Promise((r) => setTimeout(r, 500));
                } catch (e) {
                  errosGrupos++;
                  console.error('❌ [AFILIADO] Erro ao enviar para grupo:', e);
                  recentGroupSends.delete(g.group_jid);
                }
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

                // Formatar preço corretamente
                const precoFormatadoContato = produto?.preco 
                  ? formatarPrecoAfiliado(produto.preco)
                  : 'Consulte';

                // Personalizar mensagem
                const mensagem = campanha.mensagem_template
                  .replace(/\{\{nome\}\}/gi, nome)
                  .replace(/\{\{produto\}\}/gi, produto?.titulo || 'Produto')
                  .replace(/\{\{preco\}\}/gi, precoFormatadoContato);

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
                        .update({ ativa: false })
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

                // Delay FIXO (mais rápido) entre mensagens
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
                  ativa: proximaExec ? true : false,
                })
                .eq('id', campanha.id);

            console.log(`📅 [AFILIADO] Próxima execução: ${proximaExec ? new Date(proximaExec).toLocaleString('pt-BR') : 'Não repete'}`);

          } catch (err) {
            console.error(`❌ [AFILIADO] Erro na campanha ${campanha.nome}:`, err);
            // Evita ficar preso caso dê erro no meio
            await supabase
              .from('afiliado_campanhas')
              .update({ updated_at: new Date().toISOString() })
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
