import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

export default function PayAdmin() {
  const [stats, setStats] = useState<any>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => { load(); }, []);

  async function getAdminHeaders() {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token
      ? { Authorization: `Bearer ${session.access_token}` }
      : {};
  }

  async function load() {
    setLoading(true);
    try {
      const headers = await getAdminHeaders();
      const [statsRes, clientsRes] = await Promise.all([
        supabase.functions.invoke('billing-dashboard-api', {
          method: 'GET',
          headers: { ...headers, 'x-route': '/stats' },
          body: null,
        }),
        supabase.functions.invoke('billing-dashboard-api', {
          method: 'GET',
          headers: { ...headers, 'x-route': '/clients' },
          body: null,
        }),
      ]);
      if (statsRes.data) setStats(statsRes.data);
      if (clientsRes.data?.clients) setClients(clientsRes.data.clients);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const badgeClass = (key: string) => {
    if (key === 'em_dia') return 'bg-green-900 text-green-300';
    if (key === 'inadimplente') return 'bg-red-600 text-white';
    if (key === 'pendente_pagamento') return 'bg-amber-900 text-amber-300';
    if (key === 'cancelado') return 'bg-slate-600 text-slate-300';
    return 'bg-slate-700 text-slate-300';
  };

  if (loading) return <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">Carregando...</div>;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <header className="flex items-center justify-between px-6 py-4 bg-slate-800 border-b border-slate-700">
        <h1 className="text-lg font-semibold">AMZOfertas — cobrança</h1>
        <nav className="flex gap-4 text-sm">
          <button onClick={() => navigate('/pay/admin')} className="text-sky-400 hover:underline">Extrato</button>
          <button onClick={() => navigate('/pay/admin/novo')} className="text-sky-400 hover:underline">Novo cliente (PJ)</button>
          <button onClick={() => navigate('/pay')} className="text-sky-400 hover:underline">iPad PIX</button>
        </nav>
      </header>

      <div className="max-w-[1200px] mx-auto p-6">
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <Card label="Empresas" value={stats.total_empresas} />
            <Card label="Em dia" value={stats.em_dia} color="text-green-400" />
            <Card label="Inadimplentes" value={stats.inadimplentes} color="text-red-500" />
            <Card label="Aguardando 1º pgto" value={stats.pendente_primeiro_pagamento} />
            <Card label="MRR estimado" value={`R$ ${(stats.mrr_estimado_reais || 0).toLocaleString('pt-BR')}`} color="text-sky-400" />
          </div>
        )}

        <h2 className="text-sm text-slate-400 uppercase mb-3 font-semibold">Extrato de clientes</h2>
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 text-xs uppercase">
                <th className="p-3 text-left">Situação</th>
                <th className="p-3 text-left">Razão social</th>
                <th className="p-3 text-left">CNPJ</th>
                <th className="p-3 text-left">Responsável</th>
                <th className="p-3 text-left">E-mail</th>
                <th className="p-3 text-left">Próx. vencimento</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id} className={`border-t border-slate-700 ${c.inadimplente ? 'bg-red-900/10' : ''}`}>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${badgeClass(c.situacao)}`}>
                      {c.situacao_label}
                    </span>
                  </td>
                  <td className="p-3">{c.razao_social}</td>
                  <td className="p-3 font-mono text-xs">{c.cnpj || '—'}</td>
                  <td className="p-3">{c.responsible_name || '—'}</td>
                  <td className="p-3">{c.email}</td>
                  <td className="p-3">{c.next_billing_date || '—'}</td>
                  <td className="p-3">
                    <button onClick={() => navigate(`/pay/admin/cliente/${c.id}`)}
                      className="text-sky-400 hover:underline text-xs">Ver</button>
                  </td>
                </tr>
              ))}
              {clients.length === 0 && (
                <tr><td colSpan={7} className="p-6 text-center text-slate-500">Nenhum cliente cadastrado</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Card({ label, value, color }: { label: string; value: any; color?: string }) {
  return (
    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
      <div className="text-xs text-slate-400 uppercase tracking-wide">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${color || ''}`}>{value}</div>
    </div>
  );
}
