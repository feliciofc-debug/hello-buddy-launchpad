import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PaymentFormDirectProps {
  planName: string;
  amount: number;
  planType: 'monthly' | 'yearly';
  userId: string;
}

export default function PaymentFormDirect({ 
  planName, 
  amount, 
  planType,
  userId 
}: PaymentFormDirectProps) {
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'card' | 'boleto'>('pix');
  const [loading, setLoading] = useState(false);
  const [pixData, setPixData] = useState<any>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  
  const [formData, setFormData] = useState({
    email: '',
    cpf: '',
    firstName: '',
    lastName: ''
  });

  const formatCPF = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})/, '$1-$2')
      .replace(/(-\d{2})\d+?$/, '$1');
  };

  const validateCPF = (cpf: string) => {
    const cleaned = cpf.replace(/\D/g, '');
    return cleaned.length === 11;
  };

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const generatePix = async () => {
    try {
      setLoading(true);
      setError('');
      
      if (!validateEmail(formData.email)) {
        throw new Error('Email inválido');
      }
      
      if (!validateCPF(formData.cpf)) {
        throw new Error('CPF inválido - deve ter 11 dígitos');
      }

      console.log('Gerando PIX...');

      const { data, error: invokeError } = await supabase.functions.invoke('create-pix-direct', {
        body: {
          transaction_amount: amount,
          description: `Assinatura ${planName} - AMZ Ofertas`,
          payer: {
            email: formData.email,
            first_name: formData.firstName || 'Cliente',
            last_name: formData.lastName || 'AMZ Ofertas',
            identification: {
              type: 'CPF',
              number: formData.cpf.replace(/\D/g, '')
            }
          },
          payment_method_id: 'pix',
          metadata: {
            plan_name: planName,
            plan_type: planType,
            user_id: userId
          }
        }
      });

      if (invokeError) {
        throw new Error(invokeError.message);
      }

      if (data?.error) {
        throw new Error(data.message || 'Erro ao gerar PIX');
      }

      console.log('PIX criado com sucesso:', data);
      setPixData(data);
      
      if (data.id) {
        checkPaymentStatus(data.id);
      }

    } catch (err: any) {
      console.error('Erro:', err);
      setError(err.message || 'Erro ao processar pagamento');
    } finally {
      setLoading(false);
    }
  };

  const checkPaymentStatus = (paymentId: string) => {
    let attempts = 0;
    const maxAttempts = 60;
    
    const interval = setInterval(async () => {
      attempts++;
      
      try {
        const { data } = await supabase.functions.invoke('check-payment-status', {
          body: { paymentId }
        });
        
        console.log('Status do pagamento:', data?.status);
        
        if (data?.status === 'approved') {
          clearInterval(interval);
          alert('✅ Pagamento aprovado com sucesso!');
          window.location.href = '/dashboard?payment=success';
        } else if (data?.status === 'rejected' || data?.status === 'cancelled') {
          clearInterval(interval);
          setError('Pagamento não foi concluído');
          setPixData(null);
        }
        
        if (attempts >= maxAttempts) {
          clearInterval(interval);
          setError('Tempo limite expirado. Tente novamente.');
        }
      } catch (error) {
        console.error('Erro ao verificar status:', error);
      }
    }, 5000);
  };

  const copyToClipboard = () => {
    if (pixData?.qr_code) {
      navigator.clipboard.writeText(pixData.qr_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-slate-800/50 backdrop-blur-sm rounded-lg shadow-lg border border-orange-500/30">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2 text-white">Finalizar Assinatura</h2>
        <div className="bg-gradient-to-r from-orange-500/20 to-red-500/20 p-3 rounded-lg border border-orange-500/30">
          <p className="text-sm text-gray-300">Plano: <strong className="text-white">{planName}</strong></p>
          <p className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500 mt-1">
            R$ {amount.toFixed(2)}/{planType === 'monthly' ? 'mês' : 'ano'}
          </p>
        </div>
      </div>

      {!pixData ? (
        <>
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Escolha a forma de pagamento
            </label>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => setPaymentMethod('pix')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  paymentMethod === 'pix'
                    ? 'border-green-500 bg-green-500/20'
                    : 'border-slate-600 hover:border-slate-500 bg-slate-700/30'
                }`}
              >
                <div className="text-center">
                  <div className="text-3xl mb-2">📱</div>
                  <div className="font-semibold text-white">PIX</div>
                  <div className="text-xs text-gray-400 mt-1">Aprovação instantânea</div>
                </div>
              </button>

              <button
                disabled
                className="p-4 rounded-lg border-2 border-slate-700 bg-slate-800/50 opacity-50 cursor-not-allowed"
              >
                <div className="text-center">
                  <div className="text-3xl mb-2">💳</div>
                  <div className="font-semibold text-gray-400">Cartão</div>
                  <div className="text-xs text-gray-500 mt-1">Em breve</div>
                </div>
              </button>

              <button
                disabled
                className="p-4 rounded-lg border-2 border-slate-700 bg-slate-800/50 opacity-50 cursor-not-allowed"
              >
                <div className="text-center">
                  <div className="text-3xl mb-2">📄</div>
                  <div className="font-semibold text-gray-400">Boleto</div>
                  <div className="text-xs text-gray-500 mt-1">Em breve</div>
                </div>
              </button>
            </div>
          </div>

          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                E-mail *
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                className="w-full p-3 border border-slate-600 bg-slate-700/50 text-white rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="seu@email.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                CPF *
              </label>
              <input
                type="text"
                value={formData.cpf}
                onChange={(e) => setFormData({...formData, cpf: formatCPF(e.target.value)})}
                className="w-full p-3 border border-slate-600 bg-slate-700/50 text-white rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="000.000.000-00"
                maxLength={14}
                required
              />
              <p className="text-xs text-gray-400 mt-1">
                Digite apenas números - a formatação é automática
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Nome (opcional)
                </label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                  className="w-full p-3 border border-slate-600 bg-slate-700/50 text-white rounded-lg focus:ring-2 focus:ring-green-500"
                  placeholder="João"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Sobrenome (opcional)
                </label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                  className="w-full p-3 border border-slate-600 bg-slate-700/50 text-white rounded-lg focus:ring-2 focus:ring-green-500"
                  placeholder="Silva"
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-500/20 border border-red-500/50 rounded-lg">
              <p className="text-red-300 text-sm font-medium">⚠️ {error}</p>
            </div>
          )}

          <button
            onClick={generatePix}
            disabled={loading || !formData.email || !formData.cpf}
            className={`w-full py-4 rounded-lg font-bold text-lg transition-all ${
              loading || !formData.email || !formData.cpf
                ? 'bg-slate-600 cursor-not-allowed text-gray-400'
                : 'bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:from-green-600 hover:to-emerald-600 shadow-lg'
            }`}
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                Gerando PIX...
              </span>
            ) : (
              `Gerar PIX - R$ ${amount.toFixed(2)}`
            )}
          </button>

          <div className="mt-4 text-center">
            <p className="text-xs text-gray-400">
              🔒 Pagamento 100% seguro via Mercado Pago
            </p>
          </div>
        </>
      ) : (
        <div className="text-center">
          <div className="mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500/20 rounded-full mb-4 border-2 border-green-500">
              <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-white">PIX Gerado com Sucesso!</h3>
            <p className="text-gray-300 mt-2">Escaneie o QR Code ou copie o código</p>
          </div>
          
          {pixData.qr_code_base64 ? (
            <div className="bg-white p-6 rounded-lg inline-block border-2 border-green-500 mb-6">
              <img 
                src={`data:image/png;base64,${pixData.qr_code_base64}`}
                alt="QR Code PIX"
                className="w-64 h-64"
              />
            </div>
          ) : pixData.qr_code ? (
            <div className="bg-white p-6 rounded-lg inline-block border-2 border-green-500 mb-6">
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(pixData.qr_code)}`}
                alt="QR Code PIX"
                className="w-64 h-64"
              />
            </div>
          ) : null}

          {pixData.qr_code && (
            <div className="mb-6">
              <p className="text-sm font-medium text-gray-300 mb-2">PIX Copia e Cola:</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 p-3 bg-slate-700/50 rounded-lg border border-slate-600">
                  <p className="text-xs font-mono break-all text-gray-400">
                    {pixData.qr_code.substring(0, 50)}...
                  </p>
                </div>
                <button
                  onClick={copyToClipboard}
                  className={`px-6 py-3 rounded-lg font-medium transition-all ${
                    copied 
                      ? 'bg-green-500 text-white' 
                      : 'bg-blue-500 text-white hover:bg-blue-600'
                  }`}
                >
                  {copied ? '✓ Copiado!' : 'Copiar'}
                </button>
              </div>
            </div>
          )}

          <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg p-4 text-left mb-6">
            <h4 className="font-semibold text-blue-300 mb-2">Como pagar:</h4>
            <ol className="text-sm text-gray-300 space-y-2">
              <li className="flex items-start">
                <span className="font-bold mr-2 text-blue-400">1.</span>
                Abra o app do seu banco ou carteira digital
              </li>
              <li className="flex items-start">
                <span className="font-bold mr-2 text-blue-400">2.</span>
                Escolha a opção pagar com PIX
              </li>
              <li className="flex items-start">
                <span className="font-bold mr-2 text-blue-400">3.</span>
                Escaneie o QR Code ou use o código Copia e Cola
              </li>
              <li className="flex items-start">
                <span className="font-bold mr-2 text-blue-400">4.</span>
                Confirme o pagamento de R$ {amount.toFixed(2)}
              </li>
            </ol>
          </div>

          <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-lg p-4">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-yellow-400 mr-2"></div>
              <p className="text-sm font-medium text-yellow-300">
                Aguardando confirmação do pagamento...
              </p>
            </div>
            <p className="text-xs text-yellow-400/80 mt-2">
              Você será redirecionado automaticamente após o pagamento
            </p>
          </div>

          {pixData.expiration_date && (
            <p className="text-xs text-gray-400 mt-4">
              ⏰ Este QR Code expira em: {new Date(pixData.expiration_date).toLocaleString('pt-BR')}
            </p>
          )}

          <button
            onClick={() => {
              setPixData(null);
              setError('');
            }}
            className="mt-4 text-sm text-blue-400 hover:text-blue-300 underline"
          >
            Gerar novo PIX
          </button>
        </div>
      )}
    </div>
  );
}
