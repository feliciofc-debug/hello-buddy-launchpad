import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createHmac } from "node:crypto";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔐 [SHOPEE-AUTH] Gerando URL de autorização...');

    const partnerId = Deno.env.get('SHOPEE_APP_ID');
    const partnerKey = Deno.env.get('SHOPEE_PARTNER_KEY');
    const redirectUrl = Deno.env.get('SHOPEE_REDIRECT_URL') || 'https://249fa690-d3a6-4362-93a4-ec3d247f30f3.lovableproject.com/shopee-callback';

    if (!partnerId || !partnerKey) {
      console.error('❌ [SHOPEE-AUTH] Credenciais não configuradas');
      return new Response(
        JSON.stringify({ 
          status: 'error',
          error: 'Credenciais da Shopee não configuradas' 
        }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log(`✅ [SHOPEE-AUTH] Partner ID: ${partnerId.substring(0, 8)}...`);

    // Gerar timestamp e signature para autorização
    const timestamp = Math.floor(Date.now() / 1000);
    const path = '/api/v2/shop/auth_partner';
    const baseString = `${partnerId}${path}${timestamp}`;
    
    const sign = createHmac('sha256', partnerKey)
      .update(baseString)
      .digest('hex');
    
    console.log(`📡 [SHOPEE-AUTH] Timestamp: ${timestamp}`);
    console.log(`📡 [SHOPEE-AUTH] Sign gerado com sucesso`);

    // URL de autorização da Shopee
    const authUrl = `https://partner.shopeemobile.com${path}`;
    const params = new URLSearchParams({
      partner_id: partnerId,
      timestamp: timestamp.toString(),
      sign: sign,
      redirect: redirectUrl
    });

    const fullAuthUrl = `${authUrl}?${params.toString()}`;
    
    console.log('✅ [SHOPEE-AUTH] URL de autorização gerada!');
    console.log(`📍 [SHOPEE-AUTH] Redirect URL: ${redirectUrl}`);
    
    return new Response(
      JSON.stringify({ 
        status: 'success',
        authUrl: fullAuthUrl,
        message: 'Acesse esta URL para autorizar o app na sua loja Shopee'
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('💥 [SHOPEE-AUTH] Erro crítico:', error);
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
