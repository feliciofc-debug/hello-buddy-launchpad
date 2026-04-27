import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

export default function PayAdmin() {
  const [stats, setStats] = useState<any>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('todos');
  const navigate = useNavigate();

  useEffect(() => {
    const token = sessionStorage.getItem('billing_token');
    if (!token) { navigate('/pay'); return; }
    load();
  }, []);

  function getHeaders() {
    const token = sessionStorage.getItem('billing_token');
    return token ? { 'x-billing-token': token } : {};
  }

  async function load() {
    setLoading(true);
    try {
      const headers = getHeaders();
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

  const logout = () => { sessionStorage.removeItem('billing_token'); navigate('/pay'); };

  const filtered = filter === 'todos' ? clients
    : filter === 'em_dia' ? clients.filter(c => c.situacao === 'em_dia')
    : filter === 'inadimplente' ? clients.filter(c => c.inadimplente)
    : filter === 'pendente' ? clients.filter(c => c.situacao === 'pendente_pagamento')
    : filter === 'suspenso' ? clients.filter(c => c.situacao === 'cancelado' || c.inadimplente)
    : clients;

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
        <h1 className="text-lg font-semibold">AMZOfertas — Painel de Cobrança</h1>
        <nav className="flex gap-4 text-sm items-center">
          <button onClick={() => navigate('/pay/admin')} className="text-sky-400 hover:underline">Dashboard</button>
          <button onClick={() => navigate('/pay/admin/novo')} className="text-sky-400 hover:underline">Novo cliente</button>
          <button onClick={() => navigate('/pay')} className="text-sky-400 hover:underline">iPad PIX</button>
          <button onClick={logout} className="text-red-400 hover:underline">Sair</button>
        </nav>
      </header>

      <div className="max-w-[1200px] mx-auto p-6">
        {/* Dashboard Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-7 gap-4 mb-6">
            <Card label="Total empresas" value={stats.total_empresas} />
            <Card label="Em dia" value={stats.em_dia} color="text-green-400" onClick={() => setFilter('em_dia')} />
            <Card label="Inadimplentes" value={stats.inadimplentes} color="text-red-500" onClick={() => setFilter('inadimplente')} />
            <Card label="Aguardando pgto" value={stats.pendente_primeiro_pagamento} color="text-amber-400" onClick={() => setFilter('pendente')} />
            <Card label="Suspensos" value={(stats.inadimplentes || 0) + (stats.cancelados || 0)} color="text-orange-400" onClick={() => setFilter('suspenso')} />
            <Card label="MRR estimado" value={`R$ ${(stats.mrr_estimado_reais || 0).toLocaleString('pt-BR')}`} color="text-sky-400" />
            <Card label="ARR estimado" value={`R$ ${(stats.arr_estimado_reais ?? (stats.mrr_estimado_reais || 0) * 12).toLocaleString('pt-BR')}`} color="text-emerald-400" tooltip="Receita anual recorrente projetada com clientes atuais (MRR × 12)" />
          </div>
        )}

        {/* Filter tabs */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {[
            { key: 'todos', label: 'Todos' },
            { key: 'em_dia', label: '✅ Em dia' },
            { key: 'inadimplente', label: '🔴 Inadimplentes' },
            { key: 'pendente', label: '⏳ Aguardando' },
            { key: 'suspenso', label: '🚫 Suspensos' },
          ].map(t => (
            <button key={t.key} onClick={() => setFilter(t.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${filter === t.key ? 'bg-sky-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>
              {t.label} ({t.key === 'todos' ? clients.length
                : t.key === 'em_dia' ? clients.filter(c => c.situacao === 'em_dia').length
                : t.key === 'inadimplente' ? clients.filter(c => c.inadimplente).length
                : t.key === 'pendente' ? clients.filter(c => c.situacao === 'pendente_pagamento').length
                : clients.filter(c => c.situacao === 'cancelado' || c.inadimplente).length})
            </button>
          ))}
        </div>

        {/* Extrato */}
        <h2 className="text-sm text-slate-400 uppercase mb-3 font-semibold">
          Extrato de clientes — {filtered.length} resultado(s)
        </h2>
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 text-xs uppercase">
                <th className="p-3 text-left">Situação</th>
                <th className="p-3 text-left">Razão social</th>
                <th className="p-3 text-left">CNPJ/CPF</th>
                <th className="p-3 text-left">Responsável</th>
                <th className="p-3 text-left">E-mail</th>
                <th className="p-3 text-left">Próx. vencimento</th>
                <th className="p-3 text-left">Últ. pagamento</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className={`border-t border-slate-700 hover:bg-slate-750 ${c.inadimplente ? 'bg-red-900/10' : ''}`}>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${badgeClass(c.situacao)}`}>
                      {c.situacao_label}
                    </span>
                  </td>
                  <td className="p-3 font-medium">{c.razao_social}</td>
                  <td className="p-3 font-mono text-xs">{c.cnpj || '—'}</td>
                  <td className="p-3">{c.responsible_name || '—'}</td>
                  <td className="p-3">{c.email}</td>
                  <td className="p-3">{c.next_billing_date ? new Date(c.next_billing_date).toLocaleDateString('pt-BR') : '—'}</td>
                  <td className="p-3">{c.last_payment_date ? new Date(c.last_payment_date).toLocaleDateString('pt-BR') : '—'}</td>
                  <td className="p-3">
                    <button onClick={() => navigate(`/pay/admin/cliente/${c.id}`)}
                      className="text-sky-400 hover:underline text-xs font-semibold">Ver</button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="p-6 text-center text-slate-500">Nenhum cliente nesta categoria</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Card({ label, value, color, onClick }: { label: string; value: any; color?: string; onClick?: () => void }) {
  return (
    <div onClick={onClick}
      className={`bg-slate-800 rounded-xl p-4 border border-slate-700 ${onClick ? 'cursor-pointer hover:border-sky-500 transition-colors' : ''}`}>
      <div className="text-xs text-slate-400 uppercase tracking-wide">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${color || ''}`}>{value}</div>
    </div>
  );
}
