import { useState } from 'react';
import { CreditCard, Shield, Zap, CheckCircle2, Loader2, QrCode, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CheckoutProMPProps {
  planName: string;
  userId: string;
}

const CheckoutProMP = ({ planName, userId }: CheckoutProMPProps) => {
  const [loading, setLoading] = useState(false);

  const handlePagar = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data, error } = await supabase.functions.invoke('create-payment', {
        body: {
          userId,
          userEmail: user.email,
          planType: 'pro',
        },
      });

      if (error) throw error;
      const paymentLink = data?.init_point || data?.checkoutUrl || data?.payment_link;
      if (!paymentLink) throw new Error('Link de pagamento não retornado');

      // Redireciona para o Checkout Pro do Mercado Pago (página bonita com PIX/Cartão/Boleto)
      window.location.href = paymentLink;
    } catch (err: any) {
      console.error('Erro ao iniciar pagamento:', err);
      toast.error(err.message || 'Erro ao iniciar pagamento. Tente novamente.');
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-2xl overflow-hidden max-w-2xl mx-auto">
      {/* Header com plano */}
      <div className="bg-gradient-to-br from-[#1a2332] to-[#2a3548] px-8 py-8 text-white">
        <div className="flex items-center gap-2 text-orange-400 text-sm font-semibold mb-2">
          <Zap className="w-4 h-4" />
          PLANO PRO
        </div>
        <h2 className="text-3xl font-bold mb-1">{planName}</h2>
        <p className="text-blue-100 text-sm mb-6">Acesso completo à plataforma</p>

        <div className="flex items-baseline gap-2">
          <span className="text-5xl font-bold">R$ 597</span>
          <span className="text-blue-200">/mês</span>
        </div>
      </div>

      {/* Benefícios */}
      <div className="px-8 py-6 border-b">
        <div className="grid grid-cols-2 gap-3 text-sm">
          {[
            'Postagem automática 24/7',
            'IA Marketing (50 imagens/mês)',
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

      {/* Métodos de pagamento (visual) */}
      <div className="px-8 py-6">
        <p className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-3">
          Formas de pagamento disponíveis
        </p>
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="border-2 border-gray-200 rounded-lg p-3 text-center hover:border-[#1a2332] transition">
            <QrCode className="w-6 h-6 mx-auto mb-1 text-[#1a2332]" />
            <p className="text-xs font-semibold text-gray-700">PIX</p>
            <p className="text-[10px] text-green-600">Aprovação imediata</p>
          </div>
          <div className="border-2 border-gray-200 rounded-lg p-3 text-center hover:border-[#1a2332] transition">
            <CreditCard className="w-6 h-6 mx-auto mb-1 text-[#1a2332]" />
            <p className="text-xs font-semibold text-gray-700">Cartão</p>
            <p className="text-[10px] text-gray-500">Até 12x</p>
          </div>
          <div className="border-2 border-gray-200 rounded-lg p-3 text-center hover:border-[#1a2332] transition">
            <Receipt className="w-6 h-6 mx-auto mb-1 text-[#1a2332]" />
            <p className="text-xs font-semibold text-gray-700">Boleto</p>
            <p className="text-[10px] text-gray-500">1 a 3 dias</p>
          </div>
        </div>

        {/* CTA */}
        <Button
          onClick={handlePagar}
          disabled={loading}
          className="w-full h-14 text-base font-bold bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white shadow-lg"
        >
          {loading ? (
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
  );
};

export default CheckoutProMP;
