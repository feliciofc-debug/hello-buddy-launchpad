import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  // Trata a requisição pre-flight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('meta-auth-callback: Iniciando processamento...');
    
    // 1. Pega o código de autorização enviado pelo frontend
    const { code } = await req.json();
    if (!code) {
      throw new Error("O código de autorização da Meta não foi fornecido.");
    }
    console.log('meta-auth-callback: Código recebido');

    // 2. Pega as credenciais dos segredos do Supabase
    const APP_ID = Deno.env.get('META_APP_ID');
    const APP_SECRET = Deno.env.get('META_APP_SECRET');

    if (!APP_ID || !APP_SECRET) {
      throw new Error("Credenciais da Meta não configuradas no servidor.");
    }

    // 3. Monta a URL de redirecionamento dinamicamente
    const origin = req.headers.get('origin') || 'http://localhost:5173';
    const REDIRECT_URI = `${origin}/auth/callback/meta`;
    console.log('meta-auth-callback: REDIRECT_URI:', REDIRECT_URI);

    // 4. Troca o código por um token de acesso de CURTA duração
    const tokenUrl = `https://graph.facebook.com/v18.0/oauth/access_token?client_id=${APP_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&client_secret=${APP_SECRET}&code=${code}`;
    console.log('meta-auth-callback: Solicitando token de curta duração...');
    
    const tokenResponse = await fetch(tokenUrl);
    const tokenData = await tokenResponse.json();
    
    if (tokenData.error) {
      console.error('meta-auth-callback: Erro ao obter token de curta duração:', tokenData.error);
      throw new Error(`Erro ao obter token de curta duração: ${tokenData.error.message}`);
    }
    const shortLivedToken = tokenData.access_token;
    console.log('meta-auth-callback: Token de curta duração obtido');

    // 5. Troca o token de curta duração por um de LONGA duração (vale por ~60 dias)
    const longLivedTokenUrl = `https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${APP_ID}&client_secret=${APP_SECRET}&fb_exchange_token=${shortLivedToken}`;
    console.log('meta-auth-callback: Solicitando token de longa duração...');
    
    const longLivedTokenResponse = await fetch(longLivedTokenUrl);
    const longLivedTokenData = await longLivedTokenResponse.json();

    if (longLivedTokenData.error) {
      console.error('meta-auth-callback: Erro ao obter token de longa duração:', longLivedTokenData.error);
      throw new Error(`Erro ao obter token de longa duração: ${longLivedTokenData.error.message}`);
    }
    const longLivedAccessToken = longLivedTokenData.access_token;
    const expiresIn = longLivedTokenData.expires_in;
    console.log('meta-auth-callback: Token de longa duração obtido. Expira em:', expiresIn, 'segundos');

    // 6. [FUTURO] Salvar o `longLivedAccessToken` no banco de dados
    // Por enquanto, vamos apenas retorná-lo para confirmar que funcionou.
    // Exemplo:
    // const supabaseClient = createClient(
    //   Deno.env.get('SUPABASE_URL')!,
    //   Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    // )
    // const authHeader = req.headers.get('Authorization');
    // const token = authHeader?.replace('Bearer ', '');
    // const { data: { user } } = await supabaseClient.auth.getUser(token);
    // if (user) {
    //   const { error: dbError } = await supabaseClient
    //     .from('profiles')
    //     .update({ meta_access_token: longLivedAccessToken })
    //     .eq('id', user.id);
    //   if (dbError) throw dbError;
    // }

    console.log('meta-auth-callback: Sucesso! Retornando resposta.');
    return new Response(
      JSON.stringify({ 
        success: true,
        message: "Conexão com a Meta realizada com sucesso!",
        accessToken: longLivedAccessToken, // Retornando o token para depuração
        expiresIn: expiresIn
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('meta-auth-callback: Erro:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
