import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { campaign_id } = await req.json()
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    console.log('⚡ Executando campanha:', campaign_id)

    // Buscar campanha
    const { data: campanha, error: campError } = await supabase
      .from('campanhas_recorrentes')
      .select(`
        *,
        produtos (
          id, nome, descricao, preco, imagens
        )
      `)
      .eq('id', campaign_id)
      .single()

    if (campError || !campanha) {
      throw new Error('Campanha não encontrada: ' + campError?.message)
    }

    console.log('📋 Campanha encontrada:', campanha.nome)

    // Buscar contatos das listas
    const { data: listas, error: listasError } = await supabase
      .from('whatsapp_groups')
      .select('phone_numbers, group_name')
      .in('id', campanha.listas_ids || [])

    if (listasError) {
      console.error('Erro ao buscar listas:', listasError)
    }

    const contatos = listas?.flatMap(l => l.phone_numbers || []) || []
    console.log(`📱 Enviando para ${contatos.length} contatos`)

    let enviados = 0
    let erros = 0

    // ENVIAR PARA CADA CONTATO
    for (const phone of contatos) {
      try {
        // Buscar nome
        const { data: contact } = await supabase
          .from('whatsapp_contacts')
          .select('name')
          .eq('phone', phone)
          .eq('user_id', campanha.user_id)
          .maybeSingle()

        const nome = contact?.name || 'Cliente'

        // Personalizar mensagem
        const mensagem = campanha.mensagem_template
          .replace(/\{\{nome\}\}/gi, nome)
          .replace(/\{\{produto\}\}/gi, campanha.produtos?.nome || '')
          .replace(/\{\{preco\}\}/gi, campanha.produtos?.preco?.toString() || '0')

        console.log(`📤 Enviando para ${phone} (${nome})`)

        // ENVIAR VIA WUZAPI-PJ - usa instância correta do cliente PJ
        const { data: sendResult, error: sendError } = await supabase.functions.invoke('send-wuzapi-message-pj', {
          body: {
            phoneNumbers: [phone],
            message: mensagem,
            imageUrl: campanha.produtos?.imagens?.[0],
            userId: campanha.user_id,
            skipProtection: true
          }
        })

        if (!sendError && sendResult?.success) {
          enviados++
          console.log(`✅ Enviado para ${phone}`)
          
          // Salvar contexto para IA responder automaticamente
          await supabase.from('whatsapp_conversations').upsert({
            user_id: campanha.user_id,
            phone_number: phone,
            origem: 'campanha',
            status: 'active',
            metadata: {
              produto_nome: campanha.produtos?.nome,
              produto_preco: campanha.produtos?.preco,
              produto_descricao: campanha.produtos?.descricao,
              produto_estoque: campanha.produtos?.estoque || 10,
              link_marketplace: campanha.produtos?.link_marketplace,
              campanha_id: campanha.id
            },
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'user_id,phone_number'
          })
          
        } else {
          console.error(`❌ Erro ao enviar para ${phone}:`, sendError || sendResult)
          erros++
        }

        // Delay aleatório entre 3-7 segundos (simula comportamento humano)
        const delay = Math.floor(Math.random() * (7000 - 3000 + 1)) + 3000;
        console.log(`⏱️ Aguardando ${delay}ms antes do próximo envio...`);
        await new Promise(r => setTimeout(r, delay))

      } catch (err) {
        console.error(`❌ Erro ao processar ${phone}:`, err)
        erros++
      }
    }

    console.log(`✅ Enviados: ${enviados}/${contatos.length}, Erros: ${erros}`)

    // CALCULAR PRÓXIMA EXECUÇÃO
    const proximaExec = calcularProxima(campanha)

    // ATUALIZAR CAMPANHA
    const { error: updateError } = await supabase
      .from('campanhas_recorrentes')
      .update({
        ultima_execucao: new Date().toISOString(),
        proxima_execucao: proximaExec,
        total_enviados: (campanha.total_enviados || 0) + enviados,
        ativa: proximaExec ? true : false, // Desativa se não tem próxima
        status: proximaExec ? 'ativa' : 'encerrada'
      })
      .eq('id', campaign_id)

    if (updateError) {
      console.error('Erro ao atualizar campanha:', updateError)
    }

    console.log(`📅 Próxima execução:`, proximaExec || 'Não repetirá')

    return new Response(
      JSON.stringify({ 
        success: true, 
        enviados,
        erros,
        total: contatos.length,
        proxima_execucao: proximaExec,
        campanha_nome: campanha.nome
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Erro geral:', error)
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        success: false 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

function calcularProxima(campanha: any): string | null {
  const agora = new Date()
  const horarios = campanha.horarios || ['09:00']
  
  // Ordenar horários
  const horariosOrdenados = [...horarios].sort()
  
  if (campanha.frequencia === 'uma_vez') {
    return null // Não repete
  }

  // Hora atual em formato HH:MM
  const horaAtual = agora.toTimeString().slice(0, 5)
  
  // NOVO: Verificar se há mais horários HOJE
  const proximoHorarioHoje = horariosOrdenados.find((h: string) => h > horaAtual)
  
  if (proximoHorarioHoje) {
    // Se campanha é semanal, verificar se hoje é um dia válido
    if (campanha.frequencia === 'semanal') {
      const diasValidos = campanha.dias_semana || []
      if (!diasValidos.includes(agora.getDay())) {
        // Hoje não é válido, ir para próximo dia
        return calcularProximoDia(campanha, horariosOrdenados[0])
      }
    }
    
    // Ainda há horário hoje
    const [hora, minuto] = proximoHorarioHoje.split(':').map(Number)
    const proxima = new Date()
    proxima.setHours(hora, minuto, 0, 0)
    console.log(`📅 Próximo horário HOJE: ${proximoHorarioHoje}`)
    return proxima.toISOString()
  }

  // Não há mais horários hoje, calcular próximo dia
  return calcularProximoDia(campanha, horariosOrdenados[0])
}

function calcularProximoDia(campanha: any, primeiroHorario: string): string | null {
  const [hora, minuto] = primeiroHorario.split(':').map(Number)
  
  if (campanha.frequencia === 'diario') {
    const proxima = new Date()
    proxima.setDate(proxima.getDate() + 1)
    proxima.setHours(hora, minuto, 0, 0)
    return proxima.toISOString()
  }

  if (campanha.frequencia === 'semanal') {
    const proxima = new Date()
    const diasValidos = campanha.dias_semana || []
    
    // Avançar até encontrar próximo dia válido
    let tentativas = 0
    do {
      proxima.setDate(proxima.getDate() + 1)
      tentativas++
    } while (!diasValidos.includes(proxima.getDay()) && tentativas < 8)
    
    proxima.setHours(hora, minuto, 0, 0)
    return proxima.toISOString()
  }

  return null
}
