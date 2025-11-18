import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PixelEvent {
  productId: string;
  eventType: 'view' | 'click' | 'add_to_cart' | 'purchase';
  userId?: string;
  pixelId?: string;
  value?: number;
  currency?: string;
  metadata?: Record<string, any>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const event: PixelEvent = await req.json();
    
    console.log('Rastreando evento:', event);

    // Validações
    if (!event.productId || !event.eventType) {
      throw new Error('productId e eventType são obrigatórios');
    }

    // Obter informações adicionais do request
    const userAgent = req.headers.get('user-agent') || 'unknown';
    const referer = req.headers.get('referer') || 'direct';
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';

    // Dados do evento para salvar no banco
    const eventData = {
      product_id: event.productId,
      event_type: event.eventType,
      user_id: event.userId || null,
      pixel_id: event.pixelId || null,
      value: event.value || 0,
      currency: event.currency || 'BRL',
      user_agent: userAgent,
      referer: referer,
      ip_address: ip,
      metadata: event.metadata || {},
      created_at: new Date().toISOString()
    };

    // TODO: Salvar no banco de dados (quando a tabela for criada)
    // const { data, error } = await supabase
    //   .from('pixel_events')
    //   .insert(eventData);

    // if (error) {
    //   console.error('Erro ao salvar evento:', error);
    //   throw error;
    // }

    console.log('Evento salvo (mock):', eventData);

    // Enviar para Facebook Pixel se configurado
    if (event.pixelId && event.eventType === 'purchase') {
      try {
        // Facebook Conversion API
        const fbResponse = await fetch(
          `https://graph.facebook.com/v18.0/${event.pixelId}/events`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              data: [{
                event_name: 'Purchase',
                event_time: Math.floor(Date.now() / 1000),
                user_data: {
                  client_ip_address: ip,
                  client_user_agent: userAgent,
                },
                custom_data: {
                  value: event.value,
                  currency: event.currency || 'BRL',
                  content_ids: [event.productId],
                  content_type: 'product'
                }
              }]
            })
          }
        );

        if (fbResponse.ok) {
          console.log('Evento enviado para Facebook Pixel');
        }
      } catch (fbError) {
        console.error('Erro ao enviar para Facebook:', fbError);
        // Não falha a requisição se o FB falhar
      }
    }

    // Retornar estatísticas básicas
    // TODO: Buscar do banco quando implementado
    const stats = {
      clicks: 0,
      views: 0,
      purchases: 0,
      conversionRate: 0,
      revenue: 0
    };

    return new Response(
      JSON.stringify({ 
        success: true,
        eventTracked: event.eventType,
        productId: event.productId,
        stats: stats,
        message: 'Evento rastreado com sucesso'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('Erro ao rastrear pixel:', error);
    return new Response(
      JSON.stringify({ 
        error: error?.message || 'Erro ao rastrear evento'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
