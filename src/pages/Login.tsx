import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function Login() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { error, data } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (error) throw error;

      toast.success('Login realizado com sucesso!');
      
      // Verificar se tem assinatura ativa
      console.log('Verificando assinatura...');
      const { data: subscriptionCheck } = await supabase.functions.invoke('check-subscription');
      
      console.log('Resultado da verificação:', subscriptionCheck);

      if (subscriptionCheck?.hasActiveSubscription) {
        console.log('✅ Tem assinatura ativa - indo para dashboard');
        navigate('/dashboard');
      } else {
        console.log('❌ Sem assinatura - indo para planos');
        navigate('/planos');
      }
    } catch (error: any) {
      toast.error(error.message || 'Erro ao fazer login');
    } finally {
      setIsLoading(false);
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
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  className="w-full bg-slate-700/50 text-white pl-12 pr-4 py-3 rounded-lg border border-purple-500/30 focus:outline-none focus:border-purple-500 transition placeholder:text-slate-500"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {/* Esqueci Senha */}
            <div className="text-right">
              <button type="button" className="text-sm text-purple-400 hover:text-purple-300 transition">
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
      </div>
    </div>
  );
}