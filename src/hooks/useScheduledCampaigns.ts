import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const COOLDOWN_MINUTOS = 5;
const TEMPO_SESSAO_MINUTOS = 60;

/**
 * Verifica se cliente tem sessão ativa (interagiu recentemente)
 */
async function verificarSessaoAtiva(whatsapp: string): Promise<boolean> {
  const tempoLimite = new Date(Date.now() - TEMPO_SESSAO_MINUTOS * 60000).toISOString();
  
  const { data, error } = await supabase
    .from('sessoes_ativas')
    .select('*')
    .eq('whatsapp', whatsapp)
    .eq('ativa', true)
    .gte('ultima_interacao', tempoLimite)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    console.error('Erro ao verificar sessão:', error);
    return false;
  }

  return !!data;
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
 * Verifica se cliente tem campanha ativa RECENTE (< 60 minutos)
 * Campanhas antigas são ignoradas para não bloquear novos envios
 */
async function temCampanhaAtiva(whatsapp: string): Promise<boolean> {
  // Só considera campanhas ativas criadas nas últimas 1 hora
  const limiteAntiguidade = new Date(Date.now() - 60 * 60000).toISOString();
  
  const { data, error } = await supabase
    .from('campanhas_ativas')
    .select('id')
    .eq('whatsapp', whatsapp)
    .eq('aguardando_resposta', true)
    .eq('pausado', false)
    .gte('created_at', limiteAntiguidade)
    .limit(1)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    console.error('Erro ao verificar campanha:', error);
    return false;
  }

  return !!data;
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
      mensagem: mensagem.substring(0, 500), // Limitar tamanho
      sucesso,
      erro: erro || null,
      timestamp: new Date().toISOString()
    });

  if (error) {
    console.error('Erro ao registrar envio:', error);
  }
}

export function useScheduledCampaigns(userId: string | undefined) {
  // Lock para evitar execuções duplicadas
  const isExecuting = useRef(false);
  const lastExecutionTime = useRef<number>(0);

  useEffect(() => {
    if (!userId) return;

    console.log('🔄 Iniciando verificador de campanhas');

    const checkAndExecute = async () => {
      // Evitar execução se já está executando
      if (isExecuting.current) {
        console.log('⏳ Execução já em andamento, pulando...');
        return;
      }

      // Evitar execução se última foi há menos de 30 segundos
      const now = Date.now();
      if (now - lastExecutionTime.current < 30000) {
        console.log('⏳ Última execução muito recente, pulando...');
        return;
      }

      isExecuting.current = true;
      lastExecutionTime.current = now;

      try {
        const agora = new Date();
        console.log('⏰ Verificando campanhas:', agora.toLocaleString('pt-BR'));

        // Buscar campanhas que devem executar AGORA
        const { data: campanhas, error } = await supabase
          .from('campanhas_recorrentes')
          .select(`
            *,
            produtos (*)
          `)
          .eq('user_id', userId)
          .eq('ativa', true)
          .lte('proxima_execucao', agora.toISOString());

        if (error) throw error;

        // ✅ FILTRAR: ignorar campanhas que a edge function já executou nos últimos 3 minutos
        const campanhasFiltradas = (campanhas || []).filter(c => {
          if (c.ultima_execucao) {
            const diffMs = agora.getTime() - new Date(c.ultima_execucao).getTime();
            if (diffMs < 3 * 60 * 1000) {
              console.log(`⏭️ Campanha ${c.nome} já executada há ${Math.floor(diffMs/1000)}s pela edge function, pulando`);
              return false;
            }
          }
          return true;
        });

        console.log(`📋 Encontradas ${campanhasFiltradas.length} campanhas para executar (${(campanhas?.length || 0) - campanhasFiltradas.length} já executadas pela edge function)`);

        if (campanhasFiltradas.length === 0) {
          isExecuting.current = false;
          return;
        }

        // EXECUTAR CADA CAMPANHA
        for (const campanha of campanhasFiltradas) {
          console.log(`🚀 Executando: ${campanha.nome}`);
          
          toast.info(`🚀 Executando campanha: ${campanha.nome}`);

          try {
            // Buscar contatos
            const { data: listas } = await supabase
              .from('whatsapp_groups')
              .select('phone_numbers, group_name')
              .in('id', campanha.listas_ids || []);

            // ✅ DEDUPLICAR contatos para não enviar repetido ao mesmo número
            const contatosRaw = listas?.flatMap(l => l.phone_numbers || []) || [];
            const contatos = [...new Set(contatosRaw)];
            console.log(`📱 Verificando ${contatos.length} contatos únicos (${contatosRaw.length} antes de dedup)`);

            let enviados = 0;
            let pulados = 0;
            const contatosParaFila: Array<{
              phone: string;
              name: string;
              mensagem: string;
              imagem_url: string | null;
              tipo_mensagem: string;
              prioridade: number;
              lead_source: string;
              campanha_id: string;
              scheduled_at: string;
              metadata: any;
            }> = [];

            // ENFILEIRAR PARA CADA CONTATO (NÃO ENVIAR DIRETO DO NAVEGADOR)
            for (const phone of contatos) {
              try {
                // ✅ PROTEÇÃO 1: VERIFICAR SESSÃO ATIVA
                const sessaoAtiva = await verificarSessaoAtiva(phone);

                if (sessaoAtiva) {
                  console.log(`⏸️ SESSÃO ATIVA - Pulando ${phone} (em conversa)`);
                  pulados++;
                  continue;
                }

                // ✅ PROTEÇÃO 2: VERIFICAR COOLDOWN (5 minutos)
                const podEnviar = await verificarCooldown(phone);

                if (!podEnviar) {
                  console.log(`⏰ COOLDOWN - Pulando ${phone} (última msg < 5min)`);
                  pulados++;
                  continue;
                }

                // ✅ PROTEÇÃO 3: VERIFICAR CAMPANHA ATIVA
                const campanhaAtiva = await temCampanhaAtiva(phone);

                if (campanhaAtiva) {
                  console.log(`📋 CAMPANHA ATIVA - Pulando ${phone} (já tem campanha)`);
                  pulados++;
                  continue;
                }

                console.log(`✅ Verificações OK - Enfileirando ${phone}`);

                const { data: contact } = await supabase
                  .from('whatsapp_contacts')
                  .select('nome')
                  .eq('user_id', userId)
                  .eq('phone', phone)
                  .maybeSingle();

                const nome = contact?.nome || 'Cliente';
                const mensagem = campanha.mensagem_template
                  .replace(/\{\{nome\}\}/gi, nome)
                  .replace(/\{\{produto\}\}/gi, campanha.produtos?.nome || 'Produto')
                  .replace(/\{\{preco\}\}/gi, campanha.produtos?.preco?.toString() || '0');

                contatosParaFila.push({
                  phone,
                  name: nome,
                  mensagem,
                  imagem_url: campanha.produtos?.imagem_url || null,
                  tipo_mensagem: 'campanha',
                  prioridade: 5,
                  scheduled_at: new Date().toISOString(),
                  lead_source: 'campanha_produtos',
                  campanha_id: campanha.id,
                  metadata: {
                    produto_id: campanha.produtos?.id || null,
                    produto_nome: campanha.produtos?.nome || null,
                    produto_preco: campanha.produtos?.preco || null,
                    vendedor_id: campanha.vendedor_id || null,
                    origem: 'scheduler_browser_fallback',
                  },
                });
              } catch (err) {
                console.error(`Erro ao preparar fila para ${phone}:`, err);
              }
            }

            if (contatosParaFila.length > 0) {
              const { data: rpcData, error: filaError } = await supabase.rpc('inserir_campanha_fila', {
                p_user_id: userId,
                p_contatos: contatosParaFila,
                p_mensagem: campanha.mensagem_template,
                p_lead_source: 'campanha_produtos',
                p_campanha_id: campanha.id,
                p_imagem_url: campanha.produtos?.imagem_url || null,
                p_tipo_mensagem: 'campanha',
                p_prioridade: 5,
                p_metadata: {
                  produto_id: campanha.produtos?.id || null,
                  produto_nome: campanha.produtos?.nome || null,
                  produto_preco: campanha.produtos?.preco || null,
                  vendedor_id: campanha.vendedor_id || null,
                  origem: 'scheduler_browser_fallback',
                },
                p_scheduled_at: new Date().toISOString(),
              });

              if (filaError) {
                console.error('❌ Erro ao inserir campanha na fila:', filaError);
                toast.error(`Erro ao enfileirar campanha ${campanha.nome}`);
                continue;
              }

              enviados = Number((rpcData as { inseridos?: number } | null)?.inseridos ?? 0);

              const falhasRpc = Number((rpcData as { falhas?: number } | null)?.falhas ?? 0);
              if (falhasRpc > 0) {
                console.warn(`⚠️ ${falhasRpc} contato(s) falharam ao enfileirar na campanha ${campanha.nome}`);
              }
            }

            console.log(`✅ Campanha ${campanha.nome}: ${enviados}/${contatos.length} enviados (${pulados} pulados)`);

            // ✅ CRÍTICO: NÃO marcar como executada se NENHUMA mensagem foi enviada
            if (enviados === 0 && contatos.length > 0) {
              console.warn(`⚠️ Campanha ${campanha.nome} - NENHUM envio bem-sucedido! NÃO atualizando ultima_execucao para permitir retry`);
              toast.error(`⚠️ Campanha ${campanha.nome}: falha no envio (sessão desconectada?)`);
              continue; // Pula para próxima campanha sem atualizar
            }

            toast.success(`✅ Campanha: ${enviados} enviados, ${pulados} protegidos`);

            // CALCULAR PRÓXIMA EXECUÇÃO
            const proximaExec = calcularProxima(campanha);

            // ATUALIZAR CAMPANHA
            await supabase
              .from('campanhas_recorrentes')
              .update({
                ultima_execucao: agora.toISOString(),
                proxima_execucao: proximaExec,
                total_enviados: (campanha.total_enviados || 0) + enviados,
                ativa: proximaExec ? true : false
              })
              .eq('id', campanha.id);

            console.log(`📅 Próxima execução: ${proximaExec ? new Date(proximaExec).toLocaleString('pt-BR') : 'Não repete'}`);

          } catch (err) {
            console.error(`❌ Erro na campanha ${campanha.nome}:`, err);
            toast.error(`Erro na campanha ${campanha.nome}`);
          }
        }

      } catch (error) {
        console.error('❌ Erro ao verificar campanhas:', error);
      } finally {
        isExecuting.current = false;
      }
    };

    // EXECUTAR IMEDIATAMENTE
    checkAndExecute();

    // EXECUTAR A CADA 1 MINUTO
    const interval = setInterval(checkAndExecute, 60 * 1000);

    return () => clearInterval(interval);

  }, [userId]);
}

function calcularProxima(campanha: any): string | null {
  const agora = new Date();
  const horarios = campanha.horarios || ['09:00'];

  if (campanha.frequencia === 'uma_vez') {
    // Verificar se ainda tem horários pendentes HOJE
    const dataInicio = new Date(campanha.data_inicio);
    
    if (dataInicio.toDateString() === agora.toDateString()) {
      // Procurar próximo horário que ainda não passou
      for (const horario of horarios) {
        const [hora, minuto] = horario.split(':').map(Number);
        const proximaExec = new Date();
        proximaExec.setHours(hora, minuto, 0, 0);
        
        if (proximaExec > agora) {
          console.log(`⏰ Próximo horário hoje: ${proximaExec.toLocaleString('pt-BR')}`);
          return proximaExec.toISOString();
        }
      }
    }
    
    return null; // Todos horários já passaram
  }

  if (campanha.frequencia === 'diario') {
    // Verificar se ainda tem horários pendentes HOJE
    for (const horario of horarios) {
      const [hora, minuto] = horario.split(':').map(Number);
      const proximaExec = new Date();
      proximaExec.setHours(hora, minuto, 0, 0);
      
      if (proximaExec > agora) {
        console.log(`⏰ Próximo horário hoje: ${proximaExec.toLocaleString('pt-BR')}`);
        return proximaExec.toISOString();
      }
    }
    
    // Se todos horários de hoje já passaram, vai pro primeiro horário de amanhã
    const [hora, minuto] = horarios[0].split(':').map(Number);
    const amanha = new Date();
    amanha.setDate(amanha.getDate() + 1);
    amanha.setHours(hora, minuto, 0, 0);
    console.log(`📅 Próximo horário amanhã: ${amanha.toLocaleString('pt-BR')}`);
    return amanha.toISOString();
  }

  if (campanha.frequencia === 'semanal') {
    const diasValidos = campanha.dias_semana || [];
    
    // Verificar se HOJE é dia válido e tem horários pendentes
    if (diasValidos.includes(agora.getDay())) {
      for (const horario of horarios) {
        const [hora, minuto] = horario.split(':').map(Number);
        const proximaExec = new Date();
        proximaExec.setHours(hora, minuto, 0, 0);
        
        if (proximaExec > agora) {
          console.log(`⏰ Próximo horário hoje: ${proximaExec.toLocaleString('pt-BR')}`);
          return proximaExec.toISOString();
        }
      }
    }
    
    // Procurar próximo dia válido
    const proxima = new Date();
    do {
      proxima.setDate(proxima.getDate() + 1);
    } while (!diasValidos.includes(proxima.getDay()));
    
    const [hora, minuto] = horarios[0].split(':').map(Number);
    proxima.setHours(hora, minuto, 0, 0);
    console.log(`📅 Próximo dia válido: ${proxima.toLocaleString('pt-BR')}`);
    return proxima.toISOString();
  }

  return null;
}
