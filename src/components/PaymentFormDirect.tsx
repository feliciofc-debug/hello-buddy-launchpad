import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

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
  const navigate = useNavigate();
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'card' | 'boleto'>('pix');
  const [loading, setLoading] = useState(false);
  const [paymentData, setPaymentData] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [installments, setInstallments] = useState(1);
  
  const [formData, setFormData] = useState({
    email: '',
    cpf: '',
    firstName: '',
    lastName: '',
    cardNumber: '',
    cardHolder: '',
    expiryMonth: '',
    expiryYear: '',
    cvv: ''
  });

  const formatCPF = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})/, '$1-$2')
      .replace(/(-\d{2})\d+?$/, '$1');
  };

  const formatCardNumber = (value: string) => {
    return value
      .replace(/\s/g, '')
      .replace(/(\d{4})/g, '$1 ')
      .trim();
  };

  const validateCPF = (cpf: string) => {
    const cleaned = cpf.replace(/\D/g, '');
    return cleaned.length === 11;
  };

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const calculateInstallment = (numInstallments: number) => {
    return amount / numInstallments;
  };

  const handlePayment = async () => {
    try {
      setLoading(true);
      
      if (!validateEmail(formData.email)) {
        throw new Error('Email inválido');
      }
      
      if (!validateCPF(formData.cpf)) {
        throw new Error('CPF inválido - deve ter 11 dígitos');
      }

      const basePayload = {
        transaction_amount: amount,
        description: `Assinatura ${planName}`,
        payer: {
          email: formData.email,
          first_name: formData.firstName || 'Cliente',
          last_name: formData.lastName || 'AMZ Ofertas',
          identification: {
            type: 'CPF',
            number: formData.cpf.replace(/\D/g, '')
          }
        },
        metadata: {
          plan_name: planName,
          plan_type: planType,
          user_id: userId
        }
      };

      let result;

      if (paymentMethod === 'pix') {
        const { data, error } = await supabase.functions.invoke('create-pix-direct', {
          body: { ...basePayload, payment_method_id: 'pix' }
        });
        
        if (error) throw error;
        result = data;
        setPaymentData(result);
        
        if (result.id) {
          checkPaymentStatus(result.id);
        }
      } 
      else if (paymentMethod === 'card') {
        if (!formData.cardNumber || !formData.cardHolder || !formData.expiryMonth || !formData.expiryYear || !formData.cvv) {
          throw new Error('Preencha todos os dados do cartão');
        }
        
        const { data, error } = await supabase.functions.invoke('create-card-payment', {
          body: {
            ...basePayload,
            installments: installments
          }
        });
        
        if (error) throw error;
        result = data;
        
        if (result.init_point) {
          window.open(result.init_point, '_blank');
          toast.info('Complete o pagamento na janela que foi aberta');
          
          setTimeout(() => {
            if (result.id) checkPaymentStatus(result.id);
          }, 10000);
        }
      }
      else if (paymentMethod === 'boleto') {
        if (!formData.firstName || !formData.lastName) {
          throw new Error('Nome completo é obrigatório para boleto');
        }
        
        const { data, error } = await supabase.functions.invoke('create-boleto-payment', {
          body: { ...basePayload, payment_method_id: 'bolbradesco' }
        });
        
        if (error) throw error;
        result = data;
        setPaymentData(result);
        
        toast.success('Boleto gerado! Baixe o PDF para pagamento.');
      }

    } catch (err: any) {
      console.error('Erro:', err);
      toast.error(err.message || 'Erro ao processar pagamento');
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
        
        console.log('Status:', data?.status);
        
        if (data?.status === 'approved' || data?.approved) {
          clearInterval(interval);
          await handlePaymentSuccess(paymentId);
        } else if (data?.status === 'rejected' || data?.status === 'cancelled') {
          clearInterval(interval);
          toast.error('Pagamento não foi concluído');
          setPaymentData(null);
        }
        
        if (attempts >= maxAttempts) {
          clearInterval(interval);
        }
      } catch (error) {
        console.error('Erro ao verificar status:', error);
      }
    }, 5000);
  };

  const handlePaymentSuccess = async (paymentId: string) => {
    try {
      console.log('✅ Pagamento aprovado! Ativando assinatura...');
      
      const { data, error } = await supabase.functions.invoke('activate-subscription', {
        body: {
          user_id: userId,
          payment_id: paymentId,
          plan_name: planName,
          plan_type: planType,
          amount: amount
        }
      });

      if (error) {
        console.error('Erro ao ativar assinatura:', error);
      } else {
        console.log('✅ Assinatura ativada com sucesso:', data);
      }
      
      toast.success('🎉 Pagamento aprovado! Redirecionando para o dashboard...', {
        duration: 3000,
      });
      
      setTimeout(() => {
        navigate('/dashboard?payment=success');
      }, 2000);
      
    } catch (error) {
      console.error('Erro ao processar sucesso do pagamento:', error);
      toast.success('Pagamento aprovado! Redirecionando...');
      setTimeout(() => {
        navigate('/dashboard?payment=success');
      }, 2000);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Copiado!');
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="max-w-3xl mx-auto p-6 bg-card rounded-xl shadow-xl">
      <div className="mb-6 text-center">
        <h2 className="text-3xl font-bold mb-2">Finalizar Assinatura</h2>
        <div className="inline-block bg-gradient-to-r from-primary to-primary/80 text-primary-foreground px-6 py-3 rounded-lg">
          <p className="text-sm">Plano {planName}</p>
          <p className="text-2xl font-bold">
            R$ {amount.toFixed(2)}/{planType === 'monthly' ? 'mês' : 'ano'}
          </p>
        </div>
      </div>

      {!paymentData ? (
        <>
          <div className="mb-6">
            <Label className="block text-sm font-medium mb-3">
              Escolha a forma de pagamento
            </Label>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => setPaymentMethod('pix')}
                className={`p-4 rounded-xl border-2 transition-all transform hover:scale-105 ${
                  paymentMethod === 'pix'
                    ? 'border-primary bg-primary/10 shadow-lg'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="text-center">
                  <div className="text-3xl mb-2">📱</div>
                  <div className="font-bold">PIX</div>
                  <div className="text-xs text-muted-foreground mt-1">Instantâneo</div>
                </div>
              </button>

              <button
                onClick={() => setPaymentMethod('card')}
                className={`p-4 rounded-xl border-2 transition-all transform hover:scale-105 ${
                  paymentMethod === 'card'
                    ? 'border-primary bg-primary/10 shadow-lg'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="text-center">
                  <div className="text-3xl mb-2">💳</div>
                  <div className="font-bold">Cartão</div>
                  <div className="text-xs text-muted-foreground mt-1">Até 12x</div>
                </div>
              </button>

              <button
                onClick={() => setPaymentMethod('boleto')}
                className={`p-4 rounded-xl border-2 transition-all transform hover:scale-105 ${
                  paymentMethod === 'boleto'
                    ? 'border-primary bg-primary/10 shadow-lg'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="text-center">
                  <div className="text-3xl mb-2">📄</div>
                  <div className="font-bold">Boleto</div>
                  <div className="text-xs text-muted-foreground mt-1">3 dias</div>
                </div>
              </button>
            </div>
          </div>

          <div className="space-y-4 mb-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>E-mail *</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  placeholder="seu@email.com"
                />
              </div>
              <div>
                <Label>CPF *</Label>
                <Input
                  type="text"
                  value={formData.cpf}
                  onChange={(e) => setFormData({...formData, cpf: formatCPF(e.target.value)})}
                  placeholder="000.000.000-00"
                  maxLength={14}
                />
              </div>
            </div>

            {(paymentMethod === 'boleto' || paymentMethod === 'card') && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Nome *</Label>
                  <Input
                    value={formData.firstName}
                    onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                    placeholder="João"
                  />
                </div>
                <div>
                  <Label>Sobrenome *</Label>
                  <Input
                    value={formData.lastName}
                    onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                    placeholder="Silva"
                  />
                </div>
              </div>
            )}

            {paymentMethod === 'card' && (
              <>
                <div>
                  <Label>Número do Cartão *</Label>
                  <Input
                    value={formData.cardNumber}
                    onChange={(e) => setFormData({...formData, cardNumber: formatCardNumber(e.target.value)})}
                    placeholder="0000 0000 0000 0000"
                    maxLength={19}
                  />
                </div>

                <div>
                  <Label>Nome no Cartão *</Label>
                  <Input
                    value={formData.cardHolder}
                    onChange={(e) => setFormData({...formData, cardHolder: e.target.value.toUpperCase()})}
                    placeholder="JOÃO SILVA"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Mês *</Label>
                    <select
                      value={formData.expiryMonth}
                      onChange={(e) => setFormData({...formData, expiryMonth: e.target.value})}
                      className="w-full p-2 border rounded-lg bg-background"
                    >
                      <option value="">MM</option>
                      {Array.from({length: 12}, (_, i) => i + 1).map(month => (
                        <option key={month} value={month.toString().padStart(2, '0')}>
                          {month.toString().padStart(2, '0')}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <Label>Ano *</Label>
                    <select
                      value={formData.expiryYear}
                      onChange={(e) => setFormData({...formData, expiryYear: e.target.value})}
                      className="w-full p-2 border rounded-lg bg-background"
                    >
                      <option value="">AAAA</option>
                      {Array.from({length: 15}, (_, i) => new Date().getFullYear() + i).map(year => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <Label>CVV *</Label>
                    <Input
                      value={formData.cvv}
                      onChange={(e) => setFormData({...formData, cvv: e.target.value.replace(/\D/g, '')})}
                      placeholder="123"
                      maxLength={4}
                    />
                  </div>
                </div>

                <div>
                  <Label>Parcelamento</Label>
                  <select
                    value={installments}
                    onChange={(e) => setInstallments(Number(e.target.value))}
                    className="w-full p-2 border rounded-lg bg-background"
                  >
                    <option value={1}>À vista - R$ {amount.toFixed(2)}</option>
                    {Array.from({length: 11}, (_, i) => i + 2).map(num => (
                      <option key={num} value={num}>
                        {num}x de R$ {calculateInstallment(num).toFixed(2)} sem juros
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
          </div>

          <Button
            onClick={handlePayment}
            disabled={loading || !formData.email || !formData.cpf}
            className="w-full py-6 text-lg"
          >
            {loading ? 'Processando...' : 
              paymentMethod === 'pix' ? `Gerar PIX - R$ ${amount.toFixed(2)}` :
              paymentMethod === 'card' && installments > 1 ? 
                `Pagar ${installments}x de R$ {calculateInstallment(installments).toFixed(2)}` :
              `Pagar R$ ${amount.toFixed(2)}`
            }
          </Button>

          <div className="mt-6 flex items-center justify-center space-x-8 text-xs text-muted-foreground">
            <span>🔒 Pagamento seguro</span>
            <span>✅ Mercado Pago</span>
            <span>🛡️ Dados criptografados</span>
          </div>
        </>
      ) : (
        <div>
          {paymentMethod === 'pix' && paymentData.qr_code && (
            <div className="text-center">
              <h3 className="text-2xl font-bold mb-4">📱 Pague com PIX</h3>
              
              <div className="bg-white p-6 rounded-xl inline-block border-2 border-primary shadow-xl mb-6">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(paymentData.qr_code)}`}
                  alt="QR Code PIX"
                  className="w-64 h-64"
                />
              </div>

              <div className="mb-6">
                <p className="text-sm font-medium mb-2">PIX Copia e Cola:</p>
                <div className="flex items-center gap-2">
                  <Input
                    value={paymentData.qr_code}
                    readOnly
                    className="flex-1 text-xs font-mono"
                  />
                  <Button
                    onClick={() => copyToClipboard(paymentData.qr_code)}
                    variant={copied ? "default" : "outline"}
                  >
                    {copied ? '✓ Copiado!' : 'Copiar'}
                  </Button>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 dark:bg-yellow-900/20 dark:border-yellow-800">
                <p className="text-yellow-800 dark:text-yellow-200 font-medium">⏱️ Aguardando pagamento...</p>
                <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                  Após o pagamento, você será redirecionado automaticamente
                </p>
              </div>
            </div>
          )}

          {paymentMethod === 'boleto' && paymentData.barcode && (
            <div className="text-center">
              <h3 className="text-2xl font-bold mb-4">📄 Boleto Gerado!</h3>
              
              <div className="bg-orange-50 rounded-xl p-6 mb-6 dark:bg-orange-900/20">
                <p className="text-sm text-orange-800 dark:text-orange-200 mb-2">
                  Vencimento: {new Date(paymentData.due_date).toLocaleDateString('pt-BR')}
                </p>
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
                  <p className="font-mono text-xs break-all">{paymentData.barcode}</p>
                </div>
              </div>

              <div className="flex gap-3 justify-center">
                {paymentData.pdf_url && (
                  <Button asChild>
                    <a href={paymentData.pdf_url} target="_blank" rel="noopener noreferrer">
                      📄 Baixar PDF
                    </a>
                  </Button>
                )}
                <Button variant="outline" onClick={() => copyToClipboard(paymentData.barcode)}>
                  📋 Copiar código
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
