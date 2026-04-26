// ============================================================================
// generate-social-post-engagement
// ----------------------------------------------------------------------------
// Edge function ISOLADA (Fase 2) — gera captions em "Modo Engajamento"
// usando 6 estilos copywriting (escassez, curiosidade, pergunta, polêmica,
// dado, tabu). Possui validador anti-clickbait em 2 camadas (string + regex
// contextual) e fallback para generate-social-post (Modo Promocional)
// quando 3 tentativas falham.
//
// IMPORTANTE: Esta função NÃO é chamada por autopilot-social ainda. Só pode
// ser invocada manualmente via curl/supabase.functions.invoke para validação.
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// ----------------------------------------------------------------------------
// Tipos
// ----------------------------------------------------------------------------

type Estilo = 'escassez' | 'curiosidade' | 'pergunta' | 'polemica' | 'dado' | 'tabu'

const ESTILOS_VALIDOS: Estilo[] = [
  'escassez',
  'curiosidade',
  'pergunta',
  'polemica',
  'dado',
  'tabu',
]

interface ProdutoLite {
  id: string
  nome: string
  preco: number | null
  categoria: string | null
  link: string | null
  link_marketplace: string | null
}

interface BlacklistTermo {
  categoria: string
  termo_simples: string | null
  regex_pattern: string | null
}

// ----------------------------------------------------------------------------
// Header obrigatório de estrutura — repetido em TODOS os 6 prompts
// ----------------------------------------------------------------------------

const CTA_EXATO = 'Garante o seu pelo link aí em cima 👆'

const HEADER_ESTRUTURA = `
ESTRUTURA OBRIGATÓRIA DA CAPTION (NÃO NEGOCIÁVEL):
1. LINHA 1: O LINK do produto sozinho (sem texto antes). Use exatamente: {{LINK}}
2. LINHA EM BRANCO
3. SCRIPT: O texto principal de copywriting no estilo solicitado (3 a 6 linhas, parágrafos curtos)
4. LINHA EM BRANCO
5. CTA — ÚLTIMA LINHA OBRIGATÓRIA, copiar EXATAMENTE esta string (sem variações, sem adicionar nada antes ou depois): ${CTA_EXATO}

REGRAS UNIVERSAIS:
- NUNCA repita o link no meio ou no fim. O link aparece UMA VEZ na linha 1.
- Use português brasileiro coloquial e natural.
- Máximo 700 caracteres no total.
- Pode usar 1 a 3 emojis no script. Não exagere.
- PROIBIDO ABSOLUTAMENTE usar hashtags. NÃO inclua NENHUM caractere "#" em lugar nenhum da caption. Se você incluir qualquer hashtag, sua resposta será REJEITADA e descartada.
- APENAS UM CTA na caption inteira. Não escreva dois CTAs nem variações alternativas. Só a string exata acima na última linha.
- NUNCA prometa cura, milagre, garantia 100%, resultado milagroso, ou cite ANVISA/FDA/OMS.
- NUNCA depreciem outros marketplaces.
- NÃO invente preço, frete grátis ou prazo de entrega que não foi informado.
`.trim()

// ----------------------------------------------------------------------------
// Os 6 prompts dedicados (apenas o "miolo" — header é prependido)
// ----------------------------------------------------------------------------

function promptEscassez(p: ProdutoLite): string {
  return `
ESTILO: ESCASSEZ.
Crie uma caption que transmita oportunidade limitada SEM mentir sobre estoque.
Use ângulos verdadeiros: "esse modelo costuma sumir rápido", "tá com preço bom hoje",
"achei essa unidade no estoque e separei". NÃO invente "últimas 3 unidades" se não souber.

PRODUTO:
- Nome: ${p.nome}
- Preço: ${p.preco ? `R$ ${p.preco.toFixed(2).replace('.', ',')}` : 'consultar'}
- Categoria: ${p.categoria || 'geral'}
`.trim()
}

function promptCuriosidade(p: ProdutoLite): string {
  return `
ESTILO: CURIOSIDADE.
Abra a caption com uma observação intrigante sobre o produto que faça a pessoa querer
saber mais (sem clickbait barato tipo "você não vai acreditar"). Mostre um detalhe
útil ou inesperado do produto. Não dê todas as respostas — deixe o link resolver.

PRODUTO:
- Nome: ${p.nome}
- Preço: ${p.preco ? `R$ ${p.preco.toFixed(2).replace('.', ',')}` : 'consultar'}
- Categoria: ${p.categoria || 'geral'}
`.trim()
}

function promptPergunta(p: ProdutoLite): string {
  return `
ESTILO: PERGUNTA.
Inicie o script com uma pergunta direta ao leitor que conecte com a dor/desejo
que o produto resolve. A pergunta deve ser realista e específica do dia a dia,
não genérica ("você quer ser feliz?"). Depois apresente o produto como resposta.

PRODUTO:
- Nome: ${p.nome}
- Preço: ${p.preco ? `R$ ${p.preco.toFixed(2).replace('.', ',')}` : 'consultar'}
- Categoria: ${p.categoria || 'geral'}
`.trim()
}

function promptPolemica(p: ProdutoLite): string {
  return `
ESTILO: POLÊMICA LEVE.
Comece o SCRIPT OBRIGATORIAMENTE com uma destas aberturas (escolha uma):
  - "Vou ser sincero:"
  - "A verdade é que"
  - "Ninguém fala isso, mas"
  - "Ninguém te conta:"
Em seguida, defenda uma OPINIÃO CONTRA O SENSO COMUM relacionada ao tema do
produto (ex: "comprar caro não significa qualidade", "gastar mais não resolve
nada", "o problema não é o produto, é como a maioria usa").
NÃO ataque concorrentes, marketplaces, marcas específicas. NÃO use teorias de
conspiração. A polêmica é sobre HÁBITO ou ESCOLHA DO CONSUMIDOR.

PRODUTO:
- Nome: ${p.nome}
- Preço: ${p.preco ? `R$ ${p.preco.toFixed(2).replace('.', ',')}` : 'consultar'}
- Categoria: ${p.categoria || 'geral'}
`.trim()
}

function promptDado(p: ProdutoLite): string {
  return `
ESTILO: DADO / PROVA SOCIAL.
Comece o SCRIPT OBRIGATORIAMENTE com UM número ou estatística plausível,
usando uma destas estruturas (escolha uma):
  - "X em cada Y pessoas..."
  - "Mais de X% das pessoas..."
  - "A maioria (X%) das casas..."
  - "X de cada 10 brasileiros..."
SEM número explícito no início, sua resposta será REJEITADA.
Use número plausível e razoável (não invente "97% dos especialistas" exagerado).
Conecte o dado direto à dor/desejo que o produto resolve.

PRODUTO:
- Nome: ${p.nome}
- Preço: ${p.preco ? `R$ ${p.preco.toFixed(2).replace('.', ',')}` : 'consultar'}
- Categoria: ${p.categoria || 'geral'}
`.trim()
}

function promptTabu(p: ProdutoLite): string {
  return `
ESTILO: TABU / "NINGUÉM FALA SOBRE".
Aborde algo que costuma ser pouco discutido sobre a categoria do produto (ex:
"ninguém te conta o que acontece quando você usa X errado", "tem um detalhe
que vendedor nenhum comenta"). Mantenha respeito — o tabu é sobre INFORMAÇÃO
oculta no mercado, NÃO sobre temas pessoais sensíveis.

PRODUTO:
- Nome: ${p.nome}
- Preço: ${p.preco ? `R$ ${p.preco.toFixed(2).replace('.', ',')}` : 'consultar'}
- Categoria: ${p.categoria || 'geral'}
`.trim()
}

const PROMPT_BUILDERS: Record<Estilo, (p: ProdutoLite) => string> = {
  escassez: promptEscassez,
  curiosidade: promptCuriosidade,
  pergunta: promptPergunta,
  polemica: promptPolemica,
  dado: promptDado,
  tabu: promptTabu,
}

// ----------------------------------------------------------------------------
// Validador anti-clickbait — 2 camadas
// ----------------------------------------------------------------------------

interface ValidacaoResultado {
  ok: boolean
  motivo?: string
  termo_violado?: string
  camada?: 1 | 2
}

function validarCaption(
  caption: string,
  blacklist: BlacklistTermo[],
): ValidacaoResultado {
  const captionLower = caption.toLowerCase()

  // CAMADA 1: string match contra termo_simples
  for (const item of blacklist) {
    if (!item.termo_simples) continue
    const termo = item.termo_simples.toLowerCase().trim()
    if (!termo) continue
    if (captionLower.includes(termo)) {
      return {
        ok: false,
        camada: 1,
        motivo: `string_match:${item.categoria}`,
        termo_violado: item.termo_simples,
      }
    }
  }

  // CAMADA 2: regex_pattern contextual
  for (const item of blacklist) {
    if (!item.regex_pattern) continue
    try {
      const re = new RegExp(item.regex_pattern, 'i')
      if (re.test(caption)) {
        return {
          ok: false,
          camada: 2,
          motivo: `regex_match:${item.categoria}`,
          termo_violado: item.regex_pattern,
        }
      }
    } catch (e) {
      console.warn('⚠️ Regex inválida na blacklist:', item.regex_pattern, e)
    }
  }

  return { ok: true }
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function escolherEstiloAleatorio(estilosPermitidos?: string[]): Estilo {
  const pool = (estilosPermitidos && estilosPermitidos.length > 0)
    ? (estilosPermitidos.filter((e) => ESTILOS_VALIDOS.includes(e as Estilo)) as Estilo[])
    : ESTILOS_VALIDOS
  const lista = pool.length > 0 ? pool : ESTILOS_VALIDOS
  return lista[Math.floor(Math.random() * lista.length)]
}

function injetarLink(caption: string, link: string): string {
  // Garante que {{LINK}} foi substituído mesmo se a IA "esqueceu"
  if (caption.includes('{{LINK}}')) {
    return caption.replaceAll('{{LINK}}', link)
  }
  // Se a IA não usou o placeholder mas começou com algo diferente,
  // não vamos mexer — o validador / loop decidirá. O link bruto já
  // está embutido pelo prompt principal.
  return caption
}

async function chamarLLM(promptCompleto: string): Promise<string> {
  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [{ role: 'user', content: promptCompleto }],
      max_tokens: 700,
      temperature: 0.85,
    }),
  })

  if (!response.ok) {
    const txt = await response.text()
    throw new Error(`LLM erro ${response.status}: ${txt.slice(0, 200)}`)
  }

  const data = await response.json()
  return (data.choices?.[0]?.message?.content || '').trim()
}

async function fallbackPromocional(
  produto: ProdutoLite,
  link: string,
): Promise<string> {
  // Chama generate-social-post (Modo Promocional original) como fallback.
  const resp = await fetch(`${SUPABASE_URL}/functions/v1/generate-social-post`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SERVICE_ROLE}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      lead: { nome_completo: 'cliente', profissao: 'consumidor' },
      produto: `${produto.nome}${produto.preco ? ` — R$ ${produto.preco.toFixed(2).replace('.', ',')}` : ''}`,
      objetivo: 'gerar_curiosidade',
      redeSocial: 'Facebook',
    }),
  })
  const data = await resp.json()
  const post = data?.post || ''
  // Garante o link no topo conforme estrutura geral
  return `${link}\n\n${post}`.trim()
}

// ----------------------------------------------------------------------------
// Handler
// ----------------------------------------------------------------------------

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (!LOVABLE_API_KEY) {
    return new Response(
      JSON.stringify({ success: false, error: 'LOVABLE_API_KEY não configurada' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)

  let body: any = {}
  try {
    body = await req.json()
  } catch {
    return new Response(
      JSON.stringify({ success: false, error: 'JSON inválido' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  const { produto_id, estilo: estiloSolicitado, user_id } = body

  if (!produto_id) {
    return new Response(
      JSON.stringify({ success: false, error: 'produto_id obrigatório' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  // Carregar produto
  const { data: produto, error: prodErr } = await supabase
    .from('produtos')
    .select('id, nome, preco, categoria, link, link_marketplace, user_id, engajamento_estilos')
    .eq('id', produto_id)
    .maybeSingle()

  if (prodErr || !produto) {
    return new Response(
      JSON.stringify({ success: false, error: 'Produto não encontrado' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  const link = produto.link_marketplace || produto.link || ''
  if (!link) {
    return new Response(
      JSON.stringify({ success: false, error: 'Produto sem link válido' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  const userIdLog = user_id || produto.user_id

  // Carregar blacklist ativa
  const { data: blacklistData, error: blErr } = await supabase
    .from('engagement_blacklist')
    .select('categoria, termo_simples, regex_pattern')
    .eq('ativo', true)
  if (blErr) {
    console.error('❌ Erro carregando blacklist:', blErr)
  }
  const blacklist: BlacklistTermo[] = blacklistData || []

  // Decidir estilo
  let estiloEscolhido: Estilo
  if (estiloSolicitado && ESTILOS_VALIDOS.includes(estiloSolicitado)) {
    estiloEscolhido = estiloSolicitado as Estilo
  } else {
    estiloEscolhido = escolherEstiloAleatorio(produto.engajamento_estilos)
  }

  const produtoLite: ProdutoLite = {
    id: produto.id,
    nome: produto.nome,
    preco: produto.preco,
    categoria: produto.categoria,
    link: produto.link,
    link_marketplace: produto.link_marketplace,
  }

  // Loop de até 3 tentativas
  const MAX_TENT = 3
  let tentativas = 0
  let captionFinal = ''
  let validacaoFinal: ValidacaoResultado = { ok: false, motivo: 'sem_tentativa' }
  let usouFallback = false
  const motivosFalha: string[] = []

  while (tentativas < MAX_TENT) {
    tentativas++

    const promptMiolo = PROMPT_BUILDERS[estiloEscolhido](produtoLite)
    const promptCompleto = [
      'Você é redator brasileiro de copy para Facebook/Instagram.',
      HEADER_ESTRUTURA,
      promptMiolo,
      `\nLINK A USAR: ${link}\n`,
      'Gere AGORA a caption final, seguindo a estrutura. Nada de prefácio.',
    ].join('\n\n')

    let bruto = ''
    try {
      bruto = await chamarLLM(promptCompleto)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error(`❌ Tentativa ${tentativas} falhou no LLM:`, msg)
      motivosFalha.push(`llm_error:${msg.slice(0, 80)}`)
      continue
    }

    if (!bruto) {
      motivosFalha.push('caption_vazia')
      continue
    }

    const comLink = injetarLink(bruto, link)
    const validacao = validarCaption(comLink, blacklist)

    if (validacao.ok) {
      captionFinal = comLink
      validacaoFinal = validacao
      break
    }

    motivosFalha.push(`bl_${validacao.camada}:${validacao.termo_violado}`)
    validacaoFinal = validacao
  }

  // Fallback se 3 tentativas falharam
  if (!captionFinal) {
    try {
      captionFinal = await fallbackPromocional(produtoLite, link)
      usouFallback = true
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      // Log e devolve erro
      await supabase.from('engagement_post_logs').insert({
        user_id: userIdLog,
        produto_id: produto.id,
        tipo_chamada: 'manual',
        estilo_usado: estiloEscolhido,
        tentativas,
        fallback_para_promocional: false,
        motivo_fallback: `fallback_falhou:${msg.slice(0, 100)} | ${motivosFalha.join(' | ')}`,
        caption_final: null,
      })
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Geração + fallback falharam',
          tentativas,
          motivos_falha: motivosFalha,
          fallback_error: msg,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }
  }

  // Log final
  const { error: logErr } = await supabase.from('engagement_post_logs').insert({
    user_id: userIdLog,
    produto_id: produto.id,
    tipo_chamada: 'manual',
    estilo_usado: estiloEscolhido,
    tentativas,
    fallback_para_promocional: usouFallback,
    motivo_fallback: usouFallback ? motivosFalha.join(' | ') : null,
    caption_final: captionFinal,
  })
  if (logErr) {
    console.error('❌ Falha ao gravar log:', JSON.stringify(logErr))
  }

  return new Response(
    JSON.stringify({
      success: true,
      estilo: estiloEscolhido,
      tentativas,
      fallback: usouFallback,
      caption: captionFinal,
      caracteres: captionFinal.length,
      motivos_falha_anteriores: motivosFalha,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
})
