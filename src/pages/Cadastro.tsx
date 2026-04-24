import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageCircle, CheckCircle2, Clock, Users } from 'lucide-react';

const WHATSAPP_URL =
  'https://wa.me/5521995379550?text=Ol%C3%A1!%20Tenho%20interesse%20em%20conhecer%20a%20AMZ%20Ofertas.%20Minha%20vitrine%20Shopee:%20';

export default function Cadastro() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <button
          onClick={() => navigate('/')}
          className="text-orange-300 hover:text-white transition mb-8 flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar para a página inicial
        </button>

        <div className="bg-slate-800/50 backdrop-blur-sm border-2 border-orange-500/50 rounded-3xl p-8 md:p-12 shadow-2xl shadow-orange-500/20 text-center">
          <div className="inline-flex p-4 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full mb-6">
            <MessageCircle className="w-10 h-10 text-white" />
          </div>

          <h1 className="text-3xl md:text-4xl font-bold mb-4">
            Atendimento <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-pink-500">Personalizado</span>
          </h1>

          <p className="text-lg md:text-xl text-slate-300 mb-8 leading-relaxed">
            Estamos aceitando novos clientes por <strong className="text-white">atendimento consultivo</strong>.
            Nossa equipe configura tudo pra você e <strong className="text-white">em 48h sua automação já está rodando</strong>.
          </p>

          <div className="grid md:grid-cols-3 gap-4 mb-8 text-left">
            <div className="bg-slate-700/40 p-4 rounded-xl flex items-start gap-3">
              <Users className="w-6 h-6 text-orange-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-sm">Consultor dedicado</p>
                <p className="text-xs text-slate-400">Te acompanhamos do início ao fim</p>
              </div>
            </div>
            <div className="bg-slate-700/40 p-4 rounded-xl flex items-start gap-3">
              <Clock className="w-6 h-6 text-orange-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-sm">Pronto em 48h</p>
                <p className="text-xs text-slate-400">Setup completo da plataforma</p>
              </div>
            </div>
            <div className="bg-slate-700/40 p-4 rounded-xl flex items-start gap-3">
              <CheckCircle2 className="w-6 h-6 text-orange-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-sm">Sem complicação</p>
                <p className="text-xs text-slate-400">A gente cuida de toda configuração</p>
              </div>
            </div>
          </div>

          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-3 w-full md:w-auto bg-gradient-to-r from-green-500 to-emerald-500 text-white px-10 py-5 rounded-xl font-bold text-xl hover:shadow-2xl transition transform hover:scale-105"
          >
            <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            Falar no WhatsApp
          </a>

          <p className="text-sm text-slate-400 mt-6">
            A partir de <strong className="text-white">R$ 597/mês</strong> · Resposta em poucos minutos no horário comercial
          </p>
        </div>

        <div className="text-center mt-8">
          <p className="text-slate-400 text-sm">
            Já é cliente?{' '}
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
