import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Extract payment ID from query or body
  const url = new URL(req.url);
  const q = Object.fromEntries(url.searchParams);
  let paymentId: string | null = null;

  if (q.type === 'payment' && q['data.id']) paymentId = q['data.id'];
  else if (q.topic === 'payment' && q.id) paymentId = q.id;

  if (!paymentId) {
    try {
      const b = await req.json();
      if (b.type === 'payment' && b.data?.id) paymentId = String(b.data.id);
      else if (b.action?.includes('payment') && b.data?.id) paymentId = String(b.data.id);
      else if (b.data?.id) paymentId = String(b.data.id);
    } catch {}
  }

  if (!paymentId) {
    return new Response(JSON.stringify({ error: 'payment id ausente' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Respond 200 immediately
  const responsePromise = new Response(JSON.stringify({ received: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });

  try {
    const mpToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN')!;
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get payment details from MP
    const payResp = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { 'Authorization': `Bearer ${mpToken}` }
    });
    const payment = await payResp.json();

    if (payment.status !== 'approved' || !payment.external_reference) {
      console.log('Payment not approved or no ref:', payment.status);
      return responsePromise;
    }

    const subscriptionId = payment.external_reference;

    // Check for duplicate
    const { data: existingTx } = await supabase
      .from('billing_transactions')
      .select('id')
      .eq('mp_payment_id', String(paymentId))
      .maybeSingle();

    if (existingTx) {
      console.log('Duplicate payment ignored:', paymentId);
      return responsePromise;
    }

    // Get subscription
    const { data: sub } = await supabase
      .from('billing_subscriptions')
      .select('id, customer_id')
      .eq('id', subscriptionId)
      .single();

    if (!sub) {
      console.error('Subscription not found:', subscriptionId);
      return responsePromise;
    }

    const now = new Date();
    const nextDue = new Date(now);
    nextDue.setMonth(nextDue.getMonth() + 1);

    // Insert transaction
    await supabase.from('billing_transactions').insert({
      subscription_id: sub.id,
      customer_id: sub.customer_id,
      mp_payment_id: String(paymentId),
      amount: payment.transaction_amount,
      status: 'approved',
      payment_date: now.toISOString(),
      webhook_received: true,
      raw: payment,
    });

    // Backfill dados do cliente direto do payer (sem sobrescrever dados já preenchidos)
    try {
      const payer = payment.payer || {};
      const ident = payer.identification || {};
      const fullName = [payer.first_name, payer.last_name].filter(Boolean).join(' ').trim();
      const payerPhone = payer.phone
        ? `${payer.phone.area_code || ''}${payer.phone.number || ''}`.replace(/\D/g, '')
        : '';

      const { data: existing } = await supabase
        .from('billing_customers')
        .select('cpf, cnpj, email, name, responsible_name, phone, tipo_pessoa')
        .eq('id', sub.customer_id)
        .maybeSingle();

      if (existing) {
        const upd: Record<string, any> = {};
        if (!existing.cpf && ident.type === 'CPF' && ident.number) upd.cpf = String(ident.number);
        if (!existing.cnpj && ident.type === 'CNPJ' && ident.number) {
          upd.cnpj = String(ident.number);
          upd.tipo_pessoa = 'pj';
        }
        if (!existing.email && payer.email) upd.email = payer.email;
        if (!existing.name && fullName) upd.name = fullName;
        if (!existing.responsible_name && fullName) upd.responsible_name = fullName;
        if (!existing.phone && payerPhone) upd.phone = payerPhone.startsWith('55') ? payerPhone : `55${payerPhone}`;

        if (Object.keys(upd).length > 0) {
          await supabase.from('billing_customers').update(upd).eq('id', sub.customer_id);
          console.log('✅ Backfill billing_customer:', sub.customer_id, Object.keys(upd));
        }
      }
    } catch (bfErr: any) {
      console.error('Backfill payer falhou (não-crítico):', bfErr?.message);
    }

    // Update subscription to active
    await supabase
      .from('billing_subscriptions')
      .update({
        status: 'active',
        last_payment_date: now.toISOString(),
        current_period_start: now.toISOString().split('T')[0],
        current_period_end: nextDue.toISOString().split('T')[0],
        next_billing_date: nextDue.toISOString().split('T')[0],
        payment_fail_count: 0,
        last_reminder_for_date: null,
      })
      .eq('id', sub.id);

    console.log('✅ Billing subscription activated:', sub.id);
  } catch (e: any) {
    console.error('[billing-webhook]', e);
  }

  return responsePromise;
});
