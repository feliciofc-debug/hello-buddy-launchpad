// ⚠️ TEMPORÁRIO - Só para teste!
// Depois mover para Edge Function
const STRIPE_SECRET_KEY = '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'; // COLE SUA CHAVE AQUI
export const STRIPE_PUBLIC_KEY = 'pk_live_51SCiQRPrbO1mGIU1RrJo7jMwpukt6AyPViVnh58hqAP4sDw19UkZtFsOYJ5nCk5lYHE8MHB5XlVeMTgZW0SdtdZT0049jAoNJv';

export async function createStripePayment(userId: string, userEmail: string, planType: string) {
  try {
    const price = planType === 'teste' ? 12.00 : 147.00;
    const priceInCents = Math.round(price * 100);
    
    // Criar Checkout Session DIRETO no Stripe
    const params = new URLSearchParams();
    params.append('payment_method_types[]', 'card');
    params.append('payment_method_types[]', 'boleto');
    params.append('line_items[0][price_data][currency]', 'brl');
    params.append('line_items[0][price_data][product_data][name]', 'AMZ Ofertas - Plano Mensal');
    params.append('line_items[0][price_data][unit_amount]', priceInCents.toString());
    params.append('line_items[0][quantity]', '1');
    params.append('mode', 'payment');
    params.append('success_url', `${window.location.origin}/dashboard?session_id={CHECKOUT_SESSION_ID}`);
    params.append('cancel_url', `${window.location.origin}/planos`);
    params.append('customer_email', userEmail);
    params.append('client_reference_id', userId);
    
    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Stripe Error:', error);
      throw new Error(error.error?.message || 'Erro ao criar sessão');
    }

    const data = await response.json();
    
    return {
      success: true,
      checkoutUrl: data.url,
      sessionId: data.id
    };
    
  } catch (error: any) {
    console.error('Erro:', error);
    return {
      success: false,
      error: error.message
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
