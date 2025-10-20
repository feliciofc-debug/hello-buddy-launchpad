import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔐 [HOTMART-AUTH] Iniciando autenticação...');

    const clientId = Deno.env.get('HOTMART_CLIENT_ID');
    const clientSecret = Deno.env.get('HOTMART_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      console.error('❌ [HOTMART-AUTH] Credenciais não configuradas');
      return new Response(
        JSON.stringify({ 
          status: 'error',
          error: 'Credenciais da Hotmart não configuradas' 
        }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Codifica as credenciais em Base64 para autenticação Basic
    const credentials = btoa(`${clientId}:${clientSecret}`);
    console.log('✅ [HOTMART-AUTH] Credenciais codificadas');

    // Faz a requisição para obter o token OAuth2
    const tokenResponse = await fetch('https://api-sec-vlc.hotmart.com/security/oauth/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret
      })
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error('❌ [HOTMART-AUTH] Erro na autenticação:', tokenData);
      return new Response(
        JSON.stringify({ 
          status: 'error',
          error: 'Erro ao autenticar com a Hotmart',
          details: tokenData
        }),
        { 
          status: tokenResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('✅ [HOTMART-AUTH] Token gerado com sucesso!');
    
    return new Response(
      JSON.stringify({ 
        status: 'success',
        message: 'Token da Hotmart gerado com sucesso!',
        access_token: tokenData.access_token,
        expires_in: tokenData.expires_in
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('💥 [HOTMART-AUTH] Erro crítico:', error);
    return new Response(
      JSON.stringify({ 
        status: 'error',
        error: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
