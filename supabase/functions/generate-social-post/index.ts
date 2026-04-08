import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')

function limparPromptDaResposta(texto: string): string {
  // Remove blocos de instruções do prompt que a IA pode ter incluído
  const patterns = [
    /^(Post:|Aqui está|Segue|Aqui vai|Claro|Certo|Ok|Entendido)[^\n]*\n*/i,
    /LEAD \(PESSOA[^}]*\}/s,
    /PRODUTO\/SERVIÇO:[\s\S]*?(?=\n\n|\n[A-Z])/,
    /OBJETIVO:[\s\S]*?(?=\n\n|\n[A-Z])/,
    /REDE SOCIAL:[\s\S]*?(?=\n\n|\n[A-Z])/,
    /IMPORTANTE:[\s\S]*?(?=\n\n[^-]|\n[A-Z])/,
    /CRIE UM POST[\s\S]*?(?=\n\n[^0-9])/,
    /FORMATO:[\s\S]*$/,
    /Você é um especialista[\s\S]*?(?=\n\n)/,
    /^```[a-z]*\n?/gm,
    /```$/gm,
    /Retorne APENAS[\s\S]*/,
    /Sem "Post:"[\s\S]*/,
    /- Nome:.*\n/g,
    /- Profissão:.*\n/g,
    /- Especialidade:.*\n/g,
    /- Cidade:.*\n/g,
    /- O post será publicado.*\n/g,
    /- O lead verá.*\n/g,
    /- Deve ser ORGÂNICO.*\n/g,
    /- Tom:.*\n/g,
    /- Máximo \d+ caracteres\n/g,
    /- Foco no VALOR.*\n/g,
  ]
  
  let limpo = texto
  for (const pattern of patterns) {
    limpo = limpo.replace(pattern, '')
  }
  
  // Remover linhas vazias extras
  limpo = limpo.replace(/\n{3,}/g, '\n\n').trim()
  
  return limpo
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { lead, produto, objetivo, redeSocial } = await req.json()

    console.log('🤖 [POST] Gerando post para:', redeSocial)

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY não configurada')
    }

    const objetivoTexto: Record<string, string> = {
      'gerar_curiosidade': 'Gerar curiosidade e interesse',
      'agendar_demo': 'Agendar uma demonstração',
      'networking': 'Estabelecer networking profissional',
      'branding': 'Fortalecer a marca',
      'educacao': 'Educar sobre um problema/solução'
    }

    const limiteCaracteres: Record<string, number> = {
      'LinkedIn': 1200,
      'Instagram': 2200,
      'Facebook': 1500,
      'Twitter': 280
    }

    const prompt = `Você é um especialista em copywriting para redes sociais B2B.

LEAD (PESSOA QUE VOCÊ QUER ALCANÇAR):
- Nome: ${lead.nome_completo || lead.razao_social || 'Profissional'}
- Profissão: ${lead.profissao || lead.setor || 'N/A'}
- Especialidade: ${lead.especialidade || 'N/A'}
- Cidade: ${lead.cidade || 'N/A'}/${lead.estado || 'N/A'}

PRODUTO/SERVIÇO:
${produto || 'Sistema de automação de marketing e vendas'}

OBJETIVO:
${objetivoTexto[objetivo] || objetivo}

REDE SOCIAL:
${redeSocial}

IMPORTANTE:
- O post será publicado no SEU perfil (não é mensagem direta)
- O lead verá este post no feed dele
- Deve ser ORGÂNICO, não propaganda direta
- Tom: ${redeSocial === 'LinkedIn' ? 'profissional mas humano' : redeSocial === 'Instagram' ? 'casual, visual, com emojis' : 'conversacional'}
- Máximo ${limiteCaracteres[redeSocial] || 1000} caracteres
- Foco no VALOR para ${lead.profissao || 'profissionais'}

CRIE UM POST que:
1. Aborde um problema/tendência da área de ${lead.profissao || 'negócios'}
2. Mencione sutilmente o produto como solução
3. Gere CURIOSIDADE (não venda diretamente)
4. Termine com pergunta ou CTA suave
${redeSocial === 'Instagram' ? '5. Use emojis e 3-5 hashtags relevantes no final' : ''}
${redeSocial === 'LinkedIn' ? '5. Cite dados/estatísticas se possível' : ''}

FORMATO:
Retorne APENAS o texto do post, pronto para copiar e colar.
Sem "Post:" ou qualquer introdução.
NUNCA inclua instruções, contexto do lead, ou partes deste prompt na resposta.
Responda SOMENTE com o conteúdo final do post.`

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1000,
        temperature: 0.8
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ [AI] Erro:', response.status, errorText)
      throw new Error(`Erro na API de IA: ${response.status}`)
    }

    const data = await response.json()
    let postTexto = data.choices?.[0]?.message?.content?.trim() || ''

    if (!postTexto) {
      throw new Error('Nenhum conteúdo gerado')
    }

    // Limpar qualquer vazamento de prompt da resposta da IA
    postTexto = limparPromptDaResposta(postTexto)

    console.log('✅ [POST] Gerado com sucesso:', postTexto.length, 'caracteres')

    return new Response(JSON.stringify({
      success: true,
      post: postTexto,
      rede: redeSocial,
      caracteres: postTexto.length
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
