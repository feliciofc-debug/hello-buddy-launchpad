import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

export default function PayAdminNovo() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [tipoPessoa, setTipoPessoa] = useState<'pj' | 'pf'>('pj');
  const [form, setForm] = useState({
    razao_social: '', trade_name: '', cnpj: '', email: '', phone: '', platform_login: '',
    logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '', cep: '',
    responsible_name: '', responsible_cpf: '',
    inscricao_estadual: '', inscricao_municipal: '', regime_tributario: 'simples_nacional',
    // PF
    nome: '', cpf: '',
  });

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm({ ...form, [key]: e.target.value });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const token = sessionStorage.getItem('billing_token');
      const headers: any = {};
      if (token) headers['x-billing-token'] = token;

      const body: any = {
        email: form.email,
        phone: form.phone,
        platform_login: form.platform_login,
        billing_address: {
          logradouro: form.logradouro, numero: form.numero, complemento: form.complemento,
          bairro: form.bairro, cidade: form.cidade, uf: form.uf, cep: form.cep,
        },
        tipo_pessoa: tipoPessoa,
        inscricao_estadual: form.inscricao_estadual,
        inscricao_municipal: form.inscricao_municipal,
        regime_tributario: form.regime_tributario,
      };

      if (tipoPessoa === 'pj') {
        body.razao_social = form.razao_social;
        body.trade_name = form.trade_name;
        body.cnpj = form.cnpj;
        body.responsible_name = form.responsible_name;
        body.responsible_cpf = form.responsible_cpf;
      } else {
        body.razao_social = form.nome;
        body.cpf = form.cpf;
        body.responsible_name = form.nome;
        body.responsible_cpf = form.cpf;
      }

      const { data, error: fnErr } = await supabase.functions.invoke('billing-dashboard-api', {
        method: 'POST',
        headers: { ...headers, 'x-route': '/clients' },
        body,
      });

      if (fnErr) throw fnErr;
      if (data?.error) { setError(data.error); return; }
      setSuccess('✅ Cliente cadastrado com sucesso!');
      setTimeout(() => navigate('/pay/admin'), 1500);
    } catch (err: any) {
      setError(err.message || 'Erro ao cadastrar');
    } finally {
      setLoading(false);
    }
  }

  // Guard
  if (!sessionStorage.getItem('billing_token')) {
    navigate('/pay');
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <header className="flex items-center justify-between px-6 py-4 bg-slate-800 border-b border-slate-700">
        <h1 className="text-lg font-semibold">Novo cliente</h1>
        <nav className="flex gap-4 text-sm">
          <button onClick={() => navigate('/pay/admin')} className="text-sky-400 hover:underline">Dashboard</button>
          <button onClick={() => navigate('/pay')} className="text-sky-400 hover:underline">iPad PIX</button>
        </nav>
      </header>

      <div className="max-w-[720px] mx-auto p-6">
        <form onSubmit={handleSubmit}>
          {/* Tipo pessoa toggle */}
          <div className="flex gap-2 mb-6">
            <button type="button" onClick={() => setTipoPessoa('pj')}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold border ${tipoPessoa === 'pj' ? 'bg-sky-600 text-white border-sky-600' : 'bg-slate-800 text-slate-300 border-slate-600'}`}>
              Pessoa Jurídica (CNPJ)
            </button>
            <button type="button" onClick={() => setTipoPessoa('pf')}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold border ${tipoPessoa === 'pf' ? 'bg-sky-600 text-white border-sky-600' : 'bg-slate-800 text-slate-300 border-slate-600'}`}>
              Pessoa Física (CPF)
            </button>
          </div>

          {tipoPessoa === 'pj' ? (
            <>
              <h2 className="text-base font-semibold mb-4">Dados da empresa</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Razão social *" value={form.razao_social} onChange={set('razao_social')} required />
                <Field label="Nome fantasia" value={form.trade_name} onChange={set('trade_name')} />
                <Field label="CNPJ *" value={form.cnpj} onChange={set('cnpj')} required placeholder="somente números" />
                <Field label="Inscrição Estadual" value={form.inscricao_estadual} onChange={set('inscricao_estadual')} />
                <Field label="Inscrição Municipal" value={form.inscricao_municipal} onChange={set('inscricao_municipal')} />
                <div>
                  <span className="text-xs text-slate-400">Regime Tributário</span>
                  <select value={form.regime_tributario} onChange={set('regime_tributario')}
                    className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-sky-500">
                    <option value="simples_nacional">Simples Nacional</option>
                    <option value="lucro_presumido">Lucro Presumido</option>
                    <option value="lucro_real">Lucro Real</option>
                    <option value="mei">MEI</option>
                  </select>
                </div>
              </div>

              <h3 className="text-sm font-semibold mt-6 mb-3">Responsável legal</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Nome completo *" value={form.responsible_name} onChange={set('responsible_name')} required />
                <Field label="CPF *" value={form.responsible_cpf} onChange={set('responsible_cpf')} required />
              </div>
            </>
          ) : (
            <>
              <h2 className="text-base font-semibold mb-4">Dados pessoais</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Nome completo *" value={form.nome} onChange={set('nome')} required />
                <Field label="CPF *" value={form.cpf} onChange={set('cpf')} required placeholder="somente números" />
              </div>
            </>
          )}

          <h3 className="text-sm font-semibold mt-6 mb-3">Contato</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="E-mail *" value={form.email} onChange={set('email')} required type="email" />
            <Field label="Telefone" value={form.phone} onChange={set('phone')} />
            <Field label="Login na plataforma" value={form.platform_login} onChange={set('platform_login')} />
          </div>

          <h3 className="text-sm font-semibold mt-6 mb-3">Endereço (faturamento / NF)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Field label="Logradouro" value={form.logradouro} onChange={set('logradouro')} />
            </div>
            <Field label="Número" value={form.numero} onChange={set('numero')} />
            <Field label="Complemento" value={form.complemento} onChange={set('complemento')} />
            <Field label="Bairro" value={form.bairro} onChange={set('bairro')} />
            <Field label="Cidade" value={form.cidade} onChange={set('cidade')} />
            <Field label="UF" value={form.uf} onChange={set('uf')} maxLength={2} />
            <Field label="CEP" value={form.cep} onChange={set('cep')} />
          </div>

          {error && <p className="text-red-500 text-sm mt-4">{error}</p>}
          {success && <p className="text-green-400 text-sm mt-4">{success}</p>}

          <button type="submit" disabled={loading}
            className="mt-6 w-full py-3 bg-sky-600 hover:bg-sky-700 rounded-lg font-semibold text-white disabled:opacity-50">
            {loading ? 'Salvando...' : 'Salvar cadastro'}
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="text-xs text-slate-400">{label}</span>
      <input {...props}
        className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-sky-500" />
    </label>
  );
}
