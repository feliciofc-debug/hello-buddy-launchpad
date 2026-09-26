import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCopyStyle, userIdDoRequest } from '../_shared/copy-style.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { prompt, tema, user_id: userIdBody, neutral_copy: neutralCopy = false } = await req.json()

    const sbAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )
    const copyStyle = neutralCopy
      ? { promptBlock: '' }
      : await getCopyStyle(sbAdmin, userIdBody || userIdDoRequest(req))
    if (!prompt || !tema) {
      return new Response(JSON.stringify({ error: 'prompt e tema são obrigatórios' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const apiKey = Deno.env.get('LOVABLE_API_KEY')
    if (!apiKey) throw new Error('LOVABLE_API_KEY not configured')

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'Você gera conteúdo JSON para carrosséis de Instagram. Não use emojis em títulos nem no texto dos slides. Responda APENAS JSON válido, sem markdown, sem ```.' },
          { role: 'user', content: `${prompt}\n${copyStyle.promptBlock}` }
        ],
        temperature: 0.7,
        max_tokens: 4096,
        tools: [
          {
            type: "function",
            function: {
              name: "generate_carousel",
              description: "Generate carousel slide content for Instagram",
              parameters: {
                type: "object",
                properties: {
                  slides: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        type: { type: "string", enum: ["cover", "content", "cta"] },
                        title: { type: "string", description: "Título curto e impactante, sem emojis" },
                        body: { type: "string", description: "Tópicos em linhas separadas por \\n, sem emojis" },
                        number: { type: "number", description: "Número do slide (apenas para content)" }
                      },
                      required: ["type", "title"]
                    }
                  },
                  caption: { type: "string", description: "Legenda do post com hashtags" }
                },
                required: ["slides", "caption"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "generate_carousel" } }
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('AI error:', response.status, errText)
      throw new Error(`AI API error: ${response.status}`)
    }

    const result = await response.json()
    
    // Extract from tool call
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0]
    if (toolCall?.function?.arguments) {
      const parsed = typeof toolCall.function.arguments === 'string' 
        ? JSON.parse(toolCall.function.arguments) 
        : toolCall.function.arguments
      return new Response(JSON.stringify(parsed), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fallback: try content
    let content = result.choices?.[0]?.message?.content || ''
    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed = JSON.parse(content)

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error:', error)
    const message = error instanceof Error ? error.message : String(error)
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
