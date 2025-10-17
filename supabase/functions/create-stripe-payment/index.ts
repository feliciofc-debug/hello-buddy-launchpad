import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, userEmail, planType } = await req.json();
    
    console.log('Creating Stripe payment for:', { userId, userEmail, planType });

    if (!STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY not configured');
    }

    // Define o preço baseado no tipo de plano
    let price = 0;
    let productName = '';
    let productDescription = '';
    
    if (planType === 'teste') {
      price = 12.00; // R$12 total (R$1/mês x 12)
      productName = 'AMZ Ofertas - Plano TESTE';
      productDescription = 'Plano de teste - Funcionalidade completa por R$1/mês';
    } else if (planType === 'completo') {
      price = 1764.00; // R$1764 total (R$147/mês x 12)
      productName = 'AMZ Ofertas - Plano Completo Anual';
      productDescription = 'Acesso completo à plataforma - Pagamento anual parcelado';
    } else {
      throw new Error('Tipo de plano inválido');
    }
    
    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams([
        // Removido payment_method_types para usar configuração do Dashboard (Dynamic Payment Methods)
        // Isso permite que o Stripe mostre automaticamente todos os métodos habilitados no Dashboard
        ['payment_method_options[boleto][expires_after_days]', '3'],
        ['payment_method_options[card][installments][enabled]', 'true'],
        ['line_items[0][price_data][currency]', 'brl'],
        ['line_items[0][price_data][product_data][name]', productName],
        ['line_items[0][price_data][product_data][description]', productDescription],
        ['line_items[0][price_data][unit_amount]', String(Math.round(price * 100))],
        ['line_items[0][quantity]', '1'],
        ['mode', 'payment'],
        ['success_url', `${req.headers.get('origin') || 'https://lovable.dev'}/dashboard?session_id={CHECKOUT_SESSION_ID}`],
        ['cancel_url', `${req.headers.get('origin') || 'https://lovable.dev'}/planos`],
        ['customer_email', userEmail],
        ['client_reference_id', userId],
        ['locale', 'pt-BR'],
        ['metadata[user_id]', userId],
        ['metadata[plan]', planType],
        ['payment_intent_data[description]', 'AMZ Ofertas - Assinatura Mensal'],
        ['allow_promotion_codes', 'true'],
        ['billing_address_collection', 'required']
      ]).toString()
    });

    const data = await response.json();
    
    console.log('Stripe response:', data);
    
    if (data.error) {
      throw new Error(data.error.message);
    }
    
    if (data.url) {
      return new Response(
        JSON.stringify({
          success: true,
          checkoutUrl: data.url,
          sessionId: data.id
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }
    
    throw new Error('No checkout URL returned from Stripe');
    
  } catch (error: any) {
    console.error('Error creating Stripe payment:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    );
  }
});
