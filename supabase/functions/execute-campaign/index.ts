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

        // ENVIAR VIA WUZAPI
        const { error: sendError } = await supabase.functions.invoke('send-wuzapi-message', {
          body: {
            phoneNumbers: [phone],
            message: mensagem,
            imageUrl: campanha.produtos?.imagens?.[0]
          }
        })

        if (!sendError) {
          enviados++
          
          // Salvar contexto para IA
          await supabase.from('whatsapp_conversations').upsert({
            user_id: campanha.user_id,
            phone: phone,
            last_product_sent: campanha.produto_id,
            last_message_context: {
              produto_nome: campanha.produtos?.nome,
              produto_preco: campanha.produtos?.preco,
              produto_descricao: campanha.produtos?.descricao,
              campanha_id: campanha.id
            },
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'user_id,phone'
          })
        } else {
          console.error(`Erro ao enviar para ${phone}:`, sendError)
          erros++
        }

        // Delay entre envios
        await new Promise(r => setTimeout(r, 500))

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
  const horario = campanha.horarios?.[0] || '09:00'
  const [hora, minuto] = horario.split(':').map(Number)

  if (campanha.frequencia === 'uma_vez') {
    return null // Não repete
  }

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
    do {
      proxima.setDate(proxima.getDate() + 1)
    } while (!diasValidos.includes(proxima.getDay()))
    
    proxima.setHours(hora, minuto, 0, 0)
    return proxima.toISOString()
  }

  return null
}
