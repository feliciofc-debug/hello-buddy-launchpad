import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createHmac } from "node:crypto";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { product_url } = await req.json();

    if (!product_url || !product_url.includes('shopee.com')) {
      throw new Error('URL inválida da Shopee');
    }

    // Credenciais Shopee
    const PARTNER_ID = 18113410011;
    const PARTNER_KEY = 'ZFZFIXTKNV3ZYSFVKIEKAFFP0CXW44PV';
    
    // Timestamp
    const timestamp = Math.floor(Date.now() / 1000);
    
    // Path da API
    const path = '/api/v3/affiliate/product_link/create';
    
    // Criar assinatura HMAC-SHA256
    const baseString = `${PARTNER_ID}${path}${timestamp}`;
    const sign = createHmac('sha256', PARTNER_KEY)
      .update(baseString)
      .digest('hex');

    console.log('[SHOPEE] Convertendo link:', product_url);

    // Chamar API Shopee
    const apiUrl = `https://partner.shopeemobile.com${path}?partner_id=${PARTNER_ID}&timestamp=${timestamp}&sign=${sign}`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        product_link: product_url,
        sub_id: 'amz_' + Date.now()
      })
    });

    const data = await response.json();

    if (data.error) {
      console.error('[SHOPEE] Erro na API:', data.message);
      throw new Error(data.message || 'Erro ao converter link Shopee');
    }

    // Extrair info do produto da URL
    const productId = product_url.match(/\.(\d+)\.(\d+)/)?.[0] || '';
    
    const resultado = {
      success: true,
      affiliate_link: data.data?.affiliate_link || product_url,
      commission_rate: data.data?.commission_rate || '15%',
      product_id: productId,
      titulo: 'Produto Shopee',
      preco: '0.00',
      imagem: null
    };

    console.log('[SHOPEE] Link convertido com sucesso');

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('[SHOPEE] Erro:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
