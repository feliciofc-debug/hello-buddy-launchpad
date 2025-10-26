import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ShopeeAffiliateConfig {
  appId: string;
  secret: string;
  campaignId: string;
}

// Suas credenciais de afiliado (opcionais - se não configuradas, retorna link direto)
const SHOPEE_CONFIG: ShopeeAffiliateConfig = {
  appId: Deno.env.get("SHOPEE_APP_ID") || "",
  secret: Deno.env.get("SHOPEE_SECRET") || "",
  campaignId: Deno.env.get("SHOPEE_CAMPAIGN_ID") || "",
};

/**
 * Gera assinatura HMAC-SHA256 para autenticação com a API da Shopee
 */
async function generateSignature(
  path: string,
  timestamp: number,
  secret: string
): Promise<string> {
  const baseString = `${SHOPEE_CONFIG.appId}${path}${timestamp}`;
  
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(baseString)
  );
  
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Gera link de afiliado usando a API oficial da Shopee
 */
async function generateOfficialAffiliateLink(
  itemid: number,
  shopid: number
): Promise<string | null> {
  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const path = "/affiliate/v1/link/generate";
    
    const signature = await generateSignature(
      path,
      timestamp,
      SHOPEE_CONFIG.secret
    );
    
    console.log("[SHOPEE] Gerando link oficial de afiliado para produto:", itemid);
    
    const response = await fetch("https://open-api.affiliate.shopee.com.br" + path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `${SHOPEE_CONFIG.appId}:${signature}`,
        "Timestamp": timestamp.toString(),
      },
      body: JSON.stringify({
        campaignId: SHOPEE_CONFIG.campaignId,
        itemId: itemid,
        shopId: shopid,
        subIds: ["web", "search"], // Tracking opcional
      }),
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log("[SHOPEE] Link oficial gerado com sucesso");
      return data.data?.link || null;
    } else {
      const errorText = await response.text();
      console.error("[SHOPEE] Erro ao gerar link oficial:", response.status, errorText);
    }
    
    return null;
  } catch (error) {
    console.error("[SHOPEE] Erro ao gerar link oficial:", error);
    return null;
  }
}

/**
 * Gera link de afiliado alternativo (fallback)
 */
function generateFallbackAffiliateLink(
  itemid: number,
  shopid: number,
  campaignId?: string
): string {
  // Formato de link de afiliado Shopee com tracking
  const baseUrl = "https://shopee.com.br";
  const productPath = `product/${shopid}/${itemid}`;
  
  // Se tiver campaign ID, adiciona tracking
  if (campaignId) {
    return `${baseUrl}/${productPath}?af_id=${campaignId}&af_type=product`;
  }
  
  // Link direto sem tracking
  return `${baseUrl}/${productPath}`;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { 
        status: 405, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }

  try {
    const body = await req.json();
    const { itemid, shopid, productName } = body;
    
    if (!itemid || !shopid) {
      return new Response(
        JSON.stringify({ error: "Missing itemid or shopid" }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }
    
    console.log("[SHOPEE] Gerando link de afiliado para:", { productName, itemid, shopid });
    
    let affiliateLink: string | null = null;
    
    // Tenta gerar link oficial se as credenciais estiverem configuradas
    if (SHOPEE_CONFIG.appId && SHOPEE_CONFIG.secret) {
      console.log("[SHOPEE] Tentando gerar link oficial (credenciais configuradas)");
      affiliateLink = await generateOfficialAffiliateLink(itemid, shopid);
    } else {
      console.log("[SHOPEE] Credenciais não configuradas, usando link direto");
    }
    
    // Se não conseguir, usa o fallback
    if (!affiliateLink) {
      console.log("[SHOPEE] Usando link fallback");
      affiliateLink = generateFallbackAffiliateLink(
        itemid,
        shopid,
        SHOPEE_CONFIG.campaignId
      );
    }
    
    // Log para analytics (opcional)
    console.log("[SHOPEE] Link gerado com sucesso:", {
      productName,
      shopid,
      itemid,
      timestamp: new Date().toISOString(),
      hasOfficialLink: affiliateLink.includes("af_id")
    });
    
    return new Response(
      JSON.stringify({
        success: true,
        affiliateLink,
        itemid,
        shopid,
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
    
  } catch (error) {
    console.error("[SHOPEE] Erro no handler:", error);
    
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
