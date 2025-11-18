import { serve } from 'https://deno.land/std@0.190.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const { concessionaria_id, mensagem_ids } = await req.json()

    if (!concessionaria_id) {
      throw new Error('concessionaria_id is required')
    }

    console.log(`📤 Exporting messages for concessionaria: ${concessionaria_id}`)

    // Fetch approved messages
    let query = supabaseClient
      .from('mensagens_personalizadas')
      .select(`
        *,
        prospect:prospects_qualificados(
          *,
          socio:socios(*, empresa:empresas(*))
        )
      `)
      .eq('concessionaria_id', concessionaria_id)
      .eq('aprovada', true)

    if (mensagem_ids && mensagem_ids.length > 0) {
      query = query.in('id', mensagem_ids)
    }

    const { data: mensagens, error: mensagensError } = await query

    if (mensagensError) throw mensagensError

    if (!mensagens || mensagens.length === 0) {
      throw new Error('No approved messages found')
    }

    // Format phone number
    const formatPhone = (phone: string) => {
      const cleaned = phone.replace(/\D/g, '')
      return cleaned.startsWith('55') ? cleaned : `55${cleaned}`
    }

    // Prepare CSV data
    const csvRows = mensagens.map((msg: any) => {
      const phone = formatPhone(msg.prospect.socio.empresa.telefone || '')
      const name = msg.prospect.socio.nome
      const message = msg.mensagem_final || msg[`mensagem_${msg.mensagem_selecionada}`] || msg.mensagem_professional
      const scheduled = msg.agendado_para || new Date().toISOString()
      const priority = msg.prospect.score >= 90 ? 'high' : 'normal'

      return {
        phone,
        name,
        message: message.replace(/"/g, '""'), // Escape quotes
        scheduled_for: scheduled,
        priority,
        prospect_id: msg.prospect_id,
        score: msg.prospect.score,
      }
    })

    // Generate CSV
    const headers = ['phone', 'name', 'message', 'scheduled_for', 'priority']
    const csvContent = [
      headers.join(','),
      ...csvRows.map((row: any) => 
        `${row.phone},${row.name},"${row.message}",${row.scheduled_for},${row.priority}`
      )
    ].join('\n')

    // Save export batch
    const { data: batch, error: batchError } = await supabaseClient
      .from('zapi_export_batches')
      .insert({
        concessionaria_id,
        total_mensagens: mensagens.length,
        mensagens_ids: mensagens.map((m: any) => m.id),
        csv_data: csvContent,
      })
      .select()
      .single()

    if (batchError) throw batchError

    console.log(`✅ Exported ${mensagens.length} messages`)

    return new Response(
      JSON.stringify({
        success: true,
        batch_id: batch.id,
        total_messages: mensagens.length,
        csv_content: csvContent,
        messages: csvRows,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('❌ Error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})