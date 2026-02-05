import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOCAWEB_WUZAPI_URL = Deno.env.get("WUZAPI_URL") || "https://wuzapi.amzofertas.com.br";
const LOCAWEB_WUZAPI_TOKEN = Deno.env.get("WUZAPI_TOKEN") || "";

async function safeReadJson(response: Response): Promise<any> {
  const text = await response.text().catch(() => "");
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text.slice(0, 1000) };
  }
}

// Converte base64 para URL pública via Supabase Storage
async function uploadBase64ToStorage(
  supabase: any,
  base64Data: string,
  userId: string
): Promise<string | null> {
  try {
    console.log("[PJ-SEND] Detectado base64, fazendo upload...");
    
    // Extrair tipo e dados do base64
    const matches = base64Data.match(/^data:(.+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      console.error("[PJ-SEND] Formato base64 inválido");
      return null;
    }
    
    const mimeType = matches[1];
    const base64Content = matches[2];
    const extension = mimeType.split("/")[1] || "png";
    const fileName = `whatsapp-images/${userId}/${Date.now()}.${extension}`;
    
    // Converter base64 para Uint8Array
    const binaryString = atob(base64Content);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("produtos")
      .upload(fileName, bytes, {
        contentType: mimeType,
        upsert: true,
      });

    if (uploadError) {
      console.error("[PJ-SEND] Erro no upload:", uploadError);
      return null;
    }
    
    // Gerar URL pública
    const { data: publicUrlData } = supabase.storage
      .from("produtos")
      .getPublicUrl(fileName);
    
    const publicUrl = publicUrlData?.publicUrl || null;
    console.log("[PJ-SEND] Imagem uploaded:", publicUrl);
    return publicUrl;
  } catch (uploadErr) {
    console.error("[PJ-SEND] Erro ao processar base64:", uploadErr);
    return null;
  }
}

// Gera variantes do número para testar (com e sem 9º dígito)
function generatePhoneVariants(phone: string): string[] {
  let clean = phone.replace(/\D/g, "");
  
  if (clean.startsWith("55") && clean.length >= 12) {
    clean = clean.substring(2);
  }
  
  const variants: string[] = [];
  
  // Número com 11 dígitos (DDD + 9 + 8 dígitos) - testar também SEM o 9
  if (clean.length === 11 && clean[2] === "9") {
    const comNove = "55" + clean;
    const semNove = "55" + clean.substring(0, 2) + clean.substring(3);
    variants.push(comNove);
    variants.push(semNove);
  }
  // Número com 10 dígitos (DDD + 8 dígitos) - testar também COM o 9
  else if (clean.length === 10) {
    const ddd = clean.substring(0, 2);
    const numero = clean.substring(2);
    const comNove = "55" + ddd + "9" + numero;
    const semNove = "55" + clean;
    variants.push(comNove);
    variants.push(semNove);
  }
  else {
    if (!clean.startsWith("55")) clean = "55" + clean;
    variants.push(clean);
  }
  
  return [...new Set(variants)];
}

// Verifica se número existe no WhatsApp e retorna o JID/número REAL
// IMPORTANTE: Phone deve ser enviado como ARRAY, não string!
async function checkPhoneExists(
  baseUrl: string,
  token: string,
  phone: string
): Promise<{ exists: boolean; jid?: string; realNumber?: string }> {
  try {
    // CRÍTICO: Enviar Phone como ARRAY - isso é o formato correto da WuzAPI!
    const checkResp = await fetch(`${baseUrl}/user/check`, {
      method: "POST",
      headers: { "Token": token, "Content-Type": "application/json" },
      body: JSON.stringify({ Phone: [phone] }), // ARRAY, não string!
    });
    
    const json = await safeReadJson(checkResp);
    
    console.log(`[CHECK] ${phone} -> ${checkResp.status}:`, JSON.stringify(json));
    
    // Formato de resposta: { data: { Users: [{ IsInWhatsapp, JID, Query }] } }
    if (checkResp.ok && json?.data?.Users && Array.isArray(json.data.Users)) {
      const user = json.data.Users[0];
      
      if (user && user.IsInWhatsapp === true) {
        // CRÍTICO: Usar o JID REAL retornado pela API
        const realJid = user.JID || user.jid || null;
        
        // Extrair número limpo do JID (ex: "556292879397@s.whatsapp.net" -> "556292879397")
        let extractedNumber = phone;
        if (realJid && realJid.includes("@")) {
          extractedNumber = realJid.split("@")[0];
        }
        
        console.log(`[CHECK] ✅ ENCONTRADO! Query: ${user.Query}, JID REAL: ${realJid}, Número real: ${extractedNumber}`);
        
        return { 
          exists: true, 
          jid: realJid,
          realNumber: extractedNumber 
        };
      }
    }
    
    // Fallback para formato antigo (compatibilidade)
    if (checkResp.ok && json && (json.IsRegistered === true || json.isRegistered === true)) {
      const realJid = json.Jid || json.JID || json.jid || null;
      let extractedNumber = phone;
      if (realJid && realJid.includes("@")) {
        extractedNumber = realJid.split("@")[0];
      }
      return { exists: true, jid: realJid, realNumber: extractedNumber };
    }
    
    return { exists: false };
  } catch (err: any) {
    console.error(`[CHECK] Erro:`, err.message);
    return { exists: false };
  }
}

// Encontra o número correto testando variantes e retorna o NÚMERO REAL do WhatsApp
async function findValidPhone(
  baseUrl: string,
  token: string,
  phone: string
): Promise<{ valid: boolean; phone: string; realNumber?: string; jid?: string; tested: string[] }> {
  const variants = generatePhoneVariants(phone);
  const tested: string[] = [];
  
  for (const variant of variants) {
    tested.push(variant);
    const result = await checkPhoneExists(baseUrl, token, variant);
    if (result.exists) {
      // USAR O NÚMERO REAL RETORNADO PELA API, não a variante que testamos
      const phoneToUse = result.realNumber || variant;
      console.log(`✅ [VALIDATE] Número válido! Testado: ${variant}, Número REAL: ${phoneToUse}, JID: ${result.jid}`);
      return { 
        valid: true, 
        phone: phoneToUse, 
        realNumber: result.realNumber,
        jid: result.jid,
        tested 
      };
    }
  }
  
  // Se nenhum validou, usa a primeira variante (comportamento anterior)
  console.log(`⚠️ [VALIDATE] Nenhuma variante confirmada, usando: ${variants[0]}`);
  return { valid: false, phone: variants[0], tested };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      phoneNumbers, 
      message, 
      imageUrl, 
      userId, 
      useQueue = false, 
      debugStatus = false,
      validateBeforeSend = true // Nova opção: validar antes de enviar
    } = await req.json();

    console.log("📤 [PJ-SEND] Recebido:", {
      phones: phoneNumbers?.length,
      hasImage: !!imageUrl,
      userId,
      useQueue,
      validateBeforeSend,
    });

    if (!phoneNumbers || phoneNumbers.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Nenhum telefone informado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar configuração do usuário PJ
    let baseUrl = LOCAWEB_WUZAPI_URL;
    let wuzapiToken = LOCAWEB_WUZAPI_TOKEN;

    if (userId) {
      const { data: config } = await supabase
        .from("pj_clientes_config")
        .select("wuzapi_token, wuzapi_port")
        .eq("user_id", userId)
        .maybeSingle();

      if (config?.wuzapi_token) {
        wuzapiToken = config.wuzapi_token;
      }

      const targetPort = Number(config?.wuzapi_port || 8080);
      const { data: mappedInstance } = await supabase
        .from("wuzapi_instances")
        .select("wuzapi_url, wuzapi_token")
        .eq("assigned_to_user", userId)
        .eq("port", targetPort)
        .maybeSingle();

      if (mappedInstance?.wuzapi_url) {
        baseUrl = mappedInstance.wuzapi_url.replace(/\/+$/, "");
        console.log("📡 [PJ-SEND] Usando instância:", baseUrl);
      }
      if (mappedInstance?.wuzapi_token) {
        wuzapiToken = mappedInstance.wuzapi_token;
      }
    }

    // Diagnóstico opcional
    let instanceStatus: any = null;
    if (debugStatus) {
      try {
        const statusResp = await fetch(`${baseUrl}/session/status`, {
          method: "GET",
          headers: { "Token": wuzapiToken },
        });
        const rawStatus = await safeReadJson(statusResp);
        const d = rawStatus?.data ?? rawStatus;
        instanceStatus = {
          ok: statusResp.ok,
          status: statusResp.status,
          baseUrl,
          connected: d?.connected ?? null,
          loggedIn: d?.loggedIn ?? null,
          jid: d?.jid ?? null,
          name: d?.name ?? null,
          events: d?.events ?? null,
        };
      } catch (e: any) {
        instanceStatus = { ok: false, error: e?.message || String(e), baseUrl };
      }
    }

    // Se deve usar fila anti-bloqueio
    if (useQueue) {
      const filaItems = phoneNumbers.map((phone: string) => ({
        user_id: userId,
        phone: phone.replace(/\D/g, ""),
        mensagem: message,
        tipo: imageUrl ? "imagem" : "texto",
        imagem_url: imageUrl || null,
        status: "pendente",
        prioridade: 5,
      }));

      const { error: insertError } = await supabase
        .from("fila_atendimento_pj")
        .insert(filaItems);

      if (insertError) throw insertError;

      console.log(`📬 [PJ-SEND] ${filaItems.length} mensagens adicionadas à fila`);

      return new Response(
        JSON.stringify({
          success: true,
          queued: true,
          total: filaItems.length,
          message: "Mensagens adicionadas à fila anti-bloqueio",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Processar imagem base64 se necessário (converter para URL pública)
    let finalImageUrl = imageUrl;
    if (imageUrl && imageUrl.startsWith("data:")) {
      console.log("🖼️ [PJ-SEND] Imagem base64 detectada, fazendo upload para storage...");
      const uploadedUrl = await uploadBase64ToStorage(supabase, imageUrl, userId || "anonymous");
      if (uploadedUrl) {
        finalImageUrl = uploadedUrl;
        console.log("✅ [PJ-SEND] Imagem convertida para URL:", finalImageUrl);
      } else {
        console.warn("⚠️ [PJ-SEND] Falha ao fazer upload da imagem, enviando só texto");
        finalImageUrl = null;
      }
    }

    // Envio direto
    const results: any[] = [];

    for (const phone of phoneNumbers) {
      let targetPhone: string;
      let validationInfo: any = null;
      
      // Validar número antes de enviar (teste de variantes com/sem 9)
      if (validateBeforeSend) {
        const validation = await findValidPhone(baseUrl, wuzapiToken, phone);
        // CRÍTICO: Usar o número REAL retornado pela API, não o que normalizamos
        targetPhone = validation.realNumber || validation.phone;
        validationInfo = {
          original: phone,
          validated: targetPhone,
          realNumber: validation.realNumber,
          jid: validation.jid,
          wasValidated: validation.valid,
          variantsTested: validation.tested,
        };
        console.log(`📱 [VALIDATE] ${phone} -> REAL: ${targetPhone} (JID: ${validation.jid}) (válido: ${validation.valid})`);
      } else {
        // Normalização simples (comportamento antigo)
        let clean = phone.replace(/\D/g, "");
        if (clean.startsWith("55") && clean.length >= 12) {
          clean = clean.substring(2);
        }
        if (clean.length === 10) {
          const ddd = clean.substring(0, 2);
          const numero = clean.substring(2);
          if (["9", "8", "7", "6"].includes(numero[0])) {
            clean = ddd + "9" + numero;
          }
        }
        if (!clean.startsWith("55")) clean = "55" + clean;
        targetPhone = clean;
      }

      console.log(`📞 [PJ-SEND] Enviando para ${targetPhone}...`);

      try {
        let response: Response;
        let payload: any;

        if (finalImageUrl) {
          response = await fetch(`${baseUrl}/chat/send/image`, {
            method: "POST",
            headers: { "Token": wuzapiToken, "Content-Type": "application/json" },
            body: JSON.stringify({
              Phone: targetPhone,
              Caption: message,
              Image: finalImageUrl,
            }),
          });

          payload = await safeReadJson(response);

          // Fallback para texto se imagem falhar
          if (!response.ok || payload?.success === false) {
            console.log("🧯 [PJ-SEND] Imagem falhou, fallback para texto...");
            response = await fetch(`${baseUrl}/chat/send/text`, {
              method: "POST",
              headers: { "Token": wuzapiToken, "Content-Type": "application/json" },
              body: JSON.stringify({ Phone: targetPhone, Body: message }),
            });
            payload = await safeReadJson(response);
          }
        } else {
          response = await fetch(`${baseUrl}/chat/send/text`, {
            method: "POST",
            headers: { "Token": wuzapiToken, "Content-Type": "application/json" },
            body: JSON.stringify({ Phone: targetPhone, Body: message }),
          });
          payload = await safeReadJson(response);
        }

        const success = response.ok && payload?.success !== false;
        
        // Extrair messageId para rastreio
        const messageId = payload?.data?.Id || payload?.Id || payload?.MessageID || payload?.messageId || null;

        const resultItem: any = {
          phone: targetPhone,
          phone_original: phone,
          success,
          status: response.status,
          messageId,
          response: payload,
        };
        
        if (validationInfo) {
          resultItem.validation = validationInfo;
        }
        
        results.push(resultItem);

        if (success) {
          console.log(`✅ [PJ-SEND] Enviado para ${targetPhone} | msgId: ${messageId}`);
          
          // Registrar envio para rastreio de entrega
          if (messageId) {
            try {
              await supabase.from("pj_mensagens_rastreio").insert({
                user_id: userId,
                phone: targetPhone,
                message_id: messageId,
                tipo: finalImageUrl ? "imagem" : "texto",
                status: "enviado",
                enviado_at: new Date().toISOString(),
              });
            } catch (e) {
              // Ignorar erro se tabela não existir ainda
              console.log("⚠️ Tabela pj_mensagens_rastreio não existe ou erro:", e);
            }
          }
        } else {
          console.error(`❌ [PJ-SEND] Falha para ${targetPhone}:`, payload);
        }

      } catch (fetchErr: any) {
        console.error(`❌ [PJ-SEND] Erro para ${targetPhone}:`, fetchErr);
        results.push({
          phone: targetPhone,
          phone_original: phone,
          success: false,
          error: fetchErr.message,
          validation: validationInfo,
        });
      }

      // Delay entre envios
      await new Promise((r) => setTimeout(r, 500));
    }

    const enviados = results.filter((r) => r.success).length;
    const erros = results.filter((r) => !r.success).length;

    return new Response(
      JSON.stringify({
        success: erros === 0,
        enviados,
        erros,
        total: phoneNumbers.length,
        results,
        instanceStatus,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("❌ [PJ-SEND] Erro geral:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
