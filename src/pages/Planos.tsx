import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Zap, Shield, Clock, CreditCard, AlertCircle, TrendingUp, Building2, Target, Bot, ArrowLeft, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import PaymentFormDirect from '@/components/PaymentFormDirect';
import { SEGMENTOS_EMPRESA } from '@/lib/segments';

const Planos = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [step, setStep] = useState<'plano' | 'pagamento'>('pagamento'); // Ir direto para pagamento

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate('/cadastro');
        return;
      }
      
      setUser(user);
      setCheckingAuth(false);
    };

    checkAuth();
  }, [navigate]);

  const planoAfiliado = {
    id: 'afiliado',
    nome: 'Plano Afiliado AMZ Ofertas',
    precoMensal: 297,
    precoAnualParcela: 237,
    precoAnualTotal: 2844, // 12 x 237
    features: [
      'Produtos baixados automaticamente',
      'Amazon, Magalu, Mercado Livre, Boticário',
      'Mensagens ilimitadas no WhatsApp',
      'IA gera textos e vídeos promocionais',
      'Campanhas agendadas automáticas',
      'Listas segmentadas de clientes',
      'Variação de mensagens anti-bloqueio',
      'Suporte via WhatsApp',
      'Atualizações gratuitas'
    ]
  };

  const handleEscolherPlano = () => {
    if (!user) {
      navigate('/cadastro-afiliado');
      return;
    }
    setStep('pagamento');
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">Carregando...</div>
      </div>
    );
  }

  // Página de Pagamento para Afiliados
  if (step === 'pagamento') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 py-12">
        <div className="max-w-4xl mx-auto px-6">
          <button
            onClick={() => navigate('/cadastro-afiliado')}
            className="text-orange-300 hover:text-white transition mb-6 flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar
          </button>
          
          {/* Progress indicator simplificado */}
          <div className="flex items-center justify-center gap-4 mb-8">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white">✓</div>
              <span className="text-green-400 text-sm">Cadastro</span>
            </div>
            <div className="w-8 h-1 bg-green-500"></div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white">2</div>
              <span className="text-orange-400 text-sm">Pagamento</span>
            </div>
          </div>
          
          <PaymentFormDirect
            planName={planoAfiliado.nome}
            userId={user.id}
          />
        </div>
      </div>
    );
  }

  // Afiliado vai direto para pagamento, sem etapa de segmento
  // STEP 1: Escolha do Plano
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 py-12">
      <div className="max-w-3xl mx-auto px-6">
        
        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-4 mb-8">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white">1</div>
            <span className="text-orange-400 text-sm">Plano</span>
          </div>
          <div className="w-8 h-1 bg-slate-600"></div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center text-white">2</div>
            <span className="text-slate-400 text-sm">Cadastro</span>
          </div>
          <div className="w-8 h-1 bg-slate-600"></div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center text-white">3</div>
            <span className="text-slate-400 text-sm">Pagamento</span>
          </div>
        </div>

        {/* Card Plano Afiliado */}
        <div className="bg-slate-800/50 backdrop-blur-sm border-2 border-orange-500/50 rounded-3xl p-12 shadow-2xl shadow-orange-500/20 mb-8">
          {/* Badge Topo */}
          <div className="text-center mb-8">
            <span className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-6 py-2 rounded-full text-lg font-bold animate-pulse shadow-lg inline-block mb-6">
              🚀 PLANO AFILIADO
            </span>
            
            <div className="inline-flex p-4 bg-gradient-to-r from-orange-500 to-red-500 rounded-full mb-4">
              <Zap className="w-10 h-10 text-white" />
            </div>
            
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
              {planoAfiliado.nome}
            </h1>

            {/* Preço */}
            <div className="mb-6">
              <div className="flex flex-col md:flex-row items-center justify-center gap-4 mb-4">
                {/* Opção Mensal */}
                <div className="bg-slate-700/50 p-4 rounded-xl border border-slate-600">
                  <p className="text-slate-400 text-sm mb-1">Mensal</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500">
                      R$ {planoAfiliado.precoMensal}
                    </span>
                    <span className="text-slate-300">/mês</span>
                  </div>
                </div>
                
                <span className="text-slate-500 font-bold">ou</span>
                
                {/* Opção Anual */}
                <div className="bg-gradient-to-br from-orange-500/20 to-red-500/20 p-4 rounded-xl border-2 border-orange-500">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-orange-300 text-sm font-semibold">Anual</p>
                    <span className="bg-green-500 text-white text-xs px-2 py-0.5 rounded-full">ECONOMIA</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-400">
                      12x R$ {planoAfiliado.precoAnualParcela}
                    </span>
                  </div>
                  <p className="text-slate-400 text-xs mt-1">
                    Total: R$ {planoAfiliado.precoAnualTotal.toLocaleString('pt-BR')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Funcionalidades */}
          <div className="grid md:grid-cols-2 gap-3 mb-8">
            {planoAfiliado.features.map((feature, index) => (
              <div key={index} className="flex items-start gap-2 bg-slate-700/30 p-3 rounded-lg">
                <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                <span className="text-gray-200 text-sm">{feature}</span>
              </div>
            ))}
          </div>

          {/* Botão */}
          <button
            onClick={handleEscolherPlano}
            disabled={loading}
            className="w-full bg-gradient-to-r from-green-500 to-emerald-500 text-white py-6 rounded-xl font-bold text-2xl hover:shadow-2xl transition transform hover:scale-105 disabled:opacity-50 mb-4 flex items-center justify-center gap-3"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                Processando...
              </>
            ) : (
              <>
                <CreditCard className="w-8 h-8" />
                🚀 COMEÇAR AGORA
              </>
            )}
          </button>
          
          <p className="text-center text-slate-300 mb-6">
            ✅ Acesso imediato • ✅ Suporte completo • ✅ Cancele quando quiser
          </p>

          {/* Badges */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <Shield className="w-8 h-8 text-green-400 mx-auto mb-2" />
              <p className="text-xs text-gray-300">Pagamento Seguro</p>
            </div>
            <div className="text-center">
              <Zap className="w-8 h-8 text-blue-400 mx-auto mb-2" />
              <p className="text-xs text-gray-300">Acesso Imediato</p>
            </div>
            <div className="text-center">
              <TrendingUp className="w-8 h-8 text-purple-400 mx-auto mb-2" />
              <p className="text-xs text-gray-300">Cancele Quando Quiser</p>
            </div>
          </div>
        </div>

        {/* Card Plano Empresarial */}
        <div className="bg-gradient-to-br from-purple-900/50 to-slate-800/50 backdrop-blur-sm border-2 border-purple-500/50 rounded-2xl p-8 shadow-xl">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="flex-shrink-0">
              <div className="inline-flex p-4 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full">
                <Building2 className="w-8 h-8 text-white" />
              </div>
            </div>
            
            <div className="flex-1 text-center md:text-left">
              <h3 className="text-2xl font-bold text-white mb-2">
                🏭 Plano Empresarial
              </h3>
              <p className="text-slate-300 mb-2">
                Solução personalizada para <span className="text-purple-300 font-semibold">Distribuidoras</span>, <span className="text-purple-300 font-semibold">Fábricas</span> e <span className="text-purple-300 font-semibold">Atacadistas</span>
              </p>
              <p className="text-slate-400 text-sm">
                Integração com ERP, multi-vendedor, automação avançada e suporte dedicado
              </p>
            </div>
            
            <div className="flex-shrink-0">
              <a
                href="https://wa.me/5521995379550?text=Olá! Tenho interesse no Plano Empresarial AMZ Ofertas para minha empresa."
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-4 rounded-xl font-bold text-lg hover:shadow-2xl transition transform hover:scale-105"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                Falar com Consultor
              </a>
            </div>
          </div>
        </div>

        {/* Botão Voltar */}
        <div className="text-center mt-8">
          <button
            onClick={() => navigate('/')}
            className="text-orange-300 hover:text-white transition"
          >
            ← Voltar para a página inicial
          </button>
        </div>
      </div>
    </div>
  );
};

export default Planos;
