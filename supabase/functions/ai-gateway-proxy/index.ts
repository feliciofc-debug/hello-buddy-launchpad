import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization") || "";
    const expectedToken = Deno.env.get("EXTERNAL_AI_GATEWAY_TOKEN");

    if (!expectedToken) {
      return new Response(
        JSON.stringify({ success: false, error: "Token não configurado no servidor" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (authHeader !== `Bearer ${expectedToken}`) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const {
      images,
      prompt,
      schema,
      model = "google/gemini-2.5-pro",
      system = "Você é um analista técnico especializado em interpretação de imagens. Responda de forma objetiva, estruturada e em português.",
    } = body;

    if (!images || !Array.isArray(images) || images.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "images array required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!prompt || typeof prompt !== "string") {
      return new Response(
        JSON.stringify({ success: false, error: "prompt string required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) {
      return new Response(
        JSON.stringify({ success: false, error: "LOVABLE_API_KEY não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const imageContents = images.map((img: string) => {
      const url = img.startsWith("data:") ? img : `data:image/jpeg;base64,${img}`;
      return { type: "image_url", image_url: { url } };
    });

    const messages = [
      { role: "system", content: system },
      {
        role: "user",
        content: [{ type: "text", text: prompt }, ...imageContents],
      },
    ];

    const requestBody: Record<string, unknown> = {
      model,
      messages,
      temperature: 0.1,
      max_tokens: 4096,
    };

    if (schema && typeof schema === "object") {
      requestBody.response_format = {
        type: "json_schema",
        json_schema: {
          name: "analise_imagem",
          strict: true,
          schema,
        },
      };
    }

    const gatewayRes = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": lovableKey,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify(requestBody),
    });

    if (!gatewayRes.ok) {
      const errorText = await gatewayRes.text();
      console.error("Gateway error:", gatewayRes.status, errorText);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Erro no AI Gateway: ${gatewayRes.status}`,
          gatewayError: errorText,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await gatewayRes.json();
    const content = data.choices?.[0]?.message?.content;

    let output = content;
    if (schema && typeof content === "string") {
      try {
        output = JSON.parse(content);
      } catch {
        // mantém como string se não for JSON válido
      }
    }

    return Response.json(
      {
        success: true,
        output,
        model,
        usage: data.usage,
      },
      { headers: corsHeaders }
    );
  } catch (err) {
    console.error("ai-gateway-proxy error:", err);
    return Response.json(
      { success: false, error: err.message || "Erro interno" },
      { status: 500, headers: corsHeaders }
    );
  }
});
