import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MONTHLY_AMOUNT = 597;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { name, email, cpf, phone, billing_address, platform_login, trade_name, cnpj, responsible_name, responsible_cpf, mode } = body;

    const em = String(email || '').trim().toLowerCase();
    if (!name || !em) {
      return new Response(JSON.stringify({ error: 'name e email são obrigatórios' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const mpToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');

    if (!mpToken) throw new Error('MERCADOPAGO_ACCESS_TOKEN não configurado');

    // Check if email already exists
    const { data: exists } = await supabase.from('billing_customers').select('id').eq('email', em).maybeSingle();
    if (exists) {
      return new Response(JSON.stringify({ error: 'E-mail já cadastrado', customer_id: exists.id }), {
        status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const digitsOnly = (s: string) => String(s || '').replace(/\D/g, '');

    // Create customer
    const { data: customer, error: cErr } = await supabase
      .from('billing_customers')
      .insert({
        name: name.trim(),
        email: em,
        cpf: cpf || null,
        phone: phone || null,
        billing_address: billing_address || {},
        platform_login: platform_login ? String(platform_login).trim() : null,
        trade_name: trade_name?.trim() || null,
        cnpj: cnpj ? digitsOnly(cnpj) : null,
        responsible_name: responsible_name?.trim() || null,
        responsible_cpf: responsible_cpf ? digitsOnly(responsible_cpf) : null,
      })
      .select()
      .single();

    if (cErr) throw cErr;

    // Create subscription
    const { data: subscription, error: sErr } = await supabase
      .from('billing_subscriptions')
      .insert({ customer_id: customer.id, status: 'pending_payment' })
      .select()
      .single();

    if (sErr) throw sErr;

    const notificationUrl = `${supabaseUrl}/functions/v1/billing-webhook`;

    if (mode === 'checkout') {
      // Checkout Pro (PIX or card via MP hosted page)
      const prefBody = {
        items: [{ title: `Mensalidade AMZOfertas — ${name.trim()}`, quantity: 1, unit_price: MONTHLY_AMOUNT, currency_id: 'BRL' }],
        payer: { email: em },
        external_reference: subscription.id,
        notification_url: notificationUrl,
        back_urls: {
          success: `${supabaseUrl.replace('.supabase.co', '')}/pay?status=success`,
          failure: `${supabaseUrl.replace('.supabase.co', '')}/pay?status=failure`,
          pending: `${supabaseUrl.replace('.supabase.co', '')}/pay?status=pending`,
        },
        auto_return: 'approved',
      };

      const prefResp = await fetch('https://api.mercadopago.com/checkout/preferences', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${mpToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(prefBody),
      });
      const pref = await prefResp.json();

      return new Response(JSON.stringify({
        success: true,
        customer_id: customer.id,
        subscription_id: subscription.id,
        init_point: pref.init_point,
        sandbox_init_point: pref.sandbox_init_point,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Default: PIX direct
    const firstName = name.trim().split(/\s+/)[0] || 'Cliente';
    const payer: any = { email: em, first_name: firstName };
    const cpfDigits = digitsOnly(cpf);
    if (cpfDigits && cpfDigits.length >= 11) {
      payer.identification = { type: 'CPF', number: cpfDigits };
    }

    const pixBody = {
      transaction_amount: MONTHLY_AMOUNT,
      description: `Mensalidade AMZOfertas — ${name.trim()}`,
      payment_method_id: 'pix',
      payer,
      external_reference: subscription.id,
      notification_url: notificationUrl,
    };

    const pixResp = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mpToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': crypto.randomUUID(),
      },
      body: JSON.stringify(pixBody),
    });

    const created = await pixResp.json();
    if (!pixResp.ok) {
      console.error('MP error:', created);
      throw new Error(created.message || 'Erro ao criar PIX');
    }

    const tx = created.point_of_interaction?.transaction_data;

    return new Response(JSON.stringify({
      success: true,
      customer_id: customer.id,
      subscription_id: subscription.id,
      mp_payment_id: created.id,
      pix_qr_code: tx?.qr_code || null,
      pix_qr_code_base64: tx?.qr_code_base64 || null,
      ticket_url: tx?.ticket_url || null,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('Erro billing-register-pix:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
