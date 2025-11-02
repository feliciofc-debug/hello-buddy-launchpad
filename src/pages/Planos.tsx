import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Zap, Shield, Clock, CreditCard, AlertCircle, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import PaymentFormDirect from '@/components/PaymentFormDirect';

const Planos = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  
  const totalVagas = 100;
  const vagasRestantes = 87;
  const progressoVagas = ((totalVagas - vagasRestantes) / totalVagas) * 100;

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

  const planoEmpresa = {
    id: 'empresa',
    nome: 'Plano Empresa AMZ Ofertas',
    precoMensal: 447,
    precoParcela: 447,
    features: [
      'Produtos ilimitados',
      'Busca automática de oportunidades',
      'IA para geração de posts',
      'Envio direto WhatsApp',
      'Calculadora de ROI avançada',
      'Análise de tendências em tempo real',
      'Relatórios completos',
      'API de integração',
      'Automação completa',
      'Multi-usuário',
      'Suporte prioritário 24/7',
      'Treinamento personalizado'
    ]
  };

  const [selectedPlan, setSelectedPlan] = useState<any>(null);

  const handleEscolherPlano = () => {
    if (!user) {
      navigate('/cadastro');
      return;
    }
    setSelectedPlan(planoEmpresa);
  };


  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">Carregando...</div>
      </div>
    );
  }

  if (selectedPlan) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 py-12">
        <div className="max-w-4xl mx-auto px-6">
          <button
            onClick={() => setSelectedPlan(null)}
            className="text-orange-300 hover:text-white transition mb-6"
          >
            ← Voltar
          </button>
          
          <PaymentFormDirect
            planName={planoEmpresa.nome}
            amount={planoEmpresa.precoMensal}
            planType="monthly"
            userId={user.id}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 py-12">
      <div className="max-w-3xl mx-auto px-6">
        {/* Card Único */}
        <div className="bg-slate-800/50 backdrop-blur-sm border-2 border-orange-500/50 rounded-3xl p-12 shadow-2xl shadow-orange-500/20">
          {/* Badge Topo */}
          <div className="text-center mb-8">
            <span className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-6 py-2 rounded-full text-lg font-bold animate-pulse shadow-lg inline-block mb-6">
              🏢 PLANO EMPRESA
            </span>
            
            <div className="inline-flex p-4 bg-gradient-to-r from-orange-500 to-red-500 rounded-full mb-4">
              <Zap className="w-10 h-10 text-white" />
            </div>
            
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
              {planoEmpresa.nome}
            </h1>

            {/* Preço */}
            <div className="mb-6">
              <div className="flex items-center justify-center gap-2 mb-3">
                <span className="text-5xl md:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500">
                  R$ {planoEmpresa.precoMensal}
                </span>
                <span className="text-2xl text-gray-300">/mês</span>
              </div>
              <p className="text-orange-300 text-xl font-semibold mb-4">
                💳 12x de R$ {planoEmpresa.precoParcela} no cartão
              </p>
              <p className="text-gray-300 text-lg">
                ou R$ {planoEmpresa.precoMensal} via PIX
              </p>
            </div>
          </div>

          {/* Funcionalidades */}
          <div className="grid md:grid-cols-2 gap-3 mb-8">
            {planoEmpresa.features.map((feature, index) => (
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
                🚀 ASSINAR AGORA
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
