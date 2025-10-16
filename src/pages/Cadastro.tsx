import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function Cadastro() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }

    if (password.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) throw error;

      toast.success('Conta criada com sucesso! Redirecionando...');
      setTimeout(() => navigate('/dashboard'), 2000);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao criar conta');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-slate-800/50 backdrop-blur-lg border border-purple-500/30 rounded-2xl p-8">
          <div className="text-center mb-8">
            <div className="inline-block bg-green-500/20 border border-green-500 rounded-full px-4 py-2 mb-4">
              <span className="text-green-300 font-semibold">🎁 7 Dias Grátis</span>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Criar Conta</h1>
            <p className="text-slate-400">Comece sua jornada de afiliado agora!</p>
          </div>

          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <Label htmlFor="email" className="text-white">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-slate-900/50 border-purple-500/30 text-white"
                placeholder="seu@email.com"
              />
            </div>

            <div>
              <Label htmlFor="password" className="text-white">Senha</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-slate-900/50 border-purple-500/30 text-white"
                placeholder="Mínimo 6 caracteres"
              />
            </div>

            <div>
              <Label htmlFor="confirmPassword" className="text-white">Confirmar Senha</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="bg-slate-900/50 border-purple-500/30 text-white"
                placeholder="Digite a senha novamente"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-bold"
            >
              {loading ? 'Criando conta...' : '🚀 COMEÇAR GRÁTIS'}
            </Button>
          </form>

          <div className="mt-6 space-y-3">
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <span className="text-green-400">✅</span>
              <span>Sem cartão de crédito necessário</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <span className="text-green-400">✅</span>
              <span>Cancele quando quiser</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <span className="text-green-400">✅</span>
              <span>Acesso imediato a todas as funcionalidades</span>
            </div>
          </div>

          <div className="mt-6 text-center">
            <p className="text-slate-400">
              Já tem uma conta?{' '}
              <button
                onClick={() => navigate('/login')}
                className="text-orange-400 hover:text-orange-300 font-semibold"
              >
                Entrar
              </button>
            </p>
          </div>

          <div className="mt-4 text-center">
            <button
              onClick={() => navigate('/landing')}
              className="text-slate-400 hover:text-white text-sm"
            >
              ← Voltar para o início
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}