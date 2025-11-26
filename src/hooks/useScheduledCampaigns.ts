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

                  // Salvar contexto
                  await supabase.from('whatsapp_conversations').upsert({
                    user_id: userId,
                    phone_number: phone,
                    metadata: {
                      last_product_sent: campanha.produto_id,
                      produto_nome: campanha.produtos.nome,
                      produto_preco: campanha.produtos.preco,
                      produto_descricao: campanha.produtos.descricao
                    }
                  }, {
                    onConflict: 'user_id,phone_number'
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
  const horario = campanha.horarios?.[0] || '09:00';
  const [hora, minuto] = horario.split(':').map(Number);

  if (campanha.frequencia === 'uma_vez') {
    return null;
  }

  if (campanha.frequencia === 'diario') {
    const proxima = new Date();
    proxima.setDate(proxima.getDate() + 1);
    proxima.setHours(hora, minuto, 0, 0);
    return proxima.toISOString();
  }

  if (campanha.frequencia === 'semanal') {
    const proxima = new Date();
    const diasValidos = campanha.dias_semana || [];

    do {
      proxima.setDate(proxima.getDate() + 1);
    } while (!diasValidos.includes(proxima.getDay()));

    proxima.setHours(hora, minuto, 0, 0);
    return proxima.toISOString();
  }

  return null;
}
