import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    if (!supabaseUrl || !supabaseAnonKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing backend env" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    const authHeader = req.headers.get("Authorization") ?? "";

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    const user = userData?.user;

    if (userErr || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const phone = String(body.phone ?? "");
    const message = String(body.message ?? "");
    const imageUrl = body.imageUrl ? String(body.imageUrl) : null;

    if (!phone || !message) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing phone or message" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    const { data: cliente, error: clienteErr } = await supabase
      .from("clientes_afiliados")
      .select("wuzapi_token")
      .eq("user_id", user.id)
      .maybeSingle();

    const token = cliente?.wuzapi_token;

    if (clienteErr || !token) {
      return new Response(
        JSON.stringify({ success: false, error: "Token Wuzapi não encontrado" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    const baseUrl = (Deno.env.get("CONTABO_WUZAPI_URL") || "https://api2.amzofertas.com.br").replace(/\/+$/, "");
    const cleanPhone = phone.replace(/\D/g, "");

    let url = "";
    let payload: Record<string, unknown> = {};

    if (imageUrl) {
      url = `${baseUrl}/chat/send/image`;
      payload = { Phone: cleanPhone, Caption: message, Image: imageUrl };
    } else {
      url = `${baseUrl}/chat/send/text`;
      payload = { Phone: cleanPhone, Body: message };
    }

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Token: token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const json = await res.json().catch(() => null);
    const ok = res.ok && !!json?.success;

    return new Response(
      JSON.stringify({ success: ok, payload: json, status: res.status }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ success: false, error: (e as Error)?.message ?? String(e) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  }
});
