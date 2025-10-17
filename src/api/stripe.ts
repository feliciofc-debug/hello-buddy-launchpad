import { supabase } from "@/integrations/supabase/client";

export const STRIPE_PUBLIC_KEY = 'pk_live_51SCiQRPrbO1mGIU10jwb9enzv8r6i3mceRTwoJ7rWCa0PY6Kdz0JzAJRMftyd48AcLbZGOvpk4yabBzmgP1v2ecS006e3LBXMn';

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
