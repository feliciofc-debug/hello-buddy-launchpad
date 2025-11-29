import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
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
    const formData = await req.formData()
    const callSid = formData.get('CallSid') as string
    const transcriptionText = formData.get('TranscriptionText') as string
    const duration = formData.get('RecordingDuration') as string

    console.log('📝 Transcrição recebida:', { callSid, duration })

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Atualizar voice_calls com transcrição
    await supabase
      .from('voice_calls')
      .update({ 
        transcription: transcriptionText,
        duration: parseInt(duration || '0'),
        status: 'completed'
      })
      .eq('call_sid', callSid)

    // Buscar lead da ligação
    const { data: call } = await supabase
      .from('voice_calls')
      .select('lead_id, lead_type, user_id')
      .eq('call_sid', callSid)
      .single()

    if (call && transcriptionText) {
      // Analisar sentimento
      const analysis = analyzeCallSentiment(transcriptionText)

      // Atualizar análise
      await supabase
        .from('voice_calls')
        .update({ 
          ai_analysis: analysis,
          sentiment_score: analysis.score,
          lead_qualified: analysis.interesse
        })
        .eq('call_sid', callSid)

      // Registrar interação
      await supabase.from('interacoes').insert({
        lead_id: call.lead_id,
        lead_tipo: call.lead_type,
        tipo: 'call',
        titulo: 'Ligação concluída',
        descricao: `Duração: ${duration}s - Sentimento: ${analysis.sentiment}`,
        resultado: analysis.interesse ? 'positivo' : 'neutro',
        duracao_segundos: parseInt(duration || '0'),
        metadata: { transcription: transcriptionText, analysis },
        created_by: call.user_id
      })

      console.log('✅ Análise salva:', analysis)
    }

    return new Response('OK', { headers: corsHeaders })

  } catch (error: any) {
    console.error('❌ Erro na transcrição:', error)
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

function analyzeCallSentiment(transcription: string) {
  const keywords = {
    interesse: ['interessado', 'quero', 'preciso', 'gostaria', 'pode me enviar', 'quanto custa', 'preço', 'sim', 'vamos', 'aceito'],
    rejeicao: ['não', 'desculpe', 'ocupado', 'depois', 'não tenho interesse', 'não preciso', 'já tenho']
  }

  const text = transcription.toLowerCase()
  
  const interesseCount = keywords.interesse.filter(k => text.includes(k)).length
  const rejeicaoCount = keywords.rejeicao.filter(k => text.includes(k)).length

  const score = (interesseCount - rejeicaoCount) / Math.max(interesseCount + rejeicaoCount, 1)
  
  let sentiment = 'neutro'
  if (score > 0.3) sentiment = 'positivo'
  else if (score < -0.3) sentiment = 'negativo'

  return {
    sentiment,
    score: Math.round(score * 100) / 100,
    interesse: score > 0,
    resumo: transcription.substring(0, 200),
    keywords_encontradas: {
      interesse: keywords.interesse.filter(k => text.includes(k)),
      rejeicao: keywords.rejeicao.filter(k => text.includes(k))
    }
  }
}
