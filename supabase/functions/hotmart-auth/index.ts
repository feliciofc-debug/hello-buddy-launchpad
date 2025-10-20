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

    // Log parcial para debug (primeiros 8 caracteres)
    console.log(`✅ [HOTMART-AUTH] Client ID: ${clientId.substring(0, 8)}...`);
    console.log(`✅ [HOTMART-AUTH] Client Secret: ${clientSecret.substring(0, 8)}...`);

    // Prepara dados no formato application/x-www-form-urlencoded
    console.log('📡 [HOTMART-AUTH] Enviando requisição para API Hotmart...');
    
    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);
    
    const tokenResponse = await fetch('https://api-sec-vlc.hotmart.com/security/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString()
    });

    console.log(`📡 [HOTMART-AUTH] Status da resposta: ${tokenResponse.status}`);
    
    // Pega o texto primeiro para debug
    const responseText = await tokenResponse.text();
    console.log(`📡 [HOTMART-AUTH] Resposta (primeiros 200 chars): ${responseText.substring(0, 200)}`);

    if (!tokenResponse.ok) {
      // Tenta parsear como JSON, se falhar mostra o texto
      let errorData;
      try {
        errorData = JSON.parse(responseText);
      } catch {
        errorData = { raw_response: responseText };
      }
      
      console.error('❌ [HOTMART-AUTH] Erro na autenticação:', errorData);
      return new Response(
        JSON.stringify({ 
          status: 'error',
          error: 'Erro ao autenticar com a Hotmart',
          details: errorData
        }),
        { 
          status: tokenResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Tenta parsear o JSON
    let tokenData;
    try {
      tokenData = JSON.parse(responseText);
    } catch (parseError) {
      console.error('❌ [HOTMART-AUTH] Erro ao parsear JSON:', parseError);
      return new Response(
        JSON.stringify({ 
          status: 'error',
          error: 'Resposta inválida da API Hotmart',
          details: { raw_response: responseText }
        }),
        { 
          status: 500,
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

  } catch (error: any) {
    console.error('💥 [HOTMART-AUTH] Erro crítico:', error);
    return new Response(
      JSON.stringify({ 
        status: 'error',
        error: error?.message || 'Erro desconhecido' 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
