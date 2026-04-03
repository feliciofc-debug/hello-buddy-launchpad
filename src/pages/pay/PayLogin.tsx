import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

export default function PayLogin() {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data, error: fnErr } = await supabase.functions.invoke('billing-auth', {
        body: { password },
      });

      if (fnErr) throw fnErr;
      if (data?.error) { setError(data.error); return; }
      if (data?.token) {
        sessionStorage.setItem('billing_token', data.token);
        navigate('/pay/admin');
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao autenticar');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-2xl p-8 w-full max-w-sm border border-slate-700 shadow-2xl">
        <h1 className="text-xl font-bold text-white mb-1 text-center">AMZOfertas</h1>
        <p className="text-sm text-slate-400 mb-6 text-center">Painel de cobrança</p>

        <form onSubmit={handleLogin}>
          <label className="block mb-4">
            <span className="text-xs text-slate-400">Senha de acesso</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full mt-1 px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white text-base focus:outline-none focus:border-sky-500"
              placeholder="••••••••"
              required
              autoFocus
            />
          </label>

          {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

          <button type="submit" disabled={loading}
            className="w-full py-3 bg-sky-600 hover:bg-sky-700 rounded-lg font-semibold text-white disabled:opacity-50">
            {loading ? 'Verificando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
