import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API_KEY')
const GOOGLE_CX = Deno.env.get('GOOGLE_CX')

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  console.log('🔍 [ENRICH] Iniciando enriquecimento completo')
  
  try {
    const body = await req.json()
    const leadId = body.leadId || body.lead_id
    const leadTipo = body.leadTipo || body.lead_tipo

    if (!leadId || !leadTipo) {
      throw new Error('leadId e leadTipo são obrigatórios')
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const tabela = leadTipo === 'b2c' ? 'leads_b2c' : 'leads_b2b'
    const { data: lead, error: leadError } = await supabase
      .from(tabela)
      .select('*')
      .eq('id', leadId)
      .single()

    if (leadError || !lead) {
      console.error('❌ [LEAD] Erro:', leadError)
      throw new Error('Lead não encontrado')
    }

    console.log('✅ [LEAD]', lead.nome_completo || lead.razao_social)

    const enriched: Record<string, any> = {
      telefone: lead.telefone || null,
      whatsapp: lead.whatsapp || null,
      email: lead.email || null,
      instagram_username: lead.instagram_username || null,
      instagram_url: null,
      facebook_url: lead.facebook_url || null,
      twitter_url: null,
      site_consultorio: lead.site_url || null
    }

    const nome = lead.nome_completo || lead.razao_social || ''
    const profissao = lead.profissao || lead.setor || ''
    const cidade = lead.cidade || ''

    // 1. BUSCAR TELEFONE + EMAIL + SITE
    console.log('📞 [ENRICH] Buscando contatos...')
    
    const queryContatos = `"${nome}" ${profissao} ${cidade} telefone contato`
    
    if (GOOGLE_API_KEY && GOOGLE_CX) {
      try {
        const url = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_CX}&q=${encodeURIComponent(queryContatos)}&num=5`
        const res = await fetch(url)
        const data = await res.json()

        if (data.items) {
          for (const item of data.items) {
            const text = `${item.title || ''} ${item.snippet || ''}`.toLowerCase()
            
            // TELEFONE
            if (!enriched.telefone) {
              const phoneRegex = /(?:\+55|55)?[\s.-]?\(?([1-9]{2})\)?[\s.-]?(?:9[\s.-]?)?([0-9]{4})[\s.-]?([0-9]{4})/g
              const phones = text.match(phoneRegex)
              
              if (phones) {
                const clean = phones[0].replace(/\D/g, '')
                if (clean.length >= 10) {
                  enriched.telefone = clean.startsWith('55') ? `+${clean}` : `+55${clean}`
                  enriched.whatsapp = enriched.telefone
                  console.log('✅ [TEL]', enriched.telefone)
                }
              }
            }

            // EMAIL
            if (!enriched.email) {
              const emailRegex = /[\w.-]+@[\w.-]+\.\w+/g
              const emails = text.match(emailRegex)
              if (emails) {
                enriched.email = emails[0]
                console.log('✅ [EMAIL]', enriched.email)
              }
            }

            // SITE
            if (!enriched.site_consultorio && item.link && 
                !item.link.includes('linkedin') && 
                !item.link.includes('instagram') &&
                !item.link.includes('facebook') &&
                !item.link.includes('twitter')) {
              enriched.site_consultorio = item.link
              console.log('✅ [SITE]', item.link)
            }
          }
        }
      } catch (e) {
        console.error('❌ [CONTATOS] Erro:', e)
      }
    }

    // 2. BUSCAR INSTAGRAM
    console.log('📷 [ENRICH] Buscando Instagram...')
    
    if (GOOGLE_API_KEY && GOOGLE_CX && !enriched.instagram_username) {
      try {
        const queryInsta = `"${nome}" instagram ${profissao}`
        const url = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_CX}&q=${encodeURIComponent(queryInsta)}&num=5`
        const res = await fetch(url)
        const data = await res.json()

        if (data.items) {
          for (const item of data.items) {
            if (item.link?.includes('instagram.com/')) {
              const username = item.link.split('instagram.com/')[1]?.split('/')[0]?.split('?')[0]
              if (username && username.length > 0 && !username.includes('explore') && !username.includes('p')) {
                enriched.instagram_username = username
                enriched.instagram_url = `https://instagram.com/${username}`
                console.log('✅ [INSTA]', username)
                break
              }
            }
          }
        }
      } catch (e) {
        console.error('❌ [INSTA] Erro:', e)
      }
    }

    // 3. BUSCAR FACEBOOK
    console.log('📘 [ENRICH] Buscando Facebook...')
    
    if (GOOGLE_API_KEY && GOOGLE_CX && !enriched.facebook_url) {
      try {
        const queryFb = `"${nome}" facebook ${profissao}`
        const url = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_CX}&q=${encodeURIComponent(queryFb)}&num=5`
        const res = await fetch(url)
        const data = await res.json()

        if (data.items) {
          for (const item of data.items) {
            if (item.link?.includes('facebook.com/')) {
              enriched.facebook_url = item.link
              console.log('✅ [FB]', item.link)
              break
            }
          }
        }
      } catch (e) {
        console.error('❌ [FB] Erro:', e)
      }
    }

    // 4. BUSCAR TWITTER/X
    console.log('🐦 [ENRICH] Buscando Twitter...')
    
    if (GOOGLE_API_KEY && GOOGLE_CX && !enriched.twitter_url) {
      try {
        const queryTwitter = `"${nome}" twitter OR x.com ${profissao}`
        const url = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_CX}&q=${encodeURIComponent(queryTwitter)}&num=3`
        const res = await fetch(url)
        const data = await res.json()

        if (data.items) {
          for (const item of data.items) {
            if (item.link?.includes('twitter.com/') || item.link?.includes('x.com/')) {
              enriched.twitter_url = item.link
              console.log('✅ [TWITTER]', item.link)
              break
            }
          }
        }
      } catch (e) {
        console.error('❌ [TWITTER] Erro:', e)
      }
    }

    // 5. CALCULAR SCORE BONUS
    let bonus = 0
    if (enriched.telefone && !lead.telefone) bonus += 25
    if (enriched.email && !lead.email) bonus += 20
    if (enriched.instagram_username && !lead.instagram_username) bonus += 15
    if (enriched.facebook_url && !lead.facebook_url) bonus += 10
    if (enriched.twitter_url) bonus += 5
    if (enriched.site_consultorio && !lead.site_url) bonus += 15

    const novoScore = Math.min((lead.score || 50) + bonus, 100)
    const novoPipeline = novoScore >= 70 ? 'qualificado' : 'enriquecido'

    // 6. ATUALIZAR LEAD NO BANCO
    const updateData: Record<string, any> = {
      score: novoScore,
      pipeline_status: novoPipeline,
      enriched_at: new Date().toISOString(),
      whatsapp_verificado: !!enriched.whatsapp,
      enrichment_data: enriched
    }

    // Só atualiza campos que encontramos e que estavam vazios
    if (enriched.telefone && !lead.telefone) updateData.telefone = enriched.telefone
    if (enriched.whatsapp && !lead.whatsapp) updateData.whatsapp = enriched.whatsapp
    if (enriched.email && !lead.email) updateData.email = enriched.email
    if (enriched.instagram_username && !lead.instagram_username) updateData.instagram_username = enriched.instagram_username
    if (enriched.facebook_url && !lead.facebook_url) updateData.facebook_url = enriched.facebook_url
    if (enriched.twitter_url) updateData.twitter_url = enriched.twitter_url
    if (enriched.site_consultorio && !lead.site_url) updateData.site_url = enriched.site_consultorio

    const { error: updateError } = await supabase
      .from(tabela)
      .update(updateData)
      .eq('id', leadId)

    if (updateError) {
      console.error('❌ [UPDATE] Erro:', updateError)
      throw updateError
    }

    console.log('✅ [FINAL] Score:', novoScore, 'Bonus:', bonus, 'Status:', novoPipeline)

    return new Response(JSON.stringify({
      success: true,
      dados_encontrados: enriched,
      bonus_aplicado: bonus,
      score_novo: novoScore,
      pipeline_status: novoPipeline
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ [ERRO]', error)
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
