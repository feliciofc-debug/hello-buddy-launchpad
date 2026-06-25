import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { CheckCircle2 } from 'lucide-react';

interface PaymentFormDirectPublicoProps {
  subscriptionId: string;
  amount: number;
  customerName?: string | null;
  customerEmail?: string | null;
}

/**
 * Versão pública do PaymentFormDirect, usada na rota anônima /pagar/:subscription_id.
 *
 * Diferenças do PaymentFormDirect.tsx (que continua intacto):
 * - Não chama supabase.auth.getUser() / não depende de usuário logado
 * - Usa edge functions billing-create-{pix,card,boleto}-publico
 *   (que validam subscription_id e leem o amount do banco via service_role)
 * - external_reference no MP = subscription_id (consumido pelo billing-webhook existente)
 * - NÃO chama activate-subscription nem atualiza tabelas pelo cliente
 * - Polling em get_billing_subscription_status até detectar status='active'
 * - Tela de sucesso fica na própria rota: "✅ Pagamento confirmado!"
 */
export default function PaymentFormDirectPublico({
  subscriptionId,
  amount,
  customerName,
  customerEmail,
}: PaymentFormDirectPublicoProps) {
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'card' | 'boleto'>('pix');
  const [loading, setLoading] = useState(false);
  const [paymentData, setPaymentData] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [installments, setInstallments] = useState(1);
  const [documentType, setDocumentType] = useState<'cpf' | 'cnpj'>('cpf');
  const [confirmed, setConfirmed] = useState(false);
  const pollRef = useRef<number | null>(null);
  const initialPaymentDateRef = useRef<string | null>(null);

  const [formData, setFormData] = useState({
    email: '',
    cpf: '',
    cnpj: '',
    companyName: '',
    firstName: '',
    lastName: '',
  });

  // Inicializa com o último pagamento conhecido para detectar somente novos
  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc('get_billing_subscription_status', {
        p_subscription_id: subscriptionId,
      });
      const row: any = Array.isArray(data) ? data[0] : data;
      initialPaymentDateRef.current = row?.last_payment_date ?? null;
    })();
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [subscriptionId]);

  const valorIntegral = amount;

  const formatCPF = (v: string) => v.replace(/\D/g, '')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})/, '$1-$2')
    .replace(/(-\d{2})\d+?$/, '$1');

  const formatCNPJ = (v: string) => v.replace(/\D/g, '')
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})/, '$1-$2')
    .replace(/(-\d{2})\d+?$/, '$1');

  const validateEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  const validateDocument = () => documentType === 'cpf'
    ? formData.cpf.replace(/\D/g, '').length === 11
    : formData.cnpj.replace(/\D/g, '').length === 14;

  const calculateInstallment = (n: number) => valorIntegral / n;

  const startPolling = () => {
    if (pollRef.current) window.clearInterval(pollRef.current);
    let attempts = 0;
    const maxAttempts = 120; // 10 minutos a cada 5s
    pollRef.current = window.setInterval(async () => {
      attempts++;
      try {
        const { data } = await supabase.rpc('get_billing_subscription_status', {
          p_subscription_id: subscriptionId,
        });
        const row: any = Array.isArray(data) ? data[0] : data;
        const isActive = row?.status === 'active';
        const newPayment = row?.last_payment_date && row.last_payment_date !== initialPaymentDateRef.current;
        if (isActive && newPayment) {
          if (pollRef.current) window.clearInterval(pollRef.current);
          setConfirmed(true);
        }
      } catch (e) {
        console.error('poll erro:', e);
      }
      if (attempts >= maxAttempts && pollRef.current) {
        window.clearInterval(pollRef.current);
      }
    }, 5000);
  };

  const handlePayment = async () => {
    try {
      setLoading(true);
      if (!validateEmail(formData.email)) throw new Error('Email inválido');
      if (!validateDocument()) {
        throw new Error(documentType === 'cpf'
          ? 'CPF inválido - deve ter 11 dígitos'
          : 'CNPJ inválido - deve ter 14 dígitos');
      }

      const docNum = documentType === 'cpf'
        ? formData.cpf.replace(/\D/g, '')
        : formData.cnpj.replace(/\D/g, '');

      const basePayload = {
        subscription_id: subscriptionId,
        email: formData.email,
        document_type: documentType,
        document_number: docNum,
        first_name: formData.firstName || (documentType === 'cnpj' ? formData.companyName : 'Cliente'),
        last_name: formData.lastName || 'AMZ Ofertas',
        company_name: documentType === 'cnpj' ? formData.companyName : null,
      };

      if (paymentMethod === 'pix') {
        const { data, error } = await supabase.functions.invoke('billing-create-pix-publico', {
          body: basePayload,
        });
        if (error) throw error;
        if ((data as any)?.error) throw new Error((data as any).message || 'Erro ao gerar PIX');
        setPaymentData(data);
        startPolling();
      } else if (paymentMethod === 'card') {
        const { data, error } = await supabase.functions.invoke('billing-create-card-publico', {
          body: { ...basePayload, installments },
        });
        if (error) throw error;
        if ((data as any)?.error) throw new Error((data as any).message || 'Erro ao processar cartão');
        if ((data as any)?.init_point) {
          window.open((data as any).init_point, '_blank');
          toast.info('Complete o pagamento na janela que foi aberta');
          startPolling();
        }
      } else if (paymentMethod === 'boleto') {
        if (!formData.firstName || !formData.lastName) {
          throw new Error('Nome completo é obrigatório para boleto');
        }
        const { data, error } = await supabase.functions.invoke('billing-create-boleto-publico', {
          body: basePayload,
        });
        if (error) throw error;
        if ((data as any)?.error) throw new Error((data as any).message || 'Erro ao gerar boleto');
        setPaymentData(data);
        toast.success('Boleto gerado! Baixe o PDF para pagamento.');
        startPolling();
      }
    } catch (err: any) {
      console.error('Erro:', err);
      toast.error(err?.message || 'Erro ao processar pagamento');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Copiado!');
    setTimeout(() => setCopied(false), 3000);
  };

  if (confirmed) {
    return (
      <div className="max-w-3xl mx-auto p-8 bg-card rounded-xl shadow-xl text-center">
        <div className="flex flex-col items-center gap-4">
          <CheckCircle2 className="w-20 h-20 text-green-500" />
          <h2 className="text-3xl font-bold text-[#1a2332]">Pagamento confirmado!</h2>
          <p className="text-lg text-muted-foreground">
            Sua assinatura foi reativada com sucesso.
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Você já pode voltar a usar a plataforma normalmente. Obrigado!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 bg-card rounded-xl shadow-xl">
      <div className="mb-6 text-center">
        <h2 className="text-3xl font-bold mb-4">Finalizar Assinatura</h2>

        <div className="mb-6 p-6 rounded-xl border-2 border-primary bg-primary/5">
          <p className="text-sm text-muted-foreground mb-1">AMZ Ofertas PRO</p>
          {customerName && (
            <p className="text-xs text-muted-foreground mb-2">Cliente: {customerName}</p>
          )}
          <p className="text-5xl font-bold text-primary">
            R$ {valorIntegral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-sm text-muted-foreground mt-1">/mês</p>
        </div>

        <div className="text-sm text-muted-foreground mb-2">
          <p>💳 Cartão: até 12x</p>
          <p>📱 PIX: aprovação imediata</p>
          <p>📄 Boleto: vencimento em 3 dias</p>
        </div>
      </div>

      {!paymentData ? (
        <>
          <div className="mb-6">
            <Label className="block text-sm font-medium mb-3">Escolha a forma de pagamento</Label>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => setPaymentMethod('pix')}
                className={`p-4 rounded-xl border-2 transition-all transform hover:scale-105 ${
                  paymentMethod === 'pix' ? 'border-primary bg-primary/10 shadow-lg' : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="text-center">
                  <div className="text-3xl mb-2">📱</div>
                  <div className="font-bold">PIX</div>
                </div>
              </button>
              <button
                onClick={() => setPaymentMethod('card')}
                className={`p-4 rounded-xl border-2 transition-all transform hover:scale-105 ${
                  paymentMethod === 'card' ? 'border-primary bg-primary/10 shadow-lg' : 'border-border hover:border-primary/50'
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
                  paymentMethod === 'boleto' ? 'border-primary bg-primary/10 shadow-lg' : 'border-border hover:border-primary/50'
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
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setDocumentType('cpf')}
                className={`flex-1 p-3 rounded-lg border-2 transition-all ${
                  documentType === 'cpf' ? 'border-primary bg-primary/10 font-bold' : 'border-border hover:border-primary/50'
                }`}
              >
                Pessoa Física (CPF)
              </button>
              <button
                onClick={() => setDocumentType('cnpj')}
                className={`flex-1 p-3 rounded-lg border-2 transition-all ${
                  documentType === 'cnpj' ? 'border-primary bg-primary/10 font-bold' : 'border-border hover:border-primary/50'
                }`}
              >
                Pessoa Jurídica (CNPJ)
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>E-mail *</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="seu@email.com"
                />
              </div>
              <div>
                <Label>{documentType === 'cpf' ? 'CPF' : 'CNPJ'} *</Label>
                {documentType === 'cpf' ? (
                  <Input
                    value={formData.cpf}
                    onChange={(e) => setFormData({ ...formData, cpf: formatCPF(e.target.value) })}
                    placeholder="000.000.000-00"
                    maxLength={14}
                  />
                ) : (
                  <Input
                    value={formData.cnpj}
                    onChange={(e) => setFormData({ ...formData, cnpj: formatCNPJ(e.target.value) })}
                    placeholder="00.000.000/0000-00"
                    maxLength={18}
                  />
                )}
              </div>
            </div>

            {documentType === 'cnpj' && (
              <div>
                <Label>Nome da Empresa *</Label>
                <Input
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  placeholder="Razão Social da Empresa"
                />
              </div>
            )}

            {(paymentMethod === 'boleto' || paymentMethod === 'card') && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Nome *</Label>
                  <Input
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    placeholder="João"
                  />
                </div>
                <div>
                  <Label>Sobrenome *</Label>
                  <Input
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    placeholder="Silva"
                  />
                </div>
              </div>
            )}

            {paymentMethod === 'card' && (
              <div>
                <Label>Parcelamento</Label>
                <div className="w-full p-3 border rounded-lg bg-muted/40 text-sm font-medium">
                  1x de R$ {calculateInstallment(1).toFixed(2)} (à vista)
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Pagamento somente à vista. Você será redirecionado para o checkout seguro do Mercado Pago para inserir os dados do cartão.
                </p>
              </div>
            )}
          </div>

          <Button
            onClick={handlePayment}
            disabled={
              loading ||
              !formData.email ||
              (documentType === 'cpf' ? !formData.cpf : !formData.cnpj) ||
              (documentType === 'cnpj' && !formData.companyName)
            }
            className="w-full py-6 text-lg"
          >
            {loading ? 'Processando...' :
              paymentMethod === 'pix'
                ? `Gerar PIX - R$ ${valorIntegral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                : paymentMethod === 'card'
                  ? `Pagar ${installments}x de R$ ${calculateInstallment(installments).toFixed(2)}`
                  : `Gerar Boleto - R$ ${valorIntegral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
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
                  <Input value={paymentData.qr_code} readOnly className="flex-1 text-xs font-mono" />
                  <Button onClick={() => copyToClipboard(paymentData.qr_code)} variant={copied ? 'default' : 'outline'}>
                    {copied ? '✓ Copiado!' : 'Copiar'}
                  </Button>
                </div>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 dark:bg-yellow-900/20 dark:border-yellow-800">
                <p className="text-yellow-800 dark:text-yellow-200 font-medium">⏱️ Aguardando pagamento...</p>
                <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                  Após o pagamento, esta página será atualizada automaticamente.
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
                    <a href={paymentData.pdf_url} target="_blank" rel="noopener noreferrer">📄 Baixar PDF</a>
                  </Button>
                )}
                <Button variant="outline" onClick={() => copyToClipboard(paymentData.barcode)}>
                  📋 Copiar código
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-6">
                Após a compensação do boleto (1-3 dias úteis), esta página será atualizada automaticamente.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
