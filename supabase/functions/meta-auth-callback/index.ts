import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'

const REDIRECT_URI = 'http://localhost:5173/auth/callback/meta';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { code } = await req.json();
    if (!code) {
      throw new Error("O código de autorização da Meta não foi fornecido.");
    }

    const APP_ID = Deno.env.get('META_APP_ID');
    const APP_SECRET = Deno.env.get('META_APP_SECRET');

    const tokenUrl = `https://graph.facebook.com/v18.0/oauth/access_token?client_id=${APP_ID}&redirect_uri=${REDIRECT_URI}&client_secret=${APP_SECRET}&code=${code}`;
    
    const tokenResponse = await fetch(tokenUrl);
    const tokenData = await tokenResponse.json();
    
    if (tokenData.error) {
      throw new Error(`Erro da Meta (token curto): ${tokenData.error.message}`);
    }
    const shortLivedToken = tokenData.access_token;

    const longLivedTokenUrl = `https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${APP_ID}&client_secret=${APP_SECRET}&fb_exchange_token=${shortLivedToken}`;
    
    const longLivedTokenResponse = await fetch(longLivedTokenUrl);
    const longLivedTokenData = await longLivedTokenResponse.json();

    if (longLivedTokenData.error) {
      throw new Error(`Erro da Meta (token longo): ${longLivedTokenData.error.message}`);
    }
    const longLivedAccessToken = longLivedTokenData.access_token;

    return new Response(
      JSON.stringify({ 
        message: "Conexão com a Meta realizada com sucesso!",
        accessToken: longLivedAccessToken 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
