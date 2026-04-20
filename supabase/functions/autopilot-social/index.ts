import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const SAO_PAULO_TIMEZONE = 'America/Sao_Paulo'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const requestBody = req.method === 'POST' ? await req.json().catch(() => ({})) : {}
    const forceRun = requestBody?.force === true
    const configId = typeof requestBody?.config_id === 'string' ? requestBody.config_id : null

    const now = new Date()
    const nowSaoPaulo = getSaoPauloNow()
    const results: any[] = []

    console.log('🤖 [AUTOPILOT] Iniciando execução', {
      now_utc: now.toISOString(),
      now_sp: formatSaoPauloLocalIso(nowSaoPaulo),
      force_run: forceRun,
      config_id: configId,
    })

    let configQuery = supabase
      .from('autopilot_config')
      .select('*')
      .eq('ativo', true)

    if (configId) {
      configQuery = configQuery.eq('id', configId)
    }

    if (!forceRun) {
      configQuery = configQuery.or(`proxima_execucao.is.null,proxima_execucao.lte.${now.toISOString()}`)
    }

    const { data: configs, error: configError } = await configQuery

    if (configError) {
      console.error('❌ [AUTOPILOT] Erro buscando configs:', configError)
      throw new Error(`Erro buscando configs: ${configError.message}`)
    }

    console.log(`📋 [AUTOPILOT] Configs elegíveis encontradas: ${configs?.length || 0}`)

    if (!configs || configs.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'Nenhum autopilot para executar',
        processed: 0,
        now_utc: now.toISOString(),
        now_sp: formatSaoPauloLocalIso(nowSaoPaulo),
        force_run: forceRun,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    for (const config of configs) {
      try {
        console.log('⚙️ [AUTOPILOT] Processando config', {
          config_id: config.id,
          user_id: config.user_id,
          ativo: config.ativo,
          proxima_execucao: config.proxima_execucao,
          posts_por_dia: config.posts_por_dia,
          produto_fonte: config.produto_fonte,
          categoria_filtro: config.categoria_filtro,
          ultimo_produto_index: config.ultimo_produto_index,
          total_publicados: config.total_publicados,
        })

        const diaSemana = nowSaoPaulo.getDay()
        console.log(`📅 [AUTOPILOT] Dia da semana em SP: ${diaSemana}`)

        if (!config.dias_semana?.includes(diaSemana)) {
          const proximoDia = calcularProximoDiaValido(nowSaoPaulo, config.dias_semana || [], config.horario_inicio)
          console.log('⏭️ [AUTOPILOT] Hoje não é dia válido, reagendando', {
            config_id: config.id,
            proxima_execucao_anterior: config.proxima_execucao,
            proxima_execucao_nova: proximoDia.toISOString(),
          })

          await supabase
            .from('autopilot_config')
            .update({
              proxima_execucao: proximoDia.toISOString(),
              updated_at: now.toISOString(),
            })
            .eq('id', config.id)

          results.push({
            config_id: config.id,
            skipped: true,
            reason: 'dia_semana_invalido',
            next_run: proximoDia.toISOString(),
          })
          continue
        }

        let query = supabase
          .from('produtos')
          .select('id, user_id, nome, descricao, preco, imagem_url, link, link_marketplace, categoria, ativo')
          .eq('ativo', true)
          .eq('user_id', config.user_id)
          .order('created_at', { ascending: true })

        if (config.produto_fonte === 'categoria' && config.categoria_filtro) {
          query = query.eq('categoria', config.categoria_filtro)
        } else if (config.produto_fonte === 'manual' && config.produto_ids?.length > 0) {
          query = query.in('id', config.produto_ids)
        }

        const { data: produtos, error: prodError } = await query

        if (prodError) {
          console.error('❌ [AUTOPILOT] Erro buscando produtos:', prodError)
          throw new Error(`Erro buscando produtos: ${prodError.message}`)
        }

        console.log(`📦 [AUTOPILOT] Produtos encontrados para user ${config.user_id}: ${produtos?.length || 0}`)

        if (!produtos || produtos.length === 0) {
          results.push({
            config_id: config.id,
            skipped: true,
            reason: 'nenhum_produto_encontrado',
          })
          continue
        }

        let startIndex = config.ultimo_produto_index || 0
        if (startIndex >= produtos.length) {
          if (config.repetir_ciclo) {
            console.log(`🔁 [AUTOPILOT] Reiniciando ciclo da config ${config.id}`)
            startIndex = 0
          } else {
            console.log(`✅ [AUTOPILOT] Todos os produtos já foram postados. Desativando config ${config.id}`)
            await supabase
              .from('autopilot_config')
              .update({ ativo: false, updated_at: now.toISOString() })
              .eq('id', config.id)

            results.push({
              config_id: config.id,
              skipped: true,
              reason: 'ciclo_encerrado',
            })
            continue
          }
        }

        const postsHoje = Math.min(config.posts_por_dia, produtos.length - startIndex)
        const produtosHoje = produtos.slice(startIndex, startIndex + postsHoje)
        const horarios = calcularHorarios(config.horario_inicio, config.horario_fim, postsHoje, nowSaoPaulo)
        let postsAgendadosComSucesso = 0

        console.log('⏰ [AUTOPILOT] Horários calculados', {
          config_id: config.id,
          horarios_utc: horarios.map((horario) => horario.toISOString()),
          horarios_sp: horarios.map((horario) => formatSaoPauloIso(horario)),
        })

        for (let i = 0; i < produtosHoje.length; i++) {
          const produto = produtosHoje[i]
          const horarioPost = horarios[i]

          try {
            console.log('🧩 [AUTOPILOT] Processando produto', {
              config_id: config.id,
              user_id: config.user_id,
              produto_id: produto.id,
              produto_nome: produto.nome,
              produto_user_id: produto.user_id,
              horario_post_utc: horarioPost.toISOString(),
              horario_post_sp: formatSaoPauloIso(horarioPost),
            })

            let textoFacebook = ''
            let textoInstagram = ''
            let iaStatus = 'nao_usou'

            // === TEXTOS PERSONALIZADOS (quando IA desligada) ===
            if (!config.gerar_texto_ia) {
              const { data: textosPersonalizados } = await supabase
                .from('autopilot_textos_personalizados')
                .select('texto')
                .eq('user_id', config.user_id)
                .eq('ativo', true)

              if (textosPersonalizados && textosPersonalizados.length > 0) {
                const escolhido = textosPersonalizados[Math.floor(Math.random() * textosPersonalizados.length)]
                textoFacebook = escolhido.texto || ''
                textoInstagram = escolhido.texto || ''
                iaStatus = 'texto_personalizado'
                console.log('📝 [AUTOPILOT] Usando texto personalizado', {
                  user_id: config.user_id,
                  total_textos: textosPersonalizados.length,
                })
              } else {
                console.warn('⚠️ [AUTOPILOT] IA desligada mas sem textos personalizados. Fallback para IA.', {
                  user_id: config.user_id,
                })
                iaStatus = 'fallback_ia_sem_textos'
              }
            }

            // === IA (quando ligada OU fallback de texto personalizado vazio) ===
            if (!textoFacebook && (config.gerar_texto_ia || iaStatus === 'fallback_ia_sem_textos')) {
              const controller = new AbortController()
              const timeout = setTimeout(() => controller.abort(), 15000)

              try {
                console.log(`✨ [AUTOPILOT] Chamando gerar-posts para ${produto.nome}`)
                const response = await fetch(`${SUPABASE_URL}/functions/v1/gerar-posts`, {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                    'Content-Type': 'application/json',
                    'apikey': SUPABASE_SERVICE_ROLE_KEY,
                  },
                  signal: controller.signal,
                  body: JSON.stringify({
                    produto: {
                      nome: produto.nome,
                      preco: produto.preco,
                      descricao: produto.descricao || '',
                    }
                  })
                })
                clearTimeout(timeout)

                const iaData = await response.json()
                console.log('📝 [AUTOPILOT] Resposta gerar-posts', {
                  produto_id: produto.id,
                  status: response.status,
                  ok: response.ok,
                  tem_posts: !!iaData?.posts,
                  erro: iaData?.error,
                })

                if (!response.ok) {
                  throw new Error(iaData?.error || `Falha HTTP ${response.status} ao gerar texto`)
                }

                if (iaData?.posts) {
                  const variacaoKey = escolherVariacao(config.estilo_texto, (config.total_publicados || 0) + i)
                  textoFacebook = iaData.posts.facebook?.[variacaoKey] || iaData.posts.facebook?.opcaoA || ''
                  textoInstagram = iaData.posts.instagram?.[variacaoKey] || iaData.posts.instagram?.opcaoA || ''
                  iaStatus = 'ok'
                }
              } catch (iaError) {
                clearTimeout(timeout)
                iaStatus = 'fallback'
                console.error(`⚠️ [AUTOPILOT] Erro/timeout IA para ${produto.nome}, usando texto padrão:`, iaError instanceof Error ? iaError.message : iaError)
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
            console.log('🖼️ [AUTOPILOT] Payload base do post', {
              produto_id: produto.id,
              has_image: !!imagemUrl,
              has_link: !!linkProduto,
              ia_status: iaStatus,
            })

            const { data: metaConn } = await supabase
              .from('meta_connections')
              .select('page_id, ig_account_id')
              .eq('user_id', config.user_id)
              .eq('is_active', true)
              .single()

            const clientPageId = metaConn?.page_id || ''
            const canPostFacebook = Boolean(config.postar_facebook && metaConn?.page_id)
            const canPostInstagram = Boolean(config.postar_instagram && metaConn?.ig_account_id)

            console.log('🔐 [AUTOPILOT] Canais Meta do cliente', {
              user_id: config.user_id,
              facebook: canPostFacebook,
              instagram: canPostInstagram,
              page_id: clientPageId || null,
              ig_account_id: metaConn?.ig_account_id || null,
            })

            if (!canPostFacebook && !canPostInstagram) {
              throw new Error('Cliente sem conexão Meta ativa para os canais configurados')
            }

            if (canPostFacebook) {
              const facebookInsert = await supabase
                .from('social_posts_queue')
                .insert({
                  user_id: config.user_id,
                  produto_id: produto.id,
                  produto_source: 'produtos',
                  platform: 'facebook',
                  page_id: clientPageId,
                  post_text: textoFacebook,
                  image_url: imagemUrl,
                  link_url: linkProduto,
                  status: 'pendente',
                  scheduled_at: horarioPost.toISOString(),
                })
                .select('id')
                .single()

              if (facebookInsert.error) {
                console.error('❌ [AUTOPILOT] Erro insert Facebook:', facebookInsert.error)
                throw new Error(`Erro ao inserir Facebook na fila: ${facebookInsert.error.message}`)
              }

              postsAgendadosComSucesso++

              console.log('📘 [AUTOPILOT] Facebook agendado com sucesso', {
                queue_id: facebookInsert.data?.id,
                produto_id: produto.id,
                horario_utc: horarioPost.toISOString(),
                horario_sp: formatSaoPauloIso(horarioPost),
              })
            } else if (config.postar_facebook) {
              console.log(`⚠️ [AUTOPILOT] Facebook pulado para ${produto.nome}: cliente sem página conectada`)
            }

            if (canPostInstagram && imagemUrl) {
              const horarioIg = new Date(horarioPost.getTime() + 5 * 60 * 1000)
              const instagramInsert = await supabase
                .from('social_posts_queue')
                .insert({
                  user_id: config.user_id,
                  produto_id: produto.id,
                  produto_source: 'produtos',
                  platform: 'instagram',
                  page_id: clientPageId,
                  post_text: textoInstagram,
                  image_url: imagemUrl,
                  link_url: linkProduto,
                  status: 'pendente',
                  scheduled_at: horarioIg.toISOString(),
                })
                .select('id')
                .single()

              if (instagramInsert.error) {
                console.error('❌ [AUTOPILOT] Erro insert Instagram:', instagramInsert.error)
                throw new Error(`Erro ao inserir Instagram na fila: ${instagramInsert.error.message}`)
              }

              postsAgendadosComSucesso++

              console.log('📸 [AUTOPILOT] Instagram agendado com sucesso', {
                queue_id: instagramInsert.data?.id,
                produto_id: produto.id,
                horario_utc: horarioIg.toISOString(),
                horario_sp: formatSaoPauloIso(horarioIg),
              })
            } else if (config.postar_instagram && !imagemUrl) {
              console.log(`⚠️ [AUTOPILOT] Instagram pulado para ${produto.nome}: sem imagem`)
            } else if (config.postar_instagram) {
              console.log(`⚠️ [AUTOPILOT] Instagram pulado para ${produto.nome}: cliente sem Instagram conectado`)
            }
          } catch (produtoError) {
            const errMsg = produtoError instanceof Error ? produtoError.message : 'Erro desconhecido'
            console.error(`❌ [AUTOPILOT] Erro no produto ${produto.nome} (${produto.id}), CONTINUANDO com próximo produto:`, errMsg)
            continue
          }
        }

        const novoIndex = startIndex + postsHoje
        const proximaExecucao = calcularProximoDiaValido(nowSaoPaulo, config.dias_semana || [], config.horario_inicio)

        const updateResult = await supabase
          .from('autopilot_config')
          .update({
            ultimo_produto_index: novoIndex,
            ultima_execucao: now.toISOString(),
            proxima_execucao: proximaExecucao.toISOString(),
            total_publicados: (config.total_publicados || 0) + postsHoje,
            updated_at: now.toISOString(),
          })
          .eq('id', config.id)

        if (updateResult.error) {
          console.error('❌ [AUTOPILOT] Erro atualizando config:', updateResult.error)
          throw new Error(`Erro atualizando config: ${updateResult.error.message}`)
        }

        results.push({
          config_id: config.id,
          user_id: config.user_id,
          produtos_agendados: postsHoje,
          proximo_index: novoIndex,
          proxima_execucao: proximaExecucao.toISOString(),
          proxima_execucao_sp: formatSaoPauloIso(proximaExecucao),
        })

        console.log(`✅ [AUTOPILOT] Config ${config.id} concluída: ${postsAgendadosComSucesso} posts agendados de ${postsHoje} produtos`)
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Erro desconhecido'
        console.error(`❌ [AUTOPILOT] Erro na config ${config.id}:`, errorMsg)
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
    console.error('❌ [AUTOPILOT] Erro geral:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

function calcularHorarios(inicio: string, fim: string, quantidade: number, agoraSaoPaulo: Date): Date[] {
  const [hInicio, mInicio] = inicio.split(':').map(Number)
  const [hFim, mFim] = fim.split(':').map(Number)
  const inicioMin = hInicio * 60 + mInicio
  const fimMin = hFim * 60 + mFim
  const horarios: Date[] = []

  if (quantidade <= 0) return horarios

  const agoraMin = agoraSaoPaulo.getHours() * 60 + agoraSaoPaulo.getMinutes()
  const primeiroHorarioMin = Math.max(inicioMin, agoraMin + 5)

  // Se a janela do dia praticamente acabou, mantém o disparo ainda hoje
  // em cadência curta, em vez de empurrar tudo para amanhã.
  if (primeiroHorarioMin >= fimMin) {
    for (let i = 0; i < quantidade; i++) {
      const minutos = primeiroHorarioMin + (i * 10)
      const d = createUtcDateFromSaoPaulo(agoraSaoPaulo, Math.floor(minutos / 60), minutos % 60)
      ajustarHorarioSePassou(d, agoraSaoPaulo)
      horarios.push(d)
    }
    return horarios
  }

  if (quantidade === 1) {
    const d = createUtcDateFromSaoPaulo(agoraSaoPaulo, Math.floor(primeiroHorarioMin / 60), primeiroHorarioMin % 60)
    ajustarHorarioSePassou(d, agoraSaoPaulo)
    horarios.push(d)
    return horarios
  }

  const janelaRestanteMin = Math.max(fimMin - primeiroHorarioMin, 1)
  const intervaloMin = Math.max(Math.floor(janelaRestanteMin / quantidade), 10)

  for (let i = 0; i < quantidade; i++) {
    const minutos = primeiroHorarioMin + (intervaloMin * i)
    const d = createUtcDateFromSaoPaulo(agoraSaoPaulo, Math.floor(minutos / 60), minutos % 60)
    ajustarHorarioSePassou(d, agoraSaoPaulo)
    horarios.push(d)
  }

  return horarios
}

function ajustarHorarioSePassou(dataUtc: Date, agoraSaoPaulo: Date) {
  const agoraUtc = saoPauloLocalToUtc(agoraSaoPaulo)
  if (dataUtc <= agoraUtc) {
    // Se o horário já passou HOJE, agendar pra daqui 5-15 minutos
    // NÃO pular pro dia seguinte
    const novosMs = agoraUtc.getTime() + (Math.floor(Math.random() * 10) + 5) * 60 * 1000
    dataUtc.setTime(novosMs)
  }
}

function calcularProximoDiaValido(agoraSaoPaulo: Date, diasSemana: number[], horarioInicio: string): Date {
  const [h, m] = horarioInicio.split(':').map(Number)

  // Tenta primeiro rodar HOJE no horário de início, se ainda não passou e hoje for dia válido
  const hoje = new Date(agoraSaoPaulo)
  hoje.setHours(h, m, 0, 0)
  const aindaHaJanelaHoje = hoje > agoraSaoPaulo
  if (aindaHaJanelaHoje && diasSemana.includes(hoje.getDay())) {
    return saoPauloLocalToUtc(hoje)
  }

  // Caso contrário, procura o próximo dia válido (a partir de amanhã)
  const proximo = new Date(agoraSaoPaulo)
  proximo.setDate(proximo.getDate() + 1)
  proximo.setHours(h, m, 0, 0)

  for (let i = 0; i < 7; i++) {
    if (diasSemana.includes(proximo.getDay())) {
      return saoPauloLocalToUtc(proximo)
    }
    proximo.setDate(proximo.getDate() + 1)
  }

  return saoPauloLocalToUtc(proximo)
}

function createUtcDateFromSaoPaulo(baseSaoPaulo: Date, hours: number, minutes: number) {
  const localDate = new Date(baseSaoPaulo)
  localDate.setHours(hours, minutes, 0, 0)
  return saoPauloLocalToUtc(localDate)
}

function getSaoPauloNow() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SAO_PAULO_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(new Date())

  const readPart = (type: string) => Number(parts.find((part) => part.type === type)?.value || 0)

  return new Date(
    readPart('year'),
    readPart('month') - 1,
    readPart('day'),
    readPart('hour'),
    readPart('minute'),
    readPart('second'),
    0,
  )
}

function saoPauloLocalToUtc(localDate: Date) {
  return new Date(Date.UTC(
    localDate.getFullYear(),
    localDate.getMonth(),
    localDate.getDate(),
    localDate.getHours() + 3,
    localDate.getMinutes(),
    localDate.getSeconds(),
    localDate.getMilliseconds(),
  ))
}

function formatSaoPauloIso(date: Date) {
  return date.toLocaleString('sv-SE', {
    timeZone: SAO_PAULO_TIMEZONE,
    hour12: false,
  }).replace(' ', 'T')
}

function formatSaoPauloLocalIso(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`
}

function escolherVariacao(estilo: string, index: number): string {
  if (estilo === 'casual') return 'opcaoA'
  if (estilo === 'informativo') return 'opcaoB'
  if (estilo === 'urgente') return 'opcaoC'
  const variacoes = ['opcaoA', 'opcaoB', 'opcaoC']
  return variacoes[index % 3]
}
