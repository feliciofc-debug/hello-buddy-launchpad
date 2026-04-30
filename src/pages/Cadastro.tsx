import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Lock, Mail, Phone, MessageCircle } from 'lucide-react';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const WHATSAPP_URL =
  'https://wa.me/5521995379550?text=Ol%C3%A1!%20Tenho%20interesse%20em%20conhecer%20a%20AMZ%20Ofertas.%20Minha%20vitrine%20Shopee:%20';

const cadastroSchema = z.object({
  email: z.string().trim().email({ message: 'E-mail inválido' }).max(255),
  whatsapp: z.string().trim().min(10, { message: 'WhatsApp inválido' }).max(20),
  password: z.string().min(8, { message: 'Senha deve ter no mínimo 8 caracteres' }).max(72),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'As senhas não conferem',
  path: ['confirmPassword'],
});

export default function Cadastro() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    email: '',
    whatsapp: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validar
    const result = cadastroSchema.safeParse(form);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setLoading(true);

    try {
      // Criar conta
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: {
            whatsapp: form.whatsapp,
          },
        },
      });

      if (signUpError) {
        if (signUpError.message.includes('already registered')) {
          toast.error('Este e-mail já está cadastrado. Faça login.');
          setTimeout(() => navigate('/login'), 1500);
          return;
        }
        throw signUpError;
      }

      const userId = signUpData.user?.id;
      if (!userId) throw new Error('Erro ao criar conta');

      toast.success('Conta criada! Escolha a forma de pagamento...');

      // Redireciona para /planos onde o modal CheckoutProMP é renderizado
      navigate('/planos');
    } catch (err: any) {
      console.error('Erro no cadastro:', err);
      toast.error(err.message || 'Erro ao processar cadastro');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
      <div className="max-w-xl mx-auto px-6 py-12">
        <button
          onClick={() => navigate('/')}
          className="text-orange-300 hover:text-white transition mb-8 flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>

        <div className="bg-slate-800/50 backdrop-blur-sm border-2 border-orange-500/50 rounded-3xl p-8 shadow-2xl shadow-orange-500/20">
          <div className="text-center mb-6">
            <div className="inline-flex p-3 bg-gradient-to-r from-orange-500 to-pink-500 rounded-full mb-4">
              <Lock className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold mb-2">Criar Conta</h1>
            <p className="text-slate-300">
              Plano <strong className="text-white">AMZ Ofertas PRO</strong> ·{' '}
              <span className="text-green-400 font-bold">R$ 597/mês</span>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold mb-1.5">E-mail</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  placeholder="seu@email.com"
                  disabled={loading}
                  className="w-full bg-slate-700/50 border border-slate-600 rounded-lg pl-10 pr-3 py-3 focus:outline-none focus:border-orange-500 transition disabled:opacity-50"
                />
              </div>
              {errors.email && <p className="text-red-400 text-sm mt-1">{errors.email}</p>}
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1.5">WhatsApp</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="tel"
                  value={form.whatsapp}
                  onChange={(e) => handleChange('whatsapp', e.target.value)}
                  placeholder="(11) 99999-9999"
                  disabled={loading}
                  className="w-full bg-slate-700/50 border border-slate-600 rounded-lg pl-10 pr-3 py-3 focus:outline-none focus:border-orange-500 transition disabled:opacity-50"
                />
              </div>
              {errors.whatsapp && <p className="text-red-400 text-sm mt-1">{errors.whatsapp}</p>}
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1.5">Senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => handleChange('password', e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  disabled={loading}
                  className="w-full bg-slate-700/50 border border-slate-600 rounded-lg pl-10 pr-3 py-3 focus:outline-none focus:border-orange-500 transition disabled:opacity-50"
                />
              </div>
              {errors.password && <p className="text-red-400 text-sm mt-1">{errors.password}</p>}
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1.5">Confirmar Senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  value={form.confirmPassword}
                  onChange={(e) => handleChange('confirmPassword', e.target.value)}
                  placeholder="Digite a senha novamente"
                  disabled={loading}
                  className="w-full bg-slate-700/50 border border-slate-600 rounded-lg pl-10 pr-3 py-3 focus:outline-none focus:border-orange-500 transition disabled:opacity-50"
                />
              </div>
              {errors.confirmPassword && (
                <p className="text-red-400 text-sm mt-1">{errors.confirmPassword}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-orange-500 to-pink-500 hover:shadow-2xl text-white py-4 rounded-xl font-bold text-lg transition transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" /> Processando...
                </>
              ) : (
                '🚀 Criar Conta e Pagar'
              )}
            </button>

            <p className="text-xs text-slate-400 text-center">
              Você será redirecionado ao Mercado Pago para concluir o pagamento via PIX, cartão ou boleto.
            </p>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-700 text-center">
            <p className="text-sm text-slate-400 mb-3">Prefere conversar antes de assinar?</p>
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-5 py-2.5 rounded-lg font-semibold text-sm transition"
            >
              <MessageCircle className="w-4 h-4" /> Falar no WhatsApp
            </a>
          </div>
        </div>

        <div className="text-center mt-6">
          <p className="text-slate-400 text-sm">
            Já tem conta?{' '}
            <button
              onClick={() => navigate('/login')}
              className="text-orange-300 hover:text-white transition font-semibold"
            >
              Fazer login
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
