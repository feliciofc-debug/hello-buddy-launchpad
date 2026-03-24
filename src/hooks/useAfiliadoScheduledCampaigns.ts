import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * useAfiliadoScheduledCampaigns — QUEUE-ONLY
 * 
 * NÃO envia mensagens diretamente. Apenas insere na fila.
 * O gateway local (.exe) cuida do envio real via IP residencial.
 */

function formatarPrecoAfiliado(preco: number | string | null): string {
  if (preco == null) return 'Consulte';
  const precoNum = typeof preco === 'number' ? preco : parseFloat(String(preco).replace(',', '.'));
  if (isNaN(precoNum) || precoNum <= 0) return 'Consulte';
  
  let valor: number;
  const precoStr = precoNum.toString();
  if (precoStr.includes('.')) {
    const [inteiro, decimal] = precoStr.split('.');
    if (decimal && decimal.length === 3 && parseInt(inteiro) < 100) {
      valor = precoNum * 1000;
    } else {
      valor = precoNum;
    }
  } else {
    valor = precoNum;
  }
  
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Singleton para evitar múltiplas instâncias
const globalExecutingLock = { current: false };
const globalLastExecution = { current: 0 };
const executedCampaignsToday = new Set<string>();

export function useAfiliadoScheduledCampaigns(userId: string | undefined) {
  const isExecuting = useRef(false);

  useEffect(() => {
    if (!userId) return;

    console.log('🔄 [AFILIADO] Iniciando verificador de campanhas (QUEUE-ONLY)');

    const checkAndExecute = async () => {
      if (globalExecutingLock.current || isExecuting.current) return;

      const now = Date.now();
      if (now - globalLastExecution.current < 30000) return;

      globalExecutingLock.current = true;
      isExecuting.current = true;
      globalLastExecution.current = now;

      try {
        const agora = new Date();

        // Limpar campanhas executadas de dias anteriores
        const hoje = agora.toDateString();
        if (!executedCampaignsToday.has(`_date_${hoje}`)) {
          executedCampaignsToday.clear();
          executedCampaignsToday.add(`_date_${hoje}`);
        }

        // Buscar campanhas de AFILIADO que devem executar
        const { data: campanhas, error } = await supabase
          .from('afiliado_campanhas')
          .select(`*, afiliado_produtos (*)`)
          .eq('user_id', userId)
          .eq('ativa', true)
          .lte('proxima_execucao', agora.toISOString());

        if (error) throw error;

        // Filtrar campanhas já executadas nesta sessão
        const campanhasNaoExecutadas = (campanhas || []).filter(c => {
          const key = `${c.id}_${c.proxima_execucao}`;
          if (executedCampaignsToday.has(key)) return false;
          return true;
        });

        if (campanhasNaoExecutadas.length === 0) {
          globalExecutingLock.current = false;
          isExecuting.current = false;
          return;
        }

        console.log(`📋 [AFILIADO] ${campanhasNaoExecutadas.length} campanhas para inserir na fila`);

        for (const campanha of campanhasNaoExecutadas) {
          const campanhaKey = `${campanha.id}_${campanha.proxima_execucao}`;
          executedCampaignsToday.add(campanhaKey);

          console.log(`🚀 [AFILIADO] Processando: ${campanha.nome}`);

          try {
            const listasIds = (campanha as any).listas_ids || [];
            if (listasIds.length === 0) {
              console.log('⚠️ [AFILIADO] Campanha sem listas');
              toast.warning(`Campanha ${campanha.nome} não tem listas de transmissão`);
              continue;
            }

            const produto = campanha.afiliado_produtos;

            // Buscar contatos das listas
            const { data: listasManuais } = await supabase
              .from('whatsapp_groups')
              .select('phone_numbers, group_name')
              .in('id', listasIds);

            const { data: listasAuto } = await supabase
              .from('afiliado_lista_membros')
              .select('lead_id, lista_id, leads_ebooks(phone)')
              .in('lista_id', listasIds);

            const contatosManuais = listasManuais?.flatMap(l => l.phone_numbers || []) || [];
            const contatosAuto = listasAuto?.map(m => (m.leads_ebooks as any)?.phone).filter(Boolean) || [];

            // Deduplicar
            const contatosUnicos = [...new Set([...contatosManuais, ...contatosAuto].map(p => p.replace(/\D/g, '')))].filter(Boolean);
            
            console.log(`📱 [AFILIADO] ${contatosUnicos.length} contatos únicos`);

            if (contatosUnicos.length === 0) {
              console.log('⚠️ [AFILIADO] Nenhum contato encontrado');
              continue;
            }

            // Resolver imagem
            const rawImageUrl = produto?.imagem_url || null;
            let imageUrl: string | null = rawImageUrl;

            // Montar contatos para a RPC
            const contatosParaFila = contatosUnicos.map(phone => {
              const precoFormatado = produto?.preco ? formatarPrecoAfiliado(produto.preco) : 'Consulte';
              const mensagem = campanha.mensagem_template
                .replace(/\{\{nome\}\}/gi, 'Cliente')
                .replace(/\{\{produto\}\}/gi, produto?.titulo || 'Produto')
                .replace(/\{\{preco\}\}/gi, precoFormatado);

              return {
                phone,
                name: '',
                mensagem
              };
            });

            // ✅ INSERIR NA FILA VIA RPC — NÃO ENVIAR DIRETAMENTE
            console.log(`📝 [AFILIADO] Inserindo ${contatosParaFila.length} contatos na fila via RPC...`);

            const { data: rpcResult, error: rpcError } = await supabase.rpc('inserir_campanha_fila', {
              p_user_id: userId,
              p_contatos: contatosParaFila,
              p_mensagem: campanha.mensagem_template,
              p_imagem_url: imageUrl,
              p_lead_source: 'campanha_afiliado',
              p_campanha_id: null,
              p_metadata: {
                produto_id: produto?.id,
                produto_nome: produto?.titulo,
                produto_preco: produto?.preco,
                link_afiliado: produto?.link_afiliado,
                afiliado_campanha_id: campanha.id
              }
            });

            if (rpcError) {
              console.error('❌ [AFILIADO] Erro RPC:', rpcError);
              toast.error(`Erro na campanha ${campanha.nome}: ${rpcError.message}`);
              continue;
            }

            const inseridos = (rpcResult as any)?.inseridos || 0;
            console.log(`✅ [AFILIADO] ${inseridos} contatos inseridos na fila`);
            toast.success(`✅ Campanha ${campanha.nome}: ${inseridos} contatos na fila!`);

            // Buscar grupos WhatsApp reais para inserir também
            const { data: gruposSelecionados } = await supabase
              .from('whatsapp_grupos_afiliado')
              .select('id, group_jid, group_name')
              .eq('user_id', userId)
              .eq('ativo', true)
              .in('id', listasIds);

            if (gruposSelecionados && gruposSelecionados.length > 0) {
              const precoFormatado = produto?.preco ? formatarPrecoAfiliado(produto.preco) : 'Consulte';
              const mensagemGrupo = campanha.mensagem_template
                .replace(/\{\{nome\}\}/gi, 'pessoal')
                .replace(/\{\{produto\}\}/gi, produto?.titulo || 'Produto')
                .replace(/\{\{preco\}\}/gi, precoFormatado);

              const gruposParaFila = gruposSelecionados.map(g => ({
                phone: g.group_jid,
                name: g.group_name || '',
                mensagem: mensagemGrupo
              }));

              const { data: rpcGrupos, error: rpcGruposErr } = await supabase.rpc('inserir_campanha_fila', {
                p_user_id: userId,
                p_contatos: gruposParaFila,
                p_mensagem: mensagemGrupo,
                p_imagem_url: imageUrl,
                p_lead_source: 'campanha_afiliado_grupo',
                p_campanha_id: null,
                p_metadata: {
                  produto_id: produto?.id,
                  afiliado_campanha_id: campanha.id
                }
              });

              if (!rpcGruposErr && rpcGrupos) {
                console.log(`✅ [AFILIADO] ${(rpcGrupos as any).inseridos} grupos inseridos na fila`);
              }
            }

            // Calcular próxima execução
            const proximaExec = calcularProxima(campanha);

            // Atualizar campanha
            await supabase
              .from('afiliado_campanhas')
              .update({
                ultima_execucao: agora.toISOString(),
                proxima_execucao: proximaExec,
                total_enviados: (campanha.total_enviados || 0) + inseridos,
                ativa: proximaExec ? true : false,
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
        globalExecutingLock.current = false;
        isExecuting.current = false;
      }
    };

    checkAndExecute();
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
        if (proximaExec > agora) return proximaExec.toISOString();
      }
    }
    return null;
  }

  if (campanha.frequencia === 'diario') {
    for (const horario of horarios) {
      const [hora, minuto] = horario.split(':').map(Number);
      const proximaExec = new Date();
      proximaExec.setHours(hora, minuto, 0, 0);
      if (proximaExec > agora) return proximaExec.toISOString();
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
        if (proximaExec > agora) return proximaExec.toISOString();
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
