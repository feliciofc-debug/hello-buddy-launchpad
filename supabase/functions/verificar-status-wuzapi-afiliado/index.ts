import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token } = await req.json();
    
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Token é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const CONTABO_URL = Deno.env.get('CONTABO_WUZAPI_URL') || 'https://api2.amzofertas.com.br';
    
    console.log(`[verificar-status] Verificando token: ${token.substring(0, 8)}...`);
    console.log(`[verificar-status] URL: ${CONTABO_URL}/session/status`);

    const response = await fetch(`${CONTABO_URL}/session/status`, {
      method: 'GET',
      headers: { 'Token': token }
    });

    const result = await response.json();
    console.log(`[verificar-status] Resposta:`, JSON.stringify(result));

    // Normalizar resposta
    const data = result.data || result;
    const isConnected = data.loggedIn === true || data.LoggedIn === true || data.connected === true;
    const jid = data.jid || data.Jid || null;

    return new Response(
      JSON.stringify({
        success: true,
        connected: isConnected,
        jid,
        raw: result
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('[verificar-status] Erro:', errorMessage);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage,
        connected: false
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
