// supabase/functions/wuzapi-webhook-debug/index.ts
// Debug endpoint to verify WuzAPI webhook delivery from Contabo.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function safeStringify(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch {
    return "[unstringifiable]";
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const contentType = req.headers.get("content-type") || "";
  let bodyText = "";
  let json: unknown = null;

  try {
    if (contentType.includes("application/json")) {
      json = await req.json();
      bodyText = safeStringify(json);
    } else {
      bodyText = await req.text();
      try {
        json = JSON.parse(bodyText);
      } catch {
        // keep as text
      }
    }
  } catch (e) {
    console.error("[wuzapi-webhook-debug] failed to read body", e);
  }

  console.log("[wuzapi-webhook-debug] incoming", {
    method: req.method,
    url: req.url,
    contentType,
    headers: Object.fromEntries(req.headers.entries()),
    bodyPreview: bodyText.slice(0, 2000),
  });

  return new Response(
    JSON.stringify({
      success: true,
      received: true,
      contentType,
      parsedJson: json !== null,
      bodyLength: bodyText.length,
    }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    }
  );
});
