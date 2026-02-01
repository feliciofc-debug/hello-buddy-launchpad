import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOCAWEB_WUZAPI_URL = Deno.env.get("WUZAPI_URL") || "https://wuzapi.amzofertas.com.br";
const LOCAWEB_WUZAPI_TOKEN = Deno.env.get("WUZAPI_TOKEN") || "";

async function safeReadJson(res: Response): Promise<{ json: any | null; text: string }> {
  const text = await res.text();
  if (!text) return { json: null, text: "" };
  try {
    return { json: JSON.parse(text), text };
  } catch {
    return { json: null, text };
  }
}

// Gera variantes do número para testar (com e sem 9º dígito)
function generatePhoneVariants(phone: string): string[] {
  let clean = phone.replace(/\D/g, "");
  
  // Remove 55 do início se existir
  if (clean.startsWith("55") && clean.length >= 12) {
    clean = clean.substring(2);
  }
  
  const variants: string[] = [];
  
  // Caso 1: Número com 11 dígitos (DDD + 9 + 8 dígitos) - testar também SEM o 9
  if (clean.length === 11 && clean[2] === "9") {
    const comNove = "55" + clean;
    const semNove = "55" + clean.substring(0, 2) + clean.substring(3);
    variants.push(comNove);
    variants.push(semNove);
  }
  // Caso 2: Número com 10 dígitos (DDD + 8 dígitos) - testar também COM o 9
  else if (clean.length === 10) {
    const ddd = clean.substring(0, 2);
    const numero = clean.substring(2);
    const semNove = "55" + clean;
    const comNove = "55" + ddd + "9" + numero;
    variants.push(comNove);
    variants.push(semNove);
  }
  // Caso padrão
  else {
    if (!clean.startsWith("55")) clean = "55" + clean;
    variants.push(clean);
  }
  
  return [...new Set(variants)]; // Remove duplicatas
}

// Verifica se número existe no WhatsApp e retorna o JID REAL
// IMPORTANTE: Phone deve ser enviado como ARRAY, não string!
async function checkPhoneExists(
  baseUrl: string, 
  token: string, 
  phone: string
): Promise<{ exists: boolean; jid?: string; realNumber?: string; error?: string }> {
  try {
    // CRÍTICO: Enviar Phone como ARRAY - isso é o formato correto da WuzAPI!
    const checkResp = await fetch(`${baseUrl}/user/check`, {
      method: "POST",
      headers: {
        "Token": token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        Phone: [phone], // ARRAY, não string!
      }),
    });
    
    const { json } = await safeReadJson(checkResp);
    
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
    
    console.log(`[CHECK] ❌ ${phone} não encontrado`);
    return { exists: false };
    
  } catch (err: any) {
    console.error(`[CHECK] Erro verificando ${phone}:`, err.message);
    return { exists: false, error: err.message };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, userId, testVariants = true } = await req.json();
    
    if (!phone) {
      return new Response(
        JSON.stringify({ valid: false, error: "Telefone não informado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Resolver instância PJ do usuário
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
      }
      if (mappedInstance?.wuzapi_token) {
        wuzapiToken = mappedInstance.wuzapi_token;
      }
    }

    // Gerar variantes do número
    const variants = testVariants ? generatePhoneVariants(phone) : [phone.replace(/\D/g, "")];
    
    console.log(`🔍 [VALIDATE-PJ] Testando ${variants.length} variante(s) para: ${phone}`);
    console.log(`📱 Variantes:`, variants);

    const results: Array<{
      phone: string;
      exists: boolean;
      jid?: string;
      realNumber?: string;
      error?: string;
    }> = [];

    // Testar cada variante
    for (const variant of variants) {
      const result = await checkPhoneExists(baseUrl, wuzapiToken, variant);
      results.push({
        phone: variant,
        ...result,
      });
      
      console.log(`📞 ${variant}: ${result.exists ? "✅ EXISTE" : "❌ não existe"} | JID real: ${result.jid || "N/A"}`);
      
      // Se encontrou uma variante válida, podemos parar (otimização)
      if (result.exists) {
        break;
      }
    }

    // Encontrar a primeira variante válida
    const validResult = results.find(r => r.exists);

    return new Response(
      JSON.stringify({
        valid: !!validResult,
        phone_original: phone,
        phone_validated: validResult?.realNumber || validResult?.phone || null, // Usar número REAL
        jid: validResult?.jid || null,
        jid_number: validResult?.realNumber || null, // Número extraído do JID real
        variants_tested: results,
        baseUrl: baseUrl.replace(/token=[^&]+/, "token=***"),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("❌ [VALIDATE-PJ] Erro:", err);
    return new Response(
      JSON.stringify({ valid: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
