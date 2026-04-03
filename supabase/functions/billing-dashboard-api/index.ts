import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MONTHLY_AMOUNT = 597;
const GRACE_DAYS = 2;

function hasAccess(sub: any): boolean {
  if (!sub || !['active'].includes(sub.status)) return false;
  if (!sub.next_billing_date) return false;
  const due = new Date(sub.next_billing_date);
  due.setDate(due.getDate() + GRACE_DAYS);
  return new Date() <= due;
}

function clienteSituacao(sub: any) {
  if (!sub) return { key: 'sem_assinatura', label: 'Sem assinatura', inadimplente: false };
  if (sub.status === 'cancelled') return { key: 'cancelado', label: 'Cancelado', inadimplente: false };
  if (sub.status === 'pending_payment') return { key: 'pendente_pagamento', label: 'Aguardando 1º pagamento', inadimplente: false };
  if (sub.status === 'overdue') return { key: 'inadimplente', label: 'Inadimplente', inadimplente: true };
  if (sub.status === 'active') {
    if (hasAccess(sub)) return { key: 'em_dia', label: 'Em dia', inadimplente: false };
    return { key: 'inadimplente', label: 'Inadimplente', inadimplente: true };
  }
  return { key: 'desconhecido', label: sub.status || '—', inadimplente: false };
}

function pickLatest(subs: any[]) {
  if (!subs?.length) return null;
  return [...subs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Simple admin auth via header
    const authHeader = req.headers.get('x-admin-key') || '';
    const adminKey = Deno.env.get('ADMIN_API_KEY') || Deno.env.get('CRON_SECRET') || '';
    
    // Also accept authorization from logged-in platform admin
    const authBearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify admin: either admin key or authenticated admin user
    let isAdmin = false;
    if (adminKey && (authHeader === adminKey || authBearer === adminKey)) {
      isAdmin = true;
    }
    
    if (!isAdmin && authBearer) {
      // Check if it's a valid supabase JWT for an admin user
      const anonClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!);
      const { data: { user } } = await anonClient.auth.getUser(authBearer);
      if (user) {
        const { data: role } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'admin')
          .maybeSingle();
        if (role) isAdmin = true;
      }
    }

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const url = new URL(req.url);
    const routeHeader = req.headers.get('x-route') || '';
    const path = routeHeader || url.pathname.split('/billing-dashboard-api')[1] || '/';

    // GET /stats
    if (req.method === 'GET' && (path === '/stats' || path === '/' || path === '')) {
      const { data: rows } = await supabase.from('billing_customers').select(`
        id,
        billing_subscriptions ( id, status, next_billing_date, created_at )
      `);

      let em_dia = 0, inadimplentes = 0, pendente = 0, cancelados = 0, sem_assinatura = 0;
      for (const c of rows || []) {
        const sub = pickLatest((c as any).billing_subscriptions || []);
        const sit = clienteSituacao(sub);
        if (sit.key === 'em_dia') em_dia++;
        else if (sit.key === 'inadimplente') inadimplentes++;
        else if (sit.key === 'pendente_pagamento') pendente++;
        else if (sit.key === 'cancelado') cancelados++;
        else if (sit.key === 'sem_assinatura') sem_assinatura++;
      }

      return new Response(JSON.stringify({
        total_empresas: (rows || []).length,
        em_dia, inadimplentes, pendente_primeiro_pagamento: pendente, cancelados, sem_assinatura,
        mrr_estimado_reais: em_dia * MONTHLY_AMOUNT,
        valor_mensalidade: MONTHLY_AMOUNT,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // GET /clients
    if (req.method === 'GET' && path === '/clients') {
      const { data: rows } = await supabase
        .from('billing_customers')
        .select(`
          id, name, trade_name, email, phone, cnpj, responsible_name, responsible_cpf, billing_address, platform_login, created_at,
          billing_subscriptions ( id, status, next_billing_date, last_payment_date, created_at )
        `)
        .order('created_at', { ascending: false });

      const list = (rows || []).map((c: any) => {
        const sub = pickLatest(c.billing_subscriptions || []);
        const sit = clienteSituacao(sub);
        return {
          id: c.id, razao_social: c.name, trade_name: c.trade_name, email: c.email,
          phone: c.phone, cnpj: c.cnpj, responsible_name: c.responsible_name,
          next_billing_date: sub?.next_billing_date, last_payment_date: sub?.last_payment_date,
          situacao: sit.key, situacao_label: sit.label, inadimplente: sit.inadimplente,
          created_at: c.created_at,
        };
      });

      return new Response(JSON.stringify({ clients: list }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // GET /clients/:id
    if (req.method === 'GET' && path.startsWith('/clients/')) {
      const id = path.split('/clients/')[1]?.split('/')[0];
      const { data: customer } = await supabase.from('billing_customers').select('*').eq('id', id).single();
      if (!customer) {
        return new Response(JSON.stringify({ error: 'Cliente não encontrado' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { data: subscriptions } = await supabase
        .from('billing_subscriptions').select('*').eq('customer_id', id).order('created_at', { ascending: false });

      const { data: transactions } = await supabase
        .from('billing_transactions')
        .select('id, subscription_id, mp_payment_id, amount, status, payment_date, created_at')
        .eq('customer_id', id).order('created_at', { ascending: false });

      const latest = pickLatest(subscriptions || []);
      const sit = clienteSituacao(latest);

      return new Response(JSON.stringify({ customer, situacao: sit, subscriptions, transactions }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // POST /clients (create PJ)
    if (req.method === 'POST' && path === '/clients') {
      const b = await req.json();
      const em = String(b.email || '').trim().toLowerCase();
      if (!b.razao_social?.trim() || !em) {
        return new Response(JSON.stringify({ error: 'Razão social e e-mail obrigatórios' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { data: exists } = await supabase.from('billing_customers').select('id').eq('email', em).maybeSingle();
      if (exists) {
        return new Response(JSON.stringify({ error: 'E-mail já cadastrado' }), {
          status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { data: customer, error: cErr } = await supabase
        .from('billing_customers')
        .insert({
          name: b.razao_social.trim(),
          trade_name: b.trade_name?.trim() || null,
          cnpj: b.cnpj ? String(b.cnpj).replace(/\D/g, '') : null,
          email: em,
          phone: b.phone?.trim() || null,
          billing_address: b.billing_address || {},
          responsible_name: b.responsible_name?.trim() || null,
          responsible_cpf: b.responsible_cpf ? String(b.responsible_cpf).replace(/\D/g, '') : null,
          platform_login: b.platform_login?.trim() || null,
        })
        .select().single();

      if (cErr) throw cErr;

      const { data: subscription } = await supabase
        .from('billing_subscriptions')
        .insert({ customer_id: customer.id, status: 'pending_payment' })
        .select().single();

      return new Response(JSON.stringify({ ok: true, customer_id: customer.id, subscription_id: subscription?.id }), {
        status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // POST /clients/:id/checkout-link
    if (req.method === 'POST' && path.match(/\/clients\/[^/]+\/checkout-link/)) {
      const id = path.split('/clients/')[1]?.split('/')[0];
      const { data: customer } = await supabase.from('billing_customers').select('name, email').eq('id', id).single();
      if (!customer) {
        return new Response(JSON.stringify({ error: 'Cliente não encontrado' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { data: sub } = await supabase
        .from('billing_subscriptions').select('id').eq('customer_id', id)
        .order('created_at', { ascending: false }).limit(1).single();

      if (!sub) {
        return new Response(JSON.stringify({ error: 'Assinatura não encontrada' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const mpToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN')!;
      const notificationUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/billing-webhook`;

      const prefResp = await fetch('https://api.mercadopago.com/checkout/preferences', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${mpToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{ title: `Renovação AMZOfertas — ${customer.name}`, quantity: 1, unit_price: MONTHLY_AMOUNT, currency_id: 'BRL' }],
          payer: { email: customer.email },
          external_reference: sub.id,
          notification_url: notificationUrl,
          auto_return: 'approved',
        }),
      });
      const pref = await prefResp.json();

      return new Response(JSON.stringify({ init_point: pref.init_point }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Rota não encontrada' }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('billing-dashboard-api error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
