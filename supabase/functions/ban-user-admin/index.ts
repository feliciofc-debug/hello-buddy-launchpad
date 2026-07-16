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

    const body = await req.json();
    const emails: string[] = body.emails || (body.email ? [body.email] : []);
    const unban: boolean = body.unban === true;
    // "none" unbans; big duration effectively bans forever
    const duration = unban ? "none" : "876000h"; // ~100 anos

    const results: any[] = [];
    // paginate through auth users
    const found = new Map<string, string>();
    let page = 1;
    while (page < 20) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw error;
      for (const u of data.users) {
        if (u.email && emails.map(e => e.toLowerCase()).includes(u.email.toLowerCase())) {
          found.set(u.email.toLowerCase(), u.id);
        }
      }
      if (data.users.length < 200) break;
      page++;
    }

    for (const email of emails) {
      const id = found.get(email.toLowerCase());
      if (!id) { results.push({ email, status: 'not_found' }); continue; }
      const { error } = await admin.auth.admin.updateUserById(id, { ban_duration: duration } as any);
      // also invalida sessões ativas
      try { await admin.auth.admin.signOut(id, 'global' as any); } catch (_) {}
      results.push({ email, id, status: error ? `error:${error.message}` : (unban ? 'unbanned' : 'banned') });
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
