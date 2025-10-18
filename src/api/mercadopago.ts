import { supabase } from "@/integrations/supabase/client";

export async function createMercadoPagoPayment(userId: string, userEmail: string, planType: string) {
  try {
    const { data, error } = await supabase.functions.invoke('create-payment', {
      body: {
        userId,
        userEmail,
        planType
      }
    });

    if (error) {
      console.error('Erro ao chamar edge function:', error);
      throw error;
    }

    return data;
  } catch (error: any) {
    console.error('Erro ao criar pagamento Mercado Pago:', error);
    return {
      success: false,
      error: error.message || 'Erro ao processar pagamento'
    };
  }
}
