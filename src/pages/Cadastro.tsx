import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Lock, Mail, Phone, MessageCircle, UserRound } from 'lucide-react';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AMZ_PLANS, formatPlanPrice, getAmzPlan, isAmzPlanId, type AmzPlanId } from '@/lib/amz-plans';

const WHATSAPP_URL =
  'https://wa.me/5521980804901?text=Ol%C3%A1!%20Tenho%20interesse%20em%20conhecer%20a%20AMZ%20Ofertas.%20Minha%20vitrine%20Shopee:%20';

const cadastroSchema = z.object({
  nome: z.string().trim().min(2, { message: 'Informe seu nome' }).max(120),
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
  const [searchParams] = useSearchParams();
  const requestedPlan = searchParams.get('plano');
  const [selectedPlanId, setSelectedPlanId] = useState<AmzPlanId>(
    isAmzPlanId(requestedPlan) ? requestedPlan : 'essencial',
  );
  const selectedPlan = getAmzPlan(selectedPlanId);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    nome: '',
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
            nome: form.nome,
            whatsapp: form.whatsapp,
            plano_solicitado: selectedPlanId,
          },
        },
      });

      if (signUpError) {
        if (/already registered|já (?:está|esta) cadastrado|email.*cadastrado/i.test(signUpError.message)) {
          toast.error('Este e-mail já está cadastrado. Faça login.');
          setTimeout(() => navigate('/login'), 1500);
          return;
        }
        throw signUpError;
      }

      const userId = signUpData.user?.id;
      if (!userId) throw new Error('Erro ao criar conta');

      toast.success('Conta criada! Vamos confirmar o pagamento com você.');
      navigate('/dashboard?cadastro=pendente');
    } catch (err: unknown) {
      console.error('Erro no cadastro:', err);
      toast.error(err instanceof Error ? err.message : 'Erro ao processar cadastro');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-xl mx-auto px-6 py-12">
        <button
          onClick={() => navigate('/planos')}
          className="text-slate-400 hover:text-white transition mb-8 flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>

        <div className="bg-slate-900/70 backdrop-blur-sm border border-slate-800 rounded-2xl p-8 shadow-2xl">
          <div className="text-center mb-6">
            <div className="inline-flex p-3 bg-orange-500 rounded-xl mb-4">
              <Lock className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold mb-2">Criar Conta</h1>
            <p className="text-slate-400">
              Plano <strong className="text-white">{selectedPlan.name}</strong> ·{' '}
              <span className="text-orange-400 font-bold">
                {formatPlanPrice(selectedPlan.price)}/mês
              </span>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold mb-1.5">Plano escolhido</label>
              <div className="grid gap-2 sm:grid-cols-3">
                {AMZ_PLANS.map((plan) => (
                  <button
                    key={plan.id}
                    type="button"
                    disabled={loading}
                    onClick={() => setSelectedPlanId(plan.id)}
                    className={`rounded-lg border px-3 py-2 text-left transition ${
                      selectedPlanId === plan.id
                        ? 'border-orange-500 bg-orange-500/10'
                        : 'border-slate-700 bg-slate-800/50 hover:border-slate-500'
                    }`}
                  >
                    <span className="block text-sm font-semibold">{plan.name}</span>
                    <span className="text-xs text-slate-400">{formatPlanPrice(plan.price)}/mês</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1.5">Nome</label>
              <div className="relative">
                <UserRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={form.nome}
                  onChange={(e) => handleChange('nome', e.target.value)}
                  placeholder="Seu nome completo"
                  disabled={loading}
                  className="w-full bg-slate-800/60 border border-slate-700 rounded-lg pl-10 pr-3 py-3 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/40 transition disabled:opacity-50"
                />
              </div>
              {errors.nome && <p className="text-red-400 text-sm mt-1">{errors.nome}</p>}
            </div>

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
                  className="w-full bg-slate-800/60 border border-slate-700 rounded-lg pl-10 pr-3 py-3 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/40 transition disabled:opacity-50"
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
                  className="w-full bg-slate-800/60 border border-slate-700 rounded-lg pl-10 pr-3 py-3 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/40 transition disabled:opacity-50"
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
                  className="w-full bg-slate-800/60 border border-slate-700 rounded-lg pl-10 pr-3 py-3 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/40 transition disabled:opacity-50"
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
                  className="w-full bg-slate-800/60 border border-slate-700 rounded-lg pl-10 pr-3 py-3 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/40 transition disabled:opacity-50"
                />
              </div>
              {errors.confirmPassword && (
                <p className="text-red-400 text-sm mt-1">{errors.confirmPassword}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white py-4 rounded-xl font-bold text-lg transition transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" /> Processando...
                </>
              ) : (
                'Criar conta'
              )}
            </button>

            <p className="text-xs text-slate-400 text-center">
              Pagamento por cartão à vista, PIX ou boleto. Após o cadastro, nossa equipe confirma
              o pagamento e a ativação com você.
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
              className="text-orange-400 hover:text-orange-300 transition font-semibold"
            >
              Fazer login
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
