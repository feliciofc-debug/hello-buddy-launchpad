import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * execute-campaign — QUEUE-ONLY
 * 
 * NÃO envia mensagens. Apenas insere na fila_atendimento_pj.
 * O gateway local (.exe) cuida do envio real.
 */

function normalizePhone(phone: string): string {
  const digits = (phone || '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`
  }
  return digits
}

function buildPhoneVariants(phone: string): string[] {
  const normalized = normalizePhone(phone)
  if (!normalized) return []
  const withoutCountry = normalized.startsWith('55') ? normalized.slice(2) : normalized
  const variants = [normalized, withoutCountry]
  if (withoutCountry.length === 11 && withoutCountry[2] === '9') {
    variants.push(`55${withoutCountry.slice(0, 2)}${withoutCountry.slice(3)}`)
  } else if (withoutCountry.length === 10) {
    variants.push(`55${withoutCountry.slice(0, 2)}9${withoutCountry.slice(2)}`)
  }
  return [...new Set(variants.filter(Boolean))]
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

    console.log('⚡ Executando campanha (QUEUE-ONLY):', campaign_id)

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

    const imageUrl = campanha.produtos?.imagem_url || campanha.produtos?.imagens?.[0]

    // Buscar nomes dos contatos e montar array para RPC
    const contatosParaFila = []

    for (const phone of contatos) {
      const phoneVariants = buildPhoneVariants(phone)
      let nome = 'Cliente'

      // 1. Tentar whatsapp_contacts
      const { data: wc } = await supabase
        .from('whatsapp_contacts')
        .select('nome')
        .eq('user_id', campanha.user_id)
        .in('phone', phoneVariants)
        .not('nome', 'is', null)
        .limit(1)
        .maybeSingle()
      if (wc?.nome?.trim()) nome = wc.nome.trim()

      // 2. Tentar pj_lista_membros
      if (nome === 'Cliente') {
        const { data: plm } = await supabase
          .from('pj_lista_membros')
          .select('nome')
          .in('lista_id', listasIds)
          .in('telefone', phoneVariants)
          .not('nome', 'is', null)
          .limit(1)
          .maybeSingle()
        if (plm?.nome?.trim()) nome = plm.nome.trim()
      }

      // 3. Tentar cadastros
      if (nome === 'Cliente' && phoneVariants.length > 0) {
        const cadastrosFilter = phoneVariants
          .map((variant) => `whatsapp.eq.${variant}`)
          .join(',')
        const { data: cad } = await supabase
          .from('cadastros')
          .select('nome')
          .eq('user_id', campanha.user_id)
          .or(cadastrosFilter)
          .not('nome', 'is', null)
          .limit(1)
          .maybeSingle()
        if (cad?.nome?.trim()) nome = cad.nome.trim()
      }

      // Personalizar mensagem
      const mensagemPersonalizada = campanha.mensagem_template
        .replace(/\{\{nome\}\}|\{nome\}/gi, nome)
        .replace(/\{\{produto\}\}|\{produto\}/gi, campanha.produtos?.nome || '')
        .replace(/\{\{preco\}\}|\{preco\}/gi, campanha.produtos?.preco?.toString() || '0')

      contatosParaFila.push({
        phone: normalizePhone(phone),
        name: nome,
        mensagem: mensagemPersonalizada
      })
    }

    console.log(`📝 Inserindo ${contatosParaFila.length} contatos na fila via RPC...`)

    // INSERIR NA FILA VIA RPC — NÃO ENVIAR DIRETAMENTE
    const { data: rpcResult, error: rpcError } = await supabase.rpc('inserir_campanha_fila', {
      p_user_id: campanha.user_id,
      p_contatos: contatosParaFila,
      p_mensagem: campanha.mensagem_template, // fallback, cada contato tem sua mensagem personalizada
      p_imagem_url: imageUrl || null,
      p_lead_source: 'campanha_recorrente',
      p_campanha_id: campanha.id,
      p_metadata: {
        produto_nome: campanha.produtos?.nome,
        produto_preco: campanha.produtos?.preco,
        campanha_nome: campanha.nome
      }
    })

    if (rpcError) {
      console.error('❌ Erro RPC inserir_campanha_fila:', rpcError)
      throw rpcError
    }

    const inseridos = rpcResult?.inseridos || 0
    console.log(`✅ ${inseridos} contatos inseridos na fila (gateway local fará o envio)`)

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
        total_enviados: (campanha.total_enviados || 0) + inseridos,
        ativa: proximaExec ? true : false,
        status: proximaExec ? 'ativa' : 'encerrada'
      })
      .eq('id', campaign_id)

    console.log(`📅 Próxima execução:`, proximaExec || 'Não repetirá')

    return new Response(
      JSON.stringify({ 
        success: true, 
        inseridos,
        total: contatos.length,
        proxima_execucao: proximaExec,
        campanha_nome: campanha.nome,
        modo: 'queue-only'
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
