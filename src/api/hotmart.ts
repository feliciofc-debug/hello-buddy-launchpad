import { supabase } from "@/integrations/supabase/client";

/**
 * Obtém o token de acesso da Hotmart via OAuth2
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
 * Busca vendas da Hotmart
 */
export async function getHotmartSales(token: string, params?: {
  start_date?: string;
  end_date?: string;
  max_results?: number;
  page_token?: string;
}) {
  const url = new URL('https://developers.hotmart.com/payments/api/v1/sales');
  
  if (params?.start_date) url.searchParams.append('start_date', params.start_date);
  if (params?.end_date) url.searchParams.append('end_date', params.end_date);
  if (params?.max_results) url.searchParams.append('max_results', params.max_results.toString());
  if (params?.page_token) url.searchParams.append('page_token', params.page_token);

  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Erro ao buscar vendas: ${response.statusText}`);
  }

  return response.json();
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
  const url = new URL('https://developers.hotmart.com/payments/api/v1/subscriptions');
  
  if (params?.subscriber_code) url.searchParams.append('subscriber_code', params.subscriber_code);
  if (params?.status) url.searchParams.append('status', params.status);
  if (params?.page) url.searchParams.append('page', params.page.toString());
  if (params?.page_size) url.searchParams.append('page_size', params.page_size.toString());

  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Erro ao buscar assinaturas: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Busca produtos da Hotmart
 */
export async function getHotmartProducts(token: string) {
  const response = await fetch('https://developers.hotmart.com/club/api/v1/products', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Erro ao buscar produtos: ${response.statusText}`);
  }

  return response.json();
}
