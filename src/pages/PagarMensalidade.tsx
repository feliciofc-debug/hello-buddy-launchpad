import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Loader2, Copy, Check, Pencil } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import PaymentFormDirectPublico from '@/components/PaymentFormDirectPublico';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface SubInfo {
  amount: number;
  next_billing_date: string | null;
  customer_name: string | null;
  customer_email: string | null;
}

const PagarMensalidade = () => {
  const { subscriptionId } = useParams<{ subscriptionId: string }>();
  const [searchParams] = useSearchParams();
  const editMode = searchParams.get('editar') === '1';

  const [info, setInfo] = useState<SubInfo | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [novoValor, setNovoValor] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!subscriptionId) return;

      // Verifica se é admin (só relevante no modo editor)
      if (editMode) {
        const { data: auth } = await supabase.auth.getUser();
        if (auth?.user) {
          const { data: roles } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', auth.user.id)
            .eq('role', 'admin')
            .maybeSingle();
          setIsAdmin(!!roles);
        }
      }

      const { data, error } = await supabase.rpc('get_billing_pagamento_publico', {
        p_subscription_id: subscriptionId,
      });

      if (error || !data || (Array.isArray(data) && data.length === 0)) {
        setLoadingInfo(false);
        return;
      }

      const row: any = Array.isArray(data) ? data[0] : data;
      const amt = Number(row.amount ?? 597);
      setInfo({
        amount: amt,
        next_billing_date: row.next_billing_date,
        customer_name: row.customer_name ?? null,
        customer_email: row.customer_email ?? null,
      });
      setNovoValor(amt.toFixed(2).replace('.', ','));
      setLoadingInfo(false);
    };
    load();
  }, [subscriptionId, editMode]);

  const handleSalvarValor = async () => {
    if (!subscriptionId) return;
    const parsed = parseFloat(novoValor.replace(/\./g, '').replace(',', '.'));
    if (!parsed || parsed <= 0) {
      toast.error('Valor inválido');
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.rpc('update_billing_subscription_amount', {
        p_subscription_id: subscriptionId,
        p_amount: parsed,
      });
      if (error) throw error;
      if (!data) throw new Error('Cobrança não encontrada');
      setInfo((prev) => (prev ? { ...prev, amount: parsed } : prev));
      toast.success(`Valor atualizado para R$ ${parsed.toFixed(2).replace('.', ',')}`);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao salvar valor');
    } finally {
      setSaving(false);
    }
  };

  const handleCopiarLink = async () => {
    const link = `${window.location.origin}/pagar/${subscriptionId}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success('Link copiado! Envie para o cliente.');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error('Não foi possível copiar');
    }
  };

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
      {editMode && (
        <div className="max-w-2xl mx-auto mb-6 bg-white border-2 border-[#1a2332] rounded-2xl shadow-xl p-6">
          <div className="flex items-center gap-2 mb-3">
            <Pencil className="w-5 h-5 text-[#1a2332]" />
            <h2 className="text-lg font-bold text-[#1a2332]">Modo editor — ajuste o valor antes de enviar</h2>
          </div>

          {!isAdmin ? (
            <p className="text-sm text-red-600">
              Você precisa estar logado como <strong>admin</strong> para alterar o valor desta cobrança.
            </p>
          ) : (
            <>
              <div className="grid sm:grid-cols-[1fr_auto_auto] gap-3 items-end">
                <div>
                  <Label className="text-sm text-gray-700">Novo valor (R$)</Label>
                  <Input
                    inputMode="decimal"
                    value={novoValor}
                    onChange={(e) => setNovoValor(e.target.value.replace(/[^\d,.]/g, ''))}
                    placeholder="Ex: 1500,00"
                    className="mt-1"
                  />
                </div>
                <Button
                  onClick={handleSalvarValor}
                  disabled={saving}
                  className="bg-[#1a2332] hover:bg-[#0f1620] text-white"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar valor'}
                </Button>
                <Button
                  onClick={handleCopiarLink}
                  variant="outline"
                  className="border-[#1a2332] text-[#1a2332]"
                >
                  {copied ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                  Copiar link
                </Button>
              </div>
              <p className="text-xs text-gray-500 mt-3">
                Valor atual salvo: <strong>R$ {info.amount.toFixed(2).replace('.', ',')}</strong>. Após salvar,
                copie o link limpo (<code>/pagar/{subscriptionId}</code>) e envie ao cliente.
              </p>
            </>
          )}
        </div>
      )}

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
