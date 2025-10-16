import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, message, userId } = await req.json();
    
    console.log("[SEND-WHATSAPP] Enviando mensagem", { phone, userId });

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Salvar notificação no banco
    const { error: dbError } = await supabaseClient
      .from('whatsapp_notifications')
      .insert({
        user_id: userId,
        client_phone: phone,
        message: message,
        status: 'enviado',
        sent_at: new Date().toISOString()
      });

    if (dbError) {
      console.error("[SEND-WHATSAPP] Erro no banco:", dbError);
      throw dbError;
    }

    const encodedMessage = encodeURIComponent(message);
    const cleanPhone = phone.replace(/\D/g, '');
    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodedMessage}`;

    console.log("[SEND-WHATSAPP] Mensagem enviada com sucesso");

    return new Response(JSON.stringify({ 
      success: true,
      whatsappUrl,
      message: "Mensagem registrada com sucesso" 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("[SEND-WHATSAPP] Erro:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : String(error) 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
