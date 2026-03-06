import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// NOTA: enviarMensagemDireta removida - agora usa send-wuzapi-message-pj para retry, validação e resolução de instância

// Delay humanizado entre 3-7 segundos
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
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
          id, nome, descricao, preco, imagem_url, imagens
        )
      `)
      .eq('id', campaign_id)
      .single()

    if (campError || !campanha) {
      throw new Error('Campanha não encontrada: ' + campError?.message)
    }

    console.log('📋 Campanha encontrada:', campanha.nome)

    // Buscar contatos das listas
    const listasIds = campanha.listas_ids || []
    let contatos: string[] = []

    const { data: listas } = await supabase
      .from('whatsapp_groups')
      .select('phone_numbers, group_name')
      .in('id', listasIds)
    contatos.push(...(listas?.flatMap(l => l.phone_numbers || []) || []))

    const { data: membrosPJ } = await supabase
      .from('pj_lista_membros')
      .select('telefone')
      .in('lista_id', listasIds)
    contatos.push(...(membrosPJ?.map(m => m.telefone) || []))

    const { data: membrosAfiliado } = await supabase
      .from('afiliado_lista_membros')
      .select('lead_id')
      .in('lista_id', listasIds)
    if (membrosAfiliado && membrosAfiliado.length > 0) {
      const leadIds = membrosAfiliado.map((m: any) => m.lead_id)
      const { data: leads } = await supabase
        .from('leads_ebooks')
        .select('phone')
        .in('id', leadIds)
      contatos.push(...(leads?.map((l: any) => l.phone) || []))
    }

    // Deduplicar
    contatos = [...new Set(contatos)].filter(Boolean)
    console.log(`📱 Total: ${contatos.length} contatos (deduplicados)`)

    // Buscar instância WuzAPI do usuário
    let baseUrl = Deno.env.get('WUZAPI_URL') || 'https://wuzapi.amzofertas.com.br'
    let wuzapiToken = Deno.env.get('WUZAPI_TOKEN') || ''

    if (campanha.user_id) {
      const { data: config } = await supabase
        .from('pj_clientes_config')
        .select('wuzapi_token, wuzapi_port')
        .eq('user_id', campanha.user_id)
        .maybeSingle()

      if (config?.wuzapi_token) wuzapiToken = config.wuzapi_token

      const targetPort = Number(config?.wuzapi_port || 8080)
      const { data: instance } = await supabase
        .from('wuzapi_instances')
        .select('wuzapi_url, wuzapi_token')
        .eq('assigned_to_user', campanha.user_id)
        .eq('port', targetPort)
        .maybeSingle()

      if (instance?.wuzapi_url) {
        baseUrl = instance.wuzapi_url.replace(/\/+$/, '')
        console.log('📡 Usando instância:', baseUrl)
      }
      if (instance?.wuzapi_token) wuzapiToken = instance.wuzapi_token
    }

    const imageUrl = campanha.produtos?.imagem_url || campanha.produtos?.imagens?.[0]

    // ENVIAR UM POR UM via send-wuzapi-message-pj com personalização de nome
    let enviados = 0
    let erros = 0

    for (let i = 0; i < contatos.length; i++) {
      const phone = contatos[i]
      console.log(`📤 [${i + 1}/${contatos.length}] Enviando para ${phone}`)

      // Buscar nome do contato para personalizar
      const { data: contact } = await supabase
        .from('whatsapp_contacts')
        .select('nome')
        .eq('phone', phone)
        .eq('user_id', campanha.user_id)
        .maybeSingle()

      const nome = contact?.nome || 'Cliente'

      // Personalizar mensagem COM O NOME DO CONTATO
      const mensagemPersonalizada = campanha.mensagem_template
        .replace(/\{\{nome\}\}/gi, nome)
        .replace(/\{\{produto\}\}/gi, campanha.produtos?.nome || '')
        .replace(/\{\{preco\}\}/gi, campanha.produtos?.preco?.toString() || '0')

      // Enviar via send-wuzapi-message-pj (que já tem retry, validação e resolução de instância)
      const { data: sendResult, error: sendError } = await supabase.functions.invoke('send-wuzapi-message-pj', {
        body: {
          phoneNumbers: [phone],
          message: mensagemPersonalizada,
          imageUrl: imageUrl,
          userId: campanha.user_id,
          validateBeforeSend: false
        }
      })

      const firstResult = Array.isArray(sendResult?.results) ? sendResult.results[0] : null
      const ok = !sendError && (firstResult ? firstResult.success === true : sendResult?.success !== false)

      if (ok) {
        enviados++
        console.log(`✅ Enviado para ${phone} (nome: ${nome})`)
      } else {
        erros++
        console.log(`❌ Falhou para ${phone}:`, sendError || sendResult)
      }

      // Delay humanizado entre mensagens (3-7s) - exceto na última
      if (i < contatos.length - 1) {
        const delayMs = 3000 + Math.random() * 4000
        await delay(delayMs)
      }
    }

    console.log(`✅ Resultado: ${enviados}/${contatos.length} enviados, ${erros} erros`)

    // Salvar contexto para IA responder
    for (const phone of contatos) {
      try {
        await supabase.from('whatsapp_conversations').upsert({
          user_id: campanha.user_id,
          phone_number: phone,
          origem: 'campanha',
          status: 'active',
          metadata: {
            produto_nome: campanha.produtos?.nome,
            produto_preco: campanha.produtos?.preco,
            campanha_id: campanha.id
          },
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,phone_number'
        })
      } catch (_) { /* ignorar */ }
    }

    // Calcular próxima execução
    const proximaExec = calcularProxima(campanha)

    // Atualizar campanha
    await supabase
      .from('campanhas_recorrentes')
      .update({
        ultima_execucao: new Date().toISOString(),
        proxima_execucao: proximaExec,
        total_enviados: (campanha.total_enviados || 0) + enviados,
        ativa: proximaExec ? true : false,
        status: proximaExec ? 'ativa' : 'encerrada'
      })
      .eq('id', campaign_id)

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
  const horariosOrdenados = [...horarios].sort()
  
  if (campanha.frequencia === 'uma_vez') return null

  const horaAtual = agora.toTimeString().slice(0, 5)
  const proximoHorarioHoje = horariosOrdenados.find((h: string) => h > horaAtual)
  
  if (proximoHorarioHoje) {
    if (campanha.frequencia === 'semanal') {
      const diasValidos = campanha.dias_semana || []
      if (!diasValidos.includes(agora.getDay())) {
        return calcularProximoDia(campanha, horariosOrdenados[0])
      }
    }
    const [hora, minuto] = proximoHorarioHoje.split(':').map(Number)
    const proxima = new Date()
    proxima.setHours(hora, minuto, 0, 0)
    return proxima.toISOString()
  }

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
