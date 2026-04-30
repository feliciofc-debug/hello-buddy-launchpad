import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import PaymentFormDirectPublico from '@/components/PaymentFormDirectPublico';

interface SubInfo {
  amount: number;
  next_billing_date: string | null;
  customer_name: string | null;
  customer_email: string | null;
}

const PagarMensalidade = () => {
  const { subscriptionId } = useParams<{ subscriptionId: string }>();
  const [info, setInfo] = useState<SubInfo | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!subscriptionId) return;
      const { data, error } = await supabase.rpc('get_billing_pagamento_publico', {
        p_subscription_id: subscriptionId,
      });

      if (error || !data || (Array.isArray(data) && data.length === 0)) {
        setLoadingInfo(false);
        return;
      }

      const row: any = Array.isArray(data) ? data[0] : data;
      setInfo({
        amount: Number(row.amount ?? 597),
        next_billing_date: row.next_billing_date,
        customer_name: row.customer_name ?? null,
        customer_email: row.customer_email ?? null,
      });
      setLoadingInfo(false);
    };
    load();
  }, [subscriptionId]);

  if (loadingInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#1a2332]" />
      </div>
    );
  }

  if (!info || !subscriptionId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
          <h1 className="text-2xl font-bold text-[#1a2332] mb-2">Cobrança não encontrada</h1>
          <p className="text-gray-600">Verifique o link enviado ou entre em contato com o suporte.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 py-12 px-4">
      <PaymentFormDirectPublico
        subscriptionId={subscriptionId}
        amount={info.amount}
        customerName={info.customer_name}
        customerEmail={info.customer_email}
      />
    </div>
  );
};

export default PagarMensalidade;
