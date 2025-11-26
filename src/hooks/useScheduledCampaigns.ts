import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useScheduledCampaigns(userId: string | undefined) {
  useEffect(() => {
    if (!userId) return;

    console.log('🔄 Iniciando verificador de campanhas');

    const checkAndExecute = async () => {
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

        console.log(`📋 Encontradas ${campanhas?.length || 0} campanhas para executar`);

        if (!campanhas || campanhas.length === 0) return;

        // EXECUTAR CADA CAMPANHA
        for (const campanha of campanhas) {
          console.log(`🚀 Executando: ${campanha.nome}`);
          
          toast.info(`🚀 Executando campanha: ${campanha.nome}`);

          try {
            // Buscar contatos
            const { data: listas } = await supabase
              .from('whatsapp_groups')
              .select('phone_numbers, group_name')
              .in('id', campanha.listas_ids || []);

            const contatos = listas?.flatMap(l => l.phone_numbers || []) || [];
            console.log(`📱 Enviando para ${contatos.length} contatos`);

            let enviados = 0;

            // ENVIAR PARA CADA CONTATO
            for (const phone of contatos) {
              try {
                // Buscar nome
                const { data: contact } = await supabase
                  .from('whatsapp_contacts')
                  .select('nome')
                  .eq('phone', phone)
                  .maybeSingle();

                const nome = contact?.nome || 'Cliente';

                // Personalizar mensagem
                const mensagem = campanha.mensagem_template
                  .replace(/\{\{nome\}\}/gi, nome)
                  .replace(/\{\{produto\}\}/gi, campanha.produtos.nome)
                  .replace(/\{\{preco\}\}/gi, campanha.produtos.preco?.toString() || '0');

                // ENVIAR
                const { error: sendError } = await supabase.functions.invoke('send-wuzapi-message', {
                  body: {
                    phoneNumbers: [phone],
                    message: mensagem,
                    imageUrl: campanha.produtos.imagem_url
                  }
                });

                if (!sendError) {
                  enviados++;

                  // Salvar contexto COMPLETO do produto para IA
                  const { data: userData } = await supabase.auth.getUser();
                  const vendedorNome = userData?.user?.user_metadata?.full_name || 'Vendedor';

                  await supabase.from('whatsapp_conversations').upsert({
                    user_id: userId,
                    phone_number: phone,
                    origem: 'campanha', // ← MARCAR COMO CAMPANHA
                    last_message_context: {
                      produto_nome: campanha.produtos.nome,
                      produto_descricao: campanha.produtos.descricao,
                      produto_preco: campanha.produtos.preco,
                      produto_estoque: campanha.produtos.estoque || 0,
                      produto_especificacoes: campanha.produtos.especificacoes || '',
                      produto_imagens: campanha.produtos.imagens || [],
                      link_marketplace: campanha.produtos.link_marketplace || '',
                      vendedor_nome: vendedorNome,
                      data_envio: new Date().toISOString()
                    }
                  }, {
                    onConflict: 'user_id,phone_number'
                  });

                  // Salvar mensagem no histórico com origem
                  await supabase.from('whatsapp_messages').insert({
                    user_id: userId,
                    phone: phone,
                    direction: 'sent',
                    message: mensagem,
                    origem: 'campanha' // ← MARCAR COMO CAMPANHA
                  });
                }

                await new Promise(r => setTimeout(r, 500));

              } catch (err) {
                console.error(`Erro ao enviar para ${phone}:`, err);
              }
            }

            console.log(`✅ Campanha ${campanha.nome}: ${enviados}/${contatos.length} enviados`);
            toast.success(`✅ Campanha enviada para ${enviados} contatos!`);

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
