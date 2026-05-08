import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MONTHLY_AMOUNT = 597;
const GRACE_DAYS = 1;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, platform_login } = await req.json();
    const em = String(email || '').trim().toLowerCase();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let customer = null;
    if (em) {
      const { data } = await supabase.from('billing_customers').select('id, name, email').eq('email', em).maybeSingle();
      customer = data;
    }
    if (!customer && platform_login) {
      const { data } = await supabase.from('billing_customers').select('id, name, email')
        .eq('platform_login', String(platform_login).trim()).maybeSingle();
      customer = data;
    }

    if (!customer) {
      return new Response(JSON.stringify({
        active: false, plan: `Mensal R$ ${MONTHLY_AMOUNT}`, message: 'Cliente não encontrado',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: sub } = await supabase
      .from('billing_subscriptions')
      .select('id, status, next_billing_date, last_payment_date')
      .eq('customer_id', customer.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let active = false;
    if (sub && sub.status === 'active' && sub.next_billing_date) {
      const due = new Date(sub.next_billing_date);
      due.setDate(due.getDate() + GRACE_DAYS);
      active = new Date() <= due;
    }

    return new Response(JSON.stringify({
      active,
      expires_at: sub?.next_billing_date || null,
      grace_days_after_due: GRACE_DAYS,
      subscription_status: sub?.status || null,
      customer_name: customer.name,
      plan: `Mensal R$ ${MONTHLY_AMOUNT}`,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('billing-validate-access error:', error);
    return new Response(JSON.stringify({ active: false, error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
