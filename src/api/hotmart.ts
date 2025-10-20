import axios from "axios";
import qs from "qs";
import { supabase } from "@/integrations/supabase/client";

/**
 * Obtém o token de acesso da Hotmart via OAuth2
 * Endpoint: https://api-sec-vlc.hotmart.com/security/oauth/token
 * Formato: application/x-www-form-urlencoded
 */
export async function getHotmartToken(): Promise<string> {
  const { data, error } = await supabase.functions.invoke('hotmart-auth');
  
  if (error) {
    console.error('❌ Erro ao obter token Hotmart:', error);
    throw error;
  }

  if (data.status === 'error') {
    console.error('❌ Erro na autenticação:', data.error);
    throw new Error(data.error);
  }

  return data.access_token;
}

/**
 * Autenticação direta (para uso em backend)
 */
export async function getHotmartTokenDirect(clientId: string, clientSecret: string): Promise<string> {
  const url = 'https://api-sec-vlc.hotmart.com/security/oauth/token';
  
  const data = qs.stringify({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'client_credentials'
  });

  try {
    const response = await axios.post(url, data, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    return response.data.access_token;
  } catch (error: any) {
    console.error('Erro autenticação Hotmart:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Busca vendas da Hotmart
 */
export async function getHotmartSales(token: string, params?: {
  start_date?: string;
  end_date?: string;
  max_results?: number;
  page_token?: string;
}) {
  try {
    const url = new URL('https://developers.hotmart.com/payments/api/v1/sales');
    
    if (params?.start_date) url.searchParams.append('start_date', params.start_date);
    if (params?.end_date) url.searchParams.append('end_date', params.end_date);
    if (params?.max_results) url.searchParams.append('max_results', params.max_results.toString());
    if (params?.page_token) url.searchParams.append('page_token', params.page_token);

    const response = await axios.get(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    
    return response.data;
  } catch (error: any) {
    console.error('Erro ao buscar vendas Hotmart:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Busca assinaturas da Hotmart
 */
export async function getHotmartSubscriptions(token: string, params?: {
  subscriber_code?: string;
  status?: string;
  page?: number;
  page_size?: number;
}) {
  try {
    const url = new URL('https://developers.hotmart.com/payments/api/v1/subscriptions');
    
    if (params?.subscriber_code) url.searchParams.append('subscriber_code', params.subscriber_code);
    if (params?.status) url.searchParams.append('status', params.status);
    if (params?.page) url.searchParams.append('page', params.page.toString());
    if (params?.page_size) url.searchParams.append('page_size', params.page_size.toString());

    const response = await axios.get(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    
    return response.data;
  } catch (error: any) {
    console.error('Erro ao buscar assinaturas Hotmart:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Busca produtos da Hotmart
 */
export async function getHotmartProducts(token: string) {
  try {
    const response = await axios.get('https://developers.hotmart.com/club/api/v1/products', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    
    return response.data;
  } catch (error: any) {
    console.error('Erro ao buscar produtos Hotmart:', error.response?.data || error.message);
    throw error;
  }
}
