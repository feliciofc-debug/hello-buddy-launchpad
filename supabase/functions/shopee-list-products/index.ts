import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createHmac } from "node:crypto";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PARTNER_ID = "18113410011";
const PARTNER_KEY = "ZFZFIXTKNV3ZYSFVKIEKAFPPOCXW44PV";
const BASE_URL = "https://partner.shopeemobile.com";

/**
 * Gera a assinatura conforme documentação Shopee v2
 * Formato: SHA256-HMAC(partner_id + path + timestamp + access_token + shop_id)
 */
function generateSign(path: string, timestamp: number, accessToken: string, shopId: string): string {
  const baseString = `${PARTNER_ID}${path}${timestamp}${accessToken}${shopId}`;
  return createHmac('sha256', PARTNER_KEY)
    .update(baseString)
    .digest('hex');
}

/**
 * Etapa 1: Buscar lista de IDs dos produtos
 */
async function getItemList(shopId: string, accessToken: string): Promise<number[]> {
  const path = '/api/v2/product/get_item_list';
  const timestamp = Math.floor(Date.now() / 1000);
  const sign = generateSign(path, timestamp, accessToken, shopId);

  console.log('📋 [SHOPEE] Etapa 1: Buscando lista de IDs dos produtos...');
  console.log(`🔐 [SHOPEE] Shop ID: ${shopId}`);
  console.log(`🔐 [SHOPEE] Timestamp: ${timestamp}`);

  const params = new URLSearchParams({
    partner_id: PARTNER_ID,
    timestamp: timestamp.toString(),
    access_token: accessToken,
    shop_id: shopId,
    sign: sign,
  });

  const body = {
    offset: 0,
    page_size: 50,
    item_status: ['NORMAL', 'BANNED', 'DELETED', 'UNLIST'],
  };

  const response = await fetch(`${BASE_URL}${path}?${params.toString()}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const responseText = await response.text();
  console.log(`📥 [SHOPEE] Status Etapa 1: ${response.status}`);
  console.log(`📥 [SHOPEE] Resposta Etapa 1:`, responseText);

  if (!response.ok) {
    throw new Error(`Erro ao buscar lista de produtos: ${response.status} - ${responseText}`);
  }

  const data = JSON.parse(responseText);
  
  if (data.error) {
    throw new Error(`API Error: ${data.message || data.error}`);
  }

  // Extrair item_ids - a API pode retornar em diferentes formatos
  const items = data.response?.item || data.response?.item_list || data.item || data.item_list || [];
  const itemIds = items.map((item: any) => item.item_id);
  
  console.log(`✅ [SHOPEE] Encontrados ${itemIds.length} produtos`);
  
  return itemIds;
}

/**
 * Etapa 2: Buscar detalhes completos dos produtos
 */
async function getItemBaseInfo(shopId: string, accessToken: string, itemIds: number[]): Promise<any[]> {
  if (itemIds.length === 0) {
    console.log('⚠️ [SHOPEE] Nenhum item_id para buscar detalhes');
    return [];
  }

  const path = '/api/v2/product/get_item_base_info';
  const timestamp = Math.floor(Date.now() / 1000);
  const sign = generateSign(path, timestamp, accessToken, shopId);

  console.log(`📋 [SHOPEE] Etapa 2: Buscando detalhes de ${itemIds.length} produtos...`);

  const params = new URLSearchParams({
    partner_id: PARTNER_ID,
    timestamp: timestamp.toString(),
    access_token: accessToken,
    shop_id: shopId,
    sign: sign,
  });

  const body = {
    item_id_list: itemIds.slice(0, 50), // API permite até 50 por vez
  };

  const response = await fetch(`${BASE_URL}${path}?${params.toString()}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const responseText = await response.text();
  console.log(`📥 [SHOPEE] Status Etapa 2: ${response.status}`);
  console.log(`📥 [SHOPEE] Resposta Etapa 2:`, responseText);

  if (!response.ok) {
    throw new Error(`Erro ao buscar detalhes dos produtos: ${response.status} - ${responseText}`);
  }

  const data = JSON.parse(responseText);
  
  if (data.error) {
    throw new Error(`API Error: ${data.message || data.error}`);
  }

  const items = data.response?.item_list || data.item_list || [];
  
  console.log(`✅ [SHOPEE] Detalhes carregados de ${items.length} produtos`);
  
  return items;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { shop_id, access_token } = await req.json();

    if (!shop_id || !access_token) {
      throw new Error('shop_id e access_token são obrigatórios');
    }

    console.log('🛒 [SHOPEE] Iniciando listagem completa de produtos...');

    // Etapa 1: Buscar IDs dos produtos
    const itemIds = await getItemList(shop_id.toString(), access_token);

    if (itemIds.length === 0) {
      return new Response(
        JSON.stringify({ 
          status: 'success',
          message: 'Nenhum produto encontrado na loja',
          products: [],
          total: 0
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Etapa 2: Buscar detalhes completos
    const products = await getItemBaseInfo(shop_id.toString(), access_token, itemIds);

    console.log('✅ [SHOPEE] Listagem completa finalizada!');

    return new Response(
      JSON.stringify({ 
        status: 'success',
        message: `${products.length} produtos carregados com sucesso`,
        products: products,
        total: products.length,
        itemIds: itemIds
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('💥 [SHOPEE] Erro crítico:', error);
    return new Response(
      JSON.stringify({ 
        status: 'error',
        error: error?.message || 'Erro desconhecido',
        stack: error?.stack
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
