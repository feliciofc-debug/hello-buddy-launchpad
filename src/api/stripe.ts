// ⚠️ TEMPORÁRIO - Chamada direta (não use em produção!)
const STRIPE_SECRET_KEY = 'SUA_SECRET_KEY_AQUI'; // ⚠️ COLE A SECRET KEY AQUI (sk_live_...)
export const STRIPE_PUBLIC_KEY = 'pk_live_51SCiQRPrbO1mGIU10jwb9enzv8r6i3mceRTwoJ7rWCa0PY6Kdz0JzAJRMftyd48AcLbZGOvpk4yabBzmgP1v2ecS006e3LBXMn';

export async function createStripePayment(userId: string, userEmail: string, planType: string) {
  try {
    const price = planType === 'teste' ? 12.00 : 147.00;
    const priceInCents = Math.round(price * 100);
    
    // Parâmetros do checkout
    const params = new URLSearchParams({
      'mode': 'payment',
      'success_url': `${window.location.origin}/dashboard`,
      'cancel_url': `${window.location.origin}/planos`,
      'customer_email': userEmail,
      'client_reference_id': userId,
      'payment_method_types[0]': 'card',
      'payment_method_types[1]': 'boleto',
      'line_items[0][price_data][currency]': 'brl',
      'line_items[0][price_data][product_data][name]': 'AMZ Ofertas - Plano Mensal',
      'line_items[0][price_data][unit_amount]': priceInCents.toString(),
      'line_items[0][quantity]': '1',
      'payment_intent_data[setup_future_usage]': 'off_session',
      'allow_promotion_codes': 'true'
    });

    console.log('Criando sessão Stripe...');

    // Chamada DIRETA ao Stripe API
    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Erro Stripe:', errorData);
      throw new Error(errorData.error?.message || 'Erro ao criar checkout');
    }

    const data = await response.json();
    console.log('Sessão criada:', data.id);
    
    return {
      success: true,
      checkoutUrl: data.url,
      sessionId: data.id
    };
    
  } catch (error: any) {
    console.error('Erro completo:', error);
    return {
      success: false,
      error: error.message || 'Erro desconhecido'
    };
  }
}

export async function verifyStripePayment(sessionId: string) {
  try {
    const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`
      }
    });

    if (!response.ok) {
      throw new Error('Erro ao verificar pagamento');
    }

    const data = await response.json();
    
    return {
      success: data.payment_status === 'paid',
      status: data.payment_status,
      customerEmail: data.customer_email
    };
    
  } catch (error: any) {
    return {
      success: false,
      error: error.message
    };
  }
}
