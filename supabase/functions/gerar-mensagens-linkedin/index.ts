import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { socio, empresa, contexto_adicional } = await req.json()

    console.log('🤖 [LINKEDIN] Gerando mensagens para:', socio?.nome)

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY não configurada')
    }

    if (!socio || !empresa) {
      throw new Error('Dados do sócio e empresa são obrigatórios')
    }

    const prompt = `Você é um especialista em networking B2B e conexões profissionais no LinkedIn.

CONTEXTO DO CONTATO:
- Nome: ${socio.nome}
- Cargo/Qualificação: ${socio.qualificacao || 'Sócio'}
- Empresa: ${empresa.razao_social || empresa.nome_fantasia}
- Setor: ${empresa.atividade_principal?.descricao || 'Não identificado'}
- Cidade: ${empresa.endereco?.municipio || 'Brasil'}
${socio.enrichment_data?.linkedin_snippet ? `- Sobre (LinkedIn): ${socio.enrichment_data.linkedin_snippet}` : ''}
${contexto_adicional ? `- Contexto adicional: ${contexto_adicional}` : ''}

OBJETIVO:
Criar 3 mensagens de primeiro contato para LinkedIn que sejam:
- Curtas (máximo 300 caracteres cada - limite do LinkedIn para convites)
- Humanizadas e naturais (nada de "Prezado", "Venho através desta")
- Focadas em criar conexão genuína, não venda direta
- Sem mencionar WhatsApp (apenas LinkedIn, Instagram e Facebook são canais válidos)

GERE 3 VARIAÇÕES:

1. PROFISSIONAL: Tom executivo mas acessível. Mencione algo específico sobre a empresa ou setor deles. Foco em troca de experiências.

2. ENTUSIASTA: Tom mais descontraído e energético. Use 1-2 emojis com moderação. Demonstre interesse genuíno no trabalho deles.

3. DIRETO: Tom objetivo e conciso. Vá direto ao ponto sobre o motivo da conexão. Sem rodeios mas ainda cordial.

IMPORTANTE:
- NÃO use "Prezado(a)", "Venho por meio desta", "Espero que esteja bem"
- NÃO mencione WhatsApp como canal de contato
- Use linguagem natural como se fosse uma conversa real
- Personalize com o nome da pessoa e empresa
- Seja específico, não genérico

FORMATO DE RESPOSTA (JSON):
{
  "profissional": "mensagem aqui",
  "entusiasta": "mensagem aqui", 
  "direto": "mensagem aqui"
}`

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
    const content = data.choices?.[0]?.message?.content?.trim() || ''

    if (!content) {
      throw new Error('Nenhum conteúdo gerado')
    }

    console.log('✅ [LINKEDIN] Conteúdo bruto:', content)

    // Extrair JSON da resposta
    let mensagens
    try {
      // Tentar extrair JSON do conteúdo
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        mensagens = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('JSON não encontrado na resposta')
      }
    } catch (parseError) {
      console.error('❌ Erro ao parsear JSON:', parseError)
      // Fallback: criar mensagens básicas
      const primeiroNome = socio.nome.split(' ')[0]
      const nomeEmpresa = empresa.nome_fantasia || empresa.razao_social?.split(' ')[0]
      
      mensagens = {
        profissional: `Olá ${primeiroNome}, vi que você atua na ${nomeEmpresa}. Trabalho no mesmo segmento e seria interessante trocarmos experiências sobre o mercado. Vamos nos conectar?`,
        entusiasta: `Oi ${primeiroNome}! 👋 Achei muito interessante o trabalho da ${nomeEmpresa}. Adoraria me conectar e saber mais sobre a jornada de vocês no setor!`,
        direto: `${primeiroNome}, sou do segmento de ${empresa.atividade_principal?.descricao || 'negócios'} e gostaria de expandir minha rede. Podemos nos conectar?`
      }
    }

    console.log('✅ [LINKEDIN] Mensagens geradas:', mensagens)

    return new Response(JSON.stringify({
      success: true,
      mensagens
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
