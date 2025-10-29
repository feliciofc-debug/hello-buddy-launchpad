import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Contact {
  name: string;
  phone: string;
  customFields?: Record<string, string>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      campaignName, 
      messageTemplate, 
      contacts, 
      scheduledAt 
    } = await req.json();
    
    console.log("[BULK-SEND] Processando envio em massa", { 
      campaignName, 
      totalContacts: contacts.length 
    });

    // Get user from auth header
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      throw new Error("Authorization required");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Verify user token
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error("Invalid authorization");
    }

    // Create bulk send record
    const { data: bulkSend, error: bulkSendError } = await supabaseClient
      .from('whatsapp_bulk_sends')
      .insert({
        user_id: user.id,
        campaign_name: campaignName,
        message_template: messageTemplate,
        total_contacts: contacts.length,
        status: scheduledAt ? 'pending' : 'sending',
        scheduled_at: scheduledAt || null,
        started_at: scheduledAt ? null : new Date().toISOString()
      })
      .select()
      .single();

    if (bulkSendError) {
      console.error("[BULK-SEND] Erro ao criar registro:", bulkSendError);
      throw bulkSendError;
    }

    console.log("[BULK-SEND] Registro criado:", bulkSend.id);

    // Insert all contacts
    const contactsToInsert = contacts.map((contact: Contact) => ({
      bulk_send_id: bulkSend.id,
      name: contact.name,
      phone: contact.phone,
      custom_fields: contact.customFields || {},
      status: 'pending'
    }));

    const { error: contactsError } = await supabaseClient
      .from('whatsapp_contacts')
      .insert(contactsToInsert);

    if (contactsError) {
      console.error("[BULK-SEND] Erro ao inserir contatos:", contactsError);
      throw contactsError;
    }

    console.log("[BULK-SEND] Contatos inseridos:", contactsToInsert.length);

    // If not scheduled, start sending immediately
    if (!scheduledAt) {
      // Process each contact
      let sentCount = 0;
      for (const contact of contacts) {
        try {
          // Replace variables in message template
          let personalizedMessage = messageTemplate;
          personalizedMessage = personalizedMessage.replace(/{nome}/g, contact.name || '');
          personalizedMessage = personalizedMessage.replace(/{telefone}/g, contact.phone || '');
          
          // Replace custom fields
          if (contact.customFields) {
            Object.keys(contact.customFields).forEach(key => {
              const regex = new RegExp(`{${key}}`, 'g');
              personalizedMessage = personalizedMessage.replace(regex, contact.customFields![key]);
            });
          }

          const encodedMessage = encodeURIComponent(personalizedMessage);
          const cleanPhone = contact.phone.replace(/\D/g, '');
          const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodedMessage}`;

          // Update contact status
          await supabaseClient
            .from('whatsapp_contacts')
            .update({
              status: 'sent',
              sent_at: new Date().toISOString()
            })
            .eq('bulk_send_id', bulkSend.id)
            .eq('phone', contact.phone);

          sentCount++;
          console.log(`[BULK-SEND] Mensagem preparada para ${contact.phone}`);
        } catch (error) {
          console.error(`[BULK-SEND] Erro ao processar ${contact.phone}:`, error);
          
          // Update contact with error
          await supabaseClient
            .from('whatsapp_contacts')
            .update({
              status: 'failed',
              error_message: error instanceof Error ? error.message : 'Unknown error'
            })
            .eq('bulk_send_id', bulkSend.id)
            .eq('phone', contact.phone);
        }
      }

      // Update bulk send status
      await supabaseClient
        .from('whatsapp_bulk_sends')
        .update({
          sent_count: sentCount,
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', bulkSend.id);

      console.log(`[BULK-SEND] Envio concluído: ${sentCount}/${contacts.length}`);
    }

    return new Response(JSON.stringify({ 
      success: true,
      bulkSendId: bulkSend.id,
      message: scheduledAt 
        ? "Campanha agendada com sucesso" 
        : `Enviado para ${contacts.length} contatos`
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("[BULK-SEND] Erro:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : String(error) 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
