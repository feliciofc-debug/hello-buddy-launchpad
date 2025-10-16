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
    const { phones, message, userId } = await req.json();
    
    console.log("[SEND-CAMPAIGN] Iniciando campanha", { 
      totalContatos: phones.length, 
      userId 
    });

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Salvar todas as notificações no banco
    const notifications = phones.map((phone: string) => ({
      user_id: userId,
      client_phone: phone,
      message: message,
      status: 'enviado',
      sent_at: new Date().toISOString()
    }));

    const { error: dbError } = await supabaseClient
      .from('whatsapp_notifications')
      .insert(notifications);

    if (dbError) {
      console.error("[SEND-CAMPAIGN] Erro no banco:", dbError);
      throw dbError;
    }

    console.log("[SEND-CAMPAIGN] Campanha registrada com sucesso", {
      totalEnviado: phones.length
    });

    return new Response(JSON.stringify({ 
      success: true,
      totalEnviado: phones.length,
      message: "Campanha registrada com sucesso" 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("[SEND-CAMPAIGN] Erro:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : String(error) 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
