import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  getValidTikTokAccessToken,
  TIKTOK_RECONNECT_MESSAGE,
  TIKTOK_TEMPORARILY_UNAVAILABLE_MESSAGE,
} from '../_shared/tiktok-token.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
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

    let token = await getValidTikTokAccessToken(supabase, user_id)
    if (!token.ok && token.error === 'not_connected') {
      return new Response(
        JSON.stringify({ connected: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }
    if (!token.ok) {
      const integration = token.integration
      const reconnectRequired = token.error === 'tiktok_reconnect_required'
      return new Response(
        JSON.stringify({
          connected: true,
          reconnect_required: reconnectRequired,
          expired: reconnectRequired,
          verification_unavailable: !reconnectRequired,
          error: token.error,
          message: reconnectRequired
            ? TIKTOK_RECONNECT_MESSAGE
            : TIKTOK_TEMPORARILY_UNAVAILABLE_MESSAGE,
          open_id: integration?.meta_user_id || null,
          last_verified_at: integration?.updated_at || null,
          connected_at: integration?.created_at || null,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }
    const integration = token.integration

    const baseConnectedPayload = {
      connected: true as const,
      open_id: integration.meta_user_id,
      scope: (integration as any).scope || null,
      last_verified_at: integration.updated_at,
      connected_at: integration.created_at,
    }

    try {
      const fetchUserInfo = (accessToken: string) =>
        fetch('https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name,username', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        })
      let userInfoResp = await fetchUserInfo(token.accessToken)

      if (userInfoResp.status === 401) {
        await userInfoResp.text()
        token = await getValidTikTokAccessToken(supabase, user_id, { forceRefresh: true })
        if (!token.ok) {
          const reconnectRequired = token.error === 'tiktok_reconnect_required'
          return new Response(
            JSON.stringify({
              ...baseConnectedPayload,
              expired: reconnectRequired,
              reconnect_required: reconnectRequired,
              verification_unavailable: !reconnectRequired,
              error: token.error,
              message: token.message,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
          )
        }
        userInfoResp = await fetchUserInfo(token.accessToken)
      }
      if (userInfoResp.status === 401) {
        await userInfoResp.text()
        return new Response(
          JSON.stringify({
            ...baseConnectedPayload,
            expired: true,
            reconnect_required: true,
            error: 'tiktok_reconnect_required',
            message: TIKTOK_RECONNECT_MESSAGE,
          }),
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
