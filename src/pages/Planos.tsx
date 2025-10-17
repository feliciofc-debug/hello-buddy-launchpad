import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Zap, TrendingUp, Users, Sparkles, Shield, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';

const Planos = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  
  // Simulação de vagas restantes
  const totalVagas = 100;
  const vagasRestantes = 23; // Você pode fazer isso dinâmico depois
  const progressoVagas = ((totalVagas - vagasRestantes) / totalVagas) * 100;

  const plano = {
    id: 'completo',
    nome: 'Plano Completo AMZ Ofertas',
    precoOriginal: 397,
    preco: 147,
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

  const handleEscolherPlano = async () => {
    setLoading(true);
    
    try {
      const response = await fetch('https://jibpvpqgplmahjhswiza.supabase.co/functions/v1/create-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          plano: plano.id,
          valor: plano.preco,
          nome: plano.nome
        })
      });

      const data = await response.json();

      if (data.init_point) {
        window.location.href = data.init_point;
      } else {
        toast.error('Erro ao processar pagamento');
      }
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao processar pagamento');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header de Urgência */}
      <div className="bg-gradient-to-r from-red-600 to-orange-600 py-4 px-6 text-center">
        <div className="max-w-4xl mx-auto">
          <p className="text-white font-bold text-lg md:text-xl mb-1">
            🔥 ATENÇÃO: Preço especial válido apenas para os 100 PRIMEIROS CLIENTES!
          </p>
          <p className="text-white/90 font-semibold">
            ⏰ Restam apenas {vagasRestantes} vagas
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Card Principal */}
        <div className="relative bg-slate-800/50 backdrop-blur-sm border-2 border-orange-500/50 rounded-3xl p-8 md:p-12 shadow-2xl shadow-orange-500/20">
          {/* Badge Topo */}
          <div className="absolute -top-5 left-1/2 transform -translate-x-1/2">
            <span className="bg-gradient-to-r from-red-500 to-orange-500 text-white px-6 py-2 rounded-full text-sm md:text-base font-bold animate-pulse shadow-lg">
              ⚡ OFERTA DE LANÇAMENTO - 100 PRIMEIROS
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
                  R$ {plano.preco}
                </span>
                <span className="text-2xl text-orange-300">/mês</span>
              </div>
              <p className="text-orange-300 text-lg font-semibold mb-2">
                Apenas para os 100 primeiros clientes
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

          {/* Contador de Vagas */}
          <div className="bg-gradient-to-r from-red-900/50 to-orange-900/50 border border-red-500/50 rounded-2xl p-6 mb-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-white font-bold text-lg">
                🎯 Restam apenas {vagasRestantes} vagas de {totalVagas}
              </span>
              <span className="text-orange-300 font-semibold">
                {Math.round(progressoVagas)}% ocupado
              </span>
            </div>
            <Progress value={progressoVagas} className="h-3 mb-3" />
            <p className="text-red-300 text-sm font-semibold text-center">
              ⚠️ Após as 100 primeiras assinaturas, o valor volta para R$ {plano.precoOriginal}/mês
            </p>
          </div>

          {/* Botão Principal */}
          <button
            onClick={handleEscolherPlano}
            disabled={loading}
            className="w-full bg-gradient-to-r from-green-500 to-emerald-500 text-white py-5 rounded-xl font-bold text-xl hover:shadow-2xl transition transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed mb-4"
          >
            {loading ? 'Processando...' : '🚀 GARANTIR MINHA VAGA - 7 DIAS GRÁTIS'}
          </button>

          {/* Badges de Confiança */}
          <div className="grid grid-cols-3 gap-4 mt-6">
            <div className="text-center">
              <Shield className="w-8 h-8 text-green-400 mx-auto mb-2" />
              <p className="text-xs text-gray-300">Pagamento Seguro</p>
            </div>
            <div className="text-center">
              <Clock className="w-8 h-8 text-blue-400 mx-auto mb-2" />
              <p className="text-xs text-gray-300">7 Dias Grátis</p>
            </div>
            <div className="text-center">
              <TrendingUp className="w-8 h-8 text-purple-400 mx-auto mb-2" />
              <p className="text-xs text-gray-300">Cancele Quando Quiser</p>
            </div>
          </div>
        </div>

        {/* Garantia */}
        <div className="bg-slate-800/50 backdrop-blur-sm border border-green-500/30 rounded-2xl p-6 text-center mt-8">
          <h3 className="text-xl font-bold text-white mb-2">
            ✅ Garantia de 7 Dias
          </h3>
          <p className="text-gray-300">
            Se não gostar, devolvemos 100% do seu dinheiro. Sem perguntas.
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
