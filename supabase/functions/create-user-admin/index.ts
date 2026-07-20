import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    const { email, password } = await req.json();
    if (!email || !password) throw new Error('email e password obrigatórios');

    // procurar existente
    let existingId: string | null = null;
    let page = 1;
    while (page < 20) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw error;
      const hit = data.users.find(u => u.email?.toLowerCase() === String(email).toLowerCase());
      if (hit) { existingId = hit.id; break; }
      if (data.users.length < 200) break;
      page++;
    }

    if (existingId) {
      const { error } = await admin.auth.admin.updateUserById(existingId, {
        password, email_confirm: true, ban_duration: 'none'
      } as any);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, action: 'updated', id: existingId }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data, error } = await admin.auth.admin.createUser({
      email, password, email_confirm: true
    });
    if (error) throw error;
    return new Response(JSON.stringify({ success: true, action: 'created', id: data.user?.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
