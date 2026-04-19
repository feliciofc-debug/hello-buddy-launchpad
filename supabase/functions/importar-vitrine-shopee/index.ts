import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from '../_shared/cors.ts'

// ============================================================
// importar-vitrine-shopee
// Importa todos os produtos de uma vitrine de afiliado Shopee
// (collshp.com/<slug>) usando a API GraphQL interna do collshp.
// Sem extensão, sem API oficial Shopee, sem SCRAPER_API_KEY.
// ============================================================

const SHOPEE_IMG_BASE = 'https://down-bs-br.img.susercontent.com'
const PAGE_LIMIT = 20
const MAX_PAGES = 25 // teto de 500 produtos

const GRAPHQL_QUERY = `query StorefrontProductListQuery($urlSuffix: String!, $cid: String!, $language: String!, $listType: String!, $sortType: String!, $page: PageInput!) {
  storefrontProductList(urlSuffix: $urlSuffix, cid: $cid, language: $language, listType: $listType, sortType: $sortType, page: $page) {
    itemList {
      linkId
      link
      linkName
      image
      linkType
      itemId
      isPined
      h5Link
      itemCard
    }
    pagination {
      offset
      limit
      hasMore
      totalCount
    }
  }
}`

function extractUrlSuffix(input: string): string | null {
  if (!input) return null
  const trimmed = input.trim()
  // Tenta tratar como URL completa
  try {
    const url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`)
    if (url.hostname.includes('collshp.com')) {
      const slug = url.pathname.replace(/^\/+|\/+$/g, '').split('/')[0]
      if (slug && /^[A-Za-z0-9_.\-]+$/.test(slug)) return slug
    }
  } catch (_) {
    // não é URL válida — segue
  }
  // Username puro (sem espaços, sem barras)
  if (/^[A-Za-z0-9_.\-]+$/.test(trimmed)) return trimmed
  return null
}

function imageHashToUrl(hash: string): string {
  if (!hash) return ''
  if (hash.startsWith('http://') || hash.startsWith('https://')) return hash
  // Garantir extensão
  if (/\.(avif|jpg|jpeg|png|webp)$/i.test(hash)) {
    return `${SHOPEE_IMG_BASE}/${hash}`
  }
  return `${SHOPEE_IMG_BASE}/${hash}.avif`
}

interface ShopeeItem {
  linkId?: string
  link?: string
  linkName?: string
  image?: string
  linkType?: string
  itemId?: string
  itemCard?: any
}

async function fetchPage(urlSuffix: string, offset: number) {
  const body = {
    operationName: 'StorefrontProductListQuery',
    query: GRAPHQL_QUERY,
    variables: {
      urlSuffix,
      cid: 'br',
      language: 'pt',
      listType: 'ALL',
      sortType: 'LATEST',
      page: { offset: String(offset), limit: String(PAGE_LIMIT) },
    },
  }

  const res = await fetch(
    'https://collshp.com/api/v3/gql/graphql?q=StorefrontProductListQuery',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Origin': 'https://collshp.com',
        'Referer': `https://collshp.com/${urlSuffix}`,
      },
      body: JSON.stringify(body),
    },
  )

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Shopee/collshp HTTP ${res.status}: ${text.slice(0, 200)}`)
  }

  const json = await res.json()
  const list = json?.data?.storefrontProductList
  if (!list) {
    throw new Error('Resposta inesperada do collshp.com (sem storefrontProductList)')
  }
  return list as {
    itemList: ShopeeItem[]
    pagination: { offset: string; limit: string; hasMore: boolean; totalCount: string }
  }
}

function mapItem(item: ShopeeItem, userId: string) {
  const card = item.itemCard || {}
  const nome = String(item.linkName || card.name || '').slice(0, 500)
  if (!nome) return null

  const link = item.link || ''
  if (!link) return null

  // preço em micro-reais → reais
  const rawPrice = Number(card?.displayPrice?.price ?? card?.price ?? 0)
  const preco = rawPrice > 0 ? Math.round((rawPrice / 100000) * 100) / 100 : null

  // Imagens
  const imageHashes: string[] = Array.isArray(card?.images) ? card.images : []
  const imagensFull = imageHashes.map(imageHashToUrl).filter(Boolean)

  let imagem_url: string | null = null
  if (imagensFull.length > 0) {
    imagem_url = imagensFull[0]
  } else if (item.image) {
    imagem_url = imageHashToUrl(item.image)
  }

  return {
    user_id: userId,
    nome,
    preco,
    imagem_url,
    imagens: imagensFull,
    link,
    categoria: 'Importado Shopee',
    ativo: true,
    tipo: 'fisico',
    estoque: 0,
    descricao: null as string | null,
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { vitrine_url, user_id } = await req.json().catch(() => ({}))

    if (!user_id || typeof user_id !== 'string') {
      return new Response(JSON.stringify({ error: 'user_id obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const urlSuffix = extractUrlSuffix(vitrine_url || '')
    if (!urlSuffix) {
      return new Response(
        JSON.stringify({ error: 'Link inválido. Use collshp.com/sualoja' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    console.log(`[VITRINE] Iniciando importação: vitrine=${urlSuffix} user=${user_id}`)

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const allItems: ShopeeItem[] = []
    let totalCount = 0
    let pageNum = 0
    let offset = 0
    let hasMore = true

    while (hasMore && pageNum < MAX_PAGES) {
      try {
        console.log(`[VITRINE] Buscando página ${pageNum + 1} (offset=${offset})`)
        const page = await fetchPage(urlSuffix, offset)
        const items = page.itemList || []
        allItems.push(...items)
        totalCount = Number(page.pagination?.totalCount || totalCount)
        hasMore = !!page.pagination?.hasMore && items.length > 0
        offset += PAGE_LIMIT
        pageNum += 1
        console.log(
          `[VITRINE] Página ${pageNum} OK — itens=${items.length} total acumulado=${allItems.length} hasMore=${hasMore}`,
        )
      } catch (err: any) {
        console.error(`[VITRINE] Erro na página ${pageNum + 1}:`, err?.message)
        if (pageNum === 0) {
          return new Response(
            JSON.stringify({
              error: 'Falha ao buscar a vitrine na Shopee/collshp',
              detail: String(err?.message || err),
            }),
            { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          )
        }
        // Falha em página posterior: continua com o que já foi coletado
        break
      }
    }

    console.log(`[VITRINE] Total lido=${allItems.length} de ${totalCount}`)

    // Mapear
    const mapped: ReturnType<typeof mapItem>[] = []
    let rejeitados = 0
    for (const item of allItems) {
      const m = mapItem(item, user_id)
      if (m) mapped.push(m)
      else rejeitados += 1
    }

    // Dedup por link (no usuário)
    const links = mapped.map((m) => m!.link)
    let duplicadosLinks = new Set<string>()
    if (links.length > 0) {
      const { data: existing, error: selErr } = await supabaseAdmin
        .from('produtos')
        .select('link')
        .eq('user_id', user_id)
        .in('link', links)
      if (selErr) {
        console.error('[VITRINE] Erro no dedup:', selErr)
      } else {
        duplicadosLinks = new Set((existing || []).map((r: any) => r.link))
      }
    }

    const toInsert = mapped.filter((m) => !duplicadosLinks.has(m!.link))
    console.log(
      `[VITRINE] Mapeados=${mapped.length} duplicados=${duplicadosLinks.size} a inserir=${toInsert.length}`,
    )

    // Inserir em lotes de 50
    let inseridos = 0
    const BATCH = 50
    for (let i = 0; i < toInsert.length; i += BATCH) {
      const chunk = toInsert.slice(i, i + BATCH)
      const { error: insErr, count } = await supabaseAdmin
        .from('produtos')
        .insert(chunk, { count: 'exact' })
      if (insErr) {
        console.error('[VITRINE] Erro no insert do lote:', insErr)
      } else {
        inseridos += count ?? chunk.length
      }
    }

    const result = {
      success: true,
      vitrine: urlSuffix,
      total_na_vitrine: totalCount,
      total_lidos: allItems.length,
      total_rejeitados: rejeitados,
      total_duplicados: duplicadosLinks.size,
      total_importados: inseridos,
    }
    console.log('[VITRINE] Concluído:', JSON.stringify(result))

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err: any) {
    console.error('[VITRINE] Erro geral:', err)
    return new Response(
      JSON.stringify({ error: err?.message || 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
