import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { formatDateBR } from '@/lib/dateBR';

export default function PayAdminCliente() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [linkLoading, setLinkLoading] = useState(false);
  const [payLink, setPayLink] = useState('');

  useEffect(() => {
    if (!sessionStorage.getItem('billing_token')) { navigate('/pay'); return; }
    if (id) load();
  }, [id]);

  function getHeaders() {
    const token = sessionStorage.getItem('billing_token');
    return token ? { 'x-billing-token': token } : {};
  }

  async function load() {
    setLoading(true);
    try {
      const { data: res } = await supabase.functions.invoke('billing-dashboard-api', {
        method: 'GET',
        headers: { ...getHeaders(), 'x-route': `/clients/${id}` },
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
      const { data: res } = await supabase.functions.invoke('billing-dashboard-api', {
        method: 'POST',
        headers: { ...getHeaders(), 'x-route': `/clients/${id}/checkout-link` },
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
  const addr = c.billing_address || {};

  const badgeClass = sit.key === 'em_dia' ? 'bg-green-900 text-green-300'
    : sit.key === 'inadimplente' ? 'bg-red-600 text-white'
    : sit.key === 'pendente_pagamento' ? 'bg-amber-900 text-amber-300'
    : 'bg-slate-600 text-slate-300';

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <header className="flex items-center justify-between px-6 py-4 bg-slate-800 border-b border-slate-700">
        <h1 className="text-lg font-semibold">{c.name || 'Cliente'}</h1>
        <nav className="flex gap-4 text-sm">
          <button onClick={() => navigate('/pay/admin')} className="text-sky-400 hover:underline">Dashboard</button>
          <button onClick={() => navigate('/pay/admin/novo')} className="text-sky-400 hover:underline">Novo cliente</button>
        </nav>
      </header>

      <div className="max-w-[900px] mx-auto p-6">
        <button onClick={() => navigate('/pay/admin')} className="text-sky-400 text-sm mb-4">← Voltar ao dashboard</button>

        <div className="flex items-center gap-3 mb-4">
          <span className={`px-3 py-1 rounded text-sm font-semibold ${badgeClass}`}>{sit.label}</span>
          <span className="text-xs text-slate-400">{c.tipo_pessoa === 'pj' ? 'Pessoa Jurídica' : 'Pessoa Física'}</span>
        </div>

        {/* Dados do cliente */}
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 mb-6">
          <h2 className="text-sm text-slate-400 uppercase font-semibold mb-3">Dados cadastrais</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Info label="Razão social / Nome" value={c.name} />
            <Info label="Nome fantasia" value={c.trade_name} />
            <Info label={c.tipo_pessoa === 'pj' ? 'CNPJ' : 'CPF'} value={c.cnpj || c.cpf} />
            <Info label="E-mail" value={c.email} />
            <Info label="Telefone" value={c.phone} />
            <Info label="Login plataforma" value={c.platform_login} />
            <Info label="Responsável" value={c.responsible_name} />
            <Info label="CPF responsável" value={c.responsible_cpf} />
            <Info label="Regime tributário" value={c.regime_tributario} />
            <Info label="Inscrição Estadual" value={c.inscricao_estadual} />
            <Info label="Inscrição Municipal" value={c.inscricao_municipal} />
          </div>
          {(addr.logradouro || addr.cidade) && (
            <div className="mt-4 pt-4 border-t border-slate-700">
              <h3 className="text-xs text-slate-400 uppercase font-semibold mb-2">Endereço de faturamento</h3>
              <p className="text-sm">
                {[addr.logradouro, addr.numero, addr.complemento].filter(Boolean).join(', ')}
                {addr.bairro && ` — ${addr.bairro}`}
                {addr.cidade && `, ${addr.cidade}`}
                {addr.uf && ` - ${addr.uf}`}
                {addr.cep && ` | CEP: ${addr.cep}`}
              </p>
            </div>
          )}
        </div>

        {/* Ações */}
        <div className="flex items-center gap-4 mb-6">
          <button onClick={generateLink} disabled={linkLoading}
            className="px-4 py-2 bg-sky-600 hover:bg-sky-700 rounded-lg text-sm font-semibold disabled:opacity-50">
            {linkLoading ? 'Gerando...' : '🔗 Gerar link de pagamento'}
          </button>
          {payLink && (
            <div className="flex-1">
              <a href={payLink} target="_blank" rel="noopener noreferrer" className="text-sky-400 text-sm break-all hover:underline">
                {payLink}
              </a>
              <button onClick={() => { navigator.clipboard.writeText(payLink); }}
                className="ml-2 text-xs text-slate-400 hover:text-white">📋 Copiar</button>
            </div>
          )}
        </div>

        {/* Histórico de pagamentos */}
        <h2 className="text-sm text-slate-400 uppercase font-semibold mb-2">Histórico de pagamentos</h2>
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-x-auto mb-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 text-xs uppercase">
                <th className="p-3 text-left">Data</th>
                <th className="p-3 text-left">Valor (R$)</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left">ID MP</th>
              </tr>
            </thead>
            <tbody>
              {(data.transactions || []).map((tx: any) => (
                <tr key={tx.id} className={`border-t border-slate-700 ${tx.status === 'approved' ? '' : 'opacity-60'}`}>
                  <td className="p-3">{tx.payment_date ? formatDateBR(tx.payment_date) : '—'}</td>
                  <td className="p-3">{tx.amount ? Number(tx.amount).toFixed(2).replace('.', ',') : '—'}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${tx.status === 'approved' ? 'bg-green-900 text-green-300' : 'bg-slate-600 text-slate-300'}`}>
                      {tx.status || '—'}
                    </span>
                  </td>
                  <td className="p-3 font-mono text-xs">{tx.mp_payment_id || '—'}</td>
                </tr>
              ))}
              {(!data.transactions?.length) && (
                <tr><td colSpan={4} className="p-4 text-center text-slate-500">Nenhum pagamento registrado</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Assinaturas */}
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
                  <td className="p-3">{formatDateBR(s.created_at)}</td>
                  <td className="p-3">{s.status}</td>
                  <td className="p-3">{formatDateBR(s.next_billing_date)}</td>
                  <td className="p-3">{formatDateBR(s.last_payment_date)}</td>
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
