import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const now = new Date()
    const results: any[] = []

    const { data: configs, error: configError } = await supabase
      .from('autopilot_config')
      .select('*')
      .eq('ativo', true)
      .or(`proxima_execucao.is.null,proxima_execucao.lte.${now.toISOString()}`)

    if (configError) throw new Error(`Erro buscando configs: ${configError.message}`)
    if (!configs || configs.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'Nenhum autopilot para executar', processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log(`🤖 Processando ${configs.length} autopilots...`)

    for (const config of configs) {
      try {
        const diaSemana = now.getDay()
        if (!config.dias_semana.includes(diaSemana)) {
          const proximoDia = calcularProximoDiaValido(now, config.dias_semana, config.horario_inicio)
          await supabase.from('autopilot_config')
            .update({ proxima_execucao: proximoDia.toISOString(), updated_at: now.toISOString() })
            .eq('id', config.id)
          continue
        }

        let query = supabase
          .from('produtos')
          .select('id, nome, descricao, preco, imagem_url, link, link_marketplace, categoria')
          .eq('ativo', true)

        if (config.produto_fonte === 'categoria' && config.categoria_filtro) {
          query = query.eq('categoria', config.categoria_filtro)
        } else if (config.produto_fonte === 'manual' && config.produto_ids?.length > 0) {
          query = query.in('id', config.produto_ids)
        }

        const { data: produtos, error: prodError } = await query
        if (prodError || !produtos || produtos.length === 0) {
          console.log(`⚠️ Autopilot ${config.id}: nenhum produto encontrado`)
          continue
        }

        console.log(`📦 Autopilot ${config.id}: ${produtos.length} produtos disponíveis`)

        let startIndex = config.ultimo_produto_index || 0
        if (startIndex >= produtos.length) {
          if (config.repetir_ciclo) {
            startIndex = 0
          } else {
            console.log(`✅ Autopilot ${config.id}: todos os produtos já foram postados`)
            await supabase.from('autopilot_config')
              .update({ ativo: false, updated_at: now.toISOString() })
              .eq('id', config.id)
            continue
          }
        }

        const postsHoje = Math.min(config.posts_por_dia, produtos.length - startIndex)
        const produtosHoje = produtos.slice(startIndex, startIndex + postsHoje)

        const horarios = calcularHorarios(config.horario_inicio, config.horario_fim, postsHoje, now)

        for (let i = 0; i < produtosHoje.length; i++) {
          const produto = produtosHoje[i]
          const horarioPost = horarios[i]

          let textoFacebook = ''
          let textoInstagram = ''

          if (config.gerar_texto_ia) {
            try {
              const response = await fetch(`${SUPABASE_URL}/functions/v1/gerar-posts`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  produto: {
                    nome: produto.nome,
                    preco: produto.preco,
                    descricao: produto.descricao || '',
                  }
                })
              })

              const iaData = await response.json()
              if (iaData?.posts) {
                const variacaoKey = escolherVariacao(config.estilo_texto, (config.total_publicados || 0) + i)
                textoFacebook = iaData.posts.facebook?.[variacaoKey] || iaData.posts.facebook?.opcaoA || ''
                textoInstagram = iaData.posts.instagram?.[variacaoKey] || iaData.posts.instagram?.opcaoA || ''
              }
            } catch (iaError) {
              console.error(`⚠️ Erro IA para ${produto.nome}:`, iaError)
            }
          }

          if (!textoFacebook) {
            textoFacebook = `🔥 ${produto.nome}\n💰 R$ ${produto.preco?.toFixed(2) || '---'}\n\nConfira essa oferta incrível!\n\n#ofertas #promocao`
          }
          if (!textoInstagram) {
            textoInstagram = textoFacebook
          }

          const linkProduto = produto.link || produto.link_marketplace || null
          if (config.incluir_link && linkProduto) {
            textoFacebook = `${textoFacebook}\n\n🔗 Compre aqui: ${linkProduto}`
            textoInstagram = `${textoInstagram}\n\n🔗 Link na bio ou acesse: ${linkProduto}`
          }

          const imagemUrl = config.incluir_imagem ? (produto.imagem_url || null) : null

          if (config.postar_facebook) {
            await supabase.from('social_posts_queue').insert({
              user_id: config.user_id,
              produto_id: produto.id,
              produto_source: 'produtos',
              platform: 'facebook',
              page_id: '855785300949909',
              post_text: textoFacebook,
              image_url: imagemUrl,
              link_url: linkProduto,
              status: 'pendente',
              scheduled_at: horarioPost.toISOString(),
            })
            console.log(`📘 Facebook agendado: ${produto.nome} para ${horarioPost.toISOString()}`)
          }

          if (config.postar_instagram && imagemUrl) {
            const horarioIg = new Date(horarioPost.getTime() + 5 * 60 * 1000)
            await supabase.from('social_posts_queue').insert({
              user_id: config.user_id,
              produto_id: produto.id,
              produto_source: 'produtos',
              platform: 'instagram',
              page_id: '855785300949909',
              post_text: textoInstagram,
              image_url: imagemUrl,
              link_url: linkProduto,
              status: 'pendente',
              scheduled_at: horarioIg.toISOString(),
            })
            console.log(`📸 Instagram agendado: ${produto.nome} para ${horarioIg.toISOString()}`)
          }
        }

        const novoIndex = startIndex + postsHoje
        const proximaExecucao = calcularProximoDiaValido(now, config.dias_semana, config.horario_inicio)

        await supabase.from('autopilot_config')
          .update({
            ultimo_produto_index: novoIndex,
            ultima_execucao: now.toISOString(),
            proxima_execucao: proximaExecucao.toISOString(),
            total_publicados: (config.total_publicados || 0) + postsHoje,
            updated_at: now.toISOString(),
          })
          .eq('id', config.id)

        results.push({
          config_id: config.id,
          produtos_agendados: postsHoje,
          proximo_index: novoIndex,
          proxima_execucao: proximaExecucao.toISOString()
        })

        console.log(`✅ Autopilot ${config.id}: ${postsHoje} posts agendados`)

      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Erro desconhecido'
        console.error(`❌ Erro no autopilot ${config.id}:`, errorMsg)
        results.push({ config_id: config.id, error: errorMsg })
      }
    }

    return new Response(JSON.stringify({
      success: true,
      timestamp: now.toISOString(),
      processed: results.length,
      results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Erro geral autopilot:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

function calcularHorarios(inicio: string, fim: string, quantidade: number, hoje: Date): Date[] {
  const [hInicio, mInicio] = inicio.split(':').map(Number)
  const [hFim, mFim] = fim.split(':').map(Number)
  const inicioMin = hInicio * 60 + mInicio
  const fimMin = hFim * 60 + mFim
  const janelaMin = fimMin - inicioMin
  const horarios: Date[] = []

  if (quantidade === 1) {
    const meioMin = inicioMin + Math.floor(janelaMin / 2)
    const d = new Date(hoje)
    d.setHours(Math.floor(meioMin / 60), meioMin % 60, 0, 0)
    horarios.push(d)
  } else {
    const intervaloMin = Math.floor(janelaMin / quantidade)
    for (let i = 0; i < quantidade; i++) {
      const minutos = inicioMin + (intervaloMin * i) + Math.floor(intervaloMin / 2)
      const d = new Date(hoje)
      d.setHours(Math.floor(minutos / 60), minutos % 60, 0, 0)
      if (d <= hoje) {
        d.setMinutes(d.getMinutes() + Math.floor(Math.random() * 10) + 1)
        if (d <= hoje) {
          d.setDate(d.getDate() + 1)
        }
      }
      horarios.push(d)
    }
  }
  return horarios
}

function calcularProximoDiaValido(hoje: Date, diasSemana: number[], horarioInicio: string): Date {
  const [h, m] = horarioInicio.split(':').map(Number)
  const proximo = new Date(hoje)
  proximo.setDate(proximo.getDate() + 1)
  proximo.setHours(h, m, 0, 0)
  for (let i = 0; i < 7; i++) {
    if (diasSemana.includes(proximo.getDay())) {
      return proximo
    }
    proximo.setDate(proximo.getDate() + 1)
  }
  return proximo
}

function escolherVariacao(estilo: string, index: number): string {
  if (estilo === 'casual') return 'opcaoA'
  if (estilo === 'informativo') return 'opcaoB'
  if (estilo === 'urgente') return 'opcaoC'
  const variacoes = ['opcaoA', 'opcaoB', 'opcaoC']
  return variacoes[index % 3]
}
