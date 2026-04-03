import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

export default function PayIpad() {
  const navigate = useNavigate();
  const [tipoPessoa, setTipoPessoa] = useState<'pf' | 'pj'>('pf');
  const [form, setForm] = useState({
    name: '', email: '', cpf: '', phone: '', platform_login: '', address: '',
    // PJ fields
    razao_social: '', trade_name: '', cnpj: '', responsible_name: '', responsible_cpf: '',
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent, mode: 'pix' | 'checkout' = 'pix') => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const body: any = {
        name: tipoPessoa === 'pj' ? form.razao_social : form.name,
        email: form.email,
        phone: form.phone,
        platform_login: form.platform_login || undefined,
        billing_address: form.address ? { observacao: form.address } : {},
        mode,
      };

      if (tipoPessoa === 'pf') {
        body.cpf = form.cpf;
      } else {
        body.trade_name = form.trade_name;
        body.cnpj = form.cnpj;
        body.responsible_name = form.responsible_name;
        body.responsible_cpf = form.responsible_cpf;
      }

      const { data, error: fnErr } = await supabase.functions.invoke('billing-register-pix', { body });
      if (fnErr) throw fnErr;
      if (data?.error) { setError(data.error); return; }
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Erro ao processar');
    } finally {
      setLoading(false);
    }
  };

  const copyPix = () => {
    if (result?.pix_qr_code) {
      navigator.clipboard.writeText(result.pix_qr_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const reset = () => {
    setResult(null);
    setForm({ name: '', email: '', cpf: '', phone: '', platform_login: '', address: '', razao_social: '', trade_name: '', cnpj: '', responsible_name: '', responsible_cpf: '' });
  };

  // Check if logged in
  const token = sessionStorage.getItem('billing_token');

  return (
    <div className="min-h-screen bg-slate-50 p-4" style={{ maxWidth: 520, margin: '0 auto' }}>
      <div className="bg-white rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-xl font-bold text-slate-800">AMZOfertas — Fechamento</h1>
          {token && (
            <button onClick={() => navigate('/pay/admin')} className="text-sky-600 text-xs font-semibold">
              Painel →
            </button>
          )}
        </div>
        <p className="text-sm text-slate-500 mb-4">Cadastre o cliente e gere o PIX na hora</p>

        {!result && (
          <form onSubmit={(e) => handleSubmit(e, 'pix')}>
            {/* Tipo pessoa toggle */}
            <div className="flex gap-2 mb-4">
              <button type="button" onClick={() => setTipoPessoa('pf')}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${tipoPessoa === 'pf' ? 'bg-sky-600 text-white border-sky-600' : 'bg-white text-slate-600 border-slate-300'}`}>
                Pessoa Física (CPF)
              </button>
              <button type="button" onClick={() => setTipoPessoa('pj')}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${tipoPessoa === 'pj' ? 'bg-sky-600 text-white border-sky-600' : 'bg-white text-slate-600 border-slate-300'}`}>
                Pessoa Jurídica (CNPJ)
              </button>
            </div>

            {tipoPessoa === 'pf' ? (
              <>
                <Input label="Nome completo *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required autoComplete="name" />
                <Input label="CPF *" value={form.cpf} onChange={(v) => setForm({ ...form, cpf: v })} required inputMode="numeric" />
              </>
            ) : (
              <>
                <Input label="Razão social *" value={form.razao_social} onChange={(v) => setForm({ ...form, razao_social: v })} required />
                <Input label="Nome fantasia" value={form.trade_name} onChange={(v) => setForm({ ...form, trade_name: v })} />
                <Input label="CNPJ *" value={form.cnpj} onChange={(v) => setForm({ ...form, cnpj: v })} required inputMode="numeric" />
                <Input label="Responsável *" value={form.responsible_name} onChange={(v) => setForm({ ...form, responsible_name: v })} required />
                <Input label="CPF do responsável *" value={form.responsible_cpf} onChange={(v) => setForm({ ...form, responsible_cpf: v })} required inputMode="numeric" />
              </>
            )}

            <Input label="E-mail *" value={form.email} onChange={(v) => setForm({ ...form, email: v })} required type="email" autoComplete="email" />
            <Input label="Telefone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} type="tel" autoComplete="tel" />
            <Input label="Login na plataforma (opcional)" value={form.platform_login} onChange={(v) => setForm({ ...form, platform_login: v })} />
            <Input label="Endereço / observações" value={form.address} onChange={(v) => setForm({ ...form, address: v })} />

            <button type="submit" disabled={loading}
              className="w-full mt-4 py-3 rounded-lg font-semibold text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-50">
              {loading ? 'Gerando...' : 'Gerar PIX — R$ 597,00'}
            </button>
            <button type="button" disabled={loading} onClick={(e) => handleSubmit(e as any, 'checkout')}
              className="w-full mt-2 py-3 rounded-lg font-semibold text-white bg-slate-500 hover:bg-slate-600 disabled:opacity-50">
              Ou abrir checkout (PIX ou cartão)
            </button>
          </form>
        )}

        {error && <p className="text-red-600 text-sm mt-3">{error}</p>}

        {result?.init_point && (
          <div className="mt-4 text-center">
            <p className="text-green-600 font-semibold mb-2">✅ Cliente cadastrado!</p>
            <a href={result.init_point} target="_blank" rel="noopener noreferrer"
              className="inline-block px-6 py-3 bg-sky-600 text-white rounded-lg font-semibold">
              Abrir checkout Mercado Pago
            </a>
            <button onClick={reset} className="mt-2 block mx-auto text-sky-600 text-sm">← Novo cadastro</button>
          </div>
        )}

        {result?.pix_qr_code_base64 && (
          <div className="mt-4 text-center">
            <p className="text-green-600 font-semibold mb-2">✅ PIX gerado! Mostre ao cliente:</p>
            <img src={`data:image/png;base64,${result.pix_qr_code_base64}`} alt="QR Code PIX"
              className="mx-auto max-w-full" style={{ maxHeight: 300 }} />
            <p className="text-xs text-slate-500 mt-2">Valor: R$ 597,00 — Mensalidade AMZOfertas</p>
            {result.pix_qr_code && (
              <button onClick={copyPix}
                className="mt-3 px-4 py-2 bg-slate-700 text-white rounded-lg text-sm">
                {copied ? '✅ Copiado!' : '📋 Copiar código PIX'}
              </button>
            )}
            <button onClick={reset} className="mt-2 block mx-auto text-sky-600 text-sm">← Novo cadastro</button>
          </div>
        )}
      </div>
    </div>
  );
}

function Input({ label, value, onChange, ...props }: { label: string; value: string; onChange: (v: string) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'>) {
  return (
    <label className="block mt-3">
      <span className="text-sm text-slate-600">{label}</span>
      <input {...props} value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full mt-1 px-3 py-2.5 border border-slate-300 rounded-lg text-base" />
    </label>
  );
}
