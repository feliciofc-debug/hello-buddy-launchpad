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
    console.log(`✅ [HOTMART-AUTH] Client ID length: ${clientId.length}`);
    console.log(`✅ [HOTMART-AUTH] Client Secret length: ${clientSecret.length}`);

    // Formato exato conforme documentação Hotmart
    const body = `grant_type=client_credentials&client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}`;
    
    console.log(`📡 [HOTMART-AUTH] Enviando requisição para API Hotmart...`);
    console.log(`📤 [HOTMART-AUTH] Body preview: grant_type=client_credentials&client_id=${clientId.substring(0, 8)}...&client_secret=${clientSecret.substring(0, 8)}...`);
    console.log(`📤 [HOTMART-AUTH] Body length: ${body.length} chars`);
    
    const tokenResponse = await fetch('https://api-sec-vlc.hotmart.com/security/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: body
    });

    console.log(`📡 [HOTMART-AUTH] Status da resposta: ${tokenResponse.status}`);
    console.log(`📡 [HOTMART-AUTH] Headers da resposta:`, Object.fromEntries(tokenResponse.headers.entries()));
    
    // Pega o texto primeiro para debug
    const responseText = await tokenResponse.text();
    console.log(`📡 [HOTMART-AUTH] Resposta completa: ${responseText}`);

    if (!tokenResponse.ok) {
      // Tenta parsear como JSON, se falhar mostra o texto
      let errorData;
      try {
        errorData = JSON.parse(responseText);
      } catch {
        errorData = { 
          raw_response: responseText,
          status: tokenResponse.status,
          statusText: tokenResponse.statusText
        };
      }
      
      console.error('❌ [HOTMART-AUTH] Erro na autenticação:', errorData);
      console.error('❌ [HOTMART-AUTH] Verifique se as credenciais Client ID e Client Secret estão corretas');
      
      return new Response(
        JSON.stringify({ 
          status: 'error',
          error: 'Erro ao autenticar com a Hotmart - Verifique suas credenciais',
          details: errorData,
          hint: 'Certifique-se de que o Client ID e Client Secret estão corretos e foram criados em https://app-vlc.hotmart.com/tools/credentials'
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
