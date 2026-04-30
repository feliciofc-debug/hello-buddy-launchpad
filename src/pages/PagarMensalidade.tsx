import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CreditCard, Shield, Zap, CheckCircle2, Loader2, QrCode, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
  const [paying, setPaying] = useState(false);

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

  const handlePagar = async () => {
    if (!subscriptionId) return;
    setPaying(true);
    try {
      const { data, error } = await supabase.functions.invoke('criar-cobranca-mercadopago-publico', {
        body: { subscription_id: subscriptionId },
      });
      if (error) throw error;
      if (!data?.payment_link) throw new Error('Link de pagamento não retornado');
      window.location.href = data.payment_link;
    } catch (err: any) {
      console.error('Erro ao iniciar pagamento:', err);
      toast.error(err.message || 'Erro ao iniciar pagamento. Tente novamente.');
      setPaying(false);
    }
  };

  if (loadingInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#1a2332]" />
      </div>
    );
  }

  if (!info) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
          <h1 className="text-2xl font-bold text-[#1a2332] mb-2">Cobrança não encontrada</h1>
          <p className="text-gray-600">Verifique o link enviado ou entre em contato com o suporte.</p>
        </div>
      </div>
    );
  }

  const venc = info.next_billing_date
    ? new Date(info.next_billing_date + 'T00:00:00').toLocaleDateString('pt-BR')
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 py-12 px-4">
      <div className="bg-white rounded-2xl shadow-2xl overflow-hidden max-w-2xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-br from-[#1a2332] to-[#2a3548] px-8 py-8 text-white">
          <div className="flex items-center gap-2 text-orange-400 text-sm font-semibold mb-2">
            <Zap className="w-4 h-4" />
            MENSALIDADE AMZ OFERTAS PRO
          </div>
          <h2 className="text-3xl font-bold mb-1">
            {info.customer_name || 'Cliente'}
          </h2>
          <p className="text-blue-100 text-sm mb-6">
            {venc ? `Vencimento: ${venc}` : 'Pagamento da sua mensalidade'}
          </p>
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-bold">
              R$ {info.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
            <span className="text-blue-200">/mês</span>
          </div>
        </div>

        {/* Benefícios */}
        <div className="px-8 py-6 border-b">
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              'Postagem automática 24/7',
              'IA Marketing ilimitada',
              'WhatsApp integrado',
              'Suporte prioritário',
            ].map((b) => (
              <div key={b} className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span className="text-gray-700">{b}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Métodos */}
        <div className="px-8 py-6">
          <p className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-3">
            Formas de pagamento disponíveis
          </p>
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="border-2 border-gray-200 rounded-lg p-3 text-center">
              <QrCode className="w-6 h-6 mx-auto mb-1 text-[#1a2332]" />
              <p className="text-xs font-semibold text-gray-700">PIX</p>
              <p className="text-[10px] text-green-600">Aprovação imediata</p>
            </div>
            <div className="border-2 border-gray-200 rounded-lg p-3 text-center">
              <CreditCard className="w-6 h-6 mx-auto mb-1 text-[#1a2332]" />
              <p className="text-xs font-semibold text-gray-700">Cartão</p>
              <p className="text-[10px] text-gray-500">À vista</p>
            </div>
            <div className="border-2 border-gray-200 rounded-lg p-3 text-center">
              <Receipt className="w-6 h-6 mx-auto mb-1 text-[#1a2332]" />
              <p className="text-xs font-semibold text-gray-700">Boleto</p>
              <p className="text-[10px] text-gray-500">À vista</p>
            </div>
          </div>

          <Button
            onClick={handlePagar}
            disabled={paying}
            className="w-full h-14 text-base font-bold bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white shadow-lg"
          >
            {paying ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Abrindo checkout seguro...
              </>
            ) : (
              <>
                Pagar com Mercado Pago
                <CreditCard className="w-5 h-5 ml-2" />
              </>
            )}
          </Button>

          <div className="flex items-center justify-center gap-2 mt-4 text-xs text-gray-500">
            <Shield className="w-4 h-4 text-green-600" />
            Pagamento 100% seguro processado pelo Mercado Pago
          </div>
        </div>
      </div>
    </div>
  );
};

export default PagarMensalidade;
