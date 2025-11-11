import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

    const { prospect_id } = await req.json()

    if (!prospect_id) {
      throw new Error('prospect_id is required')
    }

    console.log(`✍️ Generating messages for prospect: ${prospect_id}`)

    // Fetch prospect with full context
    const { data: prospect, error: prospectError } = await supabaseClient
      .from('prospects_qualificados')
      .select(`
        *,
        socio:socios(*, empresa:empresas(*)),
        enrichment:socios_enriquecidos(*)
      `)
      .eq('id', prospect_id)
      .single()

    if (prospectError || !prospect) throw new Error('Prospect not found')

    const firstName = prospect.socio.nome.split(' ')[0]

    // Call Lovable AI (uses built-in LOVABLE_API_KEY)
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured')
    }

    // Helper function to generate message
    const generateMessage = async (tone: string) => {
      const prompt = `Write a WhatsApp message for Porsche dealership.

PROSPECT: ${prospect.socio.nome}, ${prospect.socio.qualificacao} at ${prospect.socio.empresa.nome_fantasia}
SCORE: ${prospect.score}/100
INSIGHTS: ${prospect.insights?.join(', ') || 'None'}
TONE: ${tone}

RULES:
1. Start with "Oi ${firstName}!"
2. Mention something SPECIFIC about them (recent achievement, company, etc)
3. 100-150 words in Brazilian Portuguese
4. Natural, conversational - NOT salesy
5. Clear but soft CTA (test drive or meeting)
6. Use 1-2 emojis maximum
7. Sign off with "Porsche São Paulo" or similar

TONE GUIDELINES:
- professional: Business-like but warm, mention business achievements
- friendly: More casual, conversational, lifestyle focus
- enthusiast: Focus on car passion, performance, driving experience

Write ONLY the message text, no formatting, no code blocks.`

      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'user', content: prompt }
          ],
        }),
      })

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please try again later.')
        }
        if (response.status === 402) {
          throw new Error('AI credits depleted. Please add credits to continue.')
        }
        throw new Error(`Lovable AI error: ${response.status}`)
      }

      const data = await response.json()
      return data.choices[0].message.content.trim()
    }

    // Generate all 3 variations in parallel
    const [professional, friendly, enthusiast] = await Promise.all([
      generateMessage('professional'),
      generateMessage('friendly'),
      generateMessage('enthusiast'),
    ])

    // Calculate optimal send time
    const calculateOptimalTime = () => {
      const now = new Date()
      const optimal = new Date(now)
      
      // Next business day at 10 AM
      optimal.setDate(optimal.getDate() + 1)
      optimal.setHours(10, 0, 0, 0)
      
      // Skip weekends
      const day = optimal.getDay()
      if (day === 0) optimal.setDate(optimal.getDate() + 1) // Sunday → Monday
      if (day === 6) optimal.setDate(optimal.getDate() + 2) // Saturday → Monday
      
      return optimal.toISOString()
    }

    // Save messages
    const { data: messages, error: messagesError } = await supabaseClient
      .from('mensagens_personalizadas')
      .insert({
        prospect_id,
        concessionaria_id: prospect.concessionaria_id,
        mensagem_professional: professional,
        mensagem_friendly: friendly,
        mensagem_enthusiast: enthusiast,
        agendado_para: calculateOptimalTime(),
      })
      .select()
      .single()

    if (messagesError) throw messagesError

    console.log(`✅ Messages generated for: ${prospect.socio.nome}`)

    return new Response(
      JSON.stringify({
        success: true,
        messages: {
          professional,
          friendly,
          enthusiast,
        },
        scheduled_for: calculateOptimalTime(),
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