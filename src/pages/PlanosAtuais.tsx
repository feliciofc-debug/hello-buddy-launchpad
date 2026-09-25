import { ArrowLeft, Check, CreditCard, MessageCircle, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AMZ_PLANS, formatPlanPrice } from '@/lib/amz-plans';

const WHATSAPP_URL =
  'https://wa.me/5521980804901?text=Ol%C3%A1!%20Quero%20entender%20qual%20plano%20da%20AMZ%20%C3%A9%20melhor%20para%20minha%20empresa.';

export default function PlanosAtuais() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <button
          onClick={() => navigate('/')}
          className="mb-10 flex items-center gap-2 text-slate-400 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>

        <header className="mx-auto mb-12 max-w-3xl text-center">
          <span className="mb-4 inline-flex rounded-full border border-orange-500/40 bg-orange-500/10 px-4 py-2 text-sm font-semibold text-orange-300">
            Sem taxa de implantação
          </span>
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
            Escolha o plano certo para sua empresa
          </h1>
          <p className="mt-4 text-lg text-slate-300">
            Mensalidades transparentes. Pagamento por cartão à vista, PIX ou boleto.
          </p>
        </header>

        <section className="grid gap-6 lg:grid-cols-3">
          {AMZ_PLANS.map((plan) => (
            <article
              key={plan.id}
              className={`relative flex flex-col rounded-3xl border p-7 shadow-xl ${
                plan.featured
                  ? 'border-orange-500 bg-slate-900 shadow-orange-950/40'
                  : 'border-slate-800 bg-slate-900/70'
              }`}
            >
              {plan.featured && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-orange-500 px-4 py-1 text-xs font-bold uppercase tracking-wide">
                  Mais completo
                </span>
              )}
              <h2 className="text-2xl font-bold">{plan.name}</h2>
              <p className="mt-2 min-h-12 text-sm text-slate-400">{plan.summary}</p>
              <div className="my-7">
                <span className="text-4xl font-bold">{formatPlanPrice(plan.price)}</span>
                <span className="text-slate-400">/mês</span>
              </div>

              <ul className="mb-8 flex-1 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3 text-sm text-slate-200">
                    <Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
                    {feature}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => navigate(`/cadastro?plano=${plan.id}`)}
                className={`w-full rounded-xl px-5 py-4 font-bold transition ${
                  plan.featured
                    ? 'bg-orange-500 hover:bg-orange-600'
                    : 'bg-slate-700 hover:bg-slate-600'
                }`}
              >
                Assinar {plan.name}
              </button>
            </article>
          ))}
        </section>

        <section className="mt-10 grid gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 md:grid-cols-3">
          <div className="flex items-center gap-3">
            <CreditCard className="h-6 w-6 text-orange-400" />
            <span>Cartão à vista, PIX ou boleto</span>
          </div>
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-6 w-6 text-emerald-400" />
            <span>Sem taxa de implantação</span>
          </div>
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 text-emerald-300 hover:text-emerald-200 md:justify-end"
          >
            <MessageCircle className="h-6 w-6" />
            Falar com um consultor
          </a>
        </section>
      </div>
    </div>
  );
}
