import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

export default function PayAdminCliente() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [linkLoading, setLinkLoading] = useState(false);
  const [payLink, setPayLink] = useState('');

  useEffect(() => { if (id) load(); }, [id]);

  async function load() {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: any = {};
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;

      const { data: res } = await supabase.functions.invoke('billing-dashboard-api', {
        method: 'GET',
        headers: { ...headers, 'x-route': `/clients/${id}` },
        body: null,
      });
      setData(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function generateLink() {
    setLinkLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: any = {};
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;

      const { data: res } = await supabase.functions.invoke('billing-dashboard-api', {
        method: 'POST',
        headers: { ...headers, 'x-route': `/clients/${id}/checkout-link` },
        body: {},
      });
      if (res?.init_point) setPayLink(res.init_point);
    } catch (e) {
      console.error(e);
    } finally {
      setLinkLoading(false);
    }
  }

  if (loading) return <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">Carregando...</div>;
  if (!data?.customer) return <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">Cliente não encontrado</div>;

  const c = data.customer;
  const sit = data.situacao;

  const badgeClass = sit.key === 'em_dia' ? 'bg-green-900 text-green-300'
    : sit.key === 'inadimplente' ? 'bg-red-600 text-white'
    : sit.key === 'pendente_pagamento' ? 'bg-amber-900 text-amber-300'
    : 'bg-slate-600 text-slate-300';

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <header className="flex items-center justify-between px-6 py-4 bg-slate-800 border-b border-slate-700">
        <h1 className="text-lg font-semibold">{c.name || 'Cliente'}</h1>
        <nav className="flex gap-4 text-sm">
          <button onClick={() => navigate('/pay/admin')} className="text-sky-400 hover:underline">Extrato</button>
          <button onClick={() => navigate('/pay/admin/novo')} className="text-sky-400 hover:underline">Novo cliente</button>
        </nav>
      </header>

      <div className="max-w-[900px] mx-auto p-6">
        <button onClick={() => navigate('/pay/admin')} className="text-sky-400 text-sm mb-4">← Voltar ao extrato</button>

        <div className="flex items-center gap-3 mb-4">
          <span className={`px-3 py-1 rounded text-sm font-semibold ${badgeClass}`}>{sit.label}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-800 rounded-xl p-5 border border-slate-700 mb-6">
          <Info label="Razão social" value={c.name} />
          <Info label="Nome fantasia" value={c.trade_name} />
          <Info label="CNPJ" value={c.cnpj} />
          <Info label="E-mail" value={c.email} />
          <Info label="Telefone" value={c.phone} />
          <Info label="Login plataforma" value={c.platform_login} />
          <Info label="Responsável" value={c.responsible_name} />
          <Info label="CPF responsável" value={c.responsible_cpf} />
        </div>

        <div className="flex items-center gap-4 mb-6">
          <button onClick={generateLink} disabled={linkLoading}
            className="px-4 py-2 bg-sky-600 hover:bg-sky-700 rounded-lg text-sm font-semibold disabled:opacity-50">
            {linkLoading ? 'Gerando...' : 'Gerar link de pagamento'}
          </button>
          {payLink && (
            <a href={payLink} target="_blank" rel="noopener noreferrer" className="text-sky-400 text-sm break-all">
              {payLink}
            </a>
          )}
        </div>

        <h2 className="text-sm text-slate-400 uppercase font-semibold mb-2">Histórico de pagamentos</h2>
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-x-auto mb-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 text-xs uppercase">
                <th className="p-3 text-left">Data</th>
                <th className="p-3 text-left">Valor (R$)</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left">ID Mercado Pago</th>
              </tr>
            </thead>
            <tbody>
              {(data.transactions || []).map((tx: any) => (
                <tr key={tx.id} className="border-t border-slate-700">
                  <td className="p-3">{tx.payment_date ? new Date(tx.payment_date).toLocaleDateString('pt-BR') : '—'}</td>
                  <td className="p-3">{tx.amount ? Number(tx.amount).toFixed(2).replace('.', ',') : '—'}</td>
                  <td className="p-3">{tx.status || '—'}</td>
                  <td className="p-3 font-mono text-xs">{tx.mp_payment_id || '—'}</td>
                </tr>
              ))}
              {(!data.transactions?.length) && (
                <tr><td colSpan={4} className="p-4 text-center text-slate-500">Nenhum pagamento registrado</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <h2 className="text-sm text-slate-400 uppercase font-semibold mb-2">Assinaturas</h2>
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 text-xs uppercase">
                <th className="p-3 text-left">Criada em</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left">Próx. vencimento</th>
                <th className="p-3 text-left">Último pagamento</th>
              </tr>
            </thead>
            <tbody>
              {(data.subscriptions || []).map((s: any) => (
                <tr key={s.id} className="border-t border-slate-700">
                  <td className="p-3">{new Date(s.created_at).toLocaleDateString('pt-BR')}</td>
                  <td className="p-3">{s.status}</td>
                  <td className="p-3">{s.next_billing_date || '—'}</td>
                  <td className="p-3">{s.last_payment_date ? new Date(s.last_payment_date).toLocaleDateString('pt-BR') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <span className="text-xs text-slate-400">{label}</span>
      <p className="text-sm">{value || '—'}</p>
    </div>
  );
}
