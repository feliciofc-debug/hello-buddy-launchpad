import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, ArrowLeft, Eye, EyeOff, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function Login() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [sendingReset, setSendingReset] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const email = formData.email.trim().toLowerCase();
      const password = formData.password;

      const { error, data } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      toast.success('Login realizado com sucesso!');

      // Verificar perfil do usuário
      const { data: profile } = await supabase
        .from('profiles')
        .select('tipo')
        .eq('id', data.user.id)
        .maybeSingle();

      // Afiliados vão direto para dashboard de afiliados
      if (profile?.tipo === 'afiliado_admin' || profile?.tipo === 'afiliado') {
        navigate('/afiliado/dashboard');
        return;
      }

      // Acesso direto para: dono da plataforma OU clientes B2B
      if (data.user.email === 'expo@atombrasildigital.com' || profile?.tipo === 'b2b') {
        navigate('/dashboard');
        return;
      }

      // Outros usuários precisam verificar assinatura
      const { data: subscriptionCheck } = await supabase.functions.invoke('check-subscription');

      if (subscriptionCheck?.hasActiveSubscription) {
        navigate('/dashboard');
      } else {
        navigate('/planos');
      }
    } catch (error: any) {
      const msg = String(error?.message || 'Erro ao fazer login');
      if (msg.toLowerCase().includes('invalid login credentials')) {
        toast.error('Email ou senha incorretos. Se precisar, redefina sua senha.');
      } else {
        toast.error(msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendReset = async () => {
    const email = forgotEmail.trim().toLowerCase();
    if (!email) {
      toast.error('Informe seu email.');
      return;
    }

    setSendingReset(true);
    try {
      const redirectTo = `${window.location.origin}/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;

      toast.success('Enviamos um link de redefinição para seu email.');
      setShowForgot(false);
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao enviar link de redefinição');
    } finally {
      setSendingReset(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        {/* Botão Voltar */}
        <button 
          onClick={() => navigate('/')} 
          className="flex items-center gap-2 text-purple-300 hover:text-white mb-8 transition"
        >
          <ArrowLeft className="w-5 h-5" />
          Voltar para início
        </button>

        {/* Card Login */}
        <div className="bg-slate-800/50 backdrop-blur-lg border border-purple-500/30 rounded-2xl p-8 shadow-2xl">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-3 rounded-xl inline-block mb-4">
              <svg className="w-10 h-10" fill="white" viewBox="0 0 24 24">
                <path d="M20 7h-4V4c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v3H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2zM10 4h4v3h-4V4zm10 16H4V9h16v11z"/>
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Bem-vindo de Volta!</h1>
            <p className="text-purple-300">Entre para acessar sua conta</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-purple-300 mb-2">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-purple-400" />
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full bg-slate-700/50 text-white pl-12 pr-4 py-3 rounded-lg border border-purple-500/30 focus:outline-none focus:border-purple-500 transition placeholder:text-slate-500"
                  placeholder="seu@email.com"
                />
              </div>
            </div>

            {/* Senha */}
            <div>
              <label className="block text-sm font-medium text-purple-300 mb-2">
                Senha
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-purple-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  className="w-full bg-slate-700/50 text-white pl-12 pr-12 py-3 rounded-lg border border-purple-500/30 focus:outline-none focus:border-purple-500 transition placeholder:text-slate-500"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-purple-400 hover:text-purple-300 transition"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Esqueci Senha */}
            <div className="text-right">
              <button
                type="button"
                onClick={() => {
                  setForgotEmail(formData.email);
                  setShowForgot(true);
                }}
                className="text-sm text-purple-400 hover:text-purple-300 transition"
              >
                Esqueci minha senha
              </button>
            </div>

            {/* Botão Login */}
            <div className="grid grid-cols-2 gap-4">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 rounded-lg font-semibold hover:shadow-lg transition disabled:opacity-50"
              >
                {isLoading ? 'Entrando...' : 'Entrar'}
              </button>
              
              <button
                type="button"
                onClick={() => navigate('/cadastro')}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-500 text-white py-3 rounded-lg font-semibold hover:shadow-lg transition"
              >
                Criar Conta
              </button>
            </div>
          </form>

          {/* Divider */}
          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-600"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-slate-800 text-slate-400">ou</span>
            </div>
          </div>

          {/* Criar Conta */}
          <div className="text-center">
            <p className="text-slate-400 mb-4">Ainda não tem conta?</p>
            <button
              onClick={() => navigate('/cadastro')}
              className="w-full border-2 border-purple-500/50 text-purple-300 py-3 rounded-lg font-semibold hover:bg-purple-500/10 transition"
            >
              Criar Conta Grátis
            </button>
          </div>
        </div>

        {/* Modal: Redefinir senha */}
        {showForgot && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/60"
              onClick={() => (sendingReset ? null : setShowForgot(false))}
            />
            <div className="relative w-full max-w-md bg-slate-900 border border-purple-500/30 rounded-2xl p-6 shadow-2xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-white">Redefinir senha</h2>
                  <p className="text-purple-300 text-sm mt-1">
                    Vamos enviar um link para você criar uma nova senha.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowForgot(false)}
                  className="text-purple-300 hover:text-white transition"
                  disabled={sendingReset}
                  aria-label="Fechar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mt-5">
                <label className="block text-sm font-medium text-purple-300 mb-2">Email</label>
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  className="w-full bg-slate-700/50 text-white px-4 py-3 rounded-lg border border-purple-500/30 focus:outline-none focus:border-purple-500 transition placeholder:text-slate-500"
                  placeholder="seu@email.com"
                />
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setShowForgot(false)}
                  disabled={sendingReset}
                  className="w-full border-2 border-purple-500/50 text-purple-300 py-3 rounded-lg font-semibold hover:bg-purple-500/10 transition disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSendReset}
                  disabled={sendingReset}
                  className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 rounded-lg font-semibold hover:shadow-lg transition disabled:opacity-50"
                >
                  {sendingReset ? 'Enviando...' : 'Enviar link'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}