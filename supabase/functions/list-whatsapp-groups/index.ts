import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CONTABO_WUZAPI_URL = "https://api2.amzofertas.com.br";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, syncFromWhatsApp } = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "userId é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Se syncFromWhatsApp = true, buscar grupos direto da WuzAPI e sincronizar
    if (syncFromWhatsApp) {
      const { data: cliente } = await supabase
        .from("clientes_afiliados")
        .select("wuzapi_token")
        .eq("user_id", userId)
        .single();

      if (cliente?.wuzapi_token) {
        const response = await fetch(`${CONTABO_WUZAPI_URL}/group/list`, {
          method: "GET",
          headers: { 
            "Token": cliente.wuzapi_token,
            "Content-Type": "application/json" 
          },
        });

        if (response.ok) {
          const groups = await response.json();
          console.log("Grupos da WuzAPI:", JSON.stringify(groups));

          // Sincronizar com o banco
          for (const group of (groups.Groups || groups || [])) {
            const groupJid = group.JID || group.Jid || group.jid;
            const groupName = group.Name || group.name || group.Subject || group.subject;
            const currentMemberCount = group.Participants?.length || group.participants?.length || 0;

            if (groupJid && groupName) {
              // Buscar contagem anterior
              const { data: existingGroup } = await supabase
                .from("whatsapp_grupos_afiliado")
                .select("member_count, previous_member_count")
                .eq("group_jid", groupJid)
                .single();

              const previousCount = existingGroup?.member_count || 0;
              
              // Se a contagem aumentou, novos membros entraram!
              if (existingGroup && currentMemberCount > previousCount) {
                const newMembersCount = currentMemberCount - previousCount;
                console.log(`🎉 Detectados ${newMembersCount} novos membros no grupo ${groupName}!`);
                
                // Enviar mensagem de boas-vindas no grupo
                try {
                  const welcomeMessage = `🎉 BEM-VINDO(A) AO AMZ OFERTAS CASHBACK! 🎉

Obrigado por fazer parte da nossa comunidade de ofertas! Aqui você encontra as melhores promoções dos principais marketplaces com 2% de CASHBACK!

📚 PRESENTE DE BOAS-VINDAS
Baixe grátis nosso eBook com 50 Receitas de Airfryer:
👉 https://amzofertas.com.br/ebooks/50-receitas-airfryer.pdf

💰 REGRAS DO CASHBACK
✅ Validade: 120 dias após a compra
✅ Resgate mínimo: R$ 20,00
✅ Marketplaces válidos: Amazon, Shopee, Mercado Livre
⚠️ ATENÇÃO: Compras na Magalu NÃO participam do cashback

🤖 Pietro Eugenio é nosso assistente virtual — ele valida comprovantes, converte links e tira suas dúvidas!

📲 Como funciona:
1️⃣ Você recebe ofertas incríveis aqui no grupo
2️⃣ Compra pelo link (site oficial)
3️⃣ Envia o comprovante pro Pietro no privado
4️⃣ Ganha 2% de cashback + eBooks grátis! 🎁

🎁 ACHOU UM PRODUTO QUE QUER COMPRAR?
Encontrou um produto na Amazon, Shopee ou Mercado Livre que não foi ofertado no grupo?
👉 Envie o link para o Pietro Eugenio e ele converte para você!
✨ Bônus: Ganhe um novo eBook + seu cashback garantido!

📱 SUPORTE E ENVIO DE COMPROVANTES
WhatsApp Pietro Eugenio: (21) 99537-9550
👉 https://wa.me/5521995379550

Envie seus comprovantes e tire qualquer dúvida sobre a plataforma!`;

                  const groupPhone = groupJid.includes('@g.us') ? groupJid : `${groupJid}@g.us`;
                  
                  const sendResponse = await fetch(`${CONTABO_WUZAPI_URL}/chat/send/text`, {
                    method: "POST",
                    headers: { 
                      "Token": cliente.wuzapi_token,
                      "Content-Type": "application/json" 
                    },
                    body: JSON.stringify({
                      Phone: groupPhone,
                      Body: welcomeMessage
                    }),
                  });

                  const sendResult = await sendResponse.json();
                  console.log(`Resultado envio boas-vindas no grupo ${groupName}:`, JSON.stringify(sendResult));
                } catch (welcomeError) {
                  console.error("Erro ao enviar boas-vindas:", welcomeError);
                }
              }

              // Upsert - inserir se não existe, atualizar se existe
              await supabase
                .from("whatsapp_grupos_afiliado")
                .upsert({
                  user_id: userId,
                  group_jid: groupJid,
                  group_name: groupName,
                  member_count: currentMemberCount,
                  previous_member_count: previousCount, // Guardar contagem anterior
                  ativo: true,
                  updated_at: new Date().toISOString()
                }, {
                  onConflict: 'group_jid'
                });
            }
          }
        }
      }
    }

    // Buscar grupos do banco
    const { data: grupos, error } = await supabase
      .from("whatsapp_grupos_afiliado")
      .select("*")
      .eq("user_id", userId)
      .eq("ativo", true)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erro ao buscar grupos:", error);
      return new Response(
        JSON.stringify({ error: "Erro ao buscar grupos", details: error }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, grupos }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Erro geral:", error);
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
