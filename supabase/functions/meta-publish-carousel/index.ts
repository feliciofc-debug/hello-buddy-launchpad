const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { user_id, image_urls, caption } = await req.json()
    if (!user_id || !image_urls?.length) {
      return new Response(JSON.stringify({ error: 'user_id e image_urls são obrigatórios' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get user's meta connection
    const { data: metaConn, error: metaErr } = await supabase
      .from('meta_connections')
      .select('*')
      .eq('user_id', user_id)
      .single()

    if (metaErr || !metaConn) {
      return new Response(JSON.stringify({ error: 'Conexão Meta não encontrada. Conecte seu Instagram primeiro.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { page_access_token, ig_account_id } = metaConn
    if (!page_access_token || !ig_account_id) {
      return new Response(JSON.stringify({ error: 'Token ou conta Instagram não configurados' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const graphUrl = 'https://graph.facebook.com/v25.0'

    // Step 1: Create carousel item containers
    const childrenIds: string[] = []
    for (const imageUrl of image_urls) {
      const res = await fetch(`${graphUrl}/${ig_account_id}/media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url: imageUrl,
          is_carousel_item: true,
          access_token: page_access_token,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(`Erro ao criar item: ${data.error.message}`)
      childrenIds.push(data.id)
    }

    // Step 2: Create carousel container
    const carouselRes = await fetch(`${graphUrl}/${ig_account_id}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        media_type: 'CAROUSEL',
        children: childrenIds.join(','),
        caption: caption || '',
        access_token: page_access_token,
      }),
    })
    const carouselData = await carouselRes.json()
    if (carouselData.error) throw new Error(`Erro ao criar carrossel: ${carouselData.error.message}`)

    // Step 3: Publish
    const publishRes = await fetch(`${graphUrl}/${ig_account_id}/media_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creation_id: carouselData.id,
        access_token: page_access_token,
      }),
    })
    const publishData = await publishRes.json()
    if (publishData.error) throw new Error(`Erro ao publicar: ${publishData.error.message}`)

    return new Response(JSON.stringify({ success: true, id: publishData.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
