import { supabase } from "@/integrations/supabase/client";

export const STRIPE_PUBLIC_KEY = 'pk_live_51SCiQRPrbO1mGIU1RrJo7jMwpukt6AyPViVnh58hqAP4sDw19UkZtFsOYJ5nCk5lYHE8MHB5XlVeMTgZW0SdtdZT0049jAoNJv';

export async function createStripePayment(userId: string, userEmail: string, planType: string) {
  try {
    const { data, error } = await supabase.functions.invoke('create-stripe-payment', {
      body: {
        userId,
        userEmail,
        planType
      }
    });

    if (error) {
      console.error('Error calling edge function:', error);
      throw error;
    }

    return data;
  } catch (error: any) {
    console.error('Error creating Stripe payment:', error);
    return {
      success: false,
      error: error.message || 'Erro ao processar pagamento'
    };
  }
}

export async function verifyStripePayment(sessionId: string) {
  try {
    const { data, error } = await supabase.functions.invoke('verify-stripe-payment', {
      body: { sessionId }
    });

    if (error) throw error;
    return data;
  } catch (error: any) {
    return {
      success: false,
      error: error.message
    };
  }
}
