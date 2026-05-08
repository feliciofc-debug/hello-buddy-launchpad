import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { formatDateBR } from '@/lib/dateBR';
import TestarPietroCobrancaModal from '@/components/TestarPietroCobrancaModal';

type Tab = 'overview' | 'monthly';

export default function PayAdmin() {
  const [tab, setTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<any>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('todos');
  const [testarPietroOpen, setTestarPietroOpen] = useState(false);

  // Mês a mês
  const [ym, setYm] = useState(() => new Date().toISOString().slice(0, 7));
  const [monthData, setMonthData] = useState<any>(null);
  const [monthLoading, setMonthLoading] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    const token = sessionStorage.getItem('billing_token');
    if (!token) { navigate('/pay'); return; }
    load();
  }, []);

  useEffect(() => {
    if (tab === 'monthly') loadMonth();
  }, [tab, ym]);

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
          method: 'GET', headers: { ...headers, 'x-route': '/stats' }, body: null,
        }),
        supabase.functions.invoke('billing-dashboard-api', {
          method: 'GET', headers: { ...headers, 'x-route': '/clients' }, body: null,
        }),
      ]);
      if (statsRes.data) setStats(statsRes.data);
      if (clientsRes.data?.clients) setClients(clientsRes.data.clients);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }

  async function loadMonth() {
    setMonthLoading(true);
    try {
      const { data } = await supabase.functions.invoke('billing-dashboard-api', {
        method: 'GET',
        headers: { ...getHeaders(), 'x-route': `/clients-by-month?ym=${ym}` },
        body: null,
      });
      setMonthData(data);
    } catch (e) { console.error(e); } finally { setMonthLoading(false); }
  }

  async function markPaid(clientId: string, razao: string) {
    if (!confirm(`Confirmar recebimento de ${razao} para ${ym}?`)) return;
    try {
      const { data, error } = await supabase.functions.invoke('billing-dashboard-api', {
        method: 'POST',
        headers: { ...getHeaders(), 'x-route': `/clients/${clientId}/mark-paid` },
        body: { ym },
      });
      if (error || data?.error) {
        alert('Erro: ' + (data?.error || error?.message));
        return;
      }
      await loadMonth();
      await load();
    } catch (e: any) {
      alert('Erro ao marcar como pago: ' + e.message);
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

  const monthBadge = (s: string) =>
    s === 'pago' ? 'bg-green-900 text-green-300'
    : s === 'atrasado' ? 'bg-red-600 text-white'
    : 'bg-amber-900 text-amber-300';

  const monthLabel = (s: string) =>
    s === 'pago' ? '✅ Pago' : s === 'atrasado' ? '🔴 Atrasado' : '⏳ Pendente';

  // Lista de meses (12 meses pra trás + 1 à frente)
  const monthOptions = (() => {
    const arr: { value: string; label: string }[] = [];
    const now = new Date();
    for (let i = -1; i <= 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const v = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      arr.push({ value: v, label: d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) });
    }
    return arr;
  })();

  if (loading) return <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">Carregando...</div>;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <header className="flex items-center justify-between px-6 py-4 bg-slate-800 border-b border-slate-700">
        <h1 className="text-lg font-semibold">AMZOfertas — Painel de Cobrança</h1>
        <nav className="flex gap-4 text-sm items-center">
          <button onClick={() => navigate('/pay/admin')} className="text-sky-400 hover:underline">Dashboard</button>
          <button onClick={() => navigate('/pay/admin/novo')} className="text-sky-400 hover:underline">Novo cliente</button>
          <button onClick={() => navigate('/pay/admin/wuzapi')} className="text-emerald-400 hover:underline">📱 WhatsApp Pietro</button>
          <button onClick={() => setTestarPietroOpen(true)} className="text-amber-400 hover:underline">🧪 Testar Pietro</button>
          <button onClick={() => navigate('/pay')} className="text-sky-400 hover:underline">iPad PIX</button>
          <button onClick={logout} className="text-red-400 hover:underline">Sair</button>
        </nav>
      </header>

      <TestarPietroCobrancaModal open={testarPietroOpen} onClose={() => setTestarPietroOpen(false)} />

      <div className="max-w-[1200px] mx-auto p-6">
        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-slate-700">
          {[
            { k: 'overview', label: '📊 Visão geral' },
            { k: 'monthly', label: '📅 Mês a mês' },
          ].map(t => (
            <button key={t.k} onClick={() => setTab(t.k as Tab)}
              className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${tab === t.k ? 'border-sky-500 text-sky-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <>
            {stats && (
              <div className="grid grid-cols-2 md:grid-cols-7 gap-4 mb-6">
                <Card label="Total empresas" value={stats.total_empresas} />
                <Card label="Em dia" value={stats.em_dia} color="text-green-400" onClick={() => setFilter('em_dia')} />
                <Card label="Inadimplentes" value={stats.inadimplentes} color="text-red-500" onClick={() => setFilter('inadimplente')} />
                <Card label="Aguardando pgto" value={stats.pendente_primeiro_pagamento} color="text-amber-400" onClick={() => setFilter('pendente')} />
                <Card label="Suspensos" value={(stats.inadimplentes || 0) + (stats.cancelados || 0)} color="text-orange-400" onClick={() => setFilter('suspenso')} />
                <Card label="MRR estimado" value={`R$ ${(stats.mrr_estimado_reais || 0).toLocaleString('pt-BR')}`} color="text-sky-400" />
                <Card label="ARR estimado" value={`R$ ${(stats.arr_estimado_reais ?? (stats.mrr_estimado_reais || 0) * 12).toLocaleString('pt-BR')}`} color="text-emerald-400" tooltip="MRR × 12" />
              </div>
            )}

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
                      <td className="p-3">{c.next_billing_date ? formatDateBR(c.next_billing_date) : '—'}</td>
                      <td className="p-3">{c.last_payment_date ? formatDateBR(c.last_payment_date) : '—'}</td>
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
          </>
        )}

        {tab === 'monthly' && (
          <>
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <label className="text-sm text-slate-400">Mês de referência:</label>
              <select value={ym} onChange={(e) => setYm(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm capitalize">
                {monthOptions.map(o => (
                  <option key={o.value} value={o.value} className="capitalize">{o.label}</option>
                ))}
              </select>
              {monthLoading && <span className="text-xs text-slate-500">Atualizando...</span>}
            </div>

            {monthData?.resumo && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                <Card label="Clientes ativos" value={monthData.resumo.total_clientes} />
                <Card label="Pagos" value={monthData.resumo.pagos} color="text-green-400" />
                <Card label="Pendentes" value={monthData.resumo.pendentes} color="text-amber-400" />
                <Card label="Atrasados" value={monthData.resumo.atrasados} color="text-red-500" />
                <Card label="Total recebido" value={`R$ ${Number(monthData.resumo.total_recebido || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} color="text-sky-400" />
              </div>
            )}

            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-400 text-xs uppercase">
                    <th className="p-3 text-left">Status do mês</th>
                    <th className="p-3 text-left">Razão social</th>
                    <th className="p-3 text-left">E-mail</th>
                    <th className="p-3 text-left">Valor pago</th>
                    <th className="p-3 text-left">Data pgto</th>
                    <th className="p-3 text-left">Próx. vencimento</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {(monthData?.clients || []).map((c: any) => (
                    <tr key={c.id} className="border-t border-slate-700 hover:bg-slate-750">
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${monthBadge(c.month_status)}`}>
                          {monthLabel(c.month_status)}
                        </span>
                      </td>
                      <td className="p-3 font-medium">{c.razao_social}</td>
                      <td className="p-3 text-xs">{c.email}</td>
                      <td className="p-3">{c.paid_amount != null ? `R$ ${Number(c.paid_amount).toFixed(2).replace('.', ',')}` : '—'}</td>
                      <td className="p-3">{c.paid_date ? formatDateBR(c.paid_date) : '—'}</td>
                      <td className="p-3">{c.next_billing_date ? formatDateBR(c.next_billing_date) : '—'}</td>
                      <td className="p-3 flex gap-2">
                        {c.month_status !== 'pago' && (
                          <button onClick={() => markPaid(c.id, c.razao_social)}
                            className="px-2 py-1 bg-green-700 hover:bg-green-600 rounded text-xs font-semibold">
                            ✅ Marcar pago
                          </button>
                        )}
                        <button onClick={() => navigate(`/pay/admin/cliente/${c.id}`)}
                          className="text-sky-400 hover:underline text-xs">Ver</button>
                      </td>
                    </tr>
                  ))}
                  {(!monthData?.clients?.length) && (
                    <tr><td colSpan={7} className="p-6 text-center text-slate-500">
                      {monthLoading ? 'Carregando...' : 'Nenhum cliente para este mês'}
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Card({ label, value, color, onClick, tooltip }: { label: string; value: any; color?: string; onClick?: () => void; tooltip?: string }) {
  return (
    <div onClick={onClick} title={tooltip}
      className={`bg-slate-800 rounded-xl p-4 border border-slate-700 ${onClick ? 'cursor-pointer hover:border-sky-500 transition-colors' : ''}`}>
      <div className="text-xs text-slate-400 uppercase tracking-wide">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${color || ''}`}>{value}</div>
    </div>
  );
}
