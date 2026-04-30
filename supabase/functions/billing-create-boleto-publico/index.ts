import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function bad(message: string, status = 400) {
  return new Response(
    JSON.stringify({ error: true, message }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const {
      subscription_id,
      email,
      document_type,
      document_number,
      first_name,
      last_name,
      company_name,
    } = body || {};

    if (!subscription_id || !UUID_RE.test(String(subscription_id))) return bad('subscription_id inválido');
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return bad('email inválido');
    if (!document_type || !['cpf', 'cnpj'].includes(document_type)) return bad('document_type inválido');
    const docNum = String(document_number || '').replace(/\D/g, '');
    if (document_type === 'cpf' && docNum.length !== 11) return bad('CPF inválido');
    if (document_type === 'cnpj' && docNum.length !== 14) return bad('CNPJ inválido');
    if (!first_name || !last_name) return bad('Nome completo é obrigatório para boleto');

    const mpToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    if (!mpToken) return bad('MERCADOPAGO_ACCESS_TOKEN não configurado', 500);

    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: sub, error: subErr } = await supabase
      .from('billing_subscriptions')
      .select('id, amount, status')
      .eq('id', subscription_id)
      .maybeSingle();

    if (subErr || !sub) return bad('Cobrança não encontrada', 404);
    if (sub.status === 'cancelled') return bad('Esta cobrança foi cancelada', 410);
    if (!sub.amount || Number(sub.amount) <= 0) return bad('Valor da cobrança inválido', 500);

    const transaction_amount = Number(sub.amount);

    const payload = {
      transaction_amount,
      description: 'Mensalidade AMZ Ofertas PRO',
      payment_method_id: 'bolbradesco',
      date_of_expiration: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      payer: {
        email,
        first_name,
        last_name,
        identification: {
          type: document_type.toUpperCase(),
          number: docNum,
        },
      },
      external_reference: subscription_id,
      metadata: {
        subscription_id,
        source: 'pagar_publico',
        document_type,
      },
    };

    const mpResp = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mpToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': `${subscription_id}-${Date.now()}-${Math.random()}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await mpResp.json();
    if (!mpResp.ok) {
      console.error('MP erro boleto público:', data);
      let msg = 'Erro ao gerar boleto';
      if (data?.cause?.[0]?.description) msg = data.cause[0].description;
      else if (data?.message) msg = data.message;
      return bad(msg, 400);
    }

    return new Response(
      JSON.stringify({
        id: data.id,
        status: data.status,
        barcode: data.barcode?.content,
        pdf_url: data.transaction_details?.external_resource_url,
        due_date: data.date_of_expiration,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e: any) {
    console.error('billing-create-boleto-publico erro:', e);
    return bad('Erro interno do servidor', 500);
  }
});
