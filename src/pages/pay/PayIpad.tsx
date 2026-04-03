import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export default function PayIpad() {
  const [form, setForm] = useState({ name: '', email: '', cpf: '', phone: '', platform_login: '', address: '' });
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
      const { data, error: fnErr } = await supabase.functions.invoke('billing-register-pix', {
        body: {
          name: form.name,
          email: form.email,
          cpf: form.cpf,
          phone: form.phone,
          platform_login: form.platform_login || undefined,
          billing_address: form.address ? { observacao: form.address } : {},
          mode,
        },
      });

      if (fnErr) throw fnErr;
      if (data?.error) {
        setError(data.error);
        return;
      }

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

  return (
    <div className="min-h-screen bg-slate-50 p-4" style={{ maxWidth: 520, margin: '0 auto' }}>
      <div className="bg-white rounded-xl p-5 shadow-sm">
        <h1 className="text-xl font-bold text-slate-800 mb-1">AMZOfertas — fechamento na rua</h1>
        <p className="text-sm text-slate-500 mb-4">Cadastre o cliente e gere o PIX na hora</p>

        {!result && (
          <form onSubmit={(e) => handleSubmit(e, 'pix')}>
            <Label label="Nome completo *">
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full mt-1 px-3 py-2.5 border border-slate-300 rounded-lg text-base" autoComplete="name" />
            </Label>
            <Label label="E-mail *">
              <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="input-field" autoComplete="email" />
            </Label>
            <Label label="CPF *">
              <input required value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })}
                className="input-field" inputMode="numeric" />
            </Label>
            <Label label="Telefone">
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="input-field" type="tel" autoComplete="tel" />
            </Label>
            <Label label="Login na plataforma (opcional)">
              <input value={form.platform_login} onChange={(e) => setForm({ ...form, platform_login: e.target.value })}
                className="input-field" />
            </Label>
            <Label label="Endereço / observações">
              <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="input-field" />
            </Label>

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
            <button onClick={() => { setResult(null); setForm({ name: '', email: '', cpf: '', phone: '', platform_login: '', address: '' }); }}
              className="mt-2 block mx-auto text-sky-600 text-sm">
              ← Novo cadastro
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Label({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block mt-3">
      <span className="text-sm text-slate-600">{label}</span>
      {children}
    </label>
  );
}
