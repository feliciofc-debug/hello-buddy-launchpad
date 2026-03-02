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

        console.log(`📋 Encontradas ${campanhas?.length || 0} campanhas para executar`);

        if (!campanhas || campanhas.length === 0) {
          isExecuting.current = false;
          return;
        }

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
            console.log(`📱 Verificando ${contatos.length} contatos`);

            let enviados = 0;
            let pulados = 0;

            // ENVIAR PARA CADA CONTATO
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

                console.log(`✅ Verificações OK - Enviando para ${phone}`);

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

                 // ENVIAR via função PJ (Locaweb)
                 const { data: sendData, error: sendError } = await supabase.functions.invoke('send-wuzapi-message-pj', {
                   body: {
                     phoneNumbers: [phone],
                     message: mensagem,
                     imageUrl: campanha.produtos.imagem_url,
                     userId: userId,
                   },
                 });

                 // IMPORTANT: supabase.functions.invoke só falha (sendError) se a função retornar HTTP não-2xx.
                 // A função pode retornar 200 com results[0].success = false. Precisamos tratar isso.
                 const firstResult = Array.isArray((sendData as any)?.results) ? (sendData as any).results[0] : null;
                 const envioOk = !sendError && (firstResult ? firstResult.success === true : true);
                 const erroDetalhado =
                   sendError?.message ||
                   firstResult?.error ||
                   (firstResult?.response?.error ? String(firstResult.response.error) : null) ||
                   (!envioOk ? 'Falha no envio (retorno da função)' : null);

                 if (!envioOk) {
                   console.error('❌ Envio falhou para', phone, { sendError, firstResult, sendData });
                   await registrarEnvio(phone, 'campanha', mensagem, false, erroDetalhado || 'Erro no envio');
                   pulados++;
                   continue;
                 }

                 enviados++;

                 // ✅ REGISTRAR ENVIO NO HISTÓRICO (para cooldown)
                 await registrarEnvio(phone, 'campanha', mensagem, true);

                 // ✅ MARCAR CAMPANHA ATIVA PARA ESTE CLIENTE
                 await supabase.from('campanhas_ativas').insert({
                   cliente_id: null,
                   whatsapp: phone,
                   tipo: 'produto',
                   mensagem: mensagem.substring(0, 500),
                   aguardando_resposta: true,
                   pausado: false,
                 });

                 // ✅ REGISTRAR ENVIO PARA EVITAR DUPLICATAS
                 await supabase.from('mensagens_enviadas').insert({
                   phone: phone,
                   message: mensagem,
                   user_id: userId,
                   lead_tipo: 'campanha',
                   // Se existir coluna, fica registrado para auditoria (se não existir, o PostgREST ignora e vai dar erro).
                   // Mantemos apenas em memória aqui via log; se você quiser persistir de forma garantida, criamos uma coluna dedicada.
                 });

                 // Salvar contexto COMPLETO do produto para IA (TODOS OS CAMPOS)
                 const { data: userData } = await supabase.auth.getUser();
                 const vendedorNome = userData?.user?.user_metadata?.full_name || 'Vendedor';

                 await supabase.from('whatsapp_conversations').upsert({
                   user_id: userId,
                   phone_number: phone,
                   origem: 'campanha',
                   vendedor_id: campanha.vendedor_id || null,
                   contact_name: nome,
                   metadata: {
                     produto_id: campanha.produtos.id,
                     produto_nome: campanha.produtos.nome,
                     produto_descricao: campanha.produtos.descricao,
                     produto_preco: campanha.produtos.preco,
                     produto_estoque: campanha.produtos.estoque || 0,
                     produto_especificacoes: campanha.produtos.especificacoes || '',
                     produto_categoria: campanha.produtos.categoria,
                     produto_sku: campanha.produtos.sku,
                     produto_tags: campanha.produtos.tags,
                     produto_imagens: campanha.produtos.imagens || [],
                     produto_imagem_url: campanha.produtos.imagem_url,
                     link_marketplace: campanha.produtos.link_marketplace || '',
                     link_produto: campanha.produtos.link,
                     vendedor_nome: vendedorNome,
                     data_envio: new Date().toISOString(),
                   },
                 }, {
                   onConflict: 'user_id,phone_number',
                 });

                 // Salvar mensagem no histórico com origem
                 await supabase.from('whatsapp_messages').insert({
                   user_id: userId,
                   phone: phone,
                   direction: 'sent',
                   message: mensagem,
                   origem: 'campanha',
                 });

                // Delay aleatório 5-8 segundos (compliance Meta)
                const delayMs = Math.floor(Math.random() * 3000) + 5000;
                await new Promise(r => setTimeout(r, delayMs));

              } catch (err) {
                console.error(`Erro ao enviar para ${phone}:`, err);
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
