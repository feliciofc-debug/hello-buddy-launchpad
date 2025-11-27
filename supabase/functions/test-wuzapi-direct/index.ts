import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const logs: string[] = [];
  const addLog = (msg: string) => {
    logs.push(`[${new Date().toLocaleTimeString()}] ${msg}`);
    console.log(msg);
  };

  try {
    const { telefone, mensagem } = await req.json();

    addLog('🚀 Iniciando teste direto Wuzapi');

    const WUZAPI_URL = Deno.env.get('WUZAPI_URL');
    const WUZAPI_TOKEN = Deno.env.get('WUZAPI_TOKEN');
    const WUZAPI_INSTANCE_ID = Deno.env.get('WUZAPI_INSTANCE_ID');

    addLog(`📡 URL: ${WUZAPI_URL}`);
    addLog(`🔑 Token existe: ${!!WUZAPI_TOKEN}`);
    addLog(`🆔 Instance: ${WUZAPI_INSTANCE_ID}`);
    addLog(`📱 Telefone: ${telefone}`);
    addLog(`💬 Mensagem: ${mensagem}`);

    if (!WUZAPI_URL || !WUZAPI_TOKEN) {
      addLog('❌ Wuzapi não configurado!');
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Wuzapi não configurado',
        logs 
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const baseUrl = WUZAPI_URL.endsWith('/') ? WUZAPI_URL.slice(0, -1) : WUZAPI_URL;

    // Testar formato 1
    addLog('');
    addLog('═══ FORMATO 1: /chat/send/text ═══');
    try {
      const url1 = `${baseUrl}/chat/send/text`;
      const body1 = { Phone: telefone, Body: mensagem, Id: WUZAPI_INSTANCE_ID };
      addLog(`URL: ${url1}`);
      addLog(`Body: ${JSON.stringify(body1)}`);

      const res1 = await fetch(url1, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Token': WUZAPI_TOKEN },
        body: JSON.stringify(body1)
      });
      const text1 = await res1.text();
      addLog(`Status: ${res1.status}`);
      addLog(`Response: ${text1}`);

      if (res1.ok) {
        addLog('✅ SUCESSO FORMATO 1!');
        return new Response(JSON.stringify({ 
          success: true, 
          formato: 'chat/send/text',
          status: res1.status,
          response: text1,
          logs 
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    } catch (e: any) {
      addLog(`❌ Erro: ${e.message}`);
    }

    // Testar formato 2
    addLog('');
    addLog('═══ FORMATO 2: /send/text ═══');
    try {
      const url2 = `${baseUrl}/send/text`;
      const body2 = { phone: telefone, message: mensagem };
      addLog(`URL: ${url2}`);
      addLog(`Body: ${JSON.stringify(body2)}`);

      const res2 = await fetch(url2, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Token': WUZAPI_TOKEN },
        body: JSON.stringify(body2)
      });
      const text2 = await res2.text();
      addLog(`Status: ${res2.status}`);
      addLog(`Response: ${text2}`);

      if (res2.ok) {
        addLog('✅ SUCESSO FORMATO 2!');
        return new Response(JSON.stringify({ 
          success: true, 
          formato: 'send/text',
          status: res2.status,
          response: text2,
          logs 
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    } catch (e: any) {
      addLog(`❌ Erro: ${e.message}`);
    }

    // Testar formato 3
    addLog('');
    addLog('═══ FORMATO 3: /send-message ═══');
    try {
      const url3 = `${baseUrl}/send-message`;
      const body3 = { phone: telefone, message: mensagem };
      addLog(`URL: ${url3}`);
      addLog(`Body: ${JSON.stringify(body3)}`);

      const res3 = await fetch(url3, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Token': WUZAPI_TOKEN },
        body: JSON.stringify(body3)
      });
      const text3 = await res3.text();
      addLog(`Status: ${res3.status}`);
      addLog(`Response: ${text3}`);

      if (res3.ok) {
        addLog('✅ SUCESSO FORMATO 3!');
        return new Response(JSON.stringify({ 
          success: true, 
          formato: 'send-message',
          status: res3.status,
          response: text3,
          logs 
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    } catch (e: any) {
      addLog(`❌ Erro: ${e.message}`);
    }

    addLog('');
    addLog('❌ TODOS OS FORMATOS FALHARAM!');

    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Todos formatos falharam',
      logs 
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    addLog(`❌ ERRO GERAL: ${error.message}`);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message,
      logs 
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
