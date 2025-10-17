import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Zap, Shield, Clock, CreditCard, AlertCircle, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';

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

  const planoTeste = {
    id: 'teste',
    nome: 'Plano TESTE - AMZ Ofertas',
    precoOriginal: 397,
    preco: 12,
    precoParcela: 1,
    parcelas: 12,
    economia: 385,
    percentualDesconto: 97,
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

  const planoReal = {
    id: 'completo',
    nome: 'Plano Completo AMZ Ofertas',
    precoOriginal: 397,
    preco: 1764,
    precoParcela: 147,
    parcelas: 12,
    economia: 250,
    percentualDesconto: 63,
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

  const handleEscolherPlano = async (planoSelecionado) => {
    if (!user) {
      navigate('/cadastro');
      return;
    }

    setLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('create-payment', {
        body: {
          userId: user.id,
          userEmail: user.email,
          planType: planoSelecionado.id
        }
      });

      if (error) throw error;

      if (data?.success && data?.checkoutUrl) {
        // Redireciona diretamente para o Mercado Pago
        window.location.href = data.checkoutUrl;
      } else {
        toast.error('Erro ao processar pagamento');
      }
    } catch (error: any) {
      console.error('Erro:', error);
      toast.error(error.message || 'Erro ao processar pagamento');
    } finally {
      setLoading(false);
    }
  };

  const renderPlano = (plano, isTeste = false) => (
    <div key={plano.id} className="relative bg-slate-800/50 backdrop-blur-sm border-2 border-orange-500/50 rounded-3xl p-8 md:p-12 shadow-2xl shadow-orange-500/20">
      {/* Badge Topo */}
      <div className="absolute -top-5 left-1/2 transform -translate-x-1/2">
        <span className={`${isTeste ? 'bg-gradient-to-r from-blue-500 to-cyan-500' : 'bg-gradient-to-r from-red-500 to-orange-500'} text-white px-6 py-2 rounded-full text-sm md:text-base font-bold animate-pulse shadow-lg`}>
          {isTeste ? '🧪 PLANO TESTE - R$1/MÊS' : '⚡ OFERTA DE LANÇAMENTO - 100 PRIMEIROS'}
        </span>
      </div>

      {/* Título */}
      <div className="text-center mt-6 mb-8">
        <div className="inline-flex p-4 bg-gradient-to-r from-orange-500 to-red-500 rounded-full mb-4">
          <Zap className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-6">
          {plano.nome}
        </h1>

        {/* Preços */}
        <div className="mb-6">
          <div className="flex items-center justify-center gap-3 mb-2">
            <span className="text-2xl text-gray-400 line-through">
              R$ {plano.precoOriginal}/mês
            </span>
            <span className="bg-green-500 text-white px-3 py-1 rounded-full text-sm font-bold">
              {plano.percentualDesconto}% OFF
            </span>
          </div>
          <div className="flex items-center justify-center gap-2 mb-3">
            <span className="text-5xl md:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500">
              12x R$ {plano.precoParcela}
            </span>
          </div>
          <p className="text-gray-300 text-lg mb-2">
            Total: R$ {plano.preco}
          </p>
          <p className="text-orange-300 text-lg font-semibold mb-2">
            {isTeste ? 'Plano de TESTE - Funcionalidade completa' : 'Apenas para os 100 primeiros clientes'}
          </p>
          <div className="inline-block bg-gradient-to-r from-green-500 to-emerald-500 text-white px-6 py-2 rounded-full font-bold text-lg">
            💰 Economize R$ {plano.economia}/mês
          </div>
        </div>
      </div>

      {/* Funcionalidades */}
      <div className="grid md:grid-cols-2 gap-3 mb-8">
        {plano.features.map((feature, index) => (
          <div key={index} className="flex items-start gap-2 bg-slate-700/30 p-3 rounded-lg">
            <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
            <span className="text-gray-200 text-sm">{feature}</span>
          </div>
        ))}
      </div>

      {/* Botão Principal */}
      <button
        onClick={() => handleEscolherPlano(plano)}
        disabled={loading}
        className="w-full bg-gradient-to-r from-green-500 to-emerald-500 text-white py-6 rounded-xl font-bold text-2xl hover:shadow-2xl transition transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed mb-4 flex items-center justify-center gap-3"
      >
        {loading ? (
          <>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
            Processando...
          </>
        ) : (
          <>
            <CreditCard className="w-8 h-8" />
            🚀 {isTeste ? 'ASSINAR PLANO TESTE' : 'GARANTIR MINHA VAGA'}
          </>
        )}
      </button>
      
      <p className="text-center text-slate-300 mb-6">
        ✅ Acesso imediato • ✅ Suporte completo • ✅ Cancele quando quiser
      </p>

      {/* Badges de Confiança */}
      <div className="grid grid-cols-3 gap-4 mt-6">
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
  );

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Alert Urgência */}
      <div className="bg-gradient-to-r from-red-500 to-orange-500 rounded-xl p-6 mb-12 text-center max-w-4xl mx-auto">
        <div className="flex items-center justify-center gap-3 mb-3">
          <AlertCircle className="w-8 h-8 text-white" />
          <h3 className="text-2xl font-bold text-white">🔥 ATENÇÃO: OFERTA LIMITADA!</h3>
        </div>
        <p className="text-white text-lg mb-2">Preço especial válido apenas para os <strong>100 PRIMEIROS CLIENTES!</strong></p>
        <div className="inline-block bg-white/20 backdrop-blur-sm px-6 py-3 rounded-full">
          <p className="text-white font-bold text-xl">⏰ Restam apenas {vagasRestantes} vagas de 100</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid md:grid-cols-2 gap-8">
          {/* Plano TESTE */}
          {renderPlano(planoTeste, true)}
          
          {/* Plano REAL */}
          {renderPlano(planoReal, false)}
        </div>

        {/* Garantia */}
      <div className="bg-slate-800/50 backdrop-blur-sm border border-green-500/30 rounded-2xl p-6 text-center mt-8">
          <h3 className="text-xl font-bold text-white mb-2">
            ✅ Garantia de Satisfação
          </h3>
          <p className="text-gray-300">
            Suporte completo e acesso imediato a todas as funcionalidades.
          </p>
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
