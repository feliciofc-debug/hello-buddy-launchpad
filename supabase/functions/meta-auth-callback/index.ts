import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

// Define os cabeçalhos CORS para permitir requisições de qualquer origem
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Trata a requisição pre-flight OPTIONS, essencial para CORS
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

    // Validação crucial das variáveis de ambiente
    if (!APP_ID || !APP_SECRET) {
      console.error('meta-auth-callback: ERRO CRÍTICO - Variáveis de ambiente META_APP_ID ou META_APP_SECRET não encontradas!');
      throw new Error('Configuração do servidor incompleta: credenciais da Meta ausentes.');
    }

    // ATENÇÃO: A URL de redirecionamento DEVE ser exatamente a mesma configurada no painel de desenvolvedores da Meta
    const REDIRECT_URI = Deno.env.get('META_REDIRECT_URI') || 'https://amzofertas.com.br/auth/callback/meta';

    const tokenUrl = `https://graph.facebook.com/v18.0/oauth/access_token?client_id=${APP_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&client_secret=${APP_SECRET}&code=${code}`;

    // Etapa 1: Trocar o código por um token de acesso de curta duração
    const tokenResponse = await fetch(tokenUrl);
    const tokenData = await tokenResponse.json();

    // Se a resposta não for bem-sucedida, retorne um log detalhado
    if (!tokenResponse.ok || tokenData.error) {
      console.error('meta-auth-callback: Erro ao obter token de curta duração:', { status: tokenResponse.status, body: tokenData });
      return new Response(JSON.stringify({
        error: 'Erro ao obter token de acesso de curta duração da Meta.',
        status: tokenResponse.status,
        details: tokenData
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      });
    }

    const shortLivedToken = tokenData.access_token;
    const longLivedTokenUrl = `https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${APP_ID}&client_secret=${APP_SECRET}&fb_exchange_token=${shortLivedToken}`;

    // Etapa 2: Trocar o token de curta duração por um de longa duração
    const longLivedTokenResponse = await fetch(longLivedTokenUrl);
    const longLivedTokenData = await longLivedTokenResponse.json();

    // Se a resposta não for bem-sucedida, retorne um log detalhado
    if (!longLivedTokenResponse.ok || longLivedTokenData.error) {
      console.error('meta-auth-callback: Erro ao obter token de longa duração:', { status: longLivedTokenResponse.status, body: longLivedTokenData });
      return new Response(JSON.stringify({
        error: 'Erro ao obter token de acesso de longa duração da Meta.',
        status: longLivedTokenResponse.status,
        details: longLivedTokenData
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      });
    }

    const longLivedAccessToken = longLivedTokenData.access_token;

    // Sucesso! Retorne uma resposta positiva.
    return new Response(
      JSON.stringify({
        message: "Conexão com a Meta realizada com sucesso!",
        accessToken: longLivedAccessToken
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    // Captura qualquer outro erro inesperado no processo
    console.error('meta-auth-callback: Erro inesperado no bloco catch:', error);
    const errorMessage = error instanceof Error ? error.message : 'Um erro inesperado ocorreu.';
    const errorDetails = error instanceof Error ? error.stack : String(error);
    return new Response(JSON.stringify({
      error: errorMessage,
      details: errorDetails
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
})
