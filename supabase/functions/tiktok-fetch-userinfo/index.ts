import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const { user_id } = await req.json()

    if (!user_id) {
      return new Response(
        JSON.stringify({ connected: false, error: 'missing_user_id' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { data: integration, error } = await supabase
      .from('integrations')
      .select('*')
      .eq('user_id', user_id)
      .eq('platform', 'tiktok')
      .eq('is_active', true)
      .maybeSingle()

    if (error || !integration) {
      return new Response(
        JSON.stringify({ connected: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    const baseConnectedPayload = {
      connected: true as const,
      open_id: integration.meta_user_id,
      scope: (integration as any).scope || null,
      last_verified_at: integration.updated_at,
      connected_at: integration.created_at,
    }

    try {
      const userInfoResp = await fetch(
        'https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name,username',
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${integration.access_token}`,
          },
        }
      )

      if (userInfoResp.status === 401) {
        await userInfoResp.text()
        return new Response(
          JSON.stringify({ ...baseConnectedPayload, expired: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
      }

      if (!userInfoResp.ok) {
        await userInfoResp.text()
        return new Response(
          JSON.stringify({ ...baseConnectedPayload, error: 'fetch_failed' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
      }

      const json = await userInfoResp.json()
      const u = json?.data?.user || {}

      return new Response(
        JSON.stringify({
          ...baseConnectedPayload,
          display_name: u.display_name || null,
          username: u.username || null,
          avatar_url: u.avatar_url || null,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    } catch (fetchErr) {
      console.error('TikTok user/info fetch error:', fetchErr)
      return new Response(
        JSON.stringify({ ...baseConnectedPayload, error: 'fetch_failed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }
  } catch (err) {
    console.error('tiktok-fetch-userinfo error:', err)
    return new Response(
      JSON.stringify({ connected: false, error: err instanceof Error ? err.message : 'unknown' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  }
})
